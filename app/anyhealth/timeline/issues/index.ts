/** Every issue script, one per id in app/anyhealth/health/issues.json, gathered from the catalog areas (issues/catalog/<area>.ts). */
import type {IssueScript} from '../types';
import {toDays} from '../../health/dates';
import {SCRIPTS as bones,LEAD_DAYS as bonesLead} from './catalog/bones';
import {SCRIPTS as airway,LEAD_DAYS as airwayLead} from './catalog/airway';
import {SCRIPTS as digestive,LEAD_DAYS as digestiveLead} from './catalog/digestive';
import {SCRIPTS as eyesTeeth,LEAD_DAYS as eyesTeethLead} from './catalog/eyes-teeth';
import {SCRIPTS as skin,LEAD_DAYS as skinLead} from './catalog/skin';
import {SCRIPTS as systemic} from './catalog/systemic';

/** Concatenation of every catalog area's SCRIPTS. */
export const SCRIPTS:IssueScript[]=[...bones,...airway,...digestive,...eyesTeeth,...skin,...systemic];

const byId=new Map(SCRIPTS.map(s=>[s.id,s]));
const LEAD:Record<string,number>={...bonesLead,...airwayLead,...digestiveLead,...eyesTeethLead,...skinLead};
/** Days before onset that a script already shows anatomy (every catalog's LEAD_DAYS; 0 when absent). The active window for the director starts at onset − leadDays. */
export function leadDays(id:string):number{return LEAD[id]??0;}
/** The script for an issue id. */
export function scriptFor(id:string):IssueScript|undefined{return byId.get(id);}

/** Dates the script is active: onset through resolve, or through `today` when chronic (or, defensively, when it has no resolve). */
export function activeWindow(s:IssueScript,today:string):{from:string;to:string}{
	return {from:s.onset,to:s.chronic||!s.resolve?today:s.resolve};
}

/** Days from the script's onset to `date` (negative before onset). */
export const dayOf=(s:IssueScript,date:string)=>toDays(date)-toDays(s.onset);
