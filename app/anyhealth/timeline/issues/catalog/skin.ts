/** Issue scripts, area `skin`: every skin issue draws small meshes on the Skin through the shared marks layer (issues/skin/marks-layer.ts). Medical basis: docs/anyhealth/timeline-medical-basis/skin.md. */
import type {IssueScript,Vec3} from '../../types';
import {marksLayer,type MarksSpec} from '../skin/marks-layer';
import {LACERATION_MARKS,LACERATION_LEAD,lacerationStatus,lacerationAcute} from '../skin/lacerations';
import {NEONATAL_ID,NEONATAL_ONSET,NEONATAL_RESOLVE,NEONATAL_MARKS,neonatalFx,neonatalStatus} from '../skin/neonatal';
import {ECZEMA_ID,ECZEMA_ONSET,ECZEMA_MARKS,eczemaStatus} from '../skin/eczema';
import {WARTS_ID,WARTS_ONSET,WARTS_RESOLVE,WARTS_MARKS,wartsStatus} from '../skin/warts';
import {ACNE_ID,ACNE_ONSET,ISO_ID,ISO_ONSET,ISO_END,ACNE_MARKS,ISO_MARKS,isoFx,acneStatus,isoStatus} from '../skin/acne';
import {toDays} from '../../../health/dates';
import {FRONT,FRONT_HIGH,RIGHT_FRONT} from '../views';

/** Each skin script's marks (definitions + pure state by day), by issue id. The checks read these directly. */
export const SKIN_MARKS:Record<string,MarksSpec>={
	[NEONATAL_ID]:NEONATAL_MARKS,[ECZEMA_ID]:ECZEMA_MARKS,...LACERATION_MARKS,[WARTS_ID]:WARTS_MARKS,[ACNE_ID]:ACNE_MARKS,[ISO_ID]:ISO_MARKS,
};
/** Scripts whose issue starts before the record date (the chin wound is a few days old at the follow-up call): days of lead, per the LEAD_DAYS ruling. */
export const LEAD_DAYS:Record<string,number>={...LACERATION_LEAD};

const layer=(id:string)=>()=>marksLayer(SKIN_MARKS[id],id);
/** Eczema climax: 2004-08-18, age 1.16 y, the crest of the first flare cycle after age 1 (patch count peaks there). */
const ECZEMA_CLIMAX=toDays('2004-08-18')-toDays(ECZEMA_ONSET); // basis: skin#climax-eczema
/** Isotretinoin climax: course day 112, the ISO_CURVE knot where 92% of lesions have cleared. */
const ISO_CLIMAX=112; // basis: skin#climax-isotretinoin
/** A laceration, held a quarter day after the injury (the wound repaired, sutures in, inflamed halo); the approach starts just before the injury so the cut appears in focus. basis: skin#climax-laceration */
const cut=(id:string,onset:string,view:Vec3,illustrative=false):IssueScript=>{const injury=-(LEAD_DAYS[id]??0);return {id,parts:['Skin'],onset,chronic:true,illustrative,acute:lacerationAcute(id),fxAt:()=>[],layer:layer(id),status:d=>lacerationStatus(id,d),climax:injury+0.25,approachDays:0.5,view};};

export const SCRIPTS:IssueScript[]=[
	// The 2-month visit (2003-08-22): cradle cap fully in, as noted there, with most cheek papules not yet cleared.
	{id:NEONATAL_ID,parts:['Skin','Hair of head'],onset:NEONATAL_ONSET,resolve:NEONATAL_RESOLVE,fxAt:d=>neonatalFx(d),layer:layer(NEONATAL_ID),status:neonatalStatus,
		climax:toDays('2003-08-22')-toDays(NEONATAL_ONSET),approachDays:14,view:FRONT_HIGH}, // basis: skin#climax-neonatal
	// Severe infant atopic dermatitis just past age 1, at a flare crest (the most patches showing).
	{id:ECZEMA_ID,parts:['Skin'],onset:ECZEMA_ONSET,chronic:true,fxAt:()=>[],layer:layer(ECZEMA_ID),status:eczemaStatus,
		climax:ECZEMA_CLIMAX,approachDays:ECZEMA_CLIMAX}, // basis: skin#climax-eczema
	// Chin: suture count and length are not recorded, so those are typical values.
	cut('chin-laceration-er-2010','2010-04-12',FRONT,true),
	cut('forehead-laceration-2011','2011-03-13',FRONT),
	cut('right-shin-laceration-2014','2014-01-24',RIGHT_FRONT),
	// The treatment visit: three untreated warts, before the cantharidin blister rises.
	{id:WARTS_ID,parts:['Skin'],onset:WARTS_ONSET,resolve:WARTS_RESOLVE,fxAt:()=>[],layer:layer(WARTS_ID),status:wartsStatus,climax:0.25,approachDays:0.5}, // basis: skin#climax-warts
	// Scarring is permanent, so the acne stays active (scars, fading PIH) after the course.
	{id:ACNE_ID,parts:['Skin'],onset:ACNE_ONSET,chronic:true,fxAt:()=>[],layer:layer(ACNE_ID),status:acneStatus,climax:0.5,approachDays:0.5,view:FRONT}, // basis: skin#climax-acne
	// Week 16 of the course: lesions down 92%, cheilitis at full strength.
	{id:ISO_ID,parts:['Skin','Lip'],onset:ISO_ONSET,resolve:ISO_END,illustrative:true,fxAt:d=>isoFx(d),layer:layer(ISO_ID),status:isoStatus,climax:ISO_CLIMAX,approachDays:ISO_CLIMAX,view:FRONT}, // basis: skin#climax-isotretinoin
];
