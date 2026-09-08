import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NearestFilter,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector4,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";
import type { BakedSkin } from "./contracts";
import { PATCH_MM } from "./lesion";
import type { PoreField } from "./pores";

/**
 * The static cheek skin, rendered once into three textures over the 20 mm patch.
 * Every number in the shader is in millimetres so it can be checked against
 * reference-notes.md §c (normal cheek under a DermLite), which is the target.
 *
 * Layout and orientation
 * ----------------------
 * Texel uv ↔ patch point p = (uv − 0.5)·PATCH_MM, with uv.x ↔ world X and
 * uv.y ↔ world Z (the plane is XZ, height is +Y). A consumer samples with
 * uv = p.xz / PATCH_MM + 0.5 and flipY = false; row 0 of each texture is
 * z = −10 mm. The pore texture uses the same convention (cell (i, j) ↔ (x, z)).
 *
 * | Texture  | Size  | Type    | R              | G          | B              | A                        |
 * | -------- | ----- | ------- | -------------- | ---------- | -------------- | ------------------------ |
 * | relief   | 3072² | RGBA16F | height, mm     | ∂h/∂x      | ∂h/∂z          | cavity AO, 1 = open      |
 * | albedo   | 2048² | RGBA8   | albedo r (lin) | g (lin)    | b (lin)        | roughness 0..1           |
 * | masks    | 2048² | RGBA8   | sulci 0..1     | pore pit   | pore tint      | haemoglobin excess 0..1  |
 *
 * All three: LinearFilter mag, LinearMipmapLinearFilter min, mipmaps, clamp to edge.
 * Albedo RGB is LINEAR — the sRGB targets from the notes are converted in the shader.
 * masks.B marks where a plug/filament/dark pore interior already owns the albedo,
 * so the frame shader can weaken erythema and scattering there. masks.A carries
 * vessels (0.4–0.8 on a vessel) plus blotchy 150–300 µm vascular mottling
 * (0.1–0.3), for the frame shader to multiply into its erythema.
 *
 * One ShaderMaterial, `uPass` selecting the output, drawn as a full-screen quad:
 *   pass 0 → a scratch RGBA16F height target (h, sulci, pit, flake) at relief size
 *   pass 1 → relief: slopes by central differences and AO by horizon taps, both
 *            read from the scratch target (24 texture taps instead of 24 height
 *            evaluations per texel)
 *   pass 2 → albedo, pass 3 → masks (each re-evaluates the fields once).
 * The scratch target, quad and material are freed before returning.
 */

const RELIEF_SIZE = 3072;
const ALBEDO_SIZE = 2048;

// ------------------------------------------------------------------ shaders

const BAKE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BAKE_FRAGMENT = /* glsl */ `
uniform sampler2D uPores;   // GRID² RGBA float: (x, z, radius, kind + 10·ring)
uniform sampler2D uHair;    // GRID² RGBA float: (hair 0/1, hairAngle, seed, 0)
uniform sampler2D uHeight;  // pass ≥ 1: pass-0 output (h mm, sulci, pit, flake)
uniform int uPass;
uniform int uGrid;
uniform float uPatchMm;
uniform float uCellMm;
varying vec2 vUv;

#define BK_PI 3.14159265359

// ---- hashing and value noise (no textures, no periodicity at the scales used)
float bk_hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
vec2 bk_hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
float bk_vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bk_hash21(i), bk_hash21(i + vec2(1.0, 0.0)), f.x),
             mix(bk_hash21(i + vec2(0.0, 1.0)), bk_hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Signed, -1..1.
float bk_sn(vec2 p) { return bk_vnoise(p) * 2.0 - 1.0; }
// Three octaves, 0..1, mean 0.5.
float bk_fbm(vec2 p) {
  return bk_vnoise(p) * 0.5 + bk_vnoise(p * 2.03 + vec2(5.2, 1.3)) * 0.3 + bk_vnoise(p * 4.07 + vec2(1.7, 9.2)) * 0.2;
}
// Worley: (F1, F2) Euclidean in the units of p, plus the two nearest cell ids.
vec2 bk_worley(vec2 p, out vec2 id1, out vec2 id2) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 9.0, f2 = 9.0;
  id1 = i; id2 = i;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + bk_hash22(i + g) - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; id2 = id1; f1 = d; id1 = i + g; } else if (d < f2) { f2 = d; id2 = i + g; }
  }
  return sqrt(vec2(f1, f2));
}
vec3 bk_srgbToLinear(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(0.04045, c));
}

// ---- skin-line network (sulci cutis). Two Worley layers whose cells are
// stretched 1.6× along directions ~70° apart give walls that run mostly those
// two ways; every wall has its own depth (some nearly gone), so cells merge
// into irregular rhomboid/triangular plateaus 200–400 µm across. A weak,
// heavily warped family of wandering lines adds the directional trend; a fine
// isotropic Worley is the secondary subdivision. Grooves are Gaussian in
// section (soft V, rounded shoulders) and each plateau gets a few µm of
// convexity so its edges glint under the ring light.
// Returns (height mm, groove mask 0..1, distance to nearest groove mm).
float bk_wall(vec2 q, float cell, float stretch, float w, float offs, out float dperp) {
  vec2 id1, id2;
  vec2 F = bk_worley(vec2(q.x / stretch, q.y) / cell + offs, id1, id2);
  float e = (F.y - F.x) * cell; // ≈ 2× perpendicular distance to the wall
  dperp = 0.5 * e;
  float own = 0.35 + 0.65 * smoothstep(0.2, 0.7, bk_hash21(id1 + id2 + offs));
  return exp(-(e * e) / (4.0 * w * w)) * own;
}
vec3 bk_sulci(vec2 p) {
  vec2 pw = p + 0.22 * vec2(bk_sn(p / 2.4 + 2.0), bk_sn(p / 2.4 + 31.7))
              + 0.07 * vec2(bk_sn(p / 0.8 + 5.1), bk_sn(p / 0.8 + 9.4))
              + 0.01 * vec2(bk_sn(p / 0.3 + 12.0), bk_sn(p / 0.3 + 15.0));
  // Crisp in some 2–3 mm regions, all but gone in about a third of the field.
  float patchy = 0.08 + 0.92 * smoothstep(0.4, 0.8, bk_fbm(p / 2.5 + 40.0));
  // Groove half-width 18–30 µm (36–60 µm wide at 1/e).
  float w = 0.018 + 0.012 * bk_vnoise(p / 0.5 + 3.0);
  // Primary direction drifts across the patch so nothing lines up with the frame.
  float th = 0.35 + 0.25 * bk_sn(p / 6.0 + 1.0);
  vec2 t0 = vec2(cos(th), sin(th));
  float th1 = th + 1.22;
  vec2 t1 = vec2(cos(th1), sin(th1));
  vec2 q0 = vec2(dot(pw, t0), dot(pw, vec2(-t0.y, t0.x)));
  vec2 q1 = vec2(dot(pw, t1), dot(pw, vec2(-t1.y, t1.x)));
  float dA, dB, dS;
  float hsum = 0.015 * bk_wall(q0, 0.28, 1.5, w, 7.0, dA);
  hsum += 0.012 * bk_wall(q1, 0.31, 1.5, w, 19.0, dB);
  // Wandering lines along the first direction, fading in and out in segments.
  float s = q0.y / 0.36;
  float dL = abs(fract(s) - 0.5) * 0.36;
  float fade = bk_vnoise(vec2(floor(s) * 1.71, q0.x / 0.5));
  hsum += 0.007 * exp(-(dL * dL) / (w * w)) * smoothstep(0.3, 0.7, fade);
  // Secondary: 100–150 µm cells, ~6 µm deep, ~20 µm wide, patchy.
  hsum += 0.006 * bk_wall(pw, 0.13, 1.0, 0.012, 3.0, dS) * (0.4 + 0.6 * bk_vnoise(p / 0.9 + 8.0));
  float dmin = min(min(dA, dB), min(dL, dS));
  hsum *= patchy;
  float plateau = smoothstep(0.0, 0.10, dmin);
  return vec3(-hsum + 0.004 * plateau * patchy, clamp(hsum / 0.022, 0.0, 1.0), dmin);
}

// ---- follicular openings, from the shared pore field. 3×3 cells: a 0.8 mm cell
// keeps its pore in the middle 70 %, but a plug can reach 0.18 mm and a brown
// ring 0.23 mm, so a neighbour's features can cross the border.
struct BkPore {
  float h;     // height contribution, mm
  float pit;   // opening mask
  float tint;  // interior tint mask (owns the albedo where 1)
  vec3 col;    // interior colour, sRGB 0..1
  float rough; // interior roughness
  float ring;  // brown-circle mask
  float ringTone; // 0..1 per-pore ring colour variation
  float sd;    // signed distance to the pore's pale pseudonetwork hole, mm
};
BkPore bk_pores(vec2 p) {
  BkPore o;
  o.h = 0.0; o.pit = 0.0; o.tint = 0.0; o.col = vec3(0.0); o.rough = 0.0; o.ring = 0.0; o.ringTone = 0.5; o.sd = 1.0;
  ivec2 c0 = ivec2(floor((p + 0.5 * uPatchMm) / uCellMm));
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 c = c0 + ivec2(i, j);
    if (c.x < 0 || c.y < 0 || c.x >= uGrid || c.y >= uGrid) continue;
    vec4 pr = texelFetch(uPores, c, 0);
    float kind = mod(pr.w, 10.0);
    if (kind < 0.5) continue;
    vec4 hr = texelFetch(uHair, c, 0);
    float R = pr.z;
    float seed = hr.z;
    vec2 q = p - pr.xy;
    float dr = length(q);
    // A hair leaves from the edge of the opening on its side, so the ostium
    // is a little longer and shifted that way.
    if (hr.x > 0.5) {
      vec2 hd = vec2(cos(hr.y), sin(hr.y));
      q = vec2((dot(q, hd) - 0.15 * R) * 0.8, dot(q, vec2(-hd.y, hd.x)));
    }
    float d = length(q);
    float ang = atan(q.y, q.x);
    float Ri = R * (1.0 + 0.10 * sin(3.0 * ang + seed * 6.283) + 0.06 * sin(5.0 * ang - seed * 9.1));
    float u = d / Ri;
    if (kind < 2.5) {
      // Plain pit (and the filament variant): floor 25–40 µm down, soft
      // shoulder, a 4 µm raised rim; the filament fills the ostium to near the surface.
      float depth = (kind < 1.5) ? 0.026 + 0.014 * seed : 0.018;
      float pit = 1.0 - smoothstep(0.45, 1.15, u);
      float h = -depth * pit + 0.004 * exp(-pow((u - 1.45) / 0.35, 2.0));
      float fill = (kind < 1.5) ? 0.0 : 1.0 - smoothstep(0.7, 1.0, u);
      o.h += mix(h, -0.008, fill);
      o.pit = max(o.pit, 1.0 - smoothstep(0.75, 1.1, u));
      float t = (kind < 1.5) ? 0.75 * (1.0 - smoothstep(0.55, 1.0, u)) : 0.95 * fill;
      vec3 col = (kind < 1.5)
        ? vec3(185.0, 150.0, 124.0) / 255.0 * (1.0 - 0.15 * (1.0 - smoothstep(0.0, 0.7, u)))
        : vec3(190.0, 165.0, 120.0) / 255.0 * (0.96 + 0.08 * bk_vnoise(p / 0.02));
      if (t > o.tint) { o.tint = t; o.col = col; o.rough = (kind < 1.5) ? 0.6 : 0.45; }
    } else {
      // Keratin plug (open comedo at pore scale): broad shallow crater; a
      // dark-brown plug with a rounded-lobed outline and a 10 µm soft edge,
      // standing ~15 µm proud; a paler tan rim 30–50 µm wide around it. The
      // plug and rim own the albedo (tint 1 / 0.8) so erythema and SSS stay off.
      float crater = 1.0 - smoothstep(0.7, 1.4, u);
      float plugR = 0.72 * R * (1.0 + 0.12 * sin(2.0 * ang + seed * 20.0) + 0.08 * sin(3.0 * ang - seed * 33.0));
      float plug = 1.0 - smoothstep(plugR - 0.005, plugR + 0.005, d);
      float rimW = 0.03 + 0.02 * fract(seed * 9.7);
      float rim = (1.0 - smoothstep(plugR + rimW, plugR + rimW + 0.015, d)) * (1.0 - plug);
      float lump = 0.002 * bk_sn(p / 0.03 + seed * 50.0);
      o.h += -0.02 * crater + plug * (0.035 + lump);
      o.pit = max(o.pit, crater);
      float t = max(max(plug, 0.8 * rim), 0.3 * crater);
      vec3 plugC = vec3(85.0, 45.0, 30.0) / 255.0 * (0.92 + 0.16 * bk_vnoise(p / 0.03 + 3.0));
      vec3 rimC = vec3(190.0, 150.0, 120.0) / 255.0;
      vec3 col = mix(mix(vec3(200.0, 165.0, 135.0) / 255.0, rimC, rim), plugC, plug);
      if (t > o.tint) { o.tint = t; o.col = col; o.rough = mix(0.5, 0.45, plug); }
    }
    if (pr.w >= 10.0) {
      // Brown circle: outer diameter 250–450 µm, 40–80 µm wide, but never a
      // target: radius and width wobble ±25 % with angle, one side fades, and
      // about a third are only an arc.
      float angA = atan(p.y - pr.y, p.x - pr.x);
      float f1 = 0.6 * sin(2.0 * angA + seed * 31.0) + 0.4 * sin(3.0 * angA - seed * 17.0);
      float f2 = 0.6 * sin(3.0 * angA + seed * 23.0) + 0.4 * sin(2.0 * angA + seed * 47.0);
      float ro = (0.125 + 0.10 * fract(seed * 7.31)) * (1.0 + 0.25 * f1);
      float rw = (0.04 + 0.04 * fract(seed * 3.77)) * (1.0 + 0.25 * f2);
      float ring = 1.0 - smoothstep(0.5 * rw - 0.02, 0.5 * rw + 0.02, abs(dr - (ro - 0.5 * rw)));
      float side = 0.5 + 0.5 * cos(angA - seed * 6.283);
      ring *= (fract(seed * 11.7) < 0.35) ? smoothstep(0.25, 0.7, side) : mix(0.35, 1.0, side);
      ring *= 0.6 + 0.4 * bk_vnoise(vec2(angA * 2.0 + seed * 40.0, seed * 9.0));
      if (ring > o.ring) { o.ring = ring; o.ringTone = fract(seed * 5.71); }
    }
    // The pale pseudonetwork hole around the pore, with a lumpy outline so it is not a halo.
    float angH = atan(p.y - pr.y, p.x - pr.x);
    float rH = (0.15 + 0.10 * fract(seed * 5.13)) * (1.0 + 0.15 * sin(2.0 * angH + seed * 12.0) + 0.1 * sin(3.0 * angH - seed * 27.0));
    o.sd = min(o.sd, dr - rH);
  }
  return o;
}

// ---- pseudonetwork holes where there is no pore: a jittered 0.5 mm grid of
// pale round follicular "holes", some missing so the mesh has broader strands.
float bk_holeGrid(vec2 p) {
  const float cell = 0.55;
  vec2 i = floor(p / cell);
  vec2 f = fract(p / cell);
  float sd = 1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 c = i + g;
    if (bk_hash21(c + 23.0) < 0.25) continue;
    vec2 cen = g + 0.1 + 0.8 * bk_hash22(c + 41.0) - f;
    float r = 0.11 + 0.13 * bk_hash21(c + 63.0);
    sd = min(sd, length(cen) * cell - r);
  }
  return sd;
}

// ---- scattered fine scale flakes: ~1 % coverage, 50–200 µm, irregular convex
// polygons (5 random half-planes) with an 8–12 µm soft edge, translucent, and
// only a 1–2 µm lifted edge in height. Returns (height mm, opacity 0..0.35).
vec2 bk_flakes(vec2 p) {
  const float cell = 0.25;
  vec2 i = floor(p / cell);
  float h = 0.0, m = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 c = i + vec2(float(x), float(y));
    if (bk_hash21(c + 51.0) > 0.055) continue;
    vec2 hh = bk_hash22(c + 77.0);
    vec2 q = p - (c + hh) * cell;
    float ax = hh.y * 6.28;
    vec2 ex = vec2(cos(ax), sin(ax));
    q = vec2(dot(q, ex) / (1.2 + 0.8 * hh.x), dot(q, vec2(-ex.y, ex.x)));
    float r0 = 0.024 + 0.03 * bk_hash21(c + 9.0);
    float sd = -1.0;
    for (int k = 0; k < 5; k++) {
      vec2 hk = bk_hash22(c + float(k) * 17.0 + 3.0);
      float an = (float(k) + 0.5 * hk.x) * 1.2566;
      sd = max(sd, dot(q, vec2(cos(an), sin(an))) - r0 * (0.6 + 0.4 * hk.y));
    }
    float inside = 1.0 - smoothstep(-0.005, 0.005, sd);
    float lifted = 0.5 + 0.5 * clamp(q.x / r0, -1.0, 1.0);
    h = max(h, inside * (0.0005 + 0.0015 * lifted));
    m = max(m, inside * (0.2 + 0.15 * bk_hash21(c + 88.0)));
  }
  return vec2(h, m);
}

// ---- vessels: the walls of a warped 1.4 mm Voronoi, each wall present or not
// by a hash of its two cells, so the lines branch and end like a sparse
// dendritic net. 50–100 µm wide with ~30 µm soft edges (they lie 100–200 µm deep).
float bk_vessels(vec2 p) {
  vec2 pw = p + 0.25 * vec2(bk_sn(p / 2.2 + 3.0), bk_sn(p / 2.2 + 8.0))
              + 0.10 * vec2(bk_sn(p / 0.55 + 1.0), bk_sn(p / 0.55 + 2.0))
              + 0.03 * vec2(bk_sn(p / 0.2 + 4.0), bk_sn(p / 0.2 + 6.0));
  vec2 id1, id2;
  vec2 F = bk_worley(pw / 1.4 + 11.0, id1, id2);
  float e = (F.y - F.x) * 1.4;
  float present = step(0.55, bk_hash21(id1 + id2 + 5.0));
  float w = 0.035 + 0.045 * bk_vnoise(pw / 0.45 + 4.0);
  float line = 1.0 - smoothstep(0.3 * w, w + 0.05, e);
  float along = 0.5 + 0.5 * bk_sn(pw / 0.8 + 21.0);
  return line * present * smoothstep(0.1, 0.6, along);
}

// ---- pass 1: slopes and cavity occlusion from the scratch height texture.
vec4 bk_relief() {
  vec2 ts = 1.0 / vec2(textureSize(uHeight, 0));
  float texelMm = uPatchMm * ts.x;
  float h0 = texture(uHeight, vUv).x;
  float dhdx = (texture(uHeight, vUv + vec2(ts.x, 0.0)).x - texture(uHeight, vUv - vec2(ts.x, 0.0)).x) / (2.0 * texelMm);
  float dhdz = (texture(uHeight, vUv + vec2(0.0, ts.y)).x - texture(uHeight, vUv - vec2(0.0, ts.y)).x) / (2.0 * texelMm);
  // Horizon AO: in 8 directions, the steepest rise seen at 25 / 50 / 90 µm,
  // scaled so a groove floor bottoms out near 0.88 and only pits go deeper.
  float occ = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * (BK_PI / 4.0) + 0.2;
    vec2 dir = vec2(cos(a), sin(a)) / uPatchMm;
    float m = 0.0;
    for (int k = 0; k < 3; k++) {
      float r = (k == 0) ? 0.025 : ((k == 1) ? 0.05 : 0.09);
      float dh = max(texture(uHeight, vUv + dir * r).x - h0, 0.0);
      m = max(m, dh / sqrt(dh * dh + r * r));
    }
    occ += m;
  }
  return vec4(h0, dhdx, dhdz, 1.0 - 0.6 * occ / 8.0);
}

void main() {
  if (uPass == 1) { gl_FragColor = bk_relief(); return; }
  vec2 p = (vUv - 0.5) * uPatchMm;

  vec3 sul = bk_sulci(p);
  BkPore po = bk_pores(p);
  float open = 1.0 - po.pit;
  vec2 fl = bk_flakes(p) * open;
  float sulci = sul.y * open;

  if (uPass == 0) {
    // Dermal undulation ±0.03 mm over 2–4 mm; micro-grain 35–60 µm, 2–4 µm.
    float und = 0.045 * (bk_fbm(p / 3.0 + 60.0) * 2.0 - 1.0);
    float grain = 0.003 * bk_sn(p / 0.06 + 70.0) + 0.0015 * bk_sn(p / 0.035 + 80.0);
    float h = und + sul.x * open + grain * (1.0 - 0.6 * po.pit) + po.h + fl.x;
    gl_FragColor = vec4(h, sulci, po.pit, fl.y);
    return;
  }

  float ves = bk_vessels(p);
  if (uPass == 3) {
    // Blotchy vascular mottling, 150–300 µm patches, so erythema is never a smooth gaussian.
    float mot = bk_vnoise(p / 0.28 + 2.0) * 0.6 + bk_vnoise(p / 0.14 + 6.0) * 0.4;
    float mottle = 0.1 + 0.2 * smoothstep(0.35, 0.7, mot);
    float hb = clamp(ves * (0.45 + 0.35 * bk_vnoise(p / 0.5 + 7.0)) + mottle, 0.0, 1.0);
    gl_FragColor = vec4(sulci, po.pit, po.tint, hb);
    return;
  }

  // ---- pass 2: albedo (built in sRGB from the notes' colours, written linear) + roughness.
  float mott = 1.0 + 0.06 * (bk_fbm(p / 0.7 + 90.0) * 2.0 - 1.0);
  // Base sits a shade above the notes' (205,168,135) so the field's mean lands on it once the tan strands are mixed in.
  vec3 c = vec3(212.0, 175.0, 141.0) / 255.0 * mott;
  // Pseudonetwork: soft tan mesh around pale follicular holes, patchily accentuated.
  float sd = min(bk_holeGrid(p), po.sd) + 0.025 * bk_sn(p / 0.18 + 3.0);
  float n = smoothstep(-0.10, 0.06, sd);
  float acc = 0.6 * (0.25 + 1.0 * smoothstep(0.25, 0.8, bk_fbm(p / 2.2 + 100.0))) * (0.55 + 0.45 * bk_vnoise(p / 0.9 + 110.0));
  vec3 strand = vec3(185.0, 140.0, 105.0) / 255.0 * (0.94 + 0.12 * bk_vnoise(p / 0.3 + 5.0));
  c = mix(c, mix(vec3(215.0, 178.0, 145.0) / 255.0, strand, n) * mott, acc);
  // 1–3 mm darker, redder-brown pigment patches.
  float pig = smoothstep(0.6, 0.78, bk_fbm(p / 1.3 + 120.0));
  c = mix(c, vec3(190.0, 145.0, 100.0) / 255.0 * mott, 0.8 * pig);
  // Vessels, faint: most of their visibility comes from masks.A in the frame shader.
  c += vec3(8.0, -5.0, 0.0) / 255.0 * ves * 0.7;
  // Groove floors a little darker and redder.
  c *= 1.0 - sulci * vec3(0.04, 0.055, 0.06);
  vec3 ringC = mix(vec3(182.0, 138.0, 118.0), vec3(204.0, 162.0, 140.0), po.ringTone) / 255.0;
  c = mix(c, ringC, 0.55 * po.ring);
  c = mix(c, po.col, po.tint);
  c = mix(c, vec3(240.0, 225.0, 210.0) / 255.0, fl.y * (0.85 + 0.15 * bk_vnoise(p / 0.03)));

  // Roughness: resting 0.42 ± sebum mottling; plateau tops glossier, more so
  // in 1–2 mm sebum patches; grooves, pore floors, plugs, filaments, scale as noted.
  float rough = 0.41 + 0.05 * bk_sn(p / 1.0 + 130.0);
  float sebum = smoothstep(0.55, 0.75, bk_fbm(p / 1.5 + 140.0));
  float top = smoothstep(0.03, 0.09, sul.z) * open;
  rough = mix(rough, 0.36 - 0.05 * sebum, top * (0.5 + 0.5 * sebum));
  rough = mix(rough, 0.55, sulci);
  rough = mix(rough, po.rough, po.tint);
  rough = mix(rough, 0.7, min(fl.y * 2.0, 1.0));
  gl_FragColor = vec4(bk_srgbToLinear(clamp(c, 0.0, 1.0)), clamp(rough, 0.0, 1.0));
}
`;

// ------------------------------------------------------------------ bake

function makeTarget(size: number, type: typeof HalfFloatType | typeof UnsignedByteType, mipmaps: boolean) {
  const rt = new WebGLRenderTarget(size, size, {
    type,
    format: RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: mipmaps,
    minFilter: mipmaps ? LinearMipmapLinearFilter : LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    colorSpace: NoColorSpace,
  });
  const t = rt.texture;
  t.generateMipmaps = mipmaps;
  t.minFilter = mipmaps ? LinearMipmapLinearFilter : LinearFilter;
  t.magFilter = LinearFilter;
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.flipY = false;
  return rt;
}

/** The per-pore fields the shared texture does not carry: (hair, hairAngle, seed, 0), one texel per cell. */
function makeHairTexture(pores: PoreField): DataTexture {
  const g = pores.grid;
  const data = new Float32Array(g * g * 4);
  const half = PATCH_MM / 2;
  for (const pore of pores.pores) {
    const i = Math.min(g - 1, Math.max(0, Math.floor((pore.x + half) / pores.cellMm)));
    const j = Math.min(g - 1, Math.max(0, Math.floor((pore.z + half) / pores.cellMm)));
    const idx = (j * g + i) * 4;
    data[idx] = pore.hair ? 1 : 0;
    data[idx + 1] = pore.hairAngle;
    data[idx + 2] = pore.seed;
  }
  const t = new DataTexture(data, g, g, RGBAFormat, FloatType);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

export function bakeSkin(renderer: WebGLRenderer, pores: PoreField): BakedSkin {
  const prevTarget = renderer.getRenderTarget();
  const prevViewport = renderer.getViewport(new Vector4());
  const prevScissor = renderer.getScissor(new Vector4());
  const prevScissorTest = renderer.getScissorTest();

  const hair = makeHairTexture(pores);
  const scratch = makeTarget(RELIEF_SIZE, HalfFloatType, false);
  const relief = makeTarget(RELIEF_SIZE, HalfFloatType, true);
  const albedo = makeTarget(ALBEDO_SIZE, UnsignedByteType, true);
  const masks = makeTarget(ALBEDO_SIZE, UnsignedByteType, true);

  const material = new ShaderMaterial({
    uniforms: {
      uPores: { value: pores.texture },
      uHair: { value: hair },
      // Pass 0 writes the scratch target, so it must not also be bound as a
      // sampler then (WebGL rejects the feedback loop); pass 1 swaps it in.
      uHeight: { value: hair },
      uPass: { value: 0 },
      uGrid: { value: pores.grid },
      uPatchMm: { value: PATCH_MM },
      uCellMm: { value: pores.cellMm },
    },
    vertexShader: BAKE_VERTEX,
    fragmentShader: BAKE_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  const scene = new Scene();
  scene.add(quad);
  // The vertex shader writes clip space directly; the camera is only for three's API.
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const run = (pass: number, target: WebGLRenderTarget) => {
    material.uniforms.uPass.value = pass;
    material.uniforms.uHeight.value = pass === 0 ? hair : scratch.texture;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  };
  try {
    run(0, scratch);
    run(1, relief);
    run(2, albedo);
    run(3, masks);
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.setViewport(prevViewport);
    renderer.setScissor(prevScissor);
    renderer.setScissorTest(prevScissorTest);
    material.dispose();
    geometry.dispose();
    hair.dispose();
    scratch.dispose();
  }

  return {
    relief: relief.texture,
    albedo: albedo.texture,
    masks: masks.texture,
    dispose() {
      relief.dispose();
      albedo.dispose();
      masks.dispose();
    },
  };
}
