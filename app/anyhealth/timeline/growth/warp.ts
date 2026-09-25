/** Body warp: moves rest-pose points to the body's proportions on a date, per rig segment (see docs/superpowers/plans/2026-09-25-anyhealth-timeline.md, Task 6, for the math). Stub from Task 3: identity; Task 6 implements it. The GLSL twin is warp-glsl.ts. */
import {SEGMENTS,type Body,type Rig,type Vec3} from '../types';

export interface WarpState {/** per segment, index = SEGMENTS order */ restJoint:Float32Array;axis:Float32Array;newJoint:Float32Array;alongScale:Float32Array;boneScale:Float32Array;softScale:Float32Array;/** y shift to keep the feet on the floor */ ground:number}

/** Per-segment warp parameters for one body. Stub: new joints = rest joints, every scale 1, no ground shift. */
export function warpState(rig:Rig,body:Body):WarpState{
	void body;const n=SEGMENTS.length,restJoint=new Float32Array(n*3),axis=new Float32Array(n*3);
	SEGMENTS.forEach((id,i)=>{const s=rig.segments.find(x=>x.id===id);if(!s)throw new Error(`rig has no segment ${id}`);restJoint.set(s.joint,i*3);axis.set(s.axis,i*3);});
	return {restJoint,axis,newJoint:restJoint.slice(),alongScale:new Float32Array(n).fill(1),boneScale:new Float32Array(n).fill(1),softScale:new Float32Array(n).fill(1),ground:0};
}

/** Warp one rest-space point with blend weights (segA with weight wA, segB with 1-wA); `soft` picks the soft-tissue girth. Writes and returns `out` (which may be `p`). Stub: identity. */
export function warpPoint(ws:WarpState,p:Vec3,segA:number,segB:number,wA:number,soft:boolean,out:Vec3):Vec3{
	void ws;void segA;void segB;void wA;void soft;out[0]=p[0];out[1]=p[1];out[2]=p[2];return out;
}
