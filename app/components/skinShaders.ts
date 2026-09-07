import { Vector2 } from "three";
import { OPTICS, type LesionState } from "../writing/anyderm/lesion";

/**
 * GLSL for the acne-progression skin patch, kept out of SkinCanvas.tsx so the
 * React/three lifecycle stays readable. Three parts:
 *
 * - SKIN_HEIGHT_CHUNK: the surface height function and its helpers. Included
 *   verbatim by BOTH shaders so the mesh (vertex, meso relief) and the normal
 *   (fragment, meso + micro relief) can never disagree about the surface.
 * - SKIN_VERTEX: displaces the plane by the meso height.
 * - SKIN_FRAGMENT: finite-differences the full height for a per-pixel normal,
 *   builds the two-layer skin colour, lights it with a dermatoscope ring and
 *   hands the result to three's tone-mapping and colour-space chunks.
 *
 * World units are millimetres, the plane lies in XZ and height is +Y, matching
 * OPTICS and the OrbitControls polar convention in SkinCanvas.
 */

// ------------------------------------------------------------ uniforms

export type SkinUniforms = {
  /** Lesion state, straight from lesionAt(day). */
  uDiameter: { value: number };
  uElevation: { value: number };
  uErythema: { value: number };
  uPlug: { value: number };
  uPustule: { value: number };
  uCrust: { value: number };
  uPie: { value: number };
  /** Millimetres per device pixel at the target plane; sets anti-alias widths and the finite-difference step. */
  uMmPerPx: { value: number };
  /** Vignette start and end radii, mm from the origin. */
  uVignette: { value: Vector2 };
};

export function makeSkinUniforms(): SkinUniforms {
  return {
    uDiameter: { value: 0.15 },
    uElevation: { value: 0 },
    uErythema: { value: 0 },
    uPlug: { value: 0 },
    uPustule: { value: 0 },
    uCrust: { value: 0 },
    uPie: { value: 0 },
    uMmPerPx: { value: 0.006 },
    uVignette: { value: new Vector2(OPTICS.vignetteStartMm, OPTICS.vignetteEndMm) },
  };
}

/** Copies a lesion state into the uniforms. Values are already 0–1 drive signals or mm. */
export function applyLesion(u: SkinUniforms, s: LesionState) {
  u.uDiameter.value = s.diameterMm;
  u.uElevation.value = s.elevationMm;
  u.uErythema.value = s.erythema;
  u.uPlug.value = s.plugDensity;
  u.uPustule.value = s.pustuleFrac;
  u.uCrust.value = s.crust;
  u.uPie.value = s.pie;
}

// ------------------------------------------------------------ shared height

/**
 * Surface height in mm at a point on the plane, plus the masks the fragment
 * shader needs for colour. Everything is procedural from hashes so there are
 * no texture fetches and no seams.
 *
 * Skin anatomy, briefly, because the shapes come from it:
 * - Sulci cutis are the primary skin lines: a network of shallow grooves
 *   (20–40 µm deep, 0.3–1 mm cells) that divide the surface into triangular
 *   and rhomboid plateaus. A Voronoi (Worley) edge field at two scales with a
 *   little domain warp gives that polygonal but irregular tiling.
 * - Follicular ostia are the pores: pits 60–120 µm across roughly every
 *   0.5–0.8 mm², some holding a darker keratin plug.
 * - A papule is a swelling that stretches the epidermis over it; stretched
 *   skin loses its line pattern and takes a tighter, shinier surface, so the
 *   sulci amplitude is scaled down by the dome mask.
 * - Rupture (crust > 0.5) collapses the centre, so a crater is cut from the
 *   dome and the crust surface is given a rough, matte grain.
 */
export const SKIN_HEIGHT_CHUNK = /* glsl */ `
uniform float uDiameter;
uniform float uElevation;
uniform float uErythema;
uniform float uPlug;
uniform float uPustule;
uniform float uCrust;
uniform float uPie;
uniform float uMmPerPx;
uniform vec2 uVignette;

#define SK_PI 3.14159265359

// ---- hashing and noise. Hash-based value noise, no textures: the cost is a
// few multiplies per lattice corner and it never tiles.
float sk_hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 sk_hash22(vec2 p) {
  float a = sk_hash21(p);
  return vec2(a, sk_hash21(p + a + 7.13));
}
float sk_vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = sk_hash21(i);
  float b = sk_hash21(i + vec2(1.0, 0.0));
  float c = sk_hash21(i + vec2(0.0, 1.0));
  float d = sk_hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// Two- and three-octave fbm, both normalised to 0..1 with mean 0.5.
float sk_fbm2(vec2 p) {
  return sk_vnoise(p) * 0.6 + sk_vnoise(p * 2.13 + 5.7) * 0.4;
}
float sk_fbm3(vec2 p) {
  return sk_vnoise(p) * 0.5
       + sk_vnoise(p * 2.03 + vec2(5.2, 1.3)) * 0.3
       + sk_vnoise(p * 4.07 + vec2(1.7, 9.2)) * 0.2;
}

// Worley F2 - F1: zero on the borders between cells, growing toward the
// centres. Thresholding it near zero draws the cell walls, which is exactly
// what the sulci are.
float sk_worleyEdge(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 9.0;
  float f2 = 9.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + sk_hash22(i + g) - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return sqrt(f2) - sqrt(f1);
}

// ---- lesion geometry
float sk_lesionRadius() {
  return max(0.5 * uDiameter, 0.05);
}

// 1 at the centre, 0 at the rim. The rim wobbles with angle so the lesion is
// not a perfect disc, and the top flattens as the pustule fills, because a pus
// head sits under a thin flat roof rather than a rounded dome.
float sk_domeProfile(vec2 p, float R) {
  float d = length(p);
  float a = atan(p.y, p.x);
  float Rw = R * (1.0 + 0.06 * sin(3.0 * a + 1.3) + 0.04 * sin(5.0 * a - 0.4));
  float t = clamp(d / Rw, 0.0, 1.0);
  return 1.0 - smoothstep(0.45 * uPustule, 1.0, t);
}

// Meso relief: the dome, its rupture crater and a gentle undulation of the
// skin itself (about 0.05 mm over ~3 mm) so tilting the view reveals real
// surface rather than a flat sheet with a bump on it.
float sk_mesoHeight(vec2 p, float dome, float R) {
  float h = uElevation * dome;
  float crater = smoothstep(0.5, 0.9, uCrust);
  h -= crater * uElevation * 0.5 * (1.0 - smoothstep(0.0, 0.45 * R, length(p)));
  h += 0.05 * (sk_fbm2(p * 0.33 + 3.0) - 0.5) * 2.0;
  return h;
}

// ---- micro relief
// Primary and secondary lines at ~0.42 mm and ~0.19 mm cells, on a warped
// domain so the tiling does not read as a lattice. Returns 0..~1.5. Cheek
// skin under a dermatoscope shows a fine mesh, not plates: cells much over
// half a millimetre with wide grooves read as crackle glaze.
float sk_sulci(vec2 p) {
  vec2 w = p + 0.10 * (vec2(sk_vnoise(p * 1.9 + 4.2), sk_vnoise(p * 1.9 + vec2(8.3, 2.7))) - 0.5);
  float e1 = sk_worleyEdge(w * 2.4 + 2.0);
  float e2 = sk_worleyEdge(w * 5.2 + 17.0);
  // Threshold widths are in cell units: 0.14 of a 0.42 mm cell is a ~60 µm
  // groove; squaring gives it a soft, rounded bottom instead of a V.
  float l1 = 1.0 - smoothstep(0.0, 0.14, e1);
  float l2 = 1.0 - smoothstep(0.0, 0.16, e2);
  l1 *= l1;
  l2 *= l2;
  // Patchy: on a real cheek the network is crisp in some areas and almost
  // gone in others, and it is that unevenness that stops it reading as tile.
  float patchy = 0.4 + 0.6 * sk_fbm2(p * 0.5 + 23.0);
  return (l1 + 0.35 * l2) * patchy;
}

// One jittered pore per 0.6 mm cell (80% occupancy, ~2.2 per mm²), held in
// the middle 70% of its cell so a 60 µm pit can never straddle a cell border;
// that keeps the lookup to a single cell. Returns (distance mm, radius mm, plug 0/1).
vec3 sk_ostium(vec2 p) {
  const float cell = 0.6;
  vec2 i = floor(p / cell);
  vec2 c = (i + 0.15 + 0.7 * sk_hash22(i + 3.7)) * cell;
  float present = step(0.2, sk_hash21(i + 9.1));
  // The lesion has its own ostium at the origin; suppress a random one there.
  present *= smoothstep(0.15, 0.4, length(c));
  float rad = mix(0.03, 0.06, sk_hash21(i + 5.3));
  float plug = step(0.65, sk_hash21(i + 2.2));
  return vec3(length(p - c) + (1.0 - present) * 10.0, rad, plug);
}

// A vellus hair as an arc of a circle: centre c, radius R, angle range a0..a1
// (kept inside -pi..pi so the atan seam is never crossed). Distance to an arc
// is a clamp and a cos/sin, far cheaper than a Bezier. Rounded cross-section,
// tapered ends, ~40 µm wide at the middle.
float sk_hairArc(vec2 p, vec2 c, float R, float a0, float a1) {
  vec2 q = p - c;
  float a = clamp(atan(q.y, q.x), a0, a1);
  float t = (a - a0) / (a1 - a0);
  vec2 s = c + R * vec2(cos(a), sin(a));
  float w = 0.02 * (1.0 - pow(abs(2.0 * t - 1.0), 4.0));
  float x = length(p - s) / max(w, 1e-4);
  return sqrt(max(0.0, 1.0 - x * x));
}
// Six hairs, all placed at least 1.7 mm from the lesion so none crosses the
// dome; the last sits outside the home field and only appears zoomed out.
float sk_hairMask(vec2 p) {
  float h = sk_hairArc(p, vec2(2.6, -0.4), 1.8, 1.0, 1.9);
  h = max(h, sk_hairArc(p, vec2(-3.4, 1.9), 2.0, -1.1, -0.35));
  h = max(h, sk_hairArc(p, vec2(0.6, 3.9), 1.7, -2.4, -1.5));
  h = max(h, sk_hairArc(p, vec2(1.2, -3.8), 2.1, 1.3, 2.0));
  h = max(h, sk_hairArc(p, vec2(-2.0, -2.6), 1.5, -0.3, 0.5));
  h = max(h, sk_hairArc(p, vec2(4.5, 3.0), 2.4, 2.4, 3.1));
  return h;
}

// Pus head: a cap whose radius grows with pustuleFrac, with a noisy soft edge.
float sk_capMask(vec2 p, float d, float R) {
  float capR = R * (0.12 + 0.33 * uPustule);
  float edge = capR * (1.0 + 0.15 * (sk_fbm2(p * 8.0 + 21.0) - 0.5));
  return (1.0 - smoothstep(0.6 * edge, edge, d)) * smoothstep(0.0, 0.1, uPustule);
}

// Scab: crust drives a threshold on a noise field, so it grows outward from
// the centre in patches and recedes the same way, never as a fading disc.
float sk_crustMask(vec2 p, float d, float R) {
  float n = sk_fbm3(p * 6.0 + 7.0);
  float field = 1.3 * uCrust - 0.9 * (d / R) - 0.5 * n;
  return smoothstep(0.0, 0.2, field);
}

struct SkinSurf {
  float d;       // distance from the lesion centre, mm
  float R;       // lesion radius, mm
  float dome;    // dome profile 0..1
  float tight;   // how stretched the skin is over the swelling, 0..1
  float sulci;   // line network strength after stretching, 0..~1.4
  float pit;     // peripheral pore pit mask 0..1
  float pitPlug; // 1 if that pore carries a keratin plug
  float ostium;  // central ostium mask 0..1
  float hair;    // vellus hair mask 0..1
  float cap;     // pustule cap mask 0..1
  float crust;   // crust mask 0..1
};

// Full height, meso + micro. The fragment shader finite-differences this for
// its normal; the vertex shader only needs sk_mesoHeight because the mesh is
// too coarse (~60 µm) to carry the micro terms anyway.
float sk_heightAt(vec2 p, out SkinSurf s) {
  float R = sk_lesionRadius();
  float d = length(p);
  float dome = sk_domeProfile(p, R);
  // Only a raised lesion tightens the surface; a flat mark keeps its lines.
  float tight = dome * smoothstep(0.02, 0.25, uElevation);
  float h = sk_mesoHeight(p, dome, R);

  // Below ~20 µm per pixel the fine grain is sub-pixel and only shimmers, so
  // it fades out with distance rather than aliasing.
  float micro = 1.0 - smoothstep(0.02, 0.05, uMmPerPx);

  float cap = sk_capMask(p, d, R);
  float crust = sk_crustMask(p, d, R);

  // (a) sulci cutis, flattened over the swelling and buried under the cap and the scab
  float sul = sk_sulci(p) * (1.0 - 0.9 * tight) * (1.0 - cap) * (1.0 - crust);
  h -= 0.02 * sul;

  // (b) follicular ostia, also stretched flat over the dome
  vec3 o = sk_ostium(p);
  float pit = 1.0 - smoothstep(0.0, o.y, o.x);
  pit = pit * pit * (1.0 - tight);
  h -= 0.025 * pit;

  // central ostium: ~150 µm at rest, widening as the plug packs it
  float oR = 0.06 + 0.08 * uPlug;
  float ost = 1.0 - smoothstep(0.0, oR, d);
  h -= 0.03 * ost * ost;

  // (c) pebbled micro-texture between the lines, ~80 µm grain, a few µm tall
  h += 0.004 * (sk_fbm3(p * 12.0) - 0.5) * 2.0 * (1.0 - 0.6 * tight) * (1.0 - 0.8 * cap) * micro;

  // (d) hairs lie on the surface and never cross the dome
  float hair = sk_hairMask(p) * (1.0 - dome);
  h += 0.015 * hair;

  // (e) crust is rough: dried serum and blood, not a smooth membrane
  h += crust * 0.015 * (sk_fbm3(p * 30.0) - 0.5) * 2.0 * micro;

  s.d = d;
  s.R = R;
  s.dome = dome;
  s.tight = tight;
  s.sulci = sul;
  s.pit = pit;
  s.pitPlug = o.z;
  s.ostium = 1.0 - smoothstep(0.5 * oR, oR, d);
  s.hair = hair;
  s.cap = cap;
  s.crust = crust;
  return h;
}
`;

// ------------------------------------------------------------ vertex

export const SKIN_VERTEX = /* glsl */ `
${SKIN_HEIGHT_CHUNK}

varying vec3 vWorld;

void main() {
  // The geometry is a plane already rotated into XZ, so position.xz is the
  // patch coordinate and +Y is up. Only the meso relief moves vertices.
  vec2 p = position.xz;
  float R = sk_lesionRadius();
  float dome = sk_domeProfile(p, R);
  vec3 wp = (modelMatrix * vec4(p.x, sk_mesoHeight(p, dome, R), p.y, 1.0)).xyz;
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

// ------------------------------------------------------------ fragment

/**
 * Colour is a two-layer absorption model rather than a painted albedo: a
 * melanin term (Fitzpatrick III–IV, absorbing blue > green > red, so more
 * melanin means a deeper tan rather than a darker grey) and a haemoglobin term
 * (absorbing green most, so more blood means redder, slightly darker skin).
 * Erythema is simply local haemoglobin. It peaks in a ring at the dome edge
 * because that is where the dilated vessels of the inflamed dermis sit around
 * the follicle, then tails off outward with a general flush over the dome.
 *
 * Lighting is a dermatoscope: a ring of white LEDs around the lens. The ring
 * rides the camera (it is built from viewMatrix, not world coordinates) so
 * the illumination always comes from around the optical axis, as it does in
 * the instrument, and its geometry scales with camera distance so zooming in
 * behaves as a crop rather than moving the lamp. Skin is translucent, so the
 * diffuse term is wrap-lit with a per-channel wrap that lets red travel
 * furthest; a plain Lambert terminator looks like clay.
 */
export const SKIN_FRAGMENT = /* glsl */ `
${SKIN_HEIGHT_CHUNK}

varying vec3 vWorld;

// Ring geometry as fractions of the camera-to-target distance: the LEDs sit
// 55% of the way to the skin at a radius of 40%, an incidence of ~36° from
// the axis. One side is 20% brighter so the dome reads as raised without a
// separate key light the instrument does not have.
#define RING_LIGHTS 8
#define RING_Z 0.55
#define RING_R 0.40
#define RING_GAIN 0.17
#define RING_BRIGHT_SIDE 0.6
#define SKIN_F0 0.028

float sk_sq(float x) { return x * x; }

void main() {
  vec2 p = vWorld.xz;

  // ---- normal from the shared height function. Forward differences at a
  // step of ~15 µm (widening a little with distance so the step never drops
  // below a pixel). The x/z slopes are packed unnormalised, so the normal is
  // (-dh, e, -dh) rather than (-dh/e, 1, -dh/e): same direction, one fewer divide.
  SkinSurf s;
  SkinSurf sx;
  SkinSurf sz;
  float h0 = sk_heightAt(p, s);
  float e = clamp(uMmPerPx * 0.7, 0.012, 0.03);
  float hx = sk_heightAt(p + vec2(e, 0.0), sx);
  float hz = sk_heightAt(p + vec2(0.0, e), sz);
  vec3 N = normalize(vec3(-(hx - h0), e, -(hz - h0)));

  // ---- albedo, layer 1: melanin
  float mel = sk_fbm2(p * 0.8 + 13.0);      // ~1 mm mottling
  float melFine = sk_vnoise(p * 6.0 + 31.0); // ~170 µm grain
  vec3 albedo = vec3(0.50, 0.33, 0.235) * (0.9 + 0.2 * mel);
  albedo *= pow(vec3(0.93, 0.85, 0.78), vec3((mel - 0.5) * 2.0 + (melFine - 0.5) * 0.8));

  // ---- albedo, layer 2: haemoglobin
  float ring = exp(-sk_sq((s.d - s.R) / (0.5 * s.R + 0.12)));
  float tail = 0.45 * (1.0 - smoothstep(s.R, s.R + 2.4 * s.R, s.d));
  float flush = 0.7 * (1.0 - smoothstep(0.0, 1.1 * s.R, s.d));
  float ery = uErythema * max(ring, max(tail, flush));
  // The post-inflammatory mark: flat, blotchy, less saturated, with a touch
  // of extra melanin, which is what a fading acne mark is.
  float pieMask = uPie * (1.0 - smoothstep(0.55 * s.R, 1.15 * s.R, s.d)) * (0.75 + 0.5 * sk_fbm2(p * 3.0 + 41.0));
  float hb = 0.18 + 0.15 * (sk_fbm2(p * 1.3 + 57.0) - 0.5) + 1.2 * ery + 0.6 * pieMask;
  albedo *= pow(vec3(0.99, 0.60, 0.66), vec3(hb));
  albedo *= pow(vec3(0.93, 0.85, 0.78), vec3(0.6 * pieMask));

  // ---- surface features. Grooves and pits are darker (occlusion plus a
  // longer path through the stratum corneum); plugged pores go brown.
  albedo *= 1.0 - 0.06 * clamp(s.sulci, 0.0, 1.0);
  albedo *= 1.0 - 0.35 * s.pit;
  albedo = mix(albedo, vec3(0.20, 0.12, 0.08), 0.7 * s.pit * s.pitPlug);

  float plugMask = clamp(1.2 * uPlug * s.ostium, 0.0, 1.0);
  albedo = mix(albedo, vec3(0.10, 0.06, 0.035), plugMask);

  // Pus is yellow-white under a thin roof, so the red beneath still tints it.
  albedo = mix(albedo, vec3(0.86, 0.76, 0.46), 0.9 * s.cap);

  vec3 crustCol = mix(vec3(0.22, 0.05, 0.03), vec3(0.06, 0.02, 0.015), sk_fbm3(p * 9.0 + 3.0));
  albedo = mix(albedo, crustCol, s.crust);

  // Vellus hair is nearly unpigmented and translucent: a pale tint at half
  // strength, so the skin still shows through it.
  albedo = mix(albedo, vec3(0.66, 0.54, 0.42), 0.5 * s.hair);

  // ---- roughness. Cheek skin with some sebum sits around 0.42; grooves are
  // matte, stretched skin and the pus head are glossy, crust is the roughest
  // thing in frame.
  float rough = 0.42;
  rough = mix(rough, 0.55, clamp(s.sulci, 0.0, 1.0));
  rough = mix(rough, 0.30, s.tight);
  rough = mix(rough, 0.30, s.cap);
  rough = mix(rough, 0.80, s.crust);
  rough = mix(rough, 0.35, s.hair);
  rough = mix(rough, 0.50, plugMask);
  rough += 0.08 * (sk_vnoise(p * 4.0 + 77.0) - 0.5);
  rough = clamp(rough, 0.15, 0.9);
  float a2 = sk_sq(rough * rough);

  // ---- camera frame from viewMatrix. Its rotation is orthonormal, so the
  // rows of the 3x3 are the camera's world-space right, up and back vectors;
  // GLSL is column-major, hence the transposed indexing.
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 camBack = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  // The orbit target is always the origin (panning is disabled), so camera
  // distance is just the length of cameraPosition.
  float camDist = length(cameraPosition);
  vec3 ringCentre = cameraPosition - camBack * (RING_Z * camDist);
  float ringR = RING_R * camDist;
  // Normalising each light by its distance to the target keeps exposure
  // constant under zoom: a real dermatoscope's LEDs never move.
  float refDist2 = sk_sq(camDist) * (sk_sq(RING_Z) + sk_sq(RING_R));

  vec3 V = normalize(cameraPosition - vWorld);
  float NdotV = max(dot(N, V), 1e-3);
  // Per-channel wrap: haemoglobin lets red scatter furthest, so the
  // terminator warms instead of going grey.
  vec3 wrap = vec3(0.5, 0.25, 0.12);

  vec3 col = vec3(0.0);
  for (int i = 0; i < RING_LIGHTS; i++) {
    float ang = float(i) * (2.0 * SK_PI / float(RING_LIGHTS));
    vec3 lp = ringCentre + (camRight * cos(ang) + camUp * sin(ang)) * ringR;
    vec3 Ld = lp - vWorld;
    float dist2 = dot(Ld, Ld);
    vec3 L = Ld * inversesqrt(dist2);
    float I = RING_GAIN * (1.0 + 0.2 * cos(ang - RING_BRIGHT_SIDE)) * (refDist2 / dist2);

    float NdotL = dot(N, L);
    vec3 diff = clamp((vec3(NdotL) + wrap) / (1.0 + wrap), 0.0, 1.0);

    // GGX / Smith-correlated / Schlick, F0 0.028: the specular of wet-ish
    // skin, which is where the dermoscopic glare comes from.
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);
    float nl = max(NdotL, 0.0);
    float D = a2 / (SK_PI * sk_sq(sk_sq(NdotH) * (a2 - 1.0) + 1.0));
    float Vis = 0.5 / (nl * sqrt(NdotV * NdotV * (1.0 - a2) + a2) + NdotV * sqrt(nl * nl * (1.0 - a2) + a2) + 1e-4);
    float F = SKIN_F0 + (1.0 - SKIN_F0) * pow(1.0 - VdotH, 5.0);
    float spec = D * Vis * F * nl;

    col += I * (albedo * diff + vec3(spec));
  }

  // Hemisphere ambient: light that has already bounced around inside the
  // skin is warm, and the little that comes from around the field is dimmer.
  vec3 amb = mix(vec3(0.30, 0.10, 0.07), vec3(0.55, 0.50, 0.45), 0.5 + 0.5 * N.y) * 0.22;
  col += albedo * amb;
  // The pus head is a small pool of fluid under a thin roof: it glows a little.
  col += s.cap * vec3(0.35, 0.30, 0.18) * 0.12;

  // Instrument field edge, in world mm so it stays put while the camera
  // moves; it also hides the far boundary of the 20 mm patch.
  float vig = 1.0 - smoothstep(uVignette.x, uVignette.y, length(p));
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
