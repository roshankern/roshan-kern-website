import { Vector2, type Texture } from "three";
import type { BakedSkin, SkinUniforms } from "./contracts";
import { OPTICS, PATCH_MM } from "./lesion";
import { LESION_GLSL, makeLesionUniforms } from "./lesionGlsl";
import { SSS_LUT_MAX_CURVATURE, makeSssLut } from "./sssLut";

/**
 * The per-frame skin material of the fable acne-progression figure.
 *
 * The static skin (undulation, line network, pores, pigment, vessels) is baked
 * by skinBake.ts; hairs are geometry with their own shadow map; this shader
 * only evaluates the lesion and the lighting. Its output is LINEAR radiance:
 * the composer's OutputPass does ACES and sRGB, so there is no tone-mapping or
 * colour-space chunk here.
 *
 * Every colour below is written as the sRGB triple from the colour table in
 * ./reference-notes.md and converted to
 * linear once at module load by `srgb()` / `ratio()`, so a value can be
 * traced back to the photograph it was sampled from.
 *
 * World units are millimetres, the plane is XZ, height is +Y, the lesion is
 * at the origin. Baked textures are sampled at uv = p / uPatchMm + 0.5.
 */

// ------------------------------------------------------------ colour helpers

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
const f4 = (x: number) => x.toFixed(4);
type Rgb = readonly [number, number, number];
/** A colour-table sRGB triple as a linear GLSL vec3 literal. */
function srgb(c: Rgb): string {
  return `vec3(${f4(lin(c[0]))}, ${f4(lin(c[1]))}, ${f4(lin(c[2]))})`;
}
/** Per-channel linear factor that turns `from` into `to`; applied as a ground tint under the texture. */
function ratio(to: Rgb, from: Rgb): string {
  return `vec3(${f4(lin(to[0]) / lin(from[0]))}, ${f4(lin(to[1]) / lin(from[1]))}, ${f4(lin(to[2]) / lin(from[2]))})`;
}

// Reference colours (sRGB), by table row.
const BASE: Rgb = [205, 168, 135];
const PEAK_HALO: Rgb = [195, 125, 125];
const PAPULE_ANNULUS: Rgb = [198, 120, 112];
const PIE_DAY17: Rgb = [175, 125, 128];
const PIH: Rgb = [170, 135, 115];
const COMEDO_DOME: Rgb = [211, 172, 129]; // base +6R +4G −6B
const VESSEL: Rgb = [213, 163, 135]; // base +8R −5G
const PORE_INTERIOR: Rgb = [185, 150, 124];
const PORE_PALE: Rgb = [196, 165, 128];
const FOLLICULAR_DOT: Rgb = [145, 32, 36];
const HEAD_IVORY: Rgb = [228, 215, 195];
const PUS_FRESH: Rgb = [215, 190, 140];
const PUS_AGED: Rgb = [189, 147, 105];
const HEAD_DARK_RING: Rgb = [175, 105, 105];
const HAEMORRHAGE_SPECK: Rgb = [190, 95, 95];
const CRUST_SERUM: Rgb = [185, 144, 107];
const CRUST_HAEM: Rgb = [98, 18, 27];
const CRUST_DRY: Rgb = [150, 85, 70];
const CRUST_STREAK: Rgb = [112, 39, 30];
const CRUST_FIBRIN: Rgb = [215, 190, 150];
const CRUST_PINK_RIM: Rgb = [214, 148, 150];
const FLAKE: Rgb = [240, 225, 210];
const PERIPHERY_WHITE: Rgb = [252, 235, 215];

// ------------------------------------------------------------ uniforms

export function makeSkinUniforms(baked: BakedSkin, hairShadow: Texture): SkinUniforms {
  return {
    ...makeLesionUniforms(),
    uRelief: { value: baked.relief },
    uAlbedo: { value: baked.albedo },
    uMasks: { value: baked.masks },
    uHairShadow: { value: hairShadow },
    uSssLut: { value: makeSssLut() },
    uMmPerPx: { value: 0.005 },
    uPatchMm: { value: PATCH_MM },
    uVignette: { value: new Vector2(OPTICS.vignetteStartMm, OPTICS.vignetteEndMm) },
  };
}

// ------------------------------------------------------------ vertex

export const SKIN_VERTEX = /* glsl */ `
${LESION_GLSL}

uniform sampler2D uRelief;
uniform float uPatchMm;

varying vec3 vWorld;
varying vec2 vP;

void main() {
  // The plane is already rotated into XZ, so position.xz is the patch
  // coordinate. Height is the baked relief plus the lesion dome; lod 0
  // because a vertex shader has no derivatives to pick a mip from.
  vec2 p = position.xz;
  vec2 uv = p / uPatchMm + 0.5;
  float h = textureLod(uRelief, uv, 0.0).r + ls_height(p, ls_radius());
  vec4 wp = modelMatrix * vec4(p.x, h, p.y, 1.0);
  vWorld = wp.xyz;
  vP = p;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// ------------------------------------------------------------ fragment

export const SKIN_FRAGMENT = /* glsl */ `
${LESION_GLSL}

uniform sampler2D uRelief;      // R height mm, G dh/dx, B dh/dz, A cavity AO (1 = open)
uniform sampler2D uAlbedo;      // RGB linear base albedo, A roughness
uniform sampler2D uMasks;       // R sulci, G pore pit, B pore tint, A haemoglobin excess
uniform sampler2D uHairShadow;  // 1 = open; < 1 only along the contact line under a shaft
uniform sampler2D uSssLut;      // u = N·L 0..1, v = curvature 0..SK_LUT_MAX_CURV
uniform float uMmPerPx;
uniform float uPatchMm;
uniform vec2 uVignette;

varying vec3 vWorld;
varying vec2 vP;

#define SK_PI 3.14159265359
#define SK_LUT_MAX_CURV ${f4(SSS_LUT_MAX_CURVATURE)}

// Ring geometry as fractions of the camera-to-target distance: the LEDs sit
// 55 % of the way to the skin at a radius of 45 %, an incidence of ~39° from
// the axis. Riding the camera keeps the glare arcs where a phone dermatoscope
// puts them and makes zoom a crop rather than a lamp move. One side is 20 %
// brighter so the dome reads as raised.
#define SK_RING_LIGHTS 8
#define SK_RING_Z 0.55
#define SK_RING_R 0.45
#define SK_RING_GAIN 0.11
// Three's ACES flattens chroma by ~15–20 %; this restores the table colours
// after tone mapping (fitted: base → (202,171,133), halo → (199,119,117)).
#define SK_CHROMA 1.2
#define SK_RING_BRIGHT_SIDE 0.6
#define SK_F0 0.028
// Small sphere lights, not points: the specular lobe is widened by this.
// (Karis: α += r/(2d); a 1 mm LED at ~6 mm is 0.08.)
#define SK_SPHERE_ROUGH 0.08

// ---- hashing and noise (only the lesion needs it; the skin is baked)
float sk_hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float sk_vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sk_hash21(i), sk_hash21(i + vec2(1.0, 0.0)), f.x),
             mix(sk_hash21(i + vec2(0.0, 1.0)), sk_hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float sk_fbm2(vec2 p) {
  return sk_vnoise(p) * 0.6 + sk_vnoise(p * 2.13 + 5.7) * 0.4;
}
float sk_fbm3(vec2 p) {
  return sk_vnoise(p) * 0.5
       + sk_vnoise(p * 2.03 + vec2(5.2, 1.3)) * 0.3
       + sk_vnoise(p * 4.07 + vec2(1.7, 9.2)) * 0.2;
}
float sk_sq(float x) { return x * x; }
vec2 sk_rot(vec2 p, float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)) * p; }
// Rounded flake field: two rotated value-noise octaves so thresholded islands
// are blobs, not the axis-aligned squares one octave of value noise gives.
float sk_flakeNoise(vec2 p) {
  return 0.6 * sk_vnoise(sk_rot(p, 0.6) * 14.0 + 9.0) + 0.4 * sk_vnoise(sk_rot(p, -0.9) * 22.0 + 4.0);
}

// Anti-alias width: never narrower than 1.5 device pixels, whatever the zoom.
float sk_aa(float widthMm) { return max(widthMm, 1.5 * uMmPerPx); }

// ---- lesion features that both the colour and the normal need

// Pustule head: a blister 0.5–1.0 mm across sitting slightly off-centre on the
// dome (notes stage 3). Fixed offset direction so it never drifts with the day.
vec2 sk_capCentre(float R) { return 0.15 * R * vec2(cos(0.9), sin(0.9)); }
float sk_capRadius(float R) { return R * (0.10 + 0.22 * uPustule); }
// Blister height profile, 0..1: rounded, steepening to the rim.
float sk_capProfile(vec2 p, float R) {
  vec2 q = p - sk_capCentre(R);
  float t = length(q) / max(sk_capRadius(R), 1e-3);
  return (1.0 - smoothstep(0.35, 1.0, t)) * smoothstep(0.1, 0.35, uPustule);
}

// Crust: a threshold on a noise field so it grows outward in lobes with
// 100–200 µm protrusions (fbm at 6/mm → 170, 83, 42 µm octaves) and recedes
// the same way, never as a fading disc (notes stage 4).
float sk_crustField(vec2 p, float R) {
  float n = sk_fbm3(p * 6.0 + 7.0);
  return 1.15 * uCrust - length(p) / R - 0.5 * n;
}

// Lesion height beyond what the mesh carries: the dome (shared with the
// vertex shader), the blister of the pus head, the raised grainy crust and
// the resting pore's pit at the apex. Finite-differenced for the normal.
float sk_lesionHeight(vec2 p, float R, float inflamed) {
  float h = ls_height(p, R);
  h += 0.06 * uPustule * sk_capProfile(p, R);
  if (uCrust > 0.001) {
    float field = sk_crustField(p, R);
    // Steep 35 µm ramp: the lip. Relief on top: 150 µm lumps (20 µm), 45 µm
    // granules (8 µm) and a fine 25 µm grain (6 µm) — dried serum and blood,
    // not a smooth membrane.
    float crust = smoothstep(-0.06, 0.06, field);
    float lumps = sk_fbm2(p * 6.7 + 9.0) - 0.5;
    float granules = sk_vnoise(p * 22.0 + 1.0) - 0.5;
    float grain = sk_fbm2(p * 40.0 + 3.0) - 0.5;
    h += crust * (0.03 + 0.02 * lumps + 0.008 * granules + 0.006 * grain);
  }
  // Follicular pit at rest, 150 µm across, 25 µm deep; the inflamed dot replaces it.
  float pit = 1.0 - smoothstep(0.0, 0.075, length(p));
  h -= 0.025 * pit * pit * (1.0 - inflamed);
  return h;
}

// GGX / Smith-correlated visibility, one lobe.
float sk_ggx(float NdotH, float NdotV, float NdotL, float a2) {
  float D = a2 / (SK_PI * sk_sq(sk_sq(NdotH) * (a2 - 1.0) + 1.0));
  float Vis = 0.5 / (NdotL * sqrt(NdotV * NdotV * (1.0 - a2) + a2)
                   + NdotV * sqrt(NdotL * NdotL * (1.0 - a2) + a2) + 1e-4);
  return D * Vis;
}

void main() {
  vec2 p = vP;
  vec2 uv = p / uPatchMm + 0.5;
  float d = length(p);

  // ---- baked skin
  vec4 relief = texture(uRelief, uv);
  vec4 alb = texture(uAlbedo, uv);
  vec4 masks = texture(uMasks, uv);
  float hairShadow = texture(uHairShadow, uv).r;
  float sulci = masks.r;
  float pit = masks.g;
  float poreTint = masks.b;
  float hbBake = masks.a;

  // ---- lesion geometry
  float R = ls_radius();
  float dome = ls_dome(p, R);
  float tight = ls_tight(dome);
  float crater = ls_crater(p, R);
  float inflamed = smoothstep(0.3, 0.5, uErythema);

  // ---- camera frame from viewMatrix: its rotation is orthonormal, so the
  // rows of the 3×3 are the camera's world right, up and back vectors (GLSL
  // is column-major, hence the transposed indexing). Needed early: the pus
  // head's one compact highlight is placed toward the brightest LED.
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 camBack = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec3 brightDir = camRight * cos(SK_RING_BRIGHT_SIDE) + camUp * sin(SK_RING_BRIGHT_SIDE);

  // ---- normal. Baked slopes, flattened over the stretched dome, plus the
  // analytic lesion slopes by finite difference at ±e (it is only the dome,
  // the head and the crust: cheap). The step widens with distance so it never
  // drops below a pixel. A macro normal from the dome alone feeds the
  // scattering and transmission terms, which see through the fine relief.
  float e = clamp(uMmPerPx * 0.7, 0.01, 0.03);
  float h0 = sk_lesionHeight(p, R, inflamed);
  float hx = sk_lesionHeight(p + vec2(e, 0.0), R, inflamed);
  float hz = sk_lesionHeight(p + vec2(0.0, e), R, inflamed);
  vec2 lesionSlope = vec2(hx - h0, hz - h0) / e;
  float dm0 = ls_height(p, R);
  vec2 domeSlope = vec2(ls_height(p + vec2(e, 0.0), R) - dm0, ls_height(p + vec2(0.0, e), R) - dm0) / e;

  // Pustule head and crust bury the skin relief underneath them.
  float cap = 0.0;
  float capRing = 0.0;
  float capCore = 0.0;
  float capSpeck = 0.0;
  float capShade = 1.0;
  float capGlint = 0.0;
  {
    // Stage 3: a 0.5–1.0 mm blister with a crisp 40–60 µm edge, a subtle
    // darker ring ~100 µm wide just outside it (the cue that makes the head
    // read as raised), shading that falls off toward the rim so it is a dome
    // and not a disc, and ONE compact highlight near the apex on the side of
    // the brightest LED (notes stage 3 specular; img 13/19).
    vec2 q = p - sk_capCentre(R);
    float a = atan(q.y, q.x);
    float capR0 = sk_capRadius(R);
    float capR = capR0 * (1.0 + 0.05 * sin(3.0 * a + 0.7));
    float qd = length(q);
    float w = sk_aa(0.025);
    // The head forms during days 9–10 (uPustule 0.2 → 0.8 peaks at day 11).
    float on = smoothstep(0.1, 0.35, uPustule);
    cap = (1.0 - smoothstep(capR - w, capR + w, qd)) * on;
    capRing = smoothstep(capR - w, capR + 0.02, qd) * (1.0 - smoothstep(capR + 0.06, capR + 0.13, qd)) * on;
    capShade = 1.0 - 0.28 * smoothstep(0.25, 1.0, qd / max(capR, 1e-3));
    // Off-centre, soft-edged yellow core seen through the roof; an irregular
    // haemorrhagic smudge at one edge of it.
    vec2 coreC = 0.22 * capR * vec2(cos(2.4), sin(2.4));
    capCore = 1.0 - smoothstep(0.2 * capR, 0.85 * capR, length(q - coreC));
    vec2 speckC = coreC + 0.6 * capR * vec2(cos(-0.6), sin(-0.6));
    float sd = length(q - speckC) + 0.03 * (sk_vnoise(p * 60.0 + 3.0) - 0.5);
    capSpeck = (1.0 - smoothstep(0.02, 0.08, sd)) * smoothstep(0.5, 0.8, uPustule);
    vec2 gdir = length(brightDir.xz) > 1e-3 ? normalize(brightDir.xz) : vec2(1.0, 0.0);
    vec2 gq = q - 0.3 * capR0 * gdir;
    float gw = sk_aa(0.035);
    capGlint = exp(-dot(gq, gq) / (gw * gw)) * cap;
  }

  float crust = 0.0;
  float crustLip = 0.0;
  float crustField = -1.0;
  float sparkle = 0.0;
  vec2 sparkleTilt = vec2(0.0);
  if (uCrust > 0.001) {
    crustField = sk_crustField(p, R);
    // Field slope is ~3.5 per mm, so a 10 µm edge (the sharpest thing in the
    // animation, notes stage 4) is 0.035 in field units, held at ≥ 1.5 px.
    float w = sk_aa(0.01) * 3.5;
    crust = smoothstep(-w, w, crustField);
    // 2–3 px dark line where the lip shadows the skin just outside the edge.
    float lipW = max(0.015, 3.0 * uMmPerPx) * 3.5;
    crustLip = smoothstep(-w - lipW, -w, crustField) * (1.0 - crust);
    // Wet-phase micro-glints: 20–60 µm facets of a wet irregular surface, each
    // tilted its own way so some of them catch an LED (notes stage 4, img 17).
    vec2 sp = p / 0.04 + 5.0;
    sparkle = smoothstep(0.78, 0.9, sk_vnoise(sp)) * uWetness * crust;
    sparkleTilt = 0.35 * (vec2(sk_hash21(floor(sp)), sk_hash21(floor(sp) + 7.0)) - 0.5);
  }

  vec2 slope = relief.gb * (1.0 - 0.85 * tight) * (1.0 - 0.9 * cap) * (1.0 - crust) + lesionSlope + sparkle * sparkleTilt;

  // Micro-grain: below ~3 µm/px the bake is magnified past its texels, so a
  // very subtle 30 µm slope noise keeps the surface from looking blurred.
  float microGrain = 1.0 - smoothstep(0.003, 0.005, uMmPerPx);
  if (microGrain > 0.0) {
    float g0 = sk_vnoise(p / 0.03 + 11.0);
    float gx = sk_vnoise((p + vec2(e, 0.0)) / 0.03 + 11.0);
    float gz = sk_vnoise((p + vec2(0.0, e)) / 0.03 + 11.0);
    slope += microGrain * 0.0015 * vec2(gx - g0, gz - g0) / e * (1.0 - cap);
  }

  vec3 N = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 Nm = normalize(vec3(-domeSlope.x, 1.0, -domeSlope.y));

  // ---- masks for the lesion's colour
  // Stage 2–3 erythema: reddest in an annulus 0.5–0.8 R from the centre, a
  // broad flush inside, a tail fading over a further 1–1.5 mm; the apex is
  // stretched thin and a little less red. Edge width ≥ 0.7 mm and no outline
  // (notes (e) #1). Blotchy at 150–300 µm through the baked haemoglobin mask
  // and a noise following the pseudonetwork.
  // The halo's radius wanders with a 0.7 mm noise so it is never a disc.
  float dE = d * (1.0 + 0.22 * (sk_fbm2(p * 1.4 + 33.0) - 0.5));
  float ringE = exp(-sk_sq((dE - 0.65 * R) / (0.35 * R + 0.15)));
  float flush = 0.85 * (1.0 - smoothstep(0.0, 1.05 * R, dE));
  float tail = 0.55 * (1.0 - smoothstep(0.6 * R, R + 1.3, dE));
  float eryShape = max(ringE, max(flush, tail));
  eryShape *= 1.0 - 0.15 * (1.0 - uPustule) * (1.0 - smoothstep(0.0, 0.35 * R, d));
  // Only the mottle part of the baked haemoglobin (≤ 0.3) modulates the halo;
  // vessels (0.4–0.8) must not be re-drawn in red by the erythema.
  float blotch = (0.75 + 0.5 * min(hbBake, 0.3) / 0.3) * (0.65 + 0.7 * sk_fbm2(p * 4.0 + 19.0));
  float hb = uErythema * eryShape * blotch;
  // Plugs and filaments own their pore's colour: little blood shows through.
  hb *= 1.0 - 0.8 * poreTint;

  // Stage 5: the flat mark. An irregular oval a little larger than the papule
  // was, feathered over 0.3–0.5 mm, red-violet (notes (e) #9). uPih both
  // browns its edge and stands in for the fade: by day 21 the contrast is
  // half of day 17.
  float markR = 1.25 * R + 0.35;
  vec2 pm = vec2(p.x * 0.88, p.y * 1.12);
  float am = atan(pm.y, pm.x);
  float markRw = markR * (1.0 + 0.10 * sin(2.0 * am + 0.8) + 0.06 * sin(5.0 * am - 1.9));
  float dmk = length(pm);
  float markMask = 1.0 - smoothstep(markRw - 0.4, markRw + 0.1, dmk);
  markMask *= 0.85 + 0.3 * sk_fbm2(p * 3.0 + 41.0);
  float pihFade = smoothstep(0.1, 0.4, uPih);
  float pieK = 1.0 * uPie * (1.0 - 0.6 * pihFade) * markMask;
  float pihK = 0.6 * uPih * smoothstep(0.55 * markR, 0.95 * markR, dmk) * markMask;
  // Slightly paler centre where the crust was (early atrophy): +5–8 luma.
  float markCentre = uPie * (1.0 - smoothstep(0.0, 0.45 * markR, dmk));

  // Vessels: dilated telangiectasia in the halo, +8 R −5 G, already blurred
  // in the bake. Only around the lesion — distant vessels stay as baked.
  float vesselMask = smoothstep(0.35, 0.7, hbBake);
  float vess = 0.3 * uVessels * vesselMask * (1.0 - smoothstep(R, R + 1.5, d));

  // Stage 1: the closed comedo. Skin-coloured +6R +4G −6B with a faint yellow
  // core 0.3 mm wide; skin lines run uninterrupted over it.
  float comedo = smoothstep(0.05, 0.4, uPlug) * (1.0 - inflamed) * dome;
  float comedoCore = 1.0 - smoothstep(0.08, 0.18, d);

  // Stage 0: the target pore's interior goes paler and yellower with the plug.
  float apexPit = (1.0 - smoothstep(0.045, 0.075 + sk_aa(0.0), d)) * (1.0 - inflamed) * (1.0 - comedo);

  // Stage 2+: sharp dark-red dot 60–120 µm at the apex once inflamed (the
  // crusted follicular opening), enlarging a little, hidden under the head.
  float dotR = 0.035 + 0.02 * uErythema;
  float dotW = sk_aa(0.008);
  float dotMask = (1.0 - smoothstep(dotR - dotW, dotR + dotW, d)) * inflamed * (1.0 - cap) * (1.0 - 0.6 * uPie);

  // Stage 4 scale: fine white flakes 50–200 µm at 10–20 % coverage in a
  // 0.2–0.4 mm ring outside the crust margin, plus a crescent at the shoulder
  // of the closed comedo (notes stage 1, img 01a). Opaque and rough.
  float flake = 0.0;
  {
    float n = sk_flakeNoise(p);
    float fw = max(0.025, 1.5 * uMmPerPx * 10.0);
    float flakes = smoothstep(0.78 - fw, 0.78 + fw, n);
    float crustEdge = max(R * (1.15 * uCrust - 0.25), 0.15);
    float ringS = smoothstep(crustEdge - 0.05, crustEdge + 0.1, d) * (1.0 - smoothstep(crustEdge + 0.3, crustEdge + 0.45, d));
    float shoulder = smoothstep(0.55 * R, 0.8 * R, d) * (1.0 - smoothstep(0.9 * R, 1.05 * R, d));
    float crescent = shoulder * smoothstep(0.9, 0.2, abs(atan(p.y, p.x) - 2.0)) * comedo;
    // Flaking is densest while the crust is lifting; once it has gone only stragglers remain.
    float scaleDrive = uScale * (0.2 + 0.8 * smoothstep(0.1, 0.5, uCrust));
    flake = flakes * clamp(scaleDrive * ringS + 0.6 * crescent, 0.0, 1.0) * (1.0 - crust) * (1.0 - cap);
  }

  // ---- albedo, ground layer first. Erythema is haemoglobin absorption in
  // the dermis (green most, then blue): it tints under the texture, so it is
  // applied before every surface overlay (notes (e) #2).
  vec3 albedo = alb.rgb;
  // Baked vessels are blurred but drawn at full chroma; under a non-polarised
  // ring light they are ≤ 8 % contrast, so pull them toward the base hue at
  // their own luminance before anything else.
  {
    float l = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
    vec3 baseHue = ${srgb(BASE)} / dot(${srgb(BASE)}, vec3(0.2126, 0.7152, 0.0722));
    albedo = mix(albedo, l * baseHue, 0.5 * vesselMask);
  }
  // Per-unit absorption is the peak-halo/base ratio raised to 1.5: the frame
  // is viewed through ACES, which desaturates reds, and this exponent is what
  // lands the tone-mapped flush on (195,125,125) and the annulus near
  // (198,120,112) at the hb the day-11 keyframe reaches.
  albedo *= pow(${ratio(PEAK_HALO, BASE)} * vec3(1.0, 0.95, 0.85), vec3(1.2 * hb));
  albedo *= pow(${ratio(PIE_DAY17, BASE)}, vec3(pieK));
  albedo *= pow(${ratio(PIH, BASE)}, vec3(pihK));
  albedo *= 1.0 + 0.06 * markCentre;
  albedo *= pow(${ratio(VESSEL, BASE)}, vec3(vess));
  albedo *= mix(vec3(1.0), ${ratio(COMEDO_DOME, BASE)}, comedo);
  albedo = mix(albedo, ${srgb(PUS_FRESH)}, 0.25 * comedo * comedoCore);

  // ---- surface overlays, each keeping its own colour on top of the ground
  vec3 poreCol = mix(${srgb(PORE_INTERIOR)}, ${srgb(PORE_PALE)}, smoothstep(0.15, 0.7, uPlug));
  albedo = mix(albedo, poreCol, 0.8 * apexPit);
  albedo = mix(albedo, ${srgb(FOLLICULAR_DOT)}, dotMask);

  // Pustule head: ivory rim, off-centre yellow-ochre core that deepens as the
  // pustule ages past its peak (crust rising is the cue), a haemorrhagic
  // speck, and the dark ring outside. The head is the least saturated thing
  // in frame, so it sits on top of the erythema, not tinted by it.
  float age = smoothstep(0.0, 0.5, uCrust);
  vec3 pusCol = mix(${srgb(PUS_FRESH)}, ${srgb(PUS_AGED)}, age);
  // Ivory from the table, held down 15 %: the roof is thin skin over pus, and
  // the reference head is only +15 luma over base, not white.
  vec3 headCol = mix(0.85 * ${srgb(HEAD_IVORY)}, pusCol, 0.7 * capCore);
  headCol = mix(headCol, ${srgb(HAEMORRHAGE_SPECK)}, 0.6 * capSpeck);
  headCol *= capShade;
  albedo *= 1.0 - 0.12 * capRing;
  albedo = mix(albedo, headCol, cap);

  // Crust: two-toned, maroon-black haemorrhagic regions beside ochre serum,
  // darker streaks, a few paler fibrin islands; wet is darker and more
  // saturated, dry averages toward the matte mid-brown body.
  if (uCrust > 0.001) {
    // Maroon/ochre split at 100–200 µm with soft transitions; the maroon is
    // a little desaturated (dried blood is not a pure pigment), the ochre is
    // granular, and both darken toward the crust's own boundary.
    float tone = smoothstep(0.38, 0.62, sk_fbm3(p * 9.0 + 11.0));
    vec3 haemCol = mix(${srgb(CRUST_HAEM)}, ${srgb(CRUST_DRY)}, 0.3);
    vec3 serumCol = ${srgb(CRUST_SERUM)} * (0.85 + 0.3 * sk_vnoise(p * 30.0 + 2.0));
    vec3 crustCol = mix(haemCol, serumCol, tone);
    vec2 ps = sk_rot(p, 0.5);
    float streak = smoothstep(0.64, 0.74, sk_fbm2(vec2(ps.x * 9.0, ps.y * 3.0) + 23.0));
    crustCol = mix(crustCol, ${srgb(CRUST_STREAK)}, 0.45 * streak);
    float fibrin = smoothstep(0.74, 0.80, sk_fbm2(sk_rot(p, -0.4) * 8.0 + 3.0));
    crustCol = mix(crustCol, ${srgb(CRUST_FIBRIN)}, 0.75 * fibrin);
    crustCol = mix(crustCol, ${srgb(CRUST_DRY)}, 0.45 * (1.0 - uWetness));
    crustCol *= 1.0 - 0.15 * uWetness;
    // Body 15 % darker than the table samples (which were lit by flash), and
    // darker still within ~80 µm of the boundary, where the lobes shadow each other.
    crustCol *= 0.85 * (1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.3, crustField)));
    albedo = mix(albedo, crustCol, crust);
    // The pink rim just outside the crust is brighter than the day-11 halo.
    float rim = (1.0 - smoothstep(0.0, 0.25, -crustField)) * (1.0 - crust) * smoothstep(0.3, 0.8, uCrust);
    albedo *= mix(vec3(1.0), ${ratio(CRUST_PINK_RIM, PEAK_HALO)}, 0.5 * rim);
  }

  // Flakes are thin: translucent, not paint.
  albedo = mix(albedo, ${srgb(FLAKE)}, 0.4 * flake);

  // Grooves and the crust lip darken after everything: they are occlusion,
  // not pigment. Ridges keep their colour and glint (notes §c skin-line
  // network). Kept faint — 5–8 % on resting skin — and fainter under the
  // erythema, where the network must be barely visible through the red field
  // (notes (e) #1); the bake's cavity AO is applied once, below, not here.
  float hbK = clamp(hb, 0.0, 1.0);
  albedo *= 1.0 - 0.02 * sulci * (1.0 - tight) * (1.0 - crust) * (1.0 - 0.6 * hbK);
  albedo *= 1.0 - 0.6 * crustLip;

  // ---- roughness. Base from the bake; sebum tightens the dome to ~0.22, the
  // pus head is glass-smooth, dry crust matte, wet crust glossy with glints,
  // flakes rough, the healed centre a touch shinier.
  float rough = alb.a;
  rough = mix(rough, 0.26, tight * clamp((uSebum - 0.25) / 0.45, 0.0, 1.0));
  // The head's soft sheen; its one compact dot is painted (capGlint), not a lobe.
  rough = mix(rough, 0.2, cap);
  rough = mix(rough, mix(0.55, 0.18, uWetness), crust);
  rough = mix(rough, 0.08, sparkle);
  rough = mix(rough, 0.70, flake);
  rough = mix(rough, 0.32, 0.5 * markCentre);
  rough = clamp(rough, 0.05, 0.95);
  float roughSpec = min(rough + SK_SPHERE_ROUGH, 1.0);
  float a2Broad = sk_sq(sk_sq(roughSpec));
  float a2Tight = sk_sq(sk_sq(roughSpec * 0.45));
  // The tight lobe draws ridge dashes on the baked relief; on the smooth dome
  // it would resolve the eight LEDs as eight dots, so it yields to the broad lobe there.
  float tightW = 0.25 * (1.0 - 0.85 * tight) * (1.0 - cap);
  float broadW = 1.0 - tightW;

  // ---- scattering curvature for the LUT. The dome is a paraboloid of height
  // E over radius R (curvature 2E/R² at the apex, ~0.3–1 mm⁻¹); flat cheek is
  // ~0; the skin-line grooves and pits are tight and clamp to the top row.
  float domeCurv = 2.0 * uElevation / max(R * R, 1e-3) * smoothstep(0.0, 0.5, dome);
  float curv = 0.05 + domeCurv;
  curv = mix(curv, SK_LUT_MAX_CURV, 0.35 * max(sulci, pit) * (1.0 - tight));
  // The blister is ~0.5 mm in radius: its rim scatters red like a fingertip.
  curv = mix(curv, 2.0, cap);
  float lutV = clamp(curv / SK_LUT_MAX_CURV, 0.0, 1.0);
  // Red scatters through the fine relief: its N·L uses a normal halfway to the macro one.
  vec3 Nred = normalize(mix(N, Nm, 0.5));

  // Dome-rim transmission (notes (e) #2, the single most important cue): at
  // the shoulder, where light entering the far slope travels furthest through
  // the swollen, blood-rich dermis, haemoglobin-tinted light comes out from
  // beneath. Rim mask peaks where the dome is half height.
  float rim = smoothstep(0.05, 0.6, 4.0 * dome * (1.0 - dome));
  float transK = 0.3 * uErythema * smoothstep(0.05, 0.35, uElevation) * rim * (1.0 - cap) * (1.0 - crust) * (1.0 - 0.8 * poreTint);
  vec3 transCol = vec3(0.9, 0.15, 0.12);

  // ---- lights: the LED ring built from the camera frame so it rides the camera.
  // The orbit target is the origin (no pan), so camera distance is |cameraPosition|.
  float camDist = length(cameraPosition);
  vec3 ringCentre = cameraPosition - camBack * (SK_RING_Z * camDist);
  float ringR = SK_RING_R * camDist;
  // Normalising each light by its distance to the target keeps exposure
  // constant under zoom: the instrument's LEDs never move.
  float refDist2 = sk_sq(camDist) * (sk_sq(SK_RING_Z) + sk_sq(SK_RING_R));

  vec3 V = normalize(cameraPosition - vWorld);
  float NdotV = max(dot(N, V), 1e-3);

  vec3 diffuse = vec3(0.0);
  vec3 spec = vec3(0.0);
  vec3 trans = vec3(0.0);
  for (int i = 0; i < SK_RING_LIGHTS; i++) {
    float ang = float(i) * (2.0 * SK_PI / float(SK_RING_LIGHTS));
    vec3 lp = ringCentre + (camRight * cos(ang) + camUp * sin(ang)) * ringR;
    vec3 Ld = lp - vWorld;
    float dist2 = dot(Ld, Ld);
    vec3 L = Ld * inversesqrt(dist2);
    float I = SK_RING_GAIN * (1.0 + 0.2 * cos(ang - SK_RING_BRIGHT_SIDE)) * (refDist2 / dist2);

    // Pre-integrated scattering: the LUT replaces N·L, with red read through
    // the blurred normal so grooves glow instead of going grey.
    float NdotL = dot(N, L);
    vec3 sss = texture(uSssLut, vec2(NdotL * 0.5 + 0.5, lutV)).rgb;
    sss.r = texture(uSssLut, vec2(dot(Nred, L) * 0.5 + 0.5, lutV)).r;
    diffuse += I * sss;

    // Light entering the dome from the far side of the ring.
    float back = 1.0 - clamp(dot(Nm, L), 0.0, 1.0);
    trans += I * back * back;

    // Dual-lobe GGX, F0 0.028, broad 0.75 + tight 0.25 (the tight lobe on the
    // baked plateau slopes is what draws the short bright dashes along ridges).
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);
    float nl = max(NdotL, 0.0);
    float F = SK_F0 + (1.0 - SK_F0) * pow(1.0 - VdotH, 5.0);
    float lobes = broadW * sk_ggx(NdotH, NdotV, nl, a2Broad) + tightW * sk_ggx(NdotH, NdotV, nl, a2Tight);
    spec += vec3(I * F * lobes * nl);
  }

  // Ring-light geometry (notes (d)): the field is 15–25 % brighter toward the
  // periphery than at the centre and drifts toward warm white in the corners.
  // With the LEDs riding the camera the geometric gradient alone is flat, so
  // this is an explicit radial gain in world mm, fixed to the instrument.
  // Capped at +15 % (edge of the 4.5 mm field ≈ +9 %, its corners ≈ +13 %).
  float periph = smoothstep(1.2, 3.0, d);
  vec3 periphTint = normalize(${srgb(PERIPHERY_WHITE)}) / normalize(${srgb(BASE)});
  periphTint = mix(vec3(1.0), periphTint / max(periphTint.r, 1e-3), 0.2);
  vec3 gain = mix(vec3(1.0), 1.15 * periphTint, periph);
  diffuse *= gain;
  spec *= gain;
  trans *= gain;

  // A little light has already bounced around under the skin: warm, dim.
  vec3 ambient = 0.05 * vec3(1.0, 0.85, 0.75);

  vec3 col = albedo * (diffuse + ambient);
  // Cavity occlusion (applied once, here) and the hair contact line darken
  // the diffuse only. A ring light casts almost no shadow, so the AO is a
  // gentle 18 %, and less under the erythema so the network does not tile it.
  col *= 1.0 - 0.18 * (1.0 - relief.a) * (1.0 - 0.6 * hbK) * (1.0 - crust) * (1.0 - cap);
  col *= mix(0.9, 1.0, hairShadow);
  col += transK * transCol * trans;
  // The pus is a small pool under a thin roof: it glows a little.
  col += cap * pusCol * 0.02;
  col += spec;
  // The head's compact highlight: bright, but not a blown disc.
  col += capGlint * 0.45;

  // ACES chroma compensation (see SK_CHROMA), on the lit colour so the
  // highlights, which are near-neutral, stay neutral.
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  // The head is near-neutral ivory; boosting its chroma turns it grey-cyan.
  col = max(lum + (col - lum) * mix(SK_CHROMA, 1.0, cap), 0.0);

  // Instrument field edge, in world mm so it stays put while the camera moves.
  col *= 1.0 - smoothstep(uVignette.x, uVignette.y, d);

  gl_FragColor = vec4(col, 1.0);
}
`;
