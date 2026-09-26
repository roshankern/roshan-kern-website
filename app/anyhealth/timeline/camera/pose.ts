/** Timeline camera math (spec 2026-09-26 §4), pure and node-checkable (three.js math only); atlas/scene.tsx uses it in timeline mode.
 *  A Pose is what the scene sets on the camera: orbit target, camera position, and the view offset (CSS px) that centres the framed box in the open area.
 *  - Growth framing: scalePose(adult, stature(day)/stature(today)) about the floor origin; the body grows about it too, so its projected height stays put.
 *  - Posed path: lerpPose interpolates target linearly, distance geometrically, direction by slerp and the offset linearly, so a zoom is uniform in perceived scale. */
import * as T from 'three';
import type {Rig,Vec3} from '../types';
import {makeGrowth} from '../../health/growth';
import {fromDays,toDays} from '../../health/dates';
import {BIRTH_DATE,type GrowthPoint} from '../../health/types';
import {LAST_MEASURED} from '../growth/proportions';
import growthJson from '../../health/growth.json';
import rigJson from '../growth/rig.json';
import {FOCUS_MARGIN} from '../director/types';

export interface Pose {target:Vec3;position:Vec3;ox:number;oy:number}
/** The screen area left for the anatomy (scene.tsx openArea): canvas size and the open rect, CSS px. */
export interface Open {w:number;h:number;left:number;right:number;top:number;bottom:number}
export interface Box {min:Vec3;max:Vec3}

/** C² ease: 0 at x ≤ e0, 1 at x ≥ e1. */
export const smootherstep=(e0:number,e1:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*t*(t*(t*6-15)+10);};
const dist=(p:Pose)=>Math.hypot(p.position[0]-p.target[0],p.position[1]-p.target[1],p.position[2]-p.target[2]);

/** Target and position scaled by `s` about the world origin (the floor centre); the view offset is unchanged. */
export const scalePose=(p:Pose,s:number):Pose=>({target:[p.target[0]*s,p.target[1]*s,p.target[2]*s],position:[p.position[0]*s,p.position[1]*s,p.position[2]*s],ox:p.ox,oy:p.oy});

const va=new T.Vector3(),vb=new T.Vector3(),axis=new T.Vector3(),q=new T.Quaternion();
/** The posed path at t ∈ [0,1]: target lerp, distance a.d^(1−t)·b.d^t, direction (target → camera) slerp, offsets lerp. Endpoints are returned exactly. */
export function lerpPose(a:Pose,b:Pose,t:number):Pose{
	if(t<=0)return {target:[...a.target],position:[...a.position],ox:a.ox,oy:a.oy};
	if(t>=1)return {target:[...b.target],position:[...b.position],ox:b.ox,oy:b.oy};
	const da=Math.max(1e-9,dist(a)),db=Math.max(1e-9,dist(b)),d=da*Math.pow(db/da,t);
	va.set(a.position[0]-a.target[0],a.position[1]-a.target[1],a.position[2]-a.target[2]).divideScalar(da);
	vb.set(b.position[0]-b.target[0],b.position[1]-b.target[1],b.position[2]-b.target[2]).divideScalar(db);
	// Slerp as a rotation of a's direction about a × b by t·θ; opposite directions turn about a horizontal axis (never through the poles).
	const angle=Math.acos(Math.min(1,Math.max(-1,va.dot(vb))));axis.crossVectors(va,vb);
	if(axis.lengthSq()<1e-12){axis.set(-va.z,0,va.x);if(axis.lengthSq()<1e-12)axis.set(1,0,0);}
	va.applyQuaternion(q.setFromAxisAngle(axis.normalize(),angle*t));
	const L=(x:number,y:number)=>x+(y-x)*t,target:Vec3=[L(a.target[0],b.target[0]),L(a.target[1],b.target[1]),L(a.target[2],b.target[2])];
	return {target,position:[target[0]+va.x*d,target[1]+va.y*d,target[2]+va.z*d],ox:L(a.ox,b.ox),oy:L(a.oy,b.oy)};
}

/** A conservative first estimate of the camera distance (to the box centre) at which a box of `size` fits the open area × 1/margin, from any yaw: the height against the open height, the horizontal diagonal against the open width, plus the half diagonal for the near side. fitPose refines it on the projection. */
export function fitDistance(size:Vec3,fovDeg:number,aspect:number,open:Open,margin=1):number{
	const tan=Math.tan(T.MathUtils.degToRad(fovDeg/2)),aW=Math.max(1,open.right-open.left),aH=Math.max(1,open.bottom-open.top);
	return margin*Math.max(size[1]*open.h/aH/(2*tan),Math.hypot(size[0],size[2])*open.w/aW/(2*tan*aspect))+Math.hypot(...size)/2;
}

const corners=(b:Box)=>Array.from({length:8},(_,k)=>new T.Vector3(k&1?b.max[0]:b.min[0],k&2?b.max[1]:b.min[1],k&4?b.max[2]:b.min[2]));
const probe=new T.PerspectiveCamera(),pp=new T.Vector3();
/** Screen rect (CSS px, view offset applied) of a box's corners seen from `pose` on a w×h canvas; null when a corner is behind the camera. */
export function projectBox(box:Box,pose:Pose,fovDeg:number,w:number,h:number):{x0:number;x1:number;y0:number;y1:number}|null{
	probe.fov=fovDeg;probe.aspect=w/h;probe.near=.005;probe.far=100;probe.position.fromArray(pose.position);probe.lookAt(pp.fromArray(pose.target));probe.updateMatrixWorld();
	if(pose.ox||pose.oy)probe.setViewOffset(w,h,pose.ox,pose.oy,w,h);else probe.clearViewOffset();probe.updateProjectionMatrix();
	let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
	for(const c of corners(box)){if(pp.copy(c).applyMatrix4(probe.matrixWorldInverse).z>=-probe.near)return null;pp.copy(c).project(probe);const sx=(pp.x+1)*w/2,sy=(1-pp.y)*h/2;x0=Math.min(x0,sx);x1=Math.max(x1,sx);y0=Math.min(y0,sy);y1=Math.max(y1,sy);}
	return {x0,x1,y0,y1};
}
/** Projected height (CSS px) of a box from `pose`. */
export const projectedHeight=(box:Box,pose:Pose,fovDeg:number,w:number,h:number)=>{const r=projectBox(box,pose,fovDeg,w,h);return r?r.y1-r.y0:NaN;};

/** Frame a box from unit direction `dir` (target → camera): the target is the box centre, the distance scales until the projected corners fill `fill` of the open rect's width or height (whichever binds; at least minDistance), and the view offset centres the projection in the open rect. */
export function fitPose(box:Box,dir:Vec3,fovDeg:number,open:Open,fill:number,minDistance=0):Pose{
	const {w,h,left,right,top,bottom}=open,aW=Math.max(1,right-left),aH=Math.max(1,bottom-top),c:Vec3=[(box.min[0]+box.max[0])/2,(box.min[1]+box.max[1])/2,(box.min[2]+box.max[2])/2];
	const n=Math.hypot(...dir)||1,u:Vec3=[dir[0]/n,dir[1]/n,dir[2]/n],size:Vec3=[box.max[0]-box.min[0],box.max[1]-box.min[1],box.max[2]-box.min[2]];
	const at=(d:number):Pose=>({target:c,position:[c[0]+u[0]*d,c[1]+u[1]*d,c[2]+u[2]*d],ox:0,oy:0});
	let d=Math.max(minDistance,fitDistance(size,fovDeg,w/h,open,1/fill)),r=projectBox(box,at(d),fovDeg,w,h);
	for(let k=0;k<8;k++){
		if(!r){d*=2;r=projectBox(box,at(d),fovDeg,w,h);continue;}
		const next=Math.max(minDistance,d*Math.max((r.x1-r.x0)/(aW*fill),(r.y1-r.y0)/(aH*fill)));if(Math.abs(next-d)<=d*1e-6)break;
		const rn=projectBox(box,at(next),fovDeg,w,h);if(!rn)break;d=next;r=rn;
	}
	return r?{...at(d),ox:(r.x0+r.x1)/2-(left+right)/2,oy:(r.y0+r.y1)/2-(top+bottom)/2}:at(d);
}

// Stature by fractional day: bodyAt's statureM (the measured height, clamped to [birth, last measurement]), interpolated between whole days so growth zoom is smooth.
const growth=makeGrowth(growthJson as GrowthPoint[]),BIRTH=toDays(BIRTH_DATE),LAST=toDays(LAST_MEASURED),REST=(rigJson as Rig).stature,memo=new Map<number,number>();
const statureOn=(days:number)=>{let s=memo.get(days);if(s===undefined){if(memo.size>4096)memo.clear();s=(growth.heightAt(fromDays(Math.min(Math.max(days,BIRTH),LAST)))??REST*100)/100;memo.set(days,s);}return s;};
/** Stature (m) at fractional `day` since BIRTH_DATE: bodyAt(date).statureM at whole days, linear between. */
export function statureAt(day:number):number{const d=BIRTH+day,f=Math.floor(d),a=statureOn(f);return d===f?a:a+(statureOn(f+1)-a)*(d-f);}
/** Fractional days since BIRTH_DATE of an ISO date. */
export const dayOfDate=(iso:string)=>toDays(iso)-BIRTH;

/** The default view direction (target → camera): the slightly tilted three-quarter view (scene.tsx fitDirection). */
export const DEFAULT_DIRECTION:Vec3=[.35,.06,1];
/** The default pose fits the body to this share of the open area (scene.tsx defaultPose's .98). */
export const DEFAULT_FILL=.98;
/** The adult default pose: the rest body box (atlas bounds: the adult model, feet at y = 0) scaled to today's stature about the origin, fitted from DEFAULT_DIRECTION. */
export function adultPose(restBody:Box,todayDay:number,fovDeg:number,open:Open):Pose{
	const s=statureAt(todayDay)/REST,box:Box={min:restBody.min.map(v=>v*s) as Vec3,max:restBody.max.map(v=>v*s) as Vec3};
	return fitPose(box,DEFAULT_DIRECTION,fovDeg,open,DEFAULT_FILL);
}
/** Growth framing: the adult pose scaled about the floor origin by stature(day)/stature(today). */
export const defaultPoseFor=(adult:Pose,day:number,todayDay:number)=>scalePose(adult,statureAt(day)/statureAt(todayDay));
/** A stop's focus pose: the focus box × FOCUS_MARGIN fitted in the open area from `view` (default: DEFAULT_DIRECTION), at least minDistance away. */
export const focusPose=(box:Box,view:Vec3|null|undefined,fovDeg:number,open:Open,minDistance=0)=>fitPose(box,view??DEFAULT_DIRECTION,fovDeg,open,1/FOCUS_MARGIN,minDistance);
