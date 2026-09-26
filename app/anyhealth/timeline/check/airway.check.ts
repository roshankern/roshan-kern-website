import type {Check} from './harness';
import type {PartFx} from '../types';
import {SCRIPTS as AREA,LEAD_DAYS} from '../issues/catalog/airway';
import {bodyAt} from '../growth/proportions';
import {toDays,fromDays} from '../../health/dates';
import {mergeFx,applyFxPoint} from '../fx/part-fx';
import {CROUP_EPISODES} from '../issues/airway/croup';
import {BRONCHIAL_TREES,CRICOID_MIN_Y,SUBGLOTTIC_BAND,SEGMENTAL_TREES} from '../issues/airway/parts';
import atlas from '../../../../public/anyhealth/models/atlas.json';

const at=(id:string,d:number,date='2016-01-01')=>AREA.find(s=>s.id===id)!.fxAt(d,{body:bodyAt(date),date});
/** fx of script `id` on an absolute date (fractional day offsets allowed). */
const onDate=(id:string,date:string,frac=0)=>{const s=AREA.find(x=>x.id===id)!;return s.fxAt(toDays(date)-toDays(s.onset)+frac,{body:bodyAt(date),date});};
const swellOf=(fx:PartFx[],part:string)=>fx.filter(f=>f.part===part).reduce((a,f)=>a+(f.swell??0),0);
const tintOf=(fx:PartFx[],part:string)=>Math.max(0,...fx.filter(f=>f.part===part).map(f=>f.tint?.[3]??0));
const identity=(f:PartFx)=>(f.swell??0)===0&&(f.tint?.[3]??0)===0&&(f.scale??[1,1,1]).every(v=>v===1)&&(f.visible??1)===1&&!f.translate&&!f.rotate;
const atlasParts=(atlas as {parts:{name:string;system:string;bounds:number[][]}[]}).parts;

export const checks:Check[]=[
	// Shared area checks.
	{name:'airway: no effect before onset',run(c){AREA.forEach(s=>{const d=-((LEAD_DAYS[s.id]??0)+1);c.assert(s.fxAt(d,{body:bodyAt(s.onset),date:s.onset}).every(identity),`${s.id} before onset`);});}},
	{name:'airway: resolved non-chronic issues return to baseline',run(c){AREA.filter(s=>!s.chronic&&!s.layer).forEach(s=>{const d=toDays(s.resolve!)-toDays(s.onset)+60;c.assert(s.fxAt(d,{body:bodyAt(s.resolve!),date:s.resolve!}).every(f=>(f.swell??0)===0&&(f.tint?.[3]??0)===0),`${s.id} after resolve`);});}},
	{name:'airway: effects ramp (no step > 25% of peak between adjacent hours in the first 3 days)',run(c){
		for(const s of AREA){
			const ctx={body:bodyAt(s.onset),date:s.onset};
			// Per part, per channel: the series over d = 0..3 in 1 h steps.
			const series=new Map<string,{swell:number[];tint:number[];scale:number[]}>();
			for(let h=0;h<=72;h++){
				const fx=s.fxAt(h/24,ctx),seen=new Set<string>();
				for(const f of fx){
					let r=series.get(f.part);if(!r){r={swell:Array(73).fill(0),tint:Array(73).fill(0),scale:Array(73).fill(0)};series.set(f.part,r);}
					if(!seen.has(f.part)){seen.add(f.part);r.swell[h]=0;r.tint[h]=0;r.scale[h]=0;}
					r.swell[h]+=f.swell??0;r.tint[h]=Math.max(r.tint[h],f.tint?.[3]??0);r.scale[h]=Math.max(r.scale[h],...(f.scale??[1,1,1]).map(v=>Math.abs(v-1)));
				}
			}
			for(const [part,r] of series)for(const [ch,v] of Object.entries(r)){
				const peak=Math.max(...v.map(Math.abs));if(peak===0)continue;
				let worst=0;for(let h=1;h<v.length;h++)worst=Math.max(worst,Math.abs(v[h]-v[h-1]));
				c.assert(worst<=0.25*peak,`${s.id} ${part} ${ch}: step ${worst.toExponential(2)} > 25% of peak ${peak.toExponential(2)}`);
			}
		}
	}},
	// Area checks.
	{name:'airway: hardcoded part lists and landmarks match the atlas',run(c){
		const want=[...new Set(atlasParts.filter(p=>p.system==='respiratory'&&/bronch/i.test(p.name)).map(p=>p.name))].sort();
		c.assert(JSON.stringify(want)===JSON.stringify([...BRONCHIAL_TREES].sort()),'BRONCHIAL_TREES drifted from atlas.json');
		c.assert(SEGMENTAL_TREES.length===20,'20 segmental trees');
		const cricoid=Math.min(...atlasParts.filter(p=>p.name==='Cricoid cartilage').map(p=>p.bounds[0][1]));
		c.near(CRICOID_MIN_Y,cricoid,1e-7,'cricoid lower edge');c.near(SUBGLOTTIC_BAND[1]-SUBGLOTTIC_BAND[0],0.02,1e-9,'band is 2 cm');
	}},
	{name:'airway: (a) PICU peak narrowing > every other croup episode',run(c){
		const peak=(e:typeof CROUP_EPISODES[number])=>{let m=0;for(let h=-24;h<=e.len*24;h++)m=Math.min(m,swellOf(onDate(e.owner,e.date,h/24),'Trachea'));return -m;};
		const picu=CROUP_EPISODES.filter(e=>e.owner==='chco-picu-subglottitis-2016');c.assert(picu.length===1,'one PICU episode');
		const p=peak(picu[0]);c.assert(p>0,'PICU narrows');
		const others=CROUP_EPISODES.filter(e=>e!==picu[0]);c.assert(others.length>=30,`episode list covers ~3/winter (${others.length})`);
		others.forEach(e=>{const o=peak(e);c.assert(o>0,`${e.date} episode shows`);c.assert(p>o,`PICU ${p} vs ${e.date} ${o}`);});
		const docs=['2003-09-08','2004-01-15','2016-11-02'];docs.forEach(d=>c.assert(CROUP_EPISODES.some(e=>e.date===d),`documented episode ${d}`));
	}},
	{name:'airway: (b) subglottic swell only affects the Trachea within the band',async run(c){
		const g=await c.geometry(),fx=onDate('chco-picu-subglottitis-2016','2016-11-02');
		const tr=fx.filter(f=>f.part==='Trachea');c.assert(tr.length>0&&tr.every(f=>f.swellBand&&f.swellBand[0]===SUBGLOTTIC_BAND[0]&&f.swellBand[1]===SUBGLOTTIC_BAND[1]),'Trachea swell carries the subglottic band');
		const idx=g.indicesOf('Trachea');const merged=mergeFx(fx,n=>g.indicesOf(n),()=>[0,0,0]);const r=merged.get(idx[0])!;c.assert(r.swell<0,'PICU swell is negative');
		const {position:pos,normal:nor}=g.parts[idx[0]];let tested=0;
		for(let v=0;v<pos.length/3;v++){
			const y=pos[v*3+1];if(y>SUBGLOTTIC_BAND[0]-0.05)continue;
			const p:[number,number,number]=[pos[v*3],y,pos[v*3+2]],n:[number,number,number]=[nor[v*3]/127,nor[v*3+1]/127,nor[v*3+2]/127],out:[number,number,number]=[0,0,0];
			applyFxPoint(r,p,n,out);c.near(Math.hypot(out[0]-p[0],out[1]-p[1],out[2]-p[2]),0,1e-9,`Trachea vertex at y=${y.toFixed(4)} moved`);tested++;
		}
		c.assert(tested>0,'found Trachea vertices 5 cm below the band');
		// Task 14 (applyFxPoint is real now): inside the band every vertex moves by the full swell along its normal.
		let inside=0;for(let v=0;v<pos.length/3;v++){const y=pos[v*3+1];if(y<SUBGLOTTIC_BAND[0]||y>SUBGLOTTIC_BAND[1])continue;const p:[number,number,number]=[pos[v*3],y,pos[v*3+2]],n:[number,number,number]=[nor[v*3]/127,nor[v*3+1]/127,nor[v*3+2]/127],out:[number,number,number]=[0,0,0];
			applyFxPoint(r,p,n,out);c.near(Math.hypot(out[0]-p[0],out[1]-p[1],out[2]-p[2]),-r.swell,1e-9,`in-band Trachea vertex at y=${y.toFixed(4)}`);inside++;}
		c.assert(inside>0,'found Trachea vertices inside the band');
		c.assert(fx.filter(f=>f.swell).every(f=>f.part==='Trachea'),'only the Trachea swells');
	}},
	{name:'airway: (c) asthma baseline present on 2019-01-01 and stronger on 2016-12-25',run(c){
		const quiet=onDate('asthma-diagnosis-chronic','2019-01-01'),flare=onDate('asthma-diagnosis-chronic','2016-12-25');
		BRONCHIAL_TREES.forEach(p=>{
			c.near(swellOf(quiet,p),-0.3e-3,1e-9,`${p} baseline 2019`);c.assert(tintOf(quiet,p)>0,`${p} baseline tint`);
			c.assert(swellOf(flare,p)<swellOf(quiet,p),`${p} flare stronger`);c.assert(tintOf(flare,p)>tintOf(quiet,p),`${p} flare tint stronger`);
		});
		c.near(Math.min(...Array.from({length:240},(_,h)=>swellOf(onDate('asthma-diagnosis-chronic','2022-08-01',h/24),'Left main bronchus'))),-0.8e-3,2e-5,'flare peaks at −0.8 mm');
		c.near(swellOf(onDate('asthma-diagnosis-chronic','2022-08-20'),'Left main bronchus'),-0.3e-3,1e-9,'back to baseline after the 10-day flare');
		const onIcs=swellOf(onDate('asthma-diagnosis-chronic','2026-09-14'),'Left main bronchus');c.assert(onIcs>-0.3e-3&&onIcs<0,`budesonide eases the baseline (${onIcs})`);
	}},
	{name:'airway: asthma, COVID and flares combine by the merge rules',run(c){
		const date='2020-08-29',fx=['asthma-diagnosis-chronic','covid-19-infection-2020'].flatMap(id=>onDate(id,date));
		const covidParts=onDate('covid-19-infection-2020',date).filter(f=>(f.tint?.[3]??0)>0).map(f=>f.part);
		c.assert(covidParts.length===8&&covidParts.every(p=>SEGMENTAL_TREES.includes(p)),`COVID patches 40% of the 20 segmental trees (${covidParts.length})`);
		const names=[...new Set(fx.map(f=>f.part))],idx=new Map(names.map((n,i)=>[n,[i]]));const merged=mergeFx(fx,n=>idx.get(n)??[],()=>[0,0,0]);
		covidParts.forEach(p=>{const r=merged.get(idx.get(p)![0])!;c.near(r.swell,swellOf(fx,p),1e-12,`${p} swell adds`);c.near(r.tint[3],tintOf(fx,p),1e-12,`${p} tint max`);});
		c.assert(AREA.find(s=>s.id==='covid-19-infection-2020')!.illustrative===true,'COVID is illustrative');
		c.assert(tintOf(onDate('covid-19-infection-2020',fromDays(toDays('2020-08-28')+15)),covidParts[0])===0,'COVID gone after 14 days');
	}},
	{name:'airway: laryngomalacia curls the epiglottis, peaks at 2–4 months, gone by 15 months',run(c){
		const age=(m:number)=>fromDays(toDays('2003-06-22')+Math.round(m*30.44));
		const ep=(m:number)=>onDate('infant-laryngomalacia-2003',age(m)).find(f=>f.part==='Epiglottis');
		const p3=ep(3)!;c.assert(p3&&p3.scale![0]===0.85&&p3.scale![1]===1&&p3.scale![2]===1.1,'peak scale [0.85,1,1.1]');c.assert(!!p3.rotate&&p3.rotate[0]<0,'posterior tilt');
		const p8=ep(8)!;c.assert(p8.scale![0]>0.85&&p8.scale![0]<1,'easing by 8 months');c.assert(!ep(15.5),'resolved by 15 months');
	}},
	{name:'airway: bronchoscopy is a one-day highlight on the epiglottis, trachea and main bronchi',run(c){
		const fx=at('microlaryngoscopy-bronchoscopy-2016',0);['Epiglottis','Trachea','Left main bronchus','Right main bronchus proper'].forEach(p=>c.assert(tintOf(fx,p)>0,`${p} highlighted`));
		c.assert(at('microlaryngoscopy-bronchoscopy-2016',1).length===0,'gone the next day');c.assert(fx.every(f=>!f.swell),'no swell');
	}},
];
