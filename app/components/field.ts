/**
 * The margin field: dots that drift beside the article for the whole page, from
 * the moment it loads. Ported from the AnyHealth lander
 * (anyhealth/website/src/app/field.ts): the same count, parameters, drift,
 * sizes, greys and veil, so it has the same look and feel. There the field is
 * what survives the helix's break-up; here it is simply there from the start.
 *
 * ./MarginField.tsx draws it. The closing scene at the foot of the page takes
 * the same dots over as far as the scroll says (`fieldHandoff.p`), and
 * `fieldHanded` decides per dot which canvas has it, so the handover is
 * invisible: one stops drawing a dot exactly where the other starts.
 */

/** The article measure the dots clear, in CSS px (`max-w-2xl`, as Sections). */
export const MEASURE = 672;

/** How many dots drift in the margins. */
export const FIELD_N = 1751;

/** Seeded PRNG, so every reload lays the field out the same way. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Each dot's parameters, FIELD_N rows of four: side and band position, height,
 * wobble, phase (which also keys its handover). Same distributions as
 * AnyHealth's buildCloud().
 */
export function fieldParams(): Float32Array {
  const rnd = mulberry32(0xa11ce);
  const out = new Float32Array(FIELD_N * 4);
  for (let j = 0; j < FIELD_N; j++) {
    out[j * 4] = (rnd() < 0.5 ? -1 : 1) * Math.pow(rnd(), 0.55);
    out[j * 4 + 1] = rnd();
    out[j * 4 + 2] = 4 + rnd() * 18;
    out[j * 4 + 3] = rnd() * 6.2832;
  }
  return out;
}

/** The uniforms FIELD_GLSL needs for a viewport `vw` CSS px wide: uBand and uVeil, in device px. */
export function fieldUniforms(vw: number, dpr: number): { band: [number, number]; veil: [number, number, number, number] } {
  const half = (MEASURE + 56) / 2;
  const edge = vw / 2 - 30;
  return {
    band: [half * 0.88 * dpr, Math.max(half, edge) * dpr],
    veil: [half * 0.95 * dpr, half * 1.5 * dpr, edge * dpr, dpr],
  };
}

/**
 * Where a field dot is at `time` seconds and how it looks: position in device px
 * (vp is the viewport in device px), opacity, point size and grey. `veil` fades
 * dots out while they pass under the article's measure.
 */
export const FIELD_GLSL = `
void fieldDot(vec4 f, float time, vec2 vp, vec2 band, vec4 veil,
              out vec2 pos, out float a, out float s, out float g) {
  float sp = 0.4 + 0.4 * fract(f.w);
  float rise = 6.0 + 12.0 * fract(f.w * 3.1);
  /* the field runs on a slow clock of its own */
  float ft = time * 0.231;
  /* a slow wide sway carries each one under the text and back out */
  float sway = (70.0 + 150.0 * fract(f.z * 0.61)) * veil.w;
  float fx = vp.x * 0.5 + sign(f.x) * mix(band.x, band.y, abs(f.x))
           + sin(ft * sp * 0.42 + f.w) * sway;
  float span = vp.y + 40.0;
  float fy = f.y * vp.y + cos(ft * sp * 0.73 + f.w) * f.z - ft * rise;
  pos = vec2(fx, mod(fy + 20.0, span) - 20.0);
  a = 0.5 + 0.35 * fract(f.z);
  /* sized in device pixels, so this has to carry the ratio itself */
  s = (1.0 + 2.0 * fract(f.z * 0.37)) * veil.w;
  /* each keeps its own grey, from near black to light */
  g = mix(0.08, 0.55, fract(f.z * 0.83));
}
/* how far a dot has gone over to the closing scene at handoff progress p:
   each leaves at its own point of the scroll, set by its key */
float fieldHanded(float key, float p) {
  float lag = 0.55 * fract(sin(key * 91.7) * 43758.5453);
  return smoothstep(lag, lag + 0.45, p);
}
float fieldVeil(float x, vec2 vp, vec4 veil) {
  float dx = abs(x - vp.x * 0.5);
  return smoothstep(veil.x, veil.y, dx) * (1.0 - smoothstep(veil.z, veil.z + 60.0, dx));
}
`;

/**
 * How far the field has gone over to the closing scene, 0 to 1. The closing
 * scene sets it from the scroll every frame; MarginField leaves out every dot
 * that `fieldHanded` says has left.
 */
export const fieldHandoff = { p: 0 };
