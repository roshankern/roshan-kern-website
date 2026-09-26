/** The director's story clock: a tiny pure state machine over a Schedule. Wall-clock time comes in through the `nowMs` arguments, so it runs the same in node checks and under requestAnimationFrame. */
import type {Clock,Sample,Schedule} from './types';
import {APPROACH_MS} from './types';

/** A clock at story time 0, paused, every stop armed. */
export function createClock(s:Schedule):Clock{
	let storyMs=0,playing=false,holding:number|null=null,lastNow=0;
	const passed=new Set<number>();
	/** Re-arm every stop whose hold is at or after the current story time. */
	const rearm=()=>{for(const i of [...passed])if(s.holdMs[i]>=storyMs)passed.delete(i);};
	/** First armed hold in [from, to], else -1 (binary search to the first hold ≥ from). */
	const nextHold=(from:number,to:number)=>{const h=s.holdMs;let lo=0,hi=h.length;while(lo<hi){const mid=(lo+hi)>>1;if(h[mid]<from)lo=mid+1;else hi=mid;}for(let i=lo;i<h.length&&h[i]<=to;i++)if(!passed.has(i))return i;return -1;};
	const advance=(nowMs:number)=>{
		if(!playing)return;const next=storyMs+Math.max(0,nowMs-lastNow);lastNow=nowMs;const i=nextHold(storyMs,next);
		if(i>=0){storyMs=s.holdMs[i];holding=i;playing=false;}else if(next>=s.totalMs){storyMs=s.totalMs;playing=false;}else storyMs=next;
	};
	const clock:Clock={
		get storyMs(){return storyMs;},get playing(){return playing;},get holding(){return holding;},
		play(nowMs){if(holding!==null){clock.continue(nowMs);return;}if(playing)return;if(storyMs>=s.totalMs){storyMs=0;passed.clear();}playing=true;lastNow=nowMs;},
		pause(nowMs){advance(nowMs);playing=false;},
		continue(nowMs){if(holding===null)return;passed.add(holding);holding=null;playing=true;lastNow=nowMs;},
		seekDay(day){playing=false;holding=null;storyMs=s.storyMsForDay(day);rearm();},
		seekStop(i,nowMs){if(!Number.isInteger(i)||i<0||i>=s.holdMs.length)return;holding=null;storyMs=Math.max(0,s.holdMs[i]-APPROACH_MS);rearm();playing=true;lastNow=nowMs;},
		tick(nowMs):Sample{advance(nowMs);const x=s.sample(storyMs,holding!==null);return playing&&x.phase==='idle'?{...x,phase:x.stop!==null?'approach':'cruise'}:x;},
	};
	return clock;
}
