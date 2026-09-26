/** Issue scripts, area `eyes-teeth`: infant exotropia, myopia, composite fillings and the wisdom teeth. Numbers: docs/anyhealth/timeline-medical-basis/eyes-teeth.md. Tooth eruption over growth is issues/teeth/eruption.ts (a GrowthFx, not a script). */
import type {IssueScript,PartFx,Vec3} from '../../types';
import {GLOBE,yaw} from '../eyes/globe';
import {wisdomLayer,WISDOM,WISDOM_ERUPT} from '../teeth/wisdom-layer';
import {toDays} from '../../../health/dates';
import {BIRTH_DATE} from '../../../health/types';
import {FRONT,LEFT_SIDE,RIGHT_FRONT,RIGHT_SIDE} from '../views';

const clamp01=(x:number)=>Math.min(1,Math.max(0,x));
/** 0 at a, 1 at b, smooth at both ends. */
const smooth=(a:number,b:number,x:number)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
const DEG=Math.PI/180;

// Exotropia: outward drift of the left eye measured by the corneal light reflex.
const HIRSCHBERG_DEG_PER_MM=7; // basis: eyes-teeth#hirschberg-ratio
const EXO_REFLEX_MM=1.5; // basis: eyes-teeth#exotropia-deviation
/** Days from onset (2003-07-07): full drift by the 1-month visit (2003-07-22), held through the 2-month visit (2003-08-22), straight by the 9-month visit (2004-03-22). */
const EXO_PEAK=15,EXO_HOLD=46,EXO_END=259; // basis: eyes-teeth#exotropia-course
const exoAngle=(d:number)=>d<0||d>=EXO_END?0:EXO_REFLEX_MM*HIRSCHBERG_DEG_PER_MM*DEG*(smooth(0,EXO_PEAK,d)-smooth(EXO_HOLD,EXO_END,d));

// Myopia: axial elongation of both globes.
const MYOPIA_MM_PER_D=0.35; // basis: eyes-teeth#myopia-mm-per-dioptre
const MYOPIA_D=1.0; // basis: eyes-teeth#myopia-refraction
const MYOPIA_PROGRESS_DAYS=730; // basis: eyes-teeth#myopia-progress

// Fillings: composite resin reads as a slightly whiter, bluish enamel on the whole crown.
const COMPOSITE:[number,number,number]=[0.85,0.89,0.96]; // basis: eyes-teeth#filling-tint
const COMPOSITE_AMOUNT=0.55; // basis: eyes-teeth#filling-tint
const REFILL:[number,number,number]=[0.9,0.94,1]; // basis: eyes-teeth#filling-refill
const REFILL_AMOUNT=0.7; // basis: eyes-teeth#filling-refill
const FILL_SET_DAYS=1; // basis: eyes-teeth#filling-set
const filled=(parts:string[],rgb:[number,number,number],amount:number)=>(d:number):PartFx[]=>d<=0?[]:parts.map(part=>({part,tint:[...rgb,amount*smooth(0,FILL_SET_DAYS,d)] as [number,number,number,number]}));

const T3='Right upper first secondary molar tooth',T30='Right lower first secondary molar tooth',T31='Right lower second secondary molar tooth';

// Wisdom teeth: socket healing on the gingiva after the extraction.
const GUMS=['Gingiva of upper jaw','Gingiva of lower jaw'];
const SOCKET_TINT:[number,number,number]=[0.72,0.3,0.3]; // basis: eyes-teeth#socket-tint
const SOCKET_AMOUNT=0.45; // basis: eyes-teeth#socket-tint
const SOCKET_RISE_DAYS=0.5,SOCKET_HEAL_DAYS=42; // basis: eyes-teeth#socket-healing
const WISDOM_ONSET='2023-12-26';

/** Days before onset that a script already shows anatomy: the wisdom layer draws the third molars from gingival emergence (the start of the ADA window, age 17) until the extraction. */
export const LEAD_DAYS:Record<string,number>={'wisdom-teeth-extraction':Math.ceil(toDays(WISDOM_ONSET)-toDays(BIRTH_DATE)-WISDOM_ERUPT[0]*365.25)}; // basis: eyes-teeth#erupt-third-molar

/** Every globe part turned by `angle` (yaw) or scaled along z by `sz`, about its globe centre. */
const globeFx=(side:'left'|'right',o:{rotate?:number;sz?:number}):PartFx[]=>{const G=GLOBE[side];return G.parts.map(part=>({part,pivot:[...G.centre] as Vec3,...(o.rotate?{rotate:yaw(o.rotate)}:{}),...(o.sz?{scale:[1,1,o.sz] as Vec3}:{})}));};

/** The eyes-teeth scripts. */
export const SCRIPTS:IssueScript[]=[
	{
		id:'infant-left-exotropia',parts:GLOBE.left.parts,onset:'2003-07-07',resolve:'2004-03-22',
		fxAt:d=>{const a=exoAngle(d);return a>0?globeFx('left',{rotate:a}):[];},
		status:d=>{const a=exoAngle(d);return a>0?`Left eye out ${(a/DEG).toFixed(0)}° (${(a/DEG/HIRSCHBERG_DEG_PER_MM).toFixed(1)} mm reflex)`:null;},
		climax:EXO_PEAK,approachDays:EXO_PEAK,view:FRONT, // basis: eyes-teeth#climax-exotropia
	},
	{
		id:'bilateral-myopia',parts:[...GLOBE.left.parts,...GLOBE.right.parts],onset:'2018-12-15',chronic:true,
		fxAt:d=>{if(d<=0)return [];const mm=MYOPIA_MM_PER_D*MYOPIA_D*smooth(0,MYOPIA_PROGRESS_DAYS,d);return (['left','right'] as const).flatMap(s=>globeFx(s,{sz:1+mm/1000/GLOBE[s].axialLength}));},
		status:d=>d<0?null:`−${MYOPIA_D.toFixed(2)} D · eye ${(MYOPIA_MM_PER_D*MYOPIA_D*smooth(0,MYOPIA_PROGRESS_DAYS,d)).toFixed(2)} mm longer`,
		climax:MYOPIA_PROGRESS_DAYS,approachDays:365,view:LEFT_SIDE, // basis: eyes-teeth#climax-myopia
	},
	{id:'first-cavity-filling-tooth-3',parts:[T3],onset:'2016-06-21',chronic:true,illustrative:true,fxAt:filled([T3],COMPOSITE,COMPOSITE_AMOUNT),status:d=>d<0?null:'#3 occlusal-lingual composite',
		climax:0.9*FILL_SET_DAYS,approachDays:FILL_SET_DAYS,view:RIGHT_FRONT}, // basis: eyes-teeth#climax-fillings
	{id:'fillings-teeth-30-31-composite',parts:[T30,T31],onset:'2019-06-28',chronic:true,illustrative:true,fxAt:filled([T30,T31],COMPOSITE,COMPOSITE_AMOUNT),status:d=>d<0?null:'#30 occlusal · #31 buccal composite',
		climax:0.9*FILL_SET_DAYS,approachDays:FILL_SET_DAYS,view:RIGHT_FRONT}, // basis: eyes-teeth#climax-fillings
	{id:'city-creek-fillings-30-31',parts:[T30,T31],onset:'2024-07-30',chronic:true,illustrative:true,fxAt:filled([T30,T31],REFILL,REFILL_AMOUNT),status:d=>d<0?null:'#30 DO · #31 MO composite',
		climax:0.9*FILL_SET_DAYS,approachDays:FILL_SET_DAYS,view:RIGHT_FRONT}, // basis: eyes-teeth#climax-fillings
	{
		id:'wisdom-teeth-extraction',parts:[...WISDOM.map(w=>w.second),...GUMS],onset:WISDOM_ONSET,chronic:true,illustrative:true,
		layer:()=>wisdomLayer(WISDOM_ONSET),
		fxAt:d=>{if(d<=0||d>=SOCKET_HEAL_DAYS)return [];const a=SOCKET_AMOUNT*smooth(0,SOCKET_RISE_DAYS,d)*(1-smooth(SOCKET_RISE_DAYS,SOCKET_HEAL_DAYS,d));return GUMS.map(part=>({part,tint:[...SOCKET_TINT,a] as [number,number,number,number]}));},
		status:d=>d<0?null:d<SOCKET_HEAL_DAYS?`Sockets healing · day ${Math.floor(d)}`:'Extracted',
		// The eve of the surgery: all four third molars in, #1 partly impacted (the layer draws them only before day 0).
		climax:-1,approachDays:365,view:RIGHT_SIDE, // basis: eyes-teeth#climax-wisdom
	},
];
