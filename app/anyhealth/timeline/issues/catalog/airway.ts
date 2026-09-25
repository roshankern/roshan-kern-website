/** Issue scripts, area `airway`: laryngomalacia, croup (an explicit episode list), the 2016 ER/PICU subglottitis and bronchoscopy, chronic asthma with flares, and COVID. Every medical number points at docs/anyhealth/timeline-medical-basis/airway.md. */
import type {IssueScript,PartFx,Quat} from '../../types';
import {toDays,fromDays} from '../../../health/dates';
import {BIRTH_DATE} from '../../../health/types';
import {smoothstep,dayHighlight,prng,PRE_ROLL} from '../airway/shape';
import {croupFx,activeEpisode,CROUP_TINT} from '../airway/croup';
import {BRONCHIAL_TREES,MAIN_BRONCHI,SEGMENTAL_TREES,VOCAL_FOLDS,EPIGLOTTIS_BASE} from '../airway/parts';

const HIGHLIGHT:[number,number,number]=[0.55,0.8,1];
const INFLAMED:[number,number,number]=[0.85,0.35,0.3];
const ICS_TINT:[number,number,number]=[0.5,0.7,0.95];
const COVID_TINT:[number,number,number]=[0.95,0.55,0.25];
const tinted=(parts:string[],rgb:[number,number,number],a:number):PartFx[]=>a>0?parts.map(part=>({part,tint:[...rgb,a] as [number,number,number,number]})):[];

// Laryngomalacia: symptoms from ~2 weeks of age, peak held from 2 to 4 months, gone by 15 months.
const LM_ONSET='2003-08-18',LM_START=14,LM_PEAK=[61,122],LM_END=457; // basis: airway#laryngomalacia-course
const LM_SCALE=[0.85,1,1.1],LM_TILT=-10*Math.PI/180; // basis: airway#laryngomalacia-shape
const ageDays=(onset:string,d:number)=>toDays(onset)-toDays(BIRTH_DATE)+d;
function laryngomalacia(d:number):PartFx[]{
	const a=ageDays(LM_ONSET,d),k=smoothstep(LM_START,LM_PEAK[0],a)*(1-smoothstep(LM_PEAK[1],LM_END,a));if(k<=0)return [];
	const h=LM_TILT*k/2,rotate:Quat=[Math.sin(h),0,0,Math.cos(h)];
	return [{part:'Epiglottis',scale:LM_SCALE.map(v=>v*k+(1-k)) as [number,number,number],rotate,pivot:[...EPIGLOTTIS_BASE]}];
}

/** Days of anatomy shown before the record date, per script (the laryngomalacia course starts at ~2 weeks of age, the record is at ~8 weeks). */
export const LEAD_DAYS:Record<string,number>={'infant-laryngomalacia-2003':toDays(LM_ONSET)-toDays(BIRTH_DATE)-LM_START}; // basis: airway#laryngomalacia-course

/** Absolute day (days since epoch, fractional) of `d` days after `onset`. */
const abs=(onset:string,d:number)=>toDays(onset)+d;
const croupStatus=(owner:Parameters<typeof activeEpisode>[0],onset:string)=>(d:number)=>{const a=activeEpisode(owner,abs(onset,d));return a?`Croup episode ${a.n} · day ${Math.max(0,Math.floor(d-(toDays(a.e.date)-toDays(onset))))+1}`:null;};

// Asthma: a chronic baseline on every bronchial tree, flares at the four visits, budesonide easing the baseline.
const ASTHMA_ONSET='2016-12-22';
const BASE_MM=0.3,BASE_TINT=0.12; // basis: airway#asthma-baseline
const FLARE_MM=0.8,FLARE_TINT=0.4,FLARE_DAYS=10,FLARE_HOLD=2; // basis: airway#asthma-flare
const FLARES=['2016-12-22','2022-08-01','2024-12-05','2026-09-02'].map(toDays); // basis: airway#asthma-flare-dates
const ICS_START=toDays('2026-09-02'),ICS_STOP=toDays('2026-09-15'),ICS_EASE=0.4,ICS_ONSET=7,ICS_WASHOUT=14; // basis: airway#ics-easing
/** 0..1 budesonide effect at absolute day t: builds over ICS_ONSET days on treatment, washes out over ICS_WASHOUT days after stopping. */
const icsEffect=(t:number)=>t<ICS_START?0:t<=ICS_STOP?smoothstep(0,ICS_ONSET,t-ICS_START):smoothstep(0,ICS_ONSET,ICS_STOP-ICS_START)*(1-smoothstep(0,ICS_WASHOUT,t-ICS_STOP));
const flareAt=(t:number)=>Math.max(0,...FLARES.map(f=>smoothstep(-PRE_ROLL,0,t-f)*(1-smoothstep(FLARE_HOLD,FLARE_DAYS,t-f))));
function asthma(d:number):PartFx[]{
	const t=abs(ASTHMA_ONSET,d),base=smoothstep(-PRE_ROLL,0,d)*(1-ICS_EASE*icsEffect(t));if(base<=0)return [];
	const f=flareAt(t),swell=-(BASE_MM*base+(FLARE_MM-BASE_MM)*f)*1e-3,a=BASE_TINT*base+(FLARE_TINT-BASE_TINT)*f;
	return BRONCHIAL_TREES.map(part=>({part,swell,tint:[...INFLAMED,a] as [number,number,number,number]}));
}

/** A visit/test window pointing at the bronchial trees: a one-day highlight on the visit day. */
const PFT_WINDOW=10; // basis: airway#pft-window
const visitHighlight=(d:number)=>tinted(BRONCHIAL_TREES,HIGHLIGHT,0.35*dayHighlight(d));

// COVID: patchy tint on a deterministic 40% of the segmental trees for 14 days.
const COVID_DAYS=14,COVID_SHARE=0.4; // basis: airway#covid
const COVID_PATCH:{part:string;a:number}[]=(()=>{const r=prng(20200828),pool=[...SEGMENTAL_TREES];for(let i=pool.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,Math.round(COVID_SHARE*pool.length)).map(part=>({part,a:0.25+0.2*r()}));})();

export const SCRIPTS:IssueScript[]=[
	{id:'infant-laryngomalacia-2003',parts:['Epiglottis'],onset:LM_ONSET,resolve:'2004-09-22',fxAt:d=>laryngomalacia(d), // basis: airway#laryngomalacia-course
		status:d=>{const a=ageDays(LM_ONSET,d);return a<LM_START||a>=LM_END?null:a<LM_PEAK[1]?'Floppy epiglottis · peak':'Outgrowing it';}},
	{id:'infant-croup-neck-xray-2003',parts:['Trachea'],onset:'2003-09-08',resolve:'2003-09-12',fxAt:d=>croupFx('infant-croup-neck-xray-2003',abs('2003-09-08',d)), // basis: airway#croup-course
		status:d=>d>=0&&d<4?`Subglottic narrowing · day ${Math.floor(d)+1}`:null},
	{id:'recurrent-croup-childhood',parts:['Trachea'],onset:'2004-01-15',resolve:'2016-12-15',fxAt:d=>croupFx('recurrent-croup-childhood',abs('2004-01-15',d)),
		status:croupStatus('recurrent-croup-childhood','2004-01-15')},
	{id:'sky-ridge-er-airway-2016',parts:['Trachea','Epiglottis',...VOCAL_FOLDS],onset:'2016-11-02',resolve:'2016-11-03',fxAt:d=>tinted(['Epiglottis',...VOCAL_FOLDS],CROUP_TINT,0.6*dayHighlight(d)), // basis: airway#er-2016
		status:d=>d>=0&&d<1?'Stridor, blue lips · epinephrine':null},
	{id:'chco-picu-subglottitis-2016',parts:['Trachea',...VOCAL_FOLDS],onset:'2016-11-02',resolve:'2016-11-04',fxAt:d=>{const fx=croupFx('chco-picu-subglottitis-2016',abs('2016-11-02',d));return fx.length?[...fx,...tinted(VOCAL_FOLDS,CROUP_TINT,fx[0].tint![3])]:[];}, // basis: airway#picu-2016
		status:d=>d>=0&&d<3?`PICU · day ${Math.floor(d)+1}`:null},
	{id:'microlaryngoscopy-bronchoscopy-2016',parts:['Epiglottis','Trachea',...MAIN_BRONCHI],onset:'2016-12-15',resolve:'2016-12-16',fxAt:d=>tinted(['Epiglottis','Trachea',...MAIN_BRONCHI],HIGHLIGHT,0.5*dayHighlight(d))}, // basis: airway#bronchoscopy-2016
	{id:'asthma-diagnosis-chronic',parts:[...BRONCHIAL_TREES],onset:ASTHMA_ONSET,chronic:true,fxAt:d=>asthma(d),
		status:d=>{const t=abs(ASTHMA_ONSET,d);return d<0?null:icsEffect(t)>0.05?'Easing on budesonide':flareAt(t)>0.05?'Flare':'Mild asthma · baseline';}},
	{id:'spirometry-asthma-confirmed-2022',parts:[...BRONCHIAL_TREES],onset:'2022-08-01',resolve:fromDays(toDays('2022-08-01')+PFT_WINDOW),fxAt:d=>visitHighlight(d)}, // basis: airway#pft-window
	{id:'pulmonary-reeval-2024',parts:[...BRONCHIAL_TREES],onset:'2024-12-05',resolve:fromDays(toDays('2024-12-05')+PFT_WINDOW),fxAt:d=>visitHighlight(d)}, // basis: airway#pft-window
	{id:'budesonide-formoterol-rx-2026',parts:[...BRONCHIAL_TREES],onset:'2026-09-02',resolve:'2026-09-15',fxAt:d=>tinted(BRONCHIAL_TREES,ICS_TINT,0.2*smoothstep(-PRE_ROLL,0,d)*(1-smoothstep(13,14,d)))}, // basis: airway#ics-easing
	{id:'covid-19-infection-2020',parts:COVID_PATCH.map(p=>p.part),onset:'2020-08-28',resolve:'2020-09-11',illustrative:true, // basis: airway#covid
		fxAt:d=>{const k=smoothstep(-PRE_ROLL,0,d)*(1-smoothstep(COVID_DAYS-4,COVID_DAYS,d));return k>0?COVID_PATCH.map(p=>({part:p.part,tint:[...COVID_TINT,p.a*k] as [number,number,number,number]})):[];}},
];
