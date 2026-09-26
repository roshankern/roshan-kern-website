/** Ghosting for custom layers (LayerFrame.ghost): a layer of a script that is not the focused one fades to opacity × mix(1, GHOST_ALPHA, ghost) instead of hiding. While faded a material draws transparent with no depth writes
 * (a translucent silhouette that hides nothing behind it); at ghost 0 it is exactly what its layer set. */
import type * as T from 'three';
import {GHOST_ALPHA} from '../director/types';

/** mix(1, GHOST_ALPHA, ghost). */
export const ghostOpacity=(ghost:number)=>1+(GHOST_ALPHA-1)*Math.min(1,Math.max(0,ghost));

/** Set `m` to the layer's own look (`own`: its unfaded opacity, transparent and depthWrite) faded by `ghost`; true if anything changed (a transparent flip also flags the material for recompile). */
export function fadeMaterial(m:T.Material,own:{opacity:number;transparent:boolean;depthWrite:boolean},ghost:number):boolean{
	const f=ghostOpacity(ghost),faded=f<1,opacity=own.opacity*f,transparent=own.transparent||faded,depthWrite=own.depthWrite&&!faded;let changed=false;
	if(m.opacity!==opacity){m.opacity=opacity;changed=true;}
	if(m.transparent!==transparent){m.transparent=transparent;m.needsUpdate=true;changed=true;}
	if(m.depthWrite!==depthWrite){m.depthWrite=depthWrite;changed=true;}
	return changed;
}
/** An opaque, depth-writing material's own look. */
export const SOLID={opacity:1,transparent:false,depthWrite:true} as const;
