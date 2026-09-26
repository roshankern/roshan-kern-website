import type {Check,CheckContext} from './harness';
import rig from '../growth/rig.json';
import {SEGMENTS,type Body,type Rig,type SegmentId,type Vec3} from '../types';
import {bodyAt} from '../growth/proportions';
import {warpState,warpPoint,warpNormal,segAt,axialRates,taperOf,MENTON_Y,AXIAL_WINDOW,AXIAL_GIRTH_WINDOW,SEG_STRIDE,AXIAL_SEGMENTS,type WarpState} from '../growth/warp';
import {growthFx,GLOBE_FRONT} from '../growth/organs';
import {eruptionFx,TEETH} from '../issues/teeth/eruption';
import {mergeFx,applyFxPoint,type ResolvedFx} from '../fx/part-fx';
import {toDays,fromDays} from '../../health/dates';
import {SOFT_SYSTEMS} from '../engine';
import {seamDefects,LIMB_REGIONS} from './seam';
import {trunkOnly,boneSegment} from '../growth/segment-map';
const R=rig as Rig;
export const checks:Check[]=[
	{name:'rig has all 15 segments with parents first',run(c){c.assert(R.segments.length===15,'count');R.segments.forEach((s,i)=>{c.assert(s.id===SEGMENTS[i],`order ${s.id}`);if(s.parent)c.assert(SEGMENTS.indexOf(s.parent)<i,`parent before ${s.id}`);});}},
	{name:'rig is left/right symmetric within 1.5 cm',run(c){for(const [l,r] of [['lUpperArm','rUpperArm'],['lForearm','rForearm'],['lThigh','rThigh'],['lShank','rShank'],['lHand','rHand'],['lFoot','rFoot']] as const){const a=R.segments.find(s=>s.id===l)!,b=R.segments.find(s=>s.id===r)!;c.near(a.joint[0],-b.joint[0],0.015,`${l} x`);c.near(a.joint[1],b.joint[1],0.015,`${l} y`);c.near(a.length,b.length,0.015,`${l} length`);}}},
	{name:'adult segment lengths are anatomically plausible',run(c){const L=(id:string)=>R.segments.find(s=>s.id===id)!.length;c.near(L('lUpperArm'),0.30,0.04,'humerus');c.near(L('lThigh'),0.44,0.05,'femur');c.near(L('lShank'),0.39,0.05,'tibia');c.near(R.stature,1.7297,0.003,'stature');}},
	{name:'segments.bin covers every vertex',async run(c){const g=await c.geometry();const fs=await import('node:fs');const n=fs.statSync('public/anyhealth/models/segments.bin').size;c.assert(n===g.parts.reduce((s,p)=>s+p.position.length/3,0)*SEG_STRIDE,'size');}},
	{name:'no active blend between non-adjacent segments',async run(c){const fs=await import('node:fs');const b=fs.readFileSync('public/anyhealth/models/segments.bin');const adj=(a:number,s:number)=>{const A=R.segments[a],S=R.segments[s];return a===s||A.parent===S.id||S.parent===A.id;};let bad=0;const pairs=new Set<string>();for(let i=0;i<b.length;i+=SEG_STRIDE){const a=b[i]&15,s=b[i]>>4;c.assert(a<15&&s<15,`segment index at vertex ${i/SEG_STRIDE}`);if(b[i+1]<0.98*255&&!adj(a,s)){bad++;pairs.add(`${SEGMENTS[a]}↔${SEGMENTS[s]}`);}}c.assert(bad===0,`${bad} vertices blend non-adjacent segments: ${[...pairs].join(', ')}`);}},
	{name:'trunk-only soft parts (segment-map TRUNK_ONLY: rib cage wall and vessels, genitals, pelvic floor) ride wholly on the trunk',async run(c){const g=await c.geometry(),fs=await import('node:fs'),b=fs.readFileSync(SEG_BIN);let off=0,parts=0,verts=0;
		g.parts.forEach((p,i)=>{const n=p.position.length/3,name=g.atlas.parts[i].name;if(trunkOnly(name)&&!boneSegment(name)){parts++;for(let v=0;v<n;v++){const k=off+v*SEG_STRIDE;c.assert(b[k]===0&&b[k+1]===255,`${name} vertex ${v}: segments ${b[k]&15}/${b[k]>>4} weight ${b[k+1]}`);verts++;}}off+=n*SEG_STRIDE;});
		c.assert(parts>=60,`only ${parts} trunk-only parts matched`);console.log(`     ${parts} trunk-only parts, ${verts} vertices`);}},
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
/** Limb seam ratchet: [flipped, torn, out-of-ratio] of the triangles with some limb weight (seam.ts `limb`), per seam body. Task 14a set it on all triangles; Task 14c split off the axial region and re-baselined the limb
 * counts downward on the axial remap and the thigh girth taper (Task 14a limb counts before the remap: birth 8132 / 8248 / 814, 6 y 429 / 2971 / 0 … the hand-built infants 1442 / 141 / 202 and 1084 / 34 / 45; Task 14a fix-round totals, e.g. birth 10800 / 9665 / 7749).
 * Task 14d (trunk-only weights, Jacobian-matched limb joints) lowered it again; LIMB_14C keeps the Task 14c entries that LIMB_GOAL is measured against.
 * The goal is 0; lower the entries as the warp improves, never raise them. '±2%' counts every triangle. */
const SEAM_RATCHET:Record<string,[number,number,number]>={
	'hand-built child (S .75, head 1.2, legs .9)':[54,21,0],
	'bodyAt 2003-06-22':[200,2124,434],
	'bodyAt 2004-06-22':[200,2014,287],
	'bodyAt 2006-06-22':[0,523,12],
	'bodyAt 2009-06-22':[0,938,0],
	'bodyAt 2013-06-22':[0,323,0],
	'bodyAt 2017-06-22':[0,360,0],
	'infant (S .3, head 2, legs 0.7)':[731,42,191],
	'infant (S .3, head 2, legs 0.8)':[372,10,43],
	'±2%':[8,207,0],
};
/** The Task 14c limb ratchet (flipped / torn / out-of-ratio), kept as the baseline of LIMB_GOAL. */
const LIMB_14C:Record<string,[number,number,number]>={
	'hand-built child (S .75, head 1.2, legs .9)':[54,73,0],'bodyAt 2003-06-22':[4422,7083,434],'bodyAt 2004-06-22':[3068,6715,287],'bodyAt 2006-06-22':[411,1744,12],'bodyAt 2009-06-22':[145,3127,0],
	'bodyAt 2013-06-22':[57,1078,0],'bodyAt 2017-06-22':[28,1201,0],'infant (S .3, head 2, legs 0.7)':[731,141,191],'infant (S .3, head 2, legs 0.8)':[372,34,43],
};
/** Task 14d gate on the bodyAt dates: limb torn at most 30% of LIMB_14C (a ≥ 70% cut) at every date; limb flipped ≤ 200 at birth and 1 y; from 3 y on the brief's goal is 0 flipped, and what is left must be mesh slivers
 * (rest altitude < 1.6 mm and aspect > 15, as R25 for the axial region) or Skin welds between segments the rig moves independently (region 'other': the resting hand / forearm on the thigh / flank with one vertex a hair off weight 1,
 * which seam.ts's frozen weld rule does not exclude), held by SEAM_RATCHET. [max flipped (null = only the sliver / weld rule), max torn]. */
const LIMB_GOAL=(label:string):[number|null,number]|null=>{const m=/^bodyAt (\d{4})/.exec(label);if(!m)return null;const age=+m[1]-2003;return [age<3?200:null,Math.floor(0.3*LIMB_14C[label][1])];};
/** Axial residual (Task 14c): [flipped, torn, out-of-ratio] of the trunk / neck / head triangles, per seam body. The goal was 0 and the remap cannot fold (det = g²·f′ > 0), but a discrete triangle can still invert or over-stretch:
 * - flipped (R25: accepted as a mesh-sliver limit; the gate asserts each is a sliver, rest altitude < 1.6 mm and aspect > 15): at birth 39 = 17 in the C7/T1 f′ window, 15 in the menton window (the steepest f″: ℓ_neck → ℓ_face),
 *   1 in the AO window and 6 below every f′ window (g curvature in the first girth window, 1.365–1.495 m); max altitude 1.52 mm, min aspect 28 (sternocleidomastoid, splenius, trachea, esophagus, pharyngeal constrictors).
 *   The hand-built infants: 8 menton, 3 AO, 2 C7, 2 below. A sliver of length L and altitude h inverts once the sag f″·L²/8 exceeds its warped altitude ≈ f′·h; slivers reach h/L = 1.6e-4, which no smooth f′ that lands on the knots can clear.
 * - torn: 0 since fix round 1 (face → cranium girth window widened to 1.54–1.72 m). The 14 y deflation tears of the papillary muscle and diaphragm went with the axial deflation clamp (growth/warp.ts).
 * Lower the entries as the warp improves, never raise them. */
const AXIAL_RESIDUAL:Record<string,[number,number,number]>={
	'hand-built child (S .75, head 1.2, legs .9)':[2,0,0],
	'bodyAt 2003-06-22':[39,0,0],
	'bodyAt 2004-06-22':[15,0,0],
	'bodyAt 2006-06-22':[6,0,0],
	'bodyAt 2009-06-22':[4,0,0],
	'bodyAt 2013-06-22':[1,0,0],
	'bodyAt 2017-06-22':[0,0,0],
	'infant (S .3, head 2, legs 0.7)':[15,0,0],
	'infant (S .3, head 2, legs 0.8)':[15,0,0],
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
	{name:'a hand-built body follows the segment formula (axial remap for the trunk, scale × along / girth for a limb; ground-invariant differences)',run(c){
		const b=oddBody(),ws=warpState(R,b),S=b.scale,seg=(id:SegmentId)=>R.segments[SEGMENTS.indexOf(id)],w=(p:Vec3,i:number,soft=false)=>warpPoint(ws,p,i,i,1,soft,[0,0,0]);
		const t=seg('trunk'),a=t.axis,q:Vec3=[1-a[0]*a[0],-a[1]*a[0],-a[2]*a[0]];// q = x̂ minus its component along the axis
		const p0:Vec3=[...t.joint],p1:Vec3=[t.joint[0]+0.1*a[0]+0.05*q[0],t.joint[1]+0.1*a[1]+0.05*q[1],t.joint[2]+0.1*a[2]+0.05*q[2]];
		// Trunk / neck / head follow the axial remap (Task 14c): in the trunk interval Δy′ = S·ℓ·Δy and Δxz′ = S·ℓ·k·Δy + S·γ·(Δxz − k·Δy) (k = the axis slope dxz/dy); soft tissue adds S(γs − γb)·min(1, dBone/ρ)·r, r = the horizontal offset from the rest axis at that height.
		const k=[a[0]/a[1],a[2]/a[1]],dy=p1[1]-p0[1],want=(i:number)=>i===1?S*b.length.trunk*dy:S*b.length.trunk*k[i>>1]*dy+S*b.boneGirth.trunk*(p1[i]-p0[i]-k[i>>1]*dy);
		for(const soft of [false,true]){const A=w(p0,0,soft),B=w(p1,0,soft);for(let i=0;i<3;i++)c.near(B[i]-A[i],want(i),1e-9,`trunk ${soft?'soft, no bone distance':'bone'} ${i}`);}
		const r:Vec3=[p1[0]-(p0[0]+k[0]*dy),0,p1[2]-(p0[2]+k[1]*dy)],rho=Math.hypot(...r);
		for(const d of [0.02,0.2]){const B=w(p1,0,false),I=warpPoint(ws,p1,0,0,1,true,[0,0,0],d),f=S*(b.softGirth.trunk-b.boneGirth.trunk)*Math.min(1,d/rho);for(let i=0;i<3;i++)c.near(I[i]-B[i],f*r[i],1e-9,`trunk soft inflation, dBone ${d} ${i}`);}
		{const B=w(p1,0,true),I=warpPoint(ws,p1,0,0,1,false,[0,0,0],0.02);for(let i=0;i<3;i++)c.near(I[i],B[i],1e-12,'bone parts ignore dBone');}
		// A limb segment past its joint taper (Task 14d, LIMB_TAPER) is affine: along × one rate ℓe (solved so the segment keeps length S·ℓ·L, checked below), perpendicular × S·γ, plus the radial inflation S(γs − γb)·min(1, dBone/ρ)·r from its axis.
		{const u=seg('lShank'),ui=SEGMENTS.indexOf('lShank'),ua=u.axis,uq:Vec3=[1-ua[0]*ua[0],-ua[1]*ua[0],-ua[2]*ua[0]],at=(t:number,q=0):Vec3=>[u.joint[0]+t*ua[0]+q*uq[0],u.joint[1]+t*ua[1]+q*uq[1],u.joint[2]+t*ua[2]+q*uq[2]];
			const t1=taperOf('lShank')[1],u0=at(t1+0.02),u1=at(t1+0.12,0.02),A=w(u0,ui),B=w(u1,ui),E=w(at(u.length),ui),J0=w(at(0),ui),ab=(P:number[],Q:number[])=>(Q[0]-P[0])*ua[0]+(Q[1]-P[1])*ua[1]+(Q[2]-P[2])*ua[2];
			const le=ab(A,E)/(u.length-t1-0.02);c.near(ab(A,B)/0.1,le,1e-6,'shank: one along rate past the taper');
			for(let i=0;i<3;i++)c.near(B[i]-A[i],0.1*le*ua[i]+S*0.02*b.boneGirth.lShank*uq[i],1e-7,`shank bone ${i}`);
			c.near(Math.hypot(E[0]-J0[0],E[1]-J0[1],E[2]-J0[2]),S*b.length.lShank*u.length,1e-6,'shank keeps its length S·ℓ·L through the taper');
			const ur=0.02*Math.hypot(...uq),I=warpPoint(ws,u1,ui,ui,1,true,[0,0,0],0.005),f=S*(b.softGirth.lShank-b.boneGirth.lShank)*Math.min(1,0.005/ur)*0.02;for(let i=0;i<3;i++)c.near(I[i]-B[i],f*uq[i],1e-7,`shank soft inflation ${i}`);}
		const h=seg('head'),hi=SEGMENTS.indexOf('head'),tip:Vec3=[h.joint[0]+h.axis[0]*h.length,h.joint[1]+h.axis[1]*h.length,h.joint[2]+h.axis[2]*h.length],J=w(h.joint,hi),T=w(tip,hi);
		c.near(Math.hypot(T[0]-J[0],T[1]-J[1],T[2]-J[2]),S*2.0*h.length,1e-5,'head length = S × 2 × rest (the rig axes are rounded to 5 digits)');
		const f=seg('lShank'),fi=SEGMENTS.indexOf('lShank'),end:Vec3=[f.joint[0]+f.axis[0]*f.length,f.joint[1]+f.axis[1]*f.length,f.joint[2]+f.axis[2]*f.length],F0=w(f.joint,fi),F1=w(end,fi);
		c.near(Math.hypot(F1[0]-F0[0],F1[1]-F0[1],F1[2]-F0[2]),S*0.7*f.length,1e-5,'shank length = S × 0.7 × rest');
	}},
	{name:'children stay attached: each joint maps to the same point under parent and child',run(c){for(const [label,body] of [['bodyAt 2008-01-01',bodyAt('2008-01-01')],['hand-built',oddBody()]] as const){const ws=warpState(R,body);R.segments.forEach((s,i)=>{if(!s.parent)return;const pi=SEGMENTS.indexOf(s.parent);const a:Vec3=[0,0,0],b:Vec3=[0,0,0];warpPoint(ws,s.joint,i,i,1,false,a);warpPoint(ws,s.joint,pi,pi,1,false,b);c.near(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),0,1e-6,`${label}: ${s.id} joint`);});}}},
	{name:'limb joints are Jacobian-matched (Task 14d): at each joint the child map\'s along rate is |J_parent·a| and its perpendicular block the parent\'s (symmetrised, projected); det > 0 along every limb; normals are the inverse transpose',run(c){
		const h=1e-5,jac=(ws:WarpState,i:number,p:Vec3)=>{const J:number[]=[];for(let k=0;k<3;k++){const a:Vec3=[...p],b:Vec3=[...p];a[k]+=h;b[k]-=h;const A=warpPoint(ws,a,i,i,1,false,[0,0,0]),B=warpPoint(ws,b,i,i,1,false,[0,0,0]);for(let r=0;r<3;r++)J[r*3+k]=(A[r]-B[r])/(2*h);}return J;};
		const mv=(J:number[],v:number[])=>[0,1,2].map(r=>J[r*3]*v[0]+J[r*3+1]*v[1]+J[r*3+2]*v[2]),det=(J:number[])=>J[0]*(J[4]*J[8]-J[5]*J[7])-J[1]*(J[3]*J[8]-J[5]*J[6])+J[2]*(J[3]*J[7]-J[4]*J[6]);
		for(const [label,body] of [['bodyAt 2003-06-22',bodyAt('2003-06-22')],['bodyAt 2009-06-22',bodyAt('2009-06-22')],['hand-built',oddBody()]] as const){const ws=warpState(R,body);
			R.segments.forEach((s,i)=>{if(i<AXIAL_SEGMENTS)return;const pi=SEGMENTS.indexOf(s.parent!),al=Math.hypot(...s.axis),a=s.axis.map(v=>v/al),JP=jac(ws,pi,s.joint),JC=jac(ws,i,s.joint);
				c.near(Math.hypot(...mv(JC,a)),Math.hypot(...mv(JP,a)),2e-5,`${label}: ${s.id} along rate at its joint`);
				const m=Math.abs(a[0])<0.6?[1,0,0]:[0,0,1],d=m[0]*a[0]+m[1]*a[1]+m[2]*a[2],e1=[m[0]-d*a[0],m[1]-d*a[1],m[2]-d*a[2]].map((v,_,x)=>v/Math.hypot(...x)),e2=[a[1]*e1[2]-a[2]*e1[1],a[2]*e1[0]-a[0]*e1[2],a[0]*e1[1]-a[1]*e1[0]];
				const blk=(J:number[],e:number[],f:number[])=>{const Je=mv(J,e),Jf=mv(J,f);return 0.5*(Je[0]*f[0]+Je[1]*f[1]+Je[2]*f[2]+Jf[0]*e[0]+Jf[1]*e[1]+Jf[2]*e[2]);};
				for(const [e,f,n] of [[e1,e1,'11'],[e1,e2,'12'],[e2,e2,'22']] as const)c.near(blk(JC,e,f),blk(JP,e,f),2e-5,`${label}: ${s.id} perpendicular block ${n} at its joint`);
				// det > 0 and the normal = the inverse transpose of the map, sampled from the parent side (t = −5 cm) to the child joint, off-axis by up to 6 cm.
				for(let t=-0.05;t<=s.length;t+=0.02)for(const q of [0,0.03,0.06]){const p:Vec3=[s.joint[0]+t*a[0]+q*e1[0],s.joint[1]+t*a[1]+q*e1[1],s.joint[2]+t*a[2]+q*e1[2]],J=jac(ws,i,p);c.assert(det(J)>0,`${label}: ${s.id} det ${det(J)} at t ${t.toFixed(2)}`);
					const n0=[0.3,0.5,0.8],Ji=[J[4]*J[8]-J[5]*J[7],J[5]*J[6]-J[3]*J[8],J[3]*J[7]-J[4]*J[6],J[2]*J[7]-J[1]*J[8],J[0]*J[8]-J[2]*J[6],J[1]*J[6]-J[0]*J[7],J[1]*J[5]-J[2]*J[4],J[2]*J[3]-J[0]*J[5],J[0]*J[4]-J[1]*J[3]],want=mv(Ji,n0),wl=Math.hypot(...want),got=warpNormal(ws,p,n0 as Vec3,i,i,1,[0,0,0]);
					for(let k=0;k<3;k++)c.near(got[k],want[k]/wl,1e-4,`${label}: ${s.id} normal ${k} at t ${t.toFixed(2)}`);}
			});}
	}},
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
	{name:'seam gate: the axial region (trunk / neck / head) stays at or below its residual and the limb seams at or below the ratchet (goal 0 for both)',async run(c){
		// Task 14c: the axial height remap (growth/warp.ts) is fold-free by construction (det J = g²·f′ > 0); what is left on the axial region is sliver curvature and the soft deflation (AXIAL_RESIDUAL). Limb seams (any vertex with limb weight) keep the Task 14a ratchet, re-baselined downward.
		// Triangles welding two segments the rig moves independently are excluded and counted (seam.ts `bridged`).
		const g=await c.geometry(),fs=await import('node:fs'),bin=fs.readFileSync(SEG_BIN),bad:string[]=[];
		for(const [label,b] of seamBodies()){const d=seamDefects(warpState(R,b),g,bin),top=[...d.byPart].sort((x,y)=>y[1]-x[1]).slice(0,4).map(([n,k])=>`${n} ${k}`).join(', '),A=d.axial,L=d.limb;
			const [f,t,o]=ratchetFor(c,label),ax=AXIAL_RESIDUAL[label];c.assert(!!ax,`AXIAL_RESIDUAL has no entry for "${label}"`);c.assert(d.bridged===SEAM_BRIDGED,`${label}: ${d.bridged} welded hand / forearm ↔ thigh / trunk Skin triangles excluded, expected exactly ${SEAM_BRIDGED}`);
			console.log(`     ${label}: axial ${A.flipped}/${A.torn}/${A.ratioOut} of ${A.triangles} (residual ${ax.join('/')}); limb ${L.flipped}/${L.torn}/${L.ratioOut} of ${L.triangles} (ratchet ${f}/${t}/${o}; ${d.bridged} welded excluded)${top?`; most in ${top}`:''}`);
			if(A.flipped>ax[0]||A.torn>ax[1]||A.ratioOut>ax[2])bad.push(`${label}: axial ${A.flipped}/${A.torn}/${A.ratioOut} > ${ax.join('/')}`);
			// R25: every axial flip left must be a mesh sliver (rest altitude < 1.6 mm and aspect > 15), so a real fold fails even while under the count. Where they sit: the f′ windows (C7/T1, menton, AO) or below them all (g curvature in the first girth window).
			const J=(id:SegmentId)=>R.segments[SEGMENTS.indexOf(id)].joint[1],ky=[J('neck'),MENTON_Y,J('head')],where=new Map<string,number>();
			for(const f of d.axialFlips){const k=ky.findIndex((y,j)=>Math.abs(f.y-y)<=AXIAL_WINDOW[j]),at=k>=0?['C7','menton','AO'][k]:f.y<ky[0]-AXIAL_WINDOW[0]?'below':'between';where.set(at,(where.get(at)??0)+1);
				if(!(f.alt<0.0016&&f.aspect>15))bad.push(`${label}: axial flip in ${f.part} at y ${f.y.toFixed(3)} is not a sliver (altitude ${(f.alt*1000).toFixed(2)} mm, aspect ${f.aspect.toFixed(1)})`);}
			if(d.axialFlips.length)console.log(`       axial flips by f′ window: ${[...where].map(([k,n])=>`${k} ${n}`).join(', ')}; max altitude ${(Math.max(...d.axialFlips.map(f=>f.alt))*1000).toFixed(2)} mm, min aspect ${Math.min(...d.axialFlips.map(f=>f.aspect)).toFixed(0)}`);
			console.log(`       limb by region (flipped/torn/out): ${LIMB_REGIONS.map(r=>{const x=d.limbByRegion[r];return `${r} ${x.flipped}/${x.torn}/${x.ratioOut}`;}).join(', ')}`);
			if(L.flipped>f||L.torn>t||L.ratioOut>o)bad.push(`${label}: limb ${L.flipped}/${L.torn}/${L.ratioOut} > ${f}/${t}/${o}`);
			const goal=LIMB_GOAL(label),sliver=(f:{alt:number;aspect:number})=>f.alt<0.0016&&f.aspect>15,real=d.limbFlips.filter(f=>!sliver(f)&&f.region!=='other');
			console.log(`       limb flips: ${d.limbFlips.filter(sliver).length} slivers, ${d.limbFlips.filter(f=>!sliver(f)&&f.region==='other').length} Skin welds ('other'), ${real.length} other${real.length?` (${real.slice(0,6).map(f=>`${f.part} [${f.region}] altitude ${(f.alt*1000).toFixed(1)} mm`).join(', ')})`:''}`);
			if(goal&&(goal[0]!==null&&L.flipped>goal[0]||L.torn>goal[1]))bad.push(`${label}: limb ${L.flipped} flipped / ${L.torn} torn > the Task 14d goal ${goal[0]??'slivers only'} / ${goal[1]}`);
			if(goal&&goal[0]===null&&real.length)bad.push(`${label}: ${real.length} limb flips are neither slivers nor Skin welds, e.g. ${real.slice(0,3).map(f=>`${f.part} [${f.region}] altitude ${(f.alt*1000).toFixed(1)} mm, aspect ${f.aspect.toFixed(0)}`).join('; ')}`);}
		c.assert(!bad.length,`seam defects (flipped/torn/out-of-ratio): ${bad.join('; ')}`);
	}},
	{name:'chin clearance: warped mandible bottom − max(warped clavicle tops, manubrium top) ≥ +1 cm at every seam date',async run(c){
		// Task 14c: the axial remap keeps rest height order (f′ > 0) and the neck / face rates are solved so the chin clears the collar bones by ≥ 1 cm (growth.md growth#face-cranium).
		const g=await c.geometry(),fs=await import('node:fs'),bin=fs.readFileSync(SEG_BIN),q:Vec3=[0,0,0],offs:number[]=[];let off=0;g.parts.forEach(p=>{offs.push(off);off+=p.position.length/3*SEG_STRIDE;});
		const extreme=(ws:WarpState,names:string[],lo:boolean)=>{let e=lo?Infinity:-Infinity;for(const name of names)for(const i of g.indicesOf(name)){const P=g.parts[i].position;for(let v=0;v<P.length/3;v++){const s=segAt(bin,offs[i],v);warpPoint(ws,[P[v*3],P[v*3+1],P[v*3+2]],s[0],s[1],s[2],false,q);e=lo?Math.min(e,q[1]):Math.max(e,q[1]);}}return e;};
		const bad:string[]=[];
		for(const [label,b] of seamBodies()){if(!label.startsWith('bodyAt'))continue;const ws=warpState(R,b),chin=extreme(ws,['Mandible'],true),collar=extreme(ws,['Left clavicle','Right clavicle','Manubrium'],false);
			c.assert(Number.isFinite(chin)&&Number.isFinite(collar),'mandible / clavicles / manubrium found');const cl=(chin-collar)*100;
			console.log(`     ${label}: chin clearance ${cl.toFixed(2)} cm (mandible min y ${chin.toFixed(4)}, collar top ${collar.toFixed(4)})`);if(!(cl>=1))bad.push(`${label} ${cl.toFixed(2)} cm`);}
		c.assert(!bad.length,`chin clearance under +1 cm: ${bad.join(', ')}`);
	}},
);

// ── Axial height remap (Task 14c) ──
checks.push(
	{name:'axial remap: the menton knot is the Mandible\'s lowest rest vertex, and the f′ windows do not overlap',async run(c){
		const g=await c.geometry();let lo=Infinity;for(const i of g.indicesOf('Mandible')){const p=g.parts[i].position;for(let k=1;k<p.length;k+=3)lo=Math.min(lo,p[k]);}
		c.near(MENTON_Y,lo,1e-6,'MENTON_Y');const J=(id:SegmentId)=>R.segments[SEGMENTS.indexOf(id)].joint[1],ky=[J('neck'),MENTON_Y,J('head')],[w1,w2,w3]=AXIAL_WINDOW;
		c.assert(ky[0]+w1<=ky[1]-w2+1e-9&&ky[1]+w2<=ky[2]-w3+1e-9&&J('trunk')<ky[0]-w1,`windows overlap: knots ${ky.join(', ')}, half-widths ${AXIAL_WINDOW.join(', ')}`);
		c.assert(AXIAL_GIRTH_WINDOW.every(([,w])=>w>0),'girth windows have positive width');
	}},
	{name:'axial remap: f′ stays between its interval rates, g > 0 (so det = g²·f′ > 0), and f lands on the piecewise-linear knot heights outside the windows',run(c){
		const J=(id:SegmentId)=>R.segments[SEGMENTS.indexOf(id)].joint[1],ky=[J('neck'),MENTON_Y,J('head')];
		for(const [label,b] of seamBodies()){const ws=warpState(R,b),S=b.scale,rate=[b.length.trunk,b.length.neck,b.faceLength??b.length.head,b.craniumLength??b.length.head].map(v=>S*v),q:Vec3=[0,0,0];
			const fy=(y:number)=>warpPoint(ws,[0,y,0],0,0,1,false,q)[1]-ws.ground;
			const pw=(y:number)=>{let f=S*J('trunk')+rate[0]*(y-J('trunk'));ky.forEach((k,i)=>{if(y>k)f+=(rate[i+1]-rate[i])*(y-k);});return f;};
			for(let y=0.6;y<=1.8;y+=0.001){const [fp,g]=axialRates(ws,y),i=ky.filter(k=>y>k).length,near=ky.findIndex((k,j)=>Math.abs(y-k)<AXIAL_WINDOW[j]);
				c.assert(g>0&&fp>0,`${label}: f′ ${fp}, g ${g} at y ${y.toFixed(3)}`);
				const lo=near<0?rate[i]:Math.min(rate[near],rate[near+1]),hi=near<0?rate[i]:Math.max(rate[near],rate[near+1]);c.assert(fp>=lo-1e-9&&fp<=hi+1e-9,`${label}: f′ ${fp} outside [${lo}, ${hi}] at y ${y.toFixed(3)}`);
				if(near<0)c.near(fy(y),pw(y),1e-7,`${label}: f(${y.toFixed(3)}) on the knot polyline`);}
		}
	}},
	{name:'axial remap: the face / cranium split keeps vertex → menton = S·length.head × the rest head height, with the face share of growth.md growth#face-cranium',run(c){
		const hF=R.segments[2].joint[1]-MENTON_Y,hC=R.stature-R.segments[2].joint[1],share=[[0,0.455],[1,0.442],[3,0.466],[10,0.506],[18,0.548]];
		for(const [age,phi] of share){const b=bodyAt(fromDays(toDays('2003-06-22')+Math.round(age*365.25))),f=b.faceLength!,k=b.craniumLength!;
			c.near(f*hF+k*hC,b.length.head*(hF+hC),1e-9,`head height at ${age} y`);c.near((f/k)*((1-phi)/phi)*(0.548/(1-0.548)),1,1e-3,`face : cranium rate at ${age} y`);}
		const A=bodyAt('2026-01-02');c.near(A.faceLength!,1,1e-9,'adult face');c.near(A.craniumLength!,1,1e-9,'adult cranium');c.near(A.faceGirth!,1,1e-9,'adult face girth');
	}},
	{name:'axial remap: eyes and teeth stay seated (eye growth keeps the corneal apex vertex, which lands on the warped anterior pole; every tooth within its rest gap + 0.5 mm of its jaw bone)',async run(c){
		const g=await c.geometry(),fs=await import('node:fs'),bin=fs.readFileSync(SEG_BIN),offs:number[]=[];let off=0;g.parts.forEach(p=>{offs.push(off);off+=p.position.length/3*SEG_STRIDE;});
		const warpPart=(ws:WarpState,i:number,fx?:ResolvedFx)=>{const P=g.parts[i].position,n=P.length/3,out=new Float64Array(n*3),q:Vec3=[0,0,0],z:Vec3=[0,0,1];for(let v=0;v<n;v++){const p:Vec3=[P[v*3],P[v*3+1],P[v*3+2]];if(fx)applyFxPoint(fx,p,z,p);const s=segAt(bin,offs[i],v);warpPoint(ws,p,s[0],s[1],s[2],false,q,s[3]);out.set(q,v*3);}return out;};
		const gap=(A:ArrayLike<number>,B:ArrayLike<number>)=>{let worst=0;for(let a=0;a<A.length;a+=9){let m=Infinity;for(let b=0;b<B.length;b+=3){const d=(A[a]-B[b])**2+(A[a+1]-B[b+1])**2+(A[a+2]-B[b+2])**2;if(d<m)m=d;}worst=Math.max(worst,Math.sqrt(m));}return worst;};
		const rest=(i:number)=>g.parts[i].position;
		for(const d of ['2003-06-22','2006-06-22','2009-06-22','2017-06-22']){const b=bodyAt(d),ws=warpState(R,b),fx=mergeFx([...growthFx(b),...eruptionFx(b)],g.indicesOf,i=>{const P=g.parts[i].position;let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let k=0;k<P.length;k+=3)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],P[k+j]);hi[j]=Math.max(hi[j],P[k+j]);}return [0,1,2].map(j=>(lo[j]+hi[j])/2) as Vec3;});
			for(const side of ['Left','Right'] as const){const i=g.indicesOf(`${side} cornea`)[0],f=fx.get(i)!,A=GLOBE_FRONT[side],q:Vec3=[0,0,0],W=warpPart(ws,i,f);
				applyFxPoint(f,[...A],[0,0,1],q);for(let j=0;j<3;j++)c.near(q[j],A[j],1e-9,`${d} ${side} eye growth keeps the anterior pole axis ${j}`);
				const R0=g.parts[i].position;let best=0;for(let k=3;k<R0.length;k+=3)if(R0[k+2]>R0[best+2])best=k; // the rest apex vertex (GLOBE_FRONT)
				warpPoint(ws,A,2,2,1,false,q);for(let j=0;j<3;j++)c.near(W[best+j],q[j],0.0005,`${d} ${side} warped corneal apex axis ${j}`);}
			for(const t of TEETH){const i=g.indicesOf(t.part)[0],f=fx.get(i);if(f&&f.visible<1)continue;const jaw=t.arch==='lower'?g.indicesOf('Mandible'):g.indicesOf(`${t.part.startsWith('Left')?'Left':'Right'} maxilla`);
				const r=gap(rest(i),jaw.length===1?rest(jaw[0]):new Float32Array(0)),w=gap(warpPart(ws,i,f?{...f,scale:[1,1,1],translate:[0,0,0]}:undefined),warpPart(ws,jaw[0]));c.assert(w<=r+0.0005,`${d} ${t.part}: warped gap to its jaw ${(w*1000).toFixed(2)} mm > rest ${(r*1000).toFixed(2)} mm + 0.5`);}
		}
	}},
);
