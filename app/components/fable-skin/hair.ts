import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  FrontSide,
  LinearFilter,
  Mesh,
  NormalBlending,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  OrthographicCamera,
  SRGBColorSpace,
  UnsignedByteType,
  WebGLRenderTarget,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from "three";
import type { HairSystem } from "./contracts";
import { PATCH_MM } from "./lesion";
import { LESION_GLSL, makeLesionUniforms } from "./lesionGlsl";
import type { Pore, PoreField } from "./pores";

/**
 * Vellus hairs for the fable skin: one tapered tube per follicle that carries
 * a hair, grown once on the CPU as a single merged geometry and shaded with
 * Kajiya-Kay plus two shifted lobes and a backlight translucency term. The
 * appearance targets are reference-notes.md §c "Vellus hairs" and §d: a
 * translucent tan shaft 30–60 µm wide, one bright edge line from the ring
 * light, no cast shadow beyond a faint contact line, and a soft, widened look
 * wherever a shaft lifts off the skin, because the dermatoscope's depth of
 * field is only 0.3–0.5 mm.
 *
 * Geometry convention: every vertex stores its CENTRELINE point in `position`
 * — x, z along the curve and y = the hair's lift above the local skin — and
 * the tube offset separately (`normal` is the unit offset direction, `aRadius`
 * the true shaft radius). The vertex shader lifts the centreline by the baked
 * skin height under it plus the lesion dome, then expands the tube. Doing the
 * expansion in the shader is what lets the defocus fake widen the tube.
 *
 * Edge anti-aliasing does not rely on the hexagon: the fragment shader
 * computes the exact screen-perpendicular distance from the shaft axis and
 * fades over the last fraction of a pixel of the analytic circle. The hexagon
 * is scaled by 1/cos(30°) so its silhouette always lies outside that circle.
 */

const HALF_MM = PATCH_MM / 2;
/** Tube sides. The analytic coverage in the fragment shader hides the polygon. */
const SIDES = 6;
/** Circumscribed-hexagon factor: the polygon must contain the true circle. */
const HEX_SCALE = 1 / Math.cos(Math.PI / SIDES);
/** Shadow map size over the 20 mm patch: 19.5 µm per texel, ~2 texels across a shaft. */
const SHADOW_SIZE = 1024;
/**
 * Buried prefix of the shaft. The visible shaft breaks the surface exactly at
 * the ostium edge on the hairAngle side, at full width; behind that point two
 * rings plunge back toward the pit centre, 40 µm and 80 µm behind it and 50
 * and 100 µm deep, so nothing of the shaft shows inside the pit and the pore
 * reads as a dark dot with the hair as a tangent from its rim (img 09, 01b).
 */
const ROOT_BURY_STEP_MM = 0.04;
const ROOT_BURY_SLOPE = 1.25;
const ROOT_BURY_RINGS = 2;

const DEG = Math.PI / 180;

// ----------------------------------------------------------------- randoms

/** Mulberry32, the same generator pores.ts uses. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linear sRGB triple from 0–255 sRGB, for the colour uniforms. */
function linearColor(r: number, g: number, b: number): Color {
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
}

// ----------------------------------------------------------------- one hair

type HairShape = {
  /** Centreline samples, equal arc-length spacing: x, lift, z per ring. */
  centre: Float32Array;
  /** Unit 3D tangent per ring. */
  tangent: Float32Array;
  /** True shaft radius per ring, mm. */
  radius: Float32Array;
  rings: number;
  seed: number;
};

const v2 = (x: number, z: number) => ({ x, z });
const rot = (d: { x: number; z: number }, a: number) => ({
  x: d.x * Math.cos(a) - d.z * Math.sin(a),
  z: d.x * Math.sin(a) + d.z * Math.cos(a),
});

/** Cubic Hermite on [0,1] with end values and end slopes (slopes already scaled to the interval). */
function hermite(t: number, p0: number, m0: number, p1: number, m1: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0 +
    (t3 - 2 * t2 + t) * m0 +
    (-2 * t3 + 3 * t2) * p1 +
    (t3 - t2) * m1
  );
}

/**
 * Grows one hair out of a pore: a cubic Bézier in plan (gentle bend, some
 * S-curves), a height profile that leaves the pit at 20–45°, peaks a little
 * above the skin and settles back onto it, and a width that tapers to a point.
 */
function growHair(pore: Pore, rand: () => number, hairSeed: number): HairShape {
  // --- length: log-uniform 1.0–3.0 mm, mean ≈ 1.8.
  const length = Math.exp(Math.log(1.0) + (Math.log(3.0) - Math.log(1.0)) * rand());
  // --- plan curve.
  const a0 = pore.hairAngle + (rand() - 0.5) * 20 * DEG;
  const d0 = v2(Math.cos(a0), Math.sin(a0));
  const bendSign = rand() < 0.5 ? -1 : 1;
  const bend = bendSign * (10 + 30 * rand()) * DEG;
  const sCurve = rand() < 0.25;
  // Surface crossing: the ostium edge on the hairAngle side.
  const p0 = v2(pore.x + pore.radius * d0.x, pore.z + pore.radius * d0.z);
  const chord = length * (0.9 + 0.05 * rand());
  let p1: { x: number; z: number };
  let p2: { x: number; z: number };
  let p3: { x: number; z: number };
  if (!sCurve) {
    const dEnd = rot(d0, bend);
    const dMid = rot(d0, 0.5 * bend);
    p1 = v2(p0.x + d0.x * length * 0.35, p0.z + d0.z * length * 0.35);
    p3 = v2(p0.x + dMid.x * chord, p0.z + dMid.z * chord);
    p2 = v2(p3.x - dEnd.x * length * 0.35, p3.z - dEnd.z * length * 0.35);
  } else {
    // Bends one way, then back the other: the end tangent opposes the start bend.
    const dEnd = rot(d0, -0.8 * bend);
    const perp = rot(d0, Math.PI / 2);
    const bulge = Math.sin(bend) * 0.25 * length;
    p1 = v2(p0.x + d0.x * length * 0.4 + perp.x * bulge, p0.z + d0.z * length * 0.4 + perp.z * bulge);
    p3 = v2(p0.x + d0.x * chord, p0.z + d0.z * chord);
    p2 = v2(p3.x - dEnd.x * length * 0.35, p3.z - dEnd.z * length * 0.35);
  }
  const bez = (t: number) => {
    const u = 1 - t;
    const b0 = u * u * u;
    const b1 = 3 * u * u * t;
    const b2 = 3 * u * t * t;
    const b3 = t * t * t;
    return v2(
      b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
      b0 * p0.z + b1 * p1.z + b2 * p2.z + b3 * p3.z,
    );
  };
  // Arc-length table so the rings are evenly spaced along the shaft.
  const FINE = 160;
  const fine: { x: number; z: number }[] = [];
  const cum = new Float32Array(FINE + 1);
  for (let i = 0; i <= FINE; i++) {
    const p = bez(i / FINE);
    fine.push(p);
    cum[i] = i === 0 ? 0 : cum[i - 1] + Math.hypot(p.x - fine[i - 1].x, p.z - fine[i - 1].z);
  }
  const arc = cum[FINE];
  const at = (s: number) => {
    const target = Math.min(Math.max(s, 0), arc);
    let i = 0;
    while (i < FINE - 1 && cum[i + 1] < target) i++;
    const span = cum[i + 1] - cum[i] || 1;
    const k = (target - cum[i]) / span;
    return v2(fine[i].x + (fine[i + 1].x - fine[i].x) * k, fine[i].z + (fine[i + 1].z - fine[i].z) * k);
  };

  // --- height profile in arc length s.
  const lifted = rand() < 0.2;
  const exitAngle = (20 + 25 * rand()) * DEG;
  let m0 = Math.tan(exitAngle); // mm of lift per mm of shaft at the root
  const hPeak = 0.05 + 0.3 * rand() * rand() + (lifted ? 0.08 : 0);
  const hTip = lifted ? 0.1 + 0.25 * rand() : 0.005 + 0.045 * rand();
  // Peak position: where a curve with this exit slope would level off. Capped
  // so it stays in the first two thirds; the exit slope is then reduced to keep
  // the Hermite segment monotone (normalised slope ≤ 3).
  let sPeak = Math.min(Math.max((2.2 * hPeak) / m0, 0.12), 0.65 * arc);
  if (m0 * sPeak > 2.6 * hPeak) m0 = (2.2 * hPeak) / sPeak;
  const mTip = lifted ? (rand() - 0.5) * 0.2 : 0;
  const lift = (s: number) => {
    // Buried prefix: straight back into the pit, steeper than the exit.
    if (s < 0) return ROOT_BURY_SLOPE * s;
    if (s <= sPeak) {
      const t = s / sPeak;
      return hermite(t, 0, m0 * sPeak, hPeak, 0);
    }
    const span = arc - sPeak;
    const t = (s - sPeak) / span;
    return hermite(t, hPeak, 0, hTip, mTip * span);
  };

  // --- width: 30–60 µm across at the root, tapering to a point. No ramp at
  // the root: the shaft leaves the pit at its full width.
  const w0 = 0.03 + 0.03 * rand();
  const width = (t: number) => w0 * Math.pow(Math.max(1 - t, 0), 0.6);

  // --- sample rings: the buried prefix, then equal arc-length steps.
  const visibleRings = Math.round(14 + (6 * (length - 1)) / 2) + 1;
  const rings = visibleRings + ROOT_BURY_RINGS;
  const buried = ROOT_BURY_RINGS * ROOT_BURY_STEP_MM;
  const centre = new Float32Array(rings * 3);
  const tangent = new Float32Array(rings * 3);
  const radius = new Float32Array(rings);
  const eps = arc * 1e-3;
  // Plan position for any s, including the straight buried prefix (s < 0).
  const plan = (s: number) => (s < 0 ? v2(p0.x + d0.x * s, p0.z + d0.z * s) : at(s));
  for (let i = 0; i < rings; i++) {
    const s =
      i < ROOT_BURY_RINGS ? -(ROOT_BURY_RINGS - i) * ROOT_BURY_STEP_MM : ((i - ROOT_BURY_RINGS) / (visibleRings - 1)) * arc;
    const t = (s + buried) / (arc + buried);
    const p = plan(s);
    const y = lift(s);
    centre[i * 3] = p.x;
    centre[i * 3 + 1] = y;
    centre[i * 3 + 2] = p.z;
    const pa = plan(Math.max(s - eps, -buried));
    const pb = plan(Math.min(s + eps, arc));
    const ya = lift(Math.max(s - eps, -buried));
    const yb = lift(Math.min(s + eps, arc));
    const tx = pb.x - pa.x;
    const ty = yb - ya;
    const tz = pb.z - pa.z;
    const len = Math.hypot(tx, ty, tz) || 1;
    tangent[i * 3] = tx / len;
    tangent[i * 3 + 1] = ty / len;
    tangent[i * 3 + 2] = tz / len;
    radius[i] = 0.5 * width(t);
  }
  return { centre, tangent, radius, rings, seed: hairSeed };
}

// ----------------------------------------------------------------- geometry

function buildGeometry(hairs: HairShape[]): BufferGeometry {
  let vertCount = 0;
  let indexCount = 0;
  for (const h of hairs) {
    vertCount += h.rings * SIDES;
    indexCount += (h.rings - 1) * SIDES * 6;
  }
  const position = new Float32Array(vertCount * 3);
  const normal = new Float32Array(vertCount * 3);
  const aTangent = new Float32Array(vertCount * 3);
  const aT = new Float32Array(vertCount);
  const aLift = new Float32Array(vertCount);
  const aRadius = new Float32Array(vertCount);
  const aSeed = new Float32Array(vertCount);
  const index = new Uint32Array(indexCount);

  const up = new Vector3(0, 1, 0);
  const T = new Vector3();
  const side = new Vector3();
  const n2 = new Vector3();
  let v = 0;
  let ix = 0;
  for (const h of hairs) {
    const base = v;
    // A per-hair twist of the ring so hexagon vertices do not all line up.
    const phi0 = h.seed * Math.PI * 2;
    for (let i = 0; i < h.rings; i++) {
      T.set(h.tangent[i * 3], h.tangent[i * 3 + 1], h.tangent[i * 3 + 2]);
      // Frame: `side` is horizontal and perpendicular to the shaft, `n2` completes it.
      side.crossVectors(up, T);
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
      side.normalize();
      n2.crossVectors(T, side).normalize();
      const t = i / (h.rings - 1);
      for (let j = 0; j < SIDES; j++) {
        const phi = phi0 + (j / SIDES) * Math.PI * 2;
        const c = Math.cos(phi);
        const s = Math.sin(phi);
        position[v * 3] = h.centre[i * 3];
        position[v * 3 + 1] = h.centre[i * 3 + 1];
        position[v * 3 + 2] = h.centre[i * 3 + 2];
        normal[v * 3] = c * side.x + s * n2.x;
        normal[v * 3 + 1] = c * side.y + s * n2.y;
        normal[v * 3 + 2] = c * side.z + s * n2.z;
        aTangent[v * 3] = T.x;
        aTangent[v * 3 + 1] = T.y;
        aTangent[v * 3 + 2] = T.z;
        aT[v] = t;
        aLift[v] = h.centre[i * 3 + 1];
        aRadius[v] = h.radius[i];
        aSeed[v] = h.seed;
        v++;
      }
    }
    // Outward-facing winding (either way renders identically: the shading is
    // analytic in the shaft cross-section, so back faces match front faces).
    for (let i = 0; i < h.rings - 1; i++) {
      for (let j = 0; j < SIDES; j++) {
        const jn = (j + 1) % SIDES;
        const a = base + i * SIDES + j;
        const b = base + i * SIDES + jn;
        const c = base + (i + 1) * SIDES + j;
        const d = base + (i + 1) * SIDES + jn;
        index[ix++] = a;
        index[ix++] = b;
        index[ix++] = d;
        index[ix++] = a;
        index[ix++] = d;
        index[ix++] = c;
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("normal", new BufferAttribute(normal, 3));
  geometry.setAttribute("aTangent", new BufferAttribute(aTangent, 3));
  geometry.setAttribute("aT", new BufferAttribute(aT, 1));
  geometry.setAttribute("aLift", new BufferAttribute(aLift, 1));
  geometry.setAttribute("aRadius", new BufferAttribute(aRadius, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(aSeed, 1));
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

// ----------------------------------------------------------------- shaders

/** Shared by both vertex shaders: the defocus widening as a function of lift. */
const HAIR_COMMON_GLSL = /* glsl */ `
// Out-of-focus amount, 0 on the skin → 1 at 0.3 mm of lift (depth of field 0.3–0.5 mm).
float hr_defocus(float lift) {
  return smoothstep(0.06, 0.30, lift);
}
// Tube widening that stands in for the blur circle: up to +60 %.
float hr_widen(float lift) {
  return 1.0 + 0.6 * hr_defocus(lift);
}
`;

const HAIR_VERTEX = /* glsl */ `
uniform sampler2D uRelief;
uniform float uPatchMm;
${LESION_GLSL}
${HAIR_COMMON_GLSL}

attribute vec3 aTangent;
attribute float aT;
attribute float aLift;
attribute float aRadius;
attribute float aSeed;

varying vec3 vWorldPos;
varying vec3 vCenter;
varying vec3 vTangent;
varying float vT;
varying float vLift;
varying float vSeed;
varying float vRadius;
varying float vWiden;

void main() {
  // Skin height under this point of the shaft, from the bake, plus the lesion dome.
  vec2 uv = position.xz / uPatchMm + 0.5;
  float skinH = textureLod(uRelief, uv, 0.0).r;
  float domeH = ls_height(position.xz, ls_radius());
  vec3 centre = vec3(position.x, position.y + skinH + domeH, position.z);

  float widen = hr_widen(aLift);
  float r = aRadius * widen;
  // HEX_SCALE: the polygon circumscribes the analytic circle the fragment shader draws.
  vec3 local = centre + normal * (r * ${HEX_SCALE.toFixed(6)});

  vec4 world = modelMatrix * vec4(local, 1.0);
  vWorldPos = world.xyz;
  vCenter = (modelMatrix * vec4(centre, 1.0)).xyz;
  vTangent = normalize(mat3(modelMatrix) * aTangent);
  vT = aT;
  vLift = aLift;
  vSeed = aSeed;
  vRadius = r;
  vWiden = widen;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const HAIR_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3 uRootColor;
uniform vec3 uShaftColor;
uniform vec3 uTipColor;
uniform float uExposure;
uniform float uRingBack;
uniform float uRingRadius;

varying vec3 vWorldPos;
varying vec3 vCenter;
varying vec3 vTangent;
varying float vT;
varying float vLift;
varying float vSeed;
varying float vRadius;
varying float vWiden;

${HAIR_COMMON_GLSL}

const float HR_PI = 3.14159265;

void main() {
  vec3 T = normalize(vTangent);
  vec3 V = normalize(cameraPosition - vCenter);
  // Screen-perpendicular axis across the shaft, and the view axis within the cross-section.
  vec3 B = cross(T, V);
  float bl = length(B);
  if (bl < 1e-5) discard;
  B /= bl;
  vec3 Vp = normalize(cross(B, T));
  // Signed distance from the shaft axis, in radii: -1..1 across the analytic circle.
  float u = dot(vWorldPos - vCenter, B) / max(vRadius, 1e-6);
  float au = abs(u);
  float defocus = hr_defocus(vLift);

  // --- coverage. Sharp hairs fade over the last ~0.6 px of the circle; a lifted
  // hair gets a soft bell across its (widened) width instead of an edge.
  float uPerPx = max(fwidth(u), 1e-4);
  float edgeSoft = mix(0.6 * uPerPx, 1.0, defocus);
  edgeSoft = clamp(edgeSoft, 0.6 * uPerPx, 1.0);
  float cov = 1.0 - smoothstep(1.0 - edgeSoft, 1.0, au);
  if (cov <= 0.002) discard;

  // Analytic cylinder normal at this point of the cross-section.
  float nz = sqrt(max(1.0 - au * au, 0.0));
  vec3 N = normalize(B * u + Vp * nz);

  // --- colour along the shaft: tan, a slightly darker and redder root third
  // (but not right at the emergence, which must not read as a knob), paler tip.
  float rootTint = smoothstep(0.0, 0.12, vT) * (1.0 - smoothstep(0.15, 0.4, vT));
  vec3 col = mix(uShaftColor, uRootColor, 0.7 * rootTint);
  col = mix(col, uTipColor, smoothstep(0.6, 1.0, vT));
  // Per-hair variation: ±8 % brightness, a touch of hue.
  float hv = fract(vSeed * 7.31);
  col *= 0.92 + 0.16 * hv;
  col *= vec3(1.0 + 0.04 * (fract(vSeed * 3.7) - 0.5), 1.0, 1.0 - 0.06 * (fract(vSeed * 5.3) - 0.5));

  // --- the 8-LED ring riding the camera (same rig the skin shader uses).
  float dist = length(cameraPosition);
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 camBack = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
  vec3 ringC = cameraPosition - camBack * (uRingBack * dist);
  float ringR = uRingRadius * dist;
  // Brighter side of the ring (upper-left in camera space).
  vec2 brightDir = normalize(vec2(-0.7, 0.7));

  vec3 diffuse = vec3(0.0);
  vec3 trans = vec3(0.0);
  vec3 spec = vec3(0.0);
  // Marschner-style shifts: the R lobe tilts toward the root, the TRT lobe toward the tip.
  vec3 T1 = normalize(T - N * tan(8.0 * HR_PI / 180.0));
  vec3 T2 = normalize(T + N * tan(12.0 * HR_PI / 180.0));
  vec3 transColor = col * vec3(1.25, 1.1, 0.85) + vec3(0.12, 0.09, 0.05);

  for (int k = 0; k < 8; k++) {
    float th = float(k) * (HR_PI * 0.25);
    vec2 ringDir = vec2(cos(th), sin(th));
    vec3 Lpos = ringC + ringR * (camRight * ringDir.x + camUp * ringDir.y);
    vec3 L = normalize(Lpos - vWorldPos);
    float bias = dot(ringDir, brightDir);
    // One side ~20 % brighter overall; the specular asymmetry is stronger so
    // the highlight line settles on one edge rather than both.
    float wD = (1.0 + 0.2 * bias) / 8.0;
    float wS = (1.0 + 0.6 * bias) / 8.0;

    float TL = dot(T, L);
    float sinTL = sqrt(max(1.0 - TL * TL, 0.0));
    float NL = dot(N, L);
    // Kajiya-Kay diffuse, with a cylindrical term so the shaft has a dark edge.
    diffuse += col * (sinTL * (0.3 + 0.7 * max(NL, 0.0))) * wD;
    // Light passing through the shaft: glows on the edge away from each LED.
    trans += transColor * (max(-NL, 0.0) * sinTL) * wD;

    vec3 H = normalize(L + V);
    // Where on the cross-section this LED's reflection sits (pushed outward
    // toward the edge, which is where the photographs show the line).
    vec3 Hp = H - T * dot(H, T);
    float hl = length(Hp);
    float uStar = hl > 1e-5 ? dot(Hp, B) / hl : 0.0;
    float uLine = clamp(2.2 * uStar, -0.62, 0.62);

    float TH1 = dot(T1, H);
    float s1 = pow(sqrt(max(1.0 - TH1 * TH1, 0.0)), 80.0);
    float line1 = exp(-(u - uLine) * (u - uLine) / (2.0 * 0.19 * 0.19));
    spec += vec3(1.0, 0.92, 0.78) * (s1 * line1 * 2.6) * wS;

    float TH2 = dot(T2, H);
    float s2 = pow(sqrt(max(1.0 - TH2 * TH2, 0.0)), 30.0);
    float line2 = exp(-(u + 0.8 * uLine) * (u + 0.8 * uLine) / (2.0 * 0.35 * 0.35));
    spec += col * vec3(1.15, 1.0, 0.85) * (s2 * line2 * 0.7) * wS;
  }

  vec3 radiance = 0.18 * col + uExposure * (diffuse + 0.6 * trans + spec);

  // --- alpha: ~0.6 at the widest, ~0.25 at the tip, thinner at the shaft edges
  // (a translucent cylinder is optically thin there), and divided by the
  // widening so a defocused hair keeps roughly the same integrated coverage.
  float aBase = mix(0.62, 0.25, smoothstep(0.15, 1.0, vT));
  float thick = mix(0.6 + 0.4 * nz, 1.0, defocus);
  float alpha = aBase * cov * thick / vWiden;

  gl_FragColor = vec4(radiance, alpha);
}
`;

/**
 * Contact-shadow pass. No camera matrices: the vertex shader maps world X, Z
 * straight to NDC, so texture u = x / 20 + 0.5 and v = z / 20 + 0.5 — exactly
 * the patch uv the baked textures use (flipY false, v along +Z). Row 0 of the
 * target (v = 0) is z = -10 mm; column 0 (u = 0) is x = -10 mm.
 */
const SHADOW_VERTEX = /* glsl */ `
uniform float uHalfMm;
${HAIR_COMMON_GLSL}

attribute vec3 aTangent;
attribute float aLift;
attribute float aRadius;

varying vec3 vWorldPos;
varying vec3 vCenter;
varying vec3 vTangent;
varying float vLift;
varying float vRadius;

void main() {
  float r = aRadius;
  vec3 local = position + normal * (r * ${HEX_SCALE.toFixed(6)});
  vWorldPos = local;
  vCenter = position;
  vTangent = aTangent;
  vLift = aLift;
  vRadius = r;
  gl_Position = vec4(local.x / uHalfMm, local.z / uHalfMm, 0.0, 1.0);
}
`;

const SHADOW_FRAGMENT = /* glsl */ `
precision highp float;

varying vec3 vWorldPos;
varying vec3 vCenter;
varying vec3 vTangent;
varying float vLift;
varying float vRadius;

void main() {
  vec3 T = normalize(vTangent);
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 B = cross(T, up);
  float bl = length(B);
  if (bl < 1e-5) discard;
  B /= bl;
  float u = dot(vWorldPos - vCenter, B) / max(vRadius, 1e-6);
  float au = abs(u);
  // Soft across the shaft, and only where the shaft is (nearly) touching.
  float cov = 1.0 - smoothstep(0.4, 1.0, au);
  // Touching, and not the buried prefix (the pit is already dark).
  float touch = (1.0 - smoothstep(0.0, 0.08, vLift)) * smoothstep(-0.03, -0.005, vLift);
  float alpha = 0.5 * touch * cov;
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}
`;

// ----------------------------------------------------------------- system

export function createHairs(pores: PoreField, relief: Texture, seed = 11): HairSystem {
  const hairs: HairShape[] = [];
  for (const pore of pores.pores) {
    if (!pore.hair) continue;
    // Per-hair generator keyed to the module seed and the pore's own seed.
    const hairSeed = (Math.floor(pore.seed * 0xffffffff) ^ Math.imul(seed, 0x9e3779b1)) >>> 0;
    const rand = rng(hairSeed);
    hairs.push(growHair(pore, rand, pore.seed));
  }
  const geometry = buildGeometry(hairs);

  const lesionUniforms = makeLesionUniforms();
  const material = new ShaderMaterial({
    uniforms: {
      ...lesionUniforms,
      uRelief: { value: relief },
      uPatchMm: { value: PATCH_MM },
      // Slightly more saturated than the (180,155,125) target: the shaft is
      // alpha-blended over the skin, which pulls it back toward the ground.
      uRootColor: { value: linearColor(160, 128, 92) },
      uShaftColor: { value: linearColor(182, 150, 108) },
      uTipColor: { value: linearColor(200, 175, 138) },
      /**
       * Scales the ring light. Set so a flat-lying shaft lands ~13 % under a skin
       * ground of linear ~0.3 (sRGB 205 after ACES); raise it if the skin shader
       * exposes brighter than that.
       */
      uExposure: { value: 0.46 },
      uRingBack: { value: 0.55 },
      uRingRadius: { value: 0.4 },
    },
    vertexShader: HAIR_VERTEX,
    fragmentShader: HAIR_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    side: FrontSide,
    toneMapped: false,
  });

  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  mesh.name = "fable-hairs";

  // --- contact shadow
  const shadowTarget = new WebGLRenderTarget(SHADOW_SIZE, SHADOW_SIZE, {
    type: UnsignedByteType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
  });
  shadowTarget.texture.flipY = false;
  shadowTarget.texture.name = "fable-hair-shadow";
  const shadowMaterial = new ShaderMaterial({
    uniforms: { uHalfMm: { value: HALF_MM } },
    vertexShader: SHADOW_VERTEX,
    fragmentShader: SHADOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
    side: FrontSide,
    toneMapped: false,
  });
  const shadowMesh = new Mesh(geometry, shadowMaterial);
  shadowMesh.frustumCulled = false;
  const shadowScene = new Scene();
  shadowScene.add(shadowMesh);
  // The shadow vertex shader ignores the camera; this one only satisfies render().
  const shadowCamera = new OrthographicCamera(-HALF_MM, HALF_MM, HALF_MM, -HALF_MM, 0.1, 100);
  shadowCamera.position.set(0, 10, 0);
  shadowCamera.lookAt(0, 0, 0);

  const prevClear = new Color();
  const renderShadow = (renderer: WebGLRenderer) => {
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(prevClear);
    const prevAlpha = renderer.getClearAlpha();
    const prevAutoClear = renderer.autoClear;
    renderer.setRenderTarget(shadowTarget);
    renderer.setClearColor(0xffffff, 1);
    renderer.autoClear = false;
    renderer.clear(true, false, false);
    renderer.render(shadowScene, shadowCamera);
    renderer.autoClear = prevAutoClear;
    renderer.setClearColor(prevClear, prevAlpha);
    renderer.setRenderTarget(prevTarget);
  };

  return {
    mesh,
    lesionUniforms,
    shadowTexture: shadowTarget.texture,
    renderShadow,
    dispose() {
      geometry.dispose();
      material.dispose();
      shadowMaterial.dispose();
      shadowTarget.dispose();
    },
  };
}
