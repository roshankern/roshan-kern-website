/** v2 director checks: the story schedule (stops, trips, day continuity, ghost/zoom ramps, inverse) and the clock state machine. Pure, no geometry. */
import type {Check,CheckContext} from './harness';
import type {IssueScript} from '../types';
import type {Schedule} from '../director/types';
import {RELEASE_MS,APPROACH_MS,CRUISE_MIN_MS,CRUISE_MAX_MS} from '../director/types';
import {buildSchedule,autoClimax} from '../director/schedule';
import {createClock} from '../director/clock';
import {SCRIPTS} from '../issues';
import {toDays} from '../../health/dates';
import {BIRTH_DATE} from '../../health/types';

const TODAY='2025-01-01',REAL_TODAY='2026-09-25';
// Synthetic scripts, so the director's rules are checked independently of the catalog's climax values.
const fake=(id:string,onset:string,climax:number,o:Partial<IssueScript>={}):IssueScript=>({id,parts:['Heart'],onset,resolve:'2024-01-01',climax,fxAt:()=>[{part:'Heart',swell:.001}],...o});
const SYN=[fake('c-late','2015-03-01',10),fake('b-same','2010-05-01',4),fake('a-same','2010-05-03',2),fake('d-short','2015-03-11',0.5,{approachDays:0.5})];
const syn=()=>buildSchedule(SYN,TODAY);
/** Trip boundaries: 0, every hold, totalMs. */
const bounds=(s:Schedule)=>[0,...s.holdMs,s.totalMs];

/** Dense (≤ 1 ms) sampling of each trip: monotone day, C¹ velocity, zero velocity at holds, continuous ghost/zoom. */
function continuity(c:CheckContext,s:Schedule,what:string){
	const B=bounds(s);
	for(let k=0;k+1<B.length;k++){
		const a=B[k],b=B[k+1],n=Math.max(1,Math.ceil(b-a)),h=(b-a)/n;if(b-a<=0)continue;
		const days:number[]=[],gz:[number,number][]=[];for(let j=0;j<=n;j++){const t=j===n?b:a+j*h,x=s.sample(t,false);days.push(x.day);gz.push([x.ghost,x.zoom]);}
		const v:number[]=[];for(let j=0;j<n;j++){const dd=days[j+1]-days[j];c.assert(dd>=0,`${what} trip ${k}: day decreases at ${a+j*h} ms (${dd})`);v.push(dd/h);}
		for(let j=0;j<n;j++)for(let q=0;q<2;q++)c.assert(Math.abs(gz[j+1][q]-gz[j][q])<=0.02,`${what} trip ${k}: ${q?'zoom':'ghost'} step ${gz[j+1][q]-gz[j][q]} at ${a+j*h} ms`);
		const peak=Math.max(...v);if(peak<=0)continue;
		for(let j=1;j<n;j++)c.assert(Math.abs(v[j]-v[j-1])<=0.02*peak,`${what} trip ${k}: velocity jump ${v[j]-v[j-1]} (peak ${peak}) at ${a+j*h} ms`);
		// Leg joints, against the local speed (the peak bound alone lets kinks in slow legs through).
		const joints=[...(k>0?[a+RELEASE_MS]:[]),...(k<s.holdMs.length?[b-APPROACH_MS]:[])].filter(J=>J-1>=a&&J+1<=b);
		for(const J of joints){const day=(t:number)=>s.sample(t,false).day,vb=day(J)-day(J-1),va=day(J+1)-day(J);
			c.assert(Math.abs(va-vb)<=0.05*(Math.abs(va)+Math.abs(vb))/2+1e-6,`${what} trip ${k}: joint at ${J} ms kinks ${vb} → ${va} day/ms`);}
		if(k>0)c.assert(v[0]<=1e-3*peak,`${what} trip ${k}: velocity leaving hold ${k-1} is ${v[0]} (peak ${peak})`);
		if(k<s.holdMs.length)c.assert(v[n-1]<=1e-3*peak,`${what} trip ${k}: velocity arriving at hold ${k} is ${v[n-1]} (peak ${peak})`);
	}
}
/** Cruise-leg lengths: every trip with a gap ≥ 1 day cruises CRUISE_MIN_MS..CRUISE_MAX_MS. */
function cruiseLegs(c:CheckContext,s:Schedule,what:string){
	const {stops,holdMs}=s;
	const inRange=(ms:number,m:string)=>c.assert(ms>=CRUISE_MIN_MS-1e-6&&ms<=CRUISE_MAX_MS+1e-6,`${what} ${m}: cruise ${ms} ms`);
	if(stops.length&&stops[0].day>=1)inRange(holdMs[0]-APPROACH_MS,'birth trip');
	for(let i=0;i+1<stops.length;i++){const cruise=holdMs[i+1]-holdMs[i]-RELEASE_MS-APPROACH_MS;if(stops[i+1].day-stops[i].day>=1)inRange(cruise,`${stops[i].id} → ${stops[i+1].id}`);else c.assert(cruise>=-1e-6&&cruise<=CRUISE_MAX_MS,`${what}: short gap cruise ${cruise}`);}
	c.assert(Number.isFinite(s.totalMs)&&s.totalMs>=(holdMs[holdMs.length-1]??0),`${what}: totalMs ${s.totalMs}`);
}

export const checks:Check[]=[
	{name:'director: one stop per script, sorted by day then id',run(c){
		const s=syn();c.assert(s.stops.length===SYN.length&&s.holdMs.length===SYN.length,`stops ${s.stops.length}`);
		c.assert(s.stops.map(x=>x.id).join()==='a-same,b-same,c-late,d-short',`order ${s.stops.map(x=>x.id)}`);
		c.near(s.stops[0].day,s.stops[1].day,0,'a-same and b-same share a day');
		c.near(s.stops[2].day,toDays('2015-03-11')-toDays(BIRTH_DATE),0,'climax = onset + climax');
		for(let i=1;i<s.holdMs.length;i++)c.assert(s.holdMs[i]>s.holdMs[i-1],'holdMs ascending');
		c.assert(s.stops[3].approachDays===0.5&&s.stops[2].approachDays===10,`approachDays ${s.stops.map(x=>x.approachDays)}`);
		const r=buildSchedule(SCRIPTS,REAL_TODAY);c.assert(r.stops.length===SCRIPTS.length&&new Set(r.stops.map(x=>x.id)).size===SCRIPTS.length,'real catalog: one stop per script');
		for(let i=1;i<r.stops.length;i++){const a=r.stops[i-1],b=r.stops[i];c.assert(a.day<b.day||(a.day===b.day&&a.id<b.id),`real catalog order at ${b.id}`);}
		c.assert(r.stops.every(x=>x.title&&x.title!==x.id),'real catalog: every stop has its issues.json title');
	}},
	{name:'director: cruise legs within [CRUISE_MIN_MS, CRUISE_MAX_MS]',run(c){
		const s=syn();cruiseLegs(c,s,'synthetic');c.near(s.holdMs[1]-s.holdMs[0],RELEASE_MS+APPROACH_MS,1e-9,'same-day trip is release + approach only');
		cruiseLegs(c,buildSchedule(SCRIPTS,REAL_TODAY),'real');
	}},
	{name:'director: day is C1 and monotone (1 ms sampling)',run(c){continuity(c,syn(),'synthetic');continuity(c,buildSchedule(SCRIPTS,REAL_TODAY),'real');continuity(c,buildSchedule(SCRIPTS,REAL_TODAY,{reducedMotion:true}),'reduced motion');}},
	{name:'director: day hits the climax exactly at the hold',run(c){
		for(const s of [syn(),buildSchedule(SCRIPTS,REAL_TODAY)])s.stops.forEach((st,i)=>{const x=s.sample(s.holdMs[i],true);
			c.assert(x.day===st.day,`${st.id}: day ${x.day} vs ${st.day}`);c.assert(x.phase==='hold'&&x.stop===i&&x.focusId===st.id,`${st.id}: ${x.phase} ${x.stop} ${x.focusId}`);c.assert(x.ghost===1&&x.zoom===1,`${st.id}: ghost ${x.ghost} zoom ${x.zoom}`);});
	}},
	{name:'director: ghost/zoom ramps (0 in cruise, ghost leads on approach, trails on release)',run(c){
		const s=syn(),B=bounds(s);
		for(let k=0;k+1<B.length;k++){
			const a=B[k],b=B[k+1];if(b<=a)continue;
			if(k===0){const x=s.sample(0,false);c.assert(x.ghost===0&&x.zoom===0&&x.phase==='idle'&&x.stop===null,`birth: ${x.phase} ${x.ghost} ${x.zoom}`);}
			if(k===B.length-2){const x=s.sample(b,false);c.assert(x.ghost===0&&x.zoom===0&&x.phase==='end',`end: ${x.phase} ${x.ghost} ${x.zoom}`);}
			let ghostHalf=-1,zoomLeft=-1,zoomOut=-1,ghostDrop=-1;
			for(let t=a;t<b;t+=0.5){const x=s.sample(t,false);
				if(x.phase==='cruise')c.assert(x.ghost===0&&x.zoom===0&&x.stop===null&&x.focusId===null,`cruise at ${t}: ${x.ghost} ${x.zoom}`);
				if(x.phase==='approach'){if(ghostHalf<0&&x.ghost>=0.5)ghostHalf=t;if(zoomLeft<0&&x.zoom>0.05)zoomLeft=t;c.assert(x.stop===k&&x.focusId===s.stops[k].id,`approach stop ${x.stop}`);}
				if(x.phase==='release'){if(zoomOut<0&&x.zoom<=0.05)zoomOut=t;if(ghostDrop<0&&x.ghost<0.5)ghostDrop=t;c.assert(x.stop===k-1,`release stop ${x.stop}`);}
			}
			if(k<s.holdMs.length){c.assert(ghostHalf>=0&&zoomLeft>=0&&ghostHalf<zoomLeft,`trip ${k} approach: ghost 0.5 at ${ghostHalf}, zoom leaves 0.05 at ${zoomLeft}`);const x=s.sample(b-APPROACH_MS,false);c.assert(x.phase==='approach'&&x.ghost===0&&x.zoom===0,`approach start ${x.phase} ${x.ghost} ${x.zoom}`);}
			if(k>0){c.assert(zoomOut>=0&&ghostDrop>=0&&zoomOut<ghostDrop,`trip ${k} release: zoom 0.05 at ${zoomOut}, ghost below 0.5 at ${ghostDrop}`);const x=s.sample(a+RELEASE_MS,false),y=s.sample(a+RELEASE_MS-0.5,false);c.assert(x.phase!=='release'&&y.phase==='release'&&y.stop===k-1,`release leg is RELEASE_MS long: ${y.phase} → ${x.phase}`);}
		}
	}},
	{name:'director: same-day stops get two holds and zoom out between them',run(c){
		const s=syn();c.assert(s.stops[0].day===s.stops[1].day,'same day');let minZoom=1;
		for(let t=s.holdMs[0];t<=s.holdMs[1];t+=1)minZoom=Math.min(minZoom,s.sample(t,false).zoom);
		c.assert(minZoom===0,`min zoom between same-day holds ${minZoom}`);c.assert(s.sample(s.holdMs[1],true).phase==='hold'&&s.sample(s.holdMs[0],true).phase==='hold','two holds');
	}},
	{name:'director: storyMsForDay inverts day',run(c){
		for(const s of [syn(),buildSchedule(SCRIPTS,REAL_TODAY)]){const end=s.sample(s.totalMs,false).day;
			for(let k=0;k<50;k++){const d=end*(k+0.37)/50,ms=s.storyMsForDay(d),x=s.sample(ms,false);c.near(x.day,d,1e-6,`day at storyMsForDay(${d})`);
				if(ms>0.01)c.assert(s.sample(ms-0.01,false).day<d,`earlier story time reaches ${d}`);}
			c.assert(s.storyMsForDay(-5)===0&&s.storyMsForDay(end+5)===s.totalMs,'clamped');
		}
	}},
	{name:'director: autoClimax fallback lands on the peak of the fx',run(c){
		const bump:IssueScript={id:'bump',parts:['Heart'],onset:'2012-01-01',resolve:'2012-02-01',fxAt:d=>d<0||d>31?[]:[{part:'Heart',swell:0.01*(1-Math.abs(d-9)/31)}]};
		c.assert(autoClimax(bump,TODAY)===9,`autoClimax ${autoClimax(bump,TODAY)}`);
		const s=buildSchedule([bump],TODAY);c.near(s.stops[0].day,toDays('2012-01-01')-toDays(BIRTH_DATE)+9,0,'stop at the auto climax');c.assert(s.stops[0].approachDays===9,`default approachDays ${s.stops[0].approachDays}`);
	}},
	{name:'director clock: plays to a hold and stays',run(c){
		const s=syn(),k=createClock(s);k.play(0);let x=k.tick(1);c.assert(x.phase==='cruise',`playing from 0 reads cruise, not ${x.phase}`);
		x=k.tick(s.holdMs[0]+1000);c.assert(k.holding===0&&!k.playing&&k.storyMs===s.holdMs[0]&&x.phase==='hold',`holding ${k.holding} at ${k.storyMs}`);
		x=k.tick(s.holdMs[0]+50000);c.assert(k.holding===0&&k.storyMs===s.holdMs[0],'stays');
	}},
	{name:'director clock: continue passes once',run(c){
		const s=syn(),k=createClock(s);k.play(0);k.tick(s.holdMs[0]+10);k.continue(1e6);c.assert(k.playing&&k.holding===null,'playing after continue');
		k.tick(1e6+10);c.assert(k.storyMs===s.holdMs[0]+10&&k.holding===null,`passed stop 0: ${k.storyMs}`);
		k.tick(1e6+RELEASE_MS+APPROACH_MS+100);c.assert(k.holding===1&&k.storyMs===s.holdMs[1],`holds at stop 1: ${k.holding}`);
		k.continue(0);const at=k.storyMs;k.continue(0);c.assert(k.holding===null&&k.storyMs===at,'continue is a no-op away from a hold');
	}},
	{name:'director clock: pause mid-approach then play still holds',run(c){
		const s=syn(),k=createClock(s);k.seekStop(0,0);k.tick(1000);c.assert(k.tick(1000).phase==='approach','mid approach');k.pause(1000);k.tick(9000);c.assert(k.storyMs===s.holdMs[0]-APPROACH_MS+1000,'paused');
		k.play(20000);k.tick(20000+APPROACH_MS);c.assert(k.holding===0&&k.storyMs===s.holdMs[0],`holding ${k.holding}`);
	}},
	{name:'director clock: seekDay re-arms',run(c){
		const s=syn(),k=createClock(s);k.play(0);k.tick(s.holdMs[0]+1);k.continue(0);k.tick(100);c.assert(k.storyMs>s.holdMs[0],'past stop 0');
		k.seekDay(s.stops[0].day-10);c.assert(!k.playing&&k.holding===null&&k.storyMs<s.holdMs[0],`seek ${k.storyMs}`);
		k.play(0);k.tick(s.holdMs[0]);c.assert(k.holding===0&&k.storyMs===s.holdMs[0],`re-armed: ${k.holding} ${k.storyMs}`);
	}},
	{name:'director clock: seekStop lands at the approach start and plays',run(c){
		const s=syn(),k=createClock(s);k.seekStop(2,500);c.assert(k.playing&&k.holding===null&&k.storyMs===s.holdMs[2]-APPROACH_MS,`seekStop ${k.storyMs}`);
		const x=k.tick(500);c.assert(x.phase==='approach'&&x.stop===2&&x.ghost===0,`${x.phase} ${x.stop}`);k.tick(500+APPROACH_MS);c.assert(k.holding===2,'holds at 2');
	}},
	{name:'director: exact stop days invert to their hold, and seekDay there + play holds at the first stop that day',run(c){
		const s=buildSchedule(SCRIPTS,REAL_TODAY);
		s.stops.forEach((st,i)=>{const first=s.stops.findIndex(x=>x.day===st.day);if(st.day===0)return;
			c.assert(s.storyMsForDay(st.day)===s.holdMs[first],`${st.id}: storyMsForDay ${s.storyMsForDay(st.day)} vs hold ${s.holdMs[first]}`);
			const k=createClock(s);k.seekDay(st.day);k.play(0);k.tick(1);c.assert(k.holding===first&&k.storyMs===s.holdMs[first],`${st.id}: seekDay + play holds ${k.holding} (want ${first}) at ${k.storyMs}`);});
		c.assert(s.storyMsForDay(s.sample(s.totalMs,false).day)===s.totalMs,'end day inverts to exactly totalMs');
	}},
	{name:'director: a stop at birth reads idle at story 0 until played',run(c){
		const s=buildSchedule([fake('birth',BIRTH_DATE,0)],TODAY),x=s.sample(0,false);c.assert(x.phase==='idle'&&x.ghost===0,`at 0: ${x.phase}`);
		const k=createClock(s);k.play(0);c.assert(k.tick(0).phase==='approach','playing at 0 reads approach');k.tick(APPROACH_MS+1);c.assert(k.holding===0,'holds at the birth stop');
	}},
	{name:'director clock: seekStop out of range is a no-op',run(c){
		const s=syn(),k=createClock(s);k.seekDay(s.stops[1].day);const at=k.storyMs;for(const i of [-1,s.holdMs.length,1.5,NaN]){k.seekStop(i,0);c.assert(k.storyMs===at&&!k.playing,`seekStop(${i})`);}
	}},
	{name:'director clock: end then play restarts at 0',run(c){
		const s=syn(),k=createClock(s);k.seekDay(1e9);c.assert(k.storyMs===s.totalMs,'at end');k.play(0);k.tick(1);c.assert(k.storyMs===0||k.storyMs===1,`restart ${k.storyMs}`);
		k.seekStop(3,0);k.tick(APPROACH_MS);k.continue(0);const x=k.tick(1e7);c.assert(k.storyMs===s.totalMs&&!k.playing&&x.phase==='end',`end: ${x.phase} ${k.storyMs}`);
		k.play(5);c.assert(k.storyMs===0&&k.playing,'restarted');k.tick(s.holdMs[0]+100);c.assert(k.holding===0,'stops re-armed on restart');
	}},
];
