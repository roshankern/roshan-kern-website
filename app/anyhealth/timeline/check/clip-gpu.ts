/** GLSL/TS parity at scale for the clipping checks: 2,048 real atlas vertices (from parts with mixed segment weights: real positions, Int8 normals, segments.bin bytes, part indices) with a date's real merged fx texture and warp
 * uniforms, pushed through FX_APPLY + WARP_APPLY under headless Chromium (SwiftShader) as scripts/anyhealth-timeline-glsl.ts does, and compared with applyFxPoint + warpPoint / warpNormal.
 * Needs playwright-core outside the repo (ANYHEALTH_PLAYWRIGHT=<dir>, as the GLSL script); without it the check reports that it was skipped. Uniforms are set generically from warpUniforms() by their active GLSL type. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
import type {NodeAtlas} from './node-atlas';
import {warpPoint,warpNormal,segAt,SEG_STRIDE,type WarpState} from '../growth/warp';
import {WARP_PARS,WARP_APPLY,TW_SEG,TW_SEG_ATTRS,warpUniforms,writeWarpUniforms} from '../growth/warp-glsl';
import {FX_ROWS,createFxTexture,writeFx,applyFxPoint,identityFx,type ResolvedFx} from '../fx/part-fx';
import {FX_PARS,FX_APPLY} from '../fx/part-fx-glsl';
import type {Vec3} from '../types';

const N=2048;
export type Page={evaluate<R,A>(fn:((a:A)=>R|Promise<R>)|string,arg?:A):Promise<R>};
export type Launch={launch(o:{executablePath:string;headless:boolean;args:string[]}):Promise<{newPage():Promise<Page>;close():Promise<void>}>};
export function loadPlaywright():{chromium:Launch}|null{
	const d=process.env.ANYHEALTH_PLAYWRIGHT;if(!d)return null;
	for(const p of [path.join(d,'node_modules','playwright-core'),d]){if(!fs.existsSync(path.join(p,'package.json')))continue;try{return createRequire(path.resolve('package.json'))(p);}catch{/* next */}}
	return null;
}
export function findChrome():string|null{
	if(process.env.ANYHEALTH_CHROME)return fs.existsSync(process.env.ANYHEALTH_CHROME)?process.env.ANYHEALTH_CHROME:null;
	const root=path.join(os.homedir(),'Library/Caches/ms-playwright');if(!fs.existsSync(root))return null;
	for(const d of fs.readdirSync(root).filter(d=>/^chromium-\d+$/.test(d)).sort((a,b)=>+b.split('-')[1]-+a.split('-')[1])){const exe=path.join(root,d,'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');if(fs.existsSync(exe))return exe;}
	return null;
}

/** The atlas-part vertex shader, wired as engine.patchMaterial wires it (partFx + byte seg). */
const VS=`#version 300 es
#define TW_SEG_BYTES
precision highp float;precision highp int;precision highp sampler2D;
#define attribute in
#define varying out
#define texture2D texture
attribute vec3 position;attribute vec3 normal;attribute float partIndex;
uniform float outMode;
varying vec3 vOut;
varying float tfxVisible; varying vec4 tfxTint; uniform sampler2D tfxState; uniform float tfxWidth;
vec4 tfxRow(float row){ return texture2D(tfxState, vec2((partIndex + 0.5) / tfxWidth, (row + 0.5) / ${FX_ROWS}.0)); }
${FX_PARS}
${TW_SEG_ATTRS}
${WARP_PARS}
void main(){
	vec3 objectNormal = vec3(normal);
	vec3 transformed = vec3(position);
	{
tfxVisible = tfxRow(0.0).x; tfxTint = tfxRow(1.0);
${FX_APPLY}
${TW_SEG}
${WARP_APPLY}
	}
	vOut = outMode < 0.5 ? transformed : objectNormal;
	gl_PointSize = 1.0;
	gl_Position = vec4((float(gl_VertexID) + 0.5) / ${N}.0 * 2.0 - 1.0, 0.0, 0.0, 1.0);
}`;
const FS=`#version 300 es
precision highp float;
in vec3 vOut;in float tfxVisible;in vec4 tfxTint;out vec4 fragOut;
void main(){ fragOut = vec4(vOut, tfxVisible + tfxTint.a * 0.0); }`;

interface GpuIn {vs:string;fs:string;n:number;pos:number[];nrm:number[];seg:number[];part:number[];tex:number[];texW:number;rows:number;u:Record<string,number[]>}
/** Runs in the page: compile, draw soft 0/1 × position/normal, read back. Uniforms are set by their active type. */
function gpu(a:GpuIn):{error:string}|{out:number[][]}{
	const cv=document.createElement('canvas');cv.width=a.n;cv.height=1;const gl=cv.getContext('webgl2');if(!gl)return {error:'no WebGL2 context'};
	if(!gl.getExtension('EXT_color_buffer_float'))return {error:'no EXT_color_buffer_float'};
	const sh=(type:number,src:string,label:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(`${label} shader:\n${gl.getShaderInfoLog(s)}`);return s;};
	let prog:WebGLProgram;
	try{prog=gl.createProgram()!;gl.attachShader(prog,sh(gl.VERTEX_SHADER,a.vs,'vertex'));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,a.fs,'fragment'));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(`link:\n${gl.getProgramInfoLog(prog)}`);}catch(e){return {error:String(e instanceof Error?e.message:e)};}
	gl.useProgram(prog);
	const attr=(name:string,data:number[],size:number)=>{const loc=gl.getAttribLocation(prog,name);if(loc<0)return;const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);};
	attr('position',a.pos,3);attr('normal',a.nrm,3);attr('partIndex',a.part,1);
	{const loc=gl.getAttribLocation(prog,'seg');if(loc>=0){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(a.seg),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.UNSIGNED_BYTE,false,0,0);}}
	const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
	gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,a.texW,a.rows,0,gl.RGBA,gl.FLOAT,new Float32Array(a.tex));
	for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
	for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
	gl.uniform1i(gl.getUniformLocation(prog,'tfxState'),0);gl.uniform1f(gl.getUniformLocation(prog,'tfxWidth'),a.texW);
	const nu=gl.getProgramParameter(prog,gl.ACTIVE_UNIFORMS) as number;
	for(let i=0;i<nu;i++){const info=gl.getActiveUniform(prog,i)!,name=info.name.replace(/\[0\]$/,''),v=a.u[name],loc=gl.getUniformLocation(prog,info.name);if(!v||!loc)continue;const f=new Float32Array(v);
		switch(info.type){case gl.FLOAT:gl.uniform1fv(loc,f);break;case gl.FLOAT_VEC2:gl.uniform2fv(loc,f);break;case gl.FLOAT_VEC3:gl.uniform3fv(loc,f);break;case gl.FLOAT_VEC4:gl.uniform4fv(loc,f);break;case gl.FLOAT_MAT3:gl.uniformMatrix3fv(loc,false,f);break;case gl.FLOAT_MAT4:gl.uniformMatrix4fv(loc,false,f);break;case gl.INT:gl.uniform1iv(loc,new Int32Array(v));break;default:return {error:`uniform ${name}: unsupported type 0x${info.type.toString(16)}`};}}
	const rt=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,rt);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,a.n,1,0,gl.RGBA,gl.FLOAT,null);
	const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,rt,0);
	if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)return {error:'RGBA32F framebuffer incomplete'};
	gl.bindTexture(gl.TEXTURE_2D,tex);gl.viewport(0,0,a.n,1);
	const out:number[][]=[];
	for(const soft of [0,1])for(const mode of [0,1]){
		gl.uniform1f(gl.getUniformLocation(prog,'twSoft'),soft);gl.uniform1f(gl.getUniformLocation(prog,'outMode'),mode);
		gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.POINTS,0,a.n);
		const px=new Float32Array(a.n*4);gl.readPixels(0,0,a.n,1,gl.RGBA,gl.FLOAT,px);out.push([...px]);
	}
	const err=gl.getError();if(err)return {error:`GL error 0x${err.toString(16)}`};
	return {out};
}
/** Flatten a uniform value (number, vector, vector array, typed array) to floats. */
const flat=(v:unknown):number[]=>typeof v==='number'?[v]:Array.isArray(v)?v.flatMap(flat):ArrayBuffer.isView(v)?Array.from(v as Float32Array):v&&typeof (v as {toArray?:unknown}).toArray==='function'?(v as {toArray():number[]}).toArray():[];

/** Parity on each date: every vertex through GLSL with twSoft 0 and 1, against the TS mirror with the same soft flag (and the vertex's real bone distance). */
export async function gpuParity(g:NodeAtlas,seg:Uint8Array,segOff:Int32Array,soft:boolean[],at:(date:string)=>{ws:WarpState;fx:Map<number,ResolvedFx>},dates:string[]):Promise<{skipped:boolean;maxErr:number;lines:string[]}>{
	const pw=loadPlaywright(),exe=findChrome();
	if(!pw||!exe)return {skipped:true,maxErr:0,lines:[`SKIPPED: ${!pw?'playwright-core not found (set ANYHEALTH_PLAYWRIGHT=<dir with node_modules/playwright-core>, see scripts/anyhealth-timeline-glsl.ts)':'no cached Chromium (set ANYHEALTH_CHROME)'}`]};
	// Vertices: every vertex of every part whose segments.bin weights mix two segments, sampled evenly to N.
	const cand:[number,number][]=[];
	g.parts.forEach((p,i)=>{const n=p.position.length/3;let mixed=false;for(let v=0;v<n&&!mixed;v++)mixed=segAt(seg,segOff[i],v)[2]<1;if(mixed)for(let v=0;v<n;v++)cand.push([i,v]);});
	const pick=Array.from({length:N},(_,k)=>cand[Math.floor((k+0.5)*cand.length/N)]);
	const pos:number[]=[],nrm:number[]=[],bytes:number[]=[],part:number[]=[];
	for(const [i,v] of pick){const P=g.parts[i].position,M=g.parts[i].normal;for(let j=0;j<3;j++){pos.push(P[v*3+j]);nrm.push(M[v*3+j]/127);}const o=segOff[i]+v*SEG_STRIDE;for(let j=0;j<SEG_STRIDE;j++)bytes.push(seg[o+j]);part.push(i);}
	const mixedCount=pick.filter(([i,v])=>segAt(seg,segOff[i],v)[2]<1).length,softCount=pick.filter(([i])=>soft[i]).length;
	const lines=[`${N} vertices from ${new Set(part).size} mixed-weight parts (${mixedCount} with weightA < 1, ${softCount} on soft parts)`];let maxErr=0;
	const browser=await pw.chromium.launch({executablePath:exe,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
	try{
		const page=await browser.newPage();await page.evaluate('globalThis.__name=(f)=>f');
		for(const date of dates){
			const {ws,fx}=at(date),u=warpUniforms();writeWarpUniforms(u,ws);const tex=createFxTexture(g.parts.length);writeFx(tex,fx);
			const uf:Record<string,number[]>={};for(const [k,v] of Object.entries(u))uf[k]=flat(v.value);
			const r=await page.evaluate(gpu,{vs:VS,fs:FS,n:N,pos,nrm,seg:bytes,part,tex:[...tex.data],texW:tex.width,rows:FX_ROWS,u:uf});
			if('error' in r)throw new Error(`GLSL parity (${date}): ${r.error}`);
			let pe=0,ne=0,worst='';
			for(const s of [0,1]){const P=r.out[s*2],M=r.out[s*2+1];pick.forEach(([i,v],k)=>{
				const p:Vec3=[pos[k*3],pos[k*3+1],pos[k*3+2]],n:Vec3=[nrm[k*3],nrm[k*3+1],nrm[k*3+2]],q:Vec3=[0,0,0],m:Vec3=[0,0,0],[a,b,w,d]=segAt(seg,segOff[i],v);
				applyFxPoint(fx.get(i)??identityFx(),p,n,q,m);warpNormal(ws,q,m,a,b,w,m);warpPoint(ws,q,a,b,w,!!s,q,d);
				for(let j=0;j<3;j++){const e=Math.abs(P[k*4+j]-q[j]);if(e>pe){pe=e;worst=`${g.atlas.parts[i].name} v${v} (soft ${s})`;}ne=Math.max(ne,Math.abs(M[k*4+j]-m[j]));}
			});}
			maxErr=Math.max(maxErr,pe);lines.push(`${date}: compile ok · max position error ${pe.toExponential(2)} m (worst ${worst}) · normals ${ne.toExponential(2)}`);
		}
	}finally{await browser.close();}
	return {skipped:false,maxErr,lines};
}
