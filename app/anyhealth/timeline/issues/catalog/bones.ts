/** Issue scripts, area `bones`: the 2009 left humerus fracture (a CustomLayer ported from app/anyhealth/fracture, healing model from fracture/model.ts), its day-23 callus record, and upper-thoracic scoliosis (part effects). Medical basis: docs/anyhealth/timeline-medical-basis/bones.md. */
import type {IssueScript} from '../../types';
import {toDays,fromDays} from '../../../health/dates';
import {FRACTURE_DATE,FRACTURE_PART,HEALED_DAY,TIMELINE_DENSITY,fractureAt} from '../../../fracture/model';
import {fractureLayer} from '../bones/fracture-layer';
import {SCOLIOSIS_LEAD_DAYS,SCOLIOSIS_PARTS,SCOLIOSIS_RECORD,scoliosisFx} from '../bones/scoliosis';
import {BACK} from '../views';

/** The fracture is drawn until it has fully remodelled (fracture/model.ts HEALED_DAY). */
const HEALED=fromDays(toDays(FRACTURE_DATE)+HEALED_DAY); // basis: bones#fracture-healed-day

/** Days before onset that a script already shows anatomy (the shared "no effect before onset" check samples −(lead+1)). */
export const LEAD_DAYS:Record<string,number>={'scoliosis-upper-thoracic-2025':SCOLIOSIS_LEAD_DAYS};

export const SCRIPTS:IssueScript[]=[
	{
		id:'left-humerus-fracture-2009',parts:[FRACTURE_PART],onset:FRACTURE_DATE,resolve:HEALED,
		// The /anyhealth/test timeline stretch around the fracture, as day ranges relative to onset.
		acute:TIMELINE_DENSITY.map(r=>({from:toDays(r.from)-toDays(FRACTURE_DATE),to:toDays(r.to)-toDays(FRACTURE_DATE),k:r.k})),
		// The layer draws the fragments; hide the intact bone while it does.
		fxAt:day=>fractureAt(FRACTURE_DATE,day)?[{part:FRACTURE_PART,visible:0}]:[],
		layer:fractureLayer,
		status(day){const s=fractureAt(FRACTURE_DATE,day);return s?`${s.phase} · day ${Math.floor(day)}`:null;},
		// Hold on the displaced break as the ER film showed it, hours after the fall; the approach starts before the fall so the snap plays in focus.
		climax:0.25,approachDays:0.5, // basis: bones#climax-fracture
	},
	// The fracture script draws the callus; this record only marks the film.
	// The callus is drawn by the fracture script's layer, so focusing this stop keeps that layer solid.
	{id:'healing-humerus-callus-2009',parts:[FRACTURE_PART],onset:'2009-09-25',resolve:HEALED,focusAlso:['left-humerus-fracture-2009'],fxAt:()=>[],status:()=>'Callus on the day-23 film',
		climax:0,approachDays:toDays('2009-09-25')-toDays(FRACTURE_DATE)-6}, // basis: bones#climax-callus
	{id:'scoliosis-upper-thoracic-2025',parts:SCOLIOSIS_PARTS,onset:SCOLIOSIS_RECORD,chronic:true,illustrative:true,fxAt:day=>scoliosisFx(day),
		climax:0,approachDays:365,view:BACK}, // basis: bones#climax-scoliosis
];
