import type {Check,CheckContext} from './harness';
import rig from '../growth/rig.json';
import {SEGMENTS,type Body,type Rig,type SegmentId,type Vec3} from '../types';
import {bodyAt} from '../growth/proportions';
import {warpState,warpPoint,type WarpState} from '../growth/warp';
import {SOFT_SYSTEMS} from '../engine';
const R=rig as Rig;
export const checks:Check[]=[
	{name:'rig has all 15 segments with parents first',run(c){c.assert(R.segments.length===15,'count');R.segments.forEach((s,i)=>{c.assert(s.id===SEGMENTS[i],`order ${s.id}`);if(s.parent)c.assert(SEGMENTS.indexOf(s.parent)<i,`parent before ${s.id}`);});}},
	{name:'rig is left/right symmetric within 1.5 cm',run(c){for(const [l,r] of [['lUpperArm','rUpperArm'],['lForearm','rForearm'],['lThigh','rThigh'],['lShank','rShank'],['lHand','rHand'],['lFoot','rFoot']] as const){const a=R.segments.find(s=>s.id===l)!,b=R.segments.find(s=>s.id===r)!;c.near(a.joint[0],-b.joint[0],0.015,`${l} x`);c.near(a.joint[1],b.joint[1],0.015,`${l} y`);c.near(a.length,b.length,0.015,`${l} length`);}}},
	{name:'adult segment lengths are anatomically plausible',run(c){const L=(id:string)=>R.segments.find(s=>s.id===id)!.length;c.near(L('lUpperArm'),0.30,0.04,'humerus');c.near(L('lThigh'),0.44,0.05,'femur');c.near(L('lShank'),0.39,0.05,'tibia');c.near(R.stature,1.7297,0.003,'stature');}},
	{name:'segments.bin covers every vertex',async run(c){const g=await c.geometry();const fs=await import('node:fs');const n=fs.statSync('public/anyhealth/models/segments.bin').size;c.assert(n===g.parts.reduce((s,p)=>s+p.position.length/3,0)*2,'size');}},
	{name:'no active blend between non-adjacent segments',async run(c){const fs=await import('node:fs');const b=fs.readFileSync('public/anyhealth/models/segments.bin');const adj=(a:number,s:number)=>{const A=R.segments[a],S=R.segments[s];return a===s||A.parent===S.id||S.parent===A.id;};let bad=0;const pairs=new Set<string>();for(let i=0;i<b.length;i+=2){const a=b[i]&15,s=b[i]>>4;c.assert(a<15&&s<15,`segment index at vertex ${i/2}`);if(b[i+1]<0.98*255&&!adj(a,s)){bad++;pairs.add(`${SEGMENTS[a]}↔${SEGMENTS[s]}`);}}c.assert(bad===0,`${bad} vertices blend non-adjacent segments: ${[...pairs].join(', ')}`);}},
];

// ── Body warp (Task 6) ──
/** A body with scale 1 and every factor 1: the rest model. */
const unitBody=():Body=>{const ones=()=>Object.fromEntries(SEGMENTS.map(s=>[s,1])) as Record<SegmentId,number>;return {date:'2026-01-01',ageYears:22,statureM:R.stature,weightKg:70,scale:1,length:ones(),boneGirth:ones(),softGirth:ones()};};
/** A deliberately non-identity body built by hand (not from bodyAt): small scale, a long head, short legs, slimmer bone and fuller soft tissue. */
const oddBody=():Body=>{const b=unitBody();b.scale=0.3;b.statureM=R.stature*0.3;b.length.head=2.0;for(const s of ['lThigh','lShank','lFoot','rThigh','rShank','rFoot'] as const)b.length[s]=0.7;for(const s of SEGMENTS){b.boneGirth[s]=0.9;b.softGirth[s]=1.25;}return b;};
/** A moderate hand-built child (about age 6-8): the seam check's body. Newborn-like proportions (oddBody) fold some hip-crossing muscle triangles: see the Task 6 report. */
const childBody=():Body=>{const b=unitBody();b.scale=0.75;b.statureM=R.stature*0.75;b.length.head=1.2;for(const s of ['lThigh','lShank','lFoot','rThigh','rShank','rFoot'] as const)b.length[s]=0.9;for(const s of SEGMENTS){b.boneGirth[s]=0.9;b.softGirth[s]=1.0;}return b;};
const SEG_BIN='public/anyhealth/models/segments.bin';
/** Visit every `stride`-th vertex of every part with its segment weights from segments.bin (per part in atlas order, vertexCount × 2 bytes). */
async function eachVertex(c:CheckContext,stride:number,fn:(p:Vec3,segA:number,segB:number,wA:number,soft:boolean)=>void){
	const g=await c.geometry(),fs=await import('node:fs'),b=fs.readFileSync(SEG_BIN),p:Vec3=[0,0,0];let off=0;
	g.parts.forEach((part,i)=>{const n=part.position.length/3,soft=SOFT_SYSTEMS.includes(g.atlas.parts[i].system);for(let v=0;v<n;v+=stride){const k=v*3;p[0]=part.position[k];p[1]=part.position[k+1];p[2]=part.position[k+2];fn(p,b[off+v*2]&15,b[off+v*2]>>4,b[off+v*2+1]/255,soft);}off+=n*2;});
}
/** Warped floor (min y) and top (max y) over every 7th vertex. */
async function extent(c:CheckContext,ws:WarpState){let lo=Infinity,hi=-Infinity;const q:Vec3=[0,0,0];await eachVertex(c,7,(p,a,b,w,soft)=>{warpPoint(ws,p,a,b,w,soft,q);if(q[1]<lo)lo=q[1];if(q[1]>hi)hi=q[1];});return {lo,hi};}
checks.push(
	{name:'identity body leaves every point unchanged',run(c){const ws=warpState(R,unitBody());const out:Vec3=[0,0,0];for(const p of [[0,1,0],[0.2,1.3,0],[0.1,0.4,0]] as Vec3[])for(const soft of [false,true]){warpPoint(ws,p,0,3,0.5,soft,out);c.near(out[0],p[0],1e-9,'x');c.near(out[1],p[1],1e-9,'y');c.near(out[2],p[2],1e-9,'z');}}},
	{name:'a hand-built body follows the segment formula (scale × along / girth, ground-invariant differences)',run(c){
		const b=oddBody(),ws=warpState(R,b),S=b.scale,seg=(id:SegmentId)=>R.segments[SEGMENTS.indexOf(id)],w=(p:Vec3,i:number,soft=false)=>warpPoint(ws,p,i,i,1,soft,[0,0,0]);
		const t=seg('trunk'),a=t.axis,q:Vec3=[1-a[0]*a[0],-a[1]*a[0],-a[2]*a[0]];// q = x̂ minus its component along the axis
		const p0:Vec3=[...t.joint],p1:Vec3=[t.joint[0]+0.1*a[0]+0.05*q[0],t.joint[1]+0.1*a[1]+0.05*q[1],t.joint[2]+0.1*a[2]+0.05*q[2]];
		for(const [soft,g] of [[false,b.boneGirth.trunk],[true,b.softGirth.trunk]] as const){const A=w(p0,0,soft),B=w(p1,0,soft);for(let k=0;k<3;k++)c.near(B[k]-A[k],S*(0.1*b.length.trunk*a[k]+0.05*g*q[k]),1e-7,`trunk ${soft?'soft':'bone'} ${k}`);}
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
	{name:'warp is continuous across segment weights (no seam tears > 1 mm)',async run(c){
		// For every triangle of every part that mixes segments: each warped edge / rest edge stays within [0.2 × the smallest, 5 × the largest] scale of the segments its vertices ride (edges shorter than 0.1 mm are skipped: their ratio is noise).
		const g=await c.geometry(),fs=await import('node:fs'),bin=fs.readFileSync(SEG_BIN);
		for(const [label,body] of [['hand-built child',childBody()],['bodyAt 2006-06-22',bodyAt('2006-06-22')],['bodyAt 2012-01-01',bodyAt('2012-01-01')]] as const){
			const ws=warpState(R,body),P:Vec3=[0,0,0];let off=0,bad=0,edges=0,worst='';
			g.parts.forEach((part,i)=>{
				const n=part.position.length/3,o=off;off+=n*2;const soft=SOFT_SYSTEMS.includes(g.atlas.parts[i].system),girth=soft?ws.softScale:ws.boneScale;
				let mixed=false;for(let v=0;v<n&&!mixed;v++)mixed=bin[o+v*2]!==bin[o]||(bin[o+v*2+1]<255&&(bin[o+v*2]&15)!==bin[o+v*2]>>4);if(!mixed)return;
				const w=new Float64Array(n*3);for(let v=0;v<n;v++){P[0]=part.position[v*3];P[1]=part.position[v*3+1];P[2]=part.position[v*3+2];w.set(warpPoint(ws,P,bin[o+v*2]&15,bin[o+v*2]>>4,bin[o+v*2+1]/255,soft,[0,0,0]),v*3);}
				const segScale=(v:number,f:(...x:number[])=>number)=>{const a=bin[o+v*2]&15,b=bin[o+v*2]>>4,sa=f(ws.alongScale[a],girth[a]);return bin[o+v*2+1]<255?f(sa,ws.alongScale[b],girth[b]):sa;};
				const len=(A:ArrayLike<number>,u:number,v:number)=>Math.hypot(A[u*3]-A[v*3],A[u*3+1]-A[v*3+1],A[u*3+2]-A[v*3+2]),ix=part.index;
				for(let t=0;t<ix.length;t+=3){
					let hi=0,lo=Infinity;for(let k=0;k<3;k++){hi=Math.max(hi,segScale(ix[t+k],Math.max));lo=Math.min(lo,segScale(ix[t+k],Math.min));}
					for(let k=0;k<3;k++){const u=ix[t+k],v=ix[t+(k+1)%3],r0=len(part.position,u,v);if(r0<1e-4)continue;edges++;const r=len(w,u,v)/r0;
						if(r>5*hi||r<0.2*lo){bad++;if(!worst)worst=`${g.atlas.parts[i].name}: ratio ${r.toFixed(3)} vs segment scales [${lo.toFixed(3)}, ${hi.toFixed(3)}]`;}}
				}
			});
			c.assert(edges>0,'no mixed-weight triangles found');c.assert(bad===0,`${label}: ${bad} of ${edges} edges torn across a seam, e.g. ${worst}`);
		}
	}},
);
