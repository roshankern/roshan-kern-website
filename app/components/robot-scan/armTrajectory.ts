import { ARM, type ArmJoints } from "./contracts";
import { scanSampleAt } from "./scanPath";
import { solveArm } from "./rig";

/**
 * The arm's motion, precomputed once as a joint-space trajectory rather than
 * solved fresh every frame.
 *
 * This used to carry a lot more machinery than it does now, and the reason is
 * worth recording. The old solver returned FOUR closed-form poses per sample
 * and this file had to walk the loop twice choosing, at each step, whichever
 * of the four sat nearest the pose before it — otherwise the winner changed
 * mid-sweep and the arm snapped through half a turn. rig.ts now returns one
 * pose, from one roll branch and one elbow branch, and gives away a few
 * degrees of aim rather than changing configuration. So the continuity search,
 * and the whole-trajectory turn-shifting that unwrapping used to make
 * necessary, are gone. What is left is the smoothing and the pacing, which a
 * per-frame solve still cannot do:
 *
 *   1. solve every sample, and record which ones the arm could actually hold;
 *   2. unwrap each joint so a wrap never reads as a jump — a formality now
 *      that the solver returns a single continuous branch, kept as a backstop;
 *   3. bridge any unreachable runs by interpolating across them, so the arm
 *      passes through the gap on its way rather than lurching at its edge;
 *   4. smooth the whole loop, which rounds off the corners the path takes at
 *      sharp features;
 *   5. resample at constant joint-space speed, so the phone moves at one
 *      steady rate all the way round instead of racing the tight bits.
 *
 * The cost is that the lens no longer sits at exactly its working distance
 * every instant — smoothing pulls it a few millimetres off. That is invisible.
 * A wrist snapping through ninety degrees is not.
 */

/** Samples around the loop. Enough that smoothing has something to work with. */
const SAMPLES = 720;
/** Passes of the 1-2-1 smoothing kernel. More rounds the corners off harder. */
const SMOOTH_PASSES = 6;

type Table = {
  pan: Float64Array;
  lift: Float64Array;
  elbow: Float64Array;
  flex: Float64Array;
  roll: Float64Array;
  /** Fraction of the loop the arm could reach exactly, for the checks. */
  reachedFraction: number;
};

const KEYS = ["pan", "lift", "elbow", "flex", "roll"] as const;
type Key = (typeof KEYS)[number];

const TWO_PI = Math.PI * 2;

/** Bring `v` within half a turn of `ref`, so a wrap never reads as a jump. */
function unwrap(v: number, ref: number): number {
  let out = v;
  while (out - ref > Math.PI) out -= TWO_PI;
  while (out - ref < -Math.PI) out += TWO_PI;
  return out;
}

/**
 * Fill the runs where the arm could not reach. Each gap is bridged by a
 * cosine blend between the last good pose before it and the first after,
 * wrapping around the end of the loop. A straight line would do, but the
 * blend leaves no velocity step at the seams, which is the whole point.
 */
function bridgeGaps(values: Float64Array, good: boolean[]): void {
  const n = values.length;
  if (good.every((g) => g) || good.every((g) => !g)) return;

  for (let i = 0; i < n; i++) {
    if (good[i]) continue;
    // Walk out to the nearest good sample either side, circularly.
    let back = 1;
    while (!good[(i - back + n) % n]) back++;
    let fwd = 1;
    while (!good[(i + fwd) % n]) fwd++;
    const a = values[(i - back + n) % n];
    const b = values[(i + fwd) % n];
    const u = back / (back + fwd);
    const k = 0.5 - 0.5 * Math.cos(Math.PI * u);
    values[i] = a + (b - a) * k;
  }
}

/** One periodic 1-2-1 pass. Periodic because the scan is a closed loop. */
function smoothPass(values: Float64Array): void {
  const n = values.length;
  const prev = Float64Array.from(values);
  for (let i = 0; i < n; i++) {
    const a = prev[(i - 1 + n) % n];
    const b = prev[i];
    const c = prev[(i + 1) % n];
    values[i] = 0.25 * a + 0.5 * b + 0.25 * c;
  }
}

/**
 * Resample the loop so equal steps in phase are equal distances in joint
 * space. Without this the phone's speed is set by how the path happens to be
 * parameterised, which is fastest exactly where the surface curves hardest.
 *
 * Joint angles are in radians and are simply summed: the shoulder and the
 * wrist count the same. That is cruder than weighting by each link's length,
 * but it is what "the arm is moving fast" actually looks like.
 */
function resampleByArcLength(table: Record<Key, Float64Array>): void {
  const n = table.pan.length;
  const cumulative = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    let step = 0;
    for (const k of KEYS) {
      const d = table[k][(i + 1) % n] - table[k][i];
      step += d * d;
    }
    cumulative[i + 1] = cumulative[i] + Math.sqrt(step);
  }
  const total = cumulative[n];
  if (total <= 0) return;

  const source: Record<Key, Float64Array> = {
    pan: Float64Array.from(table.pan),
    lift: Float64Array.from(table.lift),
    elbow: Float64Array.from(table.elbow),
    flex: Float64Array.from(table.flex),
    roll: Float64Array.from(table.roll),
  };

  let at = 0;
  for (let i = 0; i < n; i++) {
    const want = (total * i) / n;
    while (at < n && cumulative[at + 1] < want) at++;
    const span = cumulative[at + 1] - cumulative[at];
    const u = span > 0 ? (want - cumulative[at]) / span : 0;
    for (const k of KEYS) {
      const a = source[k][at % n];
      const b = source[k][(at + 1) % n];
      table[k][i] = a + (b - a) * u;
    }
  }
}

const LIMITS: Record<Key, readonly [number, number]> = {
  pan: ARM.limits.pan,
  lift: ARM.limits.lift,
  elbow: ARM.limits.elbow,
  flex: ARM.limits.flex,
  roll: ARM.limits.roll,
};

/** Hold every joint inside its servo's travel. Reports the worst excursion. */
function clampToLimits(table: Record<Key, Float64Array>): number {
  const limits = LIMITS;
  let worst = 0;
  for (const k of KEYS) {
    const [lo, hi] = limits[k];
    const v = table[k];
    for (let i = 0; i < v.length; i++) {
      if (v[i] < lo) {
        worst = Math.max(worst, lo - v[i]);
        v[i] = lo;
      } else if (v[i] > hi) {
        worst = Math.max(worst, v[i] - hi);
        v[i] = hi;
      }
    }
  }
  return worst;
}

let cached: Table | null = null;

function build(): Table {
  const raw: Record<Key, Float64Array> = {
    pan: new Float64Array(SAMPLES),
    lift: new Float64Array(SAMPLES),
    elbow: new Float64Array(SAMPLES),
    flex: new Float64Array(SAMPLES),
    roll: new Float64Array(SAMPLES),
  };
  const good: boolean[] = new Array(SAMPLES).fill(false);

  // One pass, in path order. There is nothing to choose between any more: the
  // solver commits to a single roll branch and a single elbow branch for the
  // whole loop, so consecutive samples are already neighbours in joint space
  // and the start of the loop already agrees with its end.
  let reached = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const pick = solveArm(scanSampleAt(i / SAMPLES));
    raw.pan[i] = pick.pan;
    raw.lift[i] = pick.lift;
    raw.elbow[i] = pick.elbow;
    raw.flex[i] = pick.flex;
    raw.roll[i] = pick.roll;
    good[i] = pick.reachable;
    if (pick.reachable) reached++;
  }

  // Unwrap along the loop, seeded from the first sample the arm could reach so
  // a clamped pose never sets the branch everything after it follows.
  const seed = Math.max(0, good.indexOf(true));
  for (const k of KEYS) {
    for (let step = 1; step < SAMPLES; step++) {
      const i = (seed + step) % SAMPLES;
      const prev = (seed + step - 1) % SAMPLES;
      raw[k][i] = unwrap(raw[k][i], raw[k][prev]);
    }
    bridgeGaps(raw[k], good);
    for (let pass = 0; pass < SMOOTH_PASSES; pass++) smoothPass(raw[k]);
  }

  resampleByArcLength(raw);

  // The solver already returns every joint inside its stops, and smoothing a
  // set of in-range values cannot take them out of range — a 1-2-1 kernel is a
  // convex combination. This is the backstop that says so out loud, and it is
  // what catches a retuned MOUNT or a re-clocked bracket putting the roll
  // somewhere the servo cannot go.
  clampToLimits(raw);

  return { ...raw, reachedFraction: reached / SAMPLES };
}

function table(): Table {
  if (cached === null) cached = build();
  return cached;
}

/** Catmull-Rom through four samples of one joint. */
function spline(v: Float64Array, i: number, u: number): number {
  const n = v.length;
  const p0 = v[(i - 1 + n) % n];
  const p1 = v[i % n];
  const p2 = v[(i + 1) % n];
  const p3 = v[(i + 2) % n];
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (3 * p1 - p0 - 3 * p2 + p3) * u3)
  );
}

/**
 * The arm's pose at phase `t`, one loop per unit, periodic. Built on first
 * call and reused; the table is a few thousand numbers.
 *
 * `reachable` is always true here: every pose this returns is inside the stops
 * and safe to display. Whether the underlying solve was exact is the table's
 * business, and reachedFraction() reports it.
 */
export function jointsAt(t: number): ArmJoints {
  const tb = table();
  const phase = (t - Math.floor(t)) * SAMPLES;
  const i = Math.floor(phase);
  const u = phase - i;
  return {
    pan: spline(tb.pan, i, u),
    lift: spline(tb.lift, i, u),
    elbow: spline(tb.elbow, i, u),
    flex: spline(tb.flex, i, u),
    roll: spline(tb.roll, i, u),
    reachable: true,
  };
}

/** How much of the loop the solver reached exactly, for the verification script. */
export function reachedFraction(): number {
  return table().reachedFraction;
}

/** Largest joint step between adjacent frames of the finished trajectory. */
export function worstStep(): number {
  const tb = table();
  let worst = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const a = jointsAt(i / SAMPLES);
    const b = jointsAt((i + 1) / SAMPLES);
    worst = Math.max(
      worst,
      Math.abs(b.pan - a.pan),
      Math.abs(b.lift - a.lift),
      Math.abs(b.elbow - a.elbow),
      Math.abs(b.flex - a.flex),
      Math.abs(b.roll - a.roll),
    );
  }
  return worst;
}

/** Every pose the trajectory produces must still respect the servo stops. */
export function withinLimits(): boolean {
  const tb = table();
  const check = (v: Float64Array, limit: readonly [number, number]) => {
    for (let i = 0; i < v.length; i++) {
      if (v[i] < limit[0] || v[i] > limit[1]) return false;
    }
    return true;
  };
  return (
    check(tb.pan, ARM.limits.pan) &&
    check(tb.lift, ARM.limits.lift) &&
    check(tb.elbow, ARM.limits.elbow) &&
    check(tb.flex, ARM.limits.flex) &&
    check(tb.roll, ARM.limits.roll)
  );
}
