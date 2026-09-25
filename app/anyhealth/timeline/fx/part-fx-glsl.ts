/** GLSL for per-part effects, the shader twin of applyFxPoint in part-fx.ts, line for line; scripts/anyhealth-timeline-glsl.ts compiles it headless and checks parity against the TS.
 *
 * Contract with engine.ts (patchMaterial, only for materials patched with `partFx:true`, i.e. atlas parts):
 * - The engine declares, after `#include <common>` and before FX_PARS: `uniform sampler2D tfxState; uniform float tfxWidth;` and `vec4 tfxRow(float row)`, which returns this vertex's part texel for row 0..5 (the layout in part-fx.ts). The atlas's `attribute float partIndex` is declared by scene.tsx.
 * - The engine itself handles visibility (row 0 .x: `visible < 0.5` discards) and tint (row 1: `diffuseColor.rgb = mix(diffuseColor.rgb, tint.rgb, tint.a)` after `#include <color_fragment>`), through the varyings `tfxVisible` and `tfxTint`. FX_PARS / FX_APPLY do the geometry only.
 * - FX_PARS is injected after the engine's declarations. FX_APPLY is injected just before WARP_APPLY, where `transformed` (still equal to `position`, rest space) and `objectNormal` are live; it rewrites both (pivot / rotate / scale / translate, then swell along the normal with the swell band on rest `position.y`). */
import {SWELL_EDGE} from './part-fx';

/** GLSL declarations (functions; the uniforms and tfxRow are the engine's). */
export const FX_PARS=`
vec3 tfxRotate(vec4 q, vec3 v){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
float tfxBand(vec2 band, float y){
	if (band.x == 0.0 && band.y == 0.0) return 1.0;
	return smoothstep(band.x - ${SWELL_EDGE.toFixed(4)}, band.x, y) * (1.0 - smoothstep(band.y, band.y + ${SWELL_EDGE.toFixed(4)}, y));
}
`;
/** GLSL that rewrites `transformed` and `objectNormal` in rest space: pivot / rotate / scale / translate, then swell along the effect's normal, weighted by the swell band on rest y. */
export const FX_APPLY=`
{
	vec4 tfx0 = tfxRow(0.0); vec3 tfxC = tfxRow(2.0).xyz; vec4 tfxQ = tfxRow(3.0); vec3 tfxS = tfxRow(4.0).xyz; vec3 tfxT = tfxRow(5.0).xyz;
	float tfxK = tfx0.y * tfxBand(tfx0.zw, transformed.y);
	vec3 tfxM = tfxRotate(tfxQ, objectNormal / max(tfxS, vec3(1e-6))); tfxM *= inversesqrt(max(dot(tfxM, tfxM), 1e-20));
	transformed = tfxRotate(tfxQ, tfxS * (transformed - tfxC)) + tfxC + tfxT + tfxM * tfxK;
	objectNormal = tfxM;
}
`;
