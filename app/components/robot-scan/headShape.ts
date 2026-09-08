import { HEAD, type ScanSample, type Vec3 } from "./contracts";

/**
 * The analytic skin surface of the head, and the single source of truth for
 * where the skin is. Two consumers share it: buildHead.ts tessellates it into
 * a mesh, and the scan path walks the phone across it, so both agree on the
 * millimetre and on the normal the camera has to face.
 *
 * The model is a warped ellipsoid written as a radial multiplier about a
 * per-height section centre:
 *
 *   p(θ, φ) = C(φ) + M(θ, φ) · E(θ, φ)
 *
 *   C(φ)  the section centre: HEAD.centre, pushed forward in Z as you descend,
 *         so the jaw and chin sit ahead of the cranium rather than under it.
 *   E     the base offset: a cross-section whose half-breadth, front half-depth
 *         and back half-depth are each their own profile of height. All three
 *         close toward the poles at one shared rate, chosen so the underside of
 *         the jaw is a round 68 mm arc rather than the point a plain ellipsoid
 *         would give.
 *   M     headField(): 1 plus the sum of the facial features, each a smooth
 *         localised bump in (θ, φ), divided by |E| so the bumps can be written
 *         in millimetres of relief.
 *
 * Everything is C1 (in fact C2 away from the poles): the profiles are natural
 * cubic splines and every feature is a Gaussian, because the scan path
 * differentiates this surface and a hard edge would jerk the arm.
 *
 * Angles follow contracts.ts: θ swings about +Y with 0 facing +Z and positive
 * toward +X (the head's own left), ±π at the occiput; φ is elevation, 0 at
 * HEAD.centre's height, +π/2 at the vertex, −π/2 under the chin.
 *
 * Anthropometry: ANSUR II / Farkas 50th-percentile adult — head breadth 152,
 * head length 197, menton-to-vertex 232, all of which HEAD already encodes.
 * Landmark heights used below come from the same tables (glabella 195,
 * pupil 168, pronasale 133, subnasale 120, stomion 91, pogonion 58, menton 34).
 */

const HALF_PI = Math.PI / 2;

// ------------------------------------------------------------ 1-D profiles

/**
 * A natural cubic spline through a handful of (φ, value) knots. Sculpting a
 * profile by hand wants control points, not a formula; C2 continuity is what
 * keeps the shading and the arm's path clean between them. Coefficients are
 * solved once at module load, so evaluation is a search plus one cubic.
 */
class Profile {
  private readonly xs: number[];
  private readonly ys: number[];
  /** Second derivatives at the knots (the "moments" of the spline). */
  private readonly m: number[];

  constructor(knots: ReadonlyArray<readonly [number, number]>) {
    this.xs = knots.map((k) => k[0]);
    this.ys = knots.map((k) => k[1]);
    const n = this.xs.length;
    this.m = new Array<number>(n).fill(0);
    if (n < 3) return;

    // Thomas algorithm on the tridiagonal system for a natural spline
    // (second derivative zero at both ends).
    const c = new Array<number>(n).fill(0);
    const d = new Array<number>(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      const hL = this.xs[i] - this.xs[i - 1];
      const hR = this.xs[i + 1] - this.xs[i];
      const a = hL;
      const b = 2 * (hL + hR);
      const rhs =
        6 * ((this.ys[i + 1] - this.ys[i]) / hR - (this.ys[i] - this.ys[i - 1]) / hL);
      const denom = b - a * c[i - 1];
      c[i] = hR / denom;
      d[i] = (rhs - a * d[i - 1]) / denom;
    }
    for (let i = n - 2; i >= 1; i--) this.m[i] = d[i] - c[i] * this.m[i + 1];
  }

  at(x: number): number {
    const xs = this.xs;
    const n = xs.length;
    // Clamped outside the knot range: the range is always the full φ domain,
    // so this only ever catches floating-point overshoot at the poles.
    if (x <= xs[0]) return this.ys[0];
    if (x >= xs[n - 1]) return this.ys[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] > x) hi = mid;
      else lo = mid;
    }
    const h = xs[hi] - xs[lo];
    const a = (xs[hi] - x) / h;
    const b = 1 - a;
    return (
      a * this.ys[lo] +
      b * this.ys[hi] +
      (((a * a * a - a) * this.m[lo] + (b * b * b - b) * this.m[hi]) * h * h) / 6
    );
  }
}

/**
 * Half-breadth in millimetres, by height — the width taper, and the one
 * profile that also says how fast a section closes toward the poles.
 *
 * Maximum breadth (76, i.e. the published 152) sits at the parietal eminence
 * about 30 mm above the ear canal, not at the ears: φ = 0.3 is y = 184. Below
 * that the mandible narrows through 55 at mouth level and 47 at the gonial
 * angle (bigonial 94 before the jaw ridge adds its 6). Above, the crown
 * follows an ellipse of semi-axes 76 × 85 about y = 181, which is what a
 * cranium actually does.
 *
 * The two knots either side of each pole set the end slope, and the end slope
 * is the roundness of the cap: half-breadth ≈ s·Δφ gives a meridian radius of
 * s²/116, so s ≈ 89 makes both the crown and the underside of the jaw a 68 mm
 * arc. A plain ellipsoid would give s = 73 at the chin, i.e. a 46 mm arc — the
 * point the brief asks to get rid of.
 */
const HALF_W = new Profile([
  [-HALF_PI, 0],
  [-1.52, 4.5],
  [-1.4, 13],
  [-1.2, 26],
  [-1.0, 37],
  [-0.8, 47],
  [-0.6, 55],
  [-0.4, 63],
  [-0.2, 69],
  [0.0, 73],
  [0.3, 76],
  [0.5, 73],
  [0.75, 63],
  [1.0, 47],
  [1.25, 28],
  [1.4, 16],
  [1.5, 6.4],
  [HALF_PI, 0],
]);

/**
 * Forward shift of the section centre with descent: the world z of the widest
 * point of the head at each height, mm. The face is not a column — the
 * mandible hangs forward of the cranium, so the lower sections slide toward
 * +Z. This is also what puts the lowest point of the head (the submental pole,
 * which is exactly this profile's value at −π/2) over the chin cup at
 * FIXTURE.chinCupZ rather than under the ear canal.
 */
const SIDE = new Profile([
  [-HALF_PI, 38],
  [-1.4, 25],
  [-1.2, 18],
  [-1.0, 14],
  [-0.8, 10],
  [-0.6, 4],
  [-0.4, -4],
  [-0.2, -12],
  [0.0, -20],
  [0.25, -20],
  [0.5, -20],
  [0.75, -22],
  [1.0, -20],
  [1.25, -16],
  [1.45, -9],
  [HALF_PI, -8],
]);

/**
 * World z of the facial midline, by height — the profile you would see in a
 * side photograph with the nose taken off. It is nearly a vertical plane from
 * the glabella (83) down past the mouth to the chin (78), which is what makes
 * the face read flat and frontal; the ellipsoid is only there to close the
 * section round the sides. The nose, lips and chin come from the features.
 */
const FRONT_TARGET: ReadonlyArray<readonly [number, number]> = [
  [-1.4, 47],
  [-1.2, 60],
  [-1.0, 71],
  [-0.8, 78],
  [-0.6, 80],
  [-0.4, 80],
  [-0.2, 81],
  [0.0, 82],
  [0.25, 83],
  [0.5, 82],
  [0.75, 71],
  [1.0, 53],
  [1.25, 32],
  [1.4, 17],
];

/**
 * World z of the back midline. The occiput is the deepest point of the head
 * and stays proud from the ear line up to the parietal; glabella 83 to occiput
 * −109 is 192, and the brow ridge on top of it makes the published 197.
 */
const BACK_TARGET: ReadonlyArray<readonly [number, number]> = [
  [-1.4, 6],
  [-1.2, -20],
  [-1.0, -34],
  [-0.8, -47],
  [-0.6, -60],
  [-0.4, -76],
  [-0.2, -95],
  [0.0, -108],
  [0.25, -109],
  [0.5, -108],
  [0.75, -105],
  [1.0, -88],
  [1.25, -62],
  [1.4, -33],
];

/**
 * How far a section at this height has closed, 1 at the widest. Breadth and
 * depth both scale by it, so they reach zero together: let the depth close
 * linearly while the breadth closes on its own curve and the bottom of the
 * head becomes a transverse knife edge whose normal flips.
 */
function closing(phi: number): number {
  return HALF_W.at(phi) / HEAD.radii.x;
}

/**
 * Turn a table of world-space midline z into the half-depth profile the
 * section actually uses: halfDepth = (target − side) / closing(φ), so the
 * depth closes at the poles at exactly the same rate as the breadth. Get that
 * wrong — let the depth close linearly while the breadth closes as a
 * superellipse — and the bottom of the head becomes a transverse knife edge
 * whose normal flips. The two pole values cannot be solved (closing is 0
 * there); they only set the aspect of the end caps, and are continued off the
 * trend of the knots beside them.
 */
function halfDepthProfile(
  targets: ReadonlyArray<readonly [number, number]>,
  sign: 1 | -1,
  atBottom: number,
  atTop: number,
): Profile {
  const knots: Array<readonly [number, number]> = [[-HALF_PI, atBottom]];
  for (const [phi, z] of targets) knots.push([phi, (sign * (z - SIDE.at(phi))) / closing(phi)]);
  knots.push([HALF_PI, atTop]);
  return new Profile(knots);
}

const FRONT = halfDepthProfile(FRONT_TARGET, 1, 133, 120);
const BACK = halfDepthProfile(BACK_TARGET, -1, 113, 112);

// ------------------------------------------------------- feature landmarks

/**
 * The (θ, φ) of the features other modules have to line up with. buildHead
 * puts the eyeballs, brows, lips and nostrils here, so the meshes land in the
 * hollows and on the ridges this file sculpts instead of near them.
 *
 * φ from a height: φ = asin((y − 150) / 116).
 */
export const LANDMARKS = {
  /** Pupil centre, y = 168, x = ±31.5 (interpupillary 63). */
  eye: { theta: 0.435, phi: 0.155 },
  /** Eyebrow: inner head, arch peak, outer tail. */
  brow: { thetaInner: 0.12, thetaOuter: 0.8, phiInner: 0.29, phiPeak: 0.335, phiOuter: 0.235 },
  /** Pronasale, y = 133. */
  noseTip: { theta: 0, phi: -0.145 },
  /** Nostril centres, either side of the columella under the tip. */
  nostril: { theta: 0.085, phi: -0.245 },
  /** Stomion, y = 91; the lip mesh spans ±0.105 rad of φ about it. */
  mouth: { theta: 0, phi: -0.53, halfPhi: 0.105, halfTheta: 0.4 },
  /** Tragion: ear canal, y = 146, z = −12. θ is solved for in buildHead. */
  ear: { y: HEAD.ear.y, z: HEAD.ear.z },
} as const;

/**
 * Every facial feature, as a Gaussian bump on the radial multiplier. `amp` is
 * millimetres of relief at the centre — positive out, negative in. `sTheta`
 * and `sPhi` are the 1-σ radii; at the face 0.1 rad is about 7.5 mm across and
 * 11.6 mm down. `mirror` adds the same bump at −θ.
 *
 * Amplitudes are kept under (σ × the local surface rate) so no bump can fold
 * the surface back on itself: the steepest here, the nose, runs at about 0.8
 * of the base ∂p/∂φ, which reads as a steep nose and stays single-valued.
 * A radial height field cannot undercut, so the nostrils are a deep dimple
 * rather than a true overhang — at this scale nobody sees the difference.
 */
type Bump = {
  theta: number;
  phi: number;
  sTheta: number;
  sPhi: number;
  amp: number;
  mirror?: boolean;
};

const BUMPS: readonly Bump[] = [
  // --- brow. The supraorbital ridge is a bar over each orbit, joined at the
  // glabella by a lower swell; that break is what separates a brow from a
  // forehead.
  { theta: 0.42, phi: 0.325, sTheta: 0.3, sPhi: 0.115, amp: 6.5, mirror: true },
  { theta: 0, phi: 0.3, sTheta: 0.16, sPhi: 0.11, amp: 3.0 },
  // --- orbits. The eyeball sits in a hollow, not on the skin.
  { theta: 0.435, phi: 0.145, sTheta: 0.24, sPhi: 0.115, amp: -5.5, mirror: true },
  // --- temples, slightly hollow behind the orbital rim.
  { theta: 0.95, phi: 0.42, sTheta: 0.28, sPhi: 0.19, amp: -2.8, mirror: true },
  // --- nose. Dorsum from the nasion down, a bulbous tip, a broad base that
  // carries the alae, and the flare of the nostril wings themselves. The tip
  // is the steepest thing on the head: 14 mm over a 0.15 rad σ runs at about
  // 0.75 of the base ∂p/∂φ, so it is a steep nose and still single-valued.
  { theta: 0, phi: 0.08, sTheta: 0.1, sPhi: 0.17, amp: 7.5 },
  { theta: 0, phi: -0.155, sTheta: 0.15, sPhi: 0.15, amp: 14.0 },
  { theta: 0, phi: -0.2, sTheta: 0.23, sPhi: 0.2, amp: 4.0 },
  { theta: 0.135, phi: -0.235, sTheta: 0.075, sPhi: 0.06, amp: 3.5, mirror: true },
  // --- nostrils: a dimple either side of the columella. A radial height field
  // cannot undercut, so this is a deep dimple standing in for the real recess.
  { theta: 0.08, phi: -0.255, sTheta: 0.055, sPhi: 0.05, amp: -2.2, mirror: true },
  // --- philtrum: the midline groove from subnasale to the lip.
  { theta: 0, phi: -0.4, sTheta: 0.055, sPhi: 0.075, amp: -1.4 },
  // --- lips. Two vermilion rolls with the crease of the mouth between them;
  // the crease is deliberately no sharper than the mesh can resolve, and the
  // 0.22 rad σ puts the corners about 25 mm out, a 50 mm mouth.
  { theta: 0, phi: -0.475, sTheta: 0.215, sPhi: 0.052, amp: 3.2 },
  { theta: 0, phi: -0.598, sTheta: 0.2, sPhi: 0.062, amp: 3.6 },
  { theta: 0, phi: -0.532, sTheta: 0.25, sPhi: 0.033, amp: -2.4 },
  // --- labiomental sulcus: the shadow line under the lower lip that reads as
  // "chin" more than the chin itself does.
  { theta: 0, phi: -0.7, sTheta: 0.26, sPhi: 0.06, amp: -2.0 },
  // --- mental protuberance, at the pogonion, with the two mental tubercles
  // either side that square the chin off.
  { theta: 0, phi: -0.9, sTheta: 0.24, sPhi: 0.145, amp: 5.5 },
  { theta: 0.2, phi: -0.87, sTheta: 0.13, sPhi: 0.12, amp: 2.0, mirror: true },
  // --- cheekbones, and the buccal hollow under them.
  { theta: 0.72, phi: 0.02, sTheta: 0.28, sPhi: 0.17, amp: 3.6, mirror: true },
  { theta: 0.62, phi: -0.29, sTheta: 0.25, sPhi: 0.17, amp: -2.6, mirror: true },
  // --- mandible: the body running back from the chin to the gonial angle.
  // Three overlapping bumps along that line make one ridge, and the ridge is
  // what stops the jaw reading as the bottom of an egg.
  { theta: 0.42, phi: -0.8, sTheta: 0.26, sPhi: 0.12, amp: 3.4, mirror: true },
  { theta: 0.78, phi: -0.73, sTheta: 0.26, sPhi: 0.13, amp: 4.0, mirror: true },
  { theta: 1.1, phi: -0.62, sTheta: 0.28, sPhi: 0.15, amp: 4.5, mirror: true },
  // --- occiput, proud at the upper rear.
  { theta: Math.PI, phi: 0.24, sTheta: 0.6, sPhi: 0.34, amp: 5.0 },
];

/** Expanded once so the per-sample loop never branches on `mirror`. */
const FEATURES: readonly Bump[] = BUMPS.flatMap((b) =>
  b.mirror && b.theta !== 0 ? [b, { ...b, theta: -b.theta }] : [b],
);

/**
 * Fade every feature out within 6° of either pole. At a pole all θ collapse to
 * one point, so a θ-dependent displacement there would pinch the surface — and
 * it would also move the menton off HEAD.chinY. Nothing in FEATURES reaches
 * that far anyway; this only guarantees it.
 */
function poleFade(phi: number): number {
  const d = (HALF_PI - Math.abs(phi)) / 0.105;
  if (d >= 1) return 1;
  if (d <= 0) return 0;
  return d * d * d * (d * (d * 6 - 15) + 10);
}

/**
 * Summed feature relief in millimetres. The θ kernel is exp(−2(1 − cos Δθ)/σ²)
 * rather than a plain Gaussian: it matches exp(−Δθ²/σ²) for small Δθ but is
 * exactly 2π-periodic, so nothing has a seam at the back of the head.
 */
function relief(theta: number, phi: number): number {
  let sum = 0;
  for (let i = 0; i < FEATURES.length; i++) {
    const f = FEATURES[i];
    const dPhi = (phi - f.phi) / f.sPhi;
    if (dPhi > 4 || dPhi < -4) continue;
    const dTheta = (2 * (1 - Math.cos(theta - f.theta))) / (f.sTheta * f.sTheta);
    if (dTheta > 16) continue;
    sum += f.amp * Math.exp(-dPhi * dPhi - dTheta);
  }
  return sum * poleFade(phi);
}

// ---------------------------------------------------------- the surface

/** The base ellipsoid offset from the section centre, before any feature. */
function baseOffset(theta: number, phi: number, out: Vec3): void {
  // How wide this section is as a fraction of the widest one. It closes faster
  // than cos φ over most of the head and slower right at the poles, which is
  // what rounds off the chin and domes the crown.
  const horizontal = closing(phi);
  // Front and back half-depths, blended by which way this θ faces. The blend
  // is smooth and 2π-periodic, so the join at the ears has no crease.
  const cosT = Math.cos(theta);
  const front = (1 + cosT) / 2;
  const depth = BACK.at(phi) + (FRONT.at(phi) - BACK.at(phi)) * front;
  out.x = HEAD.radii.x * horizontal * Math.sin(theta);
  out.y = HEAD.radii.y * Math.sin(phi);
  out.z = depth * horizontal * cosT;
}

const scratchOffset: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * The radial multiplier at (θ, φ): 1 on the bare warped ellipsoid, more where
 * a feature stands proud, less where one is sunk. Multiplying rather than
 * displacing along the normal keeps the surface a single-valued height field
 * about the section centre, which is what lets buildHead offset the hair shell
 * outward and the scan path trust that it is looking at real skin.
 */
export function headField(theta: number, phi: number): number {
  baseOffset(theta, phi, scratchOffset);
  const r = Math.hypot(scratchOffset.x, scratchOffset.y, scratchOffset.z);
  if (r < 1e-6) return 1;
  return 1 + relief(theta, phi) / r;
}

/** The skin point alone, written into `out`. Hot path: no allocation. */
function pointInto(theta: number, phi: number, out: Vec3): void {
  baseOffset(theta, phi, out);
  const r = Math.hypot(out.x, out.y, out.z);
  const m = r < 1e-6 ? 1 : 1 + relief(theta, phi) / r;
  out.x = HEAD.centre.x + m * out.x;
  out.y = HEAD.centre.y + m * out.y;
  out.z = HEAD.centre.z + SIDE.at(phi) + m * out.z;
}

/** Reused by headSurface so a per-frame sweep allocates nothing. */
const pA: Vec3 = { x: 0, y: 0, z: 0 };
const pB: Vec3 = { x: 0, y: 0, z: 0 };
const pC: Vec3 = { x: 0, y: 0, z: 0 };

/** Central-difference step for the tangents: small enough to be exact to ~1e-9
 *  in double precision, large enough that the difference is not noise. */
const H = 1e-4;

/**
 * The skin point and its outward unit normal at (θ, φ).
 *
 * The normal is ∂p/∂θ × ∂p/∂φ by central differences, not the direction from
 * the centre: those two only agree on a sphere, and on a head they differ by
 * up to 25° on the cheek and the jaw — enough to aim the phone at nothing.
 * The cross product in that order is already outward (check it on a sphere:
 * it comes out as the radial direction), so no sign fix is needed; the only
 * special case is a pole, where ∂p/∂θ vanishes and the limit is straight up
 * or straight down.
 */
export function headSurface(theta: number, phi: number): ScanSample {
  const skin: Vec3 = { x: 0, y: 0, z: 0 };
  pointInto(theta, phi, skin);

  // Keep the φ samples inside the domain: past a pole the parameterisation
  // folds onto the far side of the head and the difference would be garbage.
  const phiC = Math.min(HALF_PI - 2 * H, Math.max(-HALF_PI + 2 * H, phi));
  pointInto(theta + H, phiC, pA);
  pointInto(theta - H, phiC, pB);
  const tx = pA.x - pB.x;
  const ty = pA.y - pB.y;
  const tz = pA.z - pB.z;
  pointInto(theta, phiC + H, pA);
  pointInto(theta, phiC - H, pC);
  const ux = pA.x - pC.x;
  const uy = pA.y - pC.y;
  const uz = pA.z - pC.z;

  let nx = ty * uz - tz * uy;
  let ny = tz * ux - tx * uz;
  let nz = tx * uy - ty * ux;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-12) {
    // A pole: the whole θ ring is one point and the tangent degenerates.
    return { skin, normal: { x: 0, y: phi > 0 ? 1 : -1, z: 0 } };
  }
  nx /= len;
  ny /= len;
  nz /= len;
  return { skin, normal: { x: nx, y: ny, z: nz } };
}

/** The skin point only, for callers that do not need a normal. */
export function headPoint(theta: number, phi: number): Vec3 {
  const p: Vec3 = { x: 0, y: 0, z: 0 };
  pointInto(theta, phi, p);
  return p;
}

/**
 * θ of the point on the skin at elevation φ whose z is `z`, on the side given
 * by `sign` (+1 = the head's left). Bisection on a monotone quarter of the
 * section; used to seat the ears on the skull at HEAD.ear.z and by the fixture
 * to find where the pads meet the skull.
 */
export function thetaAtDepth(phi: number, z: number, sign: number): number {
  let lo = 0.02;
  let hi = Math.PI - 0.02;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    pointInto(sign * mid, phi, pB);
    if (pB.z > z) lo = mid;
    else hi = mid;
  }
  return (sign * (lo + hi)) / 2;
}
