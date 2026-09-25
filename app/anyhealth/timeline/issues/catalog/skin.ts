/** Issue scripts, area `skin`: every skin issue draws small meshes on the Skin through the shared marks layer (issues/skin/marks-layer.ts). Medical basis: docs/anyhealth/timeline-medical-basis/skin.md. */
import type {IssueScript} from '../../types';
import {marksLayer,type MarksSpec} from '../skin/marks-layer';
import {LACERATION_MARKS,lacerationStatus} from '../skin/lacerations';
import {NEONATAL_ID,NEONATAL_ONSET,NEONATAL_RESOLVE,NEONATAL_MARKS,neonatalFx,neonatalStatus} from '../skin/neonatal';
import {ECZEMA_ID,ECZEMA_ONSET,ECZEMA_MARKS,eczemaStatus} from '../skin/eczema';
import {WARTS_ID,WARTS_ONSET,WARTS_RESOLVE,WARTS_MARKS,wartsStatus} from '../skin/warts';
import {ACNE_ID,ACNE_ONSET,ISO_ID,ISO_ONSET,ISO_END,ACNE_MARKS,ISO_MARKS,isoFx,acneStatus,isoStatus} from '../skin/acne';

/** Each skin script's marks (definitions + pure state by day), by issue id. The checks read these directly. */
export const SKIN_MARKS:Record<string,MarksSpec>={
	[NEONATAL_ID]:NEONATAL_MARKS,[ECZEMA_ID]:ECZEMA_MARKS,...LACERATION_MARKS,[WARTS_ID]:WARTS_MARKS,[ACNE_ID]:ACNE_MARKS,[ISO_ID]:ISO_MARKS,
};
const layer=(id:string)=>()=>marksLayer(SKIN_MARKS[id]);
const cut=(id:string,onset:string,illustrative=false):IssueScript=>({id,parts:['Skin'],onset,chronic:true,illustrative,fxAt:()=>[],layer:layer(id),status:d=>lacerationStatus(id,d)});

export const SCRIPTS:IssueScript[]=[
	{id:NEONATAL_ID,parts:['Skin','Hair of head'],onset:NEONATAL_ONSET,resolve:NEONATAL_RESOLVE,fxAt:d=>neonatalFx(d),layer:layer(NEONATAL_ID),status:neonatalStatus},
	{id:ECZEMA_ID,parts:['Skin'],onset:ECZEMA_ONSET,chronic:true,fxAt:()=>[],layer:layer(ECZEMA_ID),status:eczemaStatus},
	// Chin: suture count and length are not recorded, so those are typical values.
	cut('chin-laceration-er-2010','2010-04-12',true),
	cut('forehead-laceration-2011','2011-03-13'),
	cut('right-shin-laceration-2014','2014-01-24'),
	{id:WARTS_ID,parts:['Skin'],onset:WARTS_ONSET,resolve:WARTS_RESOLVE,fxAt:()=>[],layer:layer(WARTS_ID),status:wartsStatus},
	// Scarring is permanent, so the acne stays active (scars, fading PIH) after the course.
	{id:ACNE_ID,parts:['Skin'],onset:ACNE_ONSET,chronic:true,fxAt:()=>[],layer:layer(ACNE_ID),status:acneStatus},
	{id:ISO_ID,parts:['Skin','Lip'],onset:ISO_ONSET,resolve:ISO_END,illustrative:true,fxAt:d=>isoFx(d),layer:layer(ISO_ID),status:isoStatus},
];
