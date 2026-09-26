/** Browser side of the ghost GPU check (ghost-gpu.ts bundles it with esbuild and runs it under headless Chromium / SwiftShader): the real engine (createEngine, patchMaterial, prewarm, update, renderGhostPass) on a 64×64 render target with a
 * real three.js WebGLRenderer. Five quad parts in rest space: F (a part of the focused script, opaque), N (non-focus, opaque, sharing F's material in one merged mesh as scene.tsx merges a system), H (its system switched off, same mesh),
 * O (non-focus, same mesh, half behind F) and S (non-focus, its own translucent skin-like material). A third row checks the onset where draw order matters: K (skin-like, in front of the non-focus M) in a skin mesh whose centre sorts
 * behind the body mesh (a far part K2 outside the view drags it back, as the real Skin's centre sits behind the chest organs), and a real layer mesh L (warp-only material, faded with issues/layer-fade.ts fadeMesh) in front of the non-focus P. Behind them a MeshBasic ground (not an engine material) covers the view, and the scene has a background colour (a background that cleared would wipe pass 0).
 * Materials carry scene.tsx's `attribute float partIndex` declaration. Pixels are read at each part's warped centre (the engine's settled bounds) and in the gap between parts. */
import * as T from 'three';
import {createEngine} from '../engine';
import rigJson from '../growth/rig.json';
import type {Rig} from '../types';
import type {Atlas,SystemId} from '../../atlas/anatomy';
import {fadeMesh,ghostTwin} from '../issues/layer-fade';

export interface GhostGpuIn {date:string;focus:string;names:{F:string;N:string;H:string;S:string;O:string;K:string;K2:string;M:string;P:string}}
type Px=[number,number,number,number];type Key='F'|'N'|'H'|'S'|'gap'|'O'|'FO'|'NO'|'K'|'L';
export interface GhostGpuOut {errors:string[];steps:Record<string,Record<Key,Px>>;restored:string[];/** renderer.info.programs.length after prewarm, and after every render of the run. */programs:{prewarm:number;end:number};/** Pixel read for each sample, and the GL renderer string. */at:Record<string,[number,number]>;gl:string}

export async function run(a:GhostGpuIn):Promise<GhostGpuOut>{
	const errors:string[]=[],restored:string[]=[],steps:GhostGpuOut['steps']={};
	const renderer=new T.WebGLRenderer({canvas:document.createElement('canvas'),antialias:false});renderer.setSize(64,64,false);
	renderer.debug.onShaderError=(gl,program,vs,fs)=>{errors.push(`${gl.getProgramInfoLog(program)}\n${gl.getShaderInfoLog(vs)}\n${gl.getShaderInfoLog(fs)}`);};
	const rt=new T.WebGLRenderTarget(64,64);renderer.setRenderTarget(rt);
	// Rest-space quads facing +z, 0.2 m square, around the chest.
	const parts:{key:'F'|'N'|'H'|'S'|'O'|'K'|'K2'|'M'|'P';name:string;system:SystemId;c:[number,number];z?:number}[]=[
		{key:'F',name:a.names.F,system:'skeletal',c:[-.13,1.25]},{key:'N',name:a.names.N,system:'cardiac',c:[.13,1.25]},{key:'H',name:a.names.H,system:'digestive',c:[-.13,.99]},{key:'S',name:a.names.S,system:'integumentary',c:[.13,.99]},
		// O: behind F and N (z 0.2), between them: its left half behind F, its middle clear, its right edge behind N.
		{key:'O',name:a.names.O,system:'cardiac',c:[-.03,1.25],z:.2},
		{key:'K',name:a.names.K,system:'integumentary',c:[-.13,.73]},{key:'K2',name:a.names.K2,system:'integumentary',c:[3,.73],z:-.9},{key:'M',name:a.names.M,system:'cardiac',c:[-.13,.73],z:.2},{key:'P',name:a.names.P,system:'cardiac',c:[.13,.73],z:.2},
	];
	const quad=(c:[number,number],z=.3)=>{const h=.1;return [c[0]-h,c[1]-h,z,c[0]+h,c[1]-h,z,c[0]+h,c[1]+h,z,c[0]-h,c[1]+h,z];};
	const atlas={parts:parts.map(p=>({name:p.name,system:p.system,vertexCount:4,chunk:0,bounds:[[p.c[0]-.1,p.c[1]-.1,p.z??.3],[p.c[0]+.1,p.c[1]+.1,p.z??.3]]})),chunks:[]} as unknown as Atlas;
	// segments.bin: every vertex on the trunk (segA 0, weightA 255, bone distance 0).
	const seg=new Uint8Array(parts.length*4*4);for(let v=0;v<parts.length*4;v++)seg[v*4+1]=255;
	const scene=new T.Scene(),bounds=parts.map(p=>new T.Box3(new T.Vector3(p.c[0]-.1,p.c[1]-.1,p.z??.3),new T.Vector3(p.c[0]+.1,p.c[1]+.1,p.z??.3)));
	scene.background=new T.Color(1,0,0);scene.add(new T.AmbientLight(0xffffff,1));
	const engine=createEngine({atlas,scene,bounds,rig:rigJson as Rig,segments:seg.buffer});
	const index=[0,1,2,0,2,3];
	const geometry=(ids:number[])=>{
		const g=new T.BufferGeometry(),pos:number[]=[],nrm:number[]=[],pi:number[]=[],sg:number[]=[],idx:number[]=[];
		ids.forEach((i,k)=>{pos.push(...quad(parts[i].c,parts[i].z));for(let v=0;v<4;v++){nrm.push(0,0,1);pi.push(i);}sg.push(...(engine.segAttribute(i).array as Uint8Array));idx.push(...index.map(x=>x+k*4));});
		g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nrm,3));g.setAttribute('partIndex',new T.Float32BufferAttribute(pi,1));
		g.setAttribute('seg',new T.BufferAttribute(new Uint8Array(sg),4,false));g.setIndex(idx);return g;
	};
	const material=(o:T.MeshStandardMaterialParameters,soft:boolean)=>{
		const m=new T.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,side:T.DoubleSide,...o});
		m.onBeforeCompile=sh=>{sh.vertexShader='attribute float partIndex;\n'+sh.vertexShader;};engine.patchMaterial(m,{partFx:true,soft});return m;
	};
	const solid=material({},false),skin=material({color:0xff0000,emissive:0xff0000,transparent:true,opacity:.5,depthWrite:false},true);// red: a tint that shows over the white parts
	const body=new T.Mesh(geometry([0,1,2,4,7,8]),solid),skinMesh=new T.Mesh(geometry([3,5,6]),skin);body.frustumCulled=skinMesh.frustumCulled=false;scene.add(body,skinMesh);
	// L: a layer mesh as ctx.material builds one (warp only, every vertex on the trunk), green, in front of P; faded by the real fadeMesh through its ghost twin.
	const layerMat=new T.MeshStandardMaterial({color:0x00ff00,emissive:0x00ff00,side:T.DoubleSide});layerMat.defines={...layerMat.defines,TW_FIXED_SEG:0};engine.patchMaterial(layerMat,{partFx:false,soft:false});ghostTwin(layerMat);
	const layer=new T.Mesh(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(quad([.13,.73],.3),3)).setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1],3)).setIndex(index),layerMat);layer.frustumCulled=false;scene.add(layer);
	const ground=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshBasicMaterial({color:0x0000ff}));ground.position.z=-1;scene.add(ground);
	// Pickers (rest positions, Int8 normals, seg bytes), as scene.tsx builds them.
	const pickers=parts.map((p,i)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(quad(p.c,p.z),3));g.setAttribute('normal',new T.BufferAttribute(new Int8Array([0,0,127,0,0,127,0,0,127,0,0,127]),3,true));g.setIndex(index);g.setAttribute('seg',engine.segAttribute(i));return new T.Mesh(g);});
	engine.ready(pickers);
	const visible:SystemId[]=['skeletal','cardiac','integumentary'];let now=0;
	const frame=(ghost:number)=>{now+=16;engine.update({date:a.date,visible,isolate:null,focus:{id:a.focus,ghost},now});fadeMesh(layer,layerMat,ghost);};
	frame(0);engine.settle();
	// Camera: orthographic, framing the warped parts (the engine's settled bounds) with a margin.
	const all=new T.Box3();bounds.forEach((b,i)=>{if(parts[i].key!=='K2')all.union(b);});const ctr=all.getCenter(new T.Vector3()),half=Math.max(all.max.x-all.min.x,all.max.y-all.min.y)/2*1.15;
	const camera=new T.OrthographicCamera(-half,half,half,-half,.1,20);camera.position.set(ctr.x,ctr.y,5);camera.lookAt(ctr.x,ctr.y,0);camera.updateMatrixWorld();
	const pixel=(p:T.Vector3):[number,number]=>{const q=p.clone().project(camera);return [Math.floor((q.x+1)/2*64),Math.floor((q.y+1)/2*64)];};
	const at={F:pixel(bounds[0].getCenter(new T.Vector3())),N:pixel(bounds[1].getCenter(new T.Vector3())),H:pixel(bounds[2].getCenter(new T.Vector3())),S:pixel(bounds[3].getCenter(new T.Vector3())),gap:pixel(bounds[0].getCenter(new T.Vector3()).add(bounds[3].getCenter(new T.Vector3())).multiplyScalar(.5)),
		// O alone (between F's right edge and N's left edge) and F over O (between O's left edge and F's right edge), at O's height.
		O:pixel(new T.Vector3((bounds[0].max.x+bounds[1].min.x)/2,bounds[4].getCenter(new T.Vector3()).y,0)),FO:pixel(new T.Vector3((bounds[4].min.x+bounds[0].max.x)/2,bounds[4].getCenter(new T.Vector3()).y,0)),
		// N (a ghost) in front of O (a ghost): the depth pre-pass leaves only N.
		NO:pixel(new T.Vector3((bounds[1].min.x+bounds[4].max.x)/2,bounds[4].getCenter(new T.Vector3()).y,0)),
		K:pixel(bounds[5].getCenter(new T.Vector3())),L:pixel(bounds[8].getCenter(new T.Vector3()))};
	const read=(name:string)=>{const out={} as Record<Key,Px>;for(const [k,[x,y]] of Object.entries(at)){const b=new Uint8Array(4);renderer.readRenderTargetPixels(rt,x,y,1,1,b);out[k as 'F']=[b[0],b[1],b[2],b[3]];}steps[name]=out;};
	const state=()=>JSON.stringify({renderOrder:[body.renderOrder,skinMesh.renderOrder],solid:[solid.transparent,solid.depthWrite,solid.colorWrite,solid.version,body.material===solid],skin:[skin.transparent,skin.depthWrite,skin.colorWrite,skin.version,skinMesh.material===skin],autoClear:renderer.autoClear,background:scene.background,ground:ground.visible,shadows:renderer.shadowMap.autoUpdate,reset:renderer.info.autoReset});
	const normal=()=>{renderer.setRenderTarget(rt);renderer.render(scene,camera);};
	// Every program compiled up front: no later render may add one.
	renderer.setRenderTarget(rt);await engine.prewarm(renderer,scene,camera);const prewarmed=renderer.info.programs?.length??-1;

	frame(0);normal();read('ghost0');engine.renderGhostPass(renderer,scene,camera);read('ghost0+pass');
	frame(1);normal();read('ghost1');const before=state();engine.renderGhostPass(renderer,scene,camera);read('ghost1+pass');
	if(state()!==before)restored.push(`state after the ghost pass: ${state()} (before ${before})`);
	normal();read('ghost1 again');
	frame(.5);normal();read('ghost0.5');
	// Continuous onset: at 0.001 pass 1 is skipped, at 0.002 it draws the non-focus parts at alpha ≈ 1.
	frame(.001);normal();engine.renderGhostPass(renderer,scene,camera);read('ghost0.001');frame(.002);normal();engine.renderGhostPass(renderer,scene,camera);read('ghost0.002');
	// The ghost pass alone, on a black target with no depth: what pass 1 draws.
	frame(1);renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,0);renderer.clear();engine.renderGhostPass(renderer,scene,camera);read('pass only');
	const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),name=String(gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
	const end=renderer.info.programs?.length??-1;
	engine.dispose();renderer.dispose();rt.dispose();
	return {errors,steps,restored,at,gl:name,programs:{prewarm:prewarmed,end}};
}
