import {
  ClampToEdgeWrapping,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  RGBAFormat,
} from "three";

/**
 * Pre-integrated skin scattering (Penner, "Pre-Integrated Skin Shading",
 * GPU Pro 2 / SIGGRAPH 2011) as a 2-D lookup: for a given incidence angle
 * and surface curvature, how much light a point receives after its
 * neighbourhood has scattered it around, per colour channel.
 *
 * The integral, for a point on a sphere of radius r lit from a direction at
 * angle θ from its normal, sums the Lambert term of every other point on the
 * great circle through it, weighted by the diffusion profile R at the chord
 * distance between them:
 *
 *   D(θ, r) = ∫ max(0, cos(θ + x)) · R(2 r sin(x/2)) dx  /  ∫ R(2 r sin(x/2)) dx
 *
 * R is the d'Eon–Jensen sum of six Gaussians fitted to the three-layer skin
 * model (GPU Gems 3 ch. 14, table 14-1 — variances in mm², RGB weights
 * summing to 1 per channel), so the LUT is in millimetres, the renderer's
 * world unit. Red has the widest profile (σ ≈ 2.7 mm), which is what makes
 * the terminator warm and small features glow red instead of going grey.
 *
 * Axes: u = N·L mapped from [−1, 1] to [0, 1]; v = curvature 1/r from 0 to
 * SSS_LUT_MAX_CURVATURE mm⁻¹ (r = ∞ down to 0.25 mm). The papule dome sits
 * near 0.3–1 mm⁻¹; the skin-line grooves and pore pits are far tighter and
 * clamp to the top row. Row 0 is plain clamped Lambert.
 *
 * Built once in JS at module load (~30 ms): weights are precomputed per
 * curvature row, so the inner loop is a cosine and a multiply-add.
 */

export const SSS_LUT_WIDTH = 128;
export const SSS_LUT_HEIGHT = 64;
/** Top of the v axis, mm⁻¹. */
export const SSS_LUT_MAX_CURVATURE = 4.0;
/** Curvature below this (r > 50 mm) is treated as flat. */
const MIN_CURVATURE = 0.02;
/** The profile is negligible beyond this arc distance, mm (3σ of the widest Gaussian). */
const MAX_ARC_MM = 10;
/** Arc-length step for the integral, mm. Finer than the narrowest Gaussian's σ (0.08 mm). */
const ARC_STEP_MM = 0.008;

/** [variance mm², weight R, weight G, weight B] — GPU Gems 3, table 14-1. */
const GAUSSIANS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.0064, 0.233, 0.455, 0.649],
  [0.0484, 0.1, 0.336, 0.344],
  [0.187, 0.118, 0.198, 0.0],
  [0.567, 0.113, 0.007, 0.007],
  [1.99, 0.358, 0.004, 0.0],
  [7.41, 0.078, 0.0, 0.0],
];

/** Diffusion profile R(d) per channel: sum of normalised 2-D Gaussians. */
function profile(d: number, out: Float64Array) {
  out[0] = out[1] = out[2] = 0;
  const d2 = d * d;
  for (const [v, wr, wg, wb] of GAUSSIANS) {
    const g = Math.exp(-d2 / (2 * v)) / (2 * Math.PI * v);
    out[0] += wr * g;
    out[1] += wg * g;
    out[2] += wb * g;
  }
}

/** The LUT as float RGB, row-major (v rows of u), for anyone who wants to inspect it. */
export function computeSssLut(width = SSS_LUT_WIDTH, height = SSS_LUT_HEIGHT): Float32Array {
  const data = new Float32Array(width * height * 3);
  const rgb = new Float64Array(3);

  for (let j = 0; j < height; j++) {
    const curvature = Math.max((SSS_LUT_MAX_CURVATURE * j) / (height - 1), MIN_CURVATURE);
    const r = 1 / curvature;
    // Integrate over arc length s = r·x, |s| ≤ min(πr, MAX_ARC_MM): beyond
    // that the profile is zero to float precision, and on a large sphere
    // the great circle is far longer than the profile reaches.
    const sMax = Math.min(Math.PI * r, MAX_ARC_MM);
    const n = Math.max(2, Math.ceil(sMax / ARC_STEP_MM));
    const ds = sMax / n;
    // Weights and angles for the half-ring; the ring is symmetric in x.
    const xs = new Float64Array(n + 1);
    const wr = new Float64Array(n + 1);
    const wg = new Float64Array(n + 1);
    const wb = new Float64Array(n + 1);
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (let k = 0; k <= n; k++) {
      const s = k * ds;
      const x = s / r;
      // Chord between the point and its neighbour at angle x on a circle of radius r.
      profile(2 * r * Math.sin(x / 2), rgb);
      // Trapezoid ends and the mirrored half: k = 0 counts once, others twice.
      const m = k === 0 ? 1 : k === n ? 1 : 2;
      xs[k] = x;
      wr[k] = rgb[0] * m;
      wg[k] = rgb[1] * m;
      wb[k] = rgb[2] * m;
      sumR += wr[k];
      sumG += wg[k];
      sumB += wb[k];
    }

    for (let i = 0; i < width; i++) {
      const ndotl = (2 * i) / (width - 1) - 1;
      const theta = Math.acos(Math.min(Math.max(ndotl, -1), 1));
      let accR = 0;
      let accG = 0;
      let accB = 0;
      for (let k = 0; k <= n; k++) {
        // Mirrored halves: cos(θ+x) and cos(θ−x), averaged, since each weight
        // already counts both sides.
        const c = 0.5 * (Math.max(0, Math.cos(theta + xs[k])) + Math.max(0, Math.cos(theta - xs[k])));
        accR += wr[k] * c;
        accG += wg[k] * c;
        accB += wb[k] * c;
      }
      const o = (j * width + i) * 3;
      data[o] = accR / sumR;
      data[o + 1] = accG / sumG;
      data[o + 2] = accB / sumB;
    }
  }
  return data;
}

/**
 * The LUT as a half-float RGBA texture, ready to bind as `uSssLut`. Half float
 * keeps the faint red tail past the terminator (values of a few thousandths)
 * out of 8-bit banding, and linear filtering of 16F textures is core WebGL2.
 */
export function makeSssLut(): DataTexture {
  const width = SSS_LUT_WIDTH;
  const height = SSS_LUT_HEIGHT;
  const rgb = computeSssLut(width, height);
  const data = new Uint16Array(width * height * 4);
  for (let t = 0; t < width * height; t++) {
    data[t * 4] = DataUtils.toHalfFloat(rgb[t * 3]);
    data[t * 4 + 1] = DataUtils.toHalfFloat(rgb[t * 3 + 1]);
    data[t * 4 + 2] = DataUtils.toHalfFloat(rgb[t * 3 + 2]);
    data[t * 4 + 3] = DataUtils.toHalfFloat(1);
  }
  const tex = new DataTexture(data, width, height, RGBAFormat, HalfFloatType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}
