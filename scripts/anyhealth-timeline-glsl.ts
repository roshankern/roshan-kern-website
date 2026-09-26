// Headless GLSL compile + parity check for the AnyHealth timeline shaders: npx tsx scripts/anyhealth-timeline-glsl.ts
// Compiles FX_PARS + WARP_PARS / FX_APPLY + WARP_APPLY (wired exactly as engine.ts patchMaterial wires them) in a WebGL2 program under
// headless Chromium (SwiftShader), pushes 64 test points through it as gl.POINTS (one per pixel of an RGBA32F target), reads the warped
// positions and normals back and compares them with applyFxPoint + warpPoint / warpNormal in node. Not a screenshot check.
// The atlas variant feeds `seg` as the 4 unnormalized segments.bin bytes (segA | segB<<4, weightA·255, dBone uint16) with `#define TW_SEG_BYTES`, as scene.tsx / engine.segAttribute do.
// Also compiles three custom-layer variants (no part fx): `#define TW_FIXED_SEG 3` with no seg attribute (checked against warpPoint with segment 3), a float per-vertex `seg` + `segD` under `#define TW_SEG_D`, and a float `seg` without TW_SEG_D (segD compiled out, checked against dBone 0).
// Needs playwright-core, kept OUTSIDE the repo (no new dependency): mkdir -p <dir> && cd <dir> && npm i playwright-core, then run with
// ANYHEALTH_PLAYWRIGHT=<dir>. Chromium: ANYHEALTH_CHROME=<binary>, else the newest cached ~/Library/Caches/ms-playwright/chromium-* build.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
import rigJson from '../app/anyhealth/timeline/growth/rig.json';
import {SEGMENTS,type Body,type Quat,type Rig,type SegmentId,type Vec3} from '../app/anyhealth/timeline/types';
import {warpState,warpPoint,warpNormal,D_UNIT} from '../app/anyhealth/timeline/growth/warp';
import {WARP_PARS,WARP_APPLY,TW_SEG,TW_SEG_ATTRS,warpUniforms,writeWarpUniforms} from '../app/anyhealth/timeline/growth/warp-glsl';
import {FX_ROWS,createFxTexture,writeFx,applyFxPoint,identityFx,type ResolvedFx} from '../app/anyhealth/timeline/fx/part-fx';
import {FX_PARS,FX_APPLY} from '../app/anyhealth/timeline/fx/part-fx-glsl';

const N=64,POS_TOL=1e-5,NRM_TOL=1e-4,rig=rigJson as Rig;
/** Where playwright-core may live: $ANYHEALTH_PLAYWRIGHT (a directory with node_modules/playwright-core, or the package itself). */
const PW_DIRS=[process.env.ANYHEALTH_PLAYWRIGHT].filter((d):d is string=>!!d);

type Launch={launch(o:{executablePath:string;headless:boolean;args:string[]}):Promise<{newPage():Promise<{evaluate<R,A>(fn:((a:A)=>R|Promise<R>)|string,arg?:A):Promise<R>}>;close():Promise<void>}>};
function loadPlaywright():{chromium:Launch}|null{
	for(const d of PW_DIRS){for(const p of [path.join(d,'node_modules','playwright-core'),d]){if(!fs.existsSync(path.join(p,'package.json')))continue;try{return createRequire(path.resolve('package.json'))(p);}catch{/* next */}}}
	return null;
}
function findChrome():string|null{
	if(process.env.ANYHEALTH_CHROME)return fs.existsSync(process.env.ANYHEALTH_CHROME)?process.env.ANYHEALTH_CHROME:null;
	const root=path.join(os.homedir(),'Library/Caches/ms-playwright');if(!fs.existsSync(root))return null;
	for(const d of fs.readdirSync(root).filter(d=>/^chromium-\d+$/.test(d)).sort((a,b)=>+b.split('-')[1]-+a.split('-')[1])){
		const exe=path.join(root,d,'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');if(fs.existsSync(exe))return exe;
	}
	return null;
}

// ── Test inputs ──
let seed=0x2003_0622;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;},pick=<T>(a:readonly T[])=>a[Math.floor(rnd()*a.length)];
/** A hand-built, deliberately non-identity body (not from bodyAt): every segment gets its own factors. */
function testBody():Body{
	const f=(lo:number,hi:number)=>Object.fromEntries(SEGMENTS.map(s=>[s,lo+(hi-lo)*rnd()])) as Record<SegmentId,number>;
	const b:Body={date:'2006-06-22',ageYears:3,statureM:0.95,weightKg:14,scale:0.55,length:f(0.7,1.3),boneGirth:f(0.8,1.1),softGirth:f(0.9,1.4)};b.length.head=2.0;b.length.lThigh=b.length.rThigh=0.7;b.faceLength=1.6;b.craniumLength=2.2;b.faceGirth=1.3;b.softGirth.trunk=0.8*b.boneGirth.trunk;return b; // a deflating trunk exercises the axial deflation clamp
}
const unit=(v:Vec3):Vec3=>{const l=Math.hypot(...v);return [v[0]/l,v[1]/l,v[2]/l];};
const quat=(axis:Vec3,deg:number):Quat=>{const a=unit(axis),h=deg*Math.PI/360,s=Math.sin(h);return [a[0]*s,a[1]*s,a[2]*s,Math.cos(h)];};
/** Eight parts' effects: identity, scale about a pivot, rotation, translation, swell, banded swell, and everything at once. */
const FX:ResolvedFx[]=[
	identityFx(),
	{...identityFx([0.1,1.0,0.02]),scale:[1.3,0.8,1.1]},
	{...identityFx([0,1.2,0]),rotate:quat([0.3,1,0.2],35)},
	{...identityFx([0,0,0]),translate:[0.01,-0.02,0.005]},
	{...identityFx([0,0,0]),swell:0.004},
	{...identityFx([0,0,0]),swell:-0.003,swellBand:[0.6,1.2]},
	{...identityFx([-0.05,0.9,0.03]),visible:0.5,tint:[1,0,0,0.4],scale:[0.7,1.2,0.9],rotate:quat([1,0,0.5],-50),translate:[0,0.015,-0.01],swell:0.006,swellBand:[0.4,1.5]},
	{...identityFx([0.2,1.4,0]),rotate:quat([0,0,1],120),scale:[2,2,2]},
];
const neighbours=(i:number)=>{const s=rig.segments[i];return [i,...(s.parent?[SEGMENTS.indexOf(s.parent)]:[]),...rig.segments.flatMap((c,j)=>c.parent===s.id?[j]:[])];};
function testPoints(){
	const pos=new Float32Array(N*3),nrm=new Float32Array(N*3),seg=new Float32Array(N*3),dist=new Float32Array(N),part=new Float32Array(N);
	for(let i=0;i<N;i++){
		const a=Math.floor(rnd()*SEGMENTS.length),s=rig.segments[a],t=rnd()*s.length;
		for(let k=0;k<3;k++){pos[i*3+k]=s.joint[k]+s.axis[k]*t+(rnd()-0.5)*0.12;nrm[i*3+k]=rnd()-0.5;}
		const b=pick(neighbours(a));seg[i*3]=a;seg[i*3+1]=b;seg[i*3+2]=i%4===0?1:Math.round(rnd()*255)/255;
		// Bone distance: 0 (bone), 1-9 cm (often past the axis offset, so the min(1, dBone/ρ) clamp is exercised); whole D_UNITs so the bytes are exact.
		dist[i]=i%5===0?0:Math.round(rnd()*0.09/D_UNIT)*D_UNIT;
		part[i]=i%FX.length;if(i%16===5)pos[i*3+1]=0.6+(i%3)*0.002; // points on the band's lower edge
		// Axial remap: every 4th point sits in or near a knot window (C7/T1 1.454, menton 1.500, AO 1.556) on trunk / neck / head, off-axis by up to ±6 cm.
		if(i%4===2){pos[i*3+1]=1.40+0.2*rnd();seg[i*3]=Math.floor(rnd()*3);seg[i*3+1]=Math.min(2,seg[i*3]+(rnd()<0.5?0:1));}
		// Task 14d: every 8th point sits on an upper arm at its humeral head (t in [−6, 3] cm: the γ block and its fade window), off-axis by up to ±6 cm.
		if(i%8===6){const u=rnd()<0.5?3:6,su=rig.segments[u],tt=0.09*rnd()-0.06;for(let k=0;k<3;k++)pos[i*3+k]=su.joint[k]+su.axis[k]*tt+(rnd()-0.5)*0.12;seg[i*3]=u;seg[i*3+1]=pick(neighbours(u));seg[i*3+2]=0.75+0.25*Math.round(rnd());}
	}
	return {pos,nrm,seg,dist,part};
}

/** Deliberate breaks of the joint taper (Task 14d) in WARP_PARS: [label, text, replacement]. Each must fail the parity (main). */
const BREAKS:[string,string,string][]=[
	['no along taper: F = ℓe·t','r0 = vec4(T.x * t + (le - T.x) * H,','r0 = vec4(le * t,'],
	['isotropic G: λu := λv','((r0.z - r0.w) * dot(r, u)) * u +','0.0 * u +'],
	['taper derivative sign in the normal','outerProduct(r1.x * dot(r, u) * u','outerProduct(-r1.x * dot(r, u) * u'],
	['no λv′ term in the normal','+ r1.y * dot(r, v) * v, ax)','+ 0.0 * v, ax)'],
	['no β block (position)','(r0.x + (1.0 - r1.w) * dot(twB[i].xyz, r)) * ax','r0.x * ax'],
	['no β block (normal)','+ (1.0 - r1.w) * outerProduct(ax, b)','+ 0.0 * outerProduct(ax, b)'],
	['no β fade derivative in the normal','(r0.y - hp * dot(b, r))','(r0.y)'],
	['untapered soft coefficient κ','T.w + (k1 - T.w) * h','k1'],
	['parent along rate not matched: F0 := ℓe','vec4 T = twT[i];','vec4 T = vec4(twS[i].x, twT[i].yzw);'],
	['along rate on the long window','float a0 = twU[i].w; float a1 = twB[i].w;','float a0 = t0; float a1 = t1;'],
	['no γ block (position)','+ (q.x * t) * twG[i].xyz;','+ 0.0 * twG[i].xyz;'],
	['no γ fade derivative in the normal','(q.x + q.y * t) * outerProduct(twG[i].xyz, ax)','q.x * outerProduct(twG[i].xyz, ax)'],
];

// ── The shaders, wired as engine.ts patchMaterial wires them (tfxRow copied verbatim from there; twSeg from TW_SEG) ──
type Kind='atlas'|'fixed'|'float'|'floatNoD';
/** Atlas parts: partFx + warp with the byte seg attribute (TW_SEG_BYTES). Custom layers: warp only, either `#define TW_FIXED_SEG` with no seg attribute, or a float seg attribute. */
const vsFor=(kind:Kind)=>{const fx=kind==='atlas';return `#version 300 es
${kind==='fixed'?`#define TW_FIXED_SEG ${FIXED}\n`:''}${kind==='float'?'#define TW_SEG_D\n':''}${kind==='atlas'?'#define TW_SEG_BYTES\n':''}precision highp float;precision highp int;precision highp sampler2D;
#define attribute in
#define varying out
#define texture2D texture
attribute vec3 position;attribute vec3 normal;attribute float partIndex;
uniform float outMode;
varying vec3 vOut;
${fx?`varying float tfxVisible; varying vec4 tfxTint; uniform sampler2D tfxState; uniform float tfxWidth;
vec4 tfxRow(float row){ return texture2D(tfxState, vec2((partIndex + 0.5) / tfxWidth, (row + 0.5) / ${FX_ROWS}.0)); }
${FX_PARS}`:''}
${TW_SEG_ATTRS}
${WARP_PARS}
void main(){
	vec3 objectNormal = vec3(normal);
	vec3 transformed = vec3(position);
	{
${fx?`tfxVisible = tfxRow(0.0).x; tfxTint = tfxRow(1.0);\n${FX_APPLY}`:''}
${TW_SEG}
${WARP_APPLY}
	}
	vOut = outMode < 0.5 ? transformed : objectNormal;
	gl_PointSize = 1.0;
	gl_Position = vec4((float(gl_VertexID) + 0.5) / ${N}.0 * 2.0 - 1.0, 0.0, 0.0, 1.0);
}`;};
const fsFor=(kind:Kind)=>`#version 300 es
precision highp float;
in vec3 vOut;${kind==='atlas'?'in float tfxVisible;in vec4 tfxTint;':''}out vec4 fragOut;
void main(){ fragOut = vec4(vOut, ${kind==='atlas'?'tfxVisible + tfxTint.a * 0.0':'1.0'}); }`;
/** The custom-layer variant's fixed segment (lForearm). */
const FIXED=3;

interface GpuIn {vs:string;fs:string;n:number;pos:number[];nrm:number[];seg:number[];segD:number[];segBytes:boolean;part:number[];tex:number[];texW:number;rows:number;u:Record<string,number[]>}
/** Runs in the page: compile, draw 4 passes (soft 0/1 × position/normal), read back. */
function gpu(a:GpuIn):{error:string}|{out:number[][]}{
	const cv=document.createElement('canvas');cv.width=a.n;cv.height=1;const gl=cv.getContext('webgl2');if(!gl)return {error:'no WebGL2 context'};
	if(!gl.getExtension('EXT_color_buffer_float'))return {error:'no EXT_color_buffer_float'};
	const sh=(type:number,src:string,label:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(`${label} shader:\n${gl.getShaderInfoLog(s)}`);return s;};
	let prog:WebGLProgram;
	try{prog=gl.createProgram()!;gl.attachShader(prog,sh(gl.VERTEX_SHADER,a.vs,'vertex'));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,a.fs,'fragment'));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(`link:\n${gl.getProgramInfoLog(prog)}`);}catch(e){return {error:String(e instanceof Error?e.message:e)};}
	gl.useProgram(prog);
	const attr=(name:string,data:number[],size:number)=>{const loc=gl.getAttribLocation(prog,name);if(loc<0)return;const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);};
	attr('position',a.pos,3);attr('normal',a.nrm,3);attr('partIndex',a.part,1);
	if(a.segBytes){const loc=gl.getAttribLocation(prog,'seg');if(loc>=0){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(a.seg),gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.UNSIGNED_BYTE,false,0,0);}}else{attr('seg',a.seg,3);attr('segD',a.segD,1);}
	const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
	gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,a.texW,a.rows,0,gl.RGBA,gl.FLOAT,new Float32Array(a.tex));
	for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
	for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
	gl.uniform1i(gl.getUniformLocation(prog,'tfxState'),0);gl.uniform1f(gl.getUniformLocation(prog,'tfxWidth'),a.texW);
	for(const [k,v] of Object.entries(a.u)){const loc=gl.getUniformLocation(prog,k);if(!loc)continue;if(v.length===1)gl.uniform1f(loc,v[0]);else gl.uniform4fv(loc,new Float32Array(v));}
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

async function main(){
	const pw=loadPlaywright();
	if(!pw){console.error(`playwright-core not found (${PW_DIRS.length?`looked in: ${PW_DIRS.join(', ')}`:'ANYHEALTH_PLAYWRIGHT is not set'}).\nInstall it outside the repo and point ANYHEALTH_PLAYWRIGHT at that directory:\n  mkdir -p /tmp/anyhealth-glsl && (cd /tmp/anyhealth-glsl && npm i playwright-core)\n  ANYHEALTH_PLAYWRIGHT=/tmp/anyhealth-glsl npx tsx scripts/anyhealth-timeline-glsl.ts`);process.exit(2);}
	const exe=findChrome();
	if(!exe){console.error('No cached Chromium: set ANYHEALTH_CHROME to a Chrome / Chromium binary, or run `npx playwright-core install chromium` in the playwright-core directory.');process.exit(2);}
	if(!WARP_APPLY.trim()||!FX_APPLY.trim()){console.error('WARP_APPLY / FX_APPLY are empty: nothing to check.');process.exit(1);}

	const body=testBody(),ws=warpState(rig,body),u=warpUniforms();writeWarpUniforms(u,ws);
	const flat=(k:string)=>(u[k].value as {toArray():number[]}[]).flatMap(v=>v.toArray());
	const tex=createFxTexture(FX.length);writeFx(tex,new Map(FX.map((f,i)=>[i,f])));
	const {pos,nrm,seg,dist,part}=testPoints();

	// Node reference (the TS mirror): applyFxPoint, then warpPoint / warpNormal; the custom-layer variants are warp only (on segment FIXED with weight 1, or the point's seg).
	const reference=(kind:Kind)=>[0,1].map(soft=>{const P:number[]=[],M:number[]=[];for(let i=0;i<N;i++){
		const p:Vec3=[pos[i*3],pos[i*3+1],pos[i*3+2]],n:Vec3=[nrm[i*3],nrm[i*3+1],nrm[i*3+2]],m:Vec3=[0,0,0],q:Vec3=[0,0,0];
		const [a,b,w]=kind==='fixed'?[FIXED,FIXED,1]:[seg[i*3],seg[i*3+1],seg[i*3+2]];
		if(kind!=='atlas'){q[0]=p[0];q[1]=p[1];q[2]=p[2];m[0]=n[0];m[1]=n[1];m[2]=n[2];}else applyFxPoint(FX[part[i]],p,n,q,m);const q0:Vec3=[q[0],q[1],q[2]];
		warpPoint(ws,q,a,b,w,!!soft,q,kind==='atlas'||kind==='float'?dist[i]:0);warpNormal(ws,q0,m,a,b,w,m);P.push(...q);M.push(...m);
	}return [P,M];}).flat();

	const browser=await pw.chromium.launch({executablePath:exe,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
	try{
		const page=await browser.newPage();
		await page.evaluate('globalThis.__name=(f)=>f'); // tsx (esbuild keepNames) wraps nested functions in __name(), which the page doesn't have
		let failed=false;
		// The bytes the atlas uploads (segments.bin): segA | segB<<4, round(weightA·255), dBone / D_UNIT as uint16; the test weights and distances are exact in these units.
		const bytes=Array.from({length:N},(_,i)=>{const d=Math.round(dist[i]/D_UNIT);return [seg[i*3]|seg[i*3+1]<<4,Math.round(seg[i*3+2]*255),d&255,d>>8];}).flat();
		const uni:Record<string,number[]>={twJ:flat('twJ'),twA:flat('twA'),twN:flat('twN'),twS:flat('twS'),twT:flat('twT'),twU:flat('twU'),twB:flat('twB'),twG:flat('twG'),twX:flat('twX'),twGround:[ws.ground]};
		/** Runs the atlas variant with WARP_PARS as given: [position error, normal error]. */
		const atlasErr=async(pars:string)=>{const want=reference('atlas'),r=await page.evaluate(gpu,{vs:vsFor('atlas').replace(WARP_PARS,pars),fs:fsFor('atlas'),n:N,pos:[...pos],nrm:[...nrm],seg:bytes,segD:[...dist],segBytes:true,part:[...part],tex:[...tex.data],texW:tex.width,rows:FX_ROWS,u:uni});
			if('error' in r)throw new Error(r.error);let pe=0,ne=0;r.out.forEach((px,pass)=>{for(let i=0;i<N;i++)for(let k=0;k<3;k++){const e=Math.abs(px[i*4+k]-want[pass][i*3+k]);if(pass%2===0)pe=Math.max(pe,e);else ne=Math.max(ne,e);}});return [pe,ne];};
		for(const [label,kind] of [['atlas parts (part fx + byte seg attribute)','atlas'],[`custom layer (TW_FIXED_SEG ${FIXED})`,'fixed'],['custom layer (float seg + segD, TW_SEG_D)','float'],['custom layer (float seg, no TW_SEG_D: segD compiled out, no inflation)','floatNoD']] as const){
			const want=reference(kind);
			const r=await page.evaluate(gpu,{vs:vsFor(kind),fs:fsFor(kind),n:N,pos:[...pos],nrm:[...nrm],seg:kind==='atlas'?bytes:[...seg],segD:[...dist],segBytes:kind==='atlas',part:[...part],tex:[...tex.data],texW:tex.width,rows:FX_ROWS,u:uni});
			if('error' in r){console.error(`GLSL check failed (${label}):\n${r.error}`);process.exit(1);}
			let posErr=0,nrmErr=0,worst='';
			r.out.forEach((px,pass)=>{const ref=want[pass],isPos=pass%2===0;for(let i=0;i<N;i++)for(let k=0;k<3;k++){const e=Math.abs(px[i*4+k]-ref[i*3+k]);if(isPos&&e>posErr){posErr=e;worst=`point ${i} (${kind==='fixed'?`seg ${FIXED}`:`part ${part[i]}, seg ${seg[i*3]}/${seg[i*3+1]} w ${seg[i*3+2].toFixed(3)} dBone ${(dist[i]*100).toFixed(1)} cm`}, soft ${pass>>1})`;}if(!isPos)nrmErr=Math.max(nrmErr,e);}});
			const moved=Math.max(...want[0].map((v,i)=>Math.abs(v-pos[i])));
			console.log(`${label}: compile ok · parity max err ${posErr.toExponential(2)} m (positions, worst ${worst}) · ${nrmErr.toExponential(2)} (normals) · largest displacement tested ${moved.toFixed(3)} m`);
			if(!(posErr<POS_TOL)||!(nrmErr<NRM_TOL)){console.error(`FAIL (${label}): tolerance ${POS_TOL} m (positions), ${NRM_TOL} (normals)`);failed=true;}
		}
		// Deliberate breaks of the Task 14d joint-taper terms (negatives): each edit of WARP_PARS must make the parity FAIL, so the check can see that term.
		for(const [label,from,to] of BREAKS){
			if(!WARP_PARS.includes(from)){console.error(`deliberate break "${label}": pattern not found in WARP_PARS`);failed=true;continue;}
			const [pe,ne]=await atlasErr(WARP_PARS.replace(from,to)),caught=!(pe<POS_TOL)||!(ne<NRM_TOL);
			console.log(`deliberate break (${label}): ${caught?'FAILS as it should':'NOT CAUGHT'} · positions ${pe.toExponential(2)} m, normals ${ne.toExponential(2)}`);if(!caught)failed=true;
		}
		if(failed)process.exit(1);
		console.log(`compile ok · parity max err <${POS_TOL}`);
	}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exit(1);});
