/** Body warp: moves rest-pose points to the body's proportions on a date, per rig segment (linear-blend skinning of per-segment affine maps). The GLSL twin is warp-glsl.ts and must stay line for line with this file (scripts/anyhealth-timeline-glsl.ts checks parity).
 *
 * Segment i (SEGMENTS order): rest joint J_i, unit axis a_i, global scale S = body.scale, along factor ℓ_i = body.length, perpendicular factor γ_i = body.softGirth (soft tissue) or body.boneGirth.
 *   T_i(p) = N_i + S·(ℓ_i (d·a_i) a_i + γ_i (d − (d·a_i) a_i)),  d = p − J_i
 *   N_trunk = S·J_trunk (scale about the origin); N_i = T_parent(J_i) with the parent's BONE girth, so every child stays attached at its joint.
 *   p' = wA·T_segA(p) + (1 − wA)·T_segB(p), then p'.y += ground.
 *   ground = −(lowest warped sole point): the four points under each ankle and each toe tip on the rest floor (y = 0), warped by their foot segment with both the bone and the soft girth (the skin of the sole is what touches the floor).
 *   Normal: n' = normalize(wA·M_A n + (1 − wA)·M_B n), M_i = (1/ℓ_i) a aᵀ + (1/γ_i)(I − a aᵀ) (the inverse transpose of T_i's linear part, up to S). */
import {SEGMENTS,type Body,type Rig,type Vec3} from '../types';

export interface WarpState {/** per segment, index = SEGMENTS order */ restJoint:Float32Array;axis:Float32Array;newJoint:Float32Array;/** S·ℓ_i */ alongScale:Float32Array;/** S·γ_i (bone) */ boneScale:Float32Array;/** S·γ_i (soft) */ softScale:Float32Array;/** y shift to keep the feet on the floor */ ground:number}

/** T_i(p) without the ground shift, `girth` = the absolute perpendicular scale (S·γ). Writes out[0..2]; p may alias out. */
function segPoint(ws:WarpState,i:number,girth:number,x:number,y:number,z:number,out:number[]|Vec3){
	const k=i*3,ax=ws.axis[k],ay=ws.axis[k+1],az=ws.axis[k+2],dx=x-ws.restJoint[k],dy=y-ws.restJoint[k+1],dz=z-ws.restJoint[k+2],t=dx*ax+dy*ay+dz*az,al=ws.alongScale[i];
	out[0]=ws.newJoint[k]+al*t*ax+girth*(dx-t*ax);out[1]=ws.newJoint[k+1]+al*t*ay+girth*(dy-t*ay);out[2]=ws.newJoint[k+2]+al*t*az+girth*(dz-t*az);
}

/** Per-segment warp parameters for one body: absolute scales, new joints (parents first) and the floor shift. */
export function warpState(rig:Rig,body:Body):WarpState{
	const n=SEGMENTS.length,S=body.scale,ws:WarpState={restJoint:new Float32Array(n*3),axis:new Float32Array(n*3),newJoint:new Float32Array(n*3),alongScale:new Float32Array(n),boneScale:new Float32Array(n),softScale:new Float32Array(n),ground:0};
	const segs=SEGMENTS.map(id=>{const s=rig.segments.find(x=>x.id===id);if(!s)throw new Error(`rig has no segment ${id}`);return s;});
	segs.forEach((s,i)=>{const al=Math.hypot(...s.axis);ws.restJoint.set(s.joint,i*3);ws.axis.set(s.axis.map(v=>v/al),i*3);ws.alongScale[i]=S*body.length[s.id];ws.boneScale[i]=S*body.boneGirth[s.id];ws.softScale[i]=S*body.softGirth[s.id];});
	const q=[0,0,0];
	segs.forEach((s,i)=>{
		if(!s.parent){ws.newJoint.set([S*ws.restJoint[i*3],S*ws.restJoint[i*3+1],S*ws.restJoint[i*3+2]],i*3);return;}
		const p=SEGMENTS.indexOf(s.parent);if(p>=i)throw new Error(`rig parent ${s.parent} after ${s.id}`);
		segPoint(ws,p,ws.boneScale[p],ws.restJoint[i*3],ws.restJoint[i*3+1],ws.restJoint[i*3+2],q);ws.newJoint.set(q,i*3);
	});
	let lo=Infinity;
	for(const id of ['lFoot','rFoot'] as const){
		const i=SEGMENTS.indexOf(id),k=i*3,len=segs[i].length,J=ws.restJoint,A=ws.axis;
		for(const [x,z] of [[J[k],J[k+2]],[J[k]+A[k]*len,J[k+2]+A[k+2]*len]])for(const g of [ws.boneScale[i],ws.softScale[i]]){segPoint(ws,i,g,x,0,z,q);lo=Math.min(lo,q[1]);}
	}
	ws.ground=-lo;return ws;
}

/** Warp one rest-space point with blend weights (segA with weight wA, segB with 1-wA); `soft` picks the soft-tissue girth. Writes and returns `out` (which may be `p`). */
export function warpPoint(ws:WarpState,p:Vec3,segA:number,segB:number,wA:number,soft:boolean,out:Vec3):Vec3{
	const g=soft?ws.softScale:ws.boneScale,x=p[0],y=p[1],z=p[2];
	segPoint(ws,segA,g[segA],x,y,z,out);
	if(wA<1){const ax=out[0],ay=out[1],az=out[2];segPoint(ws,segB,g[segB],x,y,z,out);out[0]=wA*ax+(1-wA)*out[0];out[1]=wA*ay+(1-wA)*out[1];out[2]=wA*az+(1-wA)*out[2];}
	out[1]+=ws.ground;return out;
}

/** Warp one rest-space normal the same way (inverse-transpose per segment, blended, normalized). Writes and returns `out` (which may be `n`). */
export function warpNormal(ws:WarpState,n:Vec3,segA:number,segB:number,wA:number,soft:boolean,out:Vec3):Vec3{
	const g=soft?ws.softScale:ws.boneScale,x=n[0],y=n[1],z=n[2];let rx=0,ry=0,rz=0;
	const add=(i:number,w:number)=>{const k=i*3,ax=ws.axis[k],ay=ws.axis[k+1],az=ws.axis[k+2],t=x*ax+y*ay+z*az,ia=1/ws.alongScale[i],ig=1/g[i];rx+=w*(ia*t*ax+ig*(x-t*ax));ry+=w*(ia*t*ay+ig*(y-t*ay));rz+=w*(ia*t*az+ig*(z-t*az));};
	add(segA,wA);if(wA<1)add(segB,1-wA);
	const il=1/Math.sqrt(Math.max(rx*rx+ry*ry+rz*rz,1e-20));out[0]=rx*il;out[1]=ry*il;out[2]=rz*il;return out;
}
