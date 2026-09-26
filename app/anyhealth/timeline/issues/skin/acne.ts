/** Facial acne (diagnosed 2021-08-25: comedonal + inflammatory, with scarring and PIH) and the isotretinoin course that cleared it (2022-01-03 → 06-28).
 *
 * Both scripts draw the same seeded marks (lesions, scars, PIH) with the same look: the acne layer throughout except while isotretinoin is focused (`yieldsTo`), the isotretinoin layer during its course and only while isotretinoin is focused (`onlyIsolated`), so the two copies never draw together (not even ghosted). Isolating either one shows the lesions clearing. Lesion i shows while the remaining fraction for its group exceeds its seeded threshold, so the count follows the cited response curves. */
import type {PartFx,Vec3} from '../../types';
import {anchorFor} from '../../../health/anchors';
import {toDays} from '../../../health/dates';
import {hashSeed,knots,mirror,ranks,rng,smooth,spread,type MarkDef,type MarkState,type MarkShape} from './marks';
import type {MarksSpec} from './marks-layer';

export const ACNE_ID='acne-diagnosis-topical-treatment',ISO_ID='isotretinoin-accutane-course';
export const ACNE_ONSET='2021-08-25',ISO_ONSET='2022-01-03',ISO_END='2022-06-28';
const ISO_START=toDays(ISO_ONSET)-toDays(ACNE_ONSET),ISO_DAYS=toDays(ISO_END)-toDays(ISO_ONSET);

// Lesion counts: moderate-to-severe by Lehmann's counts (comedones 20–100, inflammatory 15–50), with scarring.
const COMEDONES=[13,13,11,7],INFLAMMATORY=[9,9,7,5],SCARS=8,PIH=10; // basis: skin#acne-lesion-counts
// Topicals + sarecycline (to day ISO_START): a partial response, below the trials' ~50% inflammatory reduction at 12 weeks since the record calls it a failure.
const PRE_INFLAMMATORY:[number,number][]=[[0,1],[21,.9],[ISO_START,.7]],PRE_COMEDONES:[number,number][]=[[0,1],[21,.95],[ISO_START,.8]]; // basis: skin#topical-response
// Isotretinoin: fraction of pre-course lesions left, by course day.
const ISO_CURVE:[number,number][]=[[0,1],[56,.62],[84,.38],[112,.08],[ISO_DAYS,0]]; // basis: skin#isotretinoin-response
const PIH_FADE=365; // basis: skin#pih-fade
const CHEILITIS_RAMP=14,CHEILITIS_CLEAR=14,LIP_DRY:[number,number,number]=[.86,.7,.66],LIP_AMOUNT=.45; // basis: skin#isotretinoin-cheilitis

const seed=hashSeed(ACNE_ID),cheek=anchorFor({id:ACNE_ID,category:'skin'}).hint as Vec3;
const REGIONS:{at:Vec3;r:number}[]=[{at:cheek,r:.02},{at:mirror(cheek),r:.02},{at:[0,1.655,.1],r:.025},{at:[0,1.5,.1],r:.015}];
const lesions:MarkDef[]=[],scars:MarkDef[]=[];
const mk=(at:Vec3,uv:[number,number],shape:MarkShape,s:number,h:number,color:number,tag:string,sd:number):MarkDef=>({at,uv,shape,size:[s,s,h],color,scaleDate:ACNE_ONSET,seed:sd,tag});
REGIONS.forEach((g,ri)=>{
	const n=COMEDONES[ri]+INFLAMMATORY[ri],pts=spread(n,g.r,seed+ri),r=rng(seed+50+ri);
	pts.forEach((uv,i)=>{const x=r();if(i<COMEDONES[ri])lesions.push(x<.5?mk(g.at,uv,'disc',.0007+x*.0006,0,0x3d2b22,'comedone',seed+100+ri*60+i):mk(g.at,uv,'dome',.0009+x*.0004,.0003,0xeee0cc,'comedone',seed+100+ri*60+i));
		else lesions.push(x<.2?mk(g.at,uv,'dome',.002+x*.004,.0009,0xecd592,'inflammatory',seed+100+ri*60+i):mk(g.at,uv,'dome',.002+x*.002,.001,0xc2463f,'inflammatory',seed+100+ri*60+i));}); // basis: skin#acne-lesion-size
});
// Atrophic scars (ice pick < 2 mm, boxcar 1–4 mm) on the cheeks; PIH macules on the cheeks and chin, placed between lesions.
[0,1].forEach(ri=>spread(SCARS/2,REGIONS[ri].r*.8,seed+200+ri).forEach((uv,i)=>{const x=rng(seed+210+ri*10+i)();scars.push({...mk(REGIONS[ri].at,uv,'disc',.001+x*.002,0,0xb98f8a,'scar',seed+220+ri*10+i),depth:.00025});})); // basis: skin#acne-scar-size
[0,1,3].forEach((ri,k)=>spread(Math.round(PIH*(k<2?.4:.2)),REGIONS[ri].r*.9,seed+300+ri).forEach((uv,i)=>{const x=rng(seed+310+ri*10+i)();scars.push({...mk(REGIONS[ri].at,[uv[1],-uv[0]],'disc',.003+x*.002,0,0x9a6a55,'pih',seed+320+ri*10+i),depth:.00022});}));

const isInfl=lesions.map(m=>m.tag==='inflammatory'),groupRank=(infl:boolean)=>ranks(lesions.filter((_,i)=>isInfl[i]===infl).length,seed+(infl?7:8));
const thr:number[]=(()=>{const ri=groupRank(true),rc=groupRank(false);let a=0,b=0;return lesions.map((_,i)=>isInfl[i]?(ri[a++]+.5)/ri.length:(rc[b++]+.5)/rc.length);})();

/** Fraction of each group's lesions present on acne day `d` (since diagnosis). */
function remaining(d:number,infl:boolean){
	if(d<0)return 0;const pre=infl?PRE_INFLAMMATORY:PRE_COMEDONES;
	if(d<ISO_START)return knots(pre,d);const e=d-ISO_START;return e>ISO_DAYS?0:knots(pre,ISO_START)*knots(ISO_CURVE,e);
}
const lesionOn=(d:number,i:number)=>remaining(d,isInfl[i])>thr[i];

/** Active acne lesions (comedones + inflammatory) on a date, whichever layer draws them. */
export const acneLesionCount=(date:string)=>{const d=toDays(date)-toDays(ACNE_ONSET);return lesions.filter((_,i)=>lesionOn(d,i)).length;};

const marks=[...lesions,...scars];
/** Every acne mark on acne day `d`: lesions per the response curves, scars forever, PIH fading over a year after the course. */
const acneState=(d:number):MarkState[]=>[
	...lesions.map((_,i):MarkState=>({alpha:lesionOn(d,i)?1:0})),
	...scars.map((m):MarkState=>d<0?{alpha:0}:m.tag==='scar'?{alpha:.55}:{alpha:.45*(1-smooth(ISO_START+ISO_DAYS,ISO_START+ISO_DAYS+PIH_FADE,d))}),
];
/** Acne layer: every acne mark, throughout, except while isotretinoin is focused (its layer draws them then; a ghosted second copy would double them). */
export const ACNE_MARKS:MarksSpec={marks,yieldsTo:ISO_ID,state:acneState};
/** Isotretinoin layer: the same marks and look during the course (day = days since 2022-01-03), nothing outside it; drawn only while isotretinoin is focused (the acne layer shows them otherwise). */
export const ISO_MARKS:MarksSpec={marks,onlyIsolated:true,state:e=>e>=0&&e<=ISO_DAYS?acneState(e+ISO_START):marks.map(()=>({alpha:0}))};

/** Isotretinoin cheilitis (lip dryness), illustrative: in within two weeks, gone two weeks after stopping. */
export const isoFx=(e:number):PartFx[]=>{const a=e<0?0:LIP_AMOUNT*smooth(0,CHEILITIS_RAMP,e)*(1-smooth(ISO_DAYS,ISO_DAYS+CHEILITIS_CLEAR,e));return a>0?[{part:'Lip',tint:[...LIP_DRY,a]}]:[];};

/** Tracker status lines. */
export const acneStatus=(d:number)=>d<0?null:d<ISO_START?`${lesions.filter((_,i)=>lesionOn(d,i)).length} active lesions · topicals`:d<=ISO_START+ISO_DAYS?'On isotretinoin':'Scars · fading PIH';
export const isoStatus=(e:number)=>e<0?null:e<=ISO_DAYS?`Week ${Math.floor(e/7)+1} · lesions −${Math.round((1-knots(ISO_CURVE,e))*100)}%`:'Course complete';
