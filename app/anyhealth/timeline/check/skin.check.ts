import fs from 'node:fs';import path from 'node:path';
import * as T from 'three';
import type {Check} from './harness';
import type {NodeAtlas} from './node-atlas';
import type {LayerContext,PartFx} from '../types';
import {SCRIPTS as AREA,SKIN_MARKS,LEAD_DAYS} from '../issues/catalog/skin';
import {bodyAt} from '../growth/proportions';
import {toDays} from '../../health/dates';
import {skinSurface} from '../issues/skin/surface';
import {buildMarks,localScale,type MarksLayer} from '../issues/skin/marks-layer';
import {sutureCount} from '../issues/skin/lacerations';
import {acneLesionCount} from '../issues/skin/acne';
import {SEGMENTS,type Body,type SegmentId} from '../types';
import {segAt,SEG_STRIDE} from '../growth/warp';

/** Day just before a script's effects may start (the LEAD_DAYS ruling). */
const before=(id:string)=>-(LEAD_DAYS[id]??0)-1;

const at=(id:string,d:number,date='2016-01-01')=>AREA.find(s=>s.id===id)!.fxAt(d,{body:bodyAt(date),date});
const quiet=(f:PartFx)=>(f.swell??0)===0&&(f.tint?.[3]??0)===0&&(f.scale??[1,1,1]).every(v=>v===1)&&(f.visible??1)===1&&!f.translate&&!f.rotate;

// The ruling's fake LayerContext: restGeometry(i) carries positions / normals / index from the decoded atlas and a `seg` attribute decoded from segments.bin.
let segBytes:Uint8Array|null=null;
function segFor(na:NodeAtlas,i:number){
	segBytes??=new Uint8Array(fs.readFileSync(path.resolve('public/anyhealth/models/segments.bin')));
	let o=0;for(let k=0;k<i;k++)o+=na.atlas.parts[k].vertexCount*SEG_STRIDE;
	const vc=na.atlas.parts[i].vertexCount,a=new Float32Array(vc*3),d=new Float32Array(vc);for(let v=0;v<vc;v++){const s=segAt(segBytes,o,v);a[v*3]=s[0];a[v*3+1]=s[1];a[v*3+2]=s[2];d[v]=s[3];}
	return Object.assign(a,{segD:d});
}
function fakeCtx(na:NodeAtlas):LayerContext{
	const cache=new Map<number,T.BufferGeometry>();
	return {
		scene:new T.Scene(),atlas:na.atlas,indicesOf:na.indicesOf,
		restGeometry(i){let g=cache.get(i);if(!g){const p=na.parts[i];g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(p.position,3));g.setAttribute('normal',new T.BufferAttribute(p.normal,3,true));{const s=segFor(na,i);g.setAttribute('seg',new T.BufferAttribute(s,3));g.setAttribute('segD',new T.BufferAttribute(s.segD,1));}g.setIndex(new T.BufferAttribute(p.index,1));cache.set(i,g);}return g;},
		material:o=>new T.MeshStandardMaterial({color:o.color,transparent:o.transparent,opacity:o.opacity??1}),
		requestFly(){},
	};
}
const skinOf=(na:NodeAtlas)=>{const i=na.indicesOf('Skin')[0],p=na.parts[i];return {i,surface:skinSurface(p.position,v=>[p.normal[v*3]/127,p.normal[v*3+1]/127,p.normal[v*3+2]/127],p.index,segFor(na,i),segFor(na,i).segD)};};

export const checks:Check[]=[
	{name:'skin: no effect before onset',run(c){AREA.forEach(s=>c.assert(s.fxAt(before(s.id),{body:bodyAt(s.onset),date:s.onset}).every(quiet),`${s.id} before onset`));}},
	{name:'skin: resolved non-chronic issues return to baseline',run(c){AREA.filter(s=>!s.chronic&&!s.layer).forEach(s=>{const d=toDays(s.resolve!)-toDays(s.onset)+60;c.assert(s.fxAt(d,{body:bodyAt(s.resolve!),date:s.resolve!}).every(f=>(f.swell??0)===0&&(f.tint?.[3]??0)===0),`${s.id} after resolve`);});}},
	{name:'skin: effects ramp (no step > 25% of peak between adjacent hours in the first 3 days)',run(c){
		AREA.forEach(s=>{
			const ctx={body:bodyAt(s.onset),date:s.onset},series:Map<string,number>[]=[];
			for(let h=0;h<=72;h++){const m=new Map<string,number>();s.fxAt(h/24,ctx).forEach(f=>{m.set(`${f.part}|swell`,(m.get(`${f.part}|swell`)??0)+Math.abs(f.swell??0));m.set(`${f.part}|tint`,Math.max(m.get(`${f.part}|tint`)??0,f.tint?.[3]??0));m.set(`${f.part}|scale`,Math.max(m.get(`${f.part}|scale`)??0,...(f.scale??[1,1,1]).map(v=>Math.abs(v-1))));});series.push(m);}
			const keys=new Set(series.flatMap(m=>[...m.keys()]));
			keys.forEach(k=>{const v=series.map(m=>m.get(k)??0),peak=Math.max(...v);if(peak<=0)return;let step=0;for(let h=1;h<v.length;h++)step=Math.max(step,Math.abs(v[h]-v[h-1]));c.assert(step<=.25*peak+1e-9,`${s.id} ${k}: step ${step.toFixed(4)} > 25% of peak ${peak.toFixed(4)}`);});
		});
	}},
	{name:'skin: every skin script has a marks spec, and state() is pure and sized to its marks',run(c){
		AREA.forEach(s=>{const m=SKIN_MARKS[s.id];c.assert(!!m&&!!s.layer,`${s.id}: no marks layer`);if(!m)return;c.assert(m.marks.length>0,`${s.id}: no marks`);
			for(const d of [-1,0,.5,3,8,30,100,400,4000]){const a=JSON.stringify(m.state(d));c.assert(a===JSON.stringify(m.state(d)),`${s.id} state impure at ${d}`);c.assert(m.state(d).length===m.marks.length,`${s.id} state length at ${d}`);}
			c.assert(m.state(before(s.id)).every(x=>x.alpha===0),`${s.id}: marks drawn before onset`);});
	}},
	{name:'skin: the marks layer places every anchor and mark vertex within 3 mm of the Skin surface (rest)',async run(c){
		const na=await c.geometry(),ctx=fakeCtx(na),{surface}=skinOf(na);
		for(const s of AREA){
			const layer=s.layer!() as MarksLayer;c.assert(layer.init(ctx),`${s.id}: init failed`);
			const placed=layer.placed(),pos=layer.positions();c.assert(placed.length===SKIN_MARKS[s.id].marks.length&&pos.length>0,`${s.id}: nothing placed`);
			placed.forEach((m,j)=>{c.assert(surface.closest(m.anchor).distance<=.003,`${s.id} anchor ${j} off the skin`);c.assert(surface.closest(m.def.at).distance<=.05,`${s.id} hint ${j} is ${surface.closest(m.def.at).distance.toFixed(3)} m from the skin`);});
			let worst=0;for(let v=0;v<pos.length;v+=3)worst=Math.max(worst,surface.closest([pos[v],pos[v+1],pos[v+2]]).distance);
			c.assert(worst<=.003,`${s.id}: a mark vertex is ${(worst*1000).toFixed(2)} mm from the skin`);
			c.assert(layer.box()!==null,`${s.id}: no box`);layer.dispose();
		}
	}},
	{name:'skin: layer update reports a change only when the day or visibility moves, and hides with the integumentary switch',async run(c){
		const na=await c.geometry(),ctx=fakeCtx(na),s=AREA.find(x=>x.id==='right-shin-laceration-2014')!,layer=s.layer!() as MarksLayer;c.assert(layer.init(ctx),'init');
		const mesh=ctx.scene.children.at(-1) as T.Mesh,fr=(on:boolean,iso=false)=>({systemVisible:()=>on,hiddenByIsolate:iso,isolated:false,now:0,direction:0 as const,ctx:{body:bodyAt('2014-01-27'),date:'2014-01-27'}});
		c.assert(layer.update(3,fr(true)).changed&&mesh.visible,'day 3 drawn');c.assert(!layer.update(3,fr(true)).changed,'same day: no change');
		c.assert(layer.update(3,fr(false)).changed&&!mesh.visible,'integumentary off hides');c.assert(layer.update(3,fr(true,true)).changed===false&&!mesh.visible,'hidden by isolate');
		c.assert(layer.update(-1,fr(true)).changed&&!mesh.visible,'nothing before onset');layer.dispose();c.assert(!ctx.scene.children.includes(mesh),'disposed');
	}},
	{name:'skin: marks carry per-vertex seg from the Skin (the shin cut rides the right shank)',async run(c){
		const na=await c.geometry(),{surface}=skinOf(na),b=buildMarks(surface,SKIN_MARKS['right-shin-laceration-2014'].marks);
		c.assert(b.seg.length===b.position.length,'seg per vertex');
		const rShank=SEGMENTS.indexOf('rShank');let on=0;for(let v=0;v<b.seg.length;v+=3){c.assert(b.seg[v]>=0&&b.seg[v]<15&&b.seg[v+1]>=0&&b.seg[v+1]<15&&b.seg[v+2]>=0&&b.seg[v+2]<=1,'seg range');if((b.seg[v]===rShank&&b.seg[v+2]>=.5)||(b.seg[v+1]===rShank&&b.seg[v+2]<=.5))on++;}
		c.assert(on/(b.seg.length/3)>.9,`only ${on} of ${b.seg.length/3} shin mark vertices ride rShank`);
	}},
	{name:'skin: shin suture count = 11 at day 3, 4 buried after the 7 surface stitches come out (day 8), 0 once the gut is absorbed',run(c){
		c.assert(sutureCount('right-shin-laceration-2014',-1)===0,'none before');c.assert(sutureCount('right-shin-laceration-2014',3)===11,`day 3: ${sutureCount('right-shin-laceration-2014',3)}`);
		c.assert(sutureCount('right-shin-laceration-2014',8)===4,`day 8: ${sutureCount('right-shin-laceration-2014',8)}`);c.assert(sutureCount('right-shin-laceration-2014',91)===0,`day 91: ${sutureCount('right-shin-laceration-2014',91)}`);
		c.assert(sutureCount('forehead-laceration-2011',2)===3&&sutureCount('forehead-laceration-2011',5)===0,'forehead: 3 sutures out on 3/17/11');
	}},
	{name:'skin: laceration scars are permanent and pale (25% opacity) after a year',run(c){
		['chin-laceration-er-2010','forehead-laceration-2011','right-shin-laceration-2014'].forEach(id=>{const s=AREA.find(x=>x.id===id)!,m=SKIN_MARKS[id],st=m.state(400),line=m.marks.findIndex(x=>x.tag==='cut');c.assert(s.chronic===true,`${id} chronic`);c.assert(Math.abs(st[line].alpha-.25)<1e-9,`${id} scar alpha ${st[line].alpha}`);c.assert(m.state(3)[line].alpha===1,`${id} open wound`);});
	}},
	{name:'skin: isolating acne or isotretinoin at 2022-03-01 shows active lesions, and both draw the same marks during the course',run(c){
		const lesionsOn=(id:string,date:string)=>{const m=SKIN_MARKS[id],d=toDays(date)-toDays(AREA.find(x=>x.id===id)!.onset),st=m.state(d);return m.marks.filter((x,i)=>(x.tag==='comedone'||x.tag==='inflammatory')&&st[i].alpha>0).length;};
		c.assert(lesionsOn('acne-diagnosis-topical-treatment','2022-03-01')>0,'acne isolated');c.assert(lesionsOn('isotretinoin-accutane-course','2022-03-01')>0,'isotretinoin isolated');
		const a=SKIN_MARKS['acne-diagnosis-topical-treatment'],b=SKIN_MARKS['isotretinoin-accutane-course'];c.assert(JSON.stringify(a.marks)===JSON.stringify(b.marks),'same marks');
		for(const date of ['2022-01-03','2022-03-01','2022-06-28'])c.assert(JSON.stringify(a.state(toDays(date)-toDays('2021-08-25')))===JSON.stringify(b.state(toDays(date)-toDays('2022-01-03'))),`same look on ${date}`);
		c.assert(b.state(toDays('2022-08-01')-toDays('2022-01-03')).every(x=>x.alpha===0),'isotretinoin layer empty after the course');
	}},
	{name:'skin: the chin wound is already a few days old on the follow-up call (lead)',run(c){
		const m=SKIN_MARKS['chin-laceration-er-2010'],cut=m.marks.findIndex(x=>x.tag==='cut'),lead=LEAD_DAYS['chin-laceration-er-2010'];
		c.assert(lead>0&&lead<=7,`lead ${lead}`);c.assert(m.state(-lead)[cut].alpha===1&&m.state(-lead-1)[cut].alpha===0,'wound starts lead days before onset');c.assert(sutureCount('chin-laceration-er-2010',0)===4,'sutured on the call date');
	}},
	{name:'skin: mark sizes follow the local segment scale (length along the axis, girth across)',run(c){
		const f=(v:number)=>Object.fromEntries(SEGMENTS.map(s=>[s,v])) as Record<SegmentId,number>,body:Body={...bodyAt('2016-01-01'),scale:.5,length:{...f(1),rShank:2},softGirth:f(1.5)};
		const r=SEGMENTS.indexOf('rShank');c.near(localScale(body,[r,r,1],[0,-1,0]),.5*2,.05,'along the shank');c.near(localScale(body,[r,r,1],[1,0,0]),.5*1.5,.01,'across the shank');
	}},
	{name:'skin: acne marks at 2022-06-28 < 20% of their 2021-12-31 count',run(c){
		const a=acneLesionCount('2021-12-31'),b=acneLesionCount('2022-06-28');c.assert(a>=30,`2021-12-31: ${a} lesions`);c.assert(b<.2*a,`2022-06-28: ${b} vs ${a}`);c.assert(acneLesionCount('2021-08-24')===0,'none before diagnosis');
	}},
	{name:'skin: neonatal acne papules 12–20, cleared by 3 months of age; cradle cap gone by resolve',run(c){
		const m=SKIN_MARKS['neonatal-acne-cradle-cap'],s=AREA.find(x=>x.id==='neonatal-acne-cradle-cap')!,pap=m.marks.map((x,i)=>x.tag==='papule'?i:-1).filter(i=>i>=0);
		c.assert(pap.length>=12&&pap.length<=20,`${pap.length} papules`);c.assert(pap.every(i=>m.state(0)[i].alpha>0),'all papules at the 1-month visit');const sc=m.marks.map((x,i)=>x.tag==='scale'?i:-1).filter(i=>i>=0),two=toDays('2003-08-22')-toDays(s.onset);
		c.assert(sc.every(i=>m.state(0)[i].alpha===0),'no cradle cap before the 2-month visit ramp');c.assert(sc.every(i=>m.state(two)[i].alpha>.8),'cradle cap at the 2-month visit');
		const d3=toDays('2003-09-22')-toDays(s.onset);c.assert(pap.every(i=>m.state(d3)[i].alpha===0),'papules gone by 3 months of age');
		const end=toDays(s.resolve!)-toDays(s.onset);c.assert(m.state(end).every(x=>x.alpha===0),'all clear at resolve');c.assert(at('neonatal-acne-cradle-cap',end).every(quiet),'scalp tint gone at resolve');
	}},
	{name:'skin: warts 2–4 on the left hand, cleared by resolve after the recurrence is retreated',run(c){
		const m=SKIN_MARKS['verruca-vulgaris-2018'],s=AREA.find(x=>x.id==='verruca-vulgaris-2018')!,w=m.marks.map((x,i)=>x.tag==='wart'?i:-1).filter(i=>i>=0),n=(d:number)=>w.filter(i=>m.state(d)[i].alpha>0).length;
		c.assert(w.length>=2&&w.length<=4,`${w.length} warts`);c.assert(m.marks.every(x=>x.at[0]>0),'left hand (+x)');c.assert(n(0)===w.length,'all present at treatment');c.assert(n(30)===0,'cleared after the first treatment');
		const end=toDays(s.resolve!)-toDays(s.onset);c.assert(n(end-35)>=1,'a wart recurs before retreatment');c.assert(m.state(end).every(x=>x.alpha===0),'all clear at resolve');
	}},
	{name:'skin: eczema flares on the right palm improve through childhood',run(c){
		const m=SKIN_MARKS['childhood-atopic-dyshidrotic-eczema'],s=AREA.find(x=>x.id==='childhood-atopic-dyshidrotic-eczema')!,d=(date:string)=>toDays(date)-toDays(s.onset);
		const burden=(from:string,to:string)=>{let t=0;for(let x=d(from);x<d(to);x+=3)t+=m.state(x).reduce((a,y)=>a+y.alpha,0);return t;};
		const early=burden('2005-06-22','2008-06-22'),late=burden('2012-06-22','2015-06-22');c.assert(early>0&&late<.6*early,`burden ${early.toFixed(1)} → ${late.toFixed(1)}`);
		c.assert(burden('2022-01-01','2024-01-01')>0,'still flares (dyshidrotic, 2022)');c.assert(burden('2050-01-01','2052-01-01')>0,'never goes silent');
		c.assert(m.marks.filter(x=>x.tag==='patch'&&Math.abs(x.at[0])>.07&&x.at[1]>1.55).length>=2,'ear patches');c.assert(s.chronic===true,'chronic');
		const palm=m.marks.filter(x=>x.tag==='vesicle');c.assert(palm.length>0&&palm.every(x=>x.at[0]<0),'vesicles on the right palm (−x)');
	}},
	{name:'skin: isotretinoin lip dryness is illustrative and ramps in, then clears after the course',run(c){
		const s=AREA.find(x=>x.id==='isotretinoin-accutane-course')!,lip=(d:number)=>at(s.id,d).find(f=>f.part==='Lip')?.tint?.[3]??0;
		c.assert(s.illustrative===true,'illustrative');c.assert(lip(60)>lip(3)&&lip(60)>0,'lip dryness during the course');c.assert(lip(toDays(s.resolve!)-toDays(s.onset)+30)===0,'lips back to baseline');
	}},
];
