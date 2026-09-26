/** The timeline bar's marks in director mode, where the track is story time (storyMs/totalMs), not the calendar. Pure. */
import type {Schedule} from './director/types';
import {BIRTH_DATE} from '../health/types';
import {toDays} from '../health/dates';

/** Minimum track distance between two year labels. */
export const YEAR_GAP=0.07;
const B=toDays(BIRTH_DATE),frac=(s:Schedule,ms:number)=>s.totalMs>0?Math.max(0,Math.min(1,ms/s.totalMs)):0;

/** One tick per stop, at its hold instant. */
export const stopTicks=(s:Schedule)=>s.stops.map((x,i)=>({t:frac(s,s.holdMs[i]),title:x.title}));

/** Jan 1 of each year after birth through today's, placed by story time; a label is kept only when ≥ YEAR_GAP after the last kept one (holds and dense stretches bunch years together). */
export function yearMarks(s:Schedule,today:string,gap=YEAR_GAP):{year:number;t:number}[]{
	const out:{year:number;t:number}[]=[];
	for(let y=+BIRTH_DATE.slice(0,4)+1;y<=+today.slice(0,4);y++){const t=frac(s,s.storyMsForDay(toDays(`${y}-01-01`)-B));if(t<=1-gap/2&&(!out.length||t-out[out.length-1].t>=gap))out.push({year:y,t});}
	return out;
}

/** A drag / arrow-key position (track fraction, clamped to [0,1]) → its story time, for seekMs: the handle lands exactly where it was dragged, even over the same-day flats (a day would map back to the flat's first instant). */
export const msAtFraction=(s:Schedule,t:number)=>Math.max(0,Math.min(1,t))*s.totalMs;
