/** Neonatal acne (cheek papules, noted at the 1-month visit 7/21/03) and cradle cap (yellow scalp scale, noted at the 2- and 4-month visits). */
import type {PartFx,Vec3} from '../../types';
import {anchorFor} from '../../../health/anchors';
import {toDays} from '../../../health/dates';
import {BIRTH_DATE} from '../../../health/types';
import {hashSeed,mirror,ranks,rng,smooth,spread,type MarkDef,type MarkState} from './marks';
import type {MarksSpec} from './marks-layer';

export const NEONATAL_ID='neonatal-acne-cradle-cap';
export const NEONATAL_ONSET='2003-07-21';
const ageDay=(d:number)=>d+toDays(NEONATAL_ONSET)-toDays(BIRTH_DATE);

const PAPULES=16; // basis: skin#neonatal-papules
const CLEAR_AGE_DAYS=90; // basis: skin#neonatal-acne-course
const CAP_RAMP=14,CAP_HOLD_UNTIL=toDays('2003-10-22')-toDays(NEONATAL_ONSET),CAP_GONE=toDays('2003-11-22')-toDays(NEONATAL_ONSET); // basis: skin#cradle-cap-course
/** Resolve date: cradle cap gone (about 5 months of age). */
export const NEONATAL_RESOLVE='2003-11-22';
const SCALE=0xe2c577,SCALE_TINT:[number,number,number]=[.89,.78,.48],CAP_TINT=.25; // basis: skin#cradle-cap-course

const cheek=anchorFor({id:NEONATAL_ID,category:'skin'}).hint as Vec3,scalp:Vec3=[0,1.75,-.02],seed=hashSeed(NEONATAL_ID);

const marks:MarkDef[]=[];
// Papules: half on each cheek, spread over ~2 cm (rest space); 1–2 mm red or white bumps.
[cheek,mirror(cheek)].forEach((at,side)=>spread(PAPULES/2,.02,seed+side).forEach((uv,i)=>{const r=rng(seed+100+side*50+i)();marks.push({at,uv,shape:'dome',size:[.001+r*.001,.001+r*.001,.0004],color:r<.25?0xf1e4cf:0xd06a66,scaleDate:NEONATAL_ONSET,seed:seed+200+side*50+i,tag:'papule'});}));
// Cradle cap: greasy yellow scale patches over the crown and front of the scalp (5–15 mm).
spread(10,.05,seed+7).forEach((uv,i)=>{const r=rng(seed+300+i)();marks.push({at:scalp,uv,shape:'disc',size:[.006+r*.009,.005+r*.007,.0001],angle:r*Math.PI,color:SCALE,scaleDate:NEONATAL_ONSET,seed:seed+400+i,tag:'scale'});});

const papRank=ranks(PAPULES,seed+9),firstClear=14,lastClear=CLEAR_AGE_DAYS-(toDays(NEONATAL_ONSET)-toDays(BIRTH_DATE));
/** Cradle cap strength 0..1 on day `d` since onset. */
const cap=(d:number)=>d<0?0:smooth(0,CAP_RAMP,d)*(1-smooth(CAP_HOLD_UNTIL,CAP_GONE,d));

function state(d:number):MarkState[]{
	let p=0;
	return marks.map(m=>{
		if(d<0)return {alpha:0};
		if(m.tag==='papule'){const clear=firstClear+(lastClear-firstClear)*(papRank[p++]+1)/PAPULES;return {alpha:d<clear?1:0};}
		return {alpha:.85*cap(d)};
	});
}

/** Marks spec for neonatal acne & cradle cap. */
export const NEONATAL_MARKS:MarksSpec={marks,state};
/** Cradle cap also tints the scalp hair faintly yellow while it lasts. */
export const neonatalFx=(d:number):PartFx[]=>{const a=CAP_TINT*cap(d);return a>0?[{part:'Hair of head',tint:[...SCALE_TINT,a]}]:[];};
/** Tracker status line. */
export const neonatalStatus=(d:number)=>d<0?null:ageDay(d)<CLEAR_AGE_DAYS?'Cheek papules · scalp scale':cap(d)>0?'Cradle cap':'Cleared';
