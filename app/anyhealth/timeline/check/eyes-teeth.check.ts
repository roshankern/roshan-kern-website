/** Checks for the eyes-teeth issue scripts, the wisdom-teeth layer and tooth eruption (docs/anyhealth/timeline-medical-basis/eyes-teeth.md). */
import * as T from 'three';
import type {Check} from './harness';
import type {LayerContext,LayerFrame,PartFx,Quat} from '../types';
import {SCRIPTS as AREA} from '../issues/catalog/eyes-teeth';
import {bodyAt} from '../growth/proportions';
import {toDays,fromDays} from '../../health/dates';
import {BIRTH_DATE} from '../../health/types';
import {eruptionFx,TEETH} from '../issues/teeth/eruption';
import {GLOBE} from '../issues/eyes/globe';

const at=(id:string,d:number,date='2016-01-01')=>AREA.find(s=>s.id===id)!.fxAt(d,{body:bodyAt(date),date});
const dayAt=(id:string,date:string)=>toDays(date)-toDays(AREA.find(s=>s.id===id)!.onset);
const ageDate=(years:number)=>fromDays(toDays(BIRTH_DATE)+Math.round(years*365.25));
/** Rotation angle of a quaternion, radians. */
const angleOf=(q?:Quat)=>q?2*Math.acos(Math.min(1,Math.abs(q[3]))):0;
/** Per-quantity magnitudes of one fx list (max over its parts). */
const mags=(l:PartFx[])=>({
	swell:Math.max(0,...l.map(f=>Math.abs(f.swell??0))),
	tint:Math.max(0,...l.map(f=>f.tint?.[3]??0)),
	scale:Math.max(0,...l.map(f=>Math.max(...(f.scale??[1,1,1]).map(v=>Math.abs(v-1))))),
	rotate:Math.max(0,...l.map(f=>angleOf(f.rotate))),
	translate:Math.max(0,...l.map(f=>Math.hypot(...(f.translate??[0,0,0])))),
});
/** Merged visibility per part name for a fx list (product, as mergeFx does). */
const visOf=(l:PartFx[],name:string)=>l.filter(f=>f.part===name).reduce((v,f)=>v*(f.visible??1),1);
const molars=TEETH.filter(t=>/secondary molar/.test(t.part));

/** A node-side LayerContext over the decoded atlas (no seg attribute: the wisdom layer uses a fixed head segment). */
async function fakeLayerContext(c:Parameters<Check['run']>[0]):Promise<LayerContext>{
	const g=await c.geometry();
	return {
		scene:new T.Scene(),atlas:g.atlas,indicesOf:g.indicesOf,
		restGeometry(i){const p=g.parts[i];if(!p)return undefined;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(p.position,3));geo.setAttribute('normal',new T.BufferAttribute(p.normal,3,true));geo.setIndex(new T.BufferAttribute(p.index,1));geo.computeBoundingBox();return geo;},
		material:m=>new T.MeshStandardMaterial({color:m.color}),
		requestFly(){},
	};
}
const frameAt=(date:string):LayerFrame=>({systemVisible:()=>true,hiddenByIsolate:false,now:0,direction:1,ctx:{body:bodyAt(date),date}});

export const checks:Check[]=[
	{name:'eyes-teeth: no effect before onset',run(c){AREA.forEach(s=>c.assert(s.fxAt(-1,{body:bodyAt(s.onset),date:s.onset}).every(f=>(f.swell??0)===0&&(f.tint?.[3]??0)===0&&(f.scale??[1,1,1]).every(v=>v===1)&&(f.visible??1)===1&&!f.translate&&!f.rotate),`${s.id} before onset`));}},
	{name:'eyes-teeth: resolved non-chronic issues return to baseline',run(c){AREA.filter(s=>!s.chronic&&!s.layer).forEach(s=>{const d=toDays(s.resolve!)-toDays(s.onset)+60;c.assert(s.fxAt(d,{body:bodyAt(s.resolve!),date:s.resolve!}).every(f=>(f.swell??0)===0&&(f.tint?.[3]??0)===0&&!f.rotate&&(f.scale??[1,1,1]).every(v=>v===1)),`${s.id} after resolve`);});}},
	{name:'eyes-teeth: effects ramp (no step > 25% of peak between adjacent hours in the first 3 days)',run(c){
		const keys=['swell','tint','scale','rotate','translate'] as const;
		for(const s of AREA){
			const fx=(d:number)=>mags(s.fxAt(d,{body:bodyAt(fromDays(toDays(s.onset)+Math.floor(d))),date:fromDays(toDays(s.onset)+Math.floor(d))}));
			// Peak of each quantity over the script's life (daily for two years or to resolve, plus the hourly samples).
			const span=s.resolve?toDays(s.resolve)-toDays(s.onset):730,hourly=Array.from({length:3*24+1},(_,h)=>fx(h/24)),peak={swell:0,tint:0,scale:0,rotate:0,translate:0};
			for(const m of [...hourly,...Array.from({length:span+1},(_,d)=>fx(d))])keys.forEach(k=>{peak[k]=Math.max(peak[k],m[k]);});
			for(let h=1;h<hourly.length;h++)keys.forEach(k=>{if(peak[k]>0){const step=Math.abs(hourly[h][k]-hourly[h-1][k]);c.assert(step<=0.25*peak[k]+1e-12,`${s.id}: ${k} jumps ${(step/peak[k]*100).toFixed(1)}% of peak at hour ${h}`);}});
		}
	}},
	{name:'eyes-teeth: every part named by the scripts and eruption exists in the atlas',async run(c){const g=await c.geometry();const names=[...AREA.flatMap(s=>s.parts),...AREA.flatMap(s=>[0,30,400,3000].flatMap(d=>s.fxAt(d,{body:bodyAt(s.onset),date:s.onset}).map(f=>f.part))),...TEETH.map(t=>t.part),...GLOBE.left.parts,...GLOBE.right.parts];names.forEach(n=>c.assert(g.indicesOf(n).length>0,`no atlas part "${n}"`));c.assert(TEETH.length===28,'28 permanent teeth in the atlas');}},
	{name:'eyes-teeth: globe centres match the decoded eye geometry',async run(c){const g=await c.geometry();for(const side of ['left','right'] as const){const sclera=g.parts[g.indicesOf(side==='left'?'Left sclera':'Right sclera')[0]].position,cornea=g.parts[g.indicesOf(side==='left'?'Left cornea':'Right cornea')[0]].position;let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z0=Infinity,z1=-Infinity;for(let v=0;v<sclera.length;v+=3){x0=Math.min(x0,sclera[v]);x1=Math.max(x1,sclera[v]);y0=Math.min(y0,sclera[v+1]);y1=Math.max(y1,sclera[v+1]);z0=Math.min(z0,sclera[v+2]);}for(let v=2;v<cornea.length;v+=3)z1=Math.max(z1,cornea[v]);const G=GLOBE[side];c.near(G.centre[0],(x0+x1)/2,0.0005,`${side} centre x`);c.near(G.centre[1],(y0+y1)/2,0.0005,`${side} centre y`);c.near(G.centre[2],(z0+z1)/2,0.0005,`${side} centre z`);c.near(G.axialLength,z1-z0,0.0005,`${side} axial length`);}}},
	// (a) eruption
	{name:'eyes-teeth: no permanent molar visible at age 2; first molars at 7; every tooth at 14',run(c){
		const a2=eruptionFx(bodyAt(ageDate(2))),a7=eruptionFx(bodyAt(ageDate(7))),a14=eruptionFx(bodyAt(ageDate(14)));
		molars.forEach(t=>c.assert(visOf(a2,t.part)===0,`${t.part} hidden at 2`));
		molars.filter(t=>/first/.test(t.part)).forEach(t=>c.assert(visOf(a7,t.part)===1,`${t.part} visible at 7`));
		TEETH.forEach(t=>c.assert(visOf(a14,t.part)===1,`${t.part} visible at 14`));c.assert(a14.length===0,'no eruption fx left at 14');
	}},
	{name:'eyes-teeth: primary stand-ins are 0.7 scale; permanent teeth rise occlusally and blank out during exfoliation',run(c){
		const a4=eruptionFx(bodyAt(ageDate(4)));const inc=a4.find(f=>f.part==='Right upper central secondary incisor tooth');c.assert(!!inc&&inc.scale!.every(v=>Math.abs(v-0.7)<1e-9)&&visOf(a4,inc.part)===1,'upper central stand-in at 4');
		c.assert(visOf(eruptionFx(bodyAt(ageDate(0.2))),'Right upper central secondary incisor tooth')===0,'no teeth at 2 months');
		const up=eruptionFx(bodyAt(ageDate(7.8))).find(f=>f.part==='Left upper central secondary incisor tooth'),lo=eruptionFx(bodyAt(ageDate(6.8))).find(f=>f.part==='Left lower central secondary incisor tooth');
		c.assert(!!up&&up.translate![1]>0&&(up.visible??1)===1,'upper incisor erupts downward (starts above, +y)');c.assert(!!lo&&lo.translate![1]<0&&(lo.visible??1)===1,'lower incisor erupts upward (starts below, -y)');
		const uc='Left upper central secondary incisor tooth';
		c.assert(visOf(eruptionFx(bodyAt(ageDate(7-20/365.25))),uc)===0,'toothless 20 days before the upper central emerges');c.assert(visOf(eruptionFx(bodyAt(ageDate(7+1/365.25))),uc)===1,'visible from emergence');
	}},
	{name:'eyes-teeth: exfoliation gaps (neither tooth visible) never exceed the cited toothless period',run(c){
		const days=Array.from({length:Math.round(8*365.25)+1},(_,k)=>eruptionFx(bodyAt(fromDays(toDays(ageDate(5))+k))));
		for(const t of TEETH.filter(t=>t.primary)){
			let run=0,longest=0;for(const l of days){run=visOf(l,t.part)===0?run+1:0;longest=Math.max(longest,run);}
			c.assert(longest>0,`${t.part}: has an exfoliation gap`);c.assert(longest<=t.gap!+1,`${t.part}: ${longest} toothless days > cited ${t.gap}`);
		}
	}},
	// (b) exotropia
	{name:'eyes-teeth: exotropia turns the left globe outward, straight again by 2004-03-22',run(c){
		const aug=at('infant-left-exotropia',dayAt('infant-left-exotropia','2003-08-15'),'2003-08-15'),end=at('infant-left-exotropia',dayAt('infant-left-exotropia','2004-03-22'),'2004-03-22');
		const sc=aug.find(f=>f.part==='Left sclera');c.assert(!!sc&&angleOf(sc.rotate)>0,'angle at 2003-08 > 0');c.assert(sc!.rotate![1]>0,'yaw toward +x (outward for the left eye)');
		c.assert(GLOBE.left.parts.every(p=>aug.some(f=>f.part===p)),'every left globe part turns');c.assert(!aug.some(f=>/Right|right/.test(f.part)),'right eye untouched');
		c.assert(mags(end).rotate===0,'angle at 2004-03-22 = 0');
	}},
	// (c) myopia
	{name:'eyes-teeth: myopic axial elongation today is within the cited range',run(c){
		const today='2026-09-25',l=at('bilateral-myopia',dayAt('bilateral-myopia',today),today);
		for(const side of ['left','right'] as const){const f=l.find(x=>x.part===GLOBE[side].parts[0])!;c.assert(!!f,`${side} globe scaled`);const mm=(f.scale![2]-1)*GLOBE[side].axialLength*1000;c.assert(mm>=0.35*0.75-1e-9&&mm<=0.35*1.25+1e-9,`${side} elongation ${mm.toFixed(3)} mm in [0.26,0.44]`);c.assert(f.scale![0]===1&&f.scale![1]===1,'z only');c.assert(f.pivot!.every((v,k)=>v===GLOBE[side].centre[k]),'about the globe centre');}
	}},
	// fillings
	{name:'eyes-teeth: fillings tint the named molars permanently; the 2024 refill is brighter',run(c){
		const t3=at('first-cavity-filling-tooth-3',3000);c.assert(t3.length===1&&t3[0].part==='Right upper first secondary molar tooth'&&Math.abs(t3[0].tint![3]-0.55)<1e-9,'#3 tint 0.55');
		const t19=at('fillings-teeth-30-31-composite',2000),t24=at('city-creek-fillings-30-31',400);
		['Right lower first secondary molar tooth','Right lower second secondary molar tooth'].forEach(p=>{const a=t19.find(f=>f.part===p),b=t24.find(f=>f.part===p);c.assert(!!a&&!!b,`${p} tinted in 2019 and 2024`);c.assert(b!.tint![3]>a!.tint![3],`${p} brighter after the refill`);});
		['first-cavity-filling-tooth-3','fillings-teeth-30-31-composite','city-creek-fillings-30-31','wisdom-teeth-extraction','bilateral-myopia'].forEach(id=>c.assert(AREA.find(s=>s.id===id)!.chronic===true,`${id} chronic`));
	}},
	// (d) wisdom layer
	{name:'eyes-teeth: wisdom layer sits distal to the second molars, erupts, and is gone after extraction',async run(c){
		const g=await c.geometry(),s=AREA.find(x=>x.id==='wisdom-teeth-extraction')!,ctx=await fakeLayerContext(c),layer=s.layer!();
		c.assert(layer.init(ctx),'init');const box=layer.box();c.assert(!!box&&!box.isEmpty(),'box');
		const seconds=['Right upper second secondary molar tooth','Left upper second secondary molar tooth','Right lower second secondary molar tooth','Left lower second secondary molar tooth'].map(n=>{const p=g.parts[g.indicesOf(n)[0]].position;let z=0;for(let v=2;v<p.length;v+=3)z+=p[v];return z/(p.length/3);});
		c.assert(box!.getCenter(new T.Vector3()).z<Math.min(...seconds),`box centre z ${box!.getCenter(new T.Vector3()).z.toFixed(4)} behind the second molars ${Math.min(...seconds).toFixed(4)}`);
		const meshes=ctx.scene.children.filter((o):o is T.Mesh=>(o as T.Mesh).isMesh);c.assert(meshes.length===4,'four third molars');
		meshes.forEach((m,k)=>{m.geometry.computeBoundingBox();const z=m.geometry.boundingBox!.getCenter(new T.Vector3()).z;c.assert(z<seconds[k],`third molar ${k} behind its second molar`);});
		const upd=(date:string)=>layer.update(dayAt(s.id,date),frameAt(date));
		upd(ageDate(12));c.assert(meshes.every(m=>!m.visible),'hidden at 12');
		upd('2023-08-21');c.assert(meshes.every(m=>m.visible),'erupted at the consultation');
		upd('2023-12-27');c.assert(meshes.every(m=>!m.visible),'extracted');
		upd('2023-08-21');c.assert(meshes.every(m=>m.visible),'scrubbing back restores them');layer.dispose();
		const heal=at(s.id,10),healed=at(s.id,60);c.assert(heal.some(f=>/Gingiva/.test(f.part)&&(f.tint?.[3]??0)>0),'socket healing tint at day 10');c.assert(healed.every(f=>(f.tint?.[3]??0)===0),'gingiva healed by 6 weeks');
	}},
];
