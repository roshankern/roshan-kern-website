/** Issue scripts, area `systemic`: beta-thalassemia minor and its CBCs, food allergy, egg anaphylaxis, the walnut exposure, allergic rhinitis and immunotherapy. None of these has a literal anatomical change the atlas can show (blood cells, IgE, mucosal edema), so every script is a stylized, labelled-illustrative per-part effect. See docs/anyhealth/timeline-medical-basis/systemic.md. */
import type {IssueScript,PartFx,Vec3} from '../../types';
import {toDays,fromDays} from '../../../health/dates';
import {ARTERIAL_PARTS} from '../systemic/arterial-parts';
import {smooth,envelope,windowGlow,preRolled,pollenSeason,immunoFactor} from '../systemic/curves';
import {PRE_ROLL} from '../airway/shape';
import {FRONT,LEFT_SIDE} from '../views';

type Rgb=[number,number,number];
const tint=(part:string,rgb:Rgb,a:number):PartFx=>({part,tint:[rgb[0],rgb[1],rgb[2],a]});
const dateOf=(onset:string,day:number)=>fromDays(toDays(onset)+Math.floor(day));

// ── Beta-thalassemia minor ────────────────────────────────────────────────
/** Pale, orange-shifted red for small, hypochromic red cells. */
const THAL_RGB:Rgb=[0.86,0.52,0.40]; // basis: systemic#thal-tint
const THAL_A=0.18; // basis: systemic#thal-tint
const THAL_A_CONFIRMED=0.22; // basis: systemic#thal-confirmed-step
const THAL_CONFIRMED='2024-05-20'; // basis: systemic#thal-confirmed-step
const THAL_WINDOW_A=0.32; // basis: systemic#cbc-window
const THAL_RAMP=7; // basis: systemic#cbc-window
const CBC_LEN=30; // basis: systemic#cbc-window
/** The heart walls and the aorta: where a CBC's "blood" is shown. */
export const HEART_PARTS=['Wall of ventricle','Wall of left atrium','Wall of right atrium'];
export const AORTA_PARTS=['Ascending aorta','Arch of aorta','Descending aorta','Descending thoracic aorta','Abdominal aorta'];
const CBC_PARTS=[...HEART_PARTS,...AORTA_PARTS];

/** The chronic trait: every arterial part tinted from 2004-07-01; the amount steps up slightly at the 2024 confirmation. */
const thalassemia:IssueScript={
	id:'microcytosis-suspected-thalassemia-2004',parts:[...HEART_PARTS,...ARTERIAL_PARTS],onset:'2004-07-01',chronic:true,illustrative:true,
	// The first CBC at age 1 (the lowest absolute MCV, 55.5: first detection of a congenital trait), not the brighter post-2024 tint, which marks diagnostic certainty rather than severity.
	climax:0,approachDays:PRE_ROLL, // basis: systemic#climax-thalassemia
	fxAt(day,ctx){
		if(day<=-PRE_ROLL)return [];
		const confirmed=smooth(0,THAL_RAMP,toDays(ctx.date)-toDays(THAL_CONFIRMED));
		const a=preRolled(day)*(THAL_A+(THAL_A_CONFIRMED-THAL_A)*confirmed);
		return ARTERIAL_PARTS.map(p=>tint(p,THAL_RGB,a));
	},
	status:day=>day<0?null:dateOf('2004-07-01',day)>=THAL_CONFIRMED?'Beta-thalassemia minor · HbA2 4.9%':'Microcytosis · MCV 55.5 fL',
};
/** A 30-day window for one CBC or hematology visit: the heart and aorta tint a little more strongly, rising and falling over 7 days. */
const cbc=(id:string,onset:string,status:string):IssueScript=>({
	id,parts:CBC_PARTS,onset,resolve:fromDays(toDays(onset)+CBC_LEN),illustrative:true,
	climax:0,approachDays:PRE_ROLL, // basis: systemic#climax-record-window
	fxAt(day){const a=THAL_WINDOW_A*windowGlow(day,THAL_RAMP,CBC_LEN);return a>0?CBC_PARTS.map(p=>tint(p,THAL_RGB,a)):[];},
	status:()=>status,
});

// ── Food allergy ──────────────────────────────────────────────────────────
const ORAL=['Tongue','Lip'];
const ALLERGY_RGB:Rgb=[0.88,0.34,0.38]; // basis: systemic#food-allergy-tint
const FOOD_A=0.08; // basis: systemic#food-allergy-tint
const GLOW_A=0.26; // basis: systemic#allergy-test-glow
const GLOW_LEN=14; // basis: systemic#allergy-test-glow
const GLOW_RAMP=4; // basis: systemic#allergy-test-glow
const CONCHAE=['Left inferior nasal concha','Right inferior nasal concha'];

const foodAllergy:IssueScript={
	id:'peanut-tree-nut-food-allergy',parts:ORAL,onset:'2003-12-22',chronic:true,illustrative:true,
	climax:0,approachDays:PRE_ROLL,view:FRONT, // basis: systemic#climax-food-allergy
	fxAt(day){const a=FOOD_A*preRolled(day);return a>0?ORAL.map(p=>tint(p,ALLERGY_RGB,a)):[];},
	status:()=>'Peanut & tree nuts · IgE-mediated',
};
/** A 14-day glow for an allergy test: skin tests and CAP-RAST (2004), the specific-IgE panel (2016). */
const allergyTest=(id:string,onset:string,parts:string[],status:string,view:Vec3):IssueScript=>({
	id,parts,onset,resolve:fromDays(toDays(onset)+GLOW_LEN),illustrative:true,
	climax:0,approachDays:PRE_ROLL,view, // basis: systemic#climax-record-window
	fxAt(day){const a=GLOW_A*windowGlow(day,GLOW_RAMP,GLOW_LEN);return a>0?parts.map(p=>tint(p,ALLERGY_RGB,a)):[];},
	status:()=>status,
});

// ── Anaphylaxis (egg 2005) and the milder walnut exposure (2026) ─────────────
const TONGUE_SCALE=0.15; // basis: systemic#anaphylaxis-tongue
const LIP_SCALE=0.2; // basis: systemic#anaphylaxis-lip
const PHARYNX_SWELL=0.001; // basis: systemic#anaphylaxis-pharynx
const EPIGLOTTIS_SWELL=0.001; // basis: systemic#anaphylaxis-pharynx
const SUBGLOTTIC=-0.0015; // basis: systemic#anaphylaxis-subglottic
/** Rest-space y band of the upper trachea just below the cricoid (Trachea top y 1.4736; cricoid 1.4653–1.4828). */
const SUBGLOTTIC_BAND:[number,number]=[1.449,1.474]; // basis: systemic#anaphylaxis-subglottic
const PHARYNX=['Left superior pharyngeal constrictor','Right superior pharyngeal constrictor','Left middle pharyngeal constrictor','Right middle pharyngeal constrictor','Left inferior pharyngeal constrictor','Right inferior pharyngeal constrictor'];
const AIRWAY_PARTS=['Tongue','Lip',...PHARYNX,'Epiglottis','Trachea'];
const ANA_RISE=0.02,ANA_HOLD=0.25,ANA_END=2; // basis: systemic#anaphylaxis-timing
const WALNUT_SEVERITY=0.4,WALNUT_END=1; // basis: systemic#walnut
const ACUTE={from:-0.5,to:3,k:60}; // basis: systemic#anaphylaxis-timing
/** Guided-playback approach to a reaction's peak: the 2.4 h before it, so the half-hour rise plays in focus. */
const ANA_APPROACH=0.1; // basis: systemic#climax-anaphylaxis

const uni=(s:number):Vec3=>[s,s,s];
/** The angioedema pattern at strength `e` (0..1). */
function angioedema(e:number):PartFx[]{
	if(e<=0)return [];
	return [
		{part:'Tongue',scale:uni(1+TONGUE_SCALE*e)},{part:'Lip',scale:uni(1+LIP_SCALE*e)},
		...PHARYNX.map(part=>({part,swell:PHARYNX_SWELL*e})),{part:'Epiglottis',swell:EPIGLOTTIS_SWELL*e},
		{part:'Trachea',swell:SUBGLOTTIC*e,swellBand:SUBGLOTTIC_BAND},
	];
}
const reactionStatus=(day:number,rise:number,end:number)=>day<0||day>=end?null:day<rise?'Swelling building':day<rise*6?'Peak swelling':'Swelling easing';

const eggAnaphylaxis:IssueScript={
	id:'egg-anaphylaxis-daycare',parts:AIRWAY_PARTS,onset:'2005-05-02',resolve:'2005-05-04',illustrative:true,acute:[ACUTE],
	climax:ANA_RISE,approachDays:ANA_APPROACH,view:LEFT_SIDE, // basis: systemic#climax-anaphylaxis
	fxAt:day=>angioedema(envelope(day,ANA_RISE,ANA_HOLD,ANA_END)),
	status:day=>reactionStatus(day,ANA_RISE,ANA_END),
};
const walnut:IssueScript={
	id:'walnut-accidental-exposure-2026',parts:AIRWAY_PARTS,onset:'2026-03-01',resolve:'2026-03-02',illustrative:true,acute:[ACUTE],
	climax:ANA_RISE,approachDays:ANA_APPROACH,view:LEFT_SIDE, // basis: systemic#climax-anaphylaxis
	fxAt:day=>angioedema(WALNUT_SEVERITY*envelope(day,ANA_RISE,ANA_RISE,WALNUT_END)),
	status:day=>reactionStatus(day,ANA_RISE,WALNUT_END),
};

// ── Allergic rhinitis and immunotherapy ─────────────────────────────────────
const RHINITIS_BASE=0.0004; // basis: systemic#rhinitis-swell
const RHINITIS_SEASONAL=0.0006; // basis: systemic#rhinitis-swell
const RHINITIS_RGB:Rgb=[0.86,0.40,0.44],RHINITIS_A=0.12; // basis: systemic#rhinitis-swell
const RHINITIS_RAMP=14; // basis: systemic#rhinitis-swell
const IMMUNO_START='2022-08-01',IMMUNO_YEARS=3,IMMUNO_FLOOR=0.5; // basis: systemic#immunotherapy

const rhinitis:IssueScript={
	id:'allergic-rhinitis-oral-allergy-syndrome-2016',parts:CONCHAE,onset:'2016-07-11',chronic:true,illustrative:true,
	// The first spring tree-pollen peak after diagnosis (day of year 120, before immunotherapy damps the season).
	climax:toDays('2017-05-01')-toDays('2016-07-11'),approachDays:60,view:LEFT_SIDE, // basis: systemic#climax-rhinitis
	fxAt(day,ctx){
		if(day<=0)return [];
		const on=smooth(0,RHINITIS_RAMP,day),swell=on*(RHINITIS_BASE+RHINITIS_SEASONAL*pollenSeason(ctx.date)*immunoFactor(ctx.date,IMMUNO_START,IMMUNO_YEARS,IMMUNO_FLOOR));
		return CONCHAE.map(part=>({part,swell,tint:[RHINITIS_RGB[0],RHINITIS_RGB[1],RHINITIS_RGB[2],RHINITIS_A*on]}));
	},
	status:()=>'Cats, dust, pollens, molds',
};

/** Every systemic script (one per issue id this area owns). */
export const SCRIPTS:IssueScript[]=[
	foodAllergy,
	allergyTest('allergy-workup-tree-nuts-egg-2004','2004-07-01',ORAL,'Peanut class 5 · total IgE 524',FRONT),
	eggAnaphylaxis,
	rhinitis,
	allergyTest('allergy-ige-panel-2016','2016-12-21',[...ORAL,...CONCHAE],'Molds, cat, pollens · peanut class IV',FRONT),
	allergyTest('allergic-rhinitis-immunotherapy-eval','2022-08-01',CONCHAE,'Skin tests · allergy shots planned',LEFT_SIDE),
	walnut,
	thalassemia,
	cbc('first-abnormal-cbc-2023','2023-12-29','MCV 64 fL · RDW 18.9%'),
	cbc('hematology-eval-2024','2024-04-25','Thal-trait workup ordered'),
	cbc('beta-thalassemia-minor-confirmed-2024','2024-05-20','HbA2 4.9% · ferritin 67'),
	cbc('function-health-cbc-thalassemia-signature-2026','2026-06-18','MCV 62.9 fL · RBC 7.19'),
	cbc('function-health-out-of-range-2026','2026-06-18','Vitamin D 19 · HbA1c 5.8%'),
];
