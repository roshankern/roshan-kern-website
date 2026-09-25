/** Time-course helpers for the airway scripts: smooth ramps (so no effect ever steps), a seeded PRNG for deterministic spreads. All pure. */

/** Hermite smoothstep of x between e0 and e1 (0 below, 1 above). */
export const smoothstep=(e0:number,e1:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t);};

/** Pre-roll: every effect ramps in over the 8 h before its record date, so the dated day itself shows the documented state. */
export const PRE_ROLL=8/24;

/** Mulberry32: a tiny deterministic PRNG. Returns a function giving floats in [0,1). */
export function prng(seed:number):()=>number{
	let a=seed>>>0;
	return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}

/** A one-day highlight (procedure or test day): 0 before the pre-roll, 1 on the day, fading out by the next day. */
export const dayHighlight=(d:number)=>smoothstep(-PRE_ROLL,0,d)*(1-smoothstep(0.25,1,d));
