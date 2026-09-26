/** Seam defects of the body warp over every atlas triangle whose part mixes segments (node checks only). */
import {warpPoint,warpNormal,axialRates,limbRates,AXIAL_SEGMENTS,SEG_STRIDE,D_UNIT,type WarpState} from '../growth/warp';
import {SOFT_SYSTEMS} from '../engine';
import type {NodeAtlas} from './node-atlas';
import {SEGMENTS,type Rig,type Vec3} from '../types';
import rig from '../growth/rig.json';

/** a and b are the same segment or parent / child. */
const ADJ=SEGMENTS.map(a=>SEGMENTS.map(b=>{const A=(rig as Rig).segments.find(s=>s.id===a)!,B=(rig as Rig).segments.find(s=>s.id===b)!;return a===b||A.parent===b||B.parent===a;}));
/** The only welds excluded: Skin between a resting hand / forearm and the thigh / trunk (same side for the limbs). Frozen by Task 14a fix round 1; any other weld is a defect. */
const WELD_SIDE=['lHand','lForearm','rHand','rForearm'].map(s=>SEGMENTS.indexOf(s as never)),WELD_BODY=['lThigh','rThigh','trunk'].map(s=>SEGMENTS.indexOf(s as never));
/** trunk, neck, head: the segments the axial height remap moves (growth/warp.ts). */
const AXIAL=SEGMENTS.map(s=>s==='trunk'||s==='neck'||s==='head');
const weldOk=(x:number,y:number)=>(WELD_SIDE.includes(x)&&WELD_BODY.includes(y))||(WELD_SIDE.includes(y)&&WELD_BODY.includes(x));
/** Limb seam regions (Task 14d): a limb triangle's region from the set of segments its vertices carry weight on. */
export const LIMB_REGIONS=['shoulder','hip','elbow','wrist','knee','ankle','single','other'] as const;
export type LimbRegion=typeof LIMB_REGIONS[number];
const SEG_REGION:Record<string,LimbRegion>={lUpperArm:'shoulder',rUpperArm:'shoulder',lThigh:'hip',rThigh:'hip',lForearm:'elbow',rForearm:'elbow',lHand:'wrist',rHand:'wrist',lShank:'knee',rShank:'knee',lFoot:'ankle',rFoot:'ankle'};
/** The region of a triangle whose vertices carry weight on the segment set `s` (indices): one limb segment only → 'single'; a limb root with trunk / neck / head → 'shoulder' / 'hip'; a parent / child limb pair → the child's joint; anything else → 'other'. */
function regionOf(s:Set<number>):LimbRegion{
	const limb=[...s].filter(i=>!AXIAL[i]),ax=[...s].some(i=>AXIAL[i]);
	if(ax)return limb.length===1&&(rig as Rig).segments[limb[0]].parent==='trunk'?SEG_REGION[SEGMENTS[limb[0]]]:'other';
	if(limb.length===1)return 'single';
	if(limb.length===2){const [a,b]=limb,A=(rig as Rig).segments[a],B=(rig as Rig).segments[b];if(B.parent===A.id)return SEG_REGION[B.id];if(A.parent===B.id)return SEG_REGION[A.id];}
	return 'other';
}

/** Edges shorter than this (metres) are skipped by the ratio and tear tests, and faces with a smaller doubled area by the orientation test: their ratios / normals are noise. */
const MIN_EDGE=1e-4,MIN_AREA2=1e-10,TEAR=0.001;

/** Counts, over triangles of parts with mixed segment weights (segments.bin: per part in atlas order, vertexCount × SEG_STRIDE bytes; soft parts get the soft-girth inflation from their bone distance, as in the engine):
 * - flipped: the warped face normal · the blended warped normal (warpNormal of the rest face normal, summed over the three vertices' weights) ≤ 0, i.e. an inverted triangle;
 * - torn: some warped edge > rest edge × the triangle's max segment scale + 1 mm (a limb segment: its local max(F′, λu, λv) in the joint taper, max(S·ℓe, S·γ) past it (soft: S·γs), Task 14d; trunk / neck / head: the axial remap's local max(f′, g) at the vertex's rest height, Task 14c);
 * - ratioOut: some warped / rest edge ratio outside [0.2, 5] × the triangle's max segment scale.
 * Excluded (a rest-pose mesh defect, counted in `bridged`): Skin triangles that weld two vertices each wholly owned (weight 1) by a hand / forearm segment and a thigh / trunk segment (the resting hand and forearm
 * touch the thigh and flank). The rig moves those segments independently, so no blend weights can keep such a triangle intact. Every other weld between non-adjacent segments counts as a defect. */
export interface SeamCounts {flipped:number;torn:number;ratioOut:number;triangles:number}
export function seamDefects(ws:WarpState,geometry:NodeAtlas,segBin:Uint8Array):SeamCounts&{bridged:number;worst:string;/** defective triangles per part name */byPart:Map<string,number>;/** triangles whose every vertex is wholly on trunk / neck / head (the axial remap) */axial:SeamCounts;/** every other triangle (some vertex carries limb weight) */limb:SeamCounts;/** the limb triangles by joint region (regionOf; Task 14d) */limbByRegion:Record<LimbRegion,SeamCounts>;/** each flipped axial triangle: part, rest centroid y, rest altitude over its longest edge (m) and aspect (longest edge ÷ that altitude) */axialFlips:{part:string;y:number;alt:number;aspect:number}[];/** the same for each flipped limb triangle, with its region (Task 14d) */limbFlips:{part:string;region:LimbRegion;alt:number;aspect:number}[]}{
	const bin=segBin,P:Vec3=[0,0,0],M:Vec3=[0,0,0];let off=0,flipped=0,torn=0,ratioOut=0,triangles=0,bridged=0,worst='';const byPart=new Map<string,number>(),mark=(name:string)=>byPart.set(name,(byPart.get(name)??0)+1);
	const axialFlips:{part:string;y:number;alt:number;aspect:number}[]=[],limbFlips:{part:string;region:LimbRegion;alt:number;aspect:number}[]=[],axial:SeamCounts={flipped:0,torn:0,ratioOut:0,triangles:0},limb:SeamCounts={flipped:0,torn:0,ratioOut:0,triangles:0};
	const limbByRegion=Object.fromEntries(LIMB_REGIONS.map(r=>[r,{flipped:0,torn:0,ratioOut:0,triangles:0}])) as Record<LimbRegion,SeamCounts>;
	geometry.parts.forEach((part,i)=>{
		const n=part.position.length/3,o=off,Z=SEG_STRIDE;off+=n*Z;const soft=SOFT_SYSTEMS.includes(geometry.atlas.parts[i].system);
		const sa=(v:number)=>bin[o+v*Z]&15,sb=(v:number)=>bin[o+v*Z]>>4,wa=(v:number)=>bin[o+v*Z+1]/255,R=part.position,isAx=(v:number)=>AXIAL[sa(v)]&&(wa(v)>=1||AXIAL[sb(v)]);
		let mixed=false;for(let v=0;v<n&&!mixed;v++)mixed=bin[o+v*Z]!==bin[o]||(bin[o+v*Z+1]<255&&(bin[o+v*Z]&15)!==bin[o+v*Z]>>4)||AXIAL[sa(v)]||(wa(v)<1&&AXIAL[sb(v)]);if(!mixed)return;
		const w=new Float64Array(n*3);for(let v=0;v<n;v++){P[0]=R[v*3];P[1]=R[v*3+1];P[2]=R[v*3+2];w.set(warpPoint(ws,P,sa(v),sb(v),wa(v),soft,[0,0,0],(bin[o+v*Z+2]|bin[o+v*Z+3]<<8)*D_UNIT),v*3);}
		// A limb segment's scale bound is max(S·ℓ, S·γ); an axial one's is the remap's local max(f′, g) at the vertex's rest height (soft parts: also the remap's blended soft girth gs there, as the limbs use their soft girth).
		// Ruling (Task 14d review): the bound is the local soft / bone Jacobian, as the brief's item 5 asks, and stays so: inside the taper soft parts use max(λ) + κ, past it S·γs, both the local soft Jacobian (the bone girth under tissue
		// wrapped round a bone is the local map, not a seam; the torn counts are reported under this bound).
		// A limb's, for a vertex in its joint taper (rest t < t1, the parent side included; Task 14d), is the local max(F′, λu, λv), as the axial one's includes the bone girth g (soft parts: also max(λ) + κ, the soft girth there);
		// past the taper it is max(S·ℓe, S·γ) as before (soft parts S·γs; ℓe = the length-keeping along rate, header of growth/warp.ts).
		const segScale=(i:number,v:number)=>{if(i>=AXIAL_SEGMENTS){const [F,lu,lv,k,tapered]=limbRates(ws,i,R[v*3],R[v*3+1],R[v*3+2]);return tapered?Math.max(F,lu,lv,soft?Math.max(lu,lv)+k:0):Math.max(F,soft?ws.softScale[i]:ws.boneScale[i]);}const [fp,gg,gs]=axialRates(ws,R[v*3+1]);return Math.max(fp,gg,soft?gs:0);};
		const segMax=(v:number)=>{const a=sa(v),b=sb(v),s=segScale(a,v);return wa(v)<1?Math.max(s,segScale(b,v)):s;};
		const len=(A:ArrayLike<number>,u:number,v:number)=>Math.hypot(A[u*3]-A[v*3],A[u*3+1]-A[v*3+1],A[u*3+2]-A[v*3+2]);
		const cross=(A:ArrayLike<number>,a:number,b:number,c:number):Vec3=>{const ux=A[b*3]-A[a*3],uy=A[b*3+1]-A[a*3+1],uz=A[b*3+2]-A[a*3+2],vx=A[c*3]-A[a*3],vy=A[c*3+1]-A[a*3+1],vz=A[c*3+2]-A[a*3+2];return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];};
		const ix=part.index,name=geometry.atlas.parts[i].name,isSkin=name==='Skin';
		for(let t=0;t<ix.length;t+=3){
			const a=ix[t],b=ix[t+1],c=ix[t+2],pure=(v:number)=>wa(v)>=1||sa(v)===sb(v);
			if(isSkin&&[[a,b],[b,c],[c,a]].some(([u,v])=>pure(u)&&pure(v)&&!ADJ[sa(u)][sa(v)]&&weldOk(sa(u),sa(v)))){bridged++;continue;}
			triangles++;const bin3=isAx(a)&&isAx(b)&&isAx(c)?axial:limb;bin3.triangles++;let reg:SeamCounts|null=null,regName:LimbRegion='other';if(bin3===limb){const ss=new Set<number>();for(const v of [a,b,c]){ss.add(sa(v));if(wa(v)<1)ss.add(sb(v));}regName=regionOf(ss);reg=limbByRegion[regName];reg.triangles++;}const hi=Math.max(segMax(a),segMax(b),segMax(c));let isTorn=false,isOut=false;
			for(const [u,v] of [[a,b],[b,c],[c,a]]){const r0=len(R,u,v);if(r0<MIN_EDGE)continue;const r1=len(w,u,v),r=r1/r0;if(r1>r0*hi+TEAR)isTorn=true;if(r<0.2*hi||r>5*hi)isOut=true;}
			if(isTorn){torn++;bin3.torn++;if(reg)reg.torn++;if(!worst)worst=`torn: ${name}`;}if(isOut){ratioOut++;bin3.ratioOut++;if(reg)reg.ratioOut++;}let bad=isTorn||isOut;
			const nr=cross(R,a,b,c);if(Math.hypot(...nr)<MIN_AREA2){if(bad)mark(name);continue;}
			const nw=cross(w,a,b,c);let bx=0,by=0,bz=0;for(const v of [a,b,c]){P[0]=R[v*3];P[1]=R[v*3+1];P[2]=R[v*3+2];warpNormal(ws,P,nr,sa(v),sb(v),wa(v),M);bx+=M[0];by+=M[1];bz+=M[2];}
			if(nw[0]*bx+nw[1]*by+nw[2]*bz<=0){flipped++;bin3.flipped++;if(reg)reg.flipped++;bad=true;{const e=Math.max(len(R,a,b),len(R,b,c),len(R,c,a)),h=Math.hypot(...nr)/e;if(bin3===axial)axialFlips.push({part:name,y:(R[a*3+1]+R[b*3+1]+R[c*3+1])/3,alt:h,aspect:e/h});else limbFlips.push({part:name,region:regName,alt:h,aspect:e/h});}if(!worst.startsWith('flipped'))worst=`flipped: ${name}`;}
			if(bad)mark(name);
		}
	});
	return {flipped,torn,ratioOut,triangles,bridged,worst,byPart,axial,limb,limbByRegion,axialFlips,limbFlips};
}
