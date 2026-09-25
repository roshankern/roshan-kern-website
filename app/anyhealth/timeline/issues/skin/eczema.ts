/** Eczema, atopic then dyshidrotic: infant nummular patches at the recorded sites (chin, elbow creases, back, thigh), severe at age 1 and fading through childhood; from age 2, dyshidrotic vesicle flares on the right palm (the anchor) that come less often and smaller with age, still flaring (controlled) after the 2022 dyshidrotic diagnosis. Chronic. */
import type {Vec3} from '../../types';
import {anchorFor} from '../../../health/anchors';
import {toDays,fromDays} from '../../../health/dates';
import {BIRTH_DATE} from '../../../health/types';
import {hashSeed,mirror,mixHex,ranks,rng,smooth,spread,type MarkDef,type MarkState} from './marks';
import type {MarksSpec} from './marks-layer';

export const ECZEMA_ID='childhood-atopic-dyshidrotic-eczema';
export const ECZEMA_ONSET='2003-10-23';
const onsetAge=toDays(ECZEMA_ONSET)-toDays(BIRTH_DATE),ageYears=(d:number)=>(d+onsetAge)/365.25;

// Natural history: severe by age 1 (record); then most childhood AD remits, ~20% persisting 8 years on (Kim 2016) → decay e^(−ln5·t/8y).
const PEAK_AGE=1,PERSIST_8Y=.2; // basis: skin#eczema-natural-history
/** Severity 0..1 at an age (years). */
export const eczemaSeverity=(a:number)=>a<PEAK_AGE?.6+.4*smooth(onsetAge/365.25,PEAK_AGE,a):Math.exp(Math.log(PERSIST_8Y)*(a-PEAK_AGE)/8);
const FLARE_PERIOD=120; // basis: skin#eczema-flares
const PALM_FROM_AGE=2,VESICLES=14,EPISODE=21,CONTROLLED_FLOOR=.3; // basis: skin#dyshidrotic-vesicles
const PATCH=0xd9776e,VESICLE=0xf3eadf,PEEL=0xe0cdb5;

const seed=hashSeed(ECZEMA_ID),palm=anchorFor({id:ECZEMA_ID,category:'skin'}).hint as Vec3;
// Infant sites from the record (4-month visit: back, thigh, elbow creases; chin at onset). Rest-space hints just outside the skin.
const elbow:Vec3=[-.225,1.115,.02];
const SITES:Vec3[]=[[0,1.495,.1],elbow,mirror(elbow),[.06,1.22,-.15],[-.06,1.22,-.15],[-.1,.7,.09]];
const marks:MarkDef[]=[];
SITES.forEach((at,s)=>spread(2,.015,seed+s).forEach((uv,i)=>{const r=rng(seed+20+s*4+i)();marks.push({at,uv,shape:'disc',size:[.012+r*.008,.01+r*.006,0],angle:r*Math.PI,color:PATCH,scaleDate:ECZEMA_ONSET,seed:seed+40+s*4+i,tag:'patch'});}));
// Palm vesicles, 1–2 mm (sized at age 10, mid-way through the palm years).
spread(VESICLES,.015,seed+3).forEach((uv,i)=>{const r=rng(seed+80+i)();marks.push({at:palm,uv,shape:'dome',size:[.001+r*.001,.001+r*.001,.0006],color:VESICLE,scaleDate:'2013-06-22',seed:seed+120+i,tag:'vesicle'});});
const patchIdx=marks.map((m,i)=>m.tag==='patch'?i:-1).filter(i=>i>=0),patchThr=ranks(patchIdx.length,seed+5).map(r=>.15+.8*(r+.5)/patchIdx.length);

// Palm flare episodes (days since onset): the gap grows from 2 to 6 months with age; each lasts 3 weeks. Deterministic (seeded), computed once.
const EPISODES:{start:number;n:number;order:number[]}[]=[];
{const g=rng(seed+9),end=toDays('2027-01-01')-toDays(ECZEMA_ONSET);let s=Math.round(PALM_FROM_AGE*365.25-onsetAge);
	for(let k=0;s<end;k++){const a=ageYears(s),sev=Math.max(CONTROLLED_FLOOR,eczemaSeverity(a));EPISODES.push({start:s,n:Math.max(2,Math.round(VESICLES*sev)),order:ranks(VESICLES,seed+1000+k)});s+=Math.round(Math.min(180,60+15*(a-PALM_FROM_AGE))*(.7+.6*g()));}} // basis: skin#eczema-flares
const episodeAt=(d:number)=>{for(let i=EPISODES.length-1;i>=0;i--)if(EPISODES[i].start<=d)return d-EPISODES[i].start<EPISODE?EPISODES[i]:null;return null;};

function state(d:number):MarkState[]{
	if(d<0)return marks.map(()=>({alpha:0}));
	const a=ageYears(d),flare=.65+.35*Math.sin(Math.PI*d/FLARE_PERIOD)**2,s=smooth(0,14,d)*eczemaSeverity(a)*flare,ep=episodeAt(d);
	let p=0,v=0;
	return marks.map(m=>{
		if(m.tag==='patch'){const t=patchThr[p++];return {alpha:s>t?.7*smooth(t,t+.1,s):0};}
		const j=v++;if(!ep||ep.order[j]>=ep.n)return {alpha:0};const e=d-ep.start;
		return {alpha:.9*smooth(0,3,e)*(1-smooth(EPISODE-7,EPISODE,e)),color:mixHex(VESICLE,PEEL,smooth(10,18,e))};
	});
}

/** Marks spec for eczema. */
export const ECZEMA_MARKS:MarksSpec={marks,state};
/** Tracker status line. */
export function eczemaStatus(d:number):string|null{
	if(d<0)return null;const a=ageYears(d),ep=episodeAt(d);
	return ep?`Palm flare · ${ep.n} vesicles`:a<PALM_FROM_AGE?(eczemaSeverity(a)>.8?'Severe atopic dermatitis':'Atopic patches'):fromDays(toDays(ECZEMA_ONSET)+d)>='2022-01-01'?'Dyshidrotic · controlled':'Mild · between flares';
}
