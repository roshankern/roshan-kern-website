/** v2 Task 3: ghosted focus (fx row 4 .w, the tfxGhost uniform, the two render passes), layer fading, fractional fx days and focusBox. The render passes run for real under SwiftShader (ghost-gpu.ts; ANYHEALTH_PLAYWRIGHT, or ANYHEALTH_SKIP_GPU=1 to skip). */
import * as T from 'three';
import type {Check,CheckContext} from './harness';
import {DEFAULT_VISIBLE} from '../../atlas/anatomy';
import {nodeEngine} from './engine-node';
import {ghostGpu} from './ghost-gpu';
import {scriptFor,dayOf} from '../issues';
import {GHOST_ALPHA} from '../director/types';
import {FX_ROWS} from '../fx/part-fx';
import {toDays} from '../../health/dates';
import {BIRTH_DATE} from '../../health/types';
import type {Engine,EngineFrame} from '../engine';
import type {IssueScript} from '../types';

const FRACTURE='left-humerus-fracture-2009',CALLUS='healing-humerus-callus-2009',SCOLIOSIS='scoliosis-upper-thoracic-2025',ACNE='acne-diagnosis-topical-treatment',BIRTH=toDays(BIRTH_DATE),TODAY='2026-09-25';
const frame=(date:string,o:Partial<EngineFrame>={}):EngineFrame=>({date,visible:DEFAULT_VISIBLE,isolate:null,now:0,...o});
/** The shared fx texture and ghost uniforms, as a patched material's onBeforeCompile hands them to the shader, and the injected fragment. */
function probe(engine:Engine){
	const m=new T.MeshStandardMaterial();engine.patchMaterial(m,{partFx:true,soft:false});
	const sh={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <clipping_planes_fragment>\n#include <color_fragment>\n#include <opaque_fragment>'};
	m.onBeforeCompile(sh as never,undefined as never);const tex=sh.uniforms.tfxState.value as T.DataTexture,width=sh.uniforms.tfxWidth.value as number,data=tex.image.data as Float32Array;
	return {tex,ghost:sh.uniforms.tfxGhost as {value:number},pass:sh.uniforms.tfxPass as {value:number},flag:(i:number)=>data[(4*width+i)*4+3],fragment:sh.fragmentShader,vertex:sh.vertexShader};
}
/** Temporarily set a script's focusAlso. */
async function withFocusAlso<R>(id:string,also:string[],fn:()=>R|Promise<R>):Promise<R>{const s=scriptFor(id) as IssueScript,prev=s.focusAlso;s.focusAlso=also;try{return await fn();}finally{if(prev===undefined)delete s.focusAlso;else s.focusAlso=prev;}}
const boxNear=(c:CheckContext,a:T.Box3|null,b:T.Box3|null,tol:number,what:string)=>{c.assert(!!a&&!!b,`${what}: a box is null`);for(const k of ['min','max'] as const)for(const ax of ['x','y','z'] as const)c.near(a![k][ax],b![k][ax],tol,`${what} ${k}.${ax}`);};
const fracture=(scene:T.Scene)=>{const g=scene.getObjectByName('fracture')!,m=(g.children[0] as T.Mesh).material as T.Material;return {group:g,head:m};};

/** The GPU run: the focused script's first part (F), a non-focus Heart (N), a switched-off Liver (H) and a translucent skin-like part (S), on a date with no issue fx on them. */
const gpu=()=>ghostGpu({date:'2010-01-01',focus:SCOLIOSIS,names:{F:scriptFor(SCOLIOSIS)!.parts[0],N:'Heart',H:'Liver',S:'Skin (ghost check)'}});
async function gpuRun(c:CheckContext){
	const r=await gpu();if(!r){c.assert(process.env.ANYHEALTH_SKIP_GPU==='1','SKIPPED: playwright-core or Chromium not found (set ANYHEALTH_PLAYWRIGHT, see docs/anyhealth/timeline-checks.md) — set ANYHEALTH_SKIP_GPU=1 to skip this check explicitly');return null;}
	c.assert(!r.errors.length,`shader compile: ${r.errors.join('\n')}`);return r;
}
const BLUE=(p:number[])=>p[0]<=2&&p[1]<=2&&p[2]>=250,WHITE=(p:number[])=>p[0]>=250&&p[1]>=250&&p[2]>=250,same=(a:number[],b:number[])=>a.every((v,k)=>v===b[k]);

export const checks:Check[]=[
	{name:'focus flag row 4.w is 1 exactly for the focused script\'s parts (and its focusAlso scripts\'), 0 with no focus',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),p=probe(engine),n=g.atlas.parts.length;
		const expect=(names:Set<string>,what:string)=>{let bad=0;for(let i=0;i<n;i++)if(p.flag(i)!==(names.has(g.atlas.parts[i].name)?1:0))bad++;c.assert(bad===0,`${what}: ${bad} parts with the wrong flag`);c.assert(p.flag(n)===0,`${what}: padding column`);};
		const sco=new Set(scriptFor(SCOLIOSIS)!.parts);
		engine.update(frame('2025-06-01',{focus:{id:SCOLIOSIS,ghost:.5}}));expect(sco,'focus');c.near(p.ghost.value,.5,0,'tfxGhost');
		engine.update(frame('2025-06-01',{focus:null}));expect(new Set(),'focus null');c.assert(p.ghost.value===0,'ghost 0 with no focus');
		engine.update(frame('2025-06-01',{isolate:SCOLIOSIS}));expect(sco,'isolate, focus absent (v1 Isolate as focus)');c.assert(p.ghost.value===1,'isolate maps to ghost 1');
		engine.update(frame('2025-06-01',{isolate:SCOLIOSIS,focus:null}));expect(new Set(),'focus null wins over isolate');
		engine.update(frame('2025-06-01',{focus:{id:'no-such-issue',ghost:1}}));expect(new Set(),'unknown id');c.assert(p.ghost.value===0,'unknown id: no ghost');
		await withFocusAlso(SCOLIOSIS,[FRACTURE],()=>{engine.update(frame('2025-06-01',{focus:{id:SCOLIOSIS,ghost:.5},now:1}));});
		expect(new Set([...sco,...scriptFor(FRACTURE)!.parts]),'focusAlso');
		c.assert(/tfxFocus = tfxRow\(4\.0\)\.w;/.test(p.vertex)&&/uniform float tfxGhost; uniform float tfxPass;/.test(p.fragment)&&/tfxFocus < 0\.5 && tfxGhost > 0\.001/.test(p.fragment)&&/tfxPass > 0\.5\) \{ float tfxRim[^\n]*\n#include <opaque_fragment>/.test(p.fragment),'shader wiring: focus varying, ghost uniforms, discard, ghost alpha before opaque_fragment');
		c.assert(FX_ROWS===6,'row 4 is the scale row');
	}},
	{name:'ghost uniform only: changing ghost does not rewrite the fx texture',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),p=probe(engine);
		engine.update(frame('2025-06-01',{focus:{id:SCOLIOSIS,ghost:.3},now:1}));const v=p.tex.version;
		const r=engine.update(frame('2025-06-01',{focus:{id:SCOLIOSIS,ghost:.7},now:2}));
		c.assert(p.tex.version===v,`texture version ${v} → ${p.tex.version}`);c.near(p.ghost.value,.7,0,'uniform written');c.assert(r.changed,'a ghost change asks for a render');
		c.assert(!engine.update(frame('2025-06-01',{focus:{id:SCOLIOSIS,ghost:.7},now:3})).changed,'same ghost: no change');
		engine.update(frame('2025-06-01',{focus:{id:FRACTURE,ghost:.7},now:4}));c.assert(p.tex.version>v,'a focus id change rewrites the flags');
	}},
	{name:'GPU ghost: pass 1 discards non-focus at ghost>0, keeps them at ghost 0; focus parts draw opaque at ghost 1',async run(c){
		const r=await gpuRun(c);if(!r)return;const s=r.steps;
		c.assert(WHITE(s.ghost0.F)&&WHITE(s.ghost0.N),`ghost 0: focus ${s.ghost0.F}, non-focus ${s.ghost0.N} both solid`);
		c.assert(!BLUE(s.ghost0.S)&&s.ghost0.S[0]>60,`ghost 0: the translucent part draws (${s.ghost0.S})`);c.assert(BLUE(s.ghost0.H)&&BLUE(s.ghost0.gap),`switched-off part / gap show the ground: ${s.ghost0.H} ${s.ghost0.gap}`);
		c.assert(same(s['ghost0+pass'].N,s.ghost0.N)&&same(s['ghost0+pass'].S,s.ghost0.S),'the ghost pass is a no-op at ghost 0');
		for(const k of ['ghost1','ghost0.5'] as const){c.assert(WHITE(s[k].F),`${k}: focus part opaque (${s[k].F})`);c.assert(BLUE(s[k].N)&&BLUE(s[k].S)&&BLUE(s[k].H),`${k}: non-focus discarded in pass 1 (N ${s[k].N}, S ${s[k].S}, H ${s[k].H})`);}
	}},
	{name:'GPU ghost: pass 2 draws only non-focus, hidden never draws, no clear, every state restored',async run(c){
		const r=await gpuRun(c);if(!r)return;const s=r.steps,p=s['ghost1+pass'],o=s['pass only'];
		c.assert(WHITE(p.F),`focus part kept, nothing cleared (${p.F})`);c.assert(BLUE(p.gap)&&BLUE(p.H),`gap / hidden part: ground (${p.gap}, ${p.H})`);
		c.assert(p.N[0]>2&&p.N[0]<.2*255&&p.N[2]>=240,`non-focus drawn as a faint ghost over the ground (${p.N})`);
		c.assert(o.F.every(v=>v===0)&&o.H.every(v=>v===0)&&o.gap.every(v=>v===0),`pass alone: no focus, hidden part, ground or background (F ${o.F}, H ${o.H}, gap ${o.gap})`);
		c.assert(Math.abs(o.N[0]-255*GHOST_ALPHA*.35)<=3,`pass alone: a face-on ghost at GHOST_ALPHA × 0.35 (rim 0): ${o.N} vs ${(255*GHOST_ALPHA*.35).toFixed(1)}`);c.assert(o.S[0]>0&&o.S[0]<o.N[0],`pass alone: the translucent part keeps its own opacity multiplied in (${o.S} < ${o.N})`);
		c.assert(!r.restored.length,r.restored.join('; '));c.assert(same(s['ghost1 again'].N,s.ghost1.N)&&same(s['ghost1 again'].F,s.ghost1.F),'the next normal render is pass 1 again (tfxPass restored)');
	}},
	{name:'picking ignores ghosted parts at ghost ≥ 0.5; focus parts stay pickable (whatever the switches)',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),heart=g.indicesOf('Cavity of left ventricle')[0],sco=g.indicesOf(scriptFor(SCOLIOSIS)!.parts[0])[0];
		const at=(ghost:number,visible=DEFAULT_VISIBLE)=>{engine.update(frame('2012-01-01',{focus:{id:SCOLIOSIS,ghost},visible}));return [engine.partVisible(sco),engine.partVisible(heart)];};
		c.assert(JSON.stringify(at(.49))==='[1,1]','ghost 0.49: both pickable');c.assert(JSON.stringify(at(.5))==='[1,0]','ghost 0.5: the ghosted heart is not');c.assert(JSON.stringify(at(1))==='[1,0]','ghost 1');
		c.assert(JSON.stringify(at(1,['cardiac']))==='[1,0]','a focus part is shown with its system switched off');c.assert(JSON.stringify(at(0,['cardiac']))==='[1,1]','ghost 0, skeleton off: the focus part still shows, the heart by its switch');
		engine.update(frame('2012-01-01',{isolate:SCOLIOSIS}));c.assert(engine.partVisible(heart)===0&&engine.partVisible(sco)===1,'manual Isolate (ghost 1)');
	}},
	{name:'layers fade instead of hide: the fracture layer at mix(1, GHOST_ALPHA, ghost) while another script is focused, hidden by its switch, solid for its own focus and a focusAlso',async run(c){
		const g=await c.geometry(),{engine,scene}=nodeEngine(g),date='2009-09-20',{group,head}=fracture(scene);let now=0;
		const at=(o:Partial<EngineFrame>)=>{engine.update(frame(date,{now:now+=16,...o}));return {shown:group.visible,opacity:head.opacity,transparent:head.transparent,depthWrite:head.depthWrite};};
		c.assert(at({}).shown&&head.opacity===1,'drawn solid with nothing focused');
		for(const ghost of [.25,.5,1]){const r=at({focus:{id:SCOLIOSIS,ghost}});c.assert(r.shown,`ghost ${ghost}: drawn`);c.near(r.opacity,1+(GHOST_ALPHA-1)*ghost,1e-9,`ghost ${ghost}: opacity`);c.assert(r.transparent&&!r.depthWrite,`ghost ${ghost}: transparent, no depth writes`);}
		c.assert(!at({focus:{id:SCOLIOSIS,ghost:.5},visible:DEFAULT_VISIBLE.filter(s=>s!=='skeletal')}).shown,'skeleton switched off: hidden, not ghosted');
		const own=at({focus:{id:FRACTURE,ghost:1},visible:DEFAULT_VISIBLE.filter(s=>s!=='skeletal')});c.assert(own.shown&&own.opacity===1&&!own.transparent&&own.depthWrite,'own focus: solid, even with the skeleton off');
		c.assert(at({focus:{id:CALLUS,ghost:1}}).opacity<1||!!scriptFor(CALLUS)!.focusAlso?.includes(FRACTURE),'callus focus without focusAlso ghosts the fracture layer');
		await withFocusAlso(CALLUS,[FRACTURE],()=>{const r=at({focus:{id:CALLUS,ghost:1}});c.assert(r.shown&&r.opacity===1&&r.depthWrite,`focusAlso: the fracture layer stays solid when the callus is focused (opacity ${r.opacity})`);});
		c.assert(at({focus:null}).opacity===1&&!head.transparent,'back to solid');
	}},
	{name:'LayerFrame.isolated is true for the focused script (and its focusAlso) at ghost > 0: the isotretinoin marks draw on a guided focus, never with the acne copy',async run(c){
		const g=await c.geometry(),{engine,scene}=nodeEngine(g),ISO='isotretinoin-accutane-course',mesh=(id:string)=>scene.getObjectByName(`marks:${id}`) as T.Mesh;let now=0;
		const on=(focus:EngineFrame['focus'])=>{engine.update(frame('2022-03-01',{focus,now:now+=16}));return [mesh(ACNE).visible,mesh(ISO).visible];};
		c.assert(JSON.stringify(on({id:ISO,ghost:.3}))==='[false,true]','guided focus on isotretinoin at ghost 0.3: its layer only');
		c.assert(JSON.stringify(on({id:ISO,ghost:0}))==='[true,false]','focus at ghost 0: the acne layer, not isotretinoin\'s');
		c.assert(JSON.stringify(on({id:FRACTURE,ghost:1}))==='[true,false]'&&(mesh(ACNE).material as T.Material).opacity<1,'another focus: acne ghosted, isotretinoin not drawn');
		await withFocusAlso(FRACTURE,[ISO],()=>{c.assert(JSON.stringify(on({id:FRACTURE,ghost:1}))==='[false,true]','focusAlso counts as focused (isolated)');});
	}},
	{name:'fractional day drives fx: update({…,day:d+0.5}) hands every script the fx day dayOf+0.5 (the fracture included), growth keeps the date',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),s=scriptFor(FRACTURE) as IssueScript,orig=s.fxAt,seen:{day:number;date:string}[]=[];
		s.fxAt=(day,ctx)=>{seen.push({day,date:ctx.date});return orig(day,ctx);};
		try{
			const date='2009-09-02',d=toDays(date)-BIRTH;engine.update(frame(date,{day:d+.5}));
			c.assert(seen.length>0,'fxAt called');c.near(seen.at(-1)!.day,dayOf(s,date)+.5,1e-9,'fx day');c.assert(seen.at(-1)!.date===date,'growth context keeps the date');
			engine.update(frame(date,{day:d+.75,now:1}));c.near(seen.at(-1)!.day,dayOf(s,date)+.75,1e-9,'a new fractional day re-applies on the same date');
			engine.update(frame(date,{now:2}));c.near(seen.at(-1)!.day,dayOf(s,date),0,'no day: whole days from the date');
		}finally{s.fxAt=orig;}
	}},
	{name:'focusBox matches isolateBox after settle at the same day (within 1 mm), with no settle needed, focusAlso included',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g);
		for(const [id,date] of [[FRACTURE,'2009-09-20'],[SCOLIOSIS,'2026-01-10'],[ACNE,'2022-03-01']] as const){
			const d=toDays(date)-BIRTH+.25;engine.update(frame(date,{day:d}));const fb=engine.focusBox(id,d);engine.settle();boxNear(c,fb,engine.isolateBox(id),.001,id);
		}
		const d=toDays('2009-10-10')-BIRTH;engine.update(frame('2009-10-10',{day:d}));engine.settle();
		await withFocusAlso(CALLUS,[FRACTURE],()=>boxNear(c,engine.focusBox(CALLUS,d),engine.focusBox(FRACTURE,d),1e-9,'callus with focusAlso = fracture parts + layer'));
		c.assert(engine.focusBox('no-such-issue',d)===null,'unknown id: null');
	}},
	{name:'focusBox at another day uses that day\'s body (birth box height < today\'s × 0.4)',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g);engine.update(frame('2012-01-01'));
		const h=(day:number)=>{const b=engine.focusBox(SCOLIOSIS,day)!;return b.max.y-b.min.y;},birth=h(0),today=h(toDays(TODAY)-BIRTH);
		c.assert(birth<today*.4,`spine box height at birth ${birth.toFixed(3)} m, today ${today.toFixed(3)} m`);
		const b=engine.focusBox(SCOLIOSIS,0)!;c.assert(b.max.y<.6,`birth box top ${b.max.y.toFixed(3)} m is within a newborn's height`);
	}},
];
