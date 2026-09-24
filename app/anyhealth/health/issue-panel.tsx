'use client';
import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import {CATEGORY_LABEL,type AllergyChart,type Issue,type Lab} from './types';
import {formatRange} from './dates';

/** Right-hand panel for the selected issue. Bottom sheet on mobile. */
export default function IssuePanel({issue,onClose}:{issue:Issue|null;onClose:()=>void}){
	useEffect(()=>{if(!issue)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!document.querySelector('[data-slot=sheet-content]'))onClose();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[issue,onClose]);
	if(!issue)return null;
	return <aside className="issue-panel glass" aria-label={issue.title} key={issue.id}>
		<button type="button" className="issue-close" onClick={onClose} aria-label="Close"><X size={16}/></button>
		<div className="issue-scroll">
			<div className="eyebrow">{CATEGORY_LABEL[issue.category]?.toUpperCase()}</div>
			<h2>{issue.title}</h2>
			<div className="issue-date">{formatRange(issue.date,issue.endDate)}</div>
			<p className="issue-summary">{issue.summary}</p>
			{issue.figure&&<Figure src={issue.figure} alt={issue.title}/>}
			{!!issue.labs?.length&&<Labs labs={issue.labs}/>}
			{!!issue.chart?.items?.length&&<Chart chart={issue.chart}/>}
			<div className="issue-source">Source: {issue.source==='Self-reported'?'Self-reported':`${issue.source} Records`}</div>
		</div>
	</aside>;
}

function Figure({src,alt}:{src:string;alt:string}){
	const [failed,setFailed]=useState(false);
	if(failed)return null;
	// eslint-disable-next-line @next/next/no-img-element
	return <a className="issue-figure" href={src} target="_blank" rel="noreferrer" title="Open full size"><img src={src} alt={alt} onError={()=>setFailed(true)}/></a>;
}

function Labs({labs}:{labs:Lab[]}){
	return <div className="issue-labs">
		<div className="issue-lab head"><span>Test</span><span>Result</span><span>Ref</span></div>
		{labs.map((l,i)=>{const mark=l.flag==='high'?'▲':l.flag==='low'?'▼':l.flag==='abnormal'?'!':'';return <div className={`issue-lab ${mark?'flagged':''}`} key={i}>
			<span>{l.name}</span><span>{l.value}{l.unit?` ${l.unit}`:''}{mark&&<b aria-label={l.flag??undefined}> {mark}</b>}</span><span>{l.refText||'—'}</span>
		</div>;})}
	</div>;
}

function Chart({chart}:{chart:AllergyChart}){
	const pos=chart.items.filter(i=>i.class>0).map(i=>i.value),top=pos.length?Math.max(...pos):1;
	return <div className="issue-chart">
		<div className="issue-chart-head"><span>{chart.title}</span>{chart.unit&&<span>{chart.unit}</span>}</div>
		{chart.items.map(i=><div className={`issue-bar ${i.class>0?'positive':''}`} key={i.label}>
			<span title={i.label}>{i.label}</span><div><i style={{width:`${i.class>0?Math.max(4,i.value/top*100):3}%`}}/></div><span>{i.display}</span>
		</div>)}
		{chart.note&&<p>{chart.note}</p>}
	</div>;
}
