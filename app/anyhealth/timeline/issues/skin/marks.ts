/** Skin mark definitions and small pure helpers shared by the skin issue modules (lacerations, neonatal, eczema, warts, acne) and the marks layer. */
import type {Vec3} from '../../types';
import {toDays} from '../../../health/dates';

/** Mark shapes. `dome`: raised papule / vesicle. `rough`: jittered dome (wart). `disc`: flat macule or patch. `line`: tapered ribbon (a cut). `bar`: untapered ribbon (a suture across a cut). */
export type MarkShape='dome'|'rough'|'disc'|'line'|'bar';

/** One small mesh on the skin. `size` is physical metres on the body at `scaleDate`: the layer divides it by the local warp scale there (body scale × the segment's length factor along its axis and soft-girth factor across it), so the mark is life-size on that date and grows with the body afterwards. `uv` is rest-space metres (where a mark sits is anatomy-relative) unless `uvPhysical`. */
export interface MarkDef {
	/** Rest-space hint the mark's cluster is projected from (usually from health/anchors.ts). */
	at:Vec3;
	/** Offset from the projected hint in its tangent frame (t1 = the body's up, projected; t2 = normal × t1), metres: rest space, or physical when `uvPhysical`. */
	uv?:[number,number];
	/** `uv` is physical at `scaleDate` (e.g. sutures along a cut of recorded length) and is scaled like `size`. */
	uvPhysical?:boolean;
	shape:MarkShape;
	/** [length along the mark's direction, width, height], metres. */
	size:Vec3;
	/** Direction in the tangent plane, radians from t1. */
	angle?:number;
	/** Offset along the normal, metres. Default 0.3 mm above the surface; negative = under the (translucent) skin. */
	depth?:number;
	/** Base colour (sRGB hex). */
	color:number;
	/** Date whose body converts `size` (and a physical `uv`) to rest space. */
	scaleDate:string;
	/** Seed for shape jitter. */
	seed:number;
	/** Tag used for counting (e.g. 'suture', 'lesion'). */
	tag?:string;
}
/** A mark's look on one day. alpha 0 = not drawn. */
export interface MarkState {alpha:number;color?:number}

/** Default height of a mark above the Skin surface (0.3 mm). */
export const MARK_LIFT=.0003;

/** Deterministic PRNG (mulberry32). */
export function rng(seed:number){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
/** Stable 32-bit hash of a string (FNV-1a), for seeding. */
export function hashSeed(s:string){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return h>>>0;}

export const clamp01=(x:number)=>x<0?0:x>1?1:x;
/** Smoothstep from 0 at `a` to 1 at `b`. */
export const smooth=(a:number,b:number,x:number)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
/** Linear interpolation of two sRGB hex colours. */
export function mixHex(a:number,b:number,t:number){const u=clamp01(t),ch=(s:number)=>Math.round(((a>>s)&255)*(1-u)+((b>>s)&255)*u);return (ch(16)<<16)|(ch(8)<<8)|ch(0);}
/** Piecewise-linear lookup over [x,y] knots (sorted by x), clamped at the ends. */
export function knots(k:[number,number][],x:number){if(x<=k[0][0])return k[0][1];for(let i=1;i<k.length;i++)if(x<=k[i][0]){const [x0,y0]=k[i-1],[x1,y1]=k[i];return y0+(y1-y0)*(x-x0)/(x1-x0);}return k[k.length-1][1];}
/** Days between two ISO dates (b − a). */
export const daysBetween=(a:string,b:string)=>toDays(b)-toDays(a);
/** Mirror a rest-space point across the body's midline (x → −x). */
export const mirror=(p:Vec3):Vec3=>[-p[0],p[1],p[2]];
/** Number of marks drawn in a state list. */
export const drawn=(s:MarkState[])=>s.filter(m=>m.alpha>0).length;
/** `n` rest-space offsets spread evenly (sunflower pattern, seeded rotation and jitter) over a disc of radius `r` metres. */
export function spread(n:number,r:number,seed:number):[number,number][]{const g=rng(seed),rot=g()*Math.PI*2;return Array.from({length:n},(_,i)=>{const t=Math.sqrt((i+.5)/n)*r*(.85+g()*.3),a=i*2.39996+rot;return [Math.cos(a)*t,Math.sin(a)*t];});}
/** A seeded permutation of 0..n-1: rank[i] is mark i's place in clearing order. */
export function ranks(n:number,seed:number){const g=rng(seed),o=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(g()*(i+1));[o[i],o[j]]=[o[j],o[i]];}const r=new Array<number>(n);o.forEach((m,k)=>{r[m]=k;});return r;}
