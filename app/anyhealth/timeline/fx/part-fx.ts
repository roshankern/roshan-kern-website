/** Per-part effects: merges every PartFx for a date into one resolved effect per atlas part and packs them into a float texture the shaders read (see docs/superpowers/plans/2026-09-25-anyhealth-timeline.md, Task 6). The data plumbing here is complete; `applyFxPoint` is an identity stub that Task 6 implements, with the GLSL twin in part-fx-glsl.ts.
 *
 * Texture: FX_ROWS rows × width = ceilPowerOfTwo(partCount) columns (column = part index), RGBA float, nearest filtering.
 * row 0 (visible, swell, swellBandY0, swellBandY1; a band of (0,0) = none) · row 1 tint (r,g,b,amount) · row 2 (pivot.xyz, 0) · row 3 rotate quat (x,y,z,w) · row 4 (scale.xyz, 0) · row 5 (translate.xyz, 0). */
import * as T from 'three';
import type {PartFx,Quat,Vec3} from '../types';

export const FX_ROWS=6;
export interface FxTexture {texture:T.DataTexture;width:number;data:Float32Array}
export interface ResolvedFx {visible:number;swell:number;tint:[number,number,number,number];scale:Vec3;rotate:Quat;translate:Vec3;pivot:Vec3;swellBand:[number,number]|null}

/** A resolved effect that changes nothing (pivot at the origin). */
export const identityFx=(pivot:Vec3=[0,0,0]):ResolvedFx=>({visible:1,swell:0,tint:[0,0,0,0],scale:[1,1,1],rotate:[0,0,0,1],translate:[0,0,0],pivot:[...pivot] as Vec3,swellBand:null});

/** The texture for `partCount` parts, filled with identity effects. */
export function createFxTexture(partCount:number):FxTexture{
	const width=T.MathUtils.ceilPowerOfTwo(Math.max(1,partCount)),data=new Float32Array(width*FX_ROWS*4);
	const texture=new T.DataTexture(data,width,FX_ROWS,T.RGBAFormat,T.FloatType);texture.minFilter=texture.magFilter=T.NearestFilter;
	const tex={texture,width,data};writeFx(tex,new Map());texture.needsUpdate=true;return tex;
}

const qmul=(a:Quat,b:Quat):Quat=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];

/** Merge every PartFx into one ResolvedFx per part index. visible = product; swell = sum; tint = the highest amount; scale = componentwise product; rotate = quaternion product in list order; translate = sum; pivot = first specified, else `restCenter(i)`; swellBand = first specified. */
export function mergeFx(list:PartFx[],indicesOf:(name:string)=>number[],restCenter:(i:number)=>Vec3):Map<number,ResolvedFx>{
	const out=new Map<number,ResolvedFx>(),pivotSet=new Set<number>();
	for(const f of list)for(const i of indicesOf(f.part)){
		let r=out.get(i);if(!r){r=identityFx(restCenter(i));out.set(i,r);}
		if(f.visible!==undefined)r.visible*=f.visible;
		if(f.swell!==undefined)r.swell+=f.swell;
		if(f.tint&&f.tint[3]>r.tint[3])r.tint=[...f.tint];
		if(f.scale)r.scale=[r.scale[0]*f.scale[0],r.scale[1]*f.scale[1],r.scale[2]*f.scale[2]];
		if(f.rotate)r.rotate=qmul(r.rotate,f.rotate);
		if(f.translate)r.translate=[r.translate[0]+f.translate[0],r.translate[1]+f.translate[1],r.translate[2]+f.translate[2]];
		if(f.pivot&&!pivotSet.has(i)){pivotSet.add(i);r.pivot=[...f.pivot];}
		if(f.swellBand&&!r.swellBand)r.swellBand=[...f.swellBand];
	}
	return out;
}

/** Write every column: the merged effect, or identity for parts not in `merged`. Flags the texture for upload and returns true if any texel changed. */
export function writeFx(tex:FxTexture,merged:Map<number,ResolvedFx>):boolean{
	const {data,width}=tex,id=identityFx();let changed=false;
	const put=(row:number,col:number,a:number,b:number,c:number,d:number)=>{const o=(row*width+col)*4;if(data[o]!==a||data[o+1]!==b||data[o+2]!==c||data[o+3]!==d){data[o]=a;data[o+1]=b;data[o+2]=c;data[o+3]=d;changed=true;}};
	for(let i=0;i<width;i++){
		const f=merged.get(i)??id,band=f.swellBand??[0,0];
		put(0,i,f.visible,f.swell,band[0],band[1]);put(1,i,...f.tint);put(2,i,...f.pivot,0);put(3,i,...f.rotate);put(4,i,...f.scale,0);put(5,i,...f.translate,0);
	}
	if(changed)tex.texture.needsUpdate=true;return changed;
}

/** Apply one resolved effect to a rest-space point with unit normal `n` (the TS mirror of the shader): p1 = pivot + rotate(scale·(p − pivot)) + translate, then p1 += n · swell · bandWeight(p.y). Writes and returns `out` (which may be `p`). Stub: identity. */
export function applyFxPoint(fx:ResolvedFx,p:Vec3,n:Vec3,out:Vec3):Vec3{
	void fx;void n;out[0]=p[0];out[1]=p[1];out[2]=p[2];return out;
}
