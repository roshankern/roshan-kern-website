'use client';
import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent,type PointerEvent} from 'react';
import {Pause,Play,RotateCcw} from 'lucide-react';
import {BIRTH_DATE,type Issue} from './types';
import {issueColor} from './anchors';
import {formatDate,fromDays,todayISO,toDays} from './dates';

/** Wall-clock time to play birth → today. */
const PLAY_MS=26000;
const YEARS=[2005,2010,2015,2020,2025];

interface Props {issues:Issue[];date:string;onDate:(iso:string)=>void;selected:string|null;onSelect:(id:string|null)=>void}

export default function TimelineBar({issues,date,onDate,selected,onSelect}:Props){
	const track=useRef<HTMLDivElement>(null),[playing,setPlaying]=useState(false);
	const min=toDays(BIRTH_DATE),[max]=useState(()=>toDays(todayISO())),span=max-min;
	const pct=(iso:string)=>Math.max(0,Math.min(100,(toDays(iso)-min)/span*100));
	const latest=useRef({date,onDate});latest.current={date,onDate};

	useEffect(()=>{
		if(!playing)return;
		let start=toDays(latest.current.date);if(start>=max)start=min;
		const t0=performance.now();let raf=0;
		const step=(now:number)=>{const day=start+(now-t0)*span/PLAY_MS;if(day>=max){latest.current.onDate(fromDays(max));setPlaying(false);return;}latest.current.onDate(fromDays(day));raf=requestAnimationFrame(step);};
		raf=requestAnimationFrame(step);return()=>cancelAnimationFrame(raf);
	},[playing,max,min,span]);

	const fromX=(x:number)=>{const r=track.current?.getBoundingClientRect();if(!r)return;const t=Math.max(0,Math.min(1,(x-r.left)/r.width));onDate(fromDays(min+t*span));};
	const down=(e:PointerEvent<HTMLDivElement>)=>{if(e.button!==0)return;setPlaying(false);e.currentTarget.setPointerCapture(e.pointerId);fromX(e.clientX);};
	const move=(e:PointerEvent<HTMLDivElement>)=>{if(e.currentTarget.hasPointerCapture(e.pointerId))fromX(e.clientX);};
	const key=(e:KeyboardEvent)=>{const step=e.shiftKey?365:30,d=toDays(date);const next=e.key==='ArrowRight'||e.key==='ArrowUp'?d+step:e.key==='ArrowLeft'||e.key==='ArrowDown'?d-step:e.key==='Home'?min:e.key==='End'?max:null;if(next==null)return;e.preventDefault();setPlaying(false);onDate(fromDays(Math.max(min,Math.min(max,next))));};
	const at=pct(date);

	return <section className="timeline-panel glass" aria-label="Timeline">
		<button type="button" className="timeline-play" onClick={()=>setPlaying(p=>!p)} aria-label={playing?'Pause timeline':'Play timeline'}>{playing?<Pause size={15} fill="currentColor" strokeWidth={0}/>:<Play size={15} fill="currentColor" strokeWidth={0}/>}</button>
		<div className="timeline-body">
			<div className="timeline-track" ref={track} onPointerDown={down} onPointerMove={move} role="slider" tabIndex={0} aria-label="Date" aria-valuemin={min} aria-valuemax={max} aria-valuenow={toDays(date)} aria-valuetext={formatDate(date)} onKeyDown={key}>
				<div className="timeline-line"/><div className="timeline-fill" style={{width:`${at}%`}}/>
				{issues.map(i=><button type="button" key={i.id} className={`timeline-tick ${i.id===selected?'selected':''} ${i.date>date?'future':''}`} style={{left:`${pct(i.date)}%`,'--tick':issueColor(i)} as CSSProperties} title={`${i.title} · ${formatDate(i.date)}`} aria-label={`${i.title}, ${formatDate(i.date)}`} onPointerDown={e=>e.stopPropagation()} onClick={()=>{setPlaying(false);onDate(i.date);onSelect(i.id);}}/>)}
				<div className="timeline-handle" style={{left:`${at}%`}}/>
				<div className="timeline-date" style={{left:`clamp(34px,${at}%,calc(100% - 34px))`}}>{formatDate(date)}</div>
			</div>
			<div className="timeline-years" aria-hidden="true">{YEARS.map(y=><span key={y} style={{left:`${pct(`${y}-01-01`)}%`}}>{y}</span>)}</div>
		</div>
		<button type="button" className="timeline-play timeline-reset" onClick={()=>{setPlaying(false);onSelect(null);onDate(fromDays(min));}} aria-label="Reset timeline to birth" title="Back to start"><RotateCcw size={15} strokeWidth={2.2}/></button>
	</section>;
}
