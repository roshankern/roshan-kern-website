import type { DataTexture, Mesh, Texture, WebGLRenderer } from "three";
import type { LesionUniforms } from "./lesionGlsl";
import type { PoreField } from "./pores";

/**
 * The interfaces the fable-skin modules meet at. skinBake.ts, skinShaders.ts
 * and hair.ts each implement one of these; SkinScene.tsx wires them together.
 * Kept in one file so a change to a boundary is a change in one place.
 */

/** The static skin, rendered once into textures over the 20 mm patch (see design.md for channel layout). */
export type BakedSkin = {
  /** RGBA16F: height mm, ∂h/∂x, ∂h/∂z, cavity AO (1 = open). LinearFilter, no flipY. */
  relief: Texture;
  /** RGBA8: base albedo rgb (linear), roughness. */
  albedo: Texture;
  /** RGBA8: sulci, pore pit, pore tint, haemoglobin excess. */
  masks: Texture;
  dispose(): void;
};

export type BakeSkinFn = (renderer: WebGLRenderer, pores: PoreField) => BakedSkin;

/** Vellus hairs as geometry, plus their top-down contact shadow for the skin shader. */
export type HairSystem = {
  /** Add to the scene. Its material is complete; nothing else needs setting. */
  mesh: Mesh;
  /**
   * The hair material's lesion uniforms: hairs ride over the dome, so the hair
   * vertex shader includes LESION_GLSL and needs the same day applied to it
   * that the skin gets. SkinScene calls applyLesion() on this in setDay().
   */
  lesionUniforms: LesionUniforms;
  /**
   * 1024² occlusion over the patch in patch uv, 0 = fully shadowed, 1 = open.
   * Only the faint contact line where a shaft touches the skin — dermoscopic
   * ring light casts no real hair shadows. Valid after renderShadow().
   */
  shadowTexture: Texture;
  /** Render (or re-render) the shadow map. Hairs are static, so once at setup is enough. */
  renderShadow(renderer: WebGLRenderer): void;
  dispose(): void;
};

export type CreateHairsFn = (pores: PoreField, relief: Texture, seed?: number) => HairSystem;

/** Everything the per-frame skin material reads. Lesion uniforms are updated by applyLesion(). */
export type SkinUniforms = LesionUniforms & {
  uRelief: { value: Texture };
  uAlbedo: { value: Texture };
  uMasks: { value: Texture };
  uHairShadow: { value: Texture };
  /** Pre-integrated scattering LUT: u = N·L mapped 0..1, v = curvature (1/r) mapped 0..1. */
  uSssLut: { value: DataTexture };
  /** Millimetres per device pixel at the target plane; sets anti-alias widths and the micro-grain fade. */
  uMmPerPx: { value: number };
  /** Patch extent, mm — for uv = p / uPatchMm + 0.5. */
  uPatchMm: { value: number };
  /** Vignette start and end radii, mm from the origin. */
  uVignette: { value: { x: number; y: number } };
};

export type MakeSkinUniformsFn = (baked: BakedSkin, hairShadow: Texture) => SkinUniforms;
