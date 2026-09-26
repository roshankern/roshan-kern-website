/** The director's story schedule (pure, node-testable): one stop per issue script at its climax, trips between holds, and day / ghost / zoom as functions of story time. See docs/superpowers/specs/2026-09-26-anyhealth-timeline-director-design.md §2. */
import type {Body,IssueScript,PartFx} from '../types';
import type {Phase,Sample,Schedule,Stop} from './types';
import {RELEASE_MS,APPROACH_MS,CRUISE_MS_PER_YEAR,CRUISE_MIN_MS,CRUISE_MAX_MS} from './types';
import {smootherstep,hermite} from './ease';
import {toDays,fromDays} from '../../health/dates';
import {BIRTH_DATE,type Issue} from '../../health/types';
import issuesData from '../../health/issues.json';
import {bodyAt} from '../growth/proportions';
import {LEAD_DAYS as boneLead} from '../issues/catalog/bones';
import {LEAD_DAYS as airwayLead} from '../issues/catalog/airway';
import {LEAD_DAYS as digestiveLead} from '../issues/catalog/digestive';
import {LEAD_DAYS as skinLead} from '../issues/catalog/skin';

/** Days of anatomy each script shows before its onset (every catalog's LEAD_DAYS); 0 when absent. */
export const LEAD:Record<string,number>={...boneLead,...airwayLead,...digestiveLead,...skinLead};
const TITLES=new Map((issuesData as Issue[]).map(i=>[i.id,i.title]));
const BIRTH=toDays(BIRTH_DATE);
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));

/** How strongly a set of effects changes the anatomy: Σ |swell|·100 + |translate|·100 + rotation angle + tint amount + (1 − visible). */
export function fxMagnitude(fx:PartFx[]){let m=0;for(const f of fx){
	if(f.swell)m+=Math.abs(f.swell)*100;if(f.translate)m+=Math.hypot(...f.translate)*100;if(f.rotate)m+=2*Math.acos(Math.min(1,Math.abs(f.rotate[3])));
	if(f.tint)m+=f.tint[3];if(f.visible!==undefined)m+=1-f.visible;}return m;}

const autoCache=new Map<string,number>(),autoScripts=new Map<string,IssueScript>(),bodies=new Map<string,Body>();
/** Fallback climax (days since onset) for a script without `climax`: the whole day in [−lead, end] (clipped to birth..today) where fxMagnitude peaks, earliest on ties; 0 when nothing shows. Memoised per script and today. Task 2 gives every catalog script an explicit climax, so the real build never uses this. */
export function autoClimax(s:IssueScript,today:string){
	const key=`${s.id}|${s.onset}|${today}`,hit=autoCache.get(key);if(hit!==undefined&&autoScripts.get(key)===s)return hit;
	const on=toDays(s.onset),lo=Math.ceil(Math.max(-(LEAD[s.id]??0),BIRTH-on)),hi=Math.floor(Math.min(s.chronic||!s.resolve?toDays(today)-on:toDays(s.resolve)-on,toDays(today)-on));
	let best=0,at=clamp(0,lo,Math.max(lo,hi));
	for(let d=lo;d<=hi;d++){const date=fromDays(on+d);let body=bodies.get(date);if(!body)bodies.set(date,body=bodyAt(date));const m=fxMagnitude(s.fxAt(d,{body,date}));if(m>best){best=m;at=d;}}
	autoCache.set(key,at);autoScripts.set(key,s);return at;
}

let warned=false;
/** Stops for `scripts`: one each at onset + climax (days since BIRTH_DATE, clipped to birth..today), sorted by day then id. */
export function stopsFor(scripts:IssueScript[],today:string):Stop[]{
	const end=toDays(today)-BIRTH,auto:string[]=[];
	const stops=scripts.map(s=>{
		let climax=s.climax;if(climax===undefined){climax=autoClimax(s,today);auto.push(s.id);}
		const lead=LEAD[s.id]??0;
		return {id:s.id,day:clamp(toDays(s.onset)-BIRTH+climax,0,Math.max(0,end)),approachDays:s.approachDays??Math.max(0,Math.min(30,climax+lead)),view:s.view??null,title:TITLES.get(s.id)??s.id};
	}).sort((a,b)=>a.day-b.day||(a.id<b.id?-1:a.id>b.id?1:0));
	if(auto.length&&!warned&&process.env.NODE_ENV!=='production'){warned=true;console.warn(`director: ${auto.length} script(s) have no climax; using autoClimax (fx peak) for ${auto.join(', ')}`);}
	return stops;
}

/** A key: story ms, day, velocity (days per ms). `cruise`: the piece from this key to the next is a cruise leg (cruiseDay), else a cubic Hermite. */
interface Key {t:number;d:number;m:number;cruise?:boolean}
/** Story time between two hold instants (or birth → first stop, last stop → today). */
interface Trip {t0:number;t1:number;keys:Key[];from:number|null;to:number|null}

/** Fritsch–Carlson limiter: a zero-secant interval gets flat ends, and (α²+β²) ≤ 9 elsewhere, so the piecewise Hermite is monotone. Slopes are shared by neighbouring intervals, so the result stays C¹. */
function limit(keys:Key[]){for(let j=0;j+1<keys.length;j++){
	const a=keys[j],b=keys[j+1],h=b.t-a.t;if(h<=0)continue;const s=(b.d-a.d)/h;
	if(s<=0){a.m=0;b.m=0;continue;}const al=a.m/s,be=b.m/s,r=al*al+be*be;if(r>9){const k=3/Math.sqrt(r);a.m=al*k*s;b.m=be*k*s;}}}

/** Day on a cruise leg of length h from day d0 to d1, entry / exit velocities m0, m1 (with (m0+m1)/2 ≤ the leg's mean speed): velocity = m0 + (m1−m0)·smootherstep(u) + K·smootherstep′(u), with K ≥ 0 set by the leg's days. Velocity is positive between the ends and its derivative is 0 at both ends, so the joints with the release / approach Hermites have no kink even when those legs are much slower than the cruise. */
function cruiseDay(s:number,a:Key,b:Key){const h=b.t-a.t,u=clamp((s-a.t)/h,0,1),K=(b.d-a.d)/h-(a.m+b.m)/2,u4=u*u*u*u;
	return a.d+h*(a.m*u+(b.m-a.m)*u4*(u*u-3*u+2.5)+K*smootherstep(0,1,u));}

/** Keys for one trip from (t0,d0) to day d1, with or without release / approach legs; returns the keys and the trip's end time. */
function tripKeys(t0:number,d0:number,d1:number,release:boolean,approach:number|null):{keys:Key[];t1:number}{
	const g=d1-d0,R=release?RELEASE_MS:0,A=approach!==null?APPROACH_MS:0;
	const rs=release?Math.min(30,0.3*g):0,as=approach!==null?Math.min(approach,0.3*g):0,cruiseDays=g-rs-as;
	const cruiseMs=g>=1?clamp(cruiseDays/365*CRUISE_MS_PER_YEAR,CRUISE_MIN_MS,CRUISE_MAX_MS):0,t1=t0+R+cruiseMs+A;
	const keys:Key[]=[];
	if(cruiseMs>0){// Joint velocities: the cruise mean, capped at 3× the neighbouring leg's mean (Fritsch–Carlson, so its Hermite stays monotone). Birth enters at the cruise mean; the end trip stops at today with velocity 0.
		const v=cruiseDays/cruiseMs,mA=release?Math.min(v,3*rs/RELEASE_MS):v,mB=approach!==null?Math.min(v,3*as/APPROACH_MS):0;
		if(release)keys.push({t:t0,d:d0,m:0});keys.push({t:t0+R,d:d0+rs,m:mA,cruise:true});keys.push({t:t1-A,d:d1-as,m:mB});if(approach!==null)keys.push({t:t1,d:d1,m:0});
		return {keys,t1};}
	else{// Gap under a day: no cruise leg; the release / approach keys collapse into one mid key (or none) at the leg joint.
		const v=R+A>0?g/(R+A):0;keys.push({t:t0,d:d0,m:release?0:v});if(release&&approach!==null)keys.push({t:t0+R,d:d0+g*R/(R+A),m:v});keys.push({t:t1,d:d1,m:0});}
	limit(keys);return {keys,t1};
}

/** The story schedule for `scripts` on a birth..`today` timeline. `reducedMotion`: approach / release keep their story length, but ghost and zoom become short crossfades (8% of the leg, ≈ 0.2 s) at the hold end of each leg. */
export function buildSchedule(scripts:IssueScript[],today:string,opts:{reducedMotion?:boolean}={}):Schedule{
	const stops=stopsFor(scripts,today),end=Math.max(0,toDays(today)-BIRTH),trips:Trip[]=[],holdMs:number[]=[];
	let t=0,d=0;
	for(let i=0;i<=stops.length;i++){
		const to=i<stops.length?i:null,{keys,t1}=tripKeys(t,d,to!==null?stops[to].day:end,i>0,to!==null?stops[to].approachDays:null);
		trips.push({t0:t,t1,keys,from:i>0?i-1:null,to});if(to!==null)holdMs.push(t1);t=t1;d=keys[keys.length-1].d;
	}
	const totalMs=t,starts=trips.map(x=>x.t0);
	// Ramps as [ghost from,to] / [zoom from,to] over the leg fraction; release ramps run 1 → 0.
	const rm=!!opts.reducedMotion,AG=rm?[0.92,1]:[0,0.5],AZ=rm?[0.92,1]:[0.3,1],RZ=rm?[0,0.08]:[0,0.7],RG=rm?[0,0.08]:[0.4,1];
	/** The trip containing story time s: the last one starting at or before s (binary search). */
	const tripAt=(s:number)=>{let lo=0,hi=starts.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(starts[mid]<=s)lo=mid;else hi=mid-1;}return trips[lo];};
	/** Day within a trip; each piece is clamped to its key values, so float error never dips below a hold's day (monotone across keys). */
	const dayIn=(tr:Trip,s:number)=>{const k=tr.keys;if(s<=k[0].t)return k[0].d;for(let j=0;j+1<k.length;j++)if(s<k[j+1].t)return k[j].d===k[j+1].d?k[j].d:k[j].cruise?clamp(cruiseDay(s,k[j],k[j+1]),k[j].d,k[j+1].d):clamp(hermite(s,k[j].t,k[j+1].t,k[j].d,k[j+1].d,k[j].m,k[j+1].m),k[j].d,k[j+1].d);return k[k.length-1].d;};
	const dayAt=(s:number)=>dayIn(tripAt(s),clamp(s,0,totalMs));
	function sample(storyMs:number,holding:boolean):Sample{
		const s=clamp(storyMs,0,totalMs),tr=tripAt(s),day=dayIn(tr,s);
		let phase:Phase='cruise',stop:number|null=null,ghost=0,zoom=0;
		if(holding&&tr.from!==null&&s===tr.t0){phase='hold';stop=tr.from;ghost=1;zoom=1;}
		else if(s>=totalMs&&tr.to===null&&totalMs>0){phase='end';}
		else if(tr.from!==null&&s<tr.t0+RELEASE_MS){phase='release';stop=tr.from;const u=(s-tr.t0)/RELEASE_MS;zoom=1-smootherstep(RZ[0],RZ[1],u);ghost=1-smootherstep(RG[0],RG[1],u);}
		else if(tr.to!==null&&s>=tr.t1-APPROACH_MS){phase='approach';stop=tr.to;const u=(s-(tr.t1-APPROACH_MS))/APPROACH_MS;ghost=smootherstep(AG[0],AG[1],u);zoom=smootherstep(AZ[0],AZ[1],u);}
		if(s===0&&phase!=='hold')phase='idle';// 'idle' at story 0; the clock reports it as cruise / approach while playing
		return {storyMs:s,day,date:fromDays(BIRTH+Math.floor(day)),phase,stop,focusId:stop!==null?stops[stop].id:null,ghost,zoom};
	}
	const firstStopOn=new Map<number,number>();stops.forEach((x,i)=>{if(!firstStopOn.has(x.day))firstStopOn.set(x.day,i);});
	function storyMsForDay(day:number){
		if(day<=dayAt(0))return 0;
		const i=firstStopOn.get(day);if(i!==undefined)return holdMs[i];// exact stop day (even today's): its hold instant, so seekDay + play holds there
		if(day>=dayAt(totalMs))return totalMs;
		let lo=0,hi=totalMs;for(let n=0;n<200;n++){const mid=(lo+hi)/2;if(mid<=lo||mid>=hi)break;if(dayAt(mid)>=day)hi=mid;else lo=mid;}
		return hi;
	}
	return {stops,holdMs,totalMs,sample,storyMsForDay};
}
