import type { FableLesionState } from "./lesion";

/**
 * The lesion's uniforms and its height functions as one GLSL chunk, included
 * verbatim by BOTH the skin vertex shader (which displaces the mesh) and the
 * skin fragment shader (which needs the dome's slopes for the normal and the
 * dome mask for colour), so the two can never disagree about the surface.
 *
 * Only the lesion lives here. The static skin — undulation, line network,
 * pores, grain — is baked into textures by skinBake.ts and never evaluated
 * per frame.
 *
 * World units are mm, the plane is XZ, height is +Y, the lesion is at the origin.
 */

export type LesionUniforms = {
  uDiameter: { value: number };
  uElevation: { value: number };
  uErythema: { value: number };
  uPlug: { value: number };
  uPustule: { value: number };
  uCrust: { value: number };
  uPie: { value: number };
  uVessels: { value: number };
  uScale: { value: number };
  uWetness: { value: number };
  uPih: { value: number };
  uSebum: { value: number };
};

export function makeLesionUniforms(): LesionUniforms {
  return {
    uDiameter: { value: 0.15 },
    uElevation: { value: 0 },
    uErythema: { value: 0 },
    uPlug: { value: 0 },
    uPustule: { value: 0 },
    uCrust: { value: 0 },
    uPie: { value: 0 },
    uVessels: { value: 0 },
    uScale: { value: 0 },
    uWetness: { value: 0 },
    uPih: { value: 0 },
    uSebum: { value: 0.3 },
  };
}

/** Copies a lesion state into the uniforms. Values are already 0–1 drive signals or mm. */
export function applyLesion(u: LesionUniforms, s: FableLesionState) {
  u.uDiameter.value = s.diameterMm;
  u.uElevation.value = s.elevationMm;
  u.uErythema.value = s.erythema;
  u.uPlug.value = s.plugDensity;
  u.uPustule.value = s.pustuleFrac;
  u.uCrust.value = s.crust;
  u.uPie.value = s.pie;
  u.uVessels.value = s.vessels;
  u.uScale.value = s.scale;
  u.uWetness.value = s.wetness;
  u.uPih.value = s.pih;
  u.uSebum.value = s.sebum;
}

/**
 * GLSL. Provides:
 *
 *   uniform float uDiameter, uElevation, uErythema, uPlug, uPustule, uCrust,
 *                 uPie, uVessels, uScale, uWetness, uPih, uSebum;
 *   float ls_radius()                      lesion radius, mm (≥ 0.05)
 *   float ls_dome(vec2 p, float R)         dome profile, 1 at centre → 0 at the wobbly rim,
 *                                          flattening on top as the pustule fills
 *   float ls_crater(vec2 p, float R)       0..1 mask of the collapsed centre after rupture
 *   float ls_height(vec2 p, float R)       lesion height, mm: dome minus crater
 *   float ls_tight(float dome)             how stretched the skin over the swelling is, 0..1
 *
 * Identifiers are prefixed ls_ to keep clear of three's chunks and of the
 * skin shaders' own sk_ helpers. `patch` is a GLSL reserved word: never use it.
 */
export const LESION_GLSL = /* glsl */ `
uniform float uDiameter;
uniform float uElevation;
uniform float uErythema;
uniform float uPlug;
uniform float uPustule;
uniform float uCrust;
uniform float uPie;
uniform float uVessels;
uniform float uScale;
uniform float uWetness;
uniform float uPih;
uniform float uSebum;

float ls_radius() {
  return max(0.5 * uDiameter, 0.05);
}

// 1 at the centre, 0 at the rim. The rim wobbles with angle so the lesion is
// not a perfect disc, and the top flattens as the pustule fills, because a pus
// head sits under a thin flat roof rather than a rounded dome. The falloff is
// a smoothstep of the radial fraction, which gives a papule's soft shoulder.
float ls_dome(vec2 p, float R) {
  float d = length(p);
  float a = atan(p.y, p.x);
  float Rw = R * (1.0 + 0.06 * sin(3.0 * a + 1.3) + 0.04 * sin(5.0 * a - 0.4));
  float t = clamp(d / Rw, 0.0, 1.0);
  return 1.0 - smoothstep(0.45 * uPustule, 1.0, t);
}

// Rupture collapses the centre: a crater cut from the dome once crust > 0.5.
float ls_crater(vec2 p, float R) {
  float crater = smoothstep(0.5, 0.9, uCrust);
  return crater * (1.0 - smoothstep(0.0, 0.45 * R, length(p)));
}

// Lesion height above the baked skin, mm.
float ls_height(vec2 p, float R) {
  float dome = ls_dome(p, R);
  return uElevation * dome - uElevation * 0.5 * ls_crater(p, R);
}

// Only a raised lesion tightens the surface; a flat mark keeps its lines.
float ls_tight(float dome) {
  return dome * smoothstep(0.02, 0.25, uElevation);
}
`;
