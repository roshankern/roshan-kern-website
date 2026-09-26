/** Task 15 phase 1: clipping, containment and overlap checks in REPORTING mode. Every check measures the rendered geometry (merged fx from every script + growthFx + eruptionFx, then the body warp with the segments.bin weights and bone distances, exactly
 * as engine.settle does) on each test date and compares it with the same metric on the REST pose (the undeformed atlas), since many parts already touch or interpenetrate at rest. Each prints its worst offender per date and the
 * breaches (a worsening past the tolerance); none fails on a breach yet (phase 2 turns them into hard gates). They fail only when a measurement is vacuous (a missing part, an empty hull), when the measured warp
 * differs from engine.settle, or when the GLSL/TS parity at scale is off (those two are hard now). Geometry helpers: clip-geom.ts; the GPU harness: clip-gpu.ts. Runtime about 1-1.5 min. */
import * as T from 'three';
import fs from 'node:fs';
import type {Check,CheckContext} from './harness';
import type {NodeAtlas} from './node-atlas';
import {TriGrid,hullOf,affineFit,type Hull} from './clip-geom';
import {nodeEngine} from './engine-node';
import {gpuParity} from './clip-gpu';
import {SCRIPTS,activeWindow,dayOf} from '../issues';
import {bodyAt} from '../growth/proportions';
import {growthFx,GLOBE_CENTRE} from '../growth/organs';
import {eruptionFx,TEETH} from '../issues/teeth/eruption';
import {warpState,warpPoint,segAt,SEG_STRIDE,type WarpState} from '../growth/warp';
import {mergeFx,applyFxPoint,identityFx,type ResolvedFx} from '../fx/part-fx';
import {SOFT_SYSTEMS} from '../engine';
import {SEGMENTS,type Body,type CustomLayer,type LayerContext,type PartFx,type Rig,type Vec3} from '../types';
import {toDays,fromDays} from '../../health/dates';
import {DEFAULT_VISIBLE} from '../../atlas/anatomy';
import {FRACTURE_DATE} from '../../fracture/model';
import {fractureLayer} from '../issues/bones/fracture-layer';
import rigJson from '../growth/rig.json';

const rig=rigJson as Rig,TODAY='2026-09-25',MM=1000;
/** The fixed test dates (Task 15 brief); each script's peak day is added to them. */
const BASE_DATES=['2003-06-22','2004-06-22','2006-06-22','2009-06-22','2013-06-22','2017-06-22','2021-06-22','2026-01-02'];
const ORD=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth'],Ord=ORD.map(o=>o[0].toUpperCase()+o.slice(1));
const sides=(f:(s:string)=>string)=>['Left','Right'].map(f);

// ── Part groups ──
const RIB_HULL=[...ORD.flatMap(o=>sides(s=>`${s} ${o} rib`)),'Body of sternum','Manubrium',...ORD.slice(0,7).flatMap(o=>sides(s=>`${s} ${o} costal cartilage`)),...Ord.map(o=>`${o} thoracic vertebra`)];
const ABD_HULL=['Left hip bone','Right hip bone','Sacrum',...Ord.slice(0,5).map(o=>`${o} lumbar vertebra`),...ORD.slice(9).flatMap(o=>sides(s=>`${s} ${o} rib`)),'Xiphoid process'];
/** Cardiac-system parts that are brain ventricles, not heart. */
const NOT_HEART=/Third ventricle|Fourth ventricle|Interventricular foramen|lateral ventricle/;
const ABD_ORGANS=['Rectum','Ascending colon','Transverse colon','Descending colon','Stomach','Urinary bladder','Left kidney','Right kidney'];
const GLOBE=/^(Left|Right) (sclera|cornea|choroid|iris|lens|vitreous body|corona ciliaris)$|^Anterior chamber of (left|right) eyeball$|^Optic part of (left|right) retina$|^Suspensory ligament of (left|right) lens$/;
const ORBIT_BONES=['Frontal bone','Left zygomatic bone','Right zygomatic bone','Left maxilla','Right maxilla'];
/** Skeletal-system parts that are not bone (muscles, tendons and retinacula filed under skeletal) or are checked elsewhere (teeth, gingiva). */
const NOT_BONE=/fibularis|tibialis|iliotibial|subscapularis|levator scapulae|tooth$|^Gingiva/;
const HAND_FOOT=/phalanx|metacarp|metatars|capitate|hamate|lunate|pisiform|scaphoid|trapezi|triquetral|calcaneus|cuboid|cuneiform|navicular|talus|sesamoid/i;
/** Organ neighbours whose contact the scripts change (task-12-report: rectum and descending colon; Task 5: the newborn thymus): [organ, neighbours]. */
const NEIGHBOURS:[string,string[]][]=[
	['Rectum',['Urinary bladder','Prostate','Sacrum','Left seminal vesicle','Right seminal vesicle']],
	['Descending colon',['Left iliacus','Left hip bone','Left external oblique','Left psoas major','Left kidney','Spleen']],
	['Left lobe of thymus',['Manubrium','Body of sternum']],['Right lobe of thymus',['Manubrium','Body of sternum']],
];
/** Neighbour penetration may deepen at most this much beyond rest. */
const NEIGH_MM=1;
const VERTEBRAE=['Atlas','Axis',...['Third','Fourth','Fifth','Sixth','Seventh'].map(o=>`${o} cervical vertebra`),...Ord.map(o=>`${o} thoracic vertebra`),...Ord.slice(0,5).map(o=>`${o} lumbar vertebra`),'Sacrum'];

// ── Tolerances (brief; each is applied to warped − rest) ──
/** Organs in a hull: at most 2% more vertices outside than at rest, and the farthest no more than 3 mm farther out than at rest. */
const HULL_FRAC=0.02,HULL_MM=3;
/** Eyes: globe centre within 4 mm of the rest-relative orbit centre; a globe vertex inside the Skin at rest may end up at most this far outside it (grazing the eyelid shell). */
const EYE_MM=4,GLOBE_OUT_MM=0.5;
/** …and a breach needs more than 0.5% of the tested globe vertices newly outside (the adult noise floor of the ray vote is about 0.04%). */
const GLOBE_FRAC=0.005;
/** Only globe vertices at least this deep inside the Skin at rest are tested, and with hysteresis (inside at rest needs 3 of the 4 ray votes, outside at most 1): the cornea and the front of the sclera sit in the eye opening,
 * where the Skin shell folds in behind them, and every ray from the orbit passes the lids, the nose or the other orbit, so the plain vote flips with sub-millimetre shifts. */
const GLOBE_DEPTH=0.002;
/** Teeth: the jaw hull is inflated by 1 mm. */
const TOOTH_INFLATE=0.001;
/** Bones in the skin: at most 0.5% (hands and feet 1%) of the vertices inside the Skin at rest end up outside it. */
const BONE_FRAC=0.005,BONE_FRAC_HF=0.01;
/** Joints: parent and child maps agree within 1 mm; bone pairs across the joint (within 1 cm at rest) do not cross by more than 1 mm. */
const JOINT_MM=1,PAIR_NEAR=0.01,JOINT_ZONE=0.03,CROSS_MM=1;
/** Vertebrae: y overlap of neighbouring boxes at most 1 mm more than at rest (scaled with the pair's warped height). */
const VERT_MM=1;
/** Every Nth vertex for the skin-containment and hull tests. */
const SAMPLE=3;

// ── Shared state ──
interface Setup {g:NodeAtlas;seg:Uint8Array;segOff:Int32Array;soft:boolean[];restCenter:Vec3[];byName:(names:string[])=>number[];names:(test:(n:string,i:number)=>boolean)=>string[]}
let setupP:Promise<Setup>|null=null;
const setup=(c:CheckContext)=>setupP??=(async()=>{
	const g=await c.geometry(),b=fs.readFileSync('public/anyhealth/models/segments.bin'),seg=new Uint8Array(b.buffer,b.byteOffset,b.byteLength),n=g.parts.length,segOff=new Int32Array(n+1);
	g.parts.forEach((p,i)=>{segOff[i+1]=segOff[i]+p.position.length/3*SEG_STRIDE;});
	const soft=g.atlas.parts.map(p=>SOFT_SYSTEMS.includes(p.system));
	// Default pivots as engine.ready: decoded-vertex bounds centres.
	const restCenter=g.parts.map(d=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let k=0;k<d.position.length;k+=3)for(let j=0;j<3;j++){const v=d.position[k+j];if(v<lo[j])lo[j]=v;if(v>hi[j])hi[j]=v;}return [0,1,2].map(j=>(lo[j]+hi[j])/2) as Vec3;});
	const byName=(names:string[])=>names.flatMap(nm=>{const l=g.indicesOf(nm);if(!l.length)throw new Error(`clipping: no atlas part named ${nm}`);return l;});
	const names=(test:(nm:string,i:number)=>boolean)=>[...new Set(g.atlas.parts.flatMap((p,i)=>test(p.name,i)?[p.name]:[]))];
	return {g,seg,segOff,soft,restCenter,byName,names};
})();

/** Merged fx for a date, as engine.applyDate builds them. */
function fxFor(s:Setup,date:string,body:Body):Map<number,ResolvedFx>{
	const list:PartFx[]=[],ctx={body,date};for(const sc of SCRIPTS)list.push(...sc.fxAt(dayOf(sc,date),ctx));list.push(...growthFx(body),...eruptionFx(body));
	const warn=console.warn;console.warn=()=>{};try{return mergeFx(list,s.g.indicesOf,i=>s.restCenter[i]);}finally{console.warn=warn;}
}
/** A date's warp: the body, WarpState and merged fx; null = the rest pose. */
interface Pose {date:string|null;body:Body|null;ws:WarpState|null;fx:Map<number,ResolvedFx>}
const poseAt=(s:Setup,date:string|null):Pose=>{if(!date)return {date,body:null,ws:null,fx:new Map()};const body=bodyAt(date);return {date,body,ws:warpState(rig,body),fx:fxFor(s,date,body)};};
/** Part i's rendered positions on a pose (engine.settle's loop: applyFxPoint with the Int8 normal, then warpPoint with the segments.bin bytes). */
function warpPart(s:Setup,pose:Pose,i:number):Float32Array{
	const r=s.g.parts[i].position;if(!pose.ws)return r;
	const nrm=s.g.parts[i].normal,out=new Float32Array(r.length),f=pose.fx.get(i)??identityFx(s.restCenter[i]),p:Vec3=[0,0,0],nn:Vec3=[0,0,0],q:Vec3=[0,0,0],o=s.segOff[i],soft=s.soft[i];
	for(let v=0,k=0;k<r.length;v++,k+=3){p[0]=r[k];p[1]=r[k+1];p[2]=r[k+2];nn[0]=nrm[k]/127;nn[1]=nrm[k+1]/127;nn[2]=nrm[k+2]/127;applyFxPoint(f,p,nn,q);const [a,b,w,d]=segAt(s.seg,o,v);warpPoint(pose.ws,q,a,b,w,soft,q,d);out[k]=q[0];out[k+1]=q[1];out[k+2]=q[2];}
	return out;
}
const visibleOn=(pose:Pose,i:number)=>(pose.fx.get(i)?.visible??1)>=0.5;
const concat=(arrs:ArrayLike<number>[])=>{const n=arrs.reduce((a,b)=>a+b.length,0),o=new Float32Array(n);let k=0;for(const a of arrs){o.set(a,k);k+=a.length;}return o;};

// ── Peak days ──
/** Displacement score of one fxAt list: Σ|swell| + Σ|scale − 1| + tint amount (brief), plus rotation angle (rad) + |translate| / 1 cm, so a rotate / translate-only script (scoliosis) has a peak too. */
const score=(l:PartFx[])=>l.reduce((a,f)=>a+Math.abs(f.swell??0)+(f.scale?f.scale.reduce((x,v)=>x+Math.abs(v-1),0):0)+(f.tint?.[3]??0)+(f.rotate?2*Math.acos(Math.min(1,Math.abs(f.rotate[3]))):0)+(f.translate?Math.hypot(...f.translate)/0.01:0),0);
let peaksCache:{id:string;date:string;score:number}[]|null=null;
/** Each script's peak date: the day in [0, active window] with the highest score, sampled daily (the first when tied); scripts that never score are left out. */
function peaks(){
	if(peaksCache)return peaksCache;const bodies=new Map<string,Body>(),out:{id:string;date:string;score:number}[]=[];
	for(const sc of SCRIPTS){const w=activeWindow(sc,TODAY),o=toDays(sc.onset),n=toDays(w.to)-o;let best=0,bd=-1;
		for(let d=0;d<=n;d++){const date=fromDays(o+d);let body=bodies.get(date);if(!body){body=bodyAt(date);bodies.set(date,body);}const v=score(sc.fxAt(d,{body,date}));if(v>best+1e-12){best=v;bd=d;}}
		if(bd>=0)out.push({id:sc.id,date:fromDays(o+bd),score:best});}
	return peaksCache=out;
}
/** The test dates, each labelled with the scripts that peak on it. */
function testDates():{date:string;label:string}[]{
	const m=new Map<string,string[]>(BASE_DATES.map(d=>[d,[]]));for(const p of peaks()){const l=m.get(p.date)??[];l.push(`${p.id} peak`);m.set(p.date,l);}
	return [...m].sort((a,b)=>a[0]<b[0]?-1:1).map(([date,l])=>({date,label:l.length?l.join(', '):''}));
}

// ── The per-date measurements (one pass per date, cached) ──
interface HullStat {out:number;maxOut:number;n:number}
/** Skin containment of a vertex set: n tested, outside now, newly outside (inside at rest, outside now), the farthest newly-outside vertex from the Skin (mm, over up to 64 of them). */
interface SkinStat {n:number;outside:number;newOut:number;worstMM:number}
interface Measure {
	date:string|null;
	chest:Map<string,HullStat>;abd:Map<string,HullStat>;
	eyes:Record<'Left'|'Right',{dev:number}&SkinStat>;
	teeth:Map<string,HullStat>;
	bones:Map<string,SkinStat>;
	/** Rest only: per part, 1 where a (sampled) vertex is inside the Skin. */
	flags:Map<number,Uint8Array>;
	joints:{id:string;err:number;minGap:number;restGap:number;pair:string}[];
	vert:Map<string,{overlap:number;span:number}>;
	/** Organ ↔ neighbour: the deepest vertex of either inside the other (metres, sampled every SAMPLE-th vertex). */
	neigh:Map<string,number>;
}
/** Rest-pose pairs across each rig joint: [partA, vA, partB, vB, unit rest separation]. */
interface JointPairs {id:string;parent:number;child:number;joint:Vec3;pairs:{pa:number;va:number;pb:number;vb:number;dir:Vec3;d:number}[]}
let jointCache:JointPairs[]|null=null;
function jointPairs(s:Setup,bones:number[]):JointPairs[]{
	if(jointCache)return jointCache;
	const dom=(i:number,v:number)=>{const [a,b,w]=segAt(s.seg,s.segOff[i],v);return w>=0.5?a:b;};
	jointCache=rig.segments.filter(sg=>sg.parent).map(sg=>{
		const child=SEGMENTS.indexOf(sg.id),parent=SEGMENTS.indexOf(sg.parent!),J=sg.joint,A:[number,number][]=[],B:[number,number][]=[];
		for(const i of bones){const P=s.g.parts[i].position;for(let v=0;v<P.length/3;v++){const d=Math.hypot(P[v*3]-J[0],P[v*3+1]-J[1],P[v*3+2]-J[2]);if(d>JOINT_ZONE)continue;const sgm=dom(i,v);if(sgm===parent)A.push([i,v]);else if(sgm===child)B.push([i,v]);}}
		const pairs:JointPairs['pairs']=[];
		for(const [pb,vb] of B){const Q=s.g.parts[pb].position;let best=PAIR_NEAR,bi=-1;for(let k=0;k<A.length;k++){const [pa,va]=A[k];if(pa===pb)continue;const P=s.g.parts[pa].position,d=Math.hypot(Q[vb*3]-P[va*3],Q[vb*3+1]-P[va*3+1],Q[vb*3+2]-P[va*3+2]);if(d<best){best=d;bi=k;}}
			if(bi<0||best<3e-4)continue;const [pa,va]=A[bi],P=s.g.parts[pa].position;pairs.push({pa,va,pb,vb,d:best,dir:[0,1,2].map(j=>(Q[vb*3+j]-P[va*3+j])/best) as Vec3});}
		return {id:sg.id,parent,child,joint:J,pairs};
	});
	return jointCache;
}

const measures=new Map<string,Promise<Measure>>();
function measure(c:CheckContext,date:string|null):Promise<Measure>{
	const key=date??'rest';let m=measures.get(key);if(!m){m=setup(c).then(async s=>measureNow(s,date,date?await measure(c,null):null));measures.set(key,m);}return m;
}
function measureNow(s:Setup,date:string|null,rest:Measure|null):Measure{
	const {g}=s,pose=poseAt(s,date),cache=new Map<number,Float32Array>(),W=(i:number)=>{let a=cache.get(i);if(!a){a=warpPart(s,pose,i);cache.set(i,a);}return a;};
	const hullFrom=(names:string[],extraZ=0):Hull=>{const pts=concat(s.byName(names).map(W));if(!extraZ)return hullOf(pts);const sh=pts.slice();for(let k=2;k<sh.length;k+=3)sh[k]+=extraZ;return hullOf(concat([pts,sh]));};
	const inHull=(h:Hull,names:string[],inflate=0,sel?:(i:number)=>ArrayLike<number>):Map<string,HullStat>=>{
		const out=new Map<string,HullStat>();
		for(const nm of names){let o=0,n=0,mx=0,any=false;for(const i of g.indicesOf(nm)){if(!visibleOn(pose,i))continue;any=true;const P=sel?sel(i):W(i);for(let k=0;k<P.length;k+=3*(sel?1:SAMPLE)){const d=h.dist(P[k],P[k+1],P[k+2])-inflate;n++;if(d>0){o++;if(d>mx)mx=d;}}}if(any)out.set(nm,{out:o,n,maxOut:mx});}
		return out;
	};
	// 1 · organs in the rib cage; 2 · abdominal organs in the pelvis / abdomen hull (+1 cm anterior).
	const heart=s.names((nm,i)=>g.atlas.parts[i].system==='cardiac'&&!NOT_HEART.test(nm)),airway=s.names(nm=>/bronchial tree$|main bronchus$/.test(nm));
	const chest=inHull(hullFrom(RIB_HULL),[...heart,...airway,'Left lobe of thymus','Right lobe of thymus']);
	const abd=inHull(hullFrom(ABD_HULL,0.01),ABD_ORGANS);
	// Skin grid (all of it; the other parts test against it).
	const skinI=g.indicesOf('Skin')[0],skin=new TriGrid(W(skinI),g.parts[skinI].index,0.01,true),flags=new Map<number,Uint8Array>();
	/** Skin containment of the named parts' visible vertices (every `stride`-th), per vertex against the rest flags (at rest: inside, and at least `depth` from the Skin). `strict` (hysteresis): inside at rest needs 3 of the 4 ray votes, outside now at most 1. */
	const skinStat=(names:string[],stride:number,depth=0,strict=false):SkinStat=>{
		let n=0,outside=0,newOut=0,worst=0;const outs:number[]=[];
		for(const nm of names)for(const i of g.indicesOf(nm)){if(!visibleOn(pose,i))continue;const P=W(i),rf=rest?.flags.get(i),f=new Uint8Array(Math.ceil(P.length/3/stride));
			for(let k=0,v=0;k<P.length;k+=3*stride,v++){n++;const vs=strict?skin.votes(P[k],P[k+1],P[k+2]).reduce((a,b)=>a+b,0):0,inside=strict?vs>=(rest?2:3):skin.inside(P[k],P[k+1],P[k+2]);f[v]=+(inside&&(!depth||!skin.near(P[k],P[k+1],P[k+2],depth)));if(inside)continue;outside++;if(rf&&rf[v]){newOut++;if(outs.length<64*3)outs.push(P[k],P[k+1],P[k+2]);}}
			if(!rest)flags.set(i,f);}
		for(let k=0;k<outs.length;k+=3)worst=Math.max(worst,skin.nearest(outs[k],outs[k+1],outs[k+2],0.05));
		return {n,outside,newOut,worstMM:worst*MM};
	};
	// 3 · eyes: globe centre (warped sclera bounds centre) vs the rest-relative orbit centre, carried by a least-squares affine fit of the orbit-bone vertices within 2.5 cm of it; globe vertices outside the Skin.
	const eyes={} as Measure['eyes'];
	for(const side of ['Left','Right'] as const){
		const c0=GLOBE_CENTRE[side],rest:number[]=[],warped:number[]=[];
		for(const i of s.byName(ORBIT_BONES)){const R=g.parts[i].position,Wp=W(i);for(let k=0;k<R.length;k+=3)if(Math.hypot(R[k]-c0[0],R[k+1]-c0[1],R[k+2]-c0[2])<0.025){rest.push(R[k],R[k+1],R[k+2]);warped.push(Wp[k],Wp[k+1],Wp[k+2]);}}
		const want=affineFit(rest,warped)(c0),sc=W(g.indicesOf(`${side} sclera`)[0]),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
		for(let k=0;k<sc.length;k+=3)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],sc[k+j]);hi[j]=Math.max(hi[j],sc[k+j]);}
		eyes[side]={dev:Math.hypot(...[0,1,2].map(j=>(lo[j]+hi[j])/2-want[j])),...skinStat(s.names(x=>GLOBE.test(x)&&x.toLowerCase().includes(side.toLowerCase())),1,GLOBE_DEPTH,true)};
	}
	// 4 · teeth: the root-end 30% of each visible tooth's vertices (upper: highest, lower: lowest) in the jaw hull + 1 mm.
	const upperJaw=hullFrom(['Left maxilla','Right maxilla']),lowerJaw=hullFrom(['Mandible']),teeth=new Map<string,HullStat>();
	for(const t of TEETH){const up=t.arch==='upper',root=(i:number)=>{const P=W(i),ys:number[]=[];for(let k=1;k<P.length;k+=3)ys.push(P[k]);ys.sort((a,b)=>a-b);const cut=up?ys[Math.floor(ys.length*0.7)]:ys[Math.floor(ys.length*0.3)],o:number[]=[];for(let k=0;k<P.length;k+=3)if(up?P[k+1]>=cut:P[k+1]<=cut)o.push(P[k],P[k+1],P[k+2]);return o;};
		for(const [k,v] of inHull(up?upperJaw:lowerJaw,[t.part],TOOTH_INFLATE,root))teeth.set(k,v);}
	// 5 · bones in the Skin (every SAMPLE-th vertex).
	const boneNames=s.names((nm,i)=>g.atlas.parts[i].system==='skeletal'&&!NOT_BONE.test(nm)),bones=new Map<string,SkinStat>();
	for(const nm of boneNames){const st=skinStat([nm],SAMPLE);if(st.n)bones.set(nm,st);}
	// 6 · joints.
	const boneIdx=s.byName(boneNames),joints=jointPairs(s,boneIdx).map(J=>{
		let err=0;if(pose.ws){const a=warpPoint(pose.ws,[...J.joint],J.parent,J.parent,1,false,[0,0,0]),b=warpPoint(pose.ws,[...J.joint],J.child,J.child,1,false,[0,0,0]);err=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
		let minGap=Infinity,restGap=0,pair='';for(const p of J.pairs){if(!visibleOn(pose,p.pa)||!visibleOn(pose,p.pb))continue;const A=W(p.pa),B=W(p.pb),gap=[0,1,2].reduce((x,j)=>x+(B[p.vb*3+j]-A[p.va*3+j])*p.dir[j],0);if(gap<minGap){minGap=gap;restGap=p.d;pair=`${g.atlas.parts[p.pa].name} / ${g.atlas.parts[p.pb].name}`;}}
		return {id:J.id,err,minGap,restGap,pair};
	});
	// 7 · vertebrae: y overlap and joint height of neighbouring warped boxes.
	const vbox=(nm:string)=>{let lo=Infinity,hi=-Infinity;for(const i of g.indicesOf(nm)){const P=W(i);for(let k=1;k<P.length;k+=3){if(P[k]<lo)lo=P[k];if(P[k]>hi)hi=P[k];}}return [lo,hi];},vert=new Map<string,{overlap:number;span:number}>();
	for(let k=0;k+1<VERTEBRAE.length;k++){const [a0,a1]=vbox(VERTEBRAE[k]),[b0,b1]=vbox(VERTEBRAE[k+1]);vert.set(`${VERTEBRAE[k]} / ${VERTEBRAE[k+1]}`,{overlap:Math.min(a1,b1)-Math.max(a0,b0),span:Math.max(a1,b1)-Math.min(a0,b0)});}
	// Organ neighbours: the deepest (sampled) vertex of one part inside the other, both ways.
	const grids=new Map<string,TriGrid>(),grid=(nm:string)=>{let t=grids.get(nm);if(!t){const ix=g.indicesOf(nm),P=concat(ix.map(W));let o=0;const I:number[]=[];for(const i of ix){for(const v of g.parts[i].index)I.push(v+o);o+=g.parts[i].position.length/3;}t=new TriGrid(P,I,0.005);grids.set(nm,t);}return t;};
	const depth=(a:string,b:string)=>{const t=grid(b);let d=0;for(const i of g.indicesOf(a)){if(!visibleOn(pose,i))continue;const P=W(i);for(let k=0;k<P.length;k+=3*SAMPLE)if(t.inside(P[k],P[k+1],P[k+2]))d=Math.max(d,t.nearest(P[k],P[k+1],P[k+2],0.05));}return d;};
	const neigh=new Map<string,number>();for(const [a,bs] of NEIGHBOURS)for(const b of bs)neigh.set(`${a} ↔ ${b}`,Math.max(depth(a,b),depth(b,a)));
	return {date,chest,abd,eyes,teeth,bones,flags,joints,vert,neigh};
}

// ── Reporting ──
const mm=(v:number)=>(v*MM).toFixed(1),pct=(v:number)=>(v*100).toFixed(1);
const log=(s:string)=>console.log(`     ${s}`);
/** Run `row` over every test date and print one line per date plus a breach summary; asserts only that each date measured something. */
async function perDate(c:CheckContext,title:string,row:(m:Measure,rest:Measure,date:string)=>{line:string;breaches:string[]}){
	const rest=await measure(c,null);let total=0;log(`${title} (warped vs rest; ✗ = a breach once this is a hard gate)`);
	for(const {date,label} of testDates()){const m=await measure(c,date),r=row(m,rest,date);total+=r.breaches.length;log(`${date}${label?` [${label}]`:''} · ${r.line}${r.breaches.length?` · ✗ ${r.breaches.length}: ${r.breaches.slice(0,4).join('; ')}${r.breaches.length>4?' …':''}`:''}`);}
	log(`${total} breaches in total (reporting mode: not failing)`);
}
/** Hull containment rows (checks 1, 2, 4): worst part by distance worsening; breaches = fraction out +HULL_FRAC or max out +tolerance vs rest. */
function hullRow(m:Map<string,HullStat>,rest:Map<string,HullStat>,tolMM:number,fracTol:number){
	let worst='',wv=-Infinity,line='';const breaches:string[]=[];
	for(const [nm,st] of m){const r=rest.get(nm)??{out:0,n:1,maxOut:0},df=st.out/st.n-r.out/r.n,dm=st.maxOut-r.maxOut;
		if(dm>wv){wv=dm;worst=nm;line=`worst ${nm}: out ${mm(st.maxOut)} mm (rest ${mm(r.maxOut)}), ${pct(st.out/st.n)}% out (rest ${pct(r.out/r.n)}%)`;}
		if(dm*MM>tolMM||df>fracTol)breaches.push(`${nm} +${mm(dm)} mm / +${pct(df)}%`);}
	return {line:line||'no visible parts',breaches};
}

export const checks:Check[]=[
	{name:'clipping: the measured geometry is what the engine settles (one date, every measured part)',async run(c){
		const s=await setup(c),date='2003-06-22',{engine,pickers}=nodeEngine(s.g);engine.update({date,visible:DEFAULT_VISIBLE,isolate:null,now:0});engine.settle();
		const pose=poseAt(s,date),parts=s.byName(['Skin','Left lobe of thymus','Rectum','Left sclera','Mandible','Left humerus','Fifth thoracic vertebra','Left upper first secondary molar tooth']);let err=0;
		for(const i of parts){const a=warpPart(s,pose,i),b=pickers[i]!.geometry.getAttribute('position').array as Float32Array;for(let k=0;k<a.length;k++)err=Math.max(err,Math.abs(a[k]-b[k]));}
		log(`max |check warp − engine settle| = ${err.toExponential(2)} m over ${parts.length} parts`);c.assert(err<1e-6,`the clipping warp differs from engine.settle by ${err} m`);
		log(`test dates: ${testDates().map(d=>d.date+(d.label?` (${d.label})`:'')).join(', ')}`);
	}},
	{name:'organs inside rib cage (heart, bronchial trees, main bronchi, thymus; ≤2% more out, ≤3 mm farther vs rest)',async run(c){
		const rest=await measure(c,null);c.assert(rest.chest.size>20,`only ${rest.chest.size} chest organs measured`);
		await perDate(c,'rib-cage hull',(m,r)=>hullRow(m.chest,r.chest,HULL_MM,HULL_FRAC));
	}},
	{name:'abdominal organs inside the abdomen (hull +1 cm anterior; same tolerances)',async run(c){
		const rest=await measure(c,null);c.assert(rest.abd.size===ABD_ORGANS.length,'abdominal organs');
		await perDate(c,'pelvis/abdomen hull',(m,r)=>hullRow(m.abd,r.abd,HULL_MM,HULL_FRAC));
	}},
	{name:'organ neighbours (rectum, descending colon, thymus): penetration ≤1 mm deeper than at rest',async run(c){
		const rest=await measure(c,null);c.assert(rest.neigh.size>10,'neighbour pairs');log(`rest penetration: ${[...rest.neigh].map(([k,v])=>`${k} ${mm(v)} mm`).join(', ')}`);
		await perDate(c,'neighbours',(m,r)=>{const b:string[]=[];let worst='',wv=-Infinity;for(const [k,v] of m.neigh){const rv=r.neigh.get(k)!,d=v-rv;if(d>wv){wv=d;worst=`${k} ${mm(v)} mm (rest ${mm(rv)})`;}if(d*MM>NEIGH_MM)b.push(`${k} +${mm(d)} mm`);}return {line:`worst ${worst}`,breaches:b};});
	}},
	{name:'eyes inside the orbits (globe centre ≤4 mm from the rest-relative orbit centre; ≤0.5% of the globe vertices ≥2 mm inside the Skin at rest end up >0.5 mm outside it)',async run(c){
		const rest=await measure(c,null);c.assert(rest.eyes.Left.n>1000&&rest.eyes.Right.n>1000,'globe vertices');
		log(`rest: globe vertices outside the Skin (the eye opening) L ${rest.eyes.Left.outside}/${rest.eyes.Left.n}, R ${rest.eyes.Right.outside}/${rest.eyes.Right.n}`);
		await perDate(c,'orbits',m=>{const b:string[]=[];const line=(['Left','Right'] as const).map(sd=>{const e=m.eyes[sd];if(e.dev*MM>EYE_MM)b.push(`${sd} centre ${mm(e.dev)} mm`);if(e.worstMM>GLOBE_OUT_MM&&e.newOut>GLOBE_FRAC*e.n)b.push(`${sd} ${e.newOut} globe vertices newly outside the Skin, up to ${e.worstMM.toFixed(1)} mm`);return `${sd[0]} centre ${mm(e.dev)} mm, newly outside Skin ${e.newOut} (farthest ${e.worstMM.toFixed(1)} mm)`;}).join(' · ');return {line,breaches:b};});
	}},
	{name:'teeth seated (root-end 30% of each visible tooth inside the maxilla / mandible hull + 1 mm, vs rest)',async run(c){
		const rest=await measure(c,null);c.assert(rest.teeth.size===TEETH.length,`teeth measured ${rest.teeth.size}`);
		await perDate(c,'jaw hulls',(m,r)=>{const b:string[]=[];let worst='',wv=-Infinity;for(const [nm,st] of m.teeth){const rs=r.teeth.get(nm)!,dm=st.maxOut-rs.maxOut;if(dm>wv){wv=dm;worst=`${nm}: root out ${mm(st.maxOut)} mm (rest ${mm(rs.maxOut)}), ${pct(st.out/st.n)}% (rest ${pct(rs.out/rs.n)}%)`;}if(st.maxOut>rs.maxOut+1e-4&&st.out/st.n>rs.out/rs.n)b.push(`${nm} +${mm(dm)} mm`);}
			return {line:m.teeth.size?`${m.teeth.size} visible · worst ${worst}`:'no visible teeth',breaches:b};});
	}},
	{name:'bones inside the skin (≤0.5% of the vertices inside the Skin at rest end up outside it; hands and feet 1%)',async run(c){
		const rest=await measure(c,null);c.assert(rest.bones.size>200,`bones measured ${rest.bones.size}`);
		const restOut=[...rest.bones].filter(([,b])=>b.outside/b.n>0.005).sort((a,b)=>b[1].outside/b[1].n-a[1].outside/a[1].n);
		log(`rest: ${restOut.length} bones already >0.5% outside the Skin (baseline, excluded vertex by vertex): ${restOut.slice(0,10).map(([n,b])=>`${n} ${pct(b.outside/b.n)}%`).join(', ')}`);
		await perDate(c,'Skin containment',m=>{const b:string[]=[];let worst='',wv=-Infinity;
			for(const [nm,st] of m.bones){const f=st.newOut/st.n;if(f>wv||(f===wv&&st.worstMM>0)){wv=f;worst=`${nm}: ${pct(f)}% newly outside, farthest ${st.worstMM.toFixed(1)} mm (${pct(st.outside/st.n)}% outside in all)`;}if(f>(HAND_FOOT.test(nm)?BONE_FRAC_HF:BONE_FRAC))b.push(`${nm} ${pct(f)}% / ${st.worstMM.toFixed(1)} mm`);}
			return {line:`worst ${worst}`,breaches:b};});
	}},
	{name:'joint seams (parent vs child joint point ≤1 mm; bones across each joint within 1 cm at rest do not cross by >1 mm)',async run(c){
		const rest=await measure(c,null);c.assert(rest.joints.length===14,'14 joints');log(`pairs per joint: ${jointCache!.map(j=>`${j.id} ${j.pairs.length}`).join(', ')}`);
		await perDate(c,'joints',(m)=>{const b:string[]=[];let we=0,wj='',wg=Infinity,wl='';
			for(const j of m.joints){if(j.err>we){we=j.err;wj=j.id;}if(j.minGap<wg){wg=j.minGap;wl=`${j.id} (${j.pair}) gap ${mm(j.minGap)} mm (rest ${mm(j.restGap)})`;}if(j.err*MM>JOINT_MM)b.push(`${j.id} joint ${mm(j.err)} mm`);if(j.minGap*MM<-CROSS_MM)b.push(`${j.id} crossed ${mm(-j.minGap)} mm (${j.pair})`);}
			return {line:`joint point max ${mm(we)} mm${wj?` (${wj})`:''} · tightest pair ${wl}`,breaches:b};});
	}},
	{name:'vertebrae don\'t interpenetrate (neighbouring boxes overlap in y ≤ rest overlap + 1 mm; scoliosis peak and every test date)',async run(c){
		const rest=await measure(c,null),sp=peaks().find(p=>p.id.startsWith('scoliosis'));c.assert(!!sp,'scoliosis peak');log(`scoliosis peak ${sp!.date}`);
		await perDate(c,'vertebral boxes',(m,r)=>{const b:string[]=[];let worst='',wv=-Infinity;for(const [k,v] of m.vert){const rv=r.vert.get(k)!,want=rv.overlap*v.span/rv.span,d=v.overlap-want;if(d>wv){wv=d;worst=`${k} overlap ${mm(v.overlap)} mm (rest ${mm(rv.overlap)}, scaled ${mm(want)})`;}if(d*MM>VERT_MM)b.push(`${k} +${mm(d)} mm`);}
			return {line:`worst ${worst}`,breaches:b};});
	}},
	{name:'fracture fragments vs callus at days 0, 10, 25, 45 (distal cap inside the callus shell or within 2 mm of the proximal cap)',async run(c){
		const s=await setup(c),res=fractureMeasure(s);c.assert(!!res,'the fracture layer builds with a fake LayerContext');
		for(const r of res!)log(`day ${r.day} (${r.date}): ${r.line}`);
	}},
	{name:'GLSL/TS parity at scale (2,048 real vertices from mixed-weight parts, real merged fx; max error < 1e-5 m)',async run(c){
		const s=await setup(c),r=await gpuParity(s.g,s.seg,s.segOff,s.soft,(date:string)=>{const p=poseAt(s,date);return {ws:p.ws!,fx:p.fx};},['2003-06-22',peaks().find(p=>p.id.startsWith('encopresis'))?.date??'2011-01-01']);
		for(const l of r.lines)log(l);if(r.skipped)return;
		c.assert(r.maxErr<1e-5,`GLSL/TS parity ${r.maxErr} m ≥ 1e-5`);
	}},
];

// ── 8 · Fracture layer (node init with a fake LayerContext) ──
/** Days 0, 10, 25, 45 after the fracture: the distal fragment's cap (posed by the layer's uPose, warped on lUpperArm) vs the callus (posed on the CPU) and the proximal cap, warped vs rest. */
function fractureMeasure(s:Setup){
	const {g}=s,scene=new T.Scene(),geoms=new Map<number,T.BufferGeometry>();
	const ctx:LayerContext={scene,atlas:g.atlas,indicesOf:g.indicesOf,
		restGeometry(i){let rg=geoms.get(i);if(!rg){const d=g.parts[i];rg=new T.BufferGeometry();rg.setAttribute('position',new T.BufferAttribute(d.position,3));rg.setAttribute('normal',new T.BufferAttribute(Float32Array.from(d.normal,v=>v/127),3));rg.setIndex(new T.BufferAttribute(d.index,1));geoms.set(i,rg);}return rg;},
		material:m=>new T.MeshStandardMaterial({color:m.color,transparent:!!m.transparent}),requestFly(){}};
	const layer:CustomLayer=fractureLayer();if(!layer.init(ctx))return null;
	const group=scene.getObjectByName('fracture')!,meshes=group.children as T.Mesh[];
	// Children in build order: head fragment, shaft fragment, head cap, shaft cap, callus, two clots. The caps' pose uniforms come from their onBeforeCompile.
	const poseOf=(m:T.Mesh)=>{const sh={uniforms:{} as Record<string,{value:T.Matrix4}>,vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <opaque_fragment>'};(m.material as T.Material).onBeforeCompile(sh as never,undefined as never);return sh.uniforms.uPose.value;};
	const capHead=meshes[2],capShaft=meshes[3],callus=meshes[4],Mp=poseOf(capHead),Md=poseOf(capShaft),seg=SEGMENTS.indexOf('lUpperArm'),out:{day:number;date:string;line:string}[]=[];
	const posed=(m:T.Mesh,M:T.Matrix4|null)=>{const a=(m.geometry.getAttribute('position').array as Float32Array).slice();if(M){const v=new T.Vector3();for(let k=0;k<a.length;k+=3){v.fromArray(a,k).applyMatrix4(M);v.toArray(a,k);}}return a;};
	const warped=(a:Float32Array,ws:WarpState|null)=>{if(!ws)return a;const o=new Float32Array(a.length),q:Vec3=[0,0,0];for(let k=0;k<a.length;k+=3){warpPoint(ws,[a[k],a[k+1],a[k+2]],seg,seg,1,false,q);o.set(q,k);}return o;};
	const tris=(n:number)=>Uint32Array.from({length:n},(_,i)=>i);
	for(const day of [0,10,25,45]){
		const date=fromDays(toDays(FRACTURE_DATE)+day),body=bodyAt(date);layer.update(day,{systemVisible:()=>true,hiddenByIsolate:false,isolated:false,now:1e9,direction:0,ctx:{body,date}});
		const ws=warpState(rig,body),stat=(w:WarpState|null)=>{
			const dist=warped(posed(capShaft,Md),w),prox=warped(posed(capHead,Mp),w),pg=new TriGrid(prox,tris(prox.length/3),0.005);
			let cg:TriGrid|null=null;if(callus.visible){const cp=warped(posed(callus,null),w);cg=new TriGrid(cp,callus.geometry.getIndex()!.array,0.005);}
			let ok=0,n=0,worst=0,inCallus=0;for(let k=0;k<dist.length;k+=3){n++;const inside=!!cg&&cg.inside(dist[k],dist[k+1],dist[k+2]);if(inside)inCallus++;const d=pg.nearest(dist[k],dist[k+1],dist[k+2],0.05);if(inside||d<=0.002)ok++;else worst=Math.max(worst,d);}
			return {ok:ok/n,worst,inCallus:inCallus/n};
		};
		const w=stat(ws),r=stat(null);
		out.push({day,date,line:`${pct(w.ok)}% of distal-cap vertices seated (rest pose ${pct(r.ok)}%), ${pct(w.inCallus)}% inside the callus (rest ${pct(r.inCallus)}%), worst unseated ${mm(w.worst)} mm from the proximal cap (rest ${mm(r.worst)})${callus.visible?'':' · callus not yet visible'}${w.ok<r.ok-1e-9?' · ✗ worse than rest':''}`});
	}
	layer.dispose();return out;
}
