/** Closest-point queries on the rest-pose Skin mesh, for placing skin marks (issues/skin/marks-layer.ts). A uniform grid of triangles keeps each query local. Pure geometry: no three.js scene objects. */
import type {Vec3} from '../../types';

export interface SurfaceHit {
	/** Closest point on the Skin surface, rest space. */
	point:Vec3;
	/** Unit outward normal there (the triangle's vertex normals, interpolated). */
	normal:Vec3;
	/** The triangle's vertex nearest the point (its `seg` weights ride the mark). */
	vertex:number;
	/** Distance from the query point, metres. */
	distance:number;
}
export interface SkinSurface {
	closest(p:Vec3):SurfaceHit;
	/** The (segA, segB, weightA) of a Skin vertex, from the `seg` attribute; trunk at weight 1 when there is none. */
	segOfVertex(v:number):Vec3;
}

const CELL=.02;

/** Builds the query structure. `normal` is read as floats in -1..1 (pass a normalized view, e.g. BufferAttribute.getX). */
export function skinSurface(position:ArrayLike<number>,normal:(v:number)=>Vec3,index:ArrayLike<number>,seg?:ArrayLike<number>):SkinSurface{
	const tris=index.length/3,grid=new Map<number,number[]>(),key=(x:number,y:number,z:number)=>((x+512)*1024+(y+512))*1024+(z+512);
	const cell=(v:number)=>Math.floor(v/CELL);
	for(let t=0;t<tris;t++){
		let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
		for(let k=0;k<3;k++){const i=index[t*3+k]*3,x=position[i],y=position[i+1],z=position[i+2];x0=Math.min(x0,x);y0=Math.min(y0,y);z0=Math.min(z0,z);x1=Math.max(x1,x);y1=Math.max(y1,y);z1=Math.max(z1,z);}
		for(let x=cell(x0);x<=cell(x1);x++)for(let y=cell(y0);y<=cell(y1);y++)for(let z=cell(z0);z<=cell(z1);z++){const k=key(x,y,z),l=grid.get(k);if(l)l.push(t);else grid.set(k,[t]);}
	}
	const a:Vec3=[0,0,0],b:Vec3=[0,0,0],c:Vec3=[0,0,0],q:Vec3=[0,0,0];
	const load=(o:Vec3,v:number)=>{o[0]=position[v*3];o[1]=position[v*3+1];o[2]=position[v*3+2];};
	// Closest point on triangle abc to p (Ericson, Real-Time Collision Detection 5.1.5); writes q, returns barycentric (u,v,w) for a,b,c.
	const closestTri=(p:Vec3):Vec3=>{
		const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],ap=[p[0]-a[0],p[1]-a[1],p[2]-a[2]];
		const dot=(u:number[],v:number[])=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
		const set=(u:number,v:number,w:number):Vec3=>{for(let k=0;k<3;k++)q[k]=a[k]*u+b[k]*v+c[k]*w;return [u,v,w];};
		const d1=dot(ab,ap),d2=dot(ac,ap);if(d1<=0&&d2<=0)return set(1,0,0);
		const bp=[p[0]-b[0],p[1]-b[1],p[2]-b[2]],d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return set(0,1,0);
		const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return set(1-v,v,0);}
		const cp=[p[0]-c[0],p[1]-c[1],p[2]-c[2]],d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return set(0,0,1);
		const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return set(1-w,0,w);}
		const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return set(0,1-w,w);}
		const den=1/(va+vb+vc),v=vb*den,w=vc*den;return set(1-v-w,v,w);
	};
	const closest=(p:Vec3):SurfaceHit=>{
		let best=Infinity,bt=-1,bw:Vec3=[1,0,0];const bp:Vec3=[0,0,0],seen=new Set<number>();
		const test=(t:number)=>{if(seen.has(t))return;seen.add(t);load(a,index[t*3]);load(b,index[t*3+1]);load(c,index[t*3+2]);const w=closestTri(p),d=(q[0]-p[0])**2+(q[1]-p[1])**2+(q[2]-p[2])**2;if(d<best){best=d;bt=t;bw=w;bp[0]=q[0];bp[1]=q[1];bp[2]=q[2];}};
		const cx=cell(p[0]),cy=cell(p[1]),cz=cell(p[2]);
		// Grow the searched shell until the best hit is closer than any unsearched cell can be.
		for(let r=0;r<=8;r++){
			for(let x=cx-r;x<=cx+r;x++)for(let y=cy-r;y<=cy+r;y++)for(let z=cz-r;z<=cz+r;z++){if(Math.max(Math.abs(x-cx),Math.abs(y-cy),Math.abs(z-cz))!==r)continue;grid.get(key(x,y,z))?.forEach(test);}
			if(bt>=0&&Math.sqrt(best)<=r*CELL)break;
		}
		if(bt<0)for(let t=0;t<tris;t++)test(t);
		const vs=[index[bt*3],index[bt*3+1],index[bt*3+2]],n:Vec3=[0,0,0];
		vs.forEach((v,k)=>{const m=normal(v);n[0]+=m[0]*bw[k];n[1]+=m[1]*bw[k];n[2]+=m[2]*bw[k];});
		let len=Math.hypot(n[0],n[1],n[2]);
		if(len<1e-6){load(a,vs[0]);load(b,vs[1]);load(c,vs[2]);const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];n[0]=u[1]*w[2]-u[2]*w[1];n[1]=u[2]*w[0]-u[0]*w[2];n[2]=u[0]*w[1]-u[1]*w[0];len=Math.hypot(n[0],n[1],n[2])||1;}
		return {point:[bp[0],bp[1],bp[2]],normal:[n[0]/len,n[1]/len,n[2]/len],vertex:vs[bw.indexOf(Math.max(...bw))],distance:Math.sqrt(best)};
	};
	return {
		closest,
		segOfVertex:v=>seg&&seg.length>=(v+1)*3?[seg[v*3],seg[v*3+1],seg[v*3+2]]:[0,0,1],
	};
}
