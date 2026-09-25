'use client';
/** The timeline's Issue tracker: an always-open glass panel on the right listing the issues active on the shown date, each with an Isolate issue / Show all toggle. It sits in the issue panel's footprint (--issue-panel-w / --panel-inset), so scene.tsx's issueFootprint() reserves its space and the body stays centred between the panels. On ≤767px it is a bottom sheet with a 44px peek bar. */
import './tracker.css';
import {useEffect,useMemo,useState} from 'react';
import {ChevronUp} from 'lucide-react';
import {SYSTEMS} from '../../atlas/anatomy';
import {anchorFor} from '../../health/anchors';
import {formatRange} from '../../health/dates';
import {CATEGORY_LABEL} from '../../health/types';
import {Figure,Labs,Chart} from '../../health/issue-panel';
import {trackerEntries,type TrackerEntry} from './tracker-model';

const plural=(n:number,one:string)=>`${n} ${one}${n===1?'':'s'}`;

/** The Issue tracker for `date`. `isolated` is the isolated issue id (pinned first); `onIsolate(id|null)` toggles it (the scene flies the camera). */
export default function IssueTracker({date,today,isolated,onIsolate}:{date:string;today:string;isolated:string|null;onIsolate:(id:string|null)=>void}){
	const entries=useMemo(()=>trackerEntries(date,today,isolated),[date,today,isolated]);
	const active=entries.filter(e=>e.state==='active').length;
	const [open,setOpen]=useState(false);
	// Escape collapses the mobile sheet, else ends Isolate (unless a dialog such as the About sheet is open).
	useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key!=='Escape'||document.querySelector('[data-slot=sheet-content]'))return;if(open)setOpen(false);else if(isolated)onIsolate(null);};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[open,isolated,onIsolate]);
	// Collapse the mobile sheet on Isolate so the camera flight is visible.
	const isolate=(id:string|null)=>{setOpen(false);onIsolate(id);};
	return <aside className={`issue-tracker glass${open?' open':''}`} aria-label="Issue tracker">
		<div className="tracker-head">
			<span>Issue tracker</span><span className="tracker-count">{active} active</span>
		</div>
		<button type="button" className="tracker-peek" aria-expanded={open} aria-controls="tracker-list" onClick={()=>setOpen(o=>!o)}>
			<span>{plural(active,'active issue')}</span><ChevronUp size={16} aria-hidden/>
		</button>
		<div className="tracker-list" id="tracker-list">
			{entries.length?entries.map(e=><Card key={e.issue.id} entry={e} isolated={isolated===e.issue.id} onIsolate={isolate}/>):<p className="tracker-empty">No active issues on this date.</p>}
		</div>
	</aside>;
}

function Card({entry:{issue,script,state,day},isolated,onIsolate}:{entry:TrackerEntry;isolated:boolean;onIsolate:(id:string|null)=>void}){
	const system=SYSTEMS.find(s=>s.id===anchorFor(issue).system);
	let status:string|null=null;try{status=state==='isolated-inactive'?null:script.status?.(day)??null;}catch(err){console.error(`status for ${issue.id}`,err);}
	return <article className={`tracker-card ${state}${isolated?' isolated':''}`} aria-label={issue.title}>
		<div className="eyebrow">{system&&<><i className="system-dot" style={{background:system.color}}/>{system.name.toUpperCase()}<b>·</b></>}{CATEGORY_LABEL[issue.category]?.toUpperCase()}</div>
		<h3>{issue.title}</h3>
		<div className="issue-date">{formatRange(issue.date,issue.endDate)}</div>
		{(status||script.illustrative||state!=='active')&&<div className="tracker-tags">
			{status&&<span className="tracker-status">{status}</span>}
			{state==='resolved'&&<span className="tracker-chip">Resolved</span>}
			{state==='isolated-inactive'&&<span className="tracker-chip">Not active on this date</span>}
			{script.illustrative&&<span className="tracker-chip" title="Stylized rather than literal anatomy">Illustrative</span>}
		</div>}
		<p className="issue-summary">{issue.summary}</p>
		{issue.figure&&<Figure src={issue.figure} alt={issue.title}/>}
		{!!issue.labs?.length&&<Labs labs={issue.labs}/>}
		{!!issue.chart?.items?.length&&<Chart chart={issue.chart}/>}
		<div className="tracker-foot">
			<span className="issue-source">Source: {issue.source==='Self-reported'?'Self-reported':`${issue.source} Records`}</span>
			<button type="button" className="tracker-isolate" aria-pressed={isolated} onClick={()=>onIsolate(isolated?null:issue.id)}>{isolated?'Show all':'Isolate issue'}</button>
		</div>
	</article>;
}
