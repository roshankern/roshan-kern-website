import type {Check,CheckContext} from './harness';
import rig from '../growth/rig.json';
import {SEGMENTS,type Body,type Rig,type SegmentId,type Vec3} from '../types';
import {bodyAt} from '../growth/proportions';
import {warpState,warpPoint,segAt,SEG_STRIDE,type WarpState} from '../growth/warp';
import {SOFT_SYSTEMS} from '../engine';
import {seamDefects} from './seam';
const R=rig as Rig;
export const checks:Check[]=[
	{name:'rig has all 15 segments with parents first',run(c){c.assert(R.segments.length===15,'count');R.segments.forEach((s,i)=>{c.assert(s.id===SEGMENTS[i],`order ${s.id}`);if(s.parent)c.assert(SEGMENTS.indexOf(s.parent)<i,`parent before ${s.id}`);});}},
	{name:'rig is left/right symmetric within 1.5 cm',run(c){for(const [l,r] of [['lUpperArm','rUpperArm'],['lForearm','rForearm'],['lThigh','rThigh'],['lShank','rShank'],['lHand','rHand'],['lFoot','rFoot']] as const){const a=R.segments.find(s=>s.id===l)!,b=R.segments.find(s=>s.id===r)!;c.near(a.joint[0],-b.joint[0],0.015,`${l} x`);c.near(a.joint[1],b.joint[1],0.015,`${l} y`);c.near(a.length,b.length,0.015,`${l} length`);}}},
	{name:'adult segment lengths are anatomically plausible',run(c){const L=(id:string)=>R.segments.find(s=>s.id===id)!.length;c.near(L('lUpperArm'),0.30,0.04,'humerus');c.near(L('lThigh'),0.44,0.05,'femur');c.near(L('lShank'),0.39,0.05,'tibia');c.near(R.stature,1.7297,0.003,'stature');}},
	{name:'segments.bin covers every vertex',async run(c){const g=await c.geometry();const fs=await import('node:fs');const n=fs.statSync('public/anyhealth/models/segments.bin').size;c.assert(n===g.parts.reduce((s,p)=>s+p.position.length/3,0)*SEG_STRIDE,'size');}},
	{name:'no active blend between non-adjacent segments',async run(c){const fs=await import('node:fs');const b=fs.readFileSync('public/anyhealth/models/segments.bin');const adj=(a:number,s:number)=>{const A=R.segments[a],S=R.segments[s];return a===s||A.parent===S.id||S.parent===A.id;};let bad=0;const pairs=new Set<string>();for(let i=0;i<b.length;i+=SEG_STRIDE){const a=b[i]&15,s=b[i]>>4;c.assert(a<15&&s<15,`segment index at vertex ${i/SEG_STRIDE}`);if(b[i+1]<0.98*255&&!adj(a,s)){bad++;pairs.add(`${SEGMENTS[a]}↔${SEGMENTS[s]}`);}}c.assert(bad===0,`${bad} vertices blend non-adjacent segments: ${[...pairs].join(', ')}`);}},
];

// ── Body warp (Task 6) ──
/** A body with scale 1 and every factor 1: the rest model. */
const unitBody=():Body=>{const ones=()=>Object.fromEntries(SEGMENTS.map(s=>[s,1])) as Record<SegmentId,number>;return {date:'2026-01-01',ageYears:22,statureM:R.stature,weightKg:70,scale:1,length:ones(),boneGirth:ones(),softGirth:ones()};};
/** A deliberately non-identity body built by hand (not from bodyAt): small scale, a long head, short legs, slimmer bone and fuller soft tissue. */
const oddBody=():Body=>{const b=unitBody();b.scale=0.3;b.statureM=R.stature*0.3;b.length.head=2.0;for(const s of ['lThigh','lShank','lFoot','rThigh','rShank','rFoot'] as const)b.length[s]=0.7;for(const s of SEGMENTS){b.boneGirth[s]=0.9;b.softGirth[s]=1.25;}return b;};
/** A moderate hand-built child (about age 6-8). */
const childBody=():Body=>{const b=unitBody();b.scale=0.75;b.statureM=R.stature*0.75;b.length.head=1.2;for(const s of ['lThigh','lShank','lFoot','rThigh','rShank','rFoot'] as const)b.length[s]=0.9;for(const s of SEGMENTS){b.boneGirth[s]=0.9;b.softGirth[s]=1.0;}return b;};
/** S 0.75 with every segment's length / boneGirth / softGirth factor varied deterministically within ±x (different per segment and per field, so soft ≠ bone). */
const perturbedBody=(x:number):Body=>{const b=unitBody();b.scale=0.75;b.statureM=R.stature*0.75;SEGMENTS.forEach((s,i)=>{const u=(f:number)=>Math.sin(12.9898*(i+1)+78.233*(f+1)*1.7);b.length[s]=1+x*u(0);b.boneGirth[s]=1+x*u(1);b.softGirth[s]=1+x*u(2);});return b;};
/** Seam tolerance of the current segments.bin weights, from a sweep of perturbedBody(x) (Task 6 fix round 2): x = 0.0006 (±0.06%) is the largest with 0 defects; 0.0007 flips one Glans penis triangle; 0.002 → 2 flipped / 36 torn; 0.02 → 63 / 266 / 8. Effectively 0, so the hard list carries 0.8·x and a ratchet guards ±2%. */
const SEAM_X=0.0006;
/** Seam ratchet (Task 14a; re-baselined in fix round 1 on the Task 14b bodyAt, anyhealth-timeline 29a9895): [flipped, torn, out-of-ratio] per seam body. The goal is 0 for every entry; lower them as the warp improves, never raise them.
 * The residual is structural at birth / 1 y: the per-segment bone maps put the warped mandible at or below the clavicle / manubrium tops (see KNOWN(axial remap)), so no weighting can reach 0 there (Task 14c: axial height remap). Before Task 14a, 3 y was 2052 / 5532 / 332. */
const SEAM_RATCHET:Record<string,[number,number,number]>={
	'hand-built child (S .75, head 1.2, legs .9)':[285,73,0],
	'bodyAt 2003-06-22':[10800,9665,7749],
	'bodyAt 2004-06-22':[6040,9661,881],
	'bodyAt 2006-06-22':[1063,2919,42],
	'bodyAt 2009-06-22':[574,3468,0],
	'bodyAt 2013-06-22':[341,1279,0],
	'bodyAt 2017-06-22':[233,1472,0],
	'infant (S .3, head 2, legs 0.7)':[3198,141,308],
	'infant (S .3, head 2, legs 0.8)':[2840,34,151],
	'±2%':[16,216,0],
};
/** Skin triangles welded between a resting hand / forearm and the thigh / trunk that seamDefects excludes (seam.ts). Frozen: any change means the weights or the mesh changed. */
const SEAM_BRIDGED=65;
/** The ratchet entry for a label, or a clear failure when there is none. */
const ratchetFor=(c:CheckContext,label:string):[number,number,number]=>{const r=SEAM_RATCHET[label];c.assert(!!r,`SEAM_RATCHET has no entry for "${label}": measure it and add one`);return r??[0,0,0];};
/** The seam gate's bodies: bodyAt at birth, 1, 3, 6, 10 and 14 y, the hand-built child and the two hand-built infants (S .3, head 2, bone .9 / soft 1.25). */
export const seamBodies=():[string,Body][]=>{
	const out:[string,Body][]=[['hand-built child (S .75, head 1.2, legs .9)',childBody()],...['2003-06-22','2004-06-22','2006-06-22','2009-06-22','2013-06-22','2017-06-22'].map(d=>[`bodyAt ${d}`,bodyAt(d)] as [string,Body])];
	for(const legs of [0.7,0.8]){const b=oddBody();for(const s of ['lThigh','lShank','lFoot','rThigh','rShank','rFoot'] as const)b.length[s]=legs;out.push([`infant (S .3, head 2, legs ${legs})`,b]);}
	return out;
};
const SEG_BIN='public/anyhealth/models/segments.bin';
/** Visit every `stride`-th vertex of every part with its segment weights and bone distance from segments.bin (growth/warp.ts SEG_STRIDE). */
async function eachVertex(c:CheckContext,stride:number,fn:(p:Vec3,segA:number,segB:number,wA:number,soft:boolean,dBone:number)=>void){
	const g=await c.geometry(),fs=await import('node:fs'),b=fs.readFileSync(SEG_BIN),p:Vec3=[0,0,0];let off=0;
	g.parts.forEach((part,i)=>{const n=part.position.length/3,soft=SOFT_SYSTEMS.includes(g.atlas.parts[i].system);for(let v=0;v<n;v+=stride){const k=v*3;p[0]=part.position[k];p[1]=part.position[k+1];p[2]=part.position[k+2];const s=segAt(b,off,v);fn(p,s[0],s[1],s[2],soft,s[3]);}off+=n*SEG_STRIDE;});
}
/** Warped floor (min y) and top (max y) over every 7th vertex. */
async function extent(c:CheckContext,ws:WarpState){let lo=Infinity,hi=-Infinity;const q:Vec3=[0,0,0];await eachVertex(c,7,(p,a,b,w,soft,d)=>{warpPoint(ws,p,a,b,w,soft,q,d);if(q[1]<lo)lo=q[1];if(q[1]>hi)hi=q[1];});return {lo,hi};}
checks.push(
	{name:'identity body leaves every point unchanged',run(c){const ws=warpState(R,unitBody());const out:Vec3=[0,0,0];for(const p of [[0,1,0],[0.2,1.3,0],[0.1,0.4,0]] as Vec3[])for(const soft of [false,true]){warpPoint(ws,p,0,3,0.5,soft,out);c.near(out[0],p[0],1e-9,'x');c.near(out[1],p[1],1e-9,'y');c.near(out[2],p[2],1e-9,'z');}}},
	{name:'a hand-built body follows the segment formula (scale × along / girth, ground-invariant differences)',run(c){
		const b=oddBody(),ws=warpState(R,b),S=b.scale,seg=(id:SegmentId)=>R.segments[SEGMENTS.indexOf(id)],w=(p:Vec3,i:number,soft=false)=>warpPoint(ws,p,i,i,1,soft,[0,0,0]);
		const t=seg('trunk'),a=t.axis,q:Vec3=[1-a[0]*a[0],-a[1]*a[0],-a[2]*a[0]];// q = x̂ minus its component along the axis
		const p0:Vec3=[...t.joint],p1:Vec3=[t.joint[0]+0.1*a[0]+0.05*q[0],t.joint[1]+0.1*a[1]+0.05*q[1],t.joint[2]+0.1*a[2]+0.05*q[2]];
		// One bone-girth map for every vertex; soft tissue adds S(γs − γb)·min(1, dBone/ρ)·r (r = the rest offset from the axis, ρ = |r|).
		for(const soft of [false,true]){const A=w(p0,0,soft),B=w(p1,0,soft);for(let k=0;k<3;k++)c.near(B[k]-A[k],S*(0.1*b.length.trunk*a[k]+0.05*b.boneGirth.trunk*q[k]),1e-7,`trunk ${soft?'soft, no bone distance':'bone'} ${k}`);}
		const rho=0.05*Math.hypot(...q);
		for(const d of [0.02,0.2]){const B=w(p1,0,false),I=warpPoint(ws,p1,0,0,1,true,[0,0,0],d),f=S*(b.softGirth.trunk-b.boneGirth.trunk)*Math.min(1,d/rho)*0.05;for(let k=0;k<3;k++)c.near(I[k]-B[k],f*q[k],1e-7,`trunk soft inflation, dBone ${d} ${k}`);}
		{const B=w(p1,0,true),I=warpPoint(ws,p1,0,0,1,false,[0,0,0],0.02);for(let k=0;k<3;k++)c.near(I[k],B[k],1e-12,'bone parts ignore dBone');}
		const h=seg('head'),hi=SEGMENTS.indexOf('head'),tip:Vec3=[h.joint[0]+h.axis[0]*h.length,h.joint[1]+h.axis[1]*h.length,h.joint[2]+h.axis[2]*h.length],J=w(h.joint,hi),T=w(tip,hi);
		c.near(Math.hypot(T[0]-J[0],T[1]-J[1],T[2]-J[2]),S*2.0*h.length,1e-5,'head length = S × 2 × rest (the rig axes are rounded to 5 digits)');
		const f=seg('lShank'),fi=SEGMENTS.indexOf('lShank'),end:Vec3=[f.joint[0]+f.axis[0]*f.length,f.joint[1]+f.axis[1]*f.length,f.joint[2]+f.axis[2]*f.length],F0=w(f.joint,fi),F1=w(end,fi);
		c.near(Math.hypot(F1[0]-F0[0],F1[1]-F0[1],F1[2]-F0[2]),S*0.7*f.length,1e-5,'shank length = S × 0.7 × rest');
	}},
	{name:'children stay attached: each joint maps to the same point under parent and child',run(c){for(const [label,body] of [['bodyAt 2008-01-01',bodyAt('2008-01-01')],['hand-built',oddBody()]] as const){const ws=warpState(R,body);R.segments.forEach((s,i)=>{if(!s.parent)return;const pi=SEGMENTS.indexOf(s.parent);const a:Vec3=[0,0,0],b:Vec3=[0,0,0];warpPoint(ws,s.joint,i,i,1,false,a);warpPoint(ws,s.joint,pi,pi,1,false,b);c.near(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),0,1e-6,`${label}: ${s.id} joint`);});}}},
	{name:'warped stature equals bodyAt stature and feet stay on the floor',async run(c){
		for(const d of ['2003-06-22','2006-06-22','2012-01-01','2026-01-02']){const b=bodyAt(d),{lo,hi}=await extent(c,warpState(R,b));c.near(lo,0,0.003,`floor ${d}`);c.near(hi-lo,b.statureM,b.statureM*0.01,`stature ${d}`);}
		const {lo}=await extent(c,warpState(R,oddBody()));c.near(lo,0,0.003,'floor, hand-built body');
	}},
	{name:'warp is continuous across segment weights (no seam tears > 1 mm, no flipped triangles)',async run(c){
		// seamDefects: flipped faces, edges longer than rest × max segment scale + 1 mm, edge ratios outside [0.2, 5] × max segment scale.
		const g=await c.geometry(),fs=await import('node:fs'),bin=fs.readFileSync(SEG_BIN);
		const uniform=unitBody();uniform.scale=0.75;uniform.statureM=R.stature*0.75;
		for(const [label,body] of [['uniform scale 0.75',uniform],[`perturbed ±${(0.8*SEAM_X*100).toFixed(3)}% (0.8 × the measured zero-defect limit)`,perturbedBody(0.8*SEAM_X)],['bodyAt 2026-01-02 (adult)',bodyAt('2026-01-02')]] as const){
			const d=seamDefects(warpState(R,body),g,bin);c.assert(d.triangles>0,'no mixed-weight triangles found');
			c.assert(d.flipped===0&&d.torn===0&&d.ratioOut===0,`${label}: ${d.flipped} flipped, ${d.torn} torn, ${d.ratioOut} out-of-ratio of ${d.triangles} triangles (e.g. ${d.worst})`);
		}
	}},
	{name:'seam ratchet: a ±2% perturbed body has no more seam defects than measured (goal 0)',async run(c){
		const g=await c.geometry(),fs=await import('node:fs'),d=seamDefects(warpState(R,perturbedBody(0.02)),g,fs.readFileSync(SEG_BIN)),[f,t,o]=ratchetFor(c,'±2%');
		console.log(`     ±2%: ${d.flipped} flipped, ${d.torn} torn, ${d.ratioOut} out-of-ratio (ratchet ${f}/${t}/${o})`);
		c.assert(d.flipped<=f&&d.torn<=t&&d.ratioOut<=o,`±2%: ${d.flipped} flipped, ${d.torn} torn, ${d.ratioOut} out-of-ratio (e.g. ${d.worst}) > ratchet ${f}/${t}/${o}`);
	}},
	{name:'seam ratchet: real child bodies (birth, 1, 3, 6, 10, 14 y) and the hand-built child / infant bodies have no more seam defects than measured (goal 0)',async run(c){
		// Task 14a (Ruling 15): joint-plane distance-field weights + one bone-girth map with a radial soft inflation. Triangles welding two segments the rig moves independently are excluded and counted (seam.ts `bridged`).
		const g=await c.geometry(),fs=await import('node:fs'),bin=fs.readFileSync(SEG_BIN),bad:string[]=[];
		for(const [label,b] of seamBodies()){const d=seamDefects(warpState(R,b),g,bin),top=[...d.byPart].sort((x,y)=>y[1]-x[1]).slice(0,4).map(([n,k])=>`${n} ${k}`).join(', ');
			const [f,t,o]=ratchetFor(c,label);c.assert(d.bridged===SEAM_BRIDGED,`${label}: ${d.bridged} welded hand / forearm ↔ thigh / trunk Skin triangles excluded, expected exactly ${SEAM_BRIDGED}`);
			console.log(`     ${label}: ${d.flipped} flipped, ${d.torn} torn, ${d.ratioOut} out-of-ratio of ${d.triangles} (${d.bridged} welded triangles excluded; ratchet ${f}/${t}/${o})${top?`; most in ${top}`:''}`);
			if(d.flipped>f||d.torn>t||d.ratioOut>o)bad.push(`${label}: ${d.flipped}/${d.torn}/${d.ratioOut} > ${f}/${t}/${o}`);}
		c.assert(!bad.length,`seam defects above the ratchet (flipped/torn/out-of-ratio): ${bad.join('; ')}`);
	}},
	{name:'KNOWN(axial remap): chin clearance = warped mandible bottom − max(warped clavicle tops, manubrium top) per seam date',async run(c){
		// Reports only (expected negative at birth / 1 y: the per-segment bone maps sink the chin below the collar bones). Task 14c (axial height remap) makes it hard: > +1 cm at every date.
		const g=await c.geometry(),fs=await import('node:fs'),bin=fs.readFileSync(SEG_BIN),q:Vec3=[0,0,0],offs:number[]=[];let off=0;g.parts.forEach(p=>{offs.push(off);off+=p.position.length/3*SEG_STRIDE;});
		const extreme=(ws:WarpState,names:string[],lo:boolean)=>{let e=lo?Infinity:-Infinity;for(const name of names)for(const i of g.indicesOf(name)){const P=g.parts[i].position;for(let v=0;v<P.length/3;v++){const s=segAt(bin,offs[i],v);warpPoint(ws,[P[v*3],P[v*3+1],P[v*3+2]],s[0],s[1],s[2],false,q);e=lo?Math.min(e,q[1]):Math.max(e,q[1]);}}return e;};
		for(const [label,b] of seamBodies()){if(!label.startsWith('bodyAt'))continue;const ws=warpState(R,b),chin=extreme(ws,['Mandible'],true),collar=extreme(ws,['Left clavicle','Right clavicle','Manubrium'],false);
			c.assert(Number.isFinite(chin)&&Number.isFinite(collar),'mandible / clavicles / manubrium found');
			console.log(`     KNOWN ${label}: chin clearance ${((chin-collar)*100).toFixed(2)} cm (mandible min y ${chin.toFixed(4)}, collar top ${collar.toFixed(4)})`);}
	}},
);
