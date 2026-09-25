/** Upper-thoracic scoliosis as part effects: T1–T6 and their disks shift sideways (to the left, the classic side of a proximal thoracic curve) along a smooth arc (apex between T3 and T4), tilt with the arc and turn axially toward the convexity; ribs 1–6 follow their vertebra's shift. It develops from 2020 to the 2025-07-08 record and then holds (chronic). The record has no imaging, so the angle, side and apex are typical values (see docs/anyhealth/timeline-medical-basis/bones.md). */
import type {PartFx,Quat} from '../../types';
import {toDays} from '../../../health/dates';

/** One thoracic level: vertebra and the disk below it, with the rest bounds centre (x, y, z) of the vertebra and y of the disk (atlas.json, checked in bones.check.ts). */
export interface SpineLevel {vertebra:string;disk:string;x:number;y:number;z:number;diskY:number}
const ORD=['first','second','third','fourth','fifth','sixth'],Ord=ORD.map(o=>o[0].toUpperCase()+o.slice(1));
const REST:[number,number,number,number][]=// [vertebra x, vertebra y, vertebra z, disk y], metres (model geometry, not medical)
[[-.0007,1.4402,-.048,1.4264],[-.0007,1.4216,-.0526,1.4063],[-.0006,1.4002,-.061,1.3852],[-.0006,1.3777,-.0651,1.3628],[-.0006,1.3466,-.067,1.3379],[-.0007,1.3173,-.0668,1.3112]];
/** T1–T6, top to bottom. */
export const SCOLIOSIS_LEVELS:SpineLevel[]=ORD.map((o,i)=>({vertebra:`${Ord[i]} thoracic vertebra`,disk:`Intervertebral disk of ${o} thoracic vertebra`,x:REST[i][0],y:REST[i][1],z:REST[i][2],diskY:REST[i][3]}));
/** Ribs 1–6, paired with T1–T6. */
export const SCOLIOSIS_RIBS=ORD.map(o=>({left:`Left ${o} rib`,right:`Right ${o} rib`}));
/** Every part the scoliosis moves (the script's `parts`). */
export const SCOLIOSIS_PARTS=[...SCOLIOSIS_LEVELS.flatMap(l=>[l.vertebra,l.disk]),...SCOLIOSIS_RIBS.flatMap(r=>[r.left,r.right])];

export const SCOLIOSIS_RECORD='2025-07-08';
/** The curve starts to form here (after the 2019–2020 "mild asymmetry" note) and reaches its full size on the record date. */
export const SCOLIOSIS_START='2020-01-01'; // basis: bones#scoliosis-development
/** Days from SCOLIOSIS_START to the record (the script's lead before onset). */
export const SCOLIOSIS_LEAD_DAYS=toDays(SCOLIOSIS_RECORD)-toDays(SCOLIOSIS_START);

/** Cobb angle at the record: 10°, the diagnostic threshold (a "mild" curve; the 2021–2022 exams found none significant). */
export const COBB_DEG=10; // basis: bones#scoliosis-cobb
/** Convexity: +1 = to the body's left (+x). Proximal (upper) thoracic curves are classically left-convex, opposite a right main thoracic curve; the record gives no side. */
export const CONVEX=1; // basis: bones#scoliosis-convexity
/** Apex between T3 and T4 (rest y of their bounds centres, averaged). */
export const APEX_Y=(REST[2][1]+REST[3][1])/2; // basis: bones#scoliosis-apex
/** The arc runs from C7 (its rest bounds centre) down to T7: neutral vertebrae at both ends, so the curve blends into the unmoved spine. */
const TOP_Y=1.4564,BOTTOM_Y=1.2887; // basis: bones#scoliosis-apex
/** Apical axial rotation per degree of Cobb angle. */
export const ROTATION_PER_COBB=.286; // basis: bones#scoliosis-rotation
const DEG=Math.PI/180,LU=TOP_Y-APEX_Y,LL=APEX_Y-BOTTOM_Y;
/** Lateral offset at the apex, metres. The profile is sin² on each side of the apex, whose steepest slopes are A·π/(2·L); the Cobb angle is the sum of the two end tilts, so A = Cobb / (π/2 · (1/Lu + 1/Ll)) (small-angle, within 1%). About 4.5 mm. */
export const APEX_OFFSET=COBB_DEG*DEG/(Math.PI/2*(1/LU+1/LL)); // basis: bones#scoliosis-cobb
/** Profile 0..1 at rest height y (1 at the apex) and its slope d/dy. */
function profile(y:number):[number,number]{
	if(y>=TOP_Y||y<=BOTTOM_Y)return [0,0];
	const up=y>APEX_Y,L=up?LU:LL,s=up?(TOP_Y-y)/L:(y-BOTTOM_Y)/L,ds=(up?-1:1)/L;
	return [Math.sin(Math.PI/2*s)**2,Math.PI/2*Math.sin(Math.PI*s)*ds];
}
const clamp01=(x:number)=>Math.max(0,Math.min(1,x));
/** 0..1 how far the curve has formed `day` days after the record date: a smoothstep over SCOLIOSIS_START → record, then 1. */
export function scoliosisProgress(day:number){const t=clamp01((day+SCOLIOSIS_LEAD_DAYS)/SCOLIOSIS_LEAD_DAYS);return t*t*(3-2*t);} // basis: bones#scoliosis-development

/** Shift, coronal tilt (following the arc) and axial turn (vertebral body toward the convexity) at rest height y, scaled by `k`. Rotation is qz(tilt)·qy(turn). */
function levelFx(part:string,y:number,k:number,pivot?:[number,number,number]):PartFx{
	const [p,dp]=profile(y),dx=CONVEX*APEX_OFFSET*k,tilt=-Math.atan(dx*dp),turn=CONVEX*ROTATION_PER_COBB*COBB_DEG*DEG*k*p;
	const sz=Math.sin(tilt/2),cz=Math.cos(tilt/2),sy=Math.sin(turn/2),cy=Math.cos(turn/2),rotate:Quat=[-sz*sy,cz*sy,sz*cy,cz*cy];
	return {part,translate:[dx*p,0,0],rotate,...(pivot?{pivot}:{})};
}

/** Part effects `day` days after the record date ([] before the curve starts). */
export function scoliosisFx(day:number):PartFx[]{
	const k=scoliosisProgress(day);if(k<=0)return [];
	const out:PartFx[]=[];
	SCOLIOSIS_LEVELS.forEach((l,i)=>{
		const v=levelFx(l.vertebra,l.y,k);out.push(v);
		// The disk turns about the same vertical axis as its vertebra (the vertebra's rest bounds-centre x/z, which the vertebra pivots on by default), so the two stay together.
		out.push(levelFx(l.disk,l.diskY,k,[l.x,l.diskY,l.z]));
		const r=SCOLIOSIS_RIBS[i];out.push({part:r.left,translate:[...v.translate!]},{part:r.right,translate:[...v.translate!]});
	});
	return out;
}
