/** The AnyHealth timeline engine: turns a date into the body's growth warp, every issue script's part effects and custom layers, on top of the atlas scene (see docs/superpowers/specs/2026-09-25-anyhealth-timeline-design.md). scene.tsx creates it only in timeline mode.
 *
 * Shader injection (patchMaterial), on top of scene.tsx's own onBeforeCompile (which it chains):
 * - Vertex, after `#include <common>`: when partFx, `varying float tfxVisible; varying vec4 tfxTint; uniform sampler2D tfxState; uniform float tfxWidth; vec4 tfxRow(float row)` (this vertex's part texel, rows as in fx/part-fx.ts), then FX_PARS; when WARP_APPLY is non-empty, `attribute vec3 seg;` (unless the material defines TW_FIXED_SEG), then WARP_PARS.
 * - Vertex, main: `#include <begin_vertex>` is hoisted to just after `#include <beginnormal_vertex>`, so `transformed` (= position, rest space) and `objectNormal` are both live before defaultnormal_vertex reads the normal. Right after it, in one `{ }` block: when partFx, `tfxVisible = tfxRow(0.).x; tfxTint = tfxRow(1.);` then FX_APPLY; when WARP_APPLY is non-empty, `vec3 twSeg` (segA, segB, weightA; from `seg`, or `vec3(TW_FIXED_SEG, TW_FIXED_SEG, 1)`) then WARP_APPLY.
 * - Fragment, when partFx: `if (tfxVisible < 0.5) discard;` after `#include <clipping_planes_fragment>` and `diffuseColor.rgb = mix(diffuseColor.rgb, tfxTint.rgb, tfxTint.a);` after `#include <color_fragment>`.
 * - Uniforms: warpUniforms() (shared by every material), `twSoft` per material, and `tfxState` / `tfxWidth` when partFx.
 * Visibility in timeline mode goes through here only: scene.tsx keeps partState at 1 and the engine writes fx row 0 `visible` = visibilityFor(...) × the merged PartFx visibility. */
import * as T from 'three';
import type {Atlas,SystemId} from '../atlas/anatomy';
import {SEGMENTS,type CustomLayer,type FxContext,type IssueScript,type LayerContext,type PartFx,type Rig,type Vec3} from './types';
import {SCRIPTS,scriptFor,dayOf} from './issues';
import {bodyAt} from './growth/proportions';
import {growthFx} from './growth/organs';
import {warpState,warpPoint,type WarpState} from './growth/warp';
import {WARP_PARS,WARP_APPLY,warpUniforms,writeWarpUniforms} from './growth/warp-glsl';
import {FX_ROWS,createFxTexture,mergeFx,writeFx,applyFxPoint,identityFx,type ResolvedFx} from './fx/part-fx';
import {FX_PARS,FX_APPLY} from './fx/part-fx-glsl';
import {BIRTH_DATE} from '../health/types';

export interface EngineFrame {date:string;visible:SystemId[];isolate:string|null;now:number}
export interface Engine {
	patchMaterial(m:T.Material,opts:{partFx:boolean;soft:boolean}):void;
	/** Per-vertex attributes to add to each part geometry before merging (segment weights). */
	segAttribute(partIndex:number):T.BufferAttribute;
	/** After every chunk is decoded: build custom layers. */
	ready(pickers:(T.Mesh|undefined)[]):void;
	update(f:EngineFrame):{changed:boolean;animating:boolean;fly:T.Box3|null};
	/** Re-warp picker geometry and the shared per-part bounds (in place). Call when the date settles. */
	settle():void;
	/** Warped union box of an issue's parts and layer, for Isolate. */
	isolateBox(id:string):T.Box3|null;
	dispose():void;
}

/** Systems warped with the soft-tissue girth. */
export const SOFT_SYSTEMS:SystemId[]=['muscular','integumentary','connective'];

/** Per-part visibility from the switches and Isolate: when isolating, 1 only for parts named in the isolated script (whatever the switches say); otherwise 1 when the part's system is switched on. */
export function visibilityFor(parts:{name:string;system:SystemId}[],visible:SystemId[],isolate:Set<string>|null):Float32Array{
	const on=new Set(visible),v=new Float32Array(parts.length);
	parts.forEach((p,i)=>{v[i]=(isolate?isolate.has(p.name):on.has(p.system))?1:0;});return v;
}

/** The atlas part names an isolated script shows, or null when nothing is isolated. */
export const isolatedParts=(id:string|null)=>id?new Set(scriptFor(id)?.parts??[]):null;

export function createEngine(o:{atlas:Atlas;scene:T.Scene;bounds:T.Box3[];rig:Rig;segments:ArrayBuffer}):Engine{
	const {atlas,scene,bounds,rig}=o,n=atlas.parts.length;
	const warpU=warpUniforms(),fx=createFxTexture(n),warpOn=!!WARP_APPLY.trim();
	const restCenters=bounds.map(b=>b.getCenter(new T.Vector3()).toArray() as Vec3),soft=atlas.parts.map(p=>SOFT_SYSTEMS.includes(p.system));
	const byName=new Map<string,number[]>();atlas.parts.forEach((p,i)=>{const l=byName.get(p.name)??[];l.push(i);byName.set(p.name,l);});
	const indicesOf=(name:string)=>byName.get(name)??[],restCenter=(i:number)=>restCenters[i];
	// segments.bin: per part in atlas order, vertexCount × 2 bytes (byte0 = segA | segB<<4, byte1 = round(weightA·255)).
	const segBytes=new Uint8Array(o.segments),segOffset=new Int32Array(n+1);atlas.parts.forEach((p,i)=>{segOffset[i+1]=segOffset[i]+p.vertexCount*2;});
	if(segBytes.length!==segOffset[n])console.warn(`AnyHealth timeline: segments.bin has ${segBytes.length} bytes, the atlas needs ${segOffset[n]}; missing parts ride the trunk.`);

	let ws:WarpState=warpState(rig,bodyAt(BIRTH_DATE));writeWarpUniforms(warpU,ws);
	let fxMap=new Map<number,ResolvedFx>(),pickers:(T.Mesh|undefined)[]=[],rest:(Float32Array|undefined)[]=[],pendingFly:T.Box3|null=null,forceChange=false;
	let last:{date:string;visible:SystemId[]|null;isolate:string|null}={date:'',visible:null,isolate:null},direction:-1|0|1=0,ctx:FxContext|null=null;
	const layers:{script:IssueScript;layer:CustomLayer}[]=[],layerMaterials:T.Material[]=[],restGeoms=new Map<number,T.BufferGeometry>();

	// Segment of a rest point for boxes (layer boxes, fly): the segment whose joint→distal line is nearest.
	const segmentAt=(p:T.Vector3)=>{let best=0,bd=Infinity;rig.segments.forEach(s=>{const j=new T.Vector3(...s.joint),a=new T.Vector3(...s.axis),t=T.MathUtils.clamp(p.clone().sub(j).dot(a),0,s.length),d=j.addScaledVector(a,t).distanceToSquared(p);if(d<bd){bd=d;best=SEGMENTS.indexOf(s.id);}});return best;};
	const warpBox=(box:T.Box3)=>{
		if(box.isEmpty())return box.clone();const seg=segmentAt(box.getCenter(new T.Vector3())),out=new T.Box3(),q:Vec3=[0,0,0];
		for(let k=0;k<8;k++){const p:Vec3=[k&1?box.max.x:box.min.x,k&2?box.max.y:box.min.y,k&4?box.max.z:box.min.z];warpPoint(ws,p,seg,seg,1,false,q);out.expandByPoint(new T.Vector3(...q));}
		return out;
	};

	const patchMaterial=(m:T.Material,opts:{partFx:boolean;soft:boolean})=>{
		const prev=m.onBeforeCompile,prevKey=m.customProgramCacheKey.bind(m),{partFx}=opts;
		m.onBeforeCompile=(shader,renderer)=>{
			prev.call(m,shader,renderer);
			Object.assign(shader.uniforms,warpU,{twSoft:{value:opts.soft?1:0}});
			if(partFx)Object.assign(shader.uniforms,{tfxState:{value:fx.texture},tfxWidth:{value:fx.width}});
			const pars=[
				partFx?`varying float tfxVisible; varying vec4 tfxTint; uniform sampler2D tfxState; uniform float tfxWidth;\nvec4 tfxRow(float row){ return texture2D(tfxState, vec2((partIndex + 0.5) / tfxWidth, (row + 0.5) / ${FX_ROWS}.0)); }\n${FX_PARS}`:'',
				warpOn?`#ifndef TW_FIXED_SEG\nattribute vec3 seg;\n#endif\n${WARP_PARS}`:'',
			].join('\n');
			const apply=[
				partFx?`tfxVisible = tfxRow(0.0).x; tfxTint = tfxRow(1.0);\n${FX_APPLY}`:'',
				warpOn?`#ifdef TW_FIXED_SEG\nvec3 twSeg = vec3(float(TW_FIXED_SEG), float(TW_FIXED_SEG), 1.0);\n#else\nvec3 twSeg = seg;\n#endif\n${WARP_APPLY}`:'',
			].join('\n');
			shader.vertexShader=shader.vertexShader.replace('#include <common>',()=>`#include <common>\n${pars}`).replace('#include <begin_vertex>',()=>'').replace('#include <beginnormal_vertex>',()=>`#include <beginnormal_vertex>\n#include <begin_vertex>\n{\n${apply}\n}`);
			if(partFx)shader.fragmentShader=shader.fragmentShader.replace('#include <common>',()=>'#include <common>\nvarying float tfxVisible; varying vec4 tfxTint;')
				.replace('#include <clipping_planes_fragment>',()=>'#include <clipping_planes_fragment>\nif (tfxVisible < 0.5) discard;')
				.replace('#include <color_fragment>',()=>'#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, tfxTint.rgb, tfxTint.a);');
		};
		m.customProgramCacheKey=()=>`${prevKey()}|timeline:${partFx?1:0}${warpOn?1:0}`;m.needsUpdate=true;
	};

	const segAttribute=(i:number)=>{
		const vc=atlas.parts[i].vertexCount,a=new Float32Array(vc*3),o0=segOffset[i];
		if(o0+vc*2<=segBytes.length)for(let v=0;v<vc;v++){const b0=segBytes[o0+v*2];a[v*3]=b0&15;a[v*3+1]=b0>>4;a[v*3+2]=segBytes[o0+v*2+1]/255;}
		else for(let v=0;v<vc;v++)a[v*3+2]=1;
		return new T.BufferAttribute(a,3);
	};

	const layerCtx:LayerContext={
		scene,atlas,indicesOf,
		restGeometry(i){
			const r=rest[i],g=pickers[i]?.geometry;if(!r||!g)return undefined;let rg=restGeoms.get(i);
			if(!rg){rg=new T.BufferGeometry();rg.setAttribute('position',new T.BufferAttribute(r,3));for(const k of ['normal','seg']){const a=g.getAttribute(k);if(a)rg.setAttribute(k,a);}rg.setIndex(g.getIndex());rg.boundingBox=new T.Box3().setFromArray(r);rg.computeBoundingSphere();restGeoms.set(i,rg);}
			return rg;
		},
		material(m){
			const mat=new T.MeshStandardMaterial({color:m.color,metalness:.08,roughness:.53,side:T.DoubleSide,transparent:!!m.transparent,opacity:m.opacity??1,depthWrite:m.depthWrite??true});
			if(m.segment)mat.defines={...mat.defines,TW_FIXED_SEG:SEGMENTS.indexOf(m.segment)};
			patchMaterial(mat,{partFx:false,soft:!!m.soft});layerMaterials.push(mat);return mat;
		},
		requestFly(box){pendingFly=warpBox(box);},
	};

	const isolateBox=(id:string)=>{
		const s=scriptFor(id);if(!s)return null;const box=new T.Box3();s.parts.forEach(name=>indicesOf(name).forEach(i=>box.union(bounds[i])));
		const lb=layers.find(l=>l.script.id===id)?.layer.box();if(lb&&!lb.isEmpty())box.union(warpBox(lb));
		return box.isEmpty()?null:box;
	};

	return {
		patchMaterial,segAttribute,isolateBox,
		ready(p){
			pickers=p;rest=p.map(m=>(m?.geometry.getAttribute('position').array as Float32Array|undefined)?.slice());
			for(const s of SCRIPTS){if(!s.layer)continue;try{const layer=s.layer();if(layer.init(layerCtx))layers.push({script:s,layer});else layer.dispose();}catch(e){console.warn(`AnyHealth timeline: layer ${s.id} failed`,e);}}
			forceChange=true;
		},
		update(f){
			const dateChanged=!!f.date&&f.date!==last.date,isoChanged=f.isolate!==last.isolate,visChanged=f.visible!==last.visible;
			if(dateChanged){
				if(last.date)direction=f.date>last.date?1:-1;
				const body=bodyAt(f.date);ws=warpState(rig,body);writeWarpUniforms(warpU,ws);ctx={body,date:f.date};const c=ctx;
				const list:PartFx[]=[];for(const s of SCRIPTS){try{list.push(...s.fxAt(dayOf(s,f.date),c));}catch(e){console.warn(`AnyHealth timeline: ${s.id} fxAt failed`,e);}}
				list.push(...growthFx(body));fxMap=mergeFx(list,indicesOf,restCenter);
			}
			let changed=dateChanged||isoChanged||visChanged||forceChange;forceChange=false;
			if(dateChanged||isoChanged||visChanged){
				const vis=visibilityFor(atlas.parts,f.visible,isolatedParts(f.isolate)),out=new Map(fxMap);
				for(let i=0;i<n;i++)if(vis[i]<1){const r=out.get(i)??identityFx(restCenters[i]);out.set(i,{...r,visible:r.visible*vis[i]});}
				writeFx(fx,out);
			}
			let animating=false;
			if(ctx)for(const {script,layer} of layers){
				const own=f.isolate===script.id,r=layer.update(dayOf(script,ctx.date),{systemVisible:f.isolate?()=>own:s=>f.visible.includes(s),hiddenByIsolate:!!f.isolate&&!own,now:f.now,direction,ctx});
				changed||=r.changed;animating||=r.animating;
			}
			let fly=pendingFly;pendingFly=null;if(isoChanged&&f.isolate)fly=isolateBox(f.isolate)??fly;
			last={date:f.date||last.date,visible:f.visible,isolate:f.isolate};
			return {changed,animating,fly};
		},
		settle(){
			const p:Vec3=[0,0,0],nn:Vec3=[0,0,0],q:Vec3=[0,0,0];
			pickers.forEach((mesh,i)=>{
				const r=rest[i];if(!mesh||!r)return;const g=mesh.geometry,pos=g.getAttribute('position') as T.BufferAttribute,arr=pos.array as Float32Array,nrm=g.getAttribute('normal').array as Int8Array,sg=g.getAttribute('seg')?.array as Float32Array|undefined,f=fxMap.get(i)??identityFx(restCenters[i]);
				for(let v=0,k=0;v<r.length/3;v++,k+=3){
					p[0]=r[k];p[1]=r[k+1];p[2]=r[k+2];nn[0]=nrm[k]/127;nn[1]=nrm[k+1]/127;nn[2]=nrm[k+2]/127;
					applyFxPoint(f,p,nn,q);warpPoint(ws,q,sg?sg[k]:0,sg?sg[k+1]:0,sg?sg[k+2]:1,soft[i],q);arr[k]=q[0];arr[k+1]=q[1];arr[k+2]=q[2];
				}
				pos.needsUpdate=true;bounds[i].setFromBufferAttribute(pos);g.boundingBox=bounds[i].clone();g.computeBoundingSphere();
			});
		},
		dispose(){
			layers.forEach(l=>l.layer.dispose());layers.length=0;layerMaterials.forEach(m=>m.dispose());restGeoms.forEach(g=>g.dispose());restGeoms.clear();fx.texture.dispose();pickers=[];rest=[];
		},
	};
}
