/** v2 Task 4 camera checks (spec 2026-09-26 §4 + Checks · Framing): the posed path (lerpPose), growth framing and focus framing with the real node engine, and the rejoin blend. */
import * as T from 'three';
import type {Check} from './harness';
import type {Vec3} from '../types';
import {DEFAULT_VISIBLE} from '../../atlas/anatomy';
import {nodeEngine} from './engine-node';
import {SCRIPTS,scriptFor} from '../issues';
import {bodyAt} from '../growth/proportions';
import {toDays,fromDays} from '../../health/dates';
import {BIRTH_DATE} from '../../health/types';
import {REJOIN_MS,APPROACH_MS,RELEASE_MS} from '../director/types';
import {buildSchedule,stopsFor} from '../director/schedule';
import {lerpPose,scalePose,adultPose,defaultPoseFor,focusPose,projectBox,projectedHeight,statureAt,dayOfDate,smootherstep,fitPose,elevationOf,climaxDay,stopBoxDay,needsRejoin,focusGap,blendFocus,DEFAULT_DIRECTION,type Pose,type Open,type Box,type Focus} from '../camera/pose';

const FOV=34,TODAY='2026-09-26',TODAY_DAY=dayOfDate(TODAY),MIN_DISTANCE=.04;
/** Open areas as scene.tsx openArea measures them (atlas.css / tracker.css). Desktop 1440×900: Systems panel 30 + 254 (+24), tracker footprint 340 + 30 (+24), title above, timeline bar below.
 *  Phone 390×844: 16 px gutters, title above, the timeline lifted over the tracker peek; for a focus the expanded tracker sheet (60dvh above its 40 px inset) is excluded. */
const DESKTOP:Open={w:1440,h:900,left:308,right:1046,top:92,bottom:742},PHONE:Open={w:390,h:844,left:16,right:374,top:84,bottom:620};
const PHONE_FOCUS:Open={...PHONE,bottom:844-40-844*.6-12};
const SIZES:[string,Open,Open][]=[['1440×900',DESKTOP,DESKTOP],['390×844',PHONE,PHONE_FOCUS]];
const dist=(p:Pose)=>Math.hypot(p.position[0]-p.target[0],p.position[1]-p.target[1],p.position[2]-p.target[2]);
const step=(a:Pose,b:Pose)=>Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1],a.position[2]-b.position[2]);
const boxOf=(b:T.Box3):Box=>({min:b.min.toArray() as Vec3,max:b.max.toArray() as Vec3});
/** The atlas rest body box (every part's atlas bounds: the adult model, feet at y = 0). */
const restBodyOf=(g:{atlas:{parts:{bounds:[number[],number[]]}[]}})=>{const b=new T.Box3();g.atlas.parts.forEach(p=>b.union(new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1]))));return boxOf(b);};
// A fixed adult-sized framing for the pure path checks: default pose on a 1.8 m body, a 6 cm tooth-sized box from the front, a spine from behind.
const BODY:Box={min:[-.35,0,-.15],max:[.35,1.8,.15]},TOOTH:Box={min:[-.03,1.52,.06],max:[.03,1.55,.09]},SPINE:Box={min:[-.08,.9,-.12],max:[.08,1.55,-.02]};
const DEF=fitPose(BODY,DEFAULT_DIRECTION,FOV,DESKTOP,.98),NEAR=focusPose(TOOTH,[0,0,1],FOV,DESKTOP,MIN_DISTANCE),BACK=focusPose(SPINE,[0,.15,-1],FOV,DESKTOP,MIN_DISTANCE);

export const checks:Check[]=[
	{name:'lerpPose endpoints exact',run(c){
		for(const [a,b] of [[DEF,NEAR],[DEF,BACK],[NEAR,BACK]])for(const [t,p] of [[0,a],[1,b]] as const){const r=lerpPose(a,b,t);c.assert(r.target.every((v,i)=>v===p.target[i])&&r.position.every((v,i)=>v===p.position[i])&&r.ox===p.ox&&r.oy===p.oy,`t=${t} is not exactly the endpoint`);}
	}},
	{name:'lerpPose distance is geometric (t=.5 → √(d0·d1))',run(c){
		for(const [a,b] of [[DEF,NEAR],[DEF,BACK]]){const m=lerpPose(a,b,.5);c.near(dist(m),Math.sqrt(dist(a)*dist(b)),1e-9,'midpoint distance');c.near(m.ox,(a.ox+b.ox)/2,1e-9,'ox lerp');
			for(let k=1;k<10;k++){const p=lerpPose(a,b,k/10),e=Math.log(dist(a))*(1-k/10)+Math.log(dist(b))*k/10;c.near(Math.log(dist(p)),e,1e-9,`log distance at ${k/10}`);}}
	}},
	{name:'lerpPose continuous: 1e-3 steps move the camera ≤ 0.5% of its distance (body → tooth, body → spine from behind)',run(c){
		for(const [what,a,b] of [['tooth',DEF,NEAR],['spine',DEF,BACK],['tooth → spine',NEAR,BACK]] as const){let prev=lerpPose(a,b,0),worst=0;
			for(let k=1;k<=1000;k++){const p=lerpPose(a,b,k/1000),r=step(prev,p)/Math.min(dist(prev),dist(p));worst=Math.max(worst,r);prev=p;}
			c.assert(worst<=.005,`${what}: worst step ${(worst*100).toFixed(3)}% of distance`);}
	}},
	{name:'statureAt matches bodyAt(date).statureM at whole days and interpolates between them',run(c){
		for(let k=0;k<=40;k++){const d=Math.round(k/40*(toDays(TODAY)-toDays(BIRTH_DATE)));c.near(statureAt(d),bodyAt(fromDays(toDays(BIRTH_DATE)+d)).statureM,1e-12,`day ${d}`);}
		const a=statureAt(100),b=statureAt(101);c.near(statureAt(100.25),a+(b-a)*.25,1e-12,'quarter day');
	}},
	{name:'growth framing ±3%: the default pose keeps the warped body\'s projected height at 25 dates birth → today',async run(c){
		const g=await c.geometry(),{engine,bounds}=nodeEngine(g),rest=restBodyOf(g),body=()=>{const b=new T.Box3();bounds.forEach(x=>b.union(x));return boxOf(b);};
		const at=(date:string)=>{engine.update({date,visible:DEFAULT_VISIBLE,isolate:null,now:0});engine.settle();return body();};
		const adultBox=at(TODAY),ref=SIZES.map(([size,open])=>{const adult=adultPose(rest,TODAY_DAY,FOV,open),px=projectedHeight(adultBox,adult,FOV,open.w,open.h),H=open.bottom-open.top;
			c.assert(px>H*.9&&px<=H*1.001,`${size}: adult body height ${px.toFixed(1)} px of ${H}`);return {adult,px};});
		const span=toDays(TODAY)-toDays(BIRTH_DATE);
		for(let k=0;k<25;k++){
			const day=Math.round(k/24*span),date=fromDays(toDays(BIRTH_DATE)+day),box=at(date);
			SIZES.forEach(([size,open],i)=>{const {adult,px}=ref[i],r=projectedHeight(box,defaultPoseFor(adult,day,TODAY_DAY),FOV,open.w,open.h)/px;c.assert(r>=.97&&r<=1.03,`${size} ${date}: projected height ratio ${r.toFixed(4)}`);});
		}
	}},
	{name:'focus pose fits the open area (tracker footprint excluded) with ≥ 4% margin: every script\'s focusBox at its climax, from its view, 1440×900 and 390×844',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),missing:string[]=[];
		const stops=SCRIPTS.map(s=>({s,day:climaxDay(s,TODAY_DAY)})).sort((a,b)=>a.day-b.day);
		for(const {s,day} of stops){
			engine.update({date:fromDays(toDays(BIRTH_DATE)+Math.floor(day)),day,visible:DEFAULT_VISIBLE,isolate:null,now:0});const b=engine.focusBox(s.id,day);
			if(!b||b.isEmpty()){missing.push(s.id);continue;}const box=boxOf(b);
			for(const [size,,open] of SIZES){
				const pose=focusPose(box,s.view??null,FOV,open,MIN_DISTANCE),r=projectBox(box,pose,FOV,open.w,open.h),mx=(open.right-open.left)*.04,my=(open.bottom-open.top)*.04;
				c.assert(!!r,`${s.id} ${size}: box behind the camera`);
				c.assert(r!.x0>=open.left+mx-1e-6&&r!.x1<=open.right-mx+1e-6&&r!.y0>=open.top+my-1e-6&&r!.y1<=open.bottom-my+1e-6,`${s.id} ${size}: projected [${r!.x0.toFixed(0)},${r!.x1.toFixed(0)}]×[${r!.y0.toFixed(0)},${r!.y1.toFixed(0)}] vs open [${open.left},${open.right}]×[${open.top},${open.bottom.toFixed(0)}] with 4%`);
				c.assert(dist(pose)>=MIN_DISTANCE-1e-9,`${s.id} ${size}: distance ${dist(pose)} under minDistance`);
			}
		}
		c.assert(!missing.length,`no focus box for ${missing.join(', ')}`);
	}},
	{name:'rejoin is continuous: lerpPose(user, scripted(t), smootherstep(0, REJOIN_MS, t)) steps ≤ 0.5% of distance per ms while the scripted zoom moves',run(c){
		// Scripted: the approach zoom (0 → 1 over the leg's last 70%, smootherstep) from the default pose to a head-sized focus; the user orbited 70°, zoomed in and panned just before.
		const HEAD:Box={min:[-.1,1.5,-.12],max:[.1,1.8,.1]},head=focusPose(HEAD,null,FOV,DESKTOP,MIN_DISTANCE),zoomMs=APPROACH_MS*.7,scripted=(t:number)=>lerpPose(DEF,head,smootherstep(0,zoomMs,t));
		const orbit=new T.Vector3(...DEF.position).sub(new T.Vector3(...DEF.target)).applyAxisAngle(new T.Vector3(0,1,0),T.MathUtils.degToRad(70)).multiplyScalar(.6);
		for(const start of [0,zoomMs*.3,zoomMs*.6]){
			const user:Pose={target:[DEF.target[0]+.1,DEF.target[1]-.2,DEF.target[2]],position:[DEF.target[0]+.1+orbit.x,DEF.target[1]-.2+orbit.y,DEF.target[2]+orbit.z],ox:DEF.ox*.3,oy:DEF.oy-40};
			let prev=lerpPose(user,scripted(start),0),worst=0;
			for(let t=1;t<=REJOIN_MS+200;t++){const p=lerpPose(user,scripted(start+t),smootherstep(0,REJOIN_MS,t)),r=step(prev,p)/Math.min(dist(prev),dist(p));worst=Math.max(worst,r);prev=p;}
			c.assert(worst<=.005,`rejoin from ${start.toFixed(0)} ms into the zoom: worst step ${(worst*100).toFixed(3)}% of distance per ms`);
			c.near(step(lerpPose(user,scripted(start+REJOIN_MS),1),scripted(start+REJOIN_MS)),0,0,'rejoin ends exactly on the scripted pose');
		}
	}},
	{name:'lerpPose orbits about +y: elevation stays within the endpoints\' elevations front → back (default → spine from behind, and exactly opposite directions)',run(c){
		const at=(dir:Vec3,el=0):Pose=>({target:[0,1,0],position:[dir[0]*3,1+dir[1]*3+el,dir[2]*3],ox:0,oy:0});
		for(const [what,a,b] of [['default → back',DEF,BACK],['back → default',BACK,DEF],['exactly opposite',at([0,0,1]),at([0,0,-1])],['opposite, tilted',at([.6,.1,.8]),at([-.6,.3,-.8])]] as const){
			const lo=Math.min(elevationOf(a),elevationOf(b))-1e-9,hi=Math.max(elevationOf(a),elevationOf(b))+1e-9;let prev=lerpPose(a,b,0),worst=0;
			for(let k=1;k<=1000;k++){const p=lerpPose(a,b,k/1000),e=elevationOf(p);c.assert(e>=lo&&e<=hi,`${what} t=${k/1000}: elevation ${(e*180/Math.PI).toFixed(2)}° outside [${(lo*180/Math.PI).toFixed(2)}, ${(hi*180/Math.PI).toFixed(2)}]°`);worst=Math.max(worst,step(prev,p)/Math.min(dist(prev),dist(p)));prev=p;}
			c.assert(worst<=.005,`${what}: worst step ${(worst*100).toFixed(3)}% of distance`);
		}
	}},
	{name:'the scene freezes a stop\'s focus box at its climax day (stopBoxDay = onset + climax clamped to [0, today] exactly as stopsFor places the stop, the day the focus-fit check frames)',run(c){
		for(const s of SCRIPTS){c.assert(stopBoxDay(s.id,-123.5,scriptFor,TODAY_DAY)===Math.min(TODAY_DAY,dayOfDate(s.onset)+(s.climax??0)),`${s.id}: stopBoxDay ${stopBoxDay(s.id,-123.5,scriptFor,TODAY_DAY)}`);c.assert(climaxDay(s,TODAY_DAY)===stopBoxDay(s.id,0,scriptFor,TODAY_DAY),`${s.id}: climaxDay`);}
		c.assert(stopBoxDay('no-such-issue',42.25,scriptFor,TODAY_DAY)===42.25,'unknown id falls back to the cue day');
		// A today that clamps later climaxes (as the director check's 2020-01-01 schedule does): the box day is still each stop's day.
		for(const today of [TODAY,'2020-01-01','2010-01-01']){const end=dayOfDate(today),stops=stopsFor(SCRIPTS,today);let clamped=0;
			for(const st of stops){const d=stopBoxDay(st.id,-1,scriptFor,end);c.assert(d===st.day,`${today} ${st.id}: box day ${d} vs stop day ${st.day}`);if(d===end)clamped++;}
			if(today!==TODAY)c.assert(clamped>0,`${today}: some climaxes clamp to today`);}
	}},
	{name:'needsRejoin: a guided/free switch or a seek while guided rejoins; a seek within free mode, a steady cue or the first frame does not',run(c){
		const k=(seq:number,guided:boolean)=>({seq,guided});
		c.assert(!needsRejoin(null,k(0,true)),'first frame');c.assert(!needsRejoin(k(3,true),k(3,true))&&!needsRejoin(k(3,false),k(3,false)),'steady');
		c.assert(needsRejoin(k(3,true),k(4,true)),'stop tick from a hold (guided seek)');c.assert(needsRejoin(k(3,true),k(4,false)),'scrub from guided');c.assert(needsRejoin(k(3,false),k(4,true)),'stop tick from free mode');
		c.assert(needsRejoin(k(3,true),k(3,false))&&needsRejoin(k(3,false),k(3,true)),'mode switch alone (Play after a scrub)');c.assert(!needsRejoin(k(3,false),k(9,false)),'dragging in free mode: zoom 0 both sides, no restart');
	}},
	{name:'focus handover never steps: blendFocus is exact at the ends, continuous (≤ 0.02 per 1/1000), fades a different id out before the new one in',run(c){
		const A:Focus={id:'a',ghost:1},B:Focus={id:'b',ghost:.8},A3:Focus={id:'a',ghost:.3};const g=(f:Focus|null)=>f?.ghost??0;
		for(const [what,from,to] of [['A → B',A,B],['A → null',A,null],['null → B',null,B],['A → A 0.3',A,A3],['A 0.3 → B',A3,B]] as [string,Focus|null,Focus|null][]){
			c.assert(JSON.stringify(blendFocus(from,to,0))===JSON.stringify(from)&&blendFocus(from,to,1)===to,`${what}: endpoints`);
			let prev=blendFocus(from,to,0),worst=0;for(let i=1;i<=1000;i++){const f=blendFocus(from,to,i/1000);worst=Math.max(worst,focusGap(prev,f));
				if(from&&to&&from.id!==to.id)c.assert(i/1000<.5?!f||f.id===from.id:!f||f.id===to.id,`${what} at ${i/1000}: id ${f?.id}`);prev=f;}
			c.assert(worst<=.02,`${what}: worst step ${worst}`);c.near(focusGap(from,to),from&&to&&from.id!==to.id?g(from)+g(to):Math.abs(g(from)-g(to)),1e-12,`${what}: gap`);
		}
	}},
	{name:'reduced motion: the cue zoom is a cut (a step at the ghost ramp midpoint), the ghost still a ≈ 0.2 s ramp',run(c){
		const s=buildSchedule(SCRIPTS,'2026-09-25',{reducedMotion:true});let checked=0;
		s.holdMs.forEach((h,i)=>{
			const a0=h-APPROACH_MS,cut=a0+.96*APPROACH_MS;if(i>0&&a0<s.holdMs[i-1]+RELEASE_MS)return;checked++;
			c.assert(s.sample(cut-.01,false).zoom===0&&s.sample(cut,false).zoom===1,`stop ${i}: approach zoom steps at 0.96 of the leg`);
			const gs=[.92,.94,.96,.98].map(u=>s.sample(a0+u*APPROACH_MS,false).ghost);c.assert(gs[0]===0&&gs[1]>0&&gs[1]<.5&&Math.abs(gs[2]-.5)<1e-9&&gs[3]>.5&&gs[3]<1,`stop ${i}: approach ghost ramps ${gs}`);
			if(i+1<s.holdMs.length&&s.holdMs[i+1]-h>=RELEASE_MS+APPROACH_MS){const rc=h+.04*RELEASE_MS;c.assert(s.sample(rc-.01,false).zoom===1&&s.sample(rc,false).zoom===0,`stop ${i}: release zoom steps at 0.04 of the leg`);
				const rg=[.02,.04,.06].map(u=>s.sample(h+u*RELEASE_MS,false).ghost);c.assert(rg[0]>.5&&rg[0]<1&&Math.abs(rg[1]-.5)<1e-9&&rg[2]<.5&&rg[2]>0,`stop ${i}: release ghost ramps ${rg}`);}
		});c.assert(checked>5,`checked ${checked} stops`);
	}},
	{name:'scalePose scales target and position about the origin and keeps the view offset',run(c){
		const p=scalePose(DEF,.3);c.near(p.position[1],DEF.position[1]*.3,1e-12,'position');c.near(p.target[2],DEF.target[2]*.3,1e-12,'target');c.assert(p.ox===DEF.ox&&p.oy===DEF.oy,'offset');
	}},
];
