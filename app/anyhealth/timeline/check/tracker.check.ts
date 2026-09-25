import type {Check} from './harness';
import type {IssueScript} from '../types';
import {trackerEntries,entriesFrom} from '../tracker/tracker-model';
import {pacing,pacingFrom} from '../issues/pacing';
import {scriptFor} from '../issues';
import {makeWarp,type Density} from '../../health/warp';
import {toDays,fromDays} from '../../health/dates';
import {BIRTH_DATE} from '../../health/types';
const T0='2026-09-25';
// Quiet share of the birth..today track under a density list (days outside every range, weighted by the warp).
const quietShare=(dens:Density[],today:string)=>{const min=toDays(BIRTH_DATE),max=toDays(today),w=makeWarp(min,max,dens);let quiet=0;for(let d=min;d<max;d++){const inDense=dens.some(r=>d>=toDays(r.from)&&d<toDays(r.to));if(!inDense)quiet+=w.toT(d+1)-w.toT(d);}return quiet;};
// Synthetic scripts, so the model's rules are checked independently of what the area catalogs hold.
const fake=(id:string,onset:string,o:Partial<IssueScript>={}):IssueScript=>({id,parts:['Left humerus'],onset,fxAt:()=>[],...o});
export const checks:Check[]=[
	{name:'fracture is active on 2009-09-10 and gone by 2011',run(c){c.assert(trackerEntries('2009-09-10',T0,null).some(e=>e.issue.id==='left-humerus-fracture-2009'&&e.state==='active'),'active');c.assert(!trackerEntries('2011-01-01',T0,null).some(e=>e.issue.id==='left-humerus-fracture-2009'),'gone');}},
	{name:'resolved issues linger 7 days with state resolved',run(c){const s=scriptFor('chco-picu-subglottitis-2016')!;const d=fromDays(toDays(s.resolve!)+3);c.assert(trackerEntries(d,T0,null).find(e=>e.issue.id===s.id)?.state==='resolved','resolved chip');c.assert(!trackerEntries(fromDays(toDays(s.resolve!)+8),T0,null).some(e=>e.issue.id===s.id),'faded');}},
	{name:'chronic issues stay through today',run(c){c.assert(trackerEntries(T0,T0,null).some(e=>e.issue.id==='asthma-diagnosis-chronic'),'asthma');}},
	{name:'isolated issue stays pinned first when inactive',run(c){const e=trackerEntries('2020-01-01',T0,'left-humerus-fracture-2009');c.assert(e[0]?.issue.id==='left-humerus-fracture-2009'&&e[0].state==='isolated-inactive','pinned');}},
	{name:'entries are newest onset first',run(c){const e=trackerEntries('2016-12-23',T0,null).filter(x=>x.state!=='isolated-inactive');for(let i=1;i<e.length;i++)c.assert(e[i-1].script.onset>=e[i].script.onset,'order');}},
	{name:'pacing keeps quiet time >= 40% of the track',run(c){const min=toDays('2003-06-22'),max=toDays(T0),w=makeWarp(min,max,pacing(T0));const dens=pacing(T0);let quiet=0;for(let d=min;d<max;d++){const inDense=dens.some(r=>d>=toDays(r.from)&&d<toDays(r.to));if(!inDense)quiet+=w.toT(d+1)-w.toT(d);}c.assert(quiet>=0.4,`quiet ${quiet}`);}},
	{name:'pacing ranges are sorted and non-overlapping',run(c){const d=pacing(T0);for(let i=1;i<d.length;i++)c.assert(d[i-1].to<=d[i].from,'overlap');}},
	// Model rules on synthetic scripts (these hold whatever the catalogs say).
	{name:'model: window is onset..resolve+7 inclusive, chronic runs to today, day counts from onset',run(c){
		const S=[fake('a','2010-01-01',{resolve:'2010-01-10'}),fake('b','2010-01-05',{chronic:true})];
		const at=(d:string)=>entriesFrom(S,d,T0,null);
		c.assert(!at('2009-12-31').length,'before onset');
		c.assert(at('2010-01-01')[0]?.state==='active'&&at('2010-01-01')[0].day===0,'onset day 0');
		c.assert(at('2010-01-10').find(e=>e.script.id==='a')?.state==='active','active on resolve day');
		c.assert(at('2010-01-17').find(e=>e.script.id==='a')?.state==='resolved','resolved on resolve+7');
		c.assert(!at('2010-01-18').some(e=>e.script.id==='a'),'gone on resolve+8');
		c.assert(at(T0).find(e=>e.script.id==='b')?.state==='active','chronic active today');
		c.assert(at('2010-01-07')[0].script.id==='b','newest onset first');
		c.assert(at('2010-01-07').find(e=>e.script.id==='b')?.day===2,'day');
	}},
	{name:'model: an active isolated issue is first and keeps its state',run(c){
		const S=[fake('a','2010-01-01',{resolve:'2010-02-01'}),fake('b','2010-01-05',{resolve:'2010-02-01'})];
		const e=entriesFrom(S,'2010-01-07',T0,'a');c.assert(e[0].script.id==='a'&&e[0].state==='active'&&e.length===2,'isolated active first');
		const f=entriesFrom(S,'2011-01-01',T0,'a');c.assert(f.length===1&&f[0].state==='isolated-inactive','inactive pinned alone');
		c.assert(entriesFrom(S,'2011-01-01',T0,'nope').length===0,'unknown isolate id ignored');
	}},
	{name:'pacing: overlapping acute ranges merge with the max k',run(c){
		const S=[fake('a','2010-01-01',{resolve:'2010-02-01',acute:[{from:0,to:10,k:4}]}),fake('b','2010-01-05',{resolve:'2010-02-01',acute:[{from:0,to:20,k:6}]}),fake('c','2012-01-01',{resolve:'2012-02-01',acute:[{from:-2,to:3,k:3}]})];
		const d=pacingFrom(S,T0);c.assert(d.length===2,`ranges ${JSON.stringify(d)}`);
		c.assert(d[0].from==='2010-01-01'&&d[0].to==='2010-01-25'&&d[0].k===6,`merged ${JSON.stringify(d[0])}`);
		c.assert(d[1].from==='2011-12-30'&&d[1].to==='2012-01-04'&&d[1].k===3,`second ${JSON.stringify(d[1])}`);
	}},
	{name:'pacing: heavy stretch is scaled down to exactly the 40% quiet floor',run(c){
		// 20 one-year-apart acute weeks at k=400 would leave almost no quiet time.
		const S=Array.from({length:20},(_,i)=>fake(`x${i}`,`${2004+i}-03-01`,{resolve:`${2004+i}-04-01`,acute:[{from:0,to:7,k:400}]}));
		const d=pacingFrom(S,T0),q=quietShare(d,T0);
		c.assert(d.every(r=>r.k>1&&r.k<400),`scaled k ${d[0]?.k}`);c.assert(q>=0.4&&q<0.41,`quiet ${q}`);
		const light=pacingFrom(S.slice(0,1).map(s=>({...s,acute:[{from:0,to:7,k:3}]})),T0);c.assert(light[0].k===3,'light stretch untouched');
	}},
	{name:'pacing: ranges are clipped to birth..today and memoised per today',run(c){
		const S=[fake('a','2026-09-20',{chronic:true,acute:[{from:0,to:30,k:5}]}),fake('b','2003-06-22',{resolve:'2003-07-01',acute:[{from:-10,to:5,k:2}]})];
		const d=pacingFrom(S,T0);c.assert(d[0].from===BIRTH_DATE&&d[d.length-1].to===T0,`clipped ${JSON.stringify(d)}`);
		c.assert(pacing(T0)===pacing(T0),'same array for the same today');
	}},
];
