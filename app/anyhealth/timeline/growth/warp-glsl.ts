/** GLSL for the body warp, the shader twin of warp.ts. Stub from Task 3: empty strings; Task 6 fills them in.
 *
 * Contract with engine.ts (patchMaterial):
 * - WARP_PARS is injected after `#include <common>` in the vertex shader. It declares the uniforms `twJ`, `twA`, `twN`, `twS` (vec4[15]), `twGround` and `twSoft` (float), and any functions. It must NOT declare `seg`: the engine does.
 * - WARP_APPLY is injected right after FX_APPLY, at a point where both `transformed` (vec3, starts as `position`) and `objectNormal` (vec3) are live and nothing has read them yet. It rewrites both in place.
 * - When WARP_APPLY is non-empty the engine declares `attribute vec3 seg;` and defines a local `vec3 twSeg` (segA, segB, weightA 0..1) just before WARP_APPLY; read `twSeg`, not `seg` (custom layers with a fixed segment get `twSeg` from a define, with no attribute).
 * - `twSoft` is bound per material (1 for muscular / integumentary / connective, and for custom layers created with `soft`); every other uniform comes from warpUniforms() and is shared by every material. */
import * as T from 'three';
import {SEGMENTS} from '../types';
import type {WarpState} from './warp';

/** GLSL declarations (uniforms + function). */
export const WARP_PARS='';
/** GLSL that rewrites `transformed` and `objectNormal`; see Task 6. */
export const WARP_APPLY='';

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
