import { HEAD, type ScanSample, type Vec3 } from "./contracts";

/** Serpentine raster template and loading fallback. faceTrajectory replaces
 * this oval's depth with measurements from the loaded face before solving. */

/**
 * The tracked oval: semi-axes, and where its centre sits relative to
 * HEAD.centre.
 *
 * HEAD.centre is the origin the sculpt is built around, not the middle of the
 * finished head. Measured, the head actually spans z -304.4 to -90.0, so its
 * true centre is 7 mm behind HEAD.centre, and an oval centred on HEAD.centre
 * rides forward of the face — which is what made the sweep look laterally off
 * the head. The offset below puts the oval on the head the reader can see.
 *
 * The radii clear the sculpt everywhere in the scan region: the head reaches
 * 76 mm to the side, 115.5 mm up and, at the tip of the nose, 107 mm forward
 * of the oval's own centre. Depth is the tight one, so it carries the most
 * clearance.
 */
const TRACK = { x: 80, y: 118, z: 116 } as const;
/** The oval's centre, relative to HEAD.centre. */
const TRACK_OFFSET = { x: 0, y: 0, z: -7 } as const;

/**
 * A point on the oval and its outward normal.
 *
 * theta swings about +Y: 0 faces +Z, positive toward +X, the head's own left.
 * phi is elevation, 0 at HEAD.centre's height. The normal is the ellipsoid's
 * gradient, not the direction from the centre — those agree only on a sphere,
 * and this is not one.
 */
export function trackSurface(theta: number, phi: number): ScanSample {
  const cp = Math.cos(phi);
  const ux = cp * Math.sin(theta);
  const uy = Math.sin(phi);
  const uz = cp * Math.cos(theta);

  const skin: Vec3 = {
    x: HEAD.centre.x + TRACK_OFFSET.x + TRACK.x * ux,
    y: HEAD.centre.y + TRACK_OFFSET.y + TRACK.y * uy,
    z: HEAD.centre.z + TRACK_OFFSET.z + TRACK.z * uz,
  };

  const gx = ux / TRACK.x;
  const gy = uy / TRACK.y;
  const gz = uz / TRACK.z;
  const g = Math.hypot(gx, gy, gz) || 1;

  return { skin, normal: { x: gx / g, y: gy / g, z: gz / g } };
}

/**
 * The pass is a serpentine raster, not a ring around the face, and that is a
 * topological requirement rather than a style choice. A closed loop encircling
 * the face makes the required wrist roll wind through a full turn, and the
 * roll servo only has 320 degrees of travel, so the phone would have to unwind
 * mid-scan. A raster encloses nothing, so the roll goes out and comes back. It
 * is also how you would really sweep a surface.
 *
 * Rows run down the face, alternating direction: forehead, brow, cheekbones,
 * cheeks, jaw. The cycle runs the rows down and then back up the way it came,
 * closing the loop with zero net winding by construction.
 *
 * The envelope stops short of the temples and the underside of the jaw, where
 * the oval's normal points sideways or downward. The camera axis is fixed
 * across the last link, so those aim directions drive the wrist against its
 * stop whatever else the arm does.
 */
const ROWS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.368], // forehead, centre
  [0.3, 0.352], // forehead, left
  [0.46, 0.2], // left brow
  [0.0, 0.18], // across the brow
  [-0.46, 0.2], // right brow
  [-0.48, -0.02], // right cheekbone
  [0.0, -0.03], // across, under the eyes
  [0.48, -0.02], // left cheekbone
  [0.42, -0.23], // left cheek
  [0.0, -0.26], // across, over the lip
  [-0.42, -0.23], // right cheek
  [-0.26, -0.42], // right jaw
  [0.0, -0.47], // chin
  [0.26, -0.42], // left jaw
];

/** Down the rows, then back up without repeating the ends: a closed palindrome. */
const STATIONS: ReadonlyArray<readonly [number, number]> = [
  ...ROWS,
  ...ROWS.slice(1, ROWS.length - 1).reverse(),
];

export const SCAN_STATIONS: ScanSample[] = STATIONS.map(([theta, phi]) =>
  trackSurface(theta, phi),
);

/**
 * How much the motion settles at each station: 0 is constant speed, 1 comes
 * to a full stop. Kept mild — the trajectory is resampled to a constant speed
 * downstream anyway, and a hard stop at every station makes the sweep stutter.
 */
const DWELL = 0.35;

function eased(u: number): number {
  const s = u * u * (3 - 2 * u);
  return u + (s - u) * DWELL;
}

/** Uniform Catmull-Rom through four scalars. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (3 * p1 - p0 - 3 * p2 + p3) * u3)
  );
}

/**
 * The scan at phase t: any real, one loop per unit, so the caller can just
 * keep adding to it. Interpolating the oval's own (theta, phi) rather than
 * world points keeps every sample exactly on the surface, with the analytic
 * normal that comes with it, for free.
 */
export function scanSampleAt(t: number): ScanSample {
  const n = STATIONS.length;
  const phase = (t - Math.floor(t)) * n;
  const i = Math.min(Math.floor(phase), n - 1);
  const u = eased(phase - i);
  const at = (k: number) => STATIONS[(k + n) % n];
  const [a0, b0] = at(i - 1);
  const [a1, b1] = at(i);
  const [a2, b2] = at(i + 1);
  const [a3, b3] = at(i + 2);
  return trackSurface(catmullRom(a0, a1, a2, a3, u), catmullRom(b0, b1, b2, b3, u));
}
