/** The explicit croup episode list and the subglottic narrowing it drives on the Trachea. See docs/anyhealth/timeline-medical-basis/airway.md. */
import type {PartFx} from '../../types';
import {toDays,fromDays} from '../../../health/dates';
import {smoothstep,prng,PRE_ROLL} from './shape';
import {SUBGLOTTIC_BAND} from './parts';

/** One croup episode. `date` is the documented (worst) day; the course ramps in over the pre-roll before it. */
export interface CroupEpisode {
	date:string;
	/** Peak inward swell of the subglottic band, millimetres. */
	mm:number;
	/** Days from `date` until the narrowing is gone. */
	len:number;
	/** Days from `date` the peak is held before it eases. */
	plateau:number;
	/** The issue script that shows this episode. */
	owner:'infant-croup-neck-xray-2003'|'recurrent-croup-childhood'|'chco-picu-subglottitis-2016';
	/** Whether the date comes from the record (true) or the seeded winter spread (false). */
	documented:boolean;
}

const COURSE=4; // basis: airway#croup-course
const PLATEAU=0.5; // basis: airway#croup-course
const PER_WINTER=3; // basis: airway#croup-winter
const MIN_GAP=14; // basis: airway#croup-winter
const SEED=20040115; // basis: airway#croup-seed

const fixed:CroupEpisode[]=[
	{date:'2003-09-08',mm:2.5,len:COURSE,plateau:PLATEAU,owner:'infant-croup-neck-xray-2003',documented:true}, // basis: airway#croup-infant-2003
	...['2004-01-15','2004-08-15','2006-06-15','2013-02-15'].map(date=>({date,mm:2.0,len:COURSE,plateau:PLATEAU,owner:'recurrent-croup-childhood' as const,documented:true})), // basis: airway#croup-documented
	{date:'2016-11-02',mm:3.5,len:3,plateau:1,owner:'chco-picu-subglottitis-2016',documented:true}, // basis: airway#picu-2016
];

/** About 3 episodes each winter (Oct 1 – Mar 31) from 2004–05 through 2015–16, minus documented ones in that winter, on seeded-random days at least MIN_GAP apart. Deterministic. */
function winterEpisodes():CroupEpisode[]{
	const rand=prng(SEED),out:CroupEpisode[]=[],taken=fixed.map(e=>toDays(e.date));
	for(let w=2004;w<=2015;w++){ // basis: airway#croup-winter
		const from=toDays(`${w}-10-01`),to=toDays(`${w+1}-03-31`);
		let need=PER_WINTER-taken.filter(t=>t>=from&&t<=to).length;
		while(need>0){
			const t=from+Math.floor(rand()*(to-from+1)),mm=1.5+rand()*1.0; // basis: airway#croup-severity
			if(taken.some(x=>Math.abs(x-t)<MIN_GAP))continue;
			taken.push(t);need--;out.push({date:fromDays(t),mm:Math.round(mm*100)/100,len:COURSE,plateau:PLATEAU,owner:'recurrent-croup-childhood',documented:false});
		}
	}
	return out;
}

/** Every croup episode, in date order. */
export const CROUP_EPISODES:CroupEpisode[]=[...fixed,...winterEpisodes()].sort((a,b)=>toDays(a.date)-toDays(b.date));
const START=CROUP_EPISODES.map(e=>toDays(e.date));

/** 0..1 severity of an episode `x` days after its date: ramps in over the pre-roll, holds the plateau, eases to 0 at `len`. */
export const episodeCourse=(e:CroupEpisode,x:number)=>smoothstep(-PRE_ROLL,0,x)*(1-smoothstep(e.plateau,e.len,x));

/** Timeline pacing (presentation, not a medical value): how many times slower than quiet time play runs through a croup episode, and through the 2016 ER / PICU stay. */
export const CROUP_PACE=12,PICU_PACE=30;
/** `acute` ranges (days relative to `onset`) for the owner's episodes: from the pre-roll to the end of each course. */
export const croupAcute=(owner:CroupEpisode['owner'],onset:string,k:number)=>CROUP_EPISODES.filter(e=>e.owner===owner).map(e=>{const d=toDays(e.date)-toDays(onset);return {from:d-PRE_ROLL,to:d+e.len,k};});

/** Croup red. */
export const CROUP_TINT:[number,number,number]=[0.85,0.2,0.18];
const TINT_MAX=0.55;

/** The owner's episode active at absolute day `t` (days since epoch, fractional), with its 0..1 course, or null. */
export function activeEpisode(owner:CroupEpisode['owner'],t:number):{e:CroupEpisode;k:number;n:number}|null{
	let best:{e:CroupEpisode;k:number;n:number}|null=null;
	CROUP_EPISODES.forEach((e,i)=>{if(e.owner!==owner)return;const k=episodeCourse(e,t-START[i]);if(k>0&&(!best||k>best.k))best={e,k,n:CROUP_EPISODES.filter((f,j)=>f.owner===owner&&j<=i).length};});
	return best;
}

/** Trachea fx for the owner's episodes at absolute day `t`: an inward swell of the subglottic band and a red tint, or [] when quiet. */
export function croupFx(owner:CroupEpisode['owner'],t:number):PartFx[]{
	let swell=0,tint=0;
	CROUP_EPISODES.forEach((e,i)=>{if(e.owner!==owner)return;const k=episodeCourse(e,t-START[i]);if(k<=0)return;swell-=e.mm*1e-3*k;tint=Math.max(tint,TINT_MAX*k);});
	return swell===0?[]:[{part:'Trachea',swell,swellBand:[...SUBGLOTTIC_BAND],tint:[...CROUP_TINT,tint]}];
}
