/** GLSL for per-part effects, the shader twin of applyFxPoint in part-fx.ts. Stub from Task 3: empty strings; Task 6 fills them in.
 *
 * Contract with engine.ts (patchMaterial, only for materials patched with `partFx:true`, i.e. atlas parts):
 * - The engine declares, after `#include <common>` and before FX_PARS: `uniform sampler2D tfxState; uniform float tfxWidth;` and `vec4 tfxRow(float row)`, which returns this vertex's part texel for row 0..5 (the layout in part-fx.ts). The atlas's `attribute float partIndex` is declared by scene.tsx.
 * - The engine itself handles visibility (row 0 .x: `visible < 0.5` discards) and tint (row 1: `diffuseColor.rgb = mix(diffuseColor.rgb, tint.rgb, tint.a)` after `#include <color_fragment>`), through the varyings `tfxVisible` and `tfxTint`. FX_PARS / FX_APPLY do the geometry only.
 * - FX_PARS is injected after the engine's declarations. FX_APPLY is injected just before WARP_APPLY, where `transformed` (still equal to `position`, rest space) and `objectNormal` are live; it rewrites both (pivot / rotate / scale / translate, then swell along the normal with the swell band on rest `position.y`). */

/** GLSL declarations (functions; the uniforms are the engine's). */
export const FX_PARS='';
/** GLSL that rewrites `transformed` and `objectNormal` in rest space. */
export const FX_APPLY='';
