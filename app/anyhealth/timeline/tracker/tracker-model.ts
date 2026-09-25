/** Which issues the Issue tracker lists on a date, and in what state. Pure: works off IssueScript fields (onset/resolve/chronic) plus issues.json. */
import issuesData from '../../health/issues.json';
import type {Issue} from '../../health/types';
import type {IssueScript} from '../types';
import {toDays} from '../../health/dates';
import {SCRIPTS,activeWindow,dayOf} from '../issues';

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

/** Tracker entries for `scripts` on `date`: the isolated script first (as `isolated-inactive` when outside its window; an unknown id is ignored), then the rest by onset, newest first. */
export function entriesFrom(scripts:IssueScript[],date:string,today:string,isolated:string|null):TrackerEntry[]{
	const out:TrackerEntry[]=[];let iso:IssueScript|undefined;
	for(const s of scripts){
		if(s.id===isolated){iso=s;continue;}
		const state=stateOf(s,date,today);
		if(state)out.push({issue:issueOf(s),script:s,state,day:dayOf(s,date)});
	}
	out.sort((a,b)=>b.script.onset.localeCompare(a.script.onset)||a.issue.title.localeCompare(b.issue.title));
	if(iso)out.unshift({issue:issueOf(iso),script:iso,state:stateOf(iso,date,today)??'isolated-inactive',day:dayOf(iso,date)});
	return out;
}

/** Tracker entries for `date` over every catalog script. */
export function trackerEntries(date:string,today:string,isolated:string|null):TrackerEntry[]{return entriesFrom(SCRIPTS,date,today,isolated);}
