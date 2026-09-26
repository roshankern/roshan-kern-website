/** The AnyHealth timeline engine: turns a date into the body's growth warp, every issue script's part effects and custom layers, on top of the atlas scene (see docs/superpowers/specs/2026-09-25-anyhealth-timeline-design.md). scene.tsx creates it only in timeline mode.
 *
 * Shader injection (patchMaterial), on top of scene.tsx's own onBeforeCompile (which it chains):
 * - Vertex, after `#include <common>`: when partFx, `varying float tfxVisible; varying float tfxFocus; varying vec4 tfxTint; uniform sampler2D tfxState; uniform float tfxWidth; vec4 tfxRow(float row)` (this vertex's part texel, rows as in fx/part-fx.ts), then FX_PARS; when WARP_APPLY is non-empty, `#define TW_SEG_BYTES` (partFx materials: the atlas `seg` is the 4 unnormalized segments.bin bytes per vertex), TW_SEG_ATTRS (the `seg` / `segD` attributes, none under the material defines TW_FIXED_SEG), then WARP_PARS.
 * - Vertex, main: `#include <begin_vertex>` is hoisted to just after `#include <beginnormal_vertex>`, so `transformed` (= position, rest space) and `objectNormal` are both live before defaultnormal_vertex reads the normal. Right after it, in one `{ }` block: when partFx, `tfxVisible = tfxRow(0.).x; tfxFocus = tfxRow(4.).w; tfxTint = tfxRow(1.);` then FX_APPLY; when WARP_APPLY is non-empty, TW_SEG (warp-glsl.ts: `vec3 twSeg` = segA, segB, weightA 0..1, from TW_FIXED_SEG, the byte `seg`, or a float `seg`) then WARP_APPLY.
 * - Fragment, when partFx: after `#include <common>`, `varying float tfxVisible; varying float tfxFocus; varying vec4 tfxTint; uniform float tfxGhost; uniform float tfxPass;`; FX_DISCARD (fx/part-fx-glsl.ts: hidden parts, and in pass 0 the non-focus parts while ghosting, in pass 1 the focus parts) after `#include <clipping_planes_fragment>`;
 *   `diffuseColor.rgb = mix(diffuseColor.rgb, tfxTint.rgb, tfxTint.a);` after `#include <color_fragment>`; FX_GHOST (the ghost pass alpha: GHOST_ALPHA × fresnel rim) before `#include <opaque_fragment>`, so partFx materials must be lit (`normal`, `vViewPosition`).
 * - Uniforms: warpUniforms() and `tfxGhost` / `tfxPass` (shared by every material), `twSoft` per material, and `tfxState` / `tfxWidth` when partFx.
 * Visibility in timeline mode goes through here only: scene.tsx keeps partState at 1 and the engine writes fx row 0 `visible` = visibilityFor(...) × the merged PartFx visibility.
 * Ghosting (focus): fx row 4 .w = 1 on the focused script's parts (and its focusAlso scripts'), rewritten only when the focus id, switches or date change; the crossfade is the one uniform tfxGhost. scene.tsx renders as usual (pass 0: focus parts and everything
 * outside the atlas), then, while ghost > 0, renderGhostPass draws the non-focus atlas parts translucent over it (pass 1: tfxPass 1, every partFx material transparent without depth writes, nothing else drawn, no clear). */
import * as T from 'three';
import type {Atlas,SystemId} from '../atlas/anatomy';
import {SEGMENTS,type CustomLayer,type FxContext,type IssueScript,type LayerContext,type PartFx,type Rig,type Vec3} from './types';
import {SCRIPTS,scriptFor,dayOf} from './issues';
import {bodyAt} from './growth/proportions';
import {growthFx} from './growth/organs';
import {eruptionFx} from './issues/teeth/eruption';
import {warpState,warpPoint,SEG_STRIDE,D_UNIT,AXIAL_SEGMENTS,TAPER_STRIDE,type WarpState} from './growth/warp';
import {WARP_PARS,WARP_APPLY,TW_SEG,TW_SEG_ATTRS,warpUniforms,writeWarpUniforms} from './growth/warp-glsl';
import {FX_ROWS,createFxTexture,mergeFx,writeFx,applyFxPoint,identityFx,type ResolvedFx} from './fx/part-fx';
import {FX_PARS,FX_APPLY,FX_DISCARD,FX_GHOST} from './fx/part-fx-glsl';
import {BIRTH_DATE} from '../health/types';
import {toDays,fromDays} from '../health/dates';

export interface EngineFrame {date:string;visible:SystemId[];isolate:string|null;now:number;
	/** v2: fractional days since BIRTH_DATE; when present it wins over `date` for issue fx days (smooth sub-day animation). Growth still follows `date`. */
	day?:number;
	/** v2: guided or manual focus: the script shown solid and how far everything else fades toward GHOST_ALPHA (0..1). Rendering uses this, not `isolate`; null = nothing focused; absent = `isolate` (when set) at ghost 1 (the v1 Isolate, as a ghost). An unknown id focuses nothing. `isolate` alone still drives the Isolate camera fly. */
	focus?:{id:string;ghost:number}|null;
}
export interface Engine {
	patchMaterial(m:T.Material,opts:{partFx:boolean;soft:boolean}):void;
	/** Per-vertex attributes to add to each part geometry before merging (segment weights). */
	segAttribute(partIndex:number):T.BufferAttribute;
	/** After every chunk is decoded: build custom layers. */
	ready(pickers:(T.Mesh|undefined)[]):void;
	update(f:EngineFrame):{changed:boolean;animating:boolean;fly:T.Box3|null};
	/** Re-warp picker geometry and the shared per-part bounds (in place), completing any sliced settle in progress. Skips parts whose resolved fx and warp segments are unchanged since their last settle; returns how many parts the pass re-warped. A no-op (0) before ready(). */
	settle():number;
	/** One time slice of the settle (scene.tsx calls it each frame once the date has rested): re-warps from a cursor for about `budgetMs` (at least one vertex chunk), resuming where the last slice stopped; a date change mid-way carries on from the cursor with the skip rules against each part's own last settle. True when nothing is left. */
	settleSlice(budgetMs:number):boolean;
	/** Complete a sliced settle in progress synchronously (scene.tsx calls it before every pick); returns how many parts the pass re-warped, 0 when none is in progress. */
	finishSettle():number;
	/** Warped union box of an issue's parts and layer (and those of its focusAlso scripts), for Isolate; null before ready() (an Isolate made then flies once ready). */
	isolateBox(id:string):T.Box3|null;
	/** v2: warped union box of a script's parts and layer (and those of its focusAlso scripts) at fractional day `day` (since BIRTH_DATE): the part vertices through that day's merged fx and body warp (settle's math, on rest positions, touching no engine state) and the layer box warped with that day's body; null before ready() or for an unknown id. At the applied date it equals isolateBox after a settle. */
	focusBox(id:string,day:number):T.Box3|null;
	/** v2: the ghost pass (non-focus atlas parts as translucent rim-lit silhouettes), drawn over the current render target without clearing it; scene.tsx calls it right after its normal render whenever the current ghost > 0 (a no-op at ghost ≤ 0.001). Only partFx meshes draw; every renderer, scene, object and material state it touches is restored. */
	renderGhostPass(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera):void;
	/** Default pivot of atlas part `i`: its rest bounds centre, from the decoded vertices once ready() has them (atlas.json bounds are corrupt for a few parts, e.g. Right cornea), else from atlas bounds. */
	restCenter(i:number):Vec3;
	/** Performance fallback state: tier 0 normal, 1 pixel ratio 1, 2 also throttled date applies; lowRes = the engine set pixel ratio 1 (the scene keeps 1 on resize); applies = date recomputes so far. */
	stats():{tier:0|1|2;lowRes:boolean;applies:number};
	/** Final fx row-0 visibility of atlas part `i` (switches × focus × merged PartFx visible), as the shader sees it, and 0 for a non-focus part while ghost ≥ 0.5: picking treats < 0.5 as hidden. */
	partVisible(i:number):number;
	dispose():void;
}

/** Systems warped with the soft-tissue girth. */
export const SOFT_SYSTEMS:SystemId[]=['muscular','integumentary','connective'];

/** Per-part visibility from the switches and focus: 1 for the focused script's parts (whatever the switches say) and for parts whose system is switched on; the rest of the body is ghosted, not hidden (fx row 4 .w, tfxGhost). */
export function visibilityFor(parts:{name:string;system:SystemId}[],visible:SystemId[],focus:Set<string>|null):Float32Array{
	const on=new Set(visible),v=new Float32Array(parts.length);
	parts.forEach((p,i)=>{v[i]=focus?.has(p.name)||on.has(p.system)?1:0;});return v;
}

/** The scripts a focus on `id` shows solid: it and its focusAlso (unknown ids dropped); empty for null or an unknown id. */
export const focusedScripts=(id:string|null)=>{const s=id?scriptFor(id):undefined;return s?[s,...(s.focusAlso??[]).map(scriptFor).filter((x):x is IssueScript=>!!x&&x!==s)]:[];};
/** The atlas part names a focus on `id` shows solid (its and its focusAlso scripts' parts), or null when nothing (or an unknown script) is focused. */
export const focusedParts=(id:string|null)=>{const l=focusedScripts(id);return l.length?new Set(l.flatMap(s=>s.parts)):null;};
/** The frame's effective focus: `focus` when given (null = none), else a set `isolate` at ghost 1 (the v1 Isolate); ghost clamped to 0..1; an unknown script id focuses nothing. */
export const frameFocus=(f:Pick<EngineFrame,'isolate'|'focus'>):{id:string;ghost:number}|null=>{
	const r=f.focus!==undefined?f.focus:f.isolate?{id:f.isolate,ghost:1}:null;return r&&scriptFor(r.id)?{id:r.id,ghost:Math.min(1,Math.max(0,r.ghost||0))}:null;
};

/** What the engine needs of the renderer (performance fallback): the GL context for WEBGL_debug_renderer_info, and the pixel ratio. */
export interface EngineRenderer {getContext():{getExtension(name:string):unknown;getParameter(p:number):unknown};setPixelRatio(r:number):void}

export function createEngine(o:{atlas:Atlas;scene:T.Scene;bounds:T.Box3[];rig:Rig;segments:ArrayBuffer;renderer?:EngineRenderer}):Engine{
	const {atlas,scene,bounds,rig}=o,n=atlas.parts.length;
	const warpU=warpUniforms(),fx=createFxTexture(n),warpOn=!!WARP_APPLY.trim(),BIRTH=toDays(BIRTH_DATE);
	// Ghosting: the uniforms every partFx material shares, and those materials (the ghost pass draws only them).
	const ghostU={tfxGhost:{value:0},tfxPass:{value:0}},fxMaterials=new Set<T.Material>();
	const restCenters=bounds.map(b=>b.getCenter(new T.Vector3()).toArray() as Vec3),soft=atlas.parts.map(p=>SOFT_SYSTEMS.includes(p.system));
	const byName=new Map<string,number[]>();atlas.parts.forEach((p,i)=>{const l=byName.get(p.name)??[];l.push(i);byName.set(p.name,l);});
	const indicesOf=(name:string)=>byName.get(name)??[],restCenter=(i:number)=>restCenters[i];
	// segments.bin: per part in atlas order, vertexCount × SEG_STRIDE bytes (growth/warp.ts: segA | segB<<4, round(weightA·255), dBone as uint16).
	const segBytes=new Uint8Array(o.segments),segOffset=new Int32Array(n+1);atlas.parts.forEach((p,i)=>{segOffset[i+1]=segOffset[i]+p.vertexCount*SEG_STRIDE;});
	if(segBytes.length!==segOffset[n])console.warn(`AnyHealth timeline: segments.bin has ${segBytes.length} bytes, the atlas needs ${segOffset[n]}; missing parts ride the trunk.`);

	let ws:WarpState=warpState(rig,bodyAt(BIRTH_DATE));writeWarpUniforms(warpU,ws);
	let fxMap=new Map<number,ResolvedFx>(),pickers:(T.Mesh|undefined)[]=[],rest:(Float32Array|undefined)[]=[],pendingFly:T.Box3|null=null,forceChange=false;
	// applied = the date (and fractional day) whose body / fx are in the uniforms and texture, as a key; seen = the last frame's (they differ while a throttled date is pending). appliedT: the applied day since birth, for the direction.
	let applied='',seen='',seenDate='',seenDay:number|undefined,appliedDate='',appliedDay:number|undefined,appliedT=0;
	let lastVis:SystemId[]|null=null,lastIso:string|null=null,lastFocus:string|null=null,direction:-1|0|1=0,ctx:FxContext|null=null,remerge=false;
	/** A script's fx day: from the fractional `day` since birth when given, else whole days from `date`. */
	const fxDayOf=(s:IssueScript,date:string,day:number|undefined)=>day===undefined?dayOf(s,date):day+BIRTH-toDays(s.onset);
	/** Scripts whose layer failed to build: their fx lose `visible` (a hide only makes sense when the layer draws the replacement). */
	const noLayer=new Set<string>();
	const layers:{script:IssueScript;layer:CustomLayer}[]=[],layerMaterials:T.Material[]=[],restGeoms=new Map<number,T.BufferGeometry>();

	// Segment of a rest point for boxes (layer boxes, fly): the segment whose joint→distal line is nearest.
	const segmentAt=(p:T.Vector3)=>{let best=0,bd=Infinity;rig.segments.forEach(s=>{const j=new T.Vector3(...s.joint),a=new T.Vector3(...s.axis),t=T.MathUtils.clamp(p.clone().sub(j).dot(a),0,s.length),d=j.addScaledVector(a,t).distanceToSquared(p);if(d<bd){bd=d;best=SEGMENTS.indexOf(s.id);}});return best;};
	const warpBox=(box:T.Box3,w:WarpState=ws)=>{
		if(box.isEmpty())return box.clone();const seg=segmentAt(box.getCenter(new T.Vector3())),out=new T.Box3(),q:Vec3=[0,0,0];
		for(let k=0;k<8;k++){const p:Vec3=[k&1?box.max.x:box.min.x,k&2?box.max.y:box.min.y,k&4?box.max.z:box.min.z];warpPoint(w,p,seg,seg,1,false,q);out.expandByPoint(new T.Vector3(...q));}
		return out;
	};

	const patchMaterial=(m:T.Material,opts:{partFx:boolean;soft:boolean})=>{
		const prev=m.onBeforeCompile,prevKey=m.customProgramCacheKey.bind(m),{partFx}=opts;
		m.onBeforeCompile=(shader,renderer)=>{
			prev.call(m,shader,renderer);
			Object.assign(shader.uniforms,warpU,{twSoft:{value:opts.soft?1:0}});
			if(partFx)Object.assign(shader.uniforms,{tfxState:{value:fx.texture},tfxWidth:{value:fx.width}},ghostU);
			const pars=[
				partFx?`varying float tfxVisible; varying float tfxFocus; varying vec4 tfxTint; uniform sampler2D tfxState; uniform float tfxWidth;\nvec4 tfxRow(float row){ return texture2D(tfxState, vec2((partIndex + 0.5) / tfxWidth, (row + 0.5) / ${FX_ROWS}.0)); }\n${FX_PARS}`:'',
				warpOn?`${partFx?'#define TW_SEG_BYTES\n':''}${TW_SEG_ATTRS}\n${WARP_PARS}`:'',
			].join('\n');
			const apply=[
				partFx?`tfxVisible = tfxRow(0.0).x; tfxFocus = tfxRow(4.0).w; tfxTint = tfxRow(1.0);\n${FX_APPLY}`:'',
				warpOn?`${TW_SEG}\n${WARP_APPLY}`:'',
			].join('\n');
			shader.vertexShader=shader.vertexShader.replace('#include <common>',()=>`#include <common>\n${pars}`).replace('#include <begin_vertex>',()=>'').replace('#include <beginnormal_vertex>',()=>`#include <beginnormal_vertex>\n#include <begin_vertex>\n{\n${apply}\n}`);
			if(partFx)shader.fragmentShader=shader.fragmentShader.replace('#include <common>',()=>'#include <common>\nvarying float tfxVisible; varying float tfxFocus; varying vec4 tfxTint; uniform float tfxGhost; uniform float tfxPass;')
				.replace('#include <clipping_planes_fragment>',()=>`#include <clipping_planes_fragment>\n${FX_DISCARD}`)
				.replace('#include <color_fragment>',()=>'#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, tfxTint.rgb, tfxTint.a);')
				.replace('#include <opaque_fragment>',()=>`${FX_GHOST}\n#include <opaque_fragment>`);
		};
		m.customProgramCacheKey=()=>`${prevKey()}|timeline:${partFx?1:0}${warpOn?1:0}`;m.needsUpdate=true;if(partFx)fxMaterials.add(m);
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

	// settle(): per part, a bit mask of the segments its vertices use; the fx and warp it was last settled with (undefined: never, or re-warp interrupted).
	let segMask=new Uint16Array(0),settledFx:(ResolvedFx|undefined)[]=[],partWs:(WarpState|undefined)[]=[],unsettled=true,isReady=false,gen=0,flyIso:string|null=null;
	// The sliced settle in progress: the part at `cursor` (re-warped up to vertex `vert`), parts `left` to visit, parts re-warped `count`, for fx / warp generation `gen`.
	let pass:{cursor:number;left:number;vert:number;count:number;gen:number}|null=null;const movedBy=new Map<WarpState,number>();
	const sameFx=(a:ResolvedFx|undefined,b:ResolvedFx|undefined)=>a===b||!!a&&!!b&&a.visible===b.visible&&a.swell===b.swell&&a.swellBand?.[0]===b.swellBand?.[0]&&a.swellBand?.[1]===b.swellBand?.[1]&&(['tint','scale','rotate','translate','pivot'] as const).every(k=>a[k].every((v,j)=>v===b[k][j]));
	/** Bit mask of the segments whose warp parameters differ between two states (all of them when the ground moved; trunk / neck / head when the axial remap changed; a limb when its scales, new joint or joint taper did). */
	const changedSegments=(a:WarpState|null,b:WarpState)=>{
		if(!a||a.ground!==b.ground)return 0xffff;let m=0;
		// The axial remap (trunk, neck, head) has its own parameters (face / cranium rates, girth steps): any change re-warps all three.
		for(let k=0;k<a.axial.length;k++)if(a.axial[k]!==b.axial[k]){m|=(1<<AXIAL_SEGMENTS)-1;break;}
		for(let i=0;i<SEGMENTS.length;i++){const k=i*3;if(a.alongScale[i]!==b.alongScale[i]||a.boneScale[i]!==b.boneScale[i]||a.softScale[i]!==b.softScale[i]||a.taper.subarray(i*TAPER_STRIDE,(i+1)*TAPER_STRIDE).some((v,j)=>v!==b.taper[i*TAPER_STRIDE+j])||a.newJoint[k]!==b.newJoint[k]||a.newJoint[k+1]!==b.newJoint[k+1]||a.newJoint[k+2]!==b.newJoint[k+2])m|=1<<i;}
		return m;
	};
	const moved=(w:WarpState)=>{let m=movedBy.get(w);if(m===undefined){m=changedSegments(w,ws);movedBy.set(w,m);}return m;};
	const CHUNK=2048,pn=[0,0,0] as Vec3,nn:Vec3=[0,0,0],q:Vec3=[0,0,0];
	/** Rest vertex `v` of part `i` (rest positions `r`, the picker's Int8 normals and seg bytes) through fx `f` and warp `w` into `out`: settle's per-vertex math, shared with focusBox. */
	const warpVertex=(i:number,r:Float32Array,nrm:Int8Array,sg:Uint8Array|undefined,f:ResolvedFx,w:WarpState,v:number,out:Vec3)=>{
		const k=v*3,m=v*SEG_STRIDE;pn[0]=r[k];pn[1]=r[k+1];pn[2]=r[k+2];nn[0]=nrm[k]/127;nn[1]=nrm[k+1]/127;nn[2]=nrm[k+2]/127;
		applyFxPoint(f,pn,nn,out);warpPoint(w,out,sg?sg[m]&15:0,sg?sg[m]>>4:0,sg?sg[m+1]/255:1,soft[i],out,sg?(sg[m+2]|sg[m+3]<<8)*D_UNIT:0);
	};
	/** Start a pass, or re-aim the one in progress at the current date: applies a pending date first; a part interrupted mid-way restarts (its settle record is already cleared). */
	const begin=()=>{
		if(seen&&(seen!==applied||remerge)){applyDate(seenDate,seenDay);if(lastVis)writeVisibility(lastVis,lastFocus);forceChange=true;}
		if(!pass){pass={cursor:0,left:n,vert:0,count:0,gen};movedBy.clear();}else if(pass.gen!==gen){pass.gen=gen;pass.left=n;pass.vert=0;movedBy.clear();}
	};
	/** Advance the pass until `deadline` (performance.now() ms), always at least one vertex chunk; true when it is complete. */
	const work=(deadline:number)=>{
		const P=pass!;let worked=false;
		const next=()=>{P.cursor=(P.cursor+1)%n;P.left--;P.vert=0;};
		while(P.left>0){
			const i=P.cursor,mesh=pickers[i],r=rest[i];if(!mesh||!r){next();continue;}const fi=fxMap.get(i);
			if(P.vert===0){const w=partWs[i];if(w&&!(segMask[i]&moved(w))&&sameFx(settledFx[i],fi)){next();continue;}partWs[i]=undefined;}
			if(worked&&performance.now()>=deadline)return false;
			const g=mesh.geometry,pos=g.getAttribute('position') as T.BufferAttribute,arr=pos.array as Float32Array,nrm=g.getAttribute('normal').array as Int8Array,sg=g.getAttribute('seg')?.array as Uint8Array|undefined,f=fi??identityFx(restCenters[i]),nv=r.length/3,end=Math.min(nv,P.vert+CHUNK);
			for(let v=P.vert,k=v*3;v<end;v++,k+=3){warpVertex(i,r,nrm,sg,f,ws,v,q);arr[k]=q[0];arr[k+1]=q[1];arr[k+2]=q[2];}
			worked=true;if(end<nv){P.vert=end;continue;}
			pos.needsUpdate=true;bounds[i].setFromBufferAttribute(pos);g.boundingBox=bounds[i].clone();g.computeBoundingSphere();partWs[i]=ws;settledFx[i]=fi;P.count++;next();
		}
		pass=null;unsettled=false;return true;
	};
	const settle=()=>{if(!isReady)return 0;begin();const P=pass!;work(Infinity);return P.count;};
	const settleSlice=(budgetMs:number)=>{if(!isReady)return true;begin();return work(performance.now()+budgetMs);};

	const keyOf=(date:string,day:number|undefined)=>day===undefined?date:`${date}@${day}`;
	/** Every script's fx (at its fx day), growth and eruption, merged per part. */
	const fxFor=(date:string,day:number|undefined,c:FxContext)=>{
		const list:PartFx[]=[];for(const s of SCRIPTS){try{const l=s.fxAt(fxDayOf(s,date,day),c);list.push(...(noLayer.has(s.id)?l.map(({visible:_,...r})=>r):l));}catch(e){console.warn(`AnyHealth timeline: ${s.id} fxAt failed`,e);}}
		list.push(...growthFx(c.body),...eruptionFx(c.body));return mergeFx(list,indicesOf,restCenter);
	};
	/** Recompute the body, warp uniforms and merged fx for `date` (growth) and `day` (fractional days since birth for issue fx; absent: `date`), the heavy part of a date change. */
	const applyDate=(date:string,day:number|undefined)=>{
		const t=day??toDays(date)-BIRTH;if(applied&&t!==appliedT)direction=t>appliedT?1:-1;remerge=false;unsettled=true;gen++;applied=keyOf(date,day);appliedDate=date;appliedDay=day;appliedT=t;perf.applies++;
		const body=bodyAt(date);ws=warpState(rig,body);writeWarpUniforms(warpU,ws);ctx={body,date};fxMap=fxFor(date,day,ctx);
	};
	/** Write the fx texture: the merged fx × the switches / focus visibility, and the focus flags (row 4 .w). */
	const writeVisibility=(visible:SystemId[],focusId:string|null)=>{
		const parts=focusedParts(focusId),vis=visibilityFor(atlas.parts,visible,parts),out=new Map(fxMap),flag=new Float32Array(n);
		for(let i=0;i<n;i++){if(parts?.has(atlas.parts[i].name))flag[i]=1;if(vis[i]<1){const r=out.get(i)??identityFx(restCenters[i]);out.set(i,{...r,visible:r.visible*vis[i]});}}
		writeFx(fx,out,flag);
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
		const key=f.date?keyOf(f.date,f.day):'',play=!!key&&key!==seen;if(key){seen=key;seenDate=f.date;seenDay=f.day;}perfTick(f.now,play);
		const focus=frameFocus(f),focusId=focus?.id??null,ghost=focus?.ghost??0;
		const isoChanged=f.isolate!==lastIso,focusChanged=focusId!==lastFocus,visChanged=f.visible!==lastVis,ghostChanged=ghost!==ghostU.tfxGhost.value;
		const doDate=!!seen&&(seen!==applied||remerge)&&!(perf.tier>=2&&play&&f.now-perf.lastApply<THROTTLE_MS);
		if(doDate){applyDate(seenDate,seenDay);perf.lastApply=f.now;}
		let changed=doDate||focusChanged||visChanged||ghostChanged||forceChange;forceChange=false;
		// A ghost crossfade is this one uniform write; the texture is rewritten only for a date, focus id or switch change.
		if(doDate||focusChanged||visChanged)writeVisibility(f.visible,focusId);ghostU.tfxGhost.value=ghost;
		let animating=false;const solid=new Set(focusedScripts(focusId).map(s=>s.id));
		if(ctx)for(const {script,layer} of layers){
			const own=solid.has(script.id),r=layer.update(fxDayOf(script,appliedDate,appliedDay),{systemVisible:own?()=>true:s=>f.visible.includes(s),ghost:focusId&&!own?ghost:0,focused:id=>ghost>0&&solid.has(id),isolated:own&&ghost>0,now:f.now,direction,ctx});
			changed||=r.changed;animating||=r.animating;
		}
		// An Isolate flies once, as soon as isolateBox has the parts (an Isolate made before ready() waits for it).
		if(isoChanged)flyIso=f.isolate;let fly=pendingFly;pendingFly=null;if(flyIso&&isReady){fly=isolateBox(flyIso)??fly;flyIso=null;}
		lastVis=f.visible;lastIso=f.isolate;lastFocus=focusId;
		return {changed,animating,fly};
	};

	/** Every layer box of the focused scripts, in rest space. */
	const layerBoxes=(list:IssueScript[])=>list.map(s=>layers.find(l=>l.script===s)?.layer.box()).filter((b):b is T.Box3=>!!b&&!b.isEmpty());
	const isolateBox=(id:string)=>{
		const list=focusedScripts(id);if(!list.length||!isReady)return null;if(unsettled||pass)settle();const box=new T.Box3();focusedParts(id)!.forEach(name=>indicesOf(name).forEach(i=>box.union(bounds[i])));
		layerBoxes(list).forEach(lb=>box.union(warpBox(lb)));
		return box.isEmpty()?null:box;
	};

	const focusBox=(id:string,day:number)=>{
		const list=focusedScripts(id);if(!list.length||!isReady)return null;
		const date=fromDays(BIRTH+day),body=bodyAt(date),w=warpState(rig,body),fxs=fxFor(date,day,{body,date}),box=new T.Box3(),p=new T.Vector3(),o:Vec3=[0,0,0];
		for(const name of focusedParts(id)!)for(const i of indicesOf(name)){
			const r=rest[i],g=pickers[i]?.geometry;if(!r||!g){box.union(warpBox(bounds[i],w));continue;}// no picker: bounds[i] is never settled, still the rest box
			const nrm=g.getAttribute('normal').array as Int8Array,sg=g.getAttribute('seg')?.array as Uint8Array|undefined,f=fxs.get(i)??identityFx(restCenters[i]);
			for(let v=0;v<r.length/3;v++){warpVertex(i,r,nrm,sg,f,w,v,o);box.expandByPoint(p.set(o[0],o[1],o[2]));}
		}
		layerBoxes(list).forEach(lb=>box.union(warpBox(lb,w)));
		return box.isEmpty()?null:box;
	};

	const renderGhostPass=(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera)=>{
		if(ghostU.tfxGhost.value<=.001)return;
		// Only partFx meshes draw: everything else (ground, platform, layers) is hidden for the pass. Their materials (shared across a system's meshes) go transparent without depth writes.
		const hidden:T.Object3D[]=[],own=new Map<T.Material,[boolean,boolean]>();
		scene.traverseVisible(o=>{
			const m=(o as T.Mesh).material as T.Material|T.Material[]|undefined;if(!m)return;const list=Array.isArray(m)?m:[m];
			if(list.length&&list.every(x=>fxMaterials.has(x)))list.forEach(x=>{if(!own.has(x))own.set(x,[x.transparent,x.depthWrite]);});else{o.visible=false;hidden.push(o);}
		});
		const background=scene.background,autoClear=renderer.autoClear,shadows=renderer.shadowMap.autoUpdate,autoReset=renderer.info.autoReset;
		try{
			if(own.size){
				own.forEach((_,m)=>{if(!m.transparent){m.transparent=true;m.needsUpdate=true;}m.depthWrite=false;});
				// No clear: a null background and autoClear off keep the colour and depth of the normal render (focus parts occlude the ghosts behind them).
				scene.background=null;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.info.autoReset=false;ghostU.tfxPass.value=1;
				renderer.render(scene,camera);
			}
		}finally{
			ghostU.tfxPass.value=0;scene.background=background;renderer.autoClear=autoClear;renderer.shadowMap.autoUpdate=shadows;renderer.info.autoReset=autoReset;
			own.forEach(([transparent,depthWrite],m)=>{if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;}m.depthWrite=depthWrite;});
			hidden.forEach(o=>{o.visible=true;});
		}
	};

	return {
		patchMaterial,segAttribute,isolateBox,focusBox,renderGhostPass,
		// Picking: a non-focus part is ghosted (not pickable) from ghost 0.5; only the focus flags are 1 while something is focused.
		partVisible:i=>ghostU.tfxGhost.value>=.5&&fx.data[(4*fx.width+i)*4+3]<.5?0:fx.data[i*4],restCenter,stats:()=>({tier:perf.tier,lowRes:perf.lowRes,applies:perf.applies}),
		ready(p){
			isReady=true;pickers=p;rest=p.map(m=>(m?.geometry.getAttribute('position').array as Float32Array|undefined)?.slice());
			// Default pivots from the decoded vertices (atlas.json bounds carry stray vertices for a few parts).
			segMask=new Uint16Array(n);for(let i=0;i<n;i++){let m=0;for(let k=segOffset[i];k<segOffset[i+1]&&k+1<segBytes.length;k+=SEG_STRIDE){m|=1<<(segBytes[k]&15);if(segBytes[k+1]<255)m|=1<<(segBytes[k]>>4);}segMask[i]=m||1;}
			rest.forEach((r,i)=>{if(!r||!r.length)return;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let k=0;k<r.length;k+=3)for(let j=0;j<3;j++){const v=r[k+j];if(v<lo[j])lo[j]=v;if(v>hi[j])hi[j]=v;}restCenters[i]=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2];});
			for(const s of SCRIPTS){if(!s.layer)continue;let ok=false;try{const layer=s.layer();ok=layer.init(layerCtx);if(ok)layers.push({script:s,layer});else layer.dispose();}catch(e){console.warn(`AnyHealth timeline: layer ${s.id} failed`,e);}if(!ok)noLayer.add(s.id);}
			forceChange=true;remerge=true;
			// Software GL (SwiftShader, llvmpipe): pixel ratio 1 from the start.
			if(o.renderer)try{const gl=o.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info') as {UNMASKED_RENDERER_WEBGL:number}|null,name=String(gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:0x1f01/* RENDERER */));if(/SwiftShader|llvmpipe/i.test(name))lowResNow();}catch{/* no GPU info: keep the ratio */}
		},
		update,
		settle,settleSlice,finishSettle:()=>pass?settle():0,
		dispose(){
			layers.forEach(l=>l.layer.dispose());layers.length=0;layerMaterials.forEach(m=>m.dispose());restGeoms.forEach(g=>g.dispose());restGeoms.clear();fx.texture.dispose();fxMaterials.clear();ghostU.tfxGhost.value=0;pickers=[];rest=[];pass=null;isReady=false;
		},
	};
}
