/** Checks for the bones area (Task 8): the 2009 left humerus fracture layer, the callus record and upper-thoracic scoliosis. */
import * as T from 'three';
import type {Check} from './harness';
import type {LayerContext,LayerFrame,PartFx,SegmentId} from '../types';
import {SCRIPTS as AREA,LEAD_DAYS} from '../issues/catalog/bones';
import {SCOLIOSIS_LEVELS,SCOLIOSIS_RIBS} from '../issues/bones/scoliosis';
import {bodyAt} from '../growth/proportions';
import {toDays,fromDays} from '../../health/dates';
import {HEALED_DAY,TIMELINE_DENSITY,FRACTURE_DATE,FRACTURE_PART} from '../../fracture/model';
import {createEngine} from '../engine';
import {SEG_STRIDE} from '../growth/warp';
import rigJson from '../growth/rig.json';
import type {Rig} from '../types';

const TODAY='2026-09-25';
const script=(id:string)=>AREA.find(s=>s.id===id)!;
const at=(id:string,d:number,date='2016-01-01')=>script(id).fxAt(d,{body:bodyAt(date),date});
const dateAt=(id:string,d:number)=>fromDays(toDays(script(id).onset)+Math.floor(d));
const fxOf=(list:PartFx[],part:string)=>list.find(f=>f.part===part);
const identity=(f:PartFx)=>(f.swell??0)===0&&(f.tint?.[3]??0)===0&&(f.scale??[1,1,1]).every(v=>v===1)&&(f.visible??1)===1&&!f.translate&&!f.rotate;
const FRACTURE='left-humerus-fracture-2009',SCOLIOSIS='scoliosis-upper-thoracic-2025';

/** A LayerContext for node: rest geometry from the decoded atlas, plain materials, and a fly counter. */
async function fakeContext(c:Parameters<Check['run']>[0]){
	const g=await c.geometry(),flies:T.Box3[]=[],scene=new T.Scene(),segments:(SegmentId|undefined)[]=[];
	const ctx:LayerContext={scene,atlas:g.atlas,indicesOf:g.indicesOf,
		restGeometry(i){const p=g.parts[i];if(!p)return undefined;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(p.position,3));geo.setAttribute('normal',new T.BufferAttribute(p.normal,3));geo.setIndex(new T.BufferAttribute(p.index,1));return geo;},
		material(o){segments.push(o.segment);return new T.MeshStandardMaterial({color:o.color,transparent:!!o.transparent,opacity:o.opacity??1,depthWrite:o.depthWrite??true});},
		requestFly(b){flies.push(b.clone());},
	};
	return {ctx,flies,scene,segments};
}
const frame=(date:string,direction:-1|0|1,now:number,o:{skeletal?:boolean;hidden?:boolean}={}):LayerFrame=>({systemVisible:s=>s==='skeletal'?o.skeletal??true:true,hiddenByIsolate:!!o.hidden,isolated:false,now,direction,ctx:{body:bodyAt(date),date}});
const shown=(scene:T.Scene)=>{let n=0;scene.traverseVisible(o=>{if((o as T.Mesh).isMesh)n++;});return n;};

export const checks:Check[]=[
	{name:'bones: no effect before onset',run(c){AREA.forEach(s=>{const d=-((LEAD_DAYS[s.id]??0)+1);c.assert(s.fxAt(d,{body:bodyAt(s.onset),date:s.onset}).every(identity),`${s.id} before onset (day ${d})`);});}},
	{name:'bones: resolved non-chronic issues return to baseline',run(c){AREA.filter(s=>!s.chronic&&!s.layer).forEach(s=>{const d=toDays(s.resolve!)-toDays(s.onset)+60;c.assert(s.fxAt(d,{body:bodyAt(s.resolve!),date:s.resolve!}).every(f=>(f.swell??0)===0&&(f.tint?.[3]??0)===0),`${s.id} after resolve`);});}},
	{name:'bones: effects ramp (no step > 25% of peak between adjacent hours in the first 3 days)',run(c){
		for(const s of AREA){
			const ctx={body:bodyAt(s.onset),date:s.onset},samples:Map<string,{swell:number;tint:number;scale:number}>[]=[];
			for(let h=0;h<=72;h++){const m=new Map<string,{swell:number;tint:number;scale:number}>();for(const f of s.fxAt(h/24,ctx)){const r=m.get(f.part)??{swell:0,tint:0,scale:0};r.swell+=f.swell??0;r.tint=Math.max(r.tint,f.tint?.[3]??0);r.scale=Math.max(r.scale,...(f.scale??[1,1,1]).map(v=>Math.abs(v-1)));m.set(f.part,r);}samples.push(m);}
			const parts=new Set(samples.flatMap(m=>[...m.keys()]));
			for(const part of parts)for(const k of ['swell','tint','scale'] as const){
				const v=samples.map(m=>Math.abs(m.get(part)?.[k]??0)),peak=Math.max(...v);if(peak===0)continue;
				let step=0;for(let i=1;i<v.length;i++)step=Math.max(step,Math.abs(v[i]-v[i-1]));
				c.assert(step<=.25*peak,`${s.id} ${part} ${k}: step ${step} > 25% of peak ${peak}`);
			}
		}
	}},
	{name:'bones: the fracture hides the humerus from day 0 to the healed day, not before or after',run(c){
		const hidden=(d:number)=>fxOf(at(FRACTURE,d,dateAt(FRACTURE,d)),'Left humerus')?.visible===0;
		c.assert(hidden(10),'day 10 hides Left humerus');c.assert(hidden(0),'day 0 hides it');c.assert(!hidden(401),'day 401 shows it');c.assert(!hidden(-1),'day -1 shows it (reverse scrub)');
	}},
	{name:'bones: fracture window, status and acute pacing follow the fracture model',run(c){
		const f=script(FRACTURE),cal=script('healing-humerus-callus-2009'),healed=fromDays(toDays(FRACTURE_DATE)+HEALED_DAY);
		c.assert(f.onset==='2009-09-02'&&f.resolve===healed&&!!f.layer&&!f.chronic,'fracture window + layer');
		c.assert(cal.onset==='2009-09-25'&&cal.resolve===healed&&cal.fxAt(10,{body:bodyAt('2009-10-05'),date:'2009-10-05'}).length===0,'callus window, no fx');
		c.assert(cal.status?.(0)==='Callus on the day-23 film','callus status');
		c.assert(f.status?.(0.5)?.startsWith('Fracture')===true&&f.status?.(12)?.startsWith('Soft callus')===true&&f.status?.(30)?.startsWith('Hard callus')===true&&f.status?.(200)?.startsWith('Remodeling')===true,'status follows the phase');
		c.assert(f.status?.(-1)===null&&f.status?.(HEALED_DAY)===null,'no status outside the fracture');
		c.assert(JSON.stringify(f.acute)===JSON.stringify(TIMELINE_DENSITY.map(r=>({from:toDays(r.from)-toDays(FRACTURE_DATE),to:toDays(r.to)-toDays(FRACTURE_DATE),k:r.k}))),'acute = TIMELINE_DENSITY relative to onset');
		c.assert(f.acute![0].from===-7&&f.acute![0].to===90,'acute starts a week before the break');
	}},
	{name:'bones: fracture layer builds, snaps and flies once on a forward crossing only',async run(c){
		const {ctx,flies,scene,segments}=await fakeContext(c),layer=script(FRACTURE).layer!();
		c.assert(layer.init(ctx),'init');c.assert(segments.length>0&&segments.every(s=>s==='lUpperArm'),'every material rides the left upper arm');
		const box=layer.box();c.assert(!!box&&!box.isEmpty()&&box.containsPoint(new T.Vector3(.1904,1.261,-.0244)),'box frames the humerus');
		const step=(date:string,dir:-1|0|1,now:number,o?:{skeletal?:boolean;hidden?:boolean})=>layer.update(toDays(date)-toDays(FRACTURE_DATE),frame(date,dir,now,o));
		step('2009-08-30',0,0);c.assert(shown(scene)===0,'nothing drawn before the break');
		const cross=step('2009-09-02',1,100);c.assert(flies.length===1,`one fly on the forward crossing (${flies.length})`);c.assert(cross.animating,'snap animating');
		step('2009-09-02',1,200);c.assert(flies.length===1,'no second fly while paused on the same day');
		c.assert(shown(scene)>0,'fragments drawn while the snap is pending (the humerus is hidden by fx)');
		c.assert(!step('2009-09-02',1,100+380+700+10).animating,'snap finished');
		step('2009-09-20',1,3000);c.assert(shown(scene)>0,'fragments drawn at day 18');
		step('2009-09-20',1,3100,{skeletal:false});c.assert(shown(scene)===0,'skeleton switched off hides the layer');
		step('2009-09-20',1,3200,{hidden:true});c.assert(shown(scene)===0,'isolating another issue hides the layer');
		step('2009-08-30',-1,4000);c.assert(shown(scene)===0,'reverse scrub before the break: nothing drawn');
		step('2009-09-05',1,5000);c.assert(flies.length===2,'a new forward crossing flies again');
		step('2009-08-20',-1,6000);step('2009-09-05',-1,7000);c.assert(flies.length===2,'a crossing with direction -1 does not fly');
		step('2010-10-08',1,8000);c.assert(shown(scene)===0,'nothing drawn once healed');
		let meshes=0;scene.traverse(o=>{if((o as T.Mesh).isMesh){meshes++;c.assert(!(o as T.Mesh).frustumCulled,'custom meshes are not frustum-culled (the warp moves them)');}});c.assert(meshes>=6,`fragments, caps, callus, clots (${meshes})`);
		layer.dispose();c.assert(scene.children.length===0,'dispose removes the layer');
	}},
	{name:'bones: through the real engine, the fracture pose runs after the hoisted begin_vertex and before the fx/warp block',async run(c){
		const g=await c.geometry(),{atlas}=g,scene=new T.Scene();
		const bounds=atlas.parts.map(p=>new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1])));
		const segments=new ArrayBuffer(atlas.parts.reduce((s,p)=>s+p.vertexCount*SEG_STRIDE,0));
		const engine=createEngine({atlas,scene,bounds,rig:rigJson as Rig,segments});
		// Only the humerus needs a picker: the engine's restGeometry reads it.
		const pickers:(T.Mesh|undefined)[]=[];g.indicesOf(FRACTURE_PART).forEach(i=>{const p=g.parts[i],geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(p.position.slice(),3));geo.setAttribute('normal',new T.BufferAttribute(p.normal,3));geo.setIndex(new T.BufferAttribute(p.index,1));pickers[i]=new T.Mesh(geo);});
		engine.ready(pickers);
		const root=scene.getObjectByName('fracture');c.assert(!!root,'the engine built the fracture layer');
		const mats=new Set<T.Material>();root!.traverse(o=>{if((o as T.Mesh).isMesh)mats.add((o as T.Mesh).material as T.Material);});c.assert(mats.size>=7,`materials (${mats.size})`);
		let posed=0;
		for(const m of mats){
			const sh={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{} as Record<string,{value:unknown}>};
			m.onBeforeCompile(sh as unknown as Parameters<T.Material['onBeforeCompile']>[0],undefined as unknown as T.WebGLRenderer);
			const v=sh.vertexShader,bn=v.indexOf('#include <beginnormal_vertex>'),bv=v.indexOf('#include <begin_vertex>'),block=v.indexOf('{',bv);
			c.assert(bn>=0&&bv>bn&&v.indexOf('#include <begin_vertex>',bv+1)<0,'begin_vertex hoisted once, after beginnormal_vertex');
			c.assert(m.customProgramCacheKey().includes('timeline:'),'engine cache key kept');
			const pose=v.indexOf('uPose * vec4(transformed');if(pose<0)continue;posed++;
			c.assert(pose>bv&&pose<block,'uPose line sits between begin_vertex and the fx/warp block');
			c.assert('uPose' in sh.uniforms&&'twSoft' in sh.uniforms,'both the pose and the engine uniforms are bound');
		}
		c.assert(posed===6,`fragments, caps and clots are posed in the shader (${posed})`);
		engine.dispose();
	}},
	{name:'bones: scoliosis parts are T1–T6, their disks and ribs 1–6 on each side',run(c){
		const p=new Set(script(SCOLIOSIS).parts);SCOLIOSIS_LEVELS.forEach(l=>{c.assert(p.has(l.vertebra)&&p.has(l.disk),`${l.vertebra} + disk`);});SCOLIOSIS_RIBS.forEach(r=>{c.assert(p.has(r.left)&&p.has(r.right),r.left);});
		c.assert(p.size===SCOLIOSIS_LEVELS.length*2+SCOLIOSIS_RIBS.length*2&&p.size===24,'24 parts');c.assert(script(SCOLIOSIS).chronic===true,'chronic');
	}},
	{name:'bones: scoliosis rest levels match the atlas (bounds centres, 1 mm)',async run(c){
		const {atlas}=await c.geometry(),centre=(n:string)=>{const p=atlas.parts.find(q=>q.name===n);c.assert(!!p,`atlas has ${n}`);return [0,1,2].map(k=>(p!.bounds[0][k]+p!.bounds[1][k])/2);};
		SCOLIOSIS_LEVELS.forEach(l=>{c.near(centre(l.vertebra)[0],l.x,.001,`${l.vertebra} x`);c.near(centre(l.vertebra)[1],l.y,.001,`${l.vertebra} y`);c.near(centre(l.vertebra)[2],l.z,.001,`${l.vertebra} z`);c.near(centre(l.disk)[1],l.diskY,.001,`${l.disk} y`);});
	}},
	{name:'bones: scoliosis at today peaks at T3/T4 and stays within 1.2 cm',run(c){
		const d=toDays(TODAY)-toDays(script(SCOLIOSIS).onset),fx=at(SCOLIOSIS,d,TODAY),off=(n:string)=>Math.abs(fxOf(fx,n)?.translate?.[0]??0);
		const [t1,,t3,t4,,t6]=SCOLIOSIS_LEVELS.map(l=>off(l.vertebra)),apex=Math.max(t3,t4);
		c.assert(apex>0,'the apex moves');c.assert(apex>=t1&&apex>=t6,`apex ${apex} ≥ T1 ${t1}, T6 ${t6}`);c.assert(fx.every(f=>Math.hypot(...(f.translate??[0,0,0]))<=.012),'|offset| ≤ 1.2 cm');
		c.assert(fx.every(f=>(f.translate?.[0]??0)>=0),'convex to the left (+x), the proximal thoracic side');
		SCOLIOSIS_RIBS.forEach((r,i)=>{const v=fxOf(fx,SCOLIOSIS_LEVELS[i].vertebra)?.translate?.[0];c.assert(fxOf(fx,r.left)?.translate?.[0]===v&&fxOf(fx,r.right)?.translate?.[0]===v,`${r.left} follows its vertebra`);});
		c.assert(fxOf(fx,SCOLIOSIS_LEVELS[2].vertebra)?.rotate!==undefined,'vertebrae rotate');
	}},
	{name:'bones: adjacent vertebra translates differ by < 4 mm (no shearing apart)',run(c){
		const s=script(SCOLIOSIS);for(let d=-(LEAD_DAYS[SCOLIOSIS]+10);d<=500;d+=37){
			const fx=s.fxAt(d,{body:bodyAt(dateAt(SCOLIOSIS,d)),date:dateAt(SCOLIOSIS,d)}),x=(n:string)=>fxOf(fx,n)?.translate?.[0]??0;
			const chain=SCOLIOSIS_LEVELS.flatMap(l=>[x(l.vertebra),x(l.disk)]);for(let i=1;i<chain.length;i++)c.assert(Math.abs(chain[i]-chain[i-1])<.004,`day ${d}: step ${i}`);
		}
	}},
	{name:'bones: scoliosis develops from 2020 to the record and then holds',run(c){
		const s=script(SCOLIOSIS),apex=(date:string)=>Math.abs(fxOf(s.fxAt(toDays(date)-toDays(s.onset),{body:bodyAt(date),date}),SCOLIOSIS_LEVELS[3].vertebra)?.translate?.[0]??0);
		c.assert(apex('2019-12-01')===0,'none before 2020');c.assert(apex('2022-06-01')>0&&apex('2022-06-01')<apex('2025-07-08'),'partial in 2022');c.near(apex('2025-07-08'),apex(TODAY),1e-9,'holds after the record');
	}},
];
