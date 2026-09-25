'use client';
/** The timeline's Issue tracker: the issues active on the shown date. Stub from Task 3 (a titled list); Task 7 builds the real one. It sits where the issue panel does, so scene.tsx's issueFootprint() (--issue-panel-w / --panel-inset) reserves its space. */
import issuesData from '../../health/issues.json';
import type {Issue} from '../../health/types';
import {SCRIPTS,activeWindow} from '../issues';

const ISSUES=new Map((issuesData as Issue[]).map(i=>[i.id,i]));

export default function IssueTracker({date,today,isolated,onIsolate}:{date:string;today:string;isolated:string|null;onIsolate:(id:string|null)=>void}){
	void isolated;void onIsolate;
	const active=SCRIPTS.filter(s=>{const w=activeWindow(s,today);return w.from<=date&&date<=w.to;}).sort((a,b)=>b.onset.localeCompare(a.onset));
	return <aside className="issue-tracker glass" aria-label="Issue tracker">
		<div className="panel-heading"><span>Issue tracker</span></div>
		{active.length?<ul>{active.map(s=><li key={s.id}>{ISSUES.get(s.id)?.title??s.id}</li>)}</ul>:<p>No active issues on this date.</p>}
	</aside>;
}
