import type {Check} from './harness';
import type {PartFx} from '../types';
import {SCRIPTS as AREA} from '../issues/catalog/systemic';
import {ARTERIAL_PARTS} from '../issues/systemic/arterial-parts';
import {bodyAt} from '../growth/proportions';
import {toDays,fromDays} from '../../health/dates';
import atlas from '../../../../public/anyhealth/models/atlas.json';

const script=(id:string)=>AREA.find(s=>s.id===id)!;
const at=(id:string,d:number,date='2016-01-01')=>script(id).fxAt(d,{body:bodyAt(date),date});
/** fxAt on a calendar date (day derived from the script's onset), as the engine calls it. */
const onDate=(id:string,date:string)=>{const s=script(id);return s.fxAt(toDays(date)-toDays(s.onset),{body:bodyAt(date),date});};
const find=(fx:PartFx[],part:string)=>fx.find(f=>f.part===part);
const identity=(f:PartFx)=>(f.swell??0)===0&&(f.tint?.[3]??0)===0&&(f.scale??[1,1,1]).every(v=>v===1)&&(f.visible??1)===1&&!f.translate&&!f.rotate;

/** Sample step at `d`: one hour of timeline display time, i.e. one real hour divided by the acute stretch `k` covering `d` (1 outside any acute range). */
const stepAt=(id:string,d:number)=>{const k=script(id).acute?.find(a=>d>=a.from&&d<a.to)?.k??1;return 1/24/k;};

export const checks:Check[]=[
	{name:'systemic: no effect before onset',run(c){AREA.forEach(s=>c.assert(s.fxAt(-1,{body:bodyAt(s.onset),date:fromDays(toDays(s.onset)-1)}).every(identity),`${s.id} before onset`));}},
	{name:'systemic: resolved non-chronic issues return to baseline',run(c){AREA.filter(s=>!s.chronic&&!s.layer).forEach(s=>{const d=toDays(s.resolve!)-toDays(s.onset)+60,date=fromDays(toDays(s.resolve!)+60);c.assert(s.fxAt(d,{body:bodyAt(date),date}).every(f=>(f.swell??0)===0&&(f.tint?.[3]??0)===0),`${s.id} after resolve`);});}},
	{name:'systemic: effects ramp (no step > 25% of peak between adjacent hours in the first 3 days)',run(c){
		for(const s of AREA){
			// Samples d = 0..3 one display-hour apart (see stepAt): per part and per channel, the largest change between neighbours vs that channel's peak.
			const sw=new Map<string,number[]>(),ta=new Map<string,number[]>(),sc=new Map<string,number[]>();
			const push=(m:Map<string,number[]>,k:string,v:number,n:number)=>{const l=m.get(k)??Array(n).fill(0);l.push(v);m.set(k,l);};
			let n=0;
			for(let d=0;d<=3;d+=stepAt(s.id,d)){
				const date=fromDays(toDays(s.onset)+Math.floor(d)),fx=s.fxAt(d,{body:bodyAt(date),date});const seen=new Set<string>();
				for(const f of fx){const k=f.part;seen.add(k);push(sw,k,f.swell??0,n);push(ta,k,f.tint?.[3]??0,n);push(sc,k,Math.max(...(f.scale??[1,1,1]).map(v=>Math.abs(v-1))),n);}
				for(const m of [sw,ta,sc])for(const [k,l] of m)if(!seen.has(k))l.push(0);
				n++;
			}
			for(const [label,m] of [['swell',sw],['tint',ta],['scale',sc]] as const)for(const [part,l] of m){
				const peak=Math.max(...l.map(Math.abs));if(peak===0)continue;
				let maxStep=0;for(let i=1;i<l.length;i++)maxStep=Math.max(maxStep,Math.abs(l[i]-l[i-1]));
				c.assert(maxStep<=0.25*peak+1e-12,`${s.id} ${label} on ${part}: step ${maxStep.toExponential(2)} > 25% of peak ${peak.toExponential(2)}`);
			}
		}
	}},
	{name:'systemic: every script is illustrative',run(c){AREA.forEach(s=>c.assert(s.illustrative===true,`${s.id} illustrative`));}},
	{name:'systemic: every part named in scripts and effects exists in the atlas',run(c){
		const names=new Set((atlas as {parts:{name:string}[]}).parts.map(p=>p.name));
		ARTERIAL_PARTS.forEach(p=>c.assert(names.has(p),`arterial list: no part "${p}"`));
		c.assert(ARTERIAL_PARTS.length===new Set((atlas as {parts:{name:string;system:string}[]}).parts.filter(p=>p.system==='arterial').map(p=>p.name)).size,'arterial list matches the atlas');
		for(const s of AREA){s.parts.forEach(p=>c.assert(names.has(p),`${s.id}: no part "${p}"`));for(const d of [0.1,1,5,20])at(s.id,d,s.onset).forEach(f=>c.assert(names.has(f.part),`${s.id} fx: no part "${f.part}"`));}
	}},
	{name:'systemic: (a) anaphylaxis tongue scale at day 0.1 > at day 1.5, and = 1 at day 2.5',run(c){
		const sx=(d:number)=>(find(at('egg-anaphylaxis-daycare',d,'2005-05-02'),'Tongue')?.scale??[1,1,1])[0];
		c.assert(sx(0.1)>sx(1.5),`tongue ${sx(0.1)} vs ${sx(1.5)}`);c.assert(sx(0.1)>1.1,`tongue peak ${sx(0.1)}`);c.near(sx(2.5),1,0,'tongue back to 1 at day 2.5');
		const lip=find(at('egg-anaphylaxis-daycare',0.1,'2005-05-02'),'Lip')?.scale?.[0]??1;c.near(lip,1.2,0.01,'lip peak');
		const tr=find(at('egg-anaphylaxis-daycare',0.1,'2005-05-02'),'Trachea');c.near(tr?.swell??0,-0.0015,1e-5,'trachea narrowing');c.assert(!!tr?.swellBand,'trachea narrowing is banded');
		const w=find(at('walnut-accidental-exposure-2026',0.03,'2026-03-01'),'Tongue')?.scale?.[0]??1,e=find(at('egg-anaphylaxis-daycare',0.03,'2005-05-02'),'Tongue')?.scale?.[0]??1;
		c.assert(w>1&&w<e,`walnut milder than egg (${w} vs ${e})`);c.assert(at('walnut-accidental-exposure-2026',1.01,'2026-03-02').every(identity),'walnut resolved by day 1');
	}},
	{name:'systemic: (b) the arterial tint is present on 2010-01-01 and absent on 2004-06-30',run(c){
		const id='microcytosis-suspected-thalassemia-2004';
		const on=onDate(id,'2010-01-01');ARTERIAL_PARTS.forEach(p=>c.assert((find(on,p)?.tint?.[3]??0)>0,`2010 tint on ${p}`));
		const t=find(on,'Arch of aorta')!.tint!;c.near(t[0],0.86,1e-9,'r');c.near(t[1],0.52,1e-9,'g');c.near(t[2],0.40,1e-9,'b');c.near(t[3],0.18,1e-9,'amount');
		c.assert(onDate(id,'2004-06-30').every(identity),'absent before 2004-07-01');
		c.assert((find(onDate(id,'2025-01-01'),'Arch of aorta')?.tint?.[3]??0)>0.18,'steps up after 2024-05-20 confirmation');
	}},
	{name:'systemic: (c) rhinitis pulse amplitude in 2025 < in 2021',run(c){
		const amp=(y:number)=>{let lo=Infinity,hi=-Infinity;for(let d=toDays(`${y}-01-01`);d<toDays(`${y+1}-01-01`);d++){const v=find(onDate('allergic-rhinitis-oral-allergy-syndrome-2016',fromDays(d)),'Left inferior nasal concha')?.swell??0;lo=Math.min(lo,v);hi=Math.max(hi,v);}return hi-lo;};
		const a21=amp(2021),a25=amp(2025);c.assert(a21>0.0005,`2021 pulse ${a21}`);c.assert(a25<a21,`2025 ${a25} < 2021 ${a21}`);
	}},
	{name:'systemic: seasonal pulses are a pure function of the date',run(c){
		const id='allergic-rhinitis-oral-allergy-syndrome-2016',sw=(date:string)=>find(onDate(id,date),'Right inferior nasal concha')?.swell??0;
		c.assert(sw('2019-04-30')>sw('2019-01-15'),'spring peak above winter');c.assert(sw('2019-08-28')>sw('2019-01-15'),'fall peak above winter');
		c.near(sw('2019-04-30'),sw('2019-04-30'),0,'repeatable');
	}},
	{name:'systemic: CBC windows tint the heart and aorta more strongly than the chronic tint, then fade',run(c){
		for(const id of ['first-abnormal-cbc-2023','hematology-eval-2024','beta-thalassemia-minor-confirmed-2024','function-health-cbc-thalassemia-signature-2026','function-health-out-of-range-2026']){
			const s=script(id),mid=at(id,15,s.onset);c.assert((find(mid,'Wall of ventricle')?.tint?.[3]??0)>0.22,`${id} heart tint`);c.assert((find(mid,'Ascending aorta')?.tint?.[3]??0)>0.22,`${id} aorta tint`);
			c.assert(toDays(s.resolve!)-toDays(s.onset)===30,`${id} is a 30-day window`);c.assert(at(id,30,s.resolve!).every(identity),`${id} faded at day 30`);
		}
	}},
];
