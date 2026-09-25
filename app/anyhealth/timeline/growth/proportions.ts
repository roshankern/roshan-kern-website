/** Body proportions by date: stature and weight from the measurements, per-segment length and girth factors from age-indexed reference ratios.
 *
 * Every reference table is a ratio to stature by age (years). A segment's factor is its reference ratio at that age over the same ratio at 18 y
 * (the adult reference), so the adult body reproduces the model's own proportions exactly (every factor 1 from 18 y on), and a child's segment
 * is longer or shorter than the model's by the same proportion the reference child's is. The vertical chain is then renormalised so the warped
 * floor-to-vertex height equals the measured stature exactly. */
import {SEGMENTS,type Body,type Rig,type Segment,type SegmentId,type Vec3} from '../types';
import {BIRTH_DATE,type GrowthPoint} from '../../health/types';
import {toDays,fromDays} from '../../health/dates';
import {makeGrowth} from '../../health/growth';
import rigJson from './rig.json';
import growthJson from '../../health/growth.json';

const rig=rigJson as Rig;
const points=growthJson as GrowthPoint[],growth=makeGrowth(points);
const BIRTH=toDays(BIRTH_DATE);
/** The last measurement date: the body is held there after it. */
export const LAST_MEASURED=points.reduce((a,p)=>p.date>a?p.date:a,points[0].date);
const LAST=toDays(LAST_MEASURED);

type Table=[age:number,value:number][];
/** Monotone cubic (Fritsch–Carlson) interpolation through [x,y] nodes, held constant outside them. */
export function monotone(t:Table):(x:number)=>number{
	const n=t.length,x=t.map(p=>p[0]),y=t.map(p=>p[1]);if(n===1)return ()=>y[0];
	const d=x.slice(0,-1).map((_,i)=>(y[i+1]-y[i])/(x[i+1]-x[i])),m=x.map((_,i)=>i===0?d[0]:i===n-1?d[n-2]:d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2);
	for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=m[i+1]=0;continue;}const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const k=3/Math.sqrt(s);m[i]=k*a*d[i];m[i+1]=k*b*d[i];}}
	return v=>{if(v<=x[0])return y[0];if(v>=x[n-1])return y[n-1];let i=0;while(v>x[i+1])i++;const h=x[i+1]-x[i],s=(v-x[i])/h,s2=s*s,s3=s2*s;
		return (2*s3-3*s2+1)*y[i]+(s3-2*s2+s)*h*m[i]+(-2*s3+3*s2)*y[i+1]+(s3-s2)*h*m[i+1];};
}

// Length references, ratio to stature, boys. Snyder 1977 values are medians of per-child ratios in ±0.5 y bins (UMTRI raw data archive).
/** Sitting height / stature, boys (de Arriba Muñoz 2013, Table 1 means). */
const SHR:Table=[[0,0.653],[1,0.629],[2,0.597],[3,0.579],[4,0.570],[6,0.551],[8,0.531],[10,0.519],[12,0.514],[14,0.516],[16,0.519],[18,0.523]]; // basis: growth#ratio-thigh
/** Hip joint to ankle = subischial leg (1 − SHR) less 0.005 (trochanteric − sphyrion height sits 0.002–0.006 below 1 − SHR in Snyder 1977 at 4–18 y). */
const HIP_ANKLE:Table=SHR.map(([a,v])=>[a,1-v-0.005]); // basis: growth#ratio-thigh
/** Thigh share of hip-to-ankle: femur/(femur+tibia) at term 73.6/(73.6+65.2) = 0.53 (Chitty & Altman 2002); Snyder 1977 (trochanteric−tibiale)/(trochanteric−sphyrion) 0.52–0.535 at 3–18 y. */
const THIGH_SHARE=0.53; // basis: growth#ratio-thigh
const THIGH:Table=HIP_ANKLE.map(([a,v])=>[a,v*THIGH_SHARE]); // basis: growth#ratio-thigh
const SHANK:Table=HIP_ANKLE.map(([a,v])=>[a,v*(1-THIGH_SHARE)]); // basis: growth#ratio-shank
/** Head height (vertex–menton). 0 and 1 y: Snyder's 2 y head height (166 mm) scaled by WHO head circumference (34.46, 46.07, 48.25 cm at 0, 12, 24 mo) over WHO length (49.9, 75.7 cm); 2–18 y: Snyder 1977. */
const HEAD:Table=[[0,0.2377],[1,0.2094],[2,0.1891],[3,0.1856],[4,0.1764],[6,0.162],[8,0.1502],[10,0.1431],[12,0.1358],[14,0.1324],[16,0.1258],[18,0.1255]]; // basis: growth#ratio-head
/** Neck, menton to suprasternale (1 − suprasternale height − head height), Snyder 1977 3–18 y (3-point moving average: the two medians come from disjoint subsamples, so their difference is noisy); 0 y is an assumption (the newborn chin nearly meets the chest). */
const NECK:Table=[[0,0.030],[3,0.0544],[4,0.054],[6,0.0551],[8,0.0553],[10,0.054],[12,0.0543],[14,0.0581],[16,0.0617],[18,0.064]]; // basis: growth#ratio-neck
/** Sole to ankle (sphyrion height), Snyder 1977 3–18 y; 0 y assumed. Only used to close the vertical chain for the trunk. */
const ANKLE:Table=[[0,0.035],[3,0.0402],[4,0.0372],[6,0.0417],[8,0.0416],[10,0.041],[12,0.0402],[14,0.0409],[16,0.0422],[18,0.0399]]; // basis: growth#ratio-trunk
/** Upper arm (acromion–radiale), Snyder 1977 3–18 y; 0 y = hip-to-ankle × humerus/(femur+tibia) at term, 64.7/138.8 (Chitty & Altman 2002). */
const UPPER_ARM:Table=[[0,0.1594],[3,0.1762],[4,0.1774],[6,0.1814],[8,0.1829],[10,0.1902],[12,0.1907],[14,0.19],[16,0.1904],[18,0.1916]]; // basis: growth#ratio-upperarm
/** Forearm (radiale–stylion), Snyder 1977 3–18 y; 0 y = hip-to-ankle × radius/(femur+tibia) at term, 54.2/138.8 (Chitty & Altman 2002). */
const FOREARM:Table=[[0,0.1335],[3,0.1419],[4,0.1427],[6,0.1494],[8,0.15],[10,0.1504],[12,0.1517],[14,0.1519],[16,0.1516],[18,0.1521]]; // basis: growth#ratio-forearm
/** Hand length, Snyder 1977 2–18 y; 0 y: newborn hand 6.0 cm over 50 cm. */
const HAND:Table=[[0,0.12],[2,0.1126],[3,0.114],[4,0.1128],[6,0.1111],[8,0.109],[10,0.1089],[12,0.1091],[14,0.1102],[16,0.1077],[18,0.1083]]; // basis: growth#ratio-hand
/** Foot length, Snyder 1977 2–18 y; 0 y: term foot 79.6 mm (Chitty & Altman 2002) over WHO birth length 49.9 cm. */
const FOOT:Table=[[0,0.16],[2,0.1564],[3,0.1592],[4,0.1588],[6,0.157],[8,0.1557],[10,0.1569],[12,0.1576],[14,0.1575],[16,0.1519],[18,0.1514]]; // basis: growth#ratio-foot
const ADULT_AGE=18;

const f=(t:Table)=>monotone(t);
const hipAnkle=f(HIP_ANKLE),head=f(HEAD),neck=f(NECK),ankle=f(ANKLE);
/** Hip joint to suprasternale: what is left of stature after the other vertical pieces. */
const trunk=(a:number)=>1-ankle(a)-hipAnkle(a)-neck(a)-head(a); // basis: growth#ratio-trunk
const LEN:Record<SegmentId,(a:number)=>number>=(()=>{const th=f(THIGH),sh=f(SHANK),ua=f(UPPER_ARM),fa=f(FOREARM),ha=f(HAND),fo=f(FOOT);
	return {trunk,neck,head,lUpperArm:ua,lForearm:fa,lHand:ha,rUpperArm:ua,rForearm:fa,rHand:ha,lThigh:th,lShank:sh,lFoot:fo,rThigh:th,rShank:sh,rFoot:fo};})();
/** Segments on the floor-to-vertex chain: the ones the stature renormalisation scales. */
const VERTICAL:SegmentId[]=['trunk','neck','head','lThigh','lShank','rThigh','rShank'];

// Bone girth references: bony breadth / stature (Snyder 1977 2/3–18 y). Before the first node the value is held. Head breadth at 0 and 1 y: Snyder's 2 y head breadth (134.8 mm) scaled by WHO head circumference over WHO length.
const W_HEAD:Table=[[0,0.193],[1,0.170],[2,0.1522],[3,0.1411],[4,0.1368],[6,0.1222],[8,0.112],[10,0.1054],[12,0.0992],[14,0.093],[16,0.0874],[18,0.0874]]; // basis: growth#girth-bone
const W_NECK:Table=[[2,0.0798],[3,0.0752],[4,0.0764],[6,0.0694],[8,0.0656],[10,0.0637],[12,0.0599],[14,0.0592],[16,0.0613],[18,0.0615]]; // basis: growth#girth-bone
const W_SHOULDER:Table=[[3,0.2322],[4,0.2278],[6,0.2239],[8,0.2182],[10,0.2205],[12,0.2157],[14,0.2148],[16,0.2184],[18,0.2241]]; // basis: growth#girth-bone
const W_HIP:Table=[[3,0.1884],[4,0.1825],[6,0.1742],[8,0.1708],[10,0.1699],[12,0.1738],[14,0.1822],[16,0.1846],[18,0.1853]]; // basis: growth#girth-bone
const W_WRIST:Table=[[3,0.0306],[4,0.0289],[6,0.0271],[8,0.0255],[10,0.0248],[12,0.0247],[14,0.0246],[16,0.0246],[18,0.0245]]; // basis: growth#girth-bone
const W_HAND:Table=[[2,0.0565],[3,0.0548],[4,0.0539],[6,0.0523],[8,0.051],[10,0.0508],[12,0.0501],[14,0.0509],[16,0.0504],[18,0.0505]]; // basis: growth#girth-bone
const W_ANKLE:Table=[[3,0.0429],[4,0.0416],[6,0.0385],[8,0.0366],[10,0.0358],[12,0.0357],[14,0.0352],[16,0.0347],[18,0.0343]]; // basis: growth#girth-bone
const W_FOOT:Table=[[2,0.0682],[3,0.0658],[4,0.0646],[6,0.0633],[8,0.0616],[10,0.0611],[12,0.0609],[14,0.0613],[16,0.0589],[18,0.0589]]; // basis: growth#girth-bone
const rel=(t:Table)=>{const g=f(t),a=g(ADULT_AGE);return (x:number)=>g(x)/a;};
const GIRTH:Record<SegmentId,(a:number)=>number>=(()=>{const hd=rel(W_HEAD),nk=rel(W_NECK),sh=rel(W_SHOULDER),hp=rel(W_HIP),wr=rel(W_WRIST),hn=rel(W_HAND),an=rel(W_ANKLE),ft=rel(W_FOOT),tr=(a:number)=>(sh(a)+hp(a))/2;
	return {trunk:tr,neck:nk,head:hd,lUpperArm:wr,lForearm:wr,lHand:hn,rUpperArm:wr,rForearm:wr,rHand:hn,lThigh:an,lShank:an,lFoot:ft,rThigh:an,rShank:an,rFoot:ft};})();

/** Median BMI-for-age, boys: WHO 2006 standards 0–2 y, CDC 2000 charts 3–20 y (agemos 36.5, 48.5, …, 240). */
const BMI_REF=monotone([[0,13.41],[1/12,14.91],[2/12,16.32],[0.25,16.90],[0.5,17.34],[0.75,17.17],[1,16.80],[1.5,16.14],[2,15.74],[3,16.00],[4,15.63],[5,15.42],[6,15.38],[8,15.78],[10,16.65],[12,17.81],[14,19.16],[16,20.56],[18,21.90],[20,23.02]]); // basis: growth#girth-soft
/** Soft-tissue girth moves with BMI deviation at half rate: at fixed stature, cross-section area ∝ mass, so girth ∝ √BMI and d(girth)/girth ≈ ½ d(BMI)/BMI. */
const K_SOFT=0.5; // basis: growth#girth-soft

const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
/** Floor-to-vertex height of the rest rig under the Task 6 warp at scale 1 (bone girth), measured over one foot. Mirrors warp.ts: new joints chain from the trunk, T_i(p) = newJoint + ℓ(d·a)a + γ(d − (d·a)a). */
function heightOver(foot:'lFoot'|'rFoot',len:Record<SegmentId,number>,girth:Record<SegmentId,number>):number{
	const nj=new Map<SegmentId,Vec3>(),by=new Map(rig.segments.map(s=>[s.id,s]));
	const T=(s:Segment,p:Vec3):Vec3=>{const J=s.joint,a=s.axis,d:Vec3=[p[0]-J[0],p[1]-J[1],p[2]-J[2]],t=d[0]*a[0]+d[1]*a[1]+d[2]*a[2],l=len[s.id],g=girth[s.id];
		return add(nj.get(s.id)!,[l*t*a[0]+g*(d[0]-t*a[0]),l*t*a[1]+g*(d[1]-t*a[1]),l*t*a[2]+g*(d[2]-t*a[2])]);};
	for(const id of ['trunk','neck','head',foot==='lFoot'?'lThigh':'rThigh',foot==='lFoot'?'lShank':'rShank',foot] as SegmentId[]){const s=by.get(id)!;nj.set(id,s.parent?T(by.get(s.parent)!,s.joint):s.joint);}
	const h=by.get('head')!,ft=by.get(foot)!;
	return T(h,[h.joint[0],rig.stature,h.joint[2]])[1]-T(ft,[ft.joint[0],0,ft.joint[2]])[1];
}
/** Scale the vertical segments by one common factor so the warped floor-to-vertex height is exactly the rig stature (× body.scale = statureM). The height is affine in that factor, per foot; the lower foot sets the floor. */
function renormalise(len:Record<SegmentId,number>,girth:Record<SegmentId,number>):void{
	const at=(foot:'lFoot'|'rFoot',k:number)=>{const l={...len};for(const s of VERTICAL)l[s]*=k;return heightOver(foot,l,girth);};
	const k=Math.min(...(['lFoot','rFoot'] as const).map(ft=>{const h0=at(ft,0),h1=at(ft,1);return (rig.stature-h0)/(h1-h0);}));
	for(const s of VERTICAL)len[s]*=k;
}

const bmiAt=(iso:string)=>{const h=(growth.heightAt(iso)??0)/100,w=growth.weightAt(iso)??0;return w/(h*h);};
const softK=(iso:string,age:number)=>1+K_SOFT*(bmiAt(iso)-BMI_REF(age))/BMI_REF(age);
const SOFT_ADULT=softK(LAST_MEASURED,(LAST-BIRTH)/365.25);

/** The body on `date`, clamped to [birth, last measurement]: measured stature and weight, and per-segment factors relative to `scale` (1 = the adult model). */
export function bodyAt(date:string):Body{
	const days=Math.min(Math.max(toDays(date),BIRTH),LAST),iso=fromDays(days),age=(days-BIRTH)/365.25;
	const statureM=(growth.heightAt(iso)??rig.stature*100)/100,weightKg=growth.weightAt(iso)??0;
	const length={} as Record<SegmentId,number>,boneGirth={} as Record<SegmentId,number>,softGirth={} as Record<SegmentId,number>;
	const soft=Math.min(1.25,Math.max(0.85,softK(iso,age)/SOFT_ADULT)); // basis: growth#girth-soft
	for(const s of SEGMENTS){length[s]=LEN[s](age)/LEN[s](ADULT_AGE);boneGirth[s]=GIRTH[s](age);softGirth[s]=boneGirth[s]*soft;}
	renormalise(length,boneGirth);
	return {date,ageYears:age,statureM,weightKg,scale:statureM/rig.stature,length,boneGirth,softGirth};
}
