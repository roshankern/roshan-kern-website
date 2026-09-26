'use client';
/** React glue for the director: owns the story clock, runs a rAF loop while playing, and handles Space / Enter. Exported through runtime.ts (the kit), so /anyhealth never bundles it. */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {Clock,DirectorApi,Sample} from './types';
import {buildSchedule} from './schedule';
import {createClock} from './clock';
import {SCRIPTS} from '../issues';

const reducedMotion=()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** Keys typed into a control or the phone tracker sheet, or while a dialog is open, are not the director's (buttons, links and the tracker's Continue handle Space / Enter themselves, so handling them here would double-fire). */
function ownKey(e:KeyboardEvent){
	if(e.defaultPrevented||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return false;
	const t=e.target instanceof Element?e.target:null;
	if(t?.closest('input,textarea,select,button,a[href],[contenteditable=""],[contenteditable="true"],[role="slider"],[role="button"],[role="textbox"],[data-slot="sheet-content"]'))return false;
	return !document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]');
}

/** `scrubbed`: set by seekDay / seekMs (free mode), cleared by play / continue / seekStop. `seq`: seeks so far (CameraCue.seq). */
interface View {sample:Sample;playing:boolean;holding:number|null;scrubbed:boolean;seq:number}

/** Guided playback for the timeline: the schedule for `today`, the clock state, and the actions the bar, tracker and scene call. */
export function useDirector(today:string):DirectorApi{
	const schedule=useMemo(()=>buildSchedule(SCRIPTS,today,{reducedMotion:reducedMotion()}),[today]);
	const clockRef=useRef<{schedule:typeof schedule;clock:Clock}|null>(null);
	if(clockRef.current?.schedule!==schedule)clockRef.current={schedule,clock:createClock(schedule)};
	const clock=clockRef.current.clock;
	const [view,setView]=useState<View>(()=>({sample:clock.tick(0),playing:false,holding:null,scrubbed:false,seq:0}));
	const scrubbed=useRef(false),seq=useRef(0);
	/** Tick to now and publish the clock state. */
	const publish=useCallback(()=>{const sample=clock.tick(performance.now());setView({sample,playing:clock.playing,holding:clock.holding,scrubbed:scrubbed.current,seq:seq.current});},[clock]);
	useEffect(()=>{publish();},[publish]);
	useEffect(()=>{
		if(!view.playing)return;let raf=0;
		const loop=()=>{publish();if(clock.playing)raf=requestAnimationFrame(loop);};
		raf=requestAnimationFrame(loop);return ()=>cancelAnimationFrame(raf);
	},[view.playing,clock,publish]);
	// Play at the end wraps to birth: that is a seek (seq), so the camera rejoins instead of cutting from adult to newborn framing.
	const play=useCallback(()=>{scrubbed.current=false;if(clock.storyMs>=schedule.totalMs)seq.current++;clock.play(performance.now());publish();},[clock,publish,schedule]);
	const pause=useCallback(()=>{clock.pause(performance.now());publish();},[clock,publish]);
	const cont=useCallback(()=>{if(clock.holding!==null)scrubbed.current=false;clock.continue(performance.now());publish();},[clock,publish]);
	const seekDay=useCallback((day:number)=>{scrubbed.current=true;seq.current++;clock.seekDay(day);publish();},[clock,publish]);
	const seekMs=useCallback((ms:number)=>{scrubbed.current=true;seq.current++;clock.seekMs(ms);publish();},[clock,publish]);
	const seekStop=useCallback((i:number)=>{if(Number.isInteger(i)&&i>=0&&i<schedule.holdMs.length){scrubbed.current=false;seq.current++;}clock.seekStop(i,performance.now());publish();},[clock,publish,schedule]);
	const manualCamera=useCallback(()=>{if(clock.playing){clock.pause(performance.now());publish();}},[clock,publish]);
	useEffect(()=>{
		const onKey=(e:KeyboardEvent)=>{
			if((e.key!==' '&&e.key!=='Enter')||!ownKey(e))return;
			if(clock.holding!==null){e.preventDefault();cont();}
			else if(e.key===' '){e.preventDefault();if(clock.playing)pause();else play();}
		};
		window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);
	},[clock,cont,pause,play]);
	const {sample,playing,holding,seq:n}=view,free=view.scrubbed,stops=schedule.stops;
	// Guided unless scrubbed: pausing mid-shot freezes it; only a scrub (or reset) drops to free mode, where the scene follows the default pose unghosted.
	const cue=useMemo(()=>({day:sample.day,guided:!free,phase:sample.phase,stop:sample.stop!==null?{id:stops[sample.stop].id,view:stops[sample.stop].view}:null,ghost:free?0:sample.ghost,zoom:free?0:sample.zoom,seq:n}),[sample,free,stops,n]);
	return {sample,stops,schedule,playing,holding,cue,play,pause,continue:cont,seekDay,seekMs,seekStop,manualCamera};
}
