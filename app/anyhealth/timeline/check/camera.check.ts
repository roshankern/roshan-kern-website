/** v2 Task 4 camera checks (spec 2026-09-26 §4 + Checks · Framing): the posed path (lerpPose), growth framing and focus framing with the real node engine, and the rejoin blend. */
import * as T from 'three';
import type {Check} from './harness';
import type {Vec3} from '../types';
import {DEFAULT_VISIBLE} from '../../atlas/anatomy';
import {nodeEngine} from './engine-node';
import {SCRIPTS} from '../issues';
import {bodyAt} from '../growth/proportions';
import {toDays,fromDays} from '../../health/dates';
import {BIRTH_DATE} from '../../health/types';
import {REJOIN_MS,APPROACH_MS} from '../director/types';
import {lerpPose,scalePose,adultPose,defaultPoseFor,focusPose,projectBox,projectedHeight,statureAt,dayOfDate,smootherstep,fitPose,DEFAULT_DIRECTION,type Pose,type Open,type Box} from '../camera/pose';

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
	{name:'lerpPose distance is geometric (t=.5 → √(d0·d1)) and the direction is a unit slerp',run(c){
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
		const stops=SCRIPTS.map(s=>({s,day:dayOfDate(s.onset)+(s.climax??0)})).sort((a,b)=>a.day-b.day);
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
	{name:'scalePose scales target and position about the origin and keeps the view offset',run(c){
		const p=scalePose(DEF,.3);c.near(p.position[1],DEF.position[1]*.3,1e-12,'position');c.near(p.target[2],DEF.target[2]*.3,1e-12,'target');c.assert(p.ox===DEF.ox&&p.oy===DEF.oy,'offset');
	}},
];
