/** Timeline pacing: stretches the timeline around each issue's acute phase (from each script's `acute`), so play slows there. */
import type {Density} from '../../health/warp';
import type {IssueScript} from '../types';
import {BIRTH_DATE} from '../../health/types';
import {toDays,fromDays} from '../../health/dates';
import {SCRIPTS} from './index';

/** The least share of the track left for quiet (unstretched) time. */
export const MIN_QUIET=0.4;

type Range={a:number;b:number;k:number};

/** Density ranges for `scripts` on a birth..`today` track: every `onset+from..onset+to` with its `k`, clipped to the track and rounded out to whole days, overlaps unioned at the max `k`. When the quiet share falls below MIN_QUIET, every k is scaled down (`k' = 1 + (k−1)·f`, f found by bisection) until it is at least MIN_QUIET. Sorted, non-overlapping. */
export function pacingFrom(scripts:IssueScript[],today:string):Density[]{
	const min=toDays(BIRTH_DATE),max=toDays(today);if(max<=min)return [];
	const raw:Range[]=[];
	for(const s of scripts)for(const r of s.acute??[]){
		if(!(r.k>1))continue;const o=toDays(s.onset),a=Math.max(min,Math.floor(o+r.from)),b=Math.min(max,Math.ceil(o+r.to));
		if(b>a)raw.push({a,b,k:r.k});
	}
	raw.sort((x,y)=>x.a-y.a||x.b-y.b);
	const merged:Range[]=[];
	for(const r of raw){const last=merged[merged.length-1];if(last&&r.a<last.b){last.b=Math.max(last.b,r.b);last.k=Math.max(last.k,r.k);}else merged.push({...r});}
	if(!merged.length)return [];
	const dense=merged.reduce((s,r)=>s+r.b-r.a,0),quiet=max-min-dense;
	const share=(f:number)=>quiet/(quiet+merged.reduce((s,r)=>s+(r.b-r.a)*(1+(r.k-1)*f),0));
	// Acute phases cover so much of the track that even unstretched there isn't enough quiet time: don't stretch at all.
	if(share(0)<MIN_QUIET)return [];
	let f=1;
	if(share(1)<MIN_QUIET+1e-6){// +1e-6: margin so float error in the warp never dips below the floor
		let lo=0,hi=1;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(share(mid)>=MIN_QUIET+1e-6)lo=mid;else hi=mid;}f=lo;}
	return merged.map(r=>({from:fromDays(r.a),to:fromDays(r.b),k:1+(r.k-1)*f})).filter(r=>r.k>1);
}

let cache:{today:string;out:Density[]}|null=null;
/** Density ranges for the timeline bar from every script's `acute`, sorted and non-overlapping, keeping at least MIN_QUIET of the track quiet. Memoised per `today` (the same array is returned, so it is safe to call on every render). */
export function pacing(today:string):Density[]{
	if(cache?.today!==today)cache={today,out:pacingFrom(SCRIPTS,today)};
	return cache.out;
}
