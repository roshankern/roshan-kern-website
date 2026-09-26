/** Task 14 integration checks: the real engine in node (check/engine-node.ts) with every area's scripts, growth and the warp merged. */
import type {Check,CheckContext} from './harness';
import {DEFAULT_VISIBLE} from '../../atlas/anatomy';
import {nodeEngine} from './engine-node';
import {SCRIPTS,leadDays} from '../issues';
import {bodyAt} from '../growth/proportions';
import {toDays,fromDays} from '../../health/dates';
import {mergeFx} from '../fx/part-fx';
import {pacing} from '../issues/pacing';
import {CROUP_EPISODES} from '../issues/airway/croup';
import {skinSurface} from '../issues/skin/surface';
import {warpState,warpPoint,segAt,SEG_STRIDE} from '../growth/warp';
import rigJson from '../growth/rig.json';
import type {Rig,Vec3} from '../types';

const TODAY='2026-09-25';
const frame=(date:string,now=0,isolate:string|null=null)=>({date,visible:DEFAULT_VISIBLE,isolate,now});
/** Two node engines hold the same picking geometry: every part's bounds and warped positions. */
const sameGeometry=(c:CheckContext,g:{atlas:{parts:{name:string}[]}},A:ReturnType<typeof nodeEngine>,B:ReturnType<typeof nodeEngine>,what:string)=>{
	A.bounds.forEach((b,i)=>{for(const key of ['min','max'] as const)for(const ax of ['x','y','z'] as const)c.near(b[key][ax],B.bounds[i][key][ax],1e-9,`${what}: ${g.atlas.parts[i].name} ${key}.${ax}`);});
	A.pickers.forEach((m,i)=>{const a=m?.geometry.getAttribute('position').array,b=B.pickers[i]?.geometry.getAttribute('position').array;if(!a||!b)return;for(let v=0;v<a.length;v++)if(a[v]!==b[v])throw new Error(`${what}: ${g.atlas.parts[i].name} position ${v} ${a[v]} vs ${b[v]}`);});
};

export const checks:Check[]=[
	{name:'eruptionFx is wired: a permanent first molar is hidden at 2 y and shown at 17 y (final fx visibility)',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),i=g.indicesOf('Left upper first secondary molar tooth')[0];c.assert(i!==undefined,'tooth part');
		engine.update(frame('2005-06-22'));c.assert(engine.partVisible(i)===0,`age 2: visible ${engine.partVisible(i)}`);
		engine.update(frame('2020-06-22'));c.assert(engine.partVisible(i)===1,`age 17: visible ${engine.partVisible(i)}`);
	}},
	{name:'partVisible is the final row-0 visibility: switches, Isolate (as a ghost) and PartFx visible all apply',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),heart=g.indicesOf('Heart')[0]??g.atlas.parts.findIndex(p=>p.system==='cardiac'),hum=g.indicesOf('Left humerus').find(i=>g.atlas.parts[i].system==='skeletal')!;
		engine.update(frame('2012-01-01'));c.assert(engine.partVisible(heart)===1&&engine.partVisible(hum)===1,'all on');
		engine.update({...frame('2012-01-01'),visible:['skeletal']});c.assert(engine.partVisible(heart)===0,'cardiac switched off');
		engine.update(frame('2009-09-10'));c.assert(engine.partVisible(hum)===0,'fracture hides the atlas humerus (its layer draws the fragments)');
		engine.update(frame('2012-01-01',0,'left-humerus-fracture-2009'));c.assert(engine.partVisible(hum)===1&&engine.partVisible(heart)===0,'Isolate: the humerus pickable, the ghosted heart not');
		engine.update({...frame('2012-01-01',0,'left-humerus-fracture-2009'),visible:['cardiac']});c.assert(engine.partVisible(hum)===1,'Isolate shows its part with its system switched off');
	}},
	{name:'default pivots (restCenter) come from the decoded vertices: every part\'s lies inside its decoded bounds',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),bad:string[]=[];
		g.parts.forEach((d,i)=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let k=0;k<d.position.length;k+=3)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],d.position[k+j]);hi[j]=Math.max(hi[j],d.position[k+j]);}
			const r=engine.restCenter(i);if(!r.every((v,j)=>v>=lo[j]-1e-6&&v<=hi[j]+1e-6))bad.push(g.atlas.parts[i].name);});
		c.assert(!bad.length,`${bad.length} rest centres outside their decoded bounds: ${bad.slice(0,6).join(', ')}`);
		for(const name of ['Right cornea','Right sclera','Suspensory ligament of right lens']){const i=g.indicesOf(name)[0],d=g.parts[i],ctr=[0,1,2].map(j=>{let lo=Infinity,hi=-Infinity;for(let k=j;k<d.position.length;k+=3){lo=Math.min(lo,d.position[k]);hi=Math.max(hi,d.position[k]);}return (lo+hi)/2;});
			engine.restCenter(i).forEach((v,j)=>c.near(v,ctr[j],1e-6,`${name} centre axis ${j}`));}
	}},
	{name:'a layer whose init fails drops its script\'s visible:0 fx (the humerus stays when the fracture layer cannot build)',async run(c){
		const g=await c.geometry(),hum=g.indicesOf('Left humerus').find(i=>g.atlas.parts[i].system==='skeletal')!;
		const {engine}=nodeEngine(g,{skip:['Left humerus']});engine.update(frame('2009-09-10'));c.assert(engine.partVisible(hum)===1,`humerus visible ${engine.partVisible(hum)} with no fracture layer`);
	}},
	{name:'swellBand overlaps: scripts carrying different bands on one part on the same date are listed, and the merge keeps the union',async run(c){
		// Every script sampled every 6 h from its lead to 30 days past resolve (today when chronic); bands grouped by sample time and part.
		const STEP=0.25,at=new Map<number,{id:string;part:string;band:[number,number]}[]>(),bodies=new Map<string,ReturnType<typeof bodyAt>>();
		for(const s of SCRIPTS){const o=toDays(s.onset),a=o-leadDays(s.id)-2,b=toDays(s.chronic||!s.resolve?TODAY:s.resolve)+30;
			for(let t=Math.floor(a/STEP)*STEP;t<=b;t+=STEP){const date=fromDays(Math.floor(t));let body=bodies.get(date);if(!body){body=bodyAt(date);bodies.set(date,body);}
				for(const f of s.fxAt(t-o,{body,date}))if(f.swellBand){const l=at.get(t)??[];l.push({id:s.id,part:f.part,band:f.swellBand});at.set(t,l);}}}
		const pairs=new Map<string,{from:number;to:number;merged:[number,number]}>();
		for(const [t,l] of at)for(let i=0;i<l.length;i++)for(let j=i+1;j<l.length;j++){const x=l[i],y=l[j];if(x.id===y.id||x.part!==y.part||(x.band[0]===y.band[0]&&x.band[1]===y.band[1]))continue;
			const warn=console.warn;console.warn=()=>{};let m;try{m=mergeFx([{part:x.part,swell:1e-3,swellBand:x.band},{part:y.part,swell:1e-3,swellBand:y.band}],()=>[0],()=>[0,0,0]).get(0)!.swellBand!;}finally{console.warn=warn;}
			c.assert(m[0]===Math.min(x.band[0],y.band[0])&&m[1]===Math.max(x.band[1],y.band[1]),`${x.id} + ${y.id}: merged band ${m} is not the union`);
			const k=`${x.id} + ${y.id} on ${x.part}`,p=pairs.get(k);pairs.set(k,{from:Math.min(p?.from??t,t),to:Math.max(p?.to??t,t),merged:m});}
		console.log(`     scripts carrying a swellBand: ${[...new Set([...at.values()].flat().map(e=>`${e.id} [${e.band.map(v=>v.toFixed(4))}]`))].join("; ")}`);console.log(`     swellBand overlapping pairs: ${pairs.size?'':'none'}`);
		for(const [k,p] of pairs)console.log(`       ${k}: ${fromDays(Math.floor(p.from))} .. ${fromDays(Math.floor(p.to))}, merged band [${p.merged.map(v=>v.toFixed(4)).join(', ')}]`);
	}},
	{name:'isolateBox settles first when the date changed since the last settle',async run(c){
		const g=await c.geometry(),A=nodeEngine(g).engine,B=nodeEngine(g).engine,id='left-humerus-fracture-2009';
		A.update(frame('2020-01-01'));A.settle();A.update(frame('2009-09-10'));const a=A.isolateBox(id)!;
		B.update(frame('2009-09-10'));B.settle();const b=B.isolateBox(id)!;
		for(const k of ['min','max'] as const)for(const ax of ['x','y','z'] as const)c.near(a[k][ax],b[k][ax],1e-9,`${k}.${ax}`);
	}},
	{name:'settle re-warps only parts whose fx or warp changed, with the same result as a full settle',async run(c){
		const g=await c.geometry(),A=nodeEngine(g),B=nodeEngine(g),n=g.atlas.parts.length;
		A.engine.update(frame('2026-03-01'));c.assert(A.engine.settle()===n,'first settle re-warps every part');c.assert(A.engine.settle()===0,'nothing changed: none');
		A.engine.update(frame('2026-03-02'));const k=A.engine.settle();c.assert(k<n*0.05,`adult body held, walnut reaction fading: ${k} of ${n}`);
		B.engine.update(frame('2026-03-02'));B.engine.settle();
		A.bounds.forEach((b,i)=>{for(const key of ['min','max'] as const)for(const ax of ['x','y','z'] as const)c.near(b[key][ax],B.bounds[i][key][ax],1e-9,`${g.atlas.parts[i].name} ${key}.${ax}`);});
		A.engine.update(frame('2012-01-01'));c.assert(A.engine.settle()>n*0.9,'a child date re-warps nearly everything');
	}},
	{name:'before ready, settle and isolateBox do nothing; an Isolate made before ready flies once after it, and settle then matches a fresh engine',async run(c){
		const g=await c.geometry(),id='left-humerus-fracture-2009',date='2009-09-10',A=nodeEngine(g,{deferReady:true}),B=nodeEngine(g);
		c.assert(A.engine.update(frame(date,0,id)).fly===null,'no fly before ready');c.assert(A.engine.isolateBox(id)===null,'isolateBox before ready: null');c.assert(A.engine.settle()===0,'settle before ready: no-op');
		A.ready();const r=A.engine.update(frame(date,1,id));c.assert(!!r.fly,'the Isolate made before ready flies on the first frame after it');c.assert(A.engine.update(frame(date,2,id)).fly===null,'and only once');
		B.engine.update(frame(date,0,id));const b=B.engine.isolateBox(id)!;for(const k of ['min','max'] as const)for(const ax of ['x','y','z'] as const)c.near(r.fly![k][ax],b[k][ax],1e-9,`fly ${k}.${ax}`);
		A.engine.settle();B.engine.settle();sameGeometry(c,g,A,B,'isolate before ready');
	}},
	{name:'a time-sliced settle driven to completion (with a date change mid-way) equals a full settle; finishSettle (before a pick) completes a partial one; slice cost is logged',async run(c){
		const g=await c.geometry(),n=g.atlas.parts.length,A=nodeEngine(g),B=nodeEngine(g),C=nodeEngine(g);
		// A: slices at budget 0 (one vertex chunk per call) on one date, a date change mid-way, then slices to completion. B: one full settle on the final date.
		A.engine.update(frame('2012-01-01'));let k=0;for(;k<40;k++)c.assert(!A.engine.settleSlice(0),`slice ${k} finished early`);
		A.engine.update(frame('2016-06-01'));let slices=0;while(!A.engine.settleSlice(0)){if(++slices>1e6)throw new Error('sliced settle never finishes');}
		B.engine.update(frame('2016-06-01'));c.assert(B.engine.settle()===n,'fresh full settle re-warps every part');sameGeometry(c,g,A,B,'sliced vs full');
		c.assert(A.engine.settle()===0,'after a completed sliced settle a full settle has nothing left');
		// C: a partial slice, then finishSettle (what scene.tsx calls before a pick) completes it.
		C.engine.update(frame('2016-06-01'));c.assert(!C.engine.settleSlice(0),'partial');C.engine.finishSettle();sameGeometry(c,g,C,B,'finishSettle after a partial slice');c.assert(C.engine.finishSettle()===0,'finishSettle with nothing in progress: no-op');
		// Per-frame cost: a child date re-warps nearly everything; 4 ms slices vs one full settle.
		const D=nodeEngine(g),E=nodeEngine(g);E.engine.update(frame('2008-01-01'));let t=performance.now();E.engine.settle();const full=performance.now()-t;
		D.engine.update(frame('2008-01-01'));let worst=0,frames=0,sum=0;for(let done=false;!done;){t=performance.now();done=D.engine.settleSlice(4);const dt=performance.now()-t;worst=Math.max(worst,dt);sum+=dt;frames++;}
		console.log(`     settle cost: full ${full.toFixed(1)} ms; sliced at 4 ms: ${frames} frames, worst ${worst.toFixed(2)} ms, total ${sum.toFixed(1)} ms`);
		c.assert(worst<12,`worst slice ${worst.toFixed(2)} ms`);sameGeometry(c,g,D,E,'4 ms slices vs full');
	}},
	{name:'seg attribute is the 4 segments.bin bytes per vertex (segA | segB<<4, weightA·255, dBone uint16; not normalized); layers get a float seg (weightA 0..1) and segD (metres)',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),fs=await import('node:fs'),bin=fs.readFileSync('public/anyhealth/models/segments.bin');let off=0,bytes=0;
		g.atlas.parts.forEach((p,i)=>{const a=engine.segAttribute(i);bytes+=a.array.byteLength;c.assert(a.array instanceof Uint8Array&&a.itemSize===SEG_STRIDE&&!a.normalized,`${p.name}: ${a.array.constructor.name}×${a.itemSize}`);
			for(let k=i%97===0?0:p.vertexCount*SEG_STRIDE;k<p.vertexCount*SEG_STRIDE;k+=13){c.assert(a.array[k]===bin[off+k],`${p.name} byte ${k}`);}off+=p.vertexCount*SEG_STRIDE;});
		c.assert(bytes===off&&off===bin.length,`seg bytes ${bytes} of ${bin.length}`);
		// The skin marks layers copy the nearest Skin vertex's seg and segD from ctx.restGeometry(skin): float, weightA in 0..1, bone distance in metres (Skin sits millimetres to centimetres off the bone).
		const {scene}=nodeEngine(g);let marks=0;scene.traverse(o=>{const a=(o as import('three').Mesh).geometry?.getAttribute?.('seg');if(!a)return;marks++;c.assert(a.array instanceof Float32Array,'layer seg is float');let w=0;for(let v=2;v<a.array.length;v+=3)w=Math.max(w,a.array[v]);c.assert(w>0&&w<=1,`layer weights 0..1 (max ${w})`);const d=(o as import('three').Mesh).geometry.getAttribute('segD');c.assert(!!d&&d.array instanceof Float32Array&&d.count===a.count,'layer segD is float, one per vertex');let dm=0;for(let v=0;v<d.count;v++)dm=Math.max(dm,d.getX(v));c.assert(dm>0.001&&dm<0.14,`layer bone distances in metres (max ${dm})`);});
		c.assert(marks>0,'some layer carries a per-vertex seg');
	}},
	{name:'performance fallback: software GL gets pixel ratio 1 on ready; slow play drops to ratio 1 after 2 s, then throttles fx/uniform writes to 100 ms (applied on pause and settle)',async run(c){
		const g=await c.geometry(),fake=(gpu:string)=>{const ratios:number[]=[];return {ratios,renderer:{getContext:()=>({getExtension:(n:string)=>n==='WEBGL_debug_renderer_info'?{UNMASKED_RENDERER_WEBGL:0x9246}:null,getParameter:(p:number)=>p===0x9246?gpu:'WebKit WebGL'}),setPixelRatio:(r:number)=>{ratios.push(r);}}};};
		const sw=fake('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)');const A=nodeEngine(g,{renderer:sw.renderer}).engine;c.assert(sw.ratios[0]===1&&A.stats().lowRes,'SwiftShader: ratio 1 on ready');
		const hw=fake('ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)'),B=nodeEngine(g,{renderer:hw.renderer}).engine;c.assert(!hw.ratios.length&&!B.stats().lowRes,'hardware GPU: ratio untouched');
		// Fast play (60 fps) never degrades.
		let day=toDays('2008-01-01'),now=0;for(let k=0;k<400;k++){now+=16;B.update(frame(fromDays(day++),now));}c.assert(B.stats().tier===0,`60 fps: tier ${B.stats().tier}`);
		// Slow play (20 fps): tier 1 (ratio 1) after 2 s of play, tier 2 (throttled) after 2 s more.
		const C=nodeEngine(g,{renderer:hw.renderer}).engine;day=toDays('2008-01-01');now=0;const tierAt:number[]=[];
		for(let k=0;k<120;k++){now+=50;C.update(frame(fromDays(day++),now));tierAt.push(C.stats().tier);}
		const t1=tierAt.indexOf(1)*50,t2=tierAt.indexOf(2)*50;c.assert(t1>=2000&&t1<=2600,`tier 1 at ${t1} ms`);c.assert(hw.ratios.includes(1),'tier 1 sets pixel ratio 1');c.assert(t2>=t1+2000&&t2<=t1+2600,`tier 2 at ${t2} ms`);
		const a0=C.stats().applies;for(let k=0;k<20;k++){now+=50;C.update(frame(fromDays(day++),now));}const n=C.stats().applies-a0;c.assert(n>=9&&n<=11,`throttled: ${n} applies in 20 frames of 50 ms`);
		// Pause: the pending date applies on the next frame without a date change, whatever the time since the last apply.
		const tooth=g.indicesOf('Left upper first secondary molar tooth')[0];now+=50;C.update(frame('2005-06-22',now));now+=1;C.update(frame('2005-06-22',now));c.assert(C.partVisible(tooth)===0,'pause applies the pending date');
		now+=50;C.update(frame('2020-06-22',now));const pending=C.partVisible(tooth);C.settle();c.assert(C.partVisible(tooth)===1,`settle applies the pending date (before: ${pending})`);
	}},
	{name:'pacing slows play through every croup episode, the 2016 ER/PICU, the lacerations and the anaphylaxis reactions',run(c){
		const d=pacing(TODAY),slow=(date:string)=>d.some(r=>r.from<=date&&date<r.to&&r.k>1);
		const miss=[...CROUP_EPISODES.map(e=>`croup ${e.date}`),'sky-ridge-er-airway-2016 2016-11-02','chco-picu-subglottitis-2016 2016-11-03','chin-laceration-er-2010 2010-04-10','forehead-laceration-2011 2011-03-14','right-shin-laceration-2014 2014-01-27','egg-anaphylaxis-daycare 2005-05-02','walnut-accidental-exposure-2026 2026-03-01'].filter(x=>!slow(x.split(' ')[1]));
		c.assert(!miss.length,`not slowed: ${miss.join(', ')}`);
	}},
	{name:'acne and isotretinoin never draw the same marks twice: the isotretinoin layer shows only when isotretinoin is isolated (focused), and the acne layer yields to it',async run(c){
		const g=await c.geometry(),{engine,scene}=nodeEngine(g),ACNE='acne-diagnosis-topical-treatment',ISO='isotretinoin-accutane-course';
		const mesh=(id:string)=>scene.getObjectByName(`marks:${id}`) as import('three').Mesh|undefined;c.assert(!!mesh(ACNE)&&!!mesh(ISO),'marks meshes are named by script');
		c.assert(mesh(ISO)!.material&&(mesh(ISO)!.material as import('three').Material).depthFunc!==1/* LessDepth */,'no strict-depth dedupe trick');
		const on=(isolate:string|null)=>{engine.update(frame('2022-03-01',0,isolate));return [mesh(ACNE)!.visible,mesh(ISO)!.visible];};
		const [a0,i0]=on(null);c.assert(a0&&!i0,`nothing isolated: acne ${a0}, isotretinoin ${i0}`);
		const [a1,i1]=on(ISO);c.assert(!a1&&i1,`isotretinoin isolated: acne ${a1}, isotretinoin ${i1}`);
		const [a2,i2]=on(ACNE);c.assert(a2&&!i2,`acne isolated: acne ${a2}, isotretinoin ${i2}`);
		const [a3,i3]=on('left-humerus-fracture-2009');c.assert(a3&&!i3&&(mesh(ACNE)!.material as import('three').Material).opacity<1,`another issue isolated: acne ghosted ${a3}, isotretinoin ${i3}`);
	}},
	{name:'skin marks stay on the warped skin at growth scale (every mark vertex within 3 mm of the warped Skin on its script\'s dates)',async run(c){
		const g=await c.geometry(),{scene}=nodeEngine(g),fs=await import('node:fs'),bin=fs.readFileSync('public/anyhealth/models/segments.bin'),si=g.indicesOf('Skin')[0];
		let off=0;for(let i=0;i<si;i++)off+=g.atlas.parts[i].vertexCount*SEG_STRIDE;const skin=g.parts[si],nv=skin.position.length/3;
		const warped=(date:string)=>{const ws=warpState(rigJson as Rig,bodyAt(date)),w=new Float32Array(skin.position.length),q:Vec3=[0,0,0];for(let v=0;v<nv;v++){warpPoint(ws,[skin.position[v*3],skin.position[v*3+1],skin.position[v*3+2]],...(segAt(bin,off,v).slice(0,3) as [number,number,number]),true,q,segAt(bin,off,v)[3]);w.set(q,v*3);}return {ws,surface:skinSurface(w,v=>[skin.normal[v*3]/127,skin.normal[v*3+1]/127,skin.normal[v*3+2]/127],skin.index)};};
		const cache=new Map<string,ReturnType<typeof warped>>(),worst:string[]=[];let checked=0;
		for(const s of SCRIPTS){const m=scene.getObjectByName(`marks:${s.id}`) as import('three').Mesh|undefined;if(!m)continue;
			const P=m.geometry.getAttribute('position').array as Float32Array,S=m.geometry.getAttribute('seg').array as Float32Array,SD=m.geometry.getAttribute('segD')?.array as Float32Array|undefined;
			for(const date of [s.onset,s.resolve??fromDays(toDays(s.onset)+365)]){let w=cache.get(date);if(!w){w=warped(date);cache.set(date,w);}const q:Vec3=[0,0,0];let far=0;
				for(let v=0;v<P.length/3;v++){warpPoint(w.ws,[P[v*3],P[v*3+1],P[v*3+2]],S[v*3],S[v*3+1],S[v*3+2],true,q,SD?SD[v]:0);far=Math.max(far,w.surface.closest(q).distance);}
				checked++;if(far>0.003)worst.push(`${s.id} on ${date}: ${(far*1000).toFixed(2)} mm`);}}
		c.assert(checked>=16,`checked ${checked} layer-dates`);c.assert(!worst.length,worst.join('; '));
	}},
];
