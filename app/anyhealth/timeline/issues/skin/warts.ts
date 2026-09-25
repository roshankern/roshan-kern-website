/** Common warts (verruca vulgaris), left hand (site unstated): three rough papules treated on the record date with cryotherapy + cantharidin (blister, dark crust, slough), one recurring and retreated. */
import type {Vec3} from '../../types';
import {anchorFor} from '../../../health/anchors';
import {fromDays,toDays} from '../../../health/dates';
import {hashSeed,mixHex,rng,smooth,spread,type MarkDef,type MarkState} from './marks';
import type {MarksSpec} from './marks-layer';

export const WARTS_ID='verruca-vulgaris-2018';
export const WARTS_ONSET='2018-08-24';
const WARTS=3; // basis: skin#wart-count
const BLISTER_FROM=1,BLISTER_UNTIL=7,SLOUGHED=14; // basis: skin#cantharidin-course
const RECUR_FROM=150,RECUR_FULL=195,RETREAT=210; // basis: skin#wart-recurrence
/** Resolve: the recurrence cleared after retreatment. */
export const WARTS_RESOLVE=fromDays(toDays(WARTS_ONSET)+RETREAT+30);
const WART=0xc9b49b,CRUST=0x6e4a3a,BLISTER=0xf4e9dc;

const seed=hashSeed(WARTS_ID),hand=anchorFor({id:WARTS_ID,category:'skin'}).hint as Vec3,marks:MarkDef[]=[];
spread(WARTS,.018,seed).forEach((uv,i)=>{const r=rng(seed+10+i)(),s=.003+r*.003;marks.push({at:hand,uv,shape:'rough',size:[s,s*(.85+r*.3),s*.3],color:WART,scaleDate:WARTS_ONSET,seed:seed+20+i,tag:'wart'});}); // basis: skin#wart-size
spread(WARTS,.018,seed).forEach((uv,i)=>{const r=rng(seed+10+i)(),s=.003+r*.003;marks.push({at:hand,uv,shape:'disc',size:[s*1.9,s*1.9,0],depth:.0002,color:BLISTER,scaleDate:WARTS_ONSET,seed:seed+40+i,tag:'blister'});});

/** One treatment on day `t0`: [wart alpha, wart colour, blister alpha] at day `d`. */
const treated=(d:number,t0:number):[number,number,number]=>{const e=d-t0;return [1-smooth(BLISTER_UNTIL,SLOUGHED,e),mixHex(WART,CRUST,smooth(BLISTER_FROM,BLISTER_UNTIL,e)),.8*smooth(0,BLISTER_FROM,e)*(1-smooth(BLISTER_UNTIL-2,BLISTER_UNTIL+3,e))];};

function state(d:number):MarkState[]{
	return marks.map((m,i)=>{
		if(d<0)return {alpha:0};const w=i%WARTS,wart=m.tag==='wart';
		let [a,col,b]=treated(d,0);
		if(w===0&&d>=RECUR_FROM)[a,col,b]=d<RETREAT?[smooth(RECUR_FROM,RECUR_FULL,d),WART,0]:treated(d,RETREAT);
		return wart?{alpha:a>1e-3?a:0,color:col}:{alpha:b>1e-3?b:0};
	});
}

/** Marks spec for the warts. */
export const WARTS_MARKS:MarksSpec={marks,state};
/** Tracker status line. */
export const wartsStatus=(d:number)=>d<0?null:d<SLOUGHED?'Cryotherapy + cantharidin':d<RECUR_FROM?'Cleared':d<RETREAT?'Recurred':d<RETREAT+SLOUGHED?'Retreated':'Cleared';
