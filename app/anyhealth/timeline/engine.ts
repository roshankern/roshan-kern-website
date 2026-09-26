/** The AnyHealth timeline engine: turns a date into the body's growth warp, every issue script's part effects and custom layers, on top of the atlas scene (see docs/superpowers/specs/2026-09-25-anyhealth-timeline-design.md). scene.tsx creates it only in timeline mode.
 *
 * Shader injection (patchMaterial), on top of scene.tsx's own onBeforeCompile (which it chains):
 * - Vertex, after `#include <common>`: when partFx, `varying float tfxVisible; varying vec4 tfxTint; uniform sampler2D tfxState; uniform float tfxWidth; vec4 tfxRow(float row)` (this vertex's part texel, rows as in fx/part-fx.ts), then FX_PARS; when WARP_APPLY is non-empty, `#define TW_SEG_BYTES` (partFx materials: the atlas `seg` is the 4 unnormalized segments.bin bytes per vertex), TW_SEG_ATTRS (the `seg` / `segD` attributes, none under the material defines TW_FIXED_SEG), then WARP_PARS.
 * - Vertex, main: `#include <begin_vertex>` is hoisted to just after `#include <beginnormal_vertex>`, so `transformed` (= position, rest space) and `objectNormal` are both live before defaultnormal_vertex reads the normal. Right after it, in one `{ }` block: when partFx, `tfxVisible = tfxRow(0.).x; tfxTint = tfxRow(1.);` then FX_APPLY; when WARP_APPLY is non-empty, TW_SEG (warp-glsl.ts: `vec3 twSeg` = segA, segB, weightA 0..1, from TW_FIXED_SEG, the byte `seg`, or a float `seg`) then WARP_APPLY.
 * - Fragment, when partFx: `if (tfxVisible < 0.5) discard;` after `#include <clipping_planes_fragment>` and `diffuseColor.rgb = mix(diffuseColor.rgb, tfxTint.rgb, tfxTint.a);` after `#include <color_fragment>`.
 * - Uniforms: warpUniforms() (shared by every material), `twSoft` per material, and `tfxState` / `tfxWidth` when partFx.
 * Visibility in timeline mode goes through here only: scene.tsx keeps partState at 1 and the engine writes fx row 0 `visible` = visibilityFor(...) × the merged PartFx visibility. */
import * as T from 'three';
import type {Atlas,SystemId} from '../atlas/anatomy';
import {SEGMENTS,type CustomLayer,type FxContext,type IssueScript,type LayerContext,type PartFx,type Rig,type Vec3} from './types';
import {SCRIPTS,scriptFor,dayOf} from './issues';
import {bodyAt} from './growth/proportions';
import {growthFx} from './growth/organs';
import {eruptionFx} from './issues/teeth/eruption';
import {warpState,warpPoint,SEG_STRIDE,D_UNIT,AXIAL_SEGMENTS,type WarpState} from './growth/warp';
import {WARP_PARS,WARP_APPLY,TW_SEG,TW_SEG_ATTRS,warpUniforms,writeWarpUniforms} from './growth/warp-glsl';
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
	/** Re-warp picker geometry and the shared per-part bounds (in place). Call when the date settles. Skips parts whose resolved fx and warp segments are unchanged since their last settle; returns how many parts it re-warped. */
	settle():number;
	/** Warped union box of an issue's parts and layer, for Isolate. */
	isolateBox(id:string):T.Box3|null;
	/** Default pivot of atlas part `i`: its rest bounds centre, from the decoded vertices once ready() has them (atlas.json bounds are corrupt for a few parts, e.g. Right cornea), else from atlas bounds. */
	restCenter(i:number):Vec3;
	/** Performance fallback state: tier 0 normal, 1 pixel ratio 1, 2 also throttled date applies; lowRes = the engine set pixel ratio 1 (the scene keeps 1 on resize); applies = date recomputes so far. */
	stats():{tier:0|1|2;lowRes:boolean;applies:number};
	/** Final fx row-0 visibility of atlas part `i` (switches × Isolate × merged PartFx visible), as the shader sees it: picking treats < 0.5 as hidden. */
	partVisible(i:number):number;
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

/** What the engine needs of the renderer (performance fallback): the GL context for WEBGL_debug_renderer_info, and the pixel ratio. */
export interface EngineRenderer {getContext():{getExtension(name:string):unknown;getParameter(p:number):unknown};setPixelRatio(r:number):void}

export function createEngine(o:{atlas:Atlas;scene:T.Scene;bounds:T.Box3[];rig:Rig;segments:ArrayBuffer;renderer?:EngineRenderer}):Engine{
	const {atlas,scene,bounds,rig}=o,n=atlas.parts.length;
	const warpU=warpUniforms(),fx=createFxTexture(n),warpOn=!!WARP_APPLY.trim();
	const restCenters=bounds.map(b=>b.getCenter(new T.Vector3()).toArray() as Vec3),soft=atlas.parts.map(p=>SOFT_SYSTEMS.includes(p.system));
	const byName=new Map<string,number[]>();atlas.parts.forEach((p,i)=>{const l=byName.get(p.name)??[];l.push(i);byName.set(p.name,l);});
	const indicesOf=(name:string)=>byName.get(name)??[],restCenter=(i:number)=>restCenters[i];
	// segments.bin: per part in atlas order, vertexCount × SEG_STRIDE bytes (growth/warp.ts: segA | segB<<4, round(weightA·255), dBone as uint16).
	const segBytes=new Uint8Array(o.segments),segOffset=new Int32Array(n+1);atlas.parts.forEach((p,i)=>{segOffset[i+1]=segOffset[i]+p.vertexCount*SEG_STRIDE;});
	if(segBytes.length!==segOffset[n])console.warn(`AnyHealth timeline: segments.bin has ${segBytes.length} bytes, the atlas needs ${segOffset[n]}; missing parts ride the trunk.`);

	let ws:WarpState=warpState(rig,bodyAt(BIRTH_DATE));writeWarpUniforms(warpU,ws);
	let fxMap=new Map<number,ResolvedFx>(),pickers:(T.Mesh|undefined)[]=[],rest:(Float32Array|undefined)[]=[],pendingFly:T.Box3|null=null,forceChange=false;
	// applied = the date whose body / fx are in the uniforms and texture; seen = the last frame's date (they differ while a throttled date is pending).
	let applied='',seen='',lastVis:SystemId[]|null=null,lastIso:string|null=null,direction:-1|0|1=0,ctx:FxContext|null=null,remerge=false;
	/** Scripts whose layer failed to build: their fx lose `visible` (a hide only makes sense when the layer draws the replacement). */
	const noLayer=new Set<string>();
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
				warpOn?`${partFx?'#define TW_SEG_BYTES\n':''}${TW_SEG_ATTRS}\n${WARP_PARS}`:'',
			].join('\n');
			const apply=[
				partFx?`tfxVisible = tfxRow(0.0).x; tfxTint = tfxRow(1.0);\n${FX_APPLY}`:'',
				warpOn?`${TW_SEG}\n${WARP_APPLY}`:'',
			].join('\n');
			shader.vertexShader=shader.vertexShader.replace('#include <common>',()=>`#include <common>\n${pars}`).replace('#include <begin_vertex>',()=>'').replace('#include <beginnormal_vertex>',()=>`#include <beginnormal_vertex>\n#include <begin_vertex>\n{\n${apply}\n}`);
			if(partFx)shader.fragmentShader=shader.fragmentShader.replace('#include <common>',()=>'#include <common>\nvarying float tfxVisible; varying vec4 tfxTint;')
				.replace('#include <clipping_planes_fragment>',()=>'#include <clipping_planes_fragment>\nif (tfxVisible < 0.5) discard;')
				.replace('#include <color_fragment>',()=>'#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, tfxTint.rgb, tfxTint.a);');
		};
		m.customProgramCacheKey=()=>`${prevKey()}|timeline:${partFx?1:0}${warpOn?1:0}`;m.needsUpdate=true;
	};

	/** Atlas parts: the part's segments.bin bytes as they are, 4 unnormalized bytes per vertex (the shader decodes them with TW_SEG_BYTES); a part missing from segments.bin rides the trunk. */
	const segAttribute=(i:number)=>{
		const vc=atlas.parts[i].vertexCount,o0=segOffset[i],Z=SEG_STRIDE;let a:Uint8Array;
		if(o0+vc*Z<=segBytes.length)a=segBytes.slice(o0,o0+vc*Z);else{a=new Uint8Array(vc*Z);for(let v=0;v<vc;v++)a[v*Z+1]=255;}
		return new T.BufferAttribute(a,Z,false);
	};
	/** The float `seg` (segA, segB, weightA 0..1) and `segD` (bone distance, metres) custom layers read from restGeometry (types.ts). */
	const floatSeg=(i:number)=>{const b=segAttribute(i).array as Uint8Array,Z=SEG_STRIDE,nv=b.length/Z,a=new Float32Array(nv*3),d=new Float32Array(nv);for(let v=0;v<nv;v++){const k=v*Z;a[v*3]=b[k]&15;a[v*3+1]=b[k]>>4;a[v*3+2]=b[k+1]/255;d[v]=(b[k+2]|b[k+3]<<8)*D_UNIT;}return {seg:new T.BufferAttribute(a,3),segD:new T.BufferAttribute(d,1)};};

	const layerCtx:LayerContext={
		scene,atlas,indicesOf,
		restGeometry(i){
			const r=rest[i],g=pickers[i]?.geometry;if(!r||!g)return undefined;let rg=restGeoms.get(i);
			if(!rg){rg=new T.BufferGeometry();rg.setAttribute('position',new T.BufferAttribute(r,3));const nm=g.getAttribute('normal');if(nm)rg.setAttribute('normal',nm);{const f=floatSeg(i);rg.setAttribute('seg',f.seg);rg.setAttribute('segD',f.segD);}rg.setIndex(g.getIndex());rg.boundingBox=new T.Box3().setFromArray(r);rg.computeBoundingSphere();restGeoms.set(i,rg);}
			return rg;
		},
		material(m){
			const mat=new T.MeshStandardMaterial({color:m.color,metalness:.08,roughness:.53,side:T.DoubleSide,transparent:!!m.transparent,opacity:m.opacity??1,depthWrite:m.depthWrite??true});
			if(m.segment)mat.defines={...mat.defines,TW_FIXED_SEG:SEGMENTS.indexOf(m.segment)};else if(m.segD)mat.defines={...mat.defines,TW_SEG_D:''};
			patchMaterial(mat,{partFx:false,soft:!!m.soft});layerMaterials.push(mat);return mat;
		},
		requestFly(box){pendingFly=warpBox(box);},
	};

	// settle(): per part, a bit mask of the segments its vertices use; the fx and warp it was last settled with.
	let segMask=new Uint16Array(0),settledFx:(ResolvedFx|undefined)[]=[],settledWs:WarpState|null=null,unsettled=true;
	const sameFx=(a:ResolvedFx|undefined,b:ResolvedFx|undefined)=>a===b||!!a&&!!b&&a.visible===b.visible&&a.swell===b.swell&&a.swellBand?.[0]===b.swellBand?.[0]&&a.swellBand?.[1]===b.swellBand?.[1]&&(['tint','scale','rotate','translate','pivot'] as const).every(k=>a[k].every((v,j)=>v===b[k][j]));
	/** Bit mask of the segments whose warp parameters differ between two states (all of them when the ground moved; trunk / neck / head when the axial remap changed). */
	const changedSegments=(a:WarpState|null,b:WarpState)=>{
		if(!a||a.ground!==b.ground)return 0xffff;let m=0;
		// The axial remap (trunk, neck, head) has its own parameters (face / cranium rates, girth steps): any change re-warps all three.
		for(let k=0;k<a.axial.length;k++)if(a.axial[k]!==b.axial[k]){m|=(1<<AXIAL_SEGMENTS)-1;break;}
		for(let i=0;i<SEGMENTS.length;i++){const k=i*3;if(a.alongScale[i]!==b.alongScale[i]||a.boneScale[i]!==b.boneScale[i]||a.softScale[i]!==b.softScale[i]||a.rootGirth[i]!==b.rootGirth[i]||a.newJoint[k]!==b.newJoint[k]||a.newJoint[k+1]!==b.newJoint[k+1]||a.newJoint[k+2]!==b.newJoint[k+2])m|=1<<i;}
		return m;
	};
	const settle=()=>{
		if(seen&&(seen!==applied||remerge)){applyDate(seen);if(lastVis)writeVisibility(lastVis,lastIso);forceChange=true;}
		const p:Vec3=[0,0,0],nn:Vec3=[0,0,0],q:Vec3=[0,0,0],moved=changedSegments(settledWs,ws);let count=0;
		pickers.forEach((mesh,i)=>{
			const r=rest[i];if(!mesh||!r)return;const fi=fxMap.get(i);
			if(settledWs&&!(segMask[i]&moved)&&sameFx(settledFx[i],fi))return;settledFx[i]=fi;count++;
			const g=mesh.geometry,pos=g.getAttribute('position') as T.BufferAttribute,arr=pos.array as Float32Array,nrm=g.getAttribute('normal').array as Int8Array,sg=g.getAttribute('seg')?.array as Uint8Array|undefined,Z=SEG_STRIDE,f=fi??identityFx(restCenters[i]);
			for(let v=0,k=0;v<r.length/3;v++,k+=3){
				p[0]=r[k];p[1]=r[k+1];p[2]=r[k+2];nn[0]=nrm[k]/127;nn[1]=nrm[k+1]/127;nn[2]=nrm[k+2]/127;
				applyFxPoint(f,p,nn,q);const m=v*Z;warpPoint(ws,q,sg?sg[m]&15:0,sg?sg[m]>>4:0,sg?sg[m+1]/255:1,soft[i],q,sg?(sg[m+2]|sg[m+3]<<8)*D_UNIT:0);arr[k]=q[0];arr[k+1]=q[1];arr[k+2]=q[2];
			}
			pos.needsUpdate=true;bounds[i].setFromBufferAttribute(pos);g.boundingBox=bounds[i].clone();g.computeBoundingSphere();
		});
		settledWs=ws;unsettled=false;return count;
	};

	/** Recompute the body, warp uniforms and merged fx for `date` (the heavy part of a date change). */
	const applyDate=(date:string)=>{
		if(applied&&date!==applied)direction=date>applied?1:-1;remerge=false;unsettled=true;applied=date;perf.applies++;
		const body=bodyAt(date);ws=warpState(rig,body);writeWarpUniforms(warpU,ws);ctx={body,date};const c=ctx;
		const list:PartFx[]=[];for(const s of SCRIPTS){try{const l=s.fxAt(dayOf(s,date),c);list.push(...(noLayer.has(s.id)?l.map(({visible:_,...r})=>r):l));}catch(e){console.warn(`AnyHealth timeline: ${s.id} fxAt failed`,e);}}
		list.push(...growthFx(body),...eruptionFx(body));fxMap=mergeFx(list,indicesOf,restCenter);
	};
	/** Write the fx texture: the merged fx × the switches / Isolate visibility. */
	const writeVisibility=(visible:SystemId[],isolate:string|null)=>{
		const vis=visibilityFor(atlas.parts,visible,isolatedParts(isolate)),out=new Map(fxMap);
		for(let i=0;i<n;i++)if(vis[i]<1){const r=out.get(i)??identityFx(restCenters[i]);out.set(i,{...r,visible:r.visible*vis[i]});}
		writeFx(fx,out);
	};

	// Performance fallback: software GL renders at pixel ratio 1 from the start. During play (a frame whose date differs from the last frame's), an exponential
	// average of the frame time below 30 fps for 2 s drops to pixel ratio 1 (tier 1); 2 s more below 30 fps throttles date applies to one per 100 ms (tier 2), and a pending date always applies on pause or settle.
	const SLOW_MS=1000/30,SLOW_FOR=2000,THROTTLE_MS=100,EMA=0.1;
	const perf={tier:0 as 0|1|2,lowRes:false,applies:0,ema:-1,prevNow:-1,slowSince:-1,lastApply:-Infinity};
	const lowResNow=()=>{if(perf.lowRes)return;perf.lowRes=true;o.renderer?.setPixelRatio(1);};
	const perfTick=(now:number,play:boolean)=>{
		const dt=perf.prevNow<0?0:Math.min(250,now-perf.prevNow);perf.prevNow=now;
		if(!play||dt<=0){if(!play)perf.slowSince=-1;return;}
		perf.ema=perf.ema<0?dt:perf.ema+EMA*(dt-perf.ema);
		if(perf.ema<=SLOW_MS){perf.slowSince=-1;return;}
		if(perf.slowSince<0)perf.slowSince=now;else if(now-perf.slowSince>=SLOW_FOR&&perf.tier<2){perf.tier=perf.tier===0?1:2;perf.slowSince=now;if(perf.tier===1)lowResNow();}
	};
	const update=(f:EngineFrame)=>{
		const play=!!f.date&&f.date!==seen;if(f.date)seen=f.date;perfTick(f.now,play);
		const want=seen,isoChanged=f.isolate!==lastIso,visChanged=f.visible!==lastVis;
		const doDate=!!want&&(want!==applied||remerge)&&!(perf.tier>=2&&play&&f.now-perf.lastApply<THROTTLE_MS);
		if(doDate){applyDate(want);perf.lastApply=f.now;}
		let changed=doDate||isoChanged||visChanged||forceChange;forceChange=false;
		if(doDate||isoChanged||visChanged)writeVisibility(f.visible,f.isolate);
		let animating=false;
		if(ctx)for(const {script,layer} of layers){
			const own=f.isolate===script.id,r=layer.update(dayOf(script,ctx.date),{systemVisible:f.isolate?()=>own:s=>f.visible.includes(s),hiddenByIsolate:!!f.isolate&&!own,isolated:own,now:f.now,direction,ctx});
			changed||=r.changed;animating||=r.animating;
		}
		let fly=pendingFly;pendingFly=null;if(isoChanged&&f.isolate)fly=isolateBox(f.isolate)??fly;
		lastVis=f.visible;lastIso=f.isolate;
		return {changed,animating,fly};
	};

	const isolateBox=(id:string)=>{
		const s=scriptFor(id);if(!s)return null;if(unsettled)settle();const box=new T.Box3();s.parts.forEach(name=>indicesOf(name).forEach(i=>box.union(bounds[i])));
		const lb=layers.find(l=>l.script.id===id)?.layer.box();if(lb&&!lb.isEmpty())box.union(warpBox(lb));
		return box.isEmpty()?null:box;
	};

	return {
		patchMaterial,segAttribute,isolateBox,
		partVisible:i=>fx.data[i*4],restCenter,stats:()=>({tier:perf.tier,lowRes:perf.lowRes,applies:perf.applies}),
		ready(p){
			pickers=p;rest=p.map(m=>(m?.geometry.getAttribute('position').array as Float32Array|undefined)?.slice());
			// Default pivots from the decoded vertices (atlas.json bounds carry stray vertices for a few parts).
			segMask=new Uint16Array(n);for(let i=0;i<n;i++){let m=0;for(let k=segOffset[i];k<segOffset[i+1]&&k+1<segBytes.length;k+=SEG_STRIDE){m|=1<<(segBytes[k]&15);if(segBytes[k+1]<255)m|=1<<(segBytes[k]>>4);}segMask[i]=m||1;}
			rest.forEach((r,i)=>{if(!r||!r.length)return;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let k=0;k<r.length;k+=3)for(let j=0;j<3;j++){const v=r[k+j];if(v<lo[j])lo[j]=v;if(v>hi[j])hi[j]=v;}restCenters[i]=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2];});
			for(const s of SCRIPTS){if(!s.layer)continue;let ok=false;try{const layer=s.layer();ok=layer.init(layerCtx);if(ok)layers.push({script:s,layer});else layer.dispose();}catch(e){console.warn(`AnyHealth timeline: layer ${s.id} failed`,e);}if(!ok)noLayer.add(s.id);}
			forceChange=true;remerge=true;
			// Software GL (SwiftShader, llvmpipe): pixel ratio 1 from the start.
			if(o.renderer)try{const gl=o.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info') as {UNMASKED_RENDERER_WEBGL:number}|null,name=String(gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:0x1f01/* RENDERER */));if(/SwiftShader|llvmpipe/i.test(name))lowResNow();}catch{/* no GPU info: keep the ratio */}
		},
		update,
		settle,
		dispose(){
			layers.forEach(l=>l.layer.dispose());layers.length=0;layerMaterials.forEach(m=>m.dispose());restGeoms.forEach(g=>g.dispose());restGeoms.clear();fx.texture.dispose();pickers=[];rest=[];
		},
	};
}
