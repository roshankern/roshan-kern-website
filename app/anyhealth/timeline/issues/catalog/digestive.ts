/** Issue scripts, area `digestive`: childhood encopresis (rectum + descending colon dilation and recovery), silent reflux (LPR), the 2026 GERD course and nightly famotidine. Every medical number points at docs/anyhealth/timeline-medical-basis/digestive.md. */
import type {IssueScript,PartFx,Vec3} from '../../types';
import {toDays} from '../../../health/dates';

const clamp01=(x:number)=>Math.min(1,Math.max(0,x));
/** 0→1 with zero slope at both ends. */
const smooth=(x:number)=>{const t=clamp01(x);return t*t*(3-2*t);};
/** Day of `date` counted from `onset`. */
const day=(onset:string,date:string)=>toDays(date)-toDays(onset);

/** Days before the record date that a script's anatomy starts developing (the shared "no effect before onset" check samples day −(lead+1) for these ids). */
export const LEAD_DAYS:Record<string,number>={
	'encopresis-constipation-childhood':182, // basis: digestive#encopresis-lead
	'silent-reflux-lpr-omeprazole':365, // basis: digestive#lpr-lead
};

// ---- Encopresis / chronic constipation, 2010-01-19 → 2012-06-22 ----
const ENC_ONSET='2010-01-19',ENC_END='2012-06-22';
/** Rest bounds of the atlas `Rectum` (public/anyhealth/models/atlas.json). The pivot sits at the anorectal end (min y), the posterior wall (min z) and the midline centre (x): the puborectalis sling and the sacral hollow hold those two walls, so the ampulla dilates up and forward, into soft bladder/prostate, not back through the sacrum or down through the pelvic floor. */
const RECTUM_PIVOT:Vec3=[(-0.0262148+0.0354317)/2,0.8354382,-0.0887192];
const RECTUM_PEAK=1.45; // basis: digestive#rectal-diameter-ratio
const RECTUM_Y_PEAK=1.1; // basis: digestive#rectal-length-factor
/** Rest half-width of the descending colon's vertical limb (4.7–5.0 cm wide in the atlas mesh). */
const COLON_R=0.024;
const COLON_PEAK=1.07; // basis: digestive#descending-colon-ratio
const ENC_TAU=63; // basis: digestive#encopresis-treatment-tau
const MIRALAX_STOP=day(ENC_ONSET,'2010-10-15'); // basis: digestive#encopresis-relapse-dates
const CLEAN_OUT=day(ENC_ONSET,'2010-12-15'); // basis: digestive#encopresis-relapse-dates
const RELAPSE=(CLEAN_OUT-MIRALAX_STOP)/LEAD_DAYS['encopresis-constipation-childhood']; // basis: digestive#encopresis-relapse-amount
const CLEAN_OUT_DAYS=5; // basis: digestive#disimpaction-days
const CONCERN_FLOOR=0.1; // basis: digestive#encopresis-residual
const ENC_LAST=day(ENC_ONSET,ENC_END);
const LOAD_TINT:[number,number,number]=[0.25,0.17,0.1]; // faecal loading: darker brown (illustrative colour)
const LOAD_RECTUM=0.45,LOAD_COLON=0.25; // basis: digestive#faecal-loading-tint

/** Fraction of the peak dilation (`wall`) and of the faecal load (`load`) on day `d` since diagnosis. */
function encopresis(d:number):{wall:number;load:number}{
	const lead=LEAD_DAYS['encopresis-constipation-childhood'];
	if(d<=-lead||d>=ENC_LAST)return {wall:0,load:0};
	if(d<0){const w=smooth((d+lead)/lead);return {wall:w,load:w};}
	const first=Math.exp(-d/ENC_TAU);
	if(d<CLEAN_OUT){const w=first+RELAPSE*smooth((d-MIRALAX_STOP)/(CLEAN_OUT-MIRALAX_STOP));return {wall:w,load:w};}
	// After the clean-out: the wall recovers over months towards a residual that tapers to zero by the end date; the load empties within the disimpaction days.
	const floor=CONCERN_FLOOR*(ENC_LAST-d)/(ENC_LAST-CLEAN_OUT),start=Math.exp(-CLEAN_OUT/ENC_TAU)+RELAPSE;
	const wall=floor+(start-CONCERN_FLOOR)*Math.exp(-(d-CLEAN_OUT)/ENC_TAU);
	return {wall,load:floor+(start-CONCERN_FLOOR)*(1-smooth((d-CLEAN_OUT)/CLEAN_OUT_DAYS))*Math.exp(-(d-CLEAN_OUT)/ENC_TAU)};
}

// ---- Silent reflux (LPR), 2026-01-03 ----
/** Rest top of the atlas `Esophagus` (y, metres); the band is its top 5 cm, the laryngopharyngeal junction region. */
const ESOPHAGUS_TOP=1.4685012;
const LPR_BAND:[number,number]=[ESOPHAGUS_TOP-0.05,ESOPHAGUS_TOP];
const INFLAMED:[number,number,number]=[0.8,0.22,0.2];
const LPR_TINT=0.3; // basis: digestive#lpr-tint
const LPR_SWELL=0.0008; // basis: digestive#lpr-swell
const LPR_FADE=84; // basis: digestive#lpr-fade

// ---- GERD 2026-08-11 → 08-28, then nightly famotidine from 2026-09-02 ----
const GERD_ONSET='2026-08-11';
const GERD_RAMP=2; // basis: digestive#display-ramp
const PPI_START=day(GERD_ONSET,'2026-08-14'),PPI_END=day(GERD_ONSET,'2026-08-28'); // basis: digestive#gerd-course
const FAM_START=day(GERD_ONSET,'2026-09-02');
const GERD_ESOPHAGUS=0.22,GERD_STOMACH=0.12; // basis: digestive#gerd-tint
const RESID_ESOPHAGUS=0.04,RESID_STOMACH=0.02; // basis: digestive#famotidine-residual

const reflux=(esophagus:number,stomach:number):PartFx[]=>[{part:'Esophagus',tint:[...INFLAMED,esophagus]},{part:'Stomach',tint:[...INFLAMED,stomach]}];

export const SCRIPTS:IssueScript[]=[
	{id:'encopresis-constipation-childhood',parts:['Rectum','Descending colon'],onset:ENC_ONSET,resolve:ENC_END,
		fxAt(d){
			const {wall,load}=encopresis(d);if(wall<=0&&load<=0)return [];
			const r=1+(RECTUM_PEAK-1)*wall;
			return [
				{part:'Rectum',scale:[r,1+(RECTUM_Y_PEAK-1)*wall,r],pivot:RECTUM_PIVOT,tint:[...LOAD_TINT,LOAD_RECTUM*load]},
				// The descending colon curves medially into the rectum, so a scale about its bounds centre would pull its two limbs apart; a swell along the normals widens the tube in place. basis: digestive#descending-colon-ratio
				{part:'Descending colon',swell:(COLON_PEAK-1)*COLON_R*wall,tint:[...LOAD_TINT,LOAD_COLON*load]},
			];
		},
		status(d){if(d<0)return 'Stool withholding';if(d<MIRALAX_STOP)return 'Miralax + behaviour plan';if(d<CLEAN_OUT)return 'Relapse off Miralax';if(d<CLEAN_OUT+CLEAN_OUT_DAYS)return 'Clean-out';return d<ENC_LAST?'Maintenance Miralax':null;}},
	{id:'silent-reflux-lpr-omeprazole',parts:['Esophagus'],onset:'2026-01-03',resolve:'2026-03-28',illustrative:true,
		fxAt(d){
			const a=d<0?smooth((d+LEAD_DAYS['silent-reflux-lpr-omeprazole'])/LEAD_DAYS['silent-reflux-lpr-omeprazole']):1-smooth(d/LPR_FADE);
			return a>0?[{part:'Esophagus',tint:[...INFLAMED,LPR_TINT*a],swell:LPR_SWELL*a,swellBand:LPR_BAND}]:[];
		},
		status(d){return d<0?null:d<LPR_FADE?`Omeprazole · week ${Math.floor(d/7)+1}`:null;}},
	{id:'gerd-diagnosis-pantoprazole-famotidine-2026',parts:['Esophagus','Stomach'],onset:GERD_ONSET,resolve:'2026-08-28',illustrative:true,
		fxAt(d){
			// Ramps in at diagnosis, holds until the course starts, fades over the 15-day course to the famotidine residual, then hands over when famotidine starts (merged tint = the higher, so the handoff is seamless).
			if(d<=0||d>=FAM_START)return [];
			const on=smooth(d/GERD_RAMP),k=1-smooth((d-PPI_START)/(PPI_END-PPI_START));
			return reflux(on*(RESID_ESOPHAGUS+(GERD_ESOPHAGUS-RESID_ESOPHAGUS)*k),on*(RESID_STOMACH+(GERD_STOMACH-RESID_STOMACH)*k));
		},
		status(d){return d<PPI_START?'Diagnosed · no esophagitis':d<=PPI_END?`Pantoprazole + famotidine · day ${Math.floor(d-PPI_START)+1} of 15`:null;}},
	{id:'famotidine-nightly-rx-2026',parts:['Esophagus','Stomach'],onset:'2026-09-02',chronic:true,illustrative:true,
		fxAt(d){return d<0?[]:reflux(RESID_ESOPHAGUS,RESID_STOMACH);},
		status(){return 'Famotidine 40 mg nightly';}},
];
