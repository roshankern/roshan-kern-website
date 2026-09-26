/** Shared contracts for the AnyHealth timeline. See docs/superpowers/specs/2026-09-25-anyhealth-timeline-design.md. */
import type * as T from 'three';
import type {Atlas,SystemId} from '../atlas/anatomy';

export type Vec3=[number,number,number];
export type Quat=[number,number,number,number];

/** The 15 rig segments. The order is the segment index used in segments.bin and the shader (0..14). */
export const SEGMENTS=['trunk','neck','head','lUpperArm','lForearm','lHand','rUpperArm','rForearm','rHand','lThigh','lShank','lFoot','rThigh','rShank','rFoot'] as const;
export type SegmentId=typeof SEGMENTS[number];

export interface Segment {
	id:SegmentId;
	parent:SegmentId|null;
	/** Rest-pose proximal joint, model metres. */
	joint:Vec3;
	/** Unit axis, proximal → distal, rest pose. */
	axis:Vec3;
	/** Rest length along the axis, metres. */
	length:number;
}
/** timeline/growth/rig.json, written by scripts/anyhealth-timeline-rig.ts. */
export interface Rig {segments:Segment[];/** Rest stature (floor to vertex), metres. */stature:number}

/** The body on one date, from growth/proportions.ts. */
export interface Body {
	date:string;
	ageYears:number;
	statureM:number;
	weightKg:number;
	/** statureM / rig.stature. */
	scale:number;
	/** Per segment: along-axis length factor, relative to `scale` (1 = adult-model proportion). */
	length:Record<SegmentId,number>;
	/** Axial remap (growth/warp.ts) rate of the face interval, rest menton → atlanto-occipital joint, relative to `scale`. Absent (hand-built bodies): length.head. bodyAt sets it (with craniumLength) so vertex→menton = length.head × the rest head height (growth.md growth#face-cranium). */
	faceLength?:number;
	/** Axial remap rate of the cranium interval, atlanto-occipital joint → vertex, relative to `scale`. Absent: length.head. */
	craniumLength?:number;
	/** Axial remap bone girth (lateral / AP scale) of the face interval, relative to `scale`. Absent: boneGirth.head (which then drives the cranium interval alone). */
	faceGirth?:number;
	/** Per segment: perpendicular factor for bone and organ tissue, relative to `scale`. */
	boneGirth:Record<SegmentId,number>;
	/** Per segment: perpendicular factor for soft tissue (muscular, integumentary, connective), relative to `scale`. */
	softGirth:Record<SegmentId,number>;
}

/** One part-level effect. `part` is an exact atlas part name and applies to every part with that name. */
export interface PartFx {
	part:string;
	/** 0..1, multiplied. */
	visible?:number;
	/** Push along the vertex normal, metres (negative = narrowing). Added. */
	swell?:number;
	/** [r,g,b,amount] 0..1, linear. The highest amount wins. */
	tint?:[number,number,number,number];
	/** Per-axis scale about `pivot`, in model axes. Multiplied componentwise. */
	scale?:Vec3;
	/** Rotation about `pivot`. Composed (applied in script order). */
	rotate?:Quat;
	/** Metres, model axes. Added. */
	translate?:Vec3;
	/** Rest-space pivot. Default: the part's rest bounds centre. The first specified wins. */
	pivot?:Vec3;
	/** Swell weighting: only vertices with y in [y0,y1] (rest space) swell, with a 5 mm smooth edge. Used for local narrowing (subglottis). Different bands on one part merge to their union (min y0, max y1). */
	swellBand?:[number,number];
}

export interface FxContext {body:Body;/** The date being shown. */date:string}

/** Extra geometry beyond the atlas parts (fracture fragments, wisdom teeth, skin marks). */
export interface CustomLayer {
	/** Called once, after every chunk is decoded. Return false if the layer can't be built (it is then skipped). */
	init(ctx:LayerContext):boolean;
	/** Apply the state for `day` (days since the script's onset; may be negative or past resolve). Return whether anything changed or is still animating. */
	update(day:number,frame:LayerFrame):{changed:boolean;animating:boolean};
	/** Box to frame for this layer (Isolate / fly), in rest space. */
	box():T.Box3|null;
	dispose():void;
}
export interface LayerFrame {
	/** Visibility of each system (the switches); always true for a focused script's layer (the focused id or its focusAlso: a focus shows its issue whatever the switches say, as its parts). */
	systemVisible:(s:SystemId)=>boolean;
	/** 0..1, how far this layer fades toward GHOST_ALPHA (director/types.ts) because another script is focused; 0 when this script is focused (or in the focused script's focusAlso) or nothing is. Layers scale their opacity by mix(1, GHOST_ALPHA, ghost) (issues/layer-fade.ts) instead of hiding. */
	ghost:number;
	/** Whether a script is focused as `isolated` means it (the focused id or in its focusAlso, at ghost > 0), e.g. for a layer that yields to another script's copy of its marks. */
	focused(id:string):boolean;
	/** True when this script is focused (the focused id, or listed in its focusAlso) at ghost > 0, guided or manual Isolate: what a layer drawn "only when isolated" keys on. */
	isolated:boolean;
	now:number;
	/** Wall-clock direction of the last date change: 1 forward, -1 back, 0 none. */
	direction:-1|0|1;
	ctx:FxContext;
}
export interface LayerContext {
	scene:T.Scene;
	atlas:Atlas;
	/** Atlas part indices for an exact part name. */
	indicesOf(name:string):number[];
	/** Rest-pose decoded geometry of a part (positions, normals, index, float `seg` = (segA, segB, weightA) and `segD` = rest distance to the nearest bone in metres, from segments.bin), shared; do not mutate. */
	restGeometry(index:number):T.BufferGeometry|undefined;
	/** A material for custom meshes that gets the same body warp. `segment` sets every vertex's segment (weight 1), or pass a per-vertex `seg` attribute on the geometry (itemSize 3: segA, segB, weightA) and leave it undefined; with `soft` and `segD: true`, a float `segD` attribute (rest distance to the nearest bone, metres; required then) adds the soft-girth inflation (growth/warp.ts). */
	material(opts:{color:T.ColorRepresentation;segment?:SegmentId;soft?:boolean;segD?:boolean;transparent?:boolean;opacity?:number;depthWrite?:boolean}):T.MeshStandardMaterial;
	/** Ask the scene to fly the camera to frame a rest-space box (warped by the engine first). */
	requestFly(box:T.Box3):void;
}

export interface IssueScript {
	/** Matches an id in app/anyhealth/health/issues.json. */
	id:string;
	/** Exact atlas part names shown on Isolate (plus any custom layer). Non-empty. */
	parts:string[];
	/** ISO onset (usually the record date). */
	onset:string;
	/** ISO date the issue resolves. Required unless `chronic`. */
	resolve?:string;
	/** Active from onset through today. */
	chronic?:boolean;
	/** Stylized rather than literal anatomy: shown with an "Illustrative" tag. */
	illustrative?:boolean;
	/** Timeline stretch, as day ranges relative to onset, with `k` = how many times the natural width. v1 pacing only (the v2 director ignores it). */
	acute?:{from:number;to:number;k:number}[];
	/** v2 director: days since onset (fractional) of the issue's peak visible state, where guided playback holds. Inside the active window, with non-empty fx (or the layer showing) there. Required once Task 2 has filled every catalog. */
	climax?:number;
	/** v2 director: days of lead-in the approach leg covers, so the onset animation plays slowly in focus. Default min(30, climax + lead). */
	approachDays?:number;
	/** v2 director: unit direction from the focus target to the camera for this stop. Default: the default view's direction. */
	view?:Vec3;
	/** v2: script ids whose layers and parts stay solid when this script is focused (a stop drawn by another script's layer, e.g. the callus by the fracture layer). The engine's focus flags, layer ghosting and focusBox all include them. */
	focusAlso?:string[];
	/** Effects at `day` days since onset (fractional; may be negative or past resolve: return [] when there is nothing to show). Must be a pure function of (day, ctx). */
	fxAt(day:number,ctx:FxContext):PartFx[];
	/** Optional custom geometry. It may also return PartFx from fxAt to hide parts it replaces. */
	layer?:()=>CustomLayer;
	/** Short line under the title in the tracker, for example "Soft callus · day 12". Optional. */
	status?(day:number):string|null;
}

/** Per-part effects from growth (organs, teeth eruption, puberty, eye growth), from growth/organs.ts. */
export type GrowthFx=(body:Body)=>PartFx[];
