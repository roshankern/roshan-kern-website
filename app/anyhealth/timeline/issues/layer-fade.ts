/** Ghosting for custom layers (LayerFrame.ghost): a layer of a script that is not the focused one fades to opacity × mix(1, GHOST_ALPHA, ghost) instead of hiding, with no program switch on any frame:
 * - an already transparent material (callus, clots, skin marks) just scales its opacity and drops depth writes (fadeMaterial: state only, no recompile);
 * - an opaque material (fragments, caps, wisdom teeth) never flips `transparent`: its mesh swaps to the material's permanent ghost twin (fadeMesh), a transparent clone sharing its shader hooks, defines and uniforms.
 *   Layers create the twins in init (ghostTwin), so Engine.prewarm compiles them with everything else. At ghost 0 every mesh and material is exactly what its layer set. */
import type * as T from 'three';
import {GHOST_ALPHA} from '../director/types';

/** mix(1, GHOST_ALPHA, ghost). */
export const ghostOpacity=(ghost:number)=>1+(GHOST_ALPHA-1)*Math.min(1,Math.max(0,ghost));

/** For a transparent material: `own` opacity × ghostOpacity(ghost), and `own` depthWrite only while unfaded; true if anything changed. Never touches `transparent` (no recompile). */
export function fadeMaterial(m:T.Material,own:{opacity:number;depthWrite:boolean},ghost:number):boolean{
	const f=ghostOpacity(ghost),opacity=own.opacity*f,depthWrite=own.depthWrite&&f>=1;let changed=false;
	if(m.opacity!==opacity){m.opacity=opacity;changed=true;}
	if(m.depthWrite!==depthWrite){m.depthWrite=depthWrite;changed=true;}
	return changed;
}

const twins=new WeakMap<T.Material,T.Material>();
/** The permanent ghost twin of an opaque layer material (created once): a clone with the same defines, onBeforeCompile and program cache key (so the same uniform objects), transparent, no depth writes. Call it after the material's shader hooks are final. */
export function ghostTwin(m:T.Material):T.Material{
	let t=twins.get(m);if(t)return t;
	t=m.clone();t.defines={...m.defines};t.onBeforeCompile=m.onBeforeCompile;t.customProgramCacheKey=m.customProgramCacheKey;t.transparent=true;t.depthWrite=false;twins.set(m,t);return t;
}
/** The twin of `m`, if one was made. */
export const twinOf=(m:T.Material)=>twins.get(m);

/** Fade a mesh whose own material `own` is opaque: `own` at ghost 0; above, its ghost twin at own opacity × ghostOpacity (colour synced from `own`). True if anything changed. */
export function fadeMesh(mesh:T.Mesh,own:T.Material,ghost:number):boolean{
	const f=ghostOpacity(ghost);let changed=false;
	if(f<1){const t=ghostTwin(own) as T.MeshStandardMaterial,o=own as T.MeshStandardMaterial,opacity=own.opacity*f;if(t.opacity!==opacity){t.opacity=opacity;changed=true;}if(o.color&&!t.color.equals(o.color)){t.color.copy(o.color);changed=true;}}
	const want=f<1?ghostTwin(own):own;if(mesh.material!==want){mesh.material=want;changed=true;}
	return changed;
}
