/** Shared time curves for the systemic (illustrative) scripts. Every function is pure: a number in, a number out. */
import {toDays} from '../../../health/dates';

/** 0 → 1 smoothly (Hermite) as x goes a → b; clamps outside. */
export const smooth=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

/** Rise over [0,rise], hold to `holdTo`, fall smoothly to 0 at `end` (days). 0 outside [0,end]. */
export const envelope=(day:number,rise:number,holdTo:number,end:number)=>day<=0||day>=end?0:smooth(0,rise,day)*(1-smooth(holdTo,end,day));

/** A short record window: rises over `ramp` days, holds, and falls back over the last `ramp` days of `len`. */
export const windowGlow=(day:number,ramp:number,len:number)=>envelope(day,ramp,len-ramp,len);

/** Day of the year (0-based, fractional years ignored) for an ISO date. */
export const dayOfYear=(date:string)=>toDays(date)-toDays(`${date.slice(0,4)}-01-01`);

/** A periodic Gaussian bump over the year: 1 at `center` (day of year), width `sigma` days, wrapping at year end. */
const bump=(doy:number,center:number,sigma:number)=>{let d=Math.abs(doy-center)%365.25;d=Math.min(d,365.25-d);return Math.exp(-0.5*(d/sigma)**2);};

/** Front Range pollen season, 0..1, as a pure function of the calendar date: a spring tree/grass peak and a late-summer/fall weed (ragweed) peak. */
export function pollenSeason(date:string):number{
	const doy=dayOfYear(date);
	return Math.min(1,bump(doy,120,28)+0.85*bump(doy,240,22)); // basis: systemic#season-spring-peak, systemic#season-fall-peak
}

/** Immunotherapy factor on the seasonal amplitude: 1 before `start`, falling linearly to `floor` over `years`, then held. */
export function immunoFactor(date:string,start:string,years:number,floor:number):number{
	const t=(toDays(date)-toDays(start))/(years*365.25);
	return t<=0?1:1-(1-floor)*Math.min(1,t);
}
