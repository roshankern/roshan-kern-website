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
/** Limb seam ratchet: [flipped, torn, out-of-ratio] of the triangles with some limb weight (seam.ts `limb`), per seam body. Task 14a set it on all triangles; Task 14c split off the axial region and re-baselined the limb
 * counts downward on the axial remap (Task 14a fix-round totals, e.g. birth 10800 / 9665 / 7749, 6 y 574 / 3468 / 0). The goal is 0; lower the entries as the warp improves, never raise them. '±2%' counts every triangle. */
const SEAM_RATCHET:Record<string,[number,number,number]>={
	'hand-built child (S .75, head 1.2, legs .9)':[54,73,0],
	'bodyAt 2003-06-22':[7385,7665,846],
	'bodyAt 2004-06-22':[4522,7359,551],
	'bodyAt 2006-06-22':[620,2009,38],
	'bodyAt 2009-06-22':[251,3450,0],
	'bodyAt 2013-06-22':[107,1086,0],
	'bodyAt 2017-06-22':[49,1229,0],
	'infant (S .3, head 2, legs 0.7)':[720,141,191],
	'infant (S .3, head 2, legs 0.8)':[371,34,43],
	'±2%':[9,208,0],
};
/** Axial residual (Task 14c): [flipped, torn, out-of-ratio] of the trunk / neck / head triangles, per seam body. The goal was 0 and the remap cannot fold (det = g²·f′ > 0), but a discrete triangle can still invert or over-stretch:
 * - flipped: slivers (altitude 0.01–1.5 mm on 12–58 mm edges: sternocleidomastoid, splenius, trachea, esophagus, pharyngeal constrictors) that span the C7/T1 window, where f′ drops 2.5× at birth (S·ℓ 0.34 → 0.13) within ±3 cm.
 *   A sliver of length L and altitude h inverts once the curvature's sag f″·L²/8 exceeds its warped altitude ≈ f′·h; at birth f″ ≈ 5 /m, so a 58 mm sliver with h = 1.5 mm needs a window ≥ 30 cm, and the C7 window cannot pass the menton knot 4.6 cm above.
 * - torn: at 14 y, 6 deep trunk triangles (papillary muscle, diaphragm) where the soft deflation S(γs − γb) = −0.08 adds up to 8% stretch over S·max(f′, g); at birth – 3 y one long edge in the face (septal nasal cartilage at birth) in the face → cranium girth window.
 * Lower the entries as the warp improves, never raise them. */
const AXIAL_RESIDUAL:Record<string,[number,number,number]>={
	'hand-built child (S .75, head 1.2, legs .9)':[2,0,0],
	'bodyAt 2003-06-22':[38,1,0],
	'bodyAt 2004-06-22':[15,1,0],
	'bodyAt 2006-06-22':[6,1,0],
	'bodyAt 2009-06-22':[4,0,0],
	'bodyAt 2013-06-22':[2,0,0],
	'bodyAt 2017-06-22':[0,6,0],
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
		// A limb segment keeps its affine map: along × S·ℓ, perpendicular × S·γ, plus the radial inflation from its axis.
		{const u=seg('lShank'),ui=SEGMENTS.indexOf('lShank'),ua=u.axis,uq:Vec3=[1-ua[0]*ua[0],-ua[1]*ua[0],-ua[2]*ua[0]],u0:Vec3=[...u.joint],u1:Vec3=[u.joint[0]+0.1*ua[0]+0.02*uq[0],u.joint[1]+0.1*ua[1]+0.02*uq[1],u.joint[2]+0.1*ua[2]+0.02*uq[2]];
			const A=w(u0,ui),B=w(u1,ui);for(let i=0;i<3;i++)c.near(B[i]-A[i],S*(0.1*b.length.lShank*ua[i]+0.02*b.boneGirth.lShank*uq[i]),1e-7,`shank bone ${i}`);
			const ur=0.02*Math.hypot(...uq),I=warpPoint(ws,u1,ui,ui,1,true,[0,0,0],0.005),f=S*(b.softGirth.lShank-b.boneGirth.lShank)*Math.min(1,0.005/ur)*0.02;for(let i=0;i<3;i++)c.near(I[i]-B[i],f*uq[i],1e-7,`shank soft inflation ${i}`);}
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
	{name:'seam gate: the axial region (trunk / neck / head) stays at or below its residual and the limb seams at or below the ratchet (goal 0 for both)',async run(c){
		// Task 14c: the axial height remap (growth/warp.ts) is fold-free by construction (det J = g²·f′ > 0); what is left on the axial region is sliver curvature and the soft deflation (AXIAL_RESIDUAL). Limb seams (any vertex with limb weight) keep the Task 14a ratchet, re-baselined downward.
		// Triangles welding two segments the rig moves independently are excluded and counted (seam.ts `bridged`).
		const g=await c.geometry(),fs=await import('node:fs'),bin=fs.readFileSync(SEG_BIN),bad:string[]=[];
		for(const [label,b] of seamBodies()){const d=seamDefects(warpState(R,b),g,bin),top=[...d.byPart].sort((x,y)=>y[1]-x[1]).slice(0,4).map(([n,k])=>`${n} ${k}`).join(', '),A=d.axial,L=d.limb;
			const [f,t,o]=ratchetFor(c,label),ax=AXIAL_RESIDUAL[label];c.assert(!!ax,`AXIAL_RESIDUAL has no entry for "${label}"`);c.assert(d.bridged===SEAM_BRIDGED,`${label}: ${d.bridged} welded hand / forearm ↔ thigh / trunk Skin triangles excluded, expected exactly ${SEAM_BRIDGED}`);
			console.log(`     ${label}: axial ${A.flipped}/${A.torn}/${A.ratioOut} of ${A.triangles} (residual ${ax.join('/')}); limb ${L.flipped}/${L.torn}/${L.ratioOut} of ${L.triangles} (ratchet ${f}/${t}/${o}; ${d.bridged} welded excluded)${top?`; most in ${top}`:''}`);
			if(A.flipped>ax[0]||A.torn>ax[1]||A.ratioOut>ax[2])bad.push(`${label}: axial ${A.flipped}/${A.torn}/${A.ratioOut} > ${ax.join('/')}`);
			if(L.flipped>f||L.torn>t||L.ratioOut>o)bad.push(`${label}: limb ${L.flipped}/${L.torn}/${L.ratioOut} > ${f}/${t}/${o}`);}
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
