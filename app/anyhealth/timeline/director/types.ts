/** Shared contracts for the timeline director (guided playback). See docs/superpowers/specs/2026-09-26-anyhealth-timeline-director-design.md. */
import type {Vec3} from '../types';

/** Release leg (leaving a stop): zoom out, then un-ghost, date accelerating to cruise. */
export const RELEASE_MS=1800;
/** Approach leg (arriving at a stop): ghost, then zoom in, date decelerating to 0 at the climax. */
export const APPROACH_MS=2500;
/** Cruise rate: wall-clock ms per year of life. */
export const CRUISE_MS_PER_YEAR=2000;
/** Cruise leg bounds (ms). A gap under one day may cruise 0 ms. */
export const CRUISE_MIN_MS=1500,CRUISE_MAX_MS=5000;
/** Opacity of non-focus parts at ghost 1. */
export const GHOST_ALPHA=0.12;
/** Camera rejoin blend after manual input, when guided posing resumes. */
export const REJOIN_MS=800;
/** Manual (tracker) Isolate: ghost crossfade and camera flight. */
export const ISOLATE_FADE_MS=600,ISOLATE_FLY_MS=1200;
/** Under prefers-reduced-motion the scene's camera flights (ISOLATE_FLY_MS) and rejoin blends (REJOIN_MS, and the focus handover riding on them) last this long instead. */
export const REDUCED_MOTION_MS=150;
/** The clock advances story time by at most this much per tick, so a background tab or a long frame never jumps the story. */
export const MAX_STEP_MS=100;
/** Focus pose fits the focus box × this. */
export const FOCUS_MARGIN=1.35;

export type Phase='idle'|'release'|'cruise'|'approach'|'hold'|'end';

export interface Stop {
	id:string;
	/** Fractional days since BIRTH_DATE of the climax. */
	day:number;
	approachDays:number;
	view:Vec3|null;
	/** Issue title (issues.json), for bar ticks. */
	title:string;
}

export interface Sample {
	storyMs:number;
	/** Fractional days since BIRTH_DATE (smooth). */
	day:number;
	/** ISO date of floor(day). */
	date:string;
	phase:Phase;
	/** Index into stops of the stop being approached / held / released, else null. */
	stop:number|null;
	focusId:string|null;
	/** 0..1: non-focus parts fade to GHOST_ALPHA. */
	ghost:number;
	/** 0..1: default pose → focus pose. */
	zoom:number;
}

export interface Schedule {
	stops:Stop[];
	/** Story time (ms) of each stop's hold instant, ascending. */
	holdMs:number[];
	totalMs:number;
	/** `holding`: the clock is stopped at a hold (phase 'hold' when storyMs equals that hold). */
	sample(storyMs:number,holding:boolean):Sample;
	/** Smallest story time at which the day reaches `day` (monotone inverse, bisection); clamped to [0,totalMs]. */
	storyMsForDay(day:number):number;
}

export interface Clock {
	readonly storyMs:number;
	readonly playing:boolean;
	/** Index of the stop being held, else null. */
	readonly holding:number|null;
	play(nowMs:number):void;
	pause(nowMs:number):void;
	/** At a hold: mark that stop passed and play. No-op otherwise. */
	continue(nowMs:number):void;
	/** Free scrub: pause, story time = storyMsForDay(day), not holding; re-arms stops at or after the new story time. */
	seekDay(day:number):void;
	/** Exact seek: pause, story time = ms (clamped to [0,totalMs]), not holding; re-arms every stop whose hold is ≥ ms (so at a hold instant Play holds that very stop, even the second of a same-day pair). */
	seekMs(ms:number):void;
	/** Tick click: story time = max(0, holdMs[i] − APPROACH_MS), re-arm stops from there, play. */
	seekStop(i:number,nowMs:number):void;
	/** Advance (when playing) to nowMs, by at most MAX_STEP_MS of story time per call, and return the sample. */
	tick(nowMs:number):Sample;
}

/** What the scene needs each frame for the camera and ghosting in timeline mode. */
export interface CameraCue {
	day:number;
	/** True unless the viewer scrubbed: playing, holding at a stop, or paused from play (the shot freezes where it is). False: free mode after seekDay / seekMs (scrub / reset) until play, continue or seekStop; the camera then follows the default pose and cue.ghost / cue.zoom are 0. */
	guided:boolean;
	phase:Phase;
	/** The stop being approached / held / released, else null. */
	stop:{id:string;view:Vec3|null}|null;
	ghost:number;
	zoom:number;
	/** Seek counter: the hook increments it on every seek (seekDay, seekMs, seekStop; reset is seekDay(0)). A guided seek makes the scene rejoin from the actual camera (camera/pose.ts needsRejoin) instead of cutting to the new shot. */
	seq:number;
}

/** What useDirector(today) returns to atlas-app.tsx. */
export interface DirectorApi {
	sample:Sample;
	stops:Stop[];
	schedule:Schedule;
	playing:boolean;
	holding:number|null;
	cue:CameraCue;
	play():void;
	pause():void;
	continue():void;
	seekDay(day:number):void;
	/** Exact story-time seek (free mode, as seekDay): bar drags (ms = fraction × totalMs) and a manual Isolate at a hold (ms = holdMs[i]). */
	seekMs(ms:number):void;
	seekStop(i:number):void;
	/** Scene reports manual camera input: pause if playing (holding stays holding). */
	manualCamera():void;
}
