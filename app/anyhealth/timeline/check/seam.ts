/** Seam defects of the body warp over every atlas triangle whose part mixes segments (node checks only). */
import {warpPoint,warpNormal,type WarpState} from '../growth/warp';
import {SOFT_SYSTEMS} from '../engine';
import type {NodeAtlas} from './node-atlas';
import type {Vec3} from '../types';

/** Edges shorter than this (metres) are skipped by the ratio and tear tests, and faces with a smaller doubled area by the orientation test: their ratios / normals are noise. */
const MIN_EDGE=1e-4,MIN_AREA2=1e-10,TEAR=0.001;

/** Counts, over triangles of parts with mixed segment weights (segments.bin: per part in atlas order, vertexCount × 2 bytes):
 * - flipped: the warped face normal · the blended warped normal (warpNormal of the rest face normal, summed over the three vertices' weights) ≤ 0, i.e. an inverted triangle;
 * - torn: some warped edge > rest edge × the triangle's max segment scale + 1 mm;
 * - ratioOut: some warped / rest edge ratio outside [0.2, 5] × the triangle's max segment scale. */
export function seamDefects(ws:WarpState,geometry:NodeAtlas,segBin:Uint8Array):{flipped:number;torn:number;ratioOut:number;triangles:number;worst:string;/** defective triangles per part name */byPart:Map<string,number>}{
	const bin=segBin,P:Vec3=[0,0,0],M:Vec3=[0,0,0];let off=0,flipped=0,torn=0,ratioOut=0,triangles=0,worst='';const byPart=new Map<string,number>(),mark=(name:string)=>byPart.set(name,(byPart.get(name)??0)+1);
	geometry.parts.forEach((part,i)=>{
		const n=part.position.length/3,o=off;off+=n*2;const soft=SOFT_SYSTEMS.includes(geometry.atlas.parts[i].system),girth=soft?ws.softScale:ws.boneScale;
		let mixed=false;for(let v=0;v<n&&!mixed;v++)mixed=bin[o+v*2]!==bin[o]||(bin[o+v*2+1]<255&&(bin[o+v*2]&15)!==bin[o+v*2]>>4);if(!mixed)return;
		const sa=(v:number)=>bin[o+v*2]&15,sb=(v:number)=>bin[o+v*2]>>4,wa=(v:number)=>bin[o+v*2+1]/255,R=part.position;
		const w=new Float64Array(n*3);for(let v=0;v<n;v++){P[0]=R[v*3];P[1]=R[v*3+1];P[2]=R[v*3+2];w.set(warpPoint(ws,P,sa(v),sb(v),wa(v),soft,[0,0,0]),v*3);}
		const segMax=(v:number)=>{const a=sa(v),b=sb(v),s=Math.max(ws.alongScale[a],girth[a]);return wa(v)<1?Math.max(s,ws.alongScale[b],girth[b]):s;};
		const len=(A:ArrayLike<number>,u:number,v:number)=>Math.hypot(A[u*3]-A[v*3],A[u*3+1]-A[v*3+1],A[u*3+2]-A[v*3+2]);
		const cross=(A:ArrayLike<number>,a:number,b:number,c:number):Vec3=>{const ux=A[b*3]-A[a*3],uy=A[b*3+1]-A[a*3+1],uz=A[b*3+2]-A[a*3+2],vx=A[c*3]-A[a*3],vy=A[c*3+1]-A[a*3+1],vz=A[c*3+2]-A[a*3+2];return [uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];};
		const ix=part.index,name=geometry.atlas.parts[i].name;
		for(let t=0;t<ix.length;t+=3){
			const a=ix[t],b=ix[t+1],c=ix[t+2];triangles++;const hi=Math.max(segMax(a),segMax(b),segMax(c));let isTorn=false,isOut=false;
			for(const [u,v] of [[a,b],[b,c],[c,a]]){const r0=len(R,u,v);if(r0<MIN_EDGE)continue;const r1=len(w,u,v),r=r1/r0;if(r1>r0*hi+TEAR)isTorn=true;if(r<0.2*hi||r>5*hi)isOut=true;}
			if(isTorn){torn++;if(!worst)worst=`torn: ${name}`;}if(isOut)ratioOut++;let bad=isTorn||isOut;
			const nr=cross(R,a,b,c);if(Math.hypot(...nr)<MIN_AREA2){if(bad)mark(name);continue;}
			const nw=cross(w,a,b,c);let bx=0,by=0,bz=0;for(const v of [a,b,c]){warpNormal(ws,nr,sa(v),sb(v),wa(v),soft,M);bx+=M[0];by+=M[1];bz+=M[2];}
			if(nw[0]*bx+nw[1]*by+nw[2]*bz<=0){flipped++;bad=true;if(!worst.startsWith('flipped'))worst=`flipped: ${name}`;}
			if(bad)mark(name);
		}
	});
	return {flipped,torn,ratioOut,triangles,worst,byPart};
}
