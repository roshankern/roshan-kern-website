/** Which issues the Issue tracker lists on a date, and in what state. Pure: works off IssueScript fields (onset/resolve/chronic) plus issues.json. */
import issuesData from '../../health/issues.json';
import type {Issue} from '../../health/types';
import type {IssueScript} from '../types';
import type {Phase} from '../director/types';
import {toDays} from '../../health/dates';
import {SCRIPTS,activeWindow,dayOf,leadDays} from '../issues';

const ISSUES=new Map((issuesData as Issue[]).map(i=>[i.id,i]));
/** Days a resolved issue stays listed (with a "Resolved" chip) after its resolve date. */
export const LINGER_DAYS=7;

export interface TrackerEntry {issue:Issue;script:IssueScript;state:'active'|'resolved'|'isolated-inactive';/** Days since onset at `date`. */day:number}

/** The state of one script on `date`, or null when it isn't listed. Shown when onset ≤ date ≤ resolve+7d, or chronic and onset ≤ date (through `today`). */
function stateOf(s:IssueScript,date:string,today:string):'active'|'resolved'|null{
	if(date<s.onset)return null;
	const w=activeWindow(s,today);
	if(date<=w.to)return 'active';
	if(s.chronic||!s.resolve)return null;
	return toDays(date)-toDays(s.resolve)<=LINGER_DAYS?'resolved':null;
}

/** The issues.json record for a script, or a bare stand-in (title = id) so a script without a record still lists. */
const issueOf=(s:IssueScript):Issue=>ISSUES.get(s.id)??{id:s.id,date:s.onset,endDate:s.resolve??null,title:s.id,summary:'',category:'bones',source:'Self-reported'};

/** The director's guided focus: the stop's issue id and the playback phase. */
export interface TrackerFocus {id:string;phase:Phase}
/** Phases in which the guided focus is pinned (the director's focusId is null otherwise). */
export const focusPinned=(f:TrackerFocus|null|undefined):f is TrackerFocus=>!!f&&(f.phase==='approach'||f.phase==='hold'||f.phase==='release');

/** Tracker entries for `scripts` on `date`: the guided focus first (approach/hold/release), then the isolated script (each as `isolated-inactive` when outside its window; an unknown id is ignored), then the rest by onset, newest first. */
export function entriesFrom(scripts:IssueScript[],date:string,today:string,isolated:string|null,focus:TrackerFocus|null=null):TrackerEntry[]{
	const out:TrackerEntry[]=[],fid=focusPinned(focus)?focus.id:null;let iso:IssueScript|undefined,foc:IssueScript|undefined;
	for(const s of scripts){
		if(s.id===fid){foc=s;continue;}
		if(s.id===isolated){iso=s;continue;}
		const state=stateOf(s,date,today);
		if(state)out.push({issue:issueOf(s),script:s,state,day:dayOf(s,date)});
	}
	out.sort((a,b)=>b.script.onset.localeCompare(a.script.onset)||a.issue.title.localeCompare(b.issue.title));
	const pin=(s:IssueScript,lead=false):TrackerEntry=>({issue:issueOf(s),script:s,state:stateOf(s,date,today)??(lead&&date<s.onset&&-dayOf(s,date)<=leadDays(s.id)?'active':'isolated-inactive'),day:dayOf(s,date)});
	if(iso)out.unshift(pin(iso));
	// A guided stop inside its lead (the anatomy shows before the record date, e.g. wisdom teeth the eve of extraction) lists as active.
	if(foc)out.unshift(pin(foc,true));
	return out;
}

/** Tracker entries for `date` over every catalog script. */
export function trackerEntries(date:string,today:string,isolated:string|null,focus:TrackerFocus|null=null):TrackerEntry[]{return entriesFrom(SCRIPTS,date,today,isolated,focus);}
