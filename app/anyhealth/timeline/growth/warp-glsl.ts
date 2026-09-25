/** GLSL for the body warp, the shader twin of warp.ts (warpPoint / warpNormal), line for line; scripts/anyhealth-timeline-glsl.ts compiles it headless and checks parity against the TS.
 *
 * Contract with engine.ts (patchMaterial):
 * - WARP_PARS is injected after `#include <common>` in the vertex shader. It declares the uniforms `twJ`, `twA`, `twN`, `twS` (vec4[15]), `twGround` and `twSoft` (float), and any functions. It must NOT declare `seg`: the engine does.
 * - WARP_APPLY is injected right after FX_APPLY, at a point where both `transformed` (vec3, starts as `position`) and `objectNormal` (vec3) are live and nothing has read them yet. It rewrites both in place.
 * - When WARP_APPLY is non-empty the engine declares `attribute vec3 seg;` and defines a local `vec3 twSeg` (segA, segB, weightA 0..1) just before WARP_APPLY; read `twSeg`, not `seg` (custom layers with a fixed segment get `twSeg` from a define, with no attribute).
 * - `twSoft` is bound per material (1 for muscular / integumentary / connective, and for custom layers created with `soft`); every other uniform comes from warpUniforms() and is shared by every material. */
import * as T from 'three';
import {SEGMENTS} from '../types';
import type {WarpState} from './warp';

/** GLSL declarations: the tw* uniforms and the per-segment point / normal maps. Needs GLSL ES 3.00 (three's WebGL2 programs) for dynamic uniform-array indexing. */
export const WARP_PARS=`
#if __VERSION__ < 300
#error AnyHealth timeline warp needs GLSL ES 3.00 (WebGL2)
#endif
uniform vec4 twJ[${SEGMENTS.length}];
uniform vec4 twA[${SEGMENTS.length}];
uniform vec4 twN[${SEGMENTS.length}];
uniform vec4 twS[${SEGMENTS.length}];
uniform float twGround;
uniform float twSoft;
float twGirth(int i){ return mix(twS[i].y, twS[i].z, twSoft); }
vec3 twPoint(int i, vec3 p){
	vec3 ax = twA[i].xyz; vec3 d = p - twJ[i].xyz; float t = dot(d, ax);
	return twN[i].xyz + twS[i].x * t * ax + twGirth(i) * (d - t * ax);
}
vec3 twNormal(int i, vec3 n){
	vec3 ax = twA[i].xyz; float t = dot(n, ax);
	return (1.0 / twS[i].x) * t * ax + (1.0 / twGirth(i)) * (n - t * ax);
}
`;
/** GLSL that rewrites `transformed` and `objectNormal` (rest space → this date's body), reading the engine's `vec3 twSeg` = (segA, segB, weightA). */
export const WARP_APPLY=`
{
	int twIa = int(twSeg.x + 0.5); int twIb = int(twSeg.y + 0.5); float twW = twSeg.z;
	vec3 twP = twPoint(twIa, transformed); vec3 twM = twW * twNormal(twIa, objectNormal);
	if (twW < 1.0) { twP = twW * twP + (1.0 - twW) * twPoint(twIb, transformed); twM += (1.0 - twW) * twNormal(twIb, objectNormal); }
	transformed = twP + vec3(0.0, twGround, 0.0);
	objectNormal = twM * inversesqrt(max(dot(twM, twM), 1e-20));
}
`;

/** Uniform objects, shared by every material: twJ = (restJoint, 0), twA = (axis, 0), twN = (newJoint, 0), twS = (along, bone, soft, 0) per segment, and twGround. */
export function warpUniforms():Record<string,{value:unknown}>{
	const vs=()=>SEGMENTS.map(()=>new T.Vector4());
	return {twJ:{value:vs()},twA:{value:vs()},twN:{value:vs()},twS:{value:vs()},twGround:{value:0}};
}

/** Copy a WarpState into the uniform objects from warpUniforms(). */
export function writeWarpUniforms(u:ReturnType<typeof warpUniforms>,ws:WarpState):void{
	const J=u.twJ.value as T.Vector4[],A=u.twA.value as T.Vector4[],N=u.twN.value as T.Vector4[],S=u.twS.value as T.Vector4[];
	for(let i=0;i<SEGMENTS.length;i++){
		J[i].set(ws.restJoint[i*3],ws.restJoint[i*3+1],ws.restJoint[i*3+2],0);A[i].set(ws.axis[i*3],ws.axis[i*3+1],ws.axis[i*3+2],0);
		N[i].set(ws.newJoint[i*3],ws.newJoint[i*3+1],ws.newJoint[i*3+2],0);S[i].set(ws.alongScale[i],ws.boneScale[i],ws.softScale[i],0);
	}
	u.twGround.value=ws.ground;
}
