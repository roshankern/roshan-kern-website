/** Task 15: clipping, containment and overlap checks, HARD GATES since phase 2. Every check measures the rendered geometry (merged fx from every script + growthFx + eruptionFx, then the body warp with the segments.bin weights and bone distances,
 * exactly as engine.settle does) on each test date and compares it with the same metric on the REST pose (the undeformed atlas), since many parts already touch or interpenetrate at rest. Each prints its worst offender per date, the
 * breaches (a worsening past the tolerance) and the worst over all dates; any breach fails the check. They also fail when a measurement is vacuous (a missing part, an empty hull), when the measured warp differs from engine.settle, or when
 * the GLSL/TS parity at scale is off. Geometry helpers: clip-geom.ts; the GPU harness: clip-gpu.ts (needs ANYHEALTH_PLAYWRIGHT, or ANYHEALTH_SKIP_GPU=1 to skip). ANYHEALTH_CLIP_DATES=a,b,… limits the dates while iterating
 * (the full set is the gate). Runtime about 2 min. */
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
/** Organ neighbours whose contact the scripts change (task-12-report: rectum and descending colon; Task 5: the newborn thymus): [organ, neighbours]. */
const NEIGHBOURS:[string,string[]][]=[
	['Rectum',['Urinary bladder','Prostate','Sacrum','Left seminal vesicle','Right seminal vesicle']],
	['Descending colon',['Left iliacus','Left hip bone','Left external oblique','Left psoas major','Left kidney','Spleen']],
	['Left lobe of thymus',['Manubrium','Body of sternum']],['Right lobe of thymus',['Manubrium','Body of sternum']],
];
/** Neighbour penetration may deepen at most this much beyond rest (Task 15b brief). */
const NEIGH_MM=1.5;
/** Per-pair limits on the worsening (mm), overriding NEIGH_MM. By design, the encopresis rectum (digestive#encopresis-rectum-dilation: the loaded rectum widens to 5–6 cm) indents the bladder, prostate and seminal vesicles in front of it:
 * those pairs are ratchets at the value measured in Task 15b + 0.5 mm, so a later change can only keep or reduce the indentation. Descending colon × external oblique was a warp artefact (Task 14c removed the axial deflation): ≤ 1 mm. */
const NEIGH_CAP:Record<string,number>={
	'Rectum ↔ Urinary bladder':5.1,'Rectum ↔ Prostate':5.3,'Rectum ↔ Left seminal vesicle':5.5,'Rectum ↔ Right seminal vesicle':6.0,
	'Descending colon ↔ Left external oblique':1,
};
const VERTEBRAE=['Atlas','Axis',...['Third','Fourth','Fifth','Sixth','Seventh'].map(o=>`${o} cervical vertebra`),...Ord.map(o=>`${o} thoracic vertebra`),...Ord.slice(0,5).map(o=>`${o} lumbar vertebra`),'Sacrum'];

// ── Tolerances (brief; each is applied to warped − rest) ──
/** Organs in a hull: at most 2% more vertices outside than at rest, and the farthest no more than 3 mm farther out than at rest. */
const HULL_FRAC=0.02,HULL_MM=3;
/** Thymus lobes (exempt from HULL_*): superior exits through the thoracic inlet are anatomically normal for the large infant thymus (Task 15b brief); an exit on any other side (anterior, lateral, posterior, inferior) at most 1 mm. */
const THYMUS_SIDE_MM=1,THYMUS=/lobe of thymus$/;
/** Parts with fewer vertices than this are measured on every vertex, not every SAMPLE-th: a single vertex of a small part (a segmental bronchial tree, a toe phalanx) would otherwise count several %. */
const SMALL=3000;
/** Skin containment counts a vertex as newly outside when it was inside the Skin at rest and is now more than this far outside it. */
const OUT_MM=0.5;
/** Eyes: globe centre within 1 mm of the rest-relative orbit centre; at most 1.5% of the globe vertices inside the Skin at rest newly (> OUT_MM) outside (the front of the globe sits in the Skin's eye pocket, exterior to the shell,
 * whose rim is ambiguous for any inside test: on 2026-01-02, a near-uniform scale of the rest model, 0.7% (left) and 1.1% (right) still flip, the noise floor); the cornea and each eyelid tarsal plate interpenetrate at most 0.5 mm deeper than at rest. */
const EYE_MM=1,GLOBE_FRAC=0.015,LID_MM=0.5;
/** Teeth: the root-end vertices stay within 1.5 mm of where the jaw carries them (the tooth's own fx applied in rest space, then the least-squares affine map of the jaw-bone vertices within 2.5 cm). */
const TOOTH_MM=1.5,JAW_R=0.025;
/** Bones in the skin: at most 0.5% of the vertices inside the Skin at rest end up (> OUT_MM) outside it, none more than 2 mm; the Mandible (the chin, Task 14c) none more than 1 mm. */
const BONE_FRAC=0.005,BONE_MM=2,MANDIBLE_MM=1;
/** Joints: parent and child maps agree within 1 mm; bone pairs across the joint (within 1 cm at rest) close by at most 1 mm more than the rest gap scaled by the smallest along / bone scale of the two segments (the most a uniform shrink could close it);
 * atlas × occipital and C7 / T1 (the axial remap's knots) at most 0.5 mm. */
const JOINT_MM=1,PAIR_NEAR=0.01,JOINT_ZONE=0.03,CROSS_MM=1,AXIAL_MM=0.5;
/** The axial joint pairs gated at AXIAL_MM: [label, part-name test for one side, for the other]. */
const AXIAL_PAIRS:[string,RegExp,RegExp][]=[['atlas × occipital',/^Atlas$/,/^Occipital bone$/],['C7 / T1',/^Seventh cervical vertebra$|^Intervertebral disk of seventh cervical vertebra$/,/^First thoracic vertebra$/]];
/** Vertebrae and disks: penetration between neighbours at most 1 mm deeper than at rest. */
const VERT_MM=1;
/** The spinal column top to bottom, each vertebra followed by its disk (below it) when the atlas has one. */
const disk=(v:string)=>`Intervertebral disk of ${v==='Axis'?'axis':v.toLowerCase()}`;
/** Skin grid cell (metres): 5 mm keeps the nearest-triangle searches near the dense face and eyelid mesh short. */
const SKIN_CELL=0.005;
/** Every Nth vertex for the skin-containment, hull and penetration tests. */
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
/** The body side a hull face normal points to (+x = the body's left, +y superior, +z anterior). */
const exitSide=(n:[number,number,number])=>{const a=n.map(Math.abs),j=a.indexOf(Math.max(...a));return [['right','left'],['inferior','superior'],['posterior','anterior']][j][n[j]>0?1:0];};
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
	const only=process.env.ANYHEALTH_CLIP_DATES?.split(',');
	return [...m].sort((a,b)=>a[0]<b[0]?-1:1).filter(([date])=>!only||only.includes(date)).map(([date,l])=>({date,label:l.length?l.join(', '):''}));
}

// ── The per-date measurements (one pass per date, cached) ──
/** Hull containment: vertices out, the farthest out, and the exit side of each out vertex (dominant axis of the exit face normal). */
interface HullStat {out:number;maxOut:number;n:number;/** per exit side: vertices out through it and the farthest (metres) */exits:Record<string,{n:number;max:number}>}
/** Skin containment of a vertex set: n tested, outside now, `inRest` = inside at rest, newly outside (inside at rest, now more than OUT_MM outside) and the farthest of those (mm, over all of them). */
interface SkinStat {n:number;outside:number;inRest:number;newOut:number;worstMM:number}
interface Measure {
	date:string|null;
	chest:Map<string,HullStat>;abd:Map<string,HullStat>;
	/** Per side: globe centre deviation (metres), Skin containment of the globe, and cornea ↔ each eyelid tarsal plate penetration (metres, both ways). */
	eyes:Record<'Left'|'Right',{dev:number;lids:Record<'upper'|'lower',number>}&SkinStat>;
	/** Visible teeth: the largest root-end vertex displacement from where the jaw carries it (metres). */
	teeth:Map<string,number>;
	/** The same without the tooth's own fx (the eruption offset shows): proves the metric can see a tooth leave its seat. */
	teethNoFx:Map<string,number>;
	bones:Map<string,SkinStat>;
	/** Rest only: per part, 1 where a (sampled) vertex is inside the Skin. */
	flags:Map<number,Uint8Array>;
	/** Per joint: parent vs child joint point error; the most-closed pair: gap now, rest gap, and gap − rest gap × the smallest along / bone scale of the two segments. */
	joints:{id:string;err:number;minD:number;gap:number;restGap:number;pair:string;/** the smallest absolute gap over the joint's pairs (metres; negative = the bones cross) */minGap:number}[];
	/** AXIAL_PAIRS: the most-closed pair's rest-relative closure (metres) and its pair count, over every joint's pairs. */
	axial:Map<string,{minD:number;pairs:number}>;
	/** Neighbouring vertebra / disk pairs: penetration depth, both ways (metres). */
	vert:Map<string,number>;
	/** Rest only: the Skin shell's triangle classes. */
	skinOuter:Uint8Array|null;
	/** Rest only: the rest Skin grid (the winding-number confirmation of a newly-outside vertex needs its rest position against the rest Skin). */
	skinGrid:TriGrid|null;
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
		for(const nm of names){let o=0,n=0,mx=0,any=false;const exits:HullStat['exits']={};for(const i of g.indicesOf(nm)){if(!visibleOn(pose,i))continue;any=true;const P=sel?sel(i):W(i),st=sel||P.length/3<SMALL?1:SAMPLE;for(let k=0;k<P.length;k+=3*st){const d=h.dist(P[k],P[k+1],P[k+2])-inflate;n++;if(d>0){o++;if(d>mx)mx=d;const e=exitSide(h.exitNormal(P[k],P[k+1],P[k+2])),x=exits[e]??={n:0,max:0};x.n++;x.max=Math.max(x.max,d);}}}if(any)out.set(nm,{out:o,n,maxOut:mx,exits});}
		return out;
	};
	// 1 · organs in the rib cage; 2 · abdominal organs in the pelvis / abdomen hull (+1 cm anterior).
	const heart=s.names((nm,i)=>g.atlas.parts[i].system==='cardiac'&&!NOT_HEART.test(nm)),airway=s.names(nm=>/bronchial tree$|main bronchus$/.test(nm));
	const chest=inHull(hullFrom(RIB_HULL),[...heart,...airway,'Left lobe of thymus','Right lobe of thymus']);
	const abd=inHull(hullFrom(ABD_HULL,0.01),ABD_ORGANS);
	// Skin grid (all of it; the other parts test against it). The shell's inner / outer triangle classes come from the rest mesh.
	const skinI=g.indicesOf('Skin')[0],skin=new TriGrid(W(skinI),g.parts[skinI].index,SKIN_CELL,{shell:true,outer:rest?.skinOuter??undefined}),flags=new Map<number,Uint8Array>();
	/** Skin containment of the named parts' visible vertices (every `stride`-th), per vertex against the rest flags. */
	const skinStat=(names:string[],stride:number):SkinStat=>{
		let n=0,outside=0,inRest=0,newOut=0,worst=0;
		for(const nm of names)for(const i of g.indicesOf(nm)){if(!visibleOn(pose,i))continue;const P=W(i),rf=rest?.flags.get(i),st=P.length/3<SMALL?1:stride,f=new Uint8Array(Math.ceil(P.length/3/st));
			for(let k=0,v=0;k<P.length;k+=3*st,v++){n++;const inside=skin.inside(P[k],P[k+1],P[k+2]);f[v]=+inside;if(rf?rf[v]:inside)inRest++;if(inside)continue;outside++;
				// Newly outside: inside at rest, now > OUT_MM from the Skin, and confirmed by the generalized winding number of the Skin's outer surface (≥ 0.5 at rest, < 0.5 now). The fast test is a ray vote, and a ray that also crosses
				// another sheet (an arm on the flank, the thighs at the perineum, the eye pocket) flips it: Task 15b found rib 7, hip bone and ethmoid vertices 4–18 mm deep inside the body (winding 0.97–1.00) voted outside.
				if(rf&&rf[v]){const d=skin.nearest(P[k],P[k+1],P[k+2],0.05),R=g.parts[i].position;if(d*MM>OUT_MM&&skin.winding(P[k],P[k+1],P[k+2])<0.5&&rest!.skinGrid!.winding(R[k],R[k+1],R[k+2])>=0.5){newOut++;if(d>worst)worst=d;}}}
			if(!rest)flags.set(i,f);}
		return {n,outside,inRest,newOut,worstMM:worst*MM};
	};
	// Penetration: the deepest vertex (every `stride`-th) of part a inside part b (parity), metres.
	const grids=new Map<string,TriGrid>(),grid=(nm:string)=>{let t=grids.get(nm);if(!t){const ix=s.byName([nm]),P=concat(ix.map(W));let o=0;const I:number[]=[];for(const i of ix){for(const v of g.parts[i].index)I.push(v+o);o+=g.parts[i].position.length/3;}t=new TriGrid(P,I,0.005,{parityOnly:true});grids.set(nm,t);}return t;};
	const depth=(a:string,b:string,stride=SAMPLE)=>{const t=grid(b);let d=0;for(const i of s.byName([a])){if(!visibleOn(pose,i))continue;const P=W(i);for(let k=0;k<P.length;k+=3*stride)if(t.inside(P[k],P[k+1],P[k+2]))d=Math.max(d,t.nearest(P[k],P[k+1],P[k+2],0.05));}return d;};
	// 3 · eyes: globe centre (warped sclera bounds centre) vs the rest-relative orbit centre, carried by a least-squares affine fit of the orbit-bone vertices within 2.5 cm of it; globe vertices outside the Skin.
	const eyes={} as Measure['eyes'];
	for(const side of ['Left','Right'] as const){
		const c0=GLOBE_CENTRE[side],rest:number[]=[],warped:number[]=[];
		for(const i of s.byName(ORBIT_BONES)){const R=g.parts[i].position,Wp=W(i);for(let k=0;k<R.length;k+=3)if(Math.hypot(R[k]-c0[0],R[k+1]-c0[1],R[k+2]-c0[2])<0.025){rest.push(R[k],R[k+1],R[k+2]);warped.push(Wp[k],Wp[k+1],Wp[k+2]);}}
		const want=affineFit(rest,warped)(c0),sc=W(g.indicesOf(`${side} sclera`)[0]),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
		for(let k=0;k<sc.length;k+=3)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],sc[k+j]);hi[j]=Math.max(hi[j],sc[k+j]);}
		const l=side.toLowerCase(),globe=[`${side} cornea`,`Anterior chamber of ${l} eyeball`,`${side} sclera`,`${side} vitreous body`,`${side} lens`],lid=(u:'upper'|'lower')=>{const plate=`Tarsal plate of ${l} ${u} eyelid`;return Math.max(depth(`${side} cornea`,plate,1),...globe.map(gp=>depth(plate,gp,1)));};
		eyes[side]={dev:Math.hypot(...[0,1,2].map(j=>(lo[j]+hi[j])/2-want[j])),lids:{upper:lid('upper'),lower:lid('lower')},...skinStat(s.names(x=>GLOBE.test(x)&&x.toLowerCase().includes(l)),SAMPLE)};
	}
	// 4 · teeth: the root-end 30% of each visible tooth's rest vertices (upper: highest, lower: lowest) vs where the jaw carries them: the tooth's own fx in rest space, then the least-squares affine map
	// (rest → warped) of the maxillae / mandible vertices within JAW_R of the root-end centroid. Rest: 0 by construction.
	const teeth=new Map<string,number>(),teethNoFx=new Map<string,number>(),q:Vec3=[0,0,0],nn:Vec3=[0,0,0];
	for(const t of TEETH)for(const i of g.indicesOf(t.part)){
		if(!visibleOn(pose,i))continue;const R=g.parts[i].position,Nr=g.parts[i].normal,Wt=W(i),up=t.arch==='upper',ys:number[]=[];for(let k=1;k<R.length;k+=3)ys.push(R[k]);ys.sort((a,b)=>a-b);
		const cut=up?ys[Math.floor(ys.length*0.7)]:ys[Math.floor(ys.length*0.3)],root:number[]=[];for(let v=0;v<R.length/3;v++)if(up?R[v*3+1]>=cut:R[v*3+1]<=cut)root.push(v);
		const c0=[0,1,2].map(j=>root.reduce((a,v)=>a+R[v*3+j],0)/root.length),jr:number[]=[],jw:number[]=[];
		for(const b of s.byName(up?['Left maxilla','Right maxilla']:['Mandible'])){const B=g.parts[b].position,Bw=W(b);for(let k=0;k<B.length;k+=3)if(Math.hypot(B[k]-c0[0],B[k+1]-c0[1],B[k+2]-c0[2])<JAW_R){jr.push(B[k],B[k+1],B[k+2]);jw.push(Bw[k],Bw[k+1],Bw[k+2]);}}
		const carry=affineFit(jr,jw),f=pose.fx.get(i)??identityFx(s.restCenter[i]);let mx=0,raw=0;
		for(const v of root){nn[0]=Nr[v*3]/127;nn[1]=Nr[v*3+1]/127;nn[2]=Nr[v*3+2]/127;applyFxPoint(f,[R[v*3],R[v*3+1],R[v*3+2]],nn,q);const e=carry(q),e0=carry([R[v*3],R[v*3+1],R[v*3+2]]);mx=Math.max(mx,Math.hypot(Wt[v*3]-e[0],Wt[v*3+1]-e[1],Wt[v*3+2]-e[2]));raw=Math.max(raw,Math.hypot(Wt[v*3]-e0[0],Wt[v*3+1]-e0[1],Wt[v*3+2]-e0[2]));}
		teeth.set(t.part,mx);teethNoFx.set(t.part,raw);
	}
	// 5 · bones in the Skin (every SAMPLE-th vertex).
	const boneNames=s.names((nm,i)=>g.atlas.parts[i].system==='skeletal'&&!NOT_BONE.test(nm)),bones=new Map<string,SkinStat>();
	for(const nm of boneNames){const st=skinStat([nm],SAMPLE);if(st.n)bones.set(nm,st);}
	// 6 · joints.
	const boneIdx=s.byName(boneNames),joints=jointPairs(s,boneIdx).map(J=>{
		let err=0;if(pose.ws){const a=warpPoint(pose.ws,[...J.joint],J.parent,J.parent,1,false,[0,0,0]),b=warpPoint(pose.ws,[...J.joint],J.child,J.child,1,false,[0,0,0]);err=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
		const w=pose.ws,sc=w?Math.min(w.alongScale[J.parent],w.boneScale[J.parent],w.alongScale[J.child],w.boneScale[J.child]):1;let minD=Infinity,gap=0,restGap=0,pair='',minGap=Infinity;
		for(const p of J.pairs){if(!visibleOn(pose,p.pa)||!visibleOn(pose,p.pb))continue;const A=W(p.pa),B=W(p.pb),gp=[0,1,2].reduce((x,j)=>x+(B[p.vb*3+j]-A[p.va*3+j])*p.dir[j],0),d=gp-p.d*sc;minGap=Math.min(minGap,gp);if(d<minD){minD=d;gap=gp;restGap=p.d;pair=`${g.atlas.parts[p.pa].name} / ${g.atlas.parts[p.pb].name}`;}}
		return {id:J.id,err,minD,gap,restGap,pair,minGap};
	});
	const axial=new Map<string,{minD:number;pairs:number}>(),scOf=(a:number,b:number)=>pose.ws?Math.min(pose.ws.alongScale[a],pose.ws.boneScale[a],pose.ws.alongScale[b],pose.ws.boneScale[b]):1;
	for(const [label,ta,tb] of AXIAL_PAIRS){let minD=Infinity,pairs=0;
		for(const J of jointPairs(s,boneIdx)){const sc=scOf(J.parent,J.child);for(const p of J.pairs){const na=g.atlas.parts[p.pa].name,nb=g.atlas.parts[p.pb].name;if(!((ta.test(na)&&tb.test(nb))||(tb.test(na)&&ta.test(nb))))continue;pairs++;
			if(!visibleOn(pose,p.pa)||!visibleOn(pose,p.pb))continue;const A=W(p.pa),B=W(p.pb),gp=[0,1,2].reduce((x,j)=>x+(B[p.vb*3+j]-A[p.va*3+j])*p.dir[j],0);minD=Math.min(minD,gp-p.d*sc);}}
		axial.set(label,{minD,pairs});}
	// Organ neighbours: the deepest (sampled) vertex of one part inside the other, both ways.
	const neigh=new Map<string,number>();for(const [a,bs] of NEIGHBOURS)for(const b of bs)neigh.set(`${a} ↔ ${b}`,Math.max(depth(a,b),depth(b,a)));
	// 7 · vertebrae and disks: penetration between neighbours down the column (vertebra ↔ its disk ↔ the next vertebra, and vertebra ↔ next vertebra).
	const column=VERTEBRAE.flatMap(v=>g.indicesOf(disk(v)).length?[v,disk(v)]:[v]),vert=new Map<string,number>();
	for(let k=0;k+1<column.length;k++){const a=column[k],b=column[k+1];vert.set(`${a} / ${b}`,Math.max(depth(a,b),depth(b,a)));if(b.startsWith('Intervertebral')&&k+2<column.length){const c2=column[k+2];vert.set(`${a} / ${c2}`,Math.max(depth(a,c2),depth(c2,a)));}}
		return {date,chest,abd,eyes,teeth,teethNoFx,bones,flags,joints,axial,vert,neigh,skinOuter:rest?null:skin.outer,skinGrid:rest?null:skin};
}

// ── Reporting ──
const mm=(v:number)=>(v*MM).toFixed(1),pct=(v:number)=>(v*100).toFixed(1);
const log=(s:string)=>console.log(`     ${s}`);
/** One date's row: the printed line, the breaches, and optionally its worst value (larger = worse) with a label for the all-dates summary. */
interface Row {line:string;breaches:string[];worst?:{v:number;label:string}}
/** Run `row` over every test date: one line per date, the breaches, the worst over all dates; fails on any breach (hard gate), after `after` has printed its summary. */
async function perDate(c:CheckContext,title:string,row:(m:Measure,rest:Measure,date:string)=>Row,after?:()=>void){
	const rest=await measure(c,null),all:string[]=[];let worst:{v:number;label:string;date:string}|null=null;log(`${title} (warped vs rest; ✗ = a breach)`);
	for(const {date,label} of testDates()){const m=await measure(c,date),r=row(m,rest,date);all.push(...r.breaches.map(b=>`${date} ${b}`));if(r.worst&&(!worst||r.worst.v>worst.v))worst={...r.worst,date};
		log(`${date}${label?` [${label}]`:''} · ${r.line}${r.breaches.length?` · ✗ ${r.breaches.length}: ${r.breaches.join('; ')}`:''}`);}
	if(worst)log(`worst over all dates: ${worst.label} (${worst.date})`);after?.();log(`${all.length} breaches in total`);
	c.assert(!all.length,`${title}: ${all.length} breaches: ${all.slice(0,6).join('; ')}${all.length>6?' …':''}`);
}
const sidesOf=(e:HullStat['exits'])=>Object.entries(e).sort((a,b)=>b[1].max-a[1].max).map(([k,v])=>`${k} ${v.n} (≤${mm(v.max)} mm)`).join(', ');
/** Hull containment rows (checks 1, 2): worst part by distance worsening, with its exit sides; breaches = fraction out +HULL_FRAC or max out +tolerance vs rest. Thymus lobes: only exits on a non-superior side, at most THYMUS_SIDE_MM. */
function hullRow(m:Map<string,HullStat>,rest:Map<string,HullStat>,tolMM:number,fracTol:number):Row{
	let wv=-Infinity,line='';const breaches:string[]=[],thy:string[]=[];
	for(const [nm,st] of m){const r=rest.get(nm)??{out:0,n:1,maxOut:0,exits:{}};
		if(THYMUS.test(nm)){const side=Math.max(0,...Object.entries(st.exits).filter(([k])=>k!=='superior').map(([,v])=>v.max));thy.push(`${nm.split(' ')[0]} ${pct(st.out/st.n)}% out, max ${mm(st.maxOut)} mm${st.out?` [${sidesOf(st.exits)}]`:''}`);if(side*MM>THYMUS_SIDE_MM)breaches.push(`${nm} ${mm(side)} mm out on a non-superior side`);continue;}
		const df=st.out/st.n-r.out/r.n,dm=st.maxOut-r.maxOut;
		if(dm>wv){wv=dm;line=`worst ${nm}: out ${mm(st.maxOut)} mm (rest ${mm(r.maxOut)}), ${pct(st.out/st.n)}% out (rest ${pct(r.out/r.n)}%)${st.out?`; exits ${sidesOf(st.exits)}`:''}`;}
		if(dm*MM>tolMM||df>fracTol)breaches.push(`${nm} +${mm(dm)} mm / +${pct(df)}%`);}
	return {line:(line||'no visible parts')+(thy.length?` · thymus: ${thy.join('; ')}`:''),breaches,worst:{v:wv,label:line}};
}

export const checks:Check[]=[
	{name:'clipping: the measured geometry is what the engine settles (birth, fracture day 10, encopresis peak)',async run(c){
		const s=await setup(c),{engine,pickers}=nodeEngine(s.g),parts=s.byName(['Skin','Left lobe of thymus','Rectum','Descending colon','Left sclera','Mandible','Left humerus','Fifth thoracic vertebra','Left upper first secondary molar tooth','Left lower central secondary incisor tooth']);
		for(const date of ['2003-06-22',fromDays(toDays(FRACTURE_DATE)+10),peaks().find(p=>p.id.startsWith('encopresis'))!.date]){
			engine.update({date,visible:DEFAULT_VISIBLE,isolate:null,now:0});engine.settle();const pose=poseAt(s,date);let err=0;
			for(const i of parts){const a=warpPart(s,pose,i),b=pickers[i]!.geometry.getAttribute('position').array as Float32Array;for(let k=0;k<a.length;k++)err=Math.max(err,Math.abs(a[k]-b[k]));}
			log(`${date}: max |check warp − engine settle| = ${err.toExponential(2)} m over ${parts.length} parts`);c.assert(err<1e-6,`${date}: the clipping warp differs from engine.settle by ${err} m`);
		}
		log(`test dates: ${testDates().map(d=>d.date+(d.label?` (${d.label})`:'')).join(', ')}`);
	}},
	{name:'organs inside rib cage (heart, bronchial trees, main bronchi: ≤2% more out, ≤3 mm farther vs rest; thymus lobes: superior exits allowed, any other side ≤1 mm)',async run(c){
		const rest=await measure(c,null);c.assert(rest.chest.size>20,`only ${rest.chest.size} chest organs measured`);
		await perDate(c,'rib-cage hull',(m,r)=>hullRow(m.chest,r.chest,HULL_MM,HULL_FRAC));
	}},
	{name:'abdominal organs inside the abdomen (hull +1 cm anterior; same tolerances)',async run(c){
		const rest=await measure(c,null);c.assert(rest.abd.size===ABD_ORGANS.length,'abdominal organs');
		await perDate(c,'pelvis/abdomen hull',(m,r)=>hullRow(m.abd,r.abd,HULL_MM,HULL_FRAC));
	}},
	{name:'organ neighbours (rectum, descending colon, thymus): penetration ≤1.5 mm deeper than at rest; encopresis rectum ratchets; descending colon × external oblique ≤1 mm',async run(c){
		const rest=await measure(c,null);c.assert(rest.neigh.size>10,'neighbour pairs');for(const k of Object.keys(NEIGH_CAP))c.assert(rest.neigh.has(k),`NEIGH_CAP names an unmeasured pair ${k}`);
		log(`rest penetration: ${[...rest.neigh].map(([k,v])=>`${k} ${mm(v)} mm`).join(', ')}`);
		const peak=new Map<string,number>();
		await perDate(c,'neighbours',(m,r)=>{const b:string[]=[];let worst='',wv=-Infinity;for(const [k,v] of m.neigh){const rv=r.neigh.get(k)!,d=v-rv,tol=NEIGH_CAP[k]??NEIGH_MM;peak.set(k,Math.max(peak.get(k)??-Infinity,d));if(d>wv){wv=d;worst=`${k} ${mm(v)} mm (rest ${mm(rv)})`;}if(d*MM>tol)b.push(`${k} +${mm(d)} mm (limit ${tol})`);}return {line:`worst ${worst}`,breaches:b,worst:{v:wv,label:worst}};},
			()=>log(`largest worsening per capped pair: ${Object.entries(NEIGH_CAP).map(([k,t])=>`${k} +${mm(peak.get(k)!)} (limit ${t})`).join(', ')}`));
	}},
	{name:'eyes inside the orbits (globe centre ≤1 mm from the rest-relative orbit centre; ≤1.5% of the globe vertices inside the Skin at rest end up >0.5 mm outside it; cornea × eyelid tarsal plates ≤0.5 mm deeper than at rest)',async run(c){
		const rest=await measure(c,null);c.assert(rest.eyes.Left.n>1000&&rest.eyes.Right.n>1000,'globe vertices');
		log(`rest: globe vertices outside the Skin (the globe front sits in the Skin's eye pocket) L ${rest.eyes.Left.outside}/${rest.eyes.Left.n}, R ${rest.eyes.Right.outside}/${rest.eyes.Right.n}; cornea × tarsal plates L ${mm(rest.eyes.Left.lids.upper)} / ${mm(rest.eyes.Left.lids.lower)}, R ${mm(rest.eyes.Right.lids.upper)} / ${mm(rest.eyes.Right.lids.lower)} mm (upper / lower)`);
		const W={dev:0,frac:0,lid:-Infinity};
		await perDate(c,'orbits',(m,r)=>{const b:string[]=[];const line=(['Left','Right'] as const).map(sd=>{const e=m.eyes[sd],f=e.newOut/Math.max(1,e.inRest),lu=e.lids.upper-r.eyes[sd].lids.upper,ll=e.lids.lower-r.eyes[sd].lids.lower;W.dev=Math.max(W.dev,e.dev);W.frac=Math.max(W.frac,f);W.lid=Math.max(W.lid,lu,ll);
			if(e.dev*MM>EYE_MM)b.push(`${sd} centre ${mm(e.dev)} mm`);if(f>GLOBE_FRAC)b.push(`${sd} ${pct(f)}% newly outside, up to ${e.worstMM.toFixed(1)} mm`);for(const [u,d] of [['upper',lu],['lower',ll]] as const)if(d*MM>LID_MM)b.push(`${sd} cornea × ${u} tarsal plate +${mm(d)} mm`);
			return `${sd[0]} centre ${mm(e.dev)} mm, newly outside ${e.newOut}/${e.inRest} (${pct(f)}%, farthest ${e.worstMM.toFixed(1)} mm), lids ${mm(e.lids.upper)} / ${mm(e.lids.lower)} mm`;}).join(' · ');return {line,breaches:b};},
			()=>log(`worst over all dates: centre ${mm(W.dev)} mm, globe newly outside ${pct(W.frac)}%, cornea × tarsal plate +${mm(W.lid)} mm vs rest`));
	}},
	{name:'teeth seated (root-end 30% of each visible tooth within 1.5 mm of where the jaw carries it: own fx, then the affine fit of the jaw bone around it)',async run(c){
		const rest=await measure(c,null);c.assert(rest.teeth.size===TEETH.length,`teeth measured ${rest.teeth.size}`);c.assert([...rest.teeth.values()].every(v=>v<1e-6),'rest displacement is 0');
		// Sensitivity: at 10 y premolars and canines are erupting (ERUPT_TRAVEL 6 mm), so leaving the tooth's fx out of the expected position must show millimetres.
		const probe=await measure(c,'2013-06-22'),seen=Math.max(...probe.teethNoFx.values());log(`sensitivity: 2013-06-22 without the teeth's own fx, the largest root displacement is ${mm(seen)} mm (eruption offset)`);c.assert(seen>0.002,`the teeth metric does not see a ${mm(seen)} mm eruption offset`);
		await perDate(c,'teeth vs jaw',m=>{const b:string[]=[];let worst='',wv=-Infinity;for(const [nm,d] of m.teeth){if(d>wv){wv=d;worst=`${nm} ${mm(d)} mm`;}if(d*MM>TOOTH_MM)b.push(`${nm} ${mm(d)} mm`);}
			return {line:m.teeth.size?`${m.teeth.size} visible · worst ${worst}`:'no visible teeth',breaches:b,worst:{v:wv,label:worst}};});
	}},
	{name:'bones inside the skin (≤0.5% of the vertices inside the Skin at rest end up >0.5 mm outside it, none >2 mm; Mandible none >1 mm)',async run(c){
		const rest=await measure(c,null);c.assert(rest.bones.size>200,`bones measured ${rest.bones.size}`);
		const restOut=[...rest.bones].filter(([,b])=>b.outside/b.n>0.005).sort((a,b)=>b[1].outside/b[1].n-a[1].outside/a[1].n);
		log(`rest: ${restOut.length} bones already >0.5% outside the Skin (baseline, excluded vertex by vertex): ${restOut.slice(0,10).map(([n,b])=>`${n} ${pct(b.outside/b.n)}%`).join(', ')}`);
		let mand=0,far=0,farBy='';
		await perDate(c,'Skin containment',m=>{const b:string[]=[];let worst='',wv=-Infinity;
			for(const [nm,st] of m.bones){const f=st.newOut/Math.max(1,st.inRest),lim=nm==='Mandible'?MANDIBLE_MM:BONE_MM;if(nm==='Mandible')mand=Math.max(mand,st.worstMM);if(st.worstMM>far){far=st.worstMM;farBy=nm;}
				if(f>wv||(f===wv&&st.worstMM>0)){wv=f;worst=`${nm}: ${pct(f)}% newly outside, farthest ${st.worstMM.toFixed(1)} mm (${pct(st.outside/st.n)}% outside in all)`;}if(f>BONE_FRAC||st.worstMM>lim)b.push(`${nm} ${pct(f)}% / ${st.worstMM.toFixed(1)} mm`);}
			return {line:`worst ${worst} · Mandible ${(m.bones.get('Mandible')?.worstMM??0).toFixed(1)} mm`,breaches:b,worst:{v:wv,label:worst}};},
			()=>log(`farthest newly outside over all dates: ${far.toFixed(1)} mm (${farBy}); Mandible ${mand.toFixed(1)} mm`));
	}},
	{name:'joint seams (parent vs child joint point ≤1 mm; bones across each joint within 1 cm at rest close ≤1 mm beyond the rest gap × the segments\' smallest scale, atlas × occipital and C7 / T1 ≤0.5 mm; scapula × humerus never cross)',async run(c){
		const rest=await measure(c,null);c.assert(rest.joints.length===14,'14 joints');log(`pairs per joint: ${jointCache!.map(j=>`${j.id} ${j.pairs.length}`).join(', ')}; axial pairs: ${[...rest.axial].map(([k,v])=>`${k} ${v.pairs}`).join(', ')}`);
		for(const [k,v] of rest.axial)c.assert(v.pairs>0,`no ${k} pairs within ${PAIR_NEAR*100} cm at rest`);
		await perDate(c,'joints',m=>{const b:string[]=[];let we=0,wj='',wd=Infinity,wl='';
			for(const j of m.joints){if(j.err>we){we=j.err;wj=j.id;}if(j.minD<wd){wd=j.minD;wl=`${j.id} (${j.pair}) ${mm(j.minD)} mm: gap ${mm(j.gap)} (rest ${mm(j.restGap)})`;}if(j.err*MM>JOINT_MM)b.push(`${j.id} joint ${mm(j.err)} mm`);if(j.minD*MM<-CROSS_MM)b.push(`${j.id} ${mm(j.minD)} mm (${j.pair}, gap ${mm(j.gap)})`);}
			for(const [k,v] of m.axial)if(v.minD*MM<-AXIAL_MM)b.push(`${k} ${mm(v.minD)} mm`);
			// Task 14d: scapula × humerus never crosses (absolute gap ≥ 0).
			const sh=m.joints.filter(j=>j.id==='lUpperArm'||j.id==='rUpperArm');for(const j of sh)if(j.minGap<0)b.push(`${j.id} scapula × humerus crosses (gap ${mm(j.minGap)} mm)`);
			return {line:`joint point max ${mm(we)} mm${wj?` (${wj})`:''} · most closed ${wl} · ${[...m.axial].map(([k,v])=>`${k} ${mm(v.minD)}`).join(' · ')} mm · scapula × humerus gap ${sh.map(j=>`${j.id[0].toUpperCase()} ${Number.isFinite(j.minGap)?mm(j.minGap):'hidden'}`).join(' / ')} mm`,breaches:b,worst:{v:-wd,label:wl}};});
	}},
	{name:'vertebrae and disks don\'t interpenetrate (penetration between neighbours ≤1 mm deeper than at rest; scoliosis peak and every test date)',async run(c){
		const rest=await measure(c,null),sp=peaks().find(p=>p.id.startsWith('scoliosis'));c.assert(!!sp,'scoliosis peak');c.assert(rest.vert.size>40,`vertebral pairs ${rest.vert.size}`);log(`scoliosis peak ${sp!.date}; ${rest.vert.size} pairs; rest penetration > 1 mm: ${[...rest.vert].filter(([,v])=>v>0.001).map(([k,v])=>`${k} ${mm(v)}`).join(', ')||'none'}`);
		await perDate(c,'vertebrae / disks',(m,r)=>{const b:string[]=[];let worst='',wv=-Infinity;for(const [k,v] of m.vert){const rv=r.vert.get(k)!,d=v-rv;if(d>wv){wv=d;worst=`${k} ${mm(v)} mm (rest ${mm(rv)})`;}if(d*MM>VERT_MM)b.push(`${k} +${mm(d)} mm`);}
			return {line:`worst ${worst}`,breaches:b,worst:{v:wv,label:worst}};});
	}},
	{name:'fracture fragments vs callus at days 0, 10, 25, 45 (distal cap inside the callus shell or within 2 mm of the proximal cap; never fewer seated than in the rest pose)',async run(c){
		const s=await setup(c),res=fractureMeasure(s);c.assert(typeof res!=='string',String(res));
		for(const r of res as Exclude<typeof res,string>){log(`day ${r.day} (${r.date}): ${r.line}`);c.assert(!r.worse,`fracture day ${r.day}: fewer distal-cap vertices seated than in the rest pose`);}
	}},
	{name:'GLSL/TS parity at scale (2,048 real vertices from mixed-weight parts, real merged fx; max error < 1e-5 m)',async run(c){
		const s=await setup(c),r=await gpuParity(s.g,s.seg,s.segOff,s.soft,(date:string)=>{const p=poseAt(s,date);return {ws:p.ws!,fx:p.fx};},['2003-06-22',peaks().find(p=>p.id.startsWith('encopresis'))?.date??'2011-01-01']);
		for(const l of r.lines)log(l);if(r.skipped){c.assert(process.env.ANYHEALTH_SKIP_GPU==='1',`${r.lines[0]} — set ANYHEALTH_SKIP_GPU=1 to skip this check explicitly`);return;}
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
	const layer:CustomLayer=fractureLayer();if(!layer.init(ctx))return 'the fracture layer did not build with a fake LayerContext';
	const group=scene.getObjectByName('fracture'),meshes=(group?.children??[]) as T.Mesh[];
	if(meshes.length<5||!meshes.slice(2,5).every(m=>m instanceof T.Mesh))return `the fracture layer changed: expected head fragment, shaft fragment, head cap, shaft cap and callus meshes as the group's first 5 children, got ${meshes.length} children`;
	// Children in build order: head fragment, shaft fragment, head cap, shaft cap, callus, two clots. The caps' pose uniforms come from their onBeforeCompile.
	const poseOf=(m:T.Mesh)=>{const sh={uniforms:{} as Record<string,{value:T.Matrix4}>,vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <opaque_fragment>'};try{(m.material as T.Material).onBeforeCompile(sh as never,undefined as never);}catch(e){return null;}return sh.uniforms.uPose?.value instanceof T.Matrix4?sh.uniforms.uPose.value:null;};
	const capHead=meshes[2],capShaft=meshes[3],callus=meshes[4],Mp=poseOf(capHead),Md=poseOf(capShaft),seg=SEGMENTS.indexOf('lUpperArm'),out:{day:number;date:string;line:string;worse:boolean}[]=[];
	if(!Mp||!Md)return 'the fracture layer changed: the caps\' materials no longer expose a uPose Matrix4 uniform from onBeforeCompile';
	const posed=(m:T.Mesh,M:T.Matrix4|null)=>{const a=(m.geometry.getAttribute('position').array as Float32Array).slice();if(M){const v=new T.Vector3();for(let k=0;k<a.length;k+=3){v.fromArray(a,k).applyMatrix4(M);v.toArray(a,k);}}return a;};
	const warped=(a:Float32Array,ws:WarpState|null)=>{if(!ws)return a;const o=new Float32Array(a.length),q:Vec3=[0,0,0];for(let k=0;k<a.length;k+=3){warpPoint(ws,[a[k],a[k+1],a[k+2]],seg,seg,1,false,q);o.set(q,k);}return o;};
	const tris=(n:number)=>Uint32Array.from({length:n},(_,i)=>i);
	for(const day of [0,10,25,45]){
		const date=fromDays(toDays(FRACTURE_DATE)+day),body=bodyAt(date);layer.update(day,{systemVisible:()=>true,hiddenByIsolate:false,isolated:false,now:1e9,direction:0,ctx:{body,date}});
		const ws=warpState(rig,body),stat=(w:WarpState|null)=>{
			const dist=warped(posed(capShaft,Md),w),prox=warped(posed(capHead,Mp),w),pg=new TriGrid(prox,tris(prox.length/3),0.005,{parityOnly:true});
			let cg:TriGrid|null=null;if(callus.visible){const cp=warped(posed(callus,null),w);cg=new TriGrid(cp,callus.geometry.getIndex()!.array,0.005,{parityOnly:true});}
			let ok=0,n=0,worst=0,inCallus=0;for(let k=0;k<dist.length;k+=3){n++;const inside=!!cg&&cg.inside(dist[k],dist[k+1],dist[k+2]);if(inside)inCallus++;const d=pg.nearest(dist[k],dist[k+1],dist[k+2],0.05);if(inside||d<=0.002)ok++;else worst=Math.max(worst,d);}
			return {ok:ok/n,worst,inCallus:inCallus/n};
		};
		const w=stat(ws),r=stat(null);
		out.push({day,date,line:`${pct(w.ok)}% of distal-cap vertices seated (rest pose ${pct(r.ok)}%), ${pct(w.inCallus)}% inside the callus (rest ${pct(r.inCallus)}%), worst unseated ${mm(w.worst)} mm from the proximal cap (rest ${mm(r.worst)})${callus.visible?'':' · callus not yet visible'}${w.ok<r.ok-1e-9?' · ✗ worse than rest':''}`,worse:w.ok<r.ok-1e-9});
	}
	layer.dispose();return out;
}

/** For scratch probes (not used by the checks): the per-date pose and warp, as measured. */
export const clipDebug={setup,poseAt,warpPart,measure};
