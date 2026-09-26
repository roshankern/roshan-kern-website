'use client';
/** The timeline's Issue tracker: an always-open glass panel on the right listing the issues active on the shown date, each with an Isolate issue / Show all button. It sits in the issue panel's footprint (--issue-panel-w / --panel-inset), so scene.tsx's issueFootprint() reserves its space and the body stays centred between the panels. On ≤767px it is a bottom sheet with a 44px peek bar. */
import './tracker.css';
import {useEffect,useMemo,useRef,useState,type RefObject} from 'react';
import {ArrowRight,ChevronUp} from 'lucide-react';
import {SYSTEMS} from '../../atlas/anatomy';
import {anchorFor} from '../../health/anchors';
import {formatRange} from '../../health/dates';
import {CATEGORY_LABEL} from '../../health/types';
import {Figure,Labs,Chart} from '../../health/issue-panel';
import type {Phase} from '../director/types';
import {focusPinned,trackerEntries,type TrackerEntry,type TrackerFocus} from './tracker-model';

const plural=(n:number,one:string)=>`${n} ${one}${n===1?'':'s'}`;

const reduced=()=>typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The Issue tracker for `date`. `isolated` is the manual isolate (pinned first); `onIsolate(id|null)` toggles it (the scene flies the camera).
 *  v2 director: `focus` is the guided stop's issue, pinned above it and expanded during approach/hold/release; at the hold it shows Continue (`onContinue`). `phase` is the director's phase, exposed as data-phase. */
export default function IssueTracker({date,today,isolated,onIsolate,focus=null,phase,onContinue}:{date:string;today:string;isolated:string|null;onIsolate:(id:string|null)=>void;focus?:TrackerFocus|null;phase?:Phase;onContinue?:()=>void}){
	const pinned=focusPinned(focus)?focus:null,fid=pinned?.id??null,holding=pinned?.phase==='hold';
	const fphase=pinned?.phase??null,entries=useMemo(()=>trackerEntries(date,today,isolated,fid&&fphase?{id:fid,phase:fphase}:null),[date,today,isolated,fid,fphase]);
	const active=entries.filter(e=>e.state==='active').length;
	const [open,setOpen]=useState(false),list=useRef<HTMLDivElement>(null),contRef=useRef<HTMLButtonElement>(null);
	// Escape collapses the mobile sheet, else ends a manual Isolate (never the guided focus), unless a dialog such as the About sheet is open.
	useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.key!=='Escape'||document.querySelector('[data-slot=sheet-content]'))return;if(open)setOpen(false);else if(isolated)onIsolate(null);};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[open,isolated,onIsolate]);
	// A new guided focus, or its hold: bring its card into view.
	useEffect(()=>{if(fid)list.current?.querySelector('.tracker-card.focused')?.scrollIntoView({block:'nearest',behavior:reduced()?'auto':'smooth'});},[fid,holding]);
	// Phones: the sheet opens to the focused card at a hold.
	useEffect(()=>{if(holding&&matchMedia('(max-width:767px)').matches)setOpen(true);},[holding,fid]);
	// Hold arrival: Continue takes keyboard focus. After the sheet opens on phones (a closed sheet's list is visibility:hidden, so unfocusable), hence `open` and the frame delay.
	useEffect(()=>{if(!holding)return;const r=requestAnimationFrame(()=>contRef.current?.focus({preventScroll:true}));return()=>cancelAnimationFrame(r);},[holding,fid,open]);
	// Collapse the mobile sheet on Isolate / Continue so the camera is visible.
	const isolate=(id:string|null)=>{setOpen(false);onIsolate(id);},cont=()=>{setOpen(false);onContinue?.();};
	return <aside className={`issue-tracker glass${open?' open':''}`} aria-label="Issue tracker" data-phase={phase??pinned?.phase??'none'}>
		<div className="tracker-head">
			<h2>Issue tracker</h2><span className="tracker-count">{active} active</span>
		</div>
		<button type="button" className="tracker-peek" aria-expanded={open} aria-controls="tracker-list" onClick={()=>setOpen(o=>!o)}>
			<span>{plural(active,'active issue')}</span><ChevronUp size={16} aria-hidden/>
		</button>
		<div className="tracker-list" id="tracker-list">
			{entries.length?entries.map(e=><Card key={e.issue.id} entry={e} isolated={isolated===e.issue.id} onIsolate={isolate} focused={e.issue.id===fid} onContinue={holding&&e.issue.id===fid&&onContinue?cont:null} continueRef={contRef}/>):<p className="tracker-empty">No active issues on this date.</p>}
		</div>
	</aside>;
}

/** `focused`: the guided stop's card (expanded, no Isolate). `onContinue`: set at the hold, shows the primary Continue button (`continueRef`, which the tracker focuses on arrival). */
function Card({entry:{issue,script,state,day},isolated,onIsolate,focused=false,onContinue=null,continueRef}:{entry:TrackerEntry;isolated:boolean;onIsolate:(id:string|null)=>void;focused?:boolean;onContinue?:(()=>void)|null;continueRef?:RefObject<HTMLButtonElement|null>}){
	const system=SYSTEMS.find(s=>s.id===anchorFor(issue).system);
	let status:string|null=null;try{status=state==='isolated-inactive'?null:script.status?.(day)??null;}catch(err){console.error(`status for ${issue.id}`,err);}
	return <article className={`tracker-card ${state}${isolated?' isolated':''}${focused?' focused':''}`} aria-label={issue.title} aria-current={focused?'step':undefined}>
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
		{/* After the summary, above any figure/labs/chart, so it is in view once the card has been read. */}
		{onContinue&&<button type="button" ref={continueRef} className="tracker-continue" onClick={onContinue}>Continue<ArrowRight size={16} strokeWidth={2.2} aria-hidden/></button>}
		{issue.figure&&<Figure src={issue.figure} alt={issue.title}/>}
		{!!issue.labs?.length&&<Labs labs={issue.labs}/>}
		{!!issue.chart?.items?.length&&<Chart chart={issue.chart}/>}
		<div className="tracker-foot">
			<span className="issue-source">Source: {issue.source==='Self-reported'?'Self-reported':`${issue.source} Records`}</span>
			{/* An action button, not a toggle: its label names what a click does (no aria-pressed, which with a changing label would announce the opposite state). */}
			{!focused&&<button type="button" className={`tracker-isolate${isolated?' on':''}`} onClick={()=>onIsolate(isolated?null:issue.id)}>{isolated?'Show all':'Isolate issue'}</button>}
		</div>
	</article>;
}
