/** v2 director checks: the story schedule (stops, trips, day continuity, ghost/zoom ramps, inverse) and the clock state machine. Pure, no geometry. */
import type {Check,CheckContext} from './harness';
import type {IssueScript} from '../types';
import type {Clock,Sample,Schedule} from '../director/types';
import {RELEASE_MS,APPROACH_MS,CRUISE_MIN_MS,CRUISE_MAX_MS,MAX_STEP_MS} from '../director/types';
import {buildSchedule} from '../director/schedule';
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
/** Tick a clock every `dt` ms of wall-clock time from t0 to t1 (the clock advances at most MAX_STEP_MS per tick); the last sample. */
const run=(k:Clock,t0:number,t1:number,dt=16):Sample=>{let x=k.tick(t0);for(let t=t0;t<t1;){t=Math.min(t1,t+dt);x=k.tick(t);}return x;};

/** Dense (≤ 1 ms) sampling of each trip: monotone day, C¹ velocity, zero velocity at holds and at birth (the ease-in), continuous ghost (and zoom, unless `zoomCut`: reduced motion, where zoom is a step). */
function continuity(c:CheckContext,s:Schedule,what:string,zoomCut=false){
	const B=bounds(s);
	for(let k=0;k+1<B.length;k++){
		const a=B[k],b=B[k+1],n=Math.max(1,Math.ceil(b-a)),h=(b-a)/n;if(b-a<=0)continue;
		const days:number[]=[],gz:[number,number][]=[];for(let j=0;j<=n;j++){const t=j===n?b:a+j*h,x=s.sample(t,false);days.push(x.day);gz.push([x.ghost,x.zoom]);}
		const v:number[]=[];for(let j=0;j<n;j++){const dd=days[j+1]-days[j];c.assert(dd>=0,`${what} trip ${k}: day decreases at ${a+j*h} ms (${dd})`);v.push(dd/h);}
		for(let j=0;j<n;j++)for(let q=0;q<(zoomCut?1:2);q++)c.assert(Math.abs(gz[j+1][q]-gz[j][q])<=0.02,`${what} trip ${k}: ${q?'zoom':'ghost'} step ${gz[j+1][q]-gz[j][q]} at ${a+j*h} ms`);
		const peak=Math.max(...v);if(peak<=0)continue;
		for(let j=1;j<n;j++)c.assert(Math.abs(v[j]-v[j-1])<=0.02*peak,`${what} trip ${k}: velocity jump ${v[j]-v[j-1]} (peak ${peak}) at ${a+j*h} ms`);
		// Leg joints, against the local speed (the peak bound alone lets kinks in slow legs through).
		const joints=[...(k>0?[a+RELEASE_MS]:[]),...(k<s.holdMs.length?[b-APPROACH_MS]:[])].filter(J=>J-1>=a&&J+1<=b);
		for(const J of joints){const day=(t:number)=>s.sample(t,false).day,vb=day(J)-day(J-1),va=day(J+1)-day(J);
			c.assert(Math.abs(va-vb)<=0.05*(Math.abs(va)+Math.abs(vb))/2+1e-6,`${what} trip ${k}: joint at ${J} ms kinks ${vb} → ${va} day/ms`);}
		c.assert(v[0]<=1e-3*peak,`${what} trip ${k}: velocity leaving ${k>0?`hold ${k-1}`:'birth'} is ${v[0]} (peak ${peak})`);
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
	{name:'director: day is C1 and monotone (1 ms sampling)',run(c){continuity(c,syn(),'synthetic');continuity(c,buildSchedule(SCRIPTS,REAL_TODAY),'real');continuity(c,buildSchedule(SCRIPTS,REAL_TODAY,{reducedMotion:true}),'reduced motion',true);}},
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
	{name:'director: approachDays defaults to min(30, climax + lead)',run(c){
		const bump:IssueScript={id:'bump',parts:['Heart'],onset:'2012-01-01',resolve:'2012-02-01',climax:9,fxAt:d=>d<0||d>31?[]:[{part:'Heart',swell:0.001}]};
		const s=buildSchedule([bump],TODAY);c.near(s.stops[0].day,toDays('2012-01-01')-toDays(BIRTH_DATE)+9,0,'stop at the climax');c.assert(s.stops[0].approachDays===9,`default approachDays ${s.stops[0].approachDays}`);
		c.assert(buildSchedule([{...bump,climax:60}],TODAY).stops[0].approachDays===30,'capped at 30');
	}},
	{name:'director clock: plays to a hold and stays',run(c){
		const s=syn(),k=createClock(s);k.play(0);let x=k.tick(1);c.assert(x.phase==='cruise',`playing from 0 reads cruise, not ${x.phase}`);
		x=run(k,1,s.holdMs[0]+1000);c.assert(k.holding===0&&!k.playing&&k.storyMs===s.holdMs[0]&&x.phase==='hold',`holding ${k.holding} at ${k.storyMs}`);
		x=k.tick(s.holdMs[0]+50000);c.assert(k.holding===0&&k.storyMs===s.holdMs[0],'stays');
	}},
	{name:'director clock: continue passes once',run(c){
		const s=syn(),k=createClock(s);k.play(0);run(k,0,s.holdMs[0]+10);k.continue(1e6);c.assert(k.playing&&k.holding===null,'playing after continue');
		k.tick(1e6+10);c.assert(k.storyMs===s.holdMs[0]+10&&k.holding===null,`passed stop 0: ${k.storyMs}`);
		run(k,1e6+10,1e6+RELEASE_MS+APPROACH_MS+100);c.assert(k.holding===1&&k.storyMs===s.holdMs[1],`holds at stop 1: ${k.holding}`);
		k.continue(0);const at=k.storyMs;k.continue(0);c.assert(k.holding===null&&k.storyMs===at,'continue is a no-op away from a hold');
	}},
	{name:'director clock: pause mid-approach then play still holds',run(c){
		const s=syn(),k=createClock(s);k.seekStop(0,0);run(k,0,1000);c.assert(k.tick(1000).phase==='approach','mid approach');k.pause(1000);k.tick(9000);c.assert(k.storyMs===s.holdMs[0]-APPROACH_MS+1000,'paused');
		k.play(20000);run(k,20000,20000+APPROACH_MS);c.assert(k.holding===0&&k.storyMs===s.holdMs[0],`holding ${k.holding}`);
	}},
	{name:'director clock: seekDay re-arms',run(c){
		const s=syn(),k=createClock(s);k.play(0);run(k,0,s.holdMs[0]+1);k.continue(0);k.tick(100);c.assert(k.storyMs>s.holdMs[0],'past stop 0');
		k.seekDay(s.stops[0].day-10);c.assert(!k.playing&&k.holding===null&&k.storyMs<s.holdMs[0],`seek ${k.storyMs}`);
		k.play(0);run(k,0,s.holdMs[0]);c.assert(k.holding===0&&k.storyMs===s.holdMs[0],`re-armed: ${k.holding} ${k.storyMs}`);
	}},
	{name:'director clock: seekStop lands at the approach start and plays',run(c){
		const s=syn(),k=createClock(s);k.seekStop(2,500);c.assert(k.playing&&k.holding===null&&k.storyMs===s.holdMs[2]-APPROACH_MS,`seekStop ${k.storyMs}`);
		const x=k.tick(500);c.assert(x.phase==='approach'&&x.stop===2&&x.ghost===0,`${x.phase} ${x.stop}`);run(k,500,500+APPROACH_MS);c.assert(k.holding===2,'holds at 2');
	}},
	{name:'director: exact stop days invert to their hold, and seekDay there + play holds at the first stop that day',run(c){
		// 2020-01-01 clamps later climaxes onto today, so stops share the end day.
		for(const [what,s] of [['real',buildSchedule(SCRIPTS,REAL_TODAY)],['real at 2020-01-01',buildSchedule(SCRIPTS,'2020-01-01')],['stop on today',buildSchedule([...SYN,fake('t-today',TODAY,0,{resolve:'2025-02-01'})],TODAY)]] as const){
			s.stops.forEach(st=>{const first=s.stops.findIndex(x=>x.day===st.day);if(st.day===0)return;
				c.assert(s.storyMsForDay(st.day)===s.holdMs[first],`${what} ${st.id}: storyMsForDay ${s.storyMsForDay(st.day)} vs hold ${s.holdMs[first]}`);
				const k=createClock(s);k.seekDay(st.day);k.play(0);k.tick(1);c.assert(k.holding===first&&k.storyMs===s.holdMs[first],`${what} ${st.id}: seekDay + play holds ${k.holding} (want ${first}) at ${k.storyMs}`);});
			const end=s.sample(s.totalMs,false).day;if(!s.stops.some(x=>x.day===end))c.assert(s.storyMsForDay(end)===s.totalMs,`${what}: end day inverts to exactly totalMs`);
		}
		const t=buildSchedule([...SYN,fake('t-today',TODAY,0,{resolve:'2025-02-01'})],TODAY);c.assert(t.stops[t.stops.length-1].id==='t-today'&&t.stops[t.stops.length-1].day===t.sample(t.totalMs,false).day,'synthetic stop sits on today');
	}},
	{name:'director: a stop at birth reads idle at story 0 until played',run(c){
		const s=buildSchedule([fake('birth',BIRTH_DATE,0)],TODAY),x=s.sample(0,false);c.assert(x.phase==='idle'&&x.ghost===0,`at 0: ${x.phase}`);
		const k=createClock(s);k.play(0);c.assert(k.tick(0).phase==='approach','playing at 0 reads approach');run(k,0,APPROACH_MS+1);c.assert(k.holding===0,'holds at the birth stop');
	}},
	{name:'director clock: seekMs is exact, paused, not holding, and re-arms every stop with hold ≥ ms',run(c){
		const s=syn(),k=createClock(s);k.play(0);run(k,0,s.holdMs[0]+1);k.continue(0);run(k,0,RELEASE_MS);c.assert(k.storyMs>s.holdMs[0]&&k.holding===null,'past stop 0');
		for(const ms of [s.holdMs[0]-123.456,s.holdMs[2]+0.25,0,s.totalMs])k.seekMs(ms),c.assert(k.storyMs===ms&&!k.playing&&k.holding===null,`seekMs(${ms}) → ${k.storyMs}`);
		k.seekMs(-5);c.assert(k.storyMs===0,'clamped low');k.seekMs(s.totalMs+5);c.assert(k.storyMs===s.totalMs,'clamped high');
		k.seekMs(s.holdMs[0]-500);k.play(0);run(k,0,600);c.assert(k.holding===0&&k.storyMs===s.holdMs[0],`re-armed stop 0 holds: ${k.holding} at ${k.storyMs}`);
		k.seekMs(s.holdMs[0]);c.assert(k.tick(0).phase!=='hold'&&k.holding===null,'a seek to a hold instant is not a hold');k.play(0);k.tick(1);c.assert(k.holding===0&&k.storyMs===s.holdMs[0],`play at a hold instant holds it: ${k.holding}`);
	}},
	{name:'director clock: same-day pair: seekMs(holdMs[second]) then play holds the SECOND stop (seekDay would hold the first)',run(c){
		const s=syn();c.assert(s.stops[0].day===s.stops[1].day,'same-day pair');
		const k=createClock(s);k.seekMs(s.holdMs[1]);k.play(0);k.tick(16);c.assert(k.holding===1&&k.storyMs===s.holdMs[1],`seekMs: holding ${k.holding} at ${k.storyMs}`);
		const d=createClock(s);d.seekDay(s.stops[1].day);d.play(0);d.tick(16);c.assert(d.holding===0,`seekDay maps the shared day to the first stop (${d.holding})`);
	}},
	{name:'director clock: a tick advances story time by at most MAX_STEP_MS (a background tab or long frame never jumps the story)',run(c){
		const s=syn(),k=createClock(s);k.play(0);k.tick(5000);c.assert(k.storyMs===MAX_STEP_MS,`one 5 s tick moved ${k.storyMs} ms`);k.tick(5016);c.assert(k.storyMs===MAX_STEP_MS+16,`then ${k.storyMs}`);
		k.pause(60000);c.assert(k.storyMs===2*MAX_STEP_MS+16,`pause after a long gap: ${k.storyMs}`);
	}},
	{name:'director: play from birth eases in (velocity 0 at story 0, then accelerating smoothly)',run(c){
		for(const s of [syn(),buildSchedule(SCRIPTS,REAL_TODAY)]){const day=(t:number)=>s.sample(t,false).day,v0=day(1)-day(0),v=(t:number)=>day(t+1)-day(t),mid=v(s.holdMs[0]/2);
			c.assert(v0<=1e-3*mid,`velocity at birth ${v0} vs mid-trip ${mid}`);let prev=v0;for(let t=1;t<200;t++){const x=v(t);c.assert(x>=prev-1e-12,`velocity dips at ${t} ms`);prev=x;}}
	}},
	{name:'director clock: seekStop out of range is a no-op',run(c){
		const s=syn(),k=createClock(s);k.seekDay(s.stops[1].day);const at=k.storyMs;for(const i of [-1,s.holdMs.length,1.5,NaN]){k.seekStop(i,0);c.assert(k.storyMs===at&&!k.playing,`seekStop(${i})`);}
	}},
	{name:'director clock: end then play restarts at 0',run(c){
		const s=syn(),k=createClock(s);k.seekDay(1e9);c.assert(k.storyMs===s.totalMs,'at end');k.play(0);k.tick(1);c.assert(k.storyMs===0||k.storyMs===1,`restart ${k.storyMs}`);
		k.seekStop(3,0);run(k,0,APPROACH_MS);k.continue(0);const x=run(k,0,s.totalMs-s.holdMs[3]+1000,50);c.assert(k.storyMs===s.totalMs&&!k.playing&&x.phase==='end',`end: ${x.phase} ${k.storyMs}`);
		k.play(5);c.assert(k.storyMs===0&&k.playing,'restarted');run(k,5,s.holdMs[0]+100);c.assert(k.holding===0,'stops re-armed on restart');
	}},
];
