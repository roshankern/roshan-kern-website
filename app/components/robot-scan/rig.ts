import {
  ARM,
  MOUNT,
  rollOriginFor,
  type ArmJoints,
  type ScanSample,
  type Vec3,
} from "./contracts";

/**
 * Inverse kinematics for the five-joint chain in the ARM comment, plus an
 * independent forward pass to check it against.
 *
 * ------------------------------------------------------------------ history
 *
 * The original solver aimed the camera exactly down the surface normal. It was
 * exact — round-trip error 1e-12 — and it produced an unusable animation. With
 * the camera mounted across the wrist-roll axis, the roll servo had to chase
 * the aim as the arm panned across the face, and over one loop the roll it
 * asked for wound through about 350 degrees against 320 degrees of travel. It
 * jammed on the stop and the phone swung away into empty space beside the head.
 *
 * MOUNT.axisTilt is now zero, which is what actually fixes that: the camera
 * looks straight down the last link, so the roll cannot affect the aim at all
 * and has nothing to chase or wind. The aim is the arm's own reaching
 * direction.
 *
 * ------------------------------------------------------------------ the geometry
 *
 * Every joint origin of this arm lies in ONE vertical plane through the base
 * column — that is what pan means. With the camera on the link axis, the camera
 * axis lies in that plane too, and so does the point the camera is looking from.
 * So the aim has two degrees of freedom, not three: it can be anywhere in the
 * pan plane and nowhere out of it.
 *
 * The skin normals are not in that plane. Measured over the loop, they lean out
 * of it by up to 54 degrees at the outer cheek stations. Nothing the arm can do
 * about that, so the question is only what to give away.
 *
 * ------------------------------------------------------------------ what gives
 *
 * Give away SQUARENESS to the surface, and keep the camera pointing at the skin
 * and standing off it by the working distance. That is one line of geometry and
 * it is the whole design:
 *
 *     tracked point  T = skin - MOUNT.standoff * axis
 *
 * rather than the obvious `skin + standoff * normal`. Both put the phone
 * MOUNT.standoff from the skin point. The difference is where it stands: the
 * obvious one pins the phone on the normal ray and then has to point it
 * somewhere it cannot, so the camera ends up looking tens of degrees past the
 * face — which is exactly the phone-in-empty-space the figure was showing. This
 * one slides the phone round to sit on the axis the arm can actually aim, so
 * the camera looks straight AT the skin point from the right distance, and what
 * is lost is only that it views the cheek at a slant instead of square on.
 *
 * A scanner that images a cheek obliquely is a scanner working. A scanner
 * pointing beside the head is a bug, and that is the trade.
 *
 * The aim direction itself is the projection of -normal into the pan plane, so
 * the slant is the smallest one available at each station: square on the
 * midline, worst at the outer cheeks.
 *
 * ------------------------------------------------------------------ the solve
 *
 * One small fixed point, then closed form:
 *
 *   pan    The tracked point has to lie in the pan plane, and where it lies
 *          depends on the aim, which depends on the plane. Circular, so iterate
 *          — but the phone only moves MOUNT.standoff as the aim swings, against
 *          a quarter-metre reach, so the map contracts hard and settles in a
 *          handful of steps rather than dozens.
 *   alpha  The total pitch, lift + elbow + flex, which IS the aim: the link and
 *          the camera axis are the same line now. So alpha is just the in-plane
 *          angle of the projected normal.
 *   W, F   Both lie on the ray back from the skin point along the aim, because
 *          the whole tool hangs on the axis: rollOriginFor puts the wrist-roll
 *          origin MOUNT.lensAlongLink behind the tracked point, and the
 *          wrist-flex pivot is ARM.L3 behind that.
 *   lift,  Ordinary two-link IK in the pan plane, elbow-UP only. Not a
 *   elbow  preference: elbow-down needs the elbow joint positive and its stop is
 *          at +0.293 rad, so it is only legal on a nearly straight arm. One
 *          branch everywhere is also what stops the arm changing configuration
 *          mid-sweep, which is what tore the old solver's motion.
 *   flex   Whatever pitch the first two joints did not supply. It is the
 *          tightest joint on the arm at +/-95 degrees, and where it runs out
 *          the solver walks alpha in from the ideal rather than clamping — see
 *          below, that costs aim and costs neither distance nor configuration.
 *   roll   Zero. It spins the phone about its own camera axis and changes
 *          nothing else, so there is nothing to solve and nothing to wind.
 *
 * This file assumes MOUNT.axisTilt is zero — that the camera axis IS the link.
 * If it is ever set otherwise the camera leans off the link by that angle and
 * this solver does not know, so the tilt shows up one-for-one as extra aim
 * error, and the roll joint would need to be given the job back.
 *
 * Notation throughout, all in world space:
 *   a      = -normal, where the camera would look if the arm could
 *   f      = (-sin pan, 0, -cos pan), the pan plane's horizontal forward
 *   u      = (0, 1, 0)
 *   d      = cos(alpha) f + sin(alpha) u, the last link, the roll axis, AND the
 *            camera axis, all the same line
 *   S      = the shoulder-lift pivot, world (0, ARM.shoulderY, ARM.baseZ)
 *   T      = the tracked point: the phone's centre
 *   W      = the wrist-roll frame origin
 *   F      = the wrist-flex pivot, W - ARM.L3 d
 *
 * Every dimension and every joint limit is read out of ARM and MOUNT at call
 * time. Nothing here caches a millimetre or a radian from contracts.ts, so the
 * contract can be retuned without touching this file.
 */

/** The pan fixed point, in radians. Well inside what the animation can show. */
const PAN_SETTLED = 1e-12;
const MAX_PAN_STEPS = 24;

type Limit = readonly [number, number];

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Shortest signed distance between two angles, so a step across +/-pi is honest. */
function wrapPi(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Distance from a joint value to its nearest stop, as a fraction of its range,
 *  so joints with different travel compare fairly. Negative means past a stop. */
function marginOf(v: number, limit: Limit): number {
  return Math.min(v - limit[0], limit[1] - v) / (limit[1] - limit[0]);
}

/** NaN never reaches the scene: a clamped joint is a pose, a NaN is a hole. */
function clampJoint(v: number, limit: Limit): number {
  if (!Number.isFinite(v)) return 0;
  return clamp(v, limit[0], limit[1]);
}

/** The pan whose plane passes through a point: rotation.y = pan sends -Z to f. */
function bearingOf(p: Vec3): number | null {
  const rx = p.x;
  const rz = p.z - ARM.baseZ;
  // Straight over the base column the plane is free to be anything.
  if (Math.hypot(rx, rz) < 1e-9) return null;
  return Math.atan2(-rx, -rz);
}

/**
 * Joint angles that stand the phone's centre MOUNT.standoff off `sample.skin`,
 * looking straight at it.
 *
 * One closed-form pose, not a field of candidates: there is one elbow branch and
 * the roll is fixed, so consecutive samples cannot land in different
 * configurations and the sweep cannot flip. That is worth more along a path than
 * picking the locally roomiest pose.
 *
 * `reachable` is false when the pose had to be compromised — the wrist pivot
 * falls outside the two-link annulus, or a joint runs past a stop. It does NOT
 * report on the aim: the camera is deliberately off the normal by however much
 * the pan plane demands, and giving that away is this solver's design rather
 * than its failure mode. A sample where it happened is a perfectly good pose
 * that the trajectory must not treat as a hole to interpolate across.
 */
export function solveArm(sample: ScanSample): ArmJoints {
  const shoulder: Vec3 = { x: 0, y: ARM.shoulderY, z: ARM.baseZ };
  const a: Vec3 = { x: -sample.normal.x, y: -sample.normal.y, z: -sample.normal.z };

  /** The pan plane's forward, and the best aim available in it, given a pan. */
  const planeFor = (pan: number) => {
    const f: Vec3 = { x: -Math.sin(pan), y: 0, z: -Math.cos(pan) };
    // The in-plane part of a, as an angle. Dropping the out-of-plane part is
    // the whole approximation; what is left is the closest the arm can come.
    const alpha = Math.atan2(a.y, dot(a, f));
    const ca = Math.cos(alpha);
    const d: Vec3 = { x: ca * f.x, y: Math.sin(alpha), z: ca * f.z };
    return { f, alpha, d };
  };

  // Settle pan. Seeding from the normal's own bearing starts within a couple of
  // degrees; each step moves the phone at most MOUNT.standoff, which is a small
  // fraction of its distance from the base, so this is a strong contraction.
  let pan =
    bearingOf({
      x: sample.skin.x + sample.normal.x * MOUNT.standoff,
      y: sample.skin.y + sample.normal.y * MOUNT.standoff,
      z: sample.skin.z + sample.normal.z * MOUNT.standoff,
    }) ?? 0;
  for (let i = 0; i < MAX_PAN_STEPS; i += 1) {
    const { d } = planeFor(pan);
    // The tracked point: standoff back from the skin along the aim, not along
    // the normal. See the header — this is the line the whole design turns on.
    const next = bearingOf({
      x: sample.skin.x - d.x * MOUNT.standoff,
      y: sample.skin.y - d.y * MOUNT.standoff,
      z: sample.skin.z - d.z * MOUNT.standoff,
    });
    if (next === null) break;
    const step = Math.abs(wrapPi(next - pan));
    pan = next;
    if (step <= PAN_SETTLED) break;
  }

  const { f, alpha: wantAlpha } = planeFor(pan);

  /**
   * The rest of the chain, for a given total pitch.
   *
   * Everything downstream hangs on the ray running back from the skin point
   * along the aim, so for ANY alpha the phone still stands MOUNT.standoff off
   * the skin and still looks straight at it. Only the slant changes. That is
   * what makes alpha the right thing to compromise on when a joint runs out:
   * giving up a few degrees of squareness is invisible, giving up the working
   * distance or flipping the arm's configuration is not.
   */
  const chain = (alpha: number) => {
    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);
    const d: Vec3 = { x: ca * f.x, y: sa, z: ca * f.z };
    // Hand rollOriginFor the direction the arm is actually approaching from in
    // place of the normal: it wants "the outward direction the tracked point
    // sits along", and here that is -d rather than the surface normal.
    const W = rollOriginFor({ skin: sample.skin, normal: { x: -d.x, y: -d.y, z: -d.z } }, d);

    // Two-link IK target, in the pan plane's own coordinates: forward along f,
    // up along u. Taking only these two components also projects F back into the
    // plane, which matters while alpha is off the settled value and the ray has
    // drifted a millimetre or two out of it.
    const rel: Vec3 = {
      x: W.x - ARM.L3 * d.x - shoulder.x,
      y: W.y - ARM.L3 * d.y - shoulder.y,
      z: W.z - ARM.L3 * d.z - shoulder.z,
    };
    const p = dot(rel, f);
    const q = rel.y;
    const D = Math.hypot(p, q);
    const dMax = ARM.L1 + ARM.L2;
    const dMin = Math.abs(ARM.L1 - ARM.L2);
    const reachError = D > dMax ? D - dMax : D < dMin ? dMin - D : 0;

    const safe = Math.max(D, 1e-9);
    // Out of the annulus these acos arguments clamp on their own, which
    // straightens the arm at full stretch or folds it right up: the pose points
    // the right way and stays finite, and reachError has recorded the miss.
    const shoulderAngle = Math.acos(
      clamp((ARM.L1 * ARM.L1 + safe * safe - ARM.L2 * ARM.L2) / (2 * ARM.L1 * safe), -1, 1),
    );
    const interior = Math.acos(
      clamp((ARM.L1 * ARM.L1 + ARM.L2 * ARM.L2 - safe * safe) / (2 * ARM.L1 * ARM.L2), -1, 1),
    );

    // Elbow-up: the upper arm is raised above the line S->F by the triangle's
    // angle at S and the forearm bends back down, which puts `elbow` in [-pi, 0].
    const lift = Math.atan2(q, p) + shoulderAngle;
    const elbow = interior - Math.PI;
    // The pitch chain accumulates, so the last joint takes up what is left.
    const flex = alpha - lift - elbow;

    // One number for "how far outside the machine is this", so the search below
    // has something to minimise: the annulus miss as a fraction of full stretch,
    // plus the worst stop overrun as a fraction of that joint's travel.
    const over = Math.min(
      marginOf(lift, ARM.limits.lift),
      marginOf(elbow, ARM.limits.elbow),
      marginOf(flex, ARM.limits.flex),
    );
    return { lift, elbow, flex, D, violation: reachError / dMax + Math.max(0, -over) };
  };

  // Walk out from the ideal aim until the arm can hold the pose.
  //
  // Which way to walk has to be got right, and it is not "whichever side clears
  // first". The feasible set in alpha is DISCONNECTED: where the wrist flex
  // saturates there is a band of blocked alpha, and past it a second sliver of
  // legal poses just before the wrist pivot leaves the two-link annulus — an arm
  // at dead full stretch. A search that takes the nearer end swaps between them
  // as the band drifts past the ideal, and swaps the arm between folded and
  // straight in a single frame.
  //
  // So commit to the direction that pulls the wrist pivot IN toward the
  // shoulder, measured on the spot as the sign of dD/d(alpha). That never walks
  // into the full-stretch sliver, it is a smooth function of the sample so the
  // direction cannot flip frame to frame, and it is the side with room to give.
  // The far side is tried only if this one never clears, which is the case where
  // the arm is short of the target rather than out of wrist.
  const COARSE = (0.25 * Math.PI) / 180;
  const GIVE = (120 * Math.PI) / 180;
  // `best` is always chain() of the alpha currently chosen, so nothing has to
  // remember the angle itself.
  let best = chain(wantAlpha);
  if (best.violation > 0) {
    const probe = COARSE / 4;
    const inward = chain(wantAlpha + probe).D <= chain(wantAlpha - probe).D ? 1 : -1;
    let found = false;
    for (const side of [inward, -inward]) {
      for (let n = 1; n * COARSE <= GIVE; n += 1) {
        const trialAlpha = wantAlpha + side * n * COARSE;
        const c = chain(trialAlpha);
        if (c.violation <= 0) {
          // Bisect between the last blocked alpha, one coarse step back toward
          // the ideal, and this first free one.
          let blocked = trialAlpha - side * COARSE;
          let free = trialAlpha;
          for (let k = 0; k < 24; k += 1) {
            const mid = (blocked + free) / 2;
            if (chain(mid).violation <= 0) free = mid;
            else blocked = mid;
          }
          best = chain(free);
          found = true;
          break;
        }
        if (c.violation < best.violation) best = c;
      }
      if (found) break;
    }
    // If neither side ever cleared, `best` holds the least-bad pose seen, which
    // is clamped below: a stiff arm in the right neighbourhood is a far better
    // failure than a hole in the animation.
  }

  const { lift, elbow, flex, violation } = best;
  // The roll spins the phone about its own camera axis and changes nothing the
  // scan can see, so it is held at zero rather than left to drift. This is the
  // joint that used to wind itself into its stop; it now has no job at all.
  const roll = 0;

  const margin = Math.min(
    marginOf(pan, ARM.limits.pan),
    marginOf(lift, ARM.limits.lift),
    marginOf(elbow, ARM.limits.elbow),
    marginOf(flex, ARM.limits.flex),
    marginOf(roll, ARM.limits.roll),
  );

  if (violation <= 0 && margin >= 0) {
    return { pan, lift, elbow, flex, roll, reachable: true };
  }

  return {
    pan: clampJoint(pan, ARM.limits.pan),
    lift: clampJoint(lift, ARM.limits.lift),
    elbow: clampJoint(elbow, ARM.limits.elbow),
    flex: clampJoint(flex, ARM.limits.flex),
    roll: clampJoint(roll, ARM.limits.roll),
    reachable: false,
  };
}

/** three's rotation.x: y' = y cos a - z sin a, z' = y sin a + z cos a. */
function rotX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

/** three's rotation.y: x' = x cos a + z sin a, z' = -x sin a + z cos a. */
function rotY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

/** three's rotation.z: x' = x cos a - y sin a, y' = x sin a + y cos a. */
function rotZ(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

/**
 * Forward kinematics: where the tracked point actually ends up, and where the
 * camera actually looks, for a set of joint angles.
 *
 * `lens` is the phone's CENTRE, not the lens glass — the point the bracket holds
 * and the point solveArm positions. The scanning camera is an island in the
 * corner of the phone's back, about 58 mm along the phone's long axis and 8.5 mm
 * along its short one from that centre, so the glass looks at a patch of skin
 * that far to one side. The name is kept because everything downstream reads it,
 * and buildTool puts the shroud and the ring light on the real island rather
 * than on the axis.
 *
 * This walks the scene graph the way three.js would — start in the wrist-roll
 * group's own frame, then repeatedly add the group's offset in its parent and
 * apply the parent's rotation, up to the world. It deliberately shares nothing
 * with solveArm: no pan plane, no alpha, no rollOriginFor. That is the whole
 * point, since the two are only worth anything as a check on each other.
 */
export function lensPose(joints: ArmJoints): { lens: Vec3; axis: Vec3; rollOrigin: Vec3 } {
  // The tool as buildTool leaves it. The holder sits lensFromAxis across the
  // link and lensAlongLink down it, canted by axisTilt about its OWN origin —
  // which is why the tracked point does not move when the cant changes, and why
  // these two lines are the plain offsets rather than a rotated pair.
  const ct = Math.cos(MOUNT.axisTilt);
  const st = Math.sin(MOUNT.axisTilt);
  let lens: Vec3 = { x: 0, y: -MOUNT.lensFromAxis, z: -MOUNT.lensAlongLink };
  let axis: Vec3 = { x: 0, y: -st, z: -ct };
  let origin: Vec3 = { x: 0, y: 0, z: 0 };

  // The bracket's clocking sits between the tool's own layout and the roll
  // servo, exactly as buildTool applies it, so it turns first.
  lens = rotZ(lens, MOUNT.bracketRoll);
  axis = rotZ(axis, MOUNT.bracketRoll);

  // Then the roll group's own rotation, before it is placed in its parent.
  lens = rotZ(lens, joints.roll);
  axis = rotZ(axis, joints.roll);
  origin = rotZ(origin, joints.roll);

  const step = (dx: number, dy: number, dz: number, rot: (v: Vec3, a: number) => Vec3, a: number) => {
    lens = rot({ x: lens.x + dx, y: lens.y + dy, z: lens.z + dz }, a);
    origin = rot({ x: origin.x + dx, y: origin.y + dy, z: origin.z + dz }, a);
    // A direction ignores the offsets; only the rotations turn it.
    axis = rot(axis, a);
  };

  step(0, 0, -ARM.L3, rotX, joints.flex);
  step(0, 0, -ARM.L2, rotX, joints.elbow);
  step(0, 0, -ARM.L1, rotX, joints.lift);
  step(0, ARM.shoulderY, 0, rotY, joints.pan);

  // The base plate is not rotated; it just stands at +Z in front of the face.
  return {
    lens: { x: lens.x, y: lens.y, z: lens.z + ARM.baseZ },
    axis,
    rollOrigin: { x: origin.x, y: origin.y, z: origin.z + ARM.baseZ },
  };
}
