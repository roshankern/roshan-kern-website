/** GLSL for the body warp, the shader twin of warp.ts (warpPoint / warpNormal), line for line; scripts/anyhealth-timeline-glsl.ts compiles it headless and checks parity against the TS.
 *
 * Contract with engine.ts (patchMaterial):
 * - WARP_PARS is injected after `#include <common>` in the vertex shader. It declares the uniforms `twJ`, `twA` (w = a thigh's girth at its joint, else 0), `twN`, `twS` (vec4[15]), `twX` (vec4[AXIAL_VEC4], the axial remap), `twGround` and `twSoft` (float), and any functions. It must NOT declare `seg`: the engine does, with TW_SEG_ATTRS.
 * - WARP_APPLY is injected right after FX_APPLY, at a point where both `transformed` (vec3, starts as `position`) and `objectNormal` (vec3) are live and nothing has read them yet. It rewrites both in place.
 * - When WARP_APPLY is non-empty the engine declares the segment attributes with TW_SEG_ATTRS and defines the locals `vec3 twSeg` (segA, segB, weightA 0..1) and `float twD` (rest distance to the nearest bone, metres) just before WARP_APPLY with TW_SEG; read those, not `seg` (atlas parts carry `seg` as the 4 unnormalized segments.bin bytes, custom layers a float `seg` + optional float `segD`, or a fixed-segment define with no attribute).
 * - `objectTangent` is NOT warped: the atlas materials use no normal maps, so no tangent is needed. Add a tangent warp here if one ever is.
 * - `twSoft` is bound per material (1 for muscular / integumentary / connective, and for custom layers created with `soft`); every other uniform comes from warpUniforms() and is shared by every material. */
import * as T from 'three';
import {SEGMENTS} from '../types';
import {D_UNIT,AXIAL_VEC4,AXIAL_SEGMENTS,ROOT_TAPER,type WarpState} from './warp';

/** GLSL declarations: the tw* uniforms and the per-segment point / normal maps. Needs GLSL ES 3.00 (three's WebGL2 programs) for dynamic uniform-array indexing. */
export const WARP_PARS=`
#if __VERSION__ < 300
#error AnyHealth timeline warp needs GLSL ES 3.00 (WebGL2)
#endif
uniform vec4 twJ[${SEGMENTS.length}];
uniform vec4 twA[${SEGMENTS.length}];
uniform vec4 twN[${SEGMENTS.length}];
uniform vec4 twS[${SEGMENTS.length}];
uniform vec4 twX[${AXIAL_VEC4}];
uniform float twGround;
uniform float twSoft;
// Axial remap curves at rest height y (warp.ts axialCurves): f, g, c0, c, f', g', c0', gs.
void twCurves(float y, out float f, out float g, out vec2 c0, out vec2 c, out float fp, out float gp, out vec2 k, out float gs){
	float d = y - twX[0].x;
	f = twX[0].y + twX[0].z * d; g = twX[0].w; gs = twX[12].y; c0 = twX[1].xy + twX[1].zw * d; c = twX[2].xy + twX[2].zw * d; fp = twX[0].z; gp = 0.0; k = twX[1].zw;
	for (int i = 0; i < 3; i++) {
		vec4 A = twX[3 + 3 * i]; vec4 B = twX[4 + 3 * i]; vec4 C = twX[5 + 3 * i];
		float w = A.y; float u = (y - A.x + w) / (2.0 * w); float R = 0.0; float Q = 0.0; float h = 0.0;
		if (u >= 1.0) { R = y - A.x; Q = y - A.x - ${(9/35).toFixed(9)} * w; h = 1.0; }
		else if (u > 0.0) { float u2 = u * u; float u3 = u2 * u; R = 2.0 * w * (u3 - 0.5 * u3 * u); Q = 2.0 * w * u3 * u2 * (1.8 - 2.0 * u + ${(4/7).toFixed(9)} * u2); h = u2 * (3.0 - 2.0 * u); }
		float wg = C.w; float ug = clamp((y - C.z + wg) / (2.0 * wg), 0.0, 1.0); float hg = ug * ug * (3.0 - 2.0 * ug);
		f += A.z * R; g += A.w * hg; gs += twX[13][i] * hg; gp += A.w * 3.0 * ug * (1.0 - ug) / wg;
		c0 += B.xy * R; c += B.zw * R + C.xy * Q; fp += A.z * h; k += B.xy * h;
	}
}
// A limb's perpendicular scale and its t-derivative (warp.ts rootGirth): twS.y, or on a tapered limb root (the thighs, twA.w > 0) the taper from the remap's g at the joint to twS.y over ROOT_TAPER.
vec2 twGirth(int i, float t){
	if (!(twA[i].w > 0.0)) return vec2(twS[i].y, 0.0);
	float w = ${(ROOT_TAPER[1]-ROOT_TAPER[0]).toFixed(6)}; float u = clamp((t - ${ROOT_TAPER[0].toFixed(6)}) / w, 0.0, 1.0);
	return vec2(twA[i].w + (twS[i].y - twA[i].w) * u * u * (3.0 - 2.0 * u), (twS[i].y - twA[i].w) * 6.0 * u * (1.0 - u) / w);
}
vec3 twPoint(int i, vec3 p){
	if (i < ${AXIAL_SEGMENTS}) { float f; float g; vec2 c0; vec2 c; float fp; float gp; vec2 k; float gs; twCurves(p.y, f, g, c0, c, fp, gp, k, gs); return vec3(c.x + g * (p.x - c0.x), f, c.y + g * (p.z - c0.y)); }
	vec3 ax = twA[i].xyz; vec3 d = p - twJ[i].xyz; float t = dot(d, ax); vec2 gE = twGirth(i, t);
	return twN[i].xyz + twS[i].x * t * ax + gE.x * (d - t * ax);
}
vec3 twNormal(int i, vec3 p, vec3 n){
	if (i < ${AXIAL_SEGMENTS}) { float f; float g; vec2 c0; vec2 c; float fp; float gp; vec2 k; float gs; twCurves(p.y, f, g, c0, c, fp, gp, k, gs);
		float A = k.x * (fp - g) + gp * (p.x - c0.x); float B = k.y * (fp - g) + gp * (p.z - c0.y);
		return vec3(n.x / g, (n.y - (A * n.x + B * n.z) / g) / fp, n.z / g); }
	vec3 ax = twA[i].xyz; float t = dot(n, ax); vec3 d = p - twJ[i].xyz; float tp = dot(d, ax); vec2 gE = twGirth(i, tp); float rn = dot(d - tp * ax, n);
	return ((t - gE.y * rn / gE.x) / twS[i].x) * ax + (1.0 / gE.x) * (n - t * ax);
}
vec3 twInflate(int i, vec3 p, float w, float dBone){
	if (i < ${AXIAL_SEGMENTS}) { float f; float g; vec2 c0; vec2 c; float fp; float gp; vec2 k; float gs; twCurves(p.y, f, g, c0, c, fp, gp, k, gs);
		vec2 r = p.xz - c0; float m = w * max(0.0, gs - g) * min(1.0, dBone / max(length(r), 1e-9)); return vec3(m * r.x, 0.0, m * r.y); }
	vec3 ax = twA[i].xyz; vec3 d = p - twJ[i].xyz; vec3 r = d - dot(d, ax) * ax;
	return (w * (twS[i].z - twS[i].y) * min(1.0, dBone / max(length(r), 1e-9))) * r;
}
`;
/** GLSL declaring the segment attributes (engine, after `#include <common>`): none under `TW_FIXED_SEG`; the atlas's `vec4 seg` = the 4 segments.bin bytes, not normalized, under `TW_SEG_BYTES`; else a float `vec3 seg` (segA, segB, weightA), plus `float segD` (bone distance, metres) only under `TW_SEG_D` (layers created with `segD`; without it twD is 0: no inflation). */
export const TW_SEG_ATTRS=`#if defined(TW_FIXED_SEG)
#elif defined(TW_SEG_BYTES)
attribute vec4 seg;
#else
attribute vec3 seg;
#ifdef TW_SEG_D
attribute float segD;
#endif
#endif`;
/** GLSL that defines the locals `vec3 twSeg` (segA, segB, weightA 0..1) and `float twD` (bone distance, metres) just before WARP_APPLY, from (in order): the material's `TW_FIXED_SEG` define (custom layers with one segment, no inflation); the atlas's byte `seg` = (segA | segB<<4, round(weightA·255), dBone low, high byte) under `TW_SEG_BYTES`; else the float `seg`, and `segD` under `TW_SEG_D` (0 otherwise). */
export const TW_SEG=`#if defined(TW_FIXED_SEG)
vec3 twSeg = vec3(float(TW_FIXED_SEG), float(TW_FIXED_SEG), 1.0); float twD = 0.0;
#elif defined(TW_SEG_BYTES)
float twHi = floor(seg.x * (1.0 / 16.0));
vec3 twSeg = vec3(seg.x - 16.0 * twHi, twHi, seg.y * (1.0 / 255.0)); float twD = (seg.z + 256.0 * seg.w) * ${D_UNIT.toExponential(6)};
#else
vec3 twSeg = seg;
#ifdef TW_SEG_D
float twD = segD;
#else
float twD = 0.0;
#endif
#endif`;
/** GLSL that rewrites `transformed` and `objectNormal` (rest space → this date's body), reading the engine's `vec3 twSeg` = (segA, segB, weightA) and `float twD`. */
export const WARP_APPLY=`
{
	int twIa = int(twSeg.x + 0.5); int twIb = int(twSeg.y + 0.5); float twW = twSeg.z;
	vec3 twP = twPoint(twIa, transformed); vec3 twM = twW * twNormal(twIa, transformed, objectNormal); vec3 twI = vec3(0.0);
	if (twSoft > 0.5 && twD > 0.0) twI = twInflate(twIa, transformed, twW, twD);
	if (twW < 1.0) { twP = twW * twP + (1.0 - twW) * twPoint(twIb, transformed); twM += (1.0 - twW) * twNormal(twIb, transformed, objectNormal); if (twSoft > 0.5 && twD > 0.0) twI += twInflate(twIb, transformed, 1.0 - twW, twD); }
	transformed = twP + twI + vec3(0.0, twGround, 0.0);
	objectNormal = twM * inversesqrt(max(dot(twM, twM), 1e-20));
}
`;

/** Uniform objects, shared by every material: twJ = (restJoint, 0), twA = (axis, a thigh's girth at its joint or 0), twN = (newJoint, 0), twS = (along, bone, soft, 0) per segment, twX = WarpState.axial as vec4s, and twGround. */
export function warpUniforms():Record<string,{value:unknown}>{
	const vs=()=>SEGMENTS.map(()=>new T.Vector4());
	return {twJ:{value:vs()},twA:{value:vs()},twN:{value:vs()},twS:{value:vs()},twX:{value:Array.from({length:AXIAL_VEC4},()=>new T.Vector4())},twGround:{value:0}};
}

/** Copy a WarpState into the uniform objects from warpUniforms(). */
export function writeWarpUniforms(u:ReturnType<typeof warpUniforms>,ws:WarpState):void{
	const J=u.twJ.value as T.Vector4[],A=u.twA.value as T.Vector4[],N=u.twN.value as T.Vector4[],S=u.twS.value as T.Vector4[];
	for(let i=0;i<SEGMENTS.length;i++){
		J[i].set(ws.restJoint[i*3],ws.restJoint[i*3+1],ws.restJoint[i*3+2],0);A[i].set(ws.axis[i*3],ws.axis[i*3+1],ws.axis[i*3+2],ws.rootGirth[i]);
		N[i].set(ws.newJoint[i*3],ws.newJoint[i*3+1],ws.newJoint[i*3+2],0);S[i].set(ws.alongScale[i],ws.boneScale[i],ws.softScale[i],0);
	}
	const X=u.twX.value as T.Vector4[];for(let i=0;i<AXIAL_VEC4;i++)X[i].fromArray(ws.axial,i*4);
	u.twGround.value=ws.ground;
}
