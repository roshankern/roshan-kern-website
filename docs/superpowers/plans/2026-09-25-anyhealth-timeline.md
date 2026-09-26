# AnyHealth Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/anyhealth/timeline` plays Roshan's life from birth to today on the 3D atlas. Every part grows the way a body does, and every one of the 45 health issues changes the anatomy while it is active. An always-open Issue tracker lists the issues, each with "Isolate issue".

**Architecture:** A GPU body warp (linear blend skinning over a 15-segment rig, with segment weights precomputed from nearest-bone distance), plus a per-part effects texture. Both are injected into the existing atlas materials behind an opt-in `mode="timeline"`. Issue behaviour lives in per-area `IssueScript` modules that return per-part effects (and optional custom meshes) as a function of days since onset. A TypeScript mirror of the warp and effects drives picking and a headless clipping and overlap checker.

**Tech Stack:** Next.js 15 (app router), React 19, three.js 0.185 (`MeshStandardMaterial.onBeforeCompile` shader patching), TypeScript strict, `tsx` (new dev dependency) for the node check runner, playwright-core from the scratchpad for GLSL compile and parity checks.

**Spec:** `docs/superpowers/specs/2026-09-25-anyhealth-timeline-design.md`

## Global Constraints

- `/anyhealth` and `/anyhealth/test` must render and behave exactly as before. Every edit to `app/anyhealth/atlas/*` or `app/anyhealth/health/*` is gated behind a prop or `mode` that is off by default.
- No new runtime dependencies. `tsx` is the only new devDependency.
- All code in `app/anyhealth/timeline/**` matches the house style of `app/anyhealth/atlas/scene.tsx` / `health/*.ts`: dense one-liners are fine, JSDoc on exports, tabs in `.ts`, single quotes.
- Every medical number in code carries a comment `// basis: <area>#<key>` pointing at `docs/anyhealth/timeline-medical-basis/<area>.md`, where that key's row gives the value, the rationale, and a linked citation.
- Coordinates: model space in metres, y up, +x = the body's LEFT, +z = front. The model's rest stature is ≈1.73 m (atlas bounds max y 1.7297).
- Birth date `2003-06-22` (`BIRTH_DATE` in `health/types.ts`). Dates are ISO `YYYY-MM-DD`. Use `toDays` / `fromDays` from `health/dates.ts`.
- Visual verification is done by the user. Agents do **not** run screenshot loops. Non-visual checks (tsc, build, the check runner, the headless GLSL compile) are required.
- Site style: glass panels as in `atlas/atlas.css` (`.glass`), minimal palette. The system colours come from `SYSTEMS`.
- Parallel agents each work in their own git worktree on a branch off `anyhealth-timeline` and touch only the files listed in their task. The orchestrator merges.

## Review Focus

1. **Scrubbing backwards across an effect boundary** (for example dragging from 2010 back to 2009-09-01 across the fracture, or back before a tooth erupts). Expected: the anatomy returns exactly to the earlier state, with no one-way latches. Pinned in Task 3 (the `fxAt is pure` engine check) and Task 8 (fracture reverse-scrub check).
2. **Isolate an issue, then move the date until that issue is no longer in the tracker.** Expected: isolation stays until the user clicks Show all or changes a system switch. The tracker keeps the isolated card pinned at the top with a "Not active on this date" note. Pinned in Task 7 (`isolated issue stays pinned first when inactive`).
3. **Isolate while the relevant system is switched off** (for example isolating the fracture with Skeleton off). Expected: isolate overrides the switches and shows the parts, and the switch UI does not change. Pinned in Task 3 (`visibilityFor` engine check).
4. **Dates at the extremes:** `?date=` before birth, after today, or malformed; and play reaching today. Expected: clamped to [birth, today]; malformed falls back to birth; the growth model returns the last measurement after 2026-01-02. Pinned in Task 5 (`bodyAt` clamps) and Task 3 (`?date=` parsing check).
5. **Two scripts touching the same part at once** (for example the asthma baseline and COVID both on the bronchial trees in 2020, or croup and anaphylaxis on the trachea). Expected: effects combine by the documented merge rules, with no flicker and no one script overriding the other. Pinned in Task 6 (`mergeFx` check).

---

## Shared contracts (created in Task 1, used by every task)

`app/anyhealth/timeline/types.ts`: every agent imports from here. Nobody but Task 1 edits it. If an agent needs a change, they report it to the orchestrator.

```ts
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
	/** Swell weighting: only vertices with y in [y0,y1] (rest space) swell, with a 5 mm smooth edge. Used for local narrowing (subglottis). */
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
	/** Visibility of each system (the switches), or for isolate, whether this script is isolated. */
	systemVisible:(s:SystemId)=>boolean;
	/** True when some script is isolated and it isn't this one: hide everything. */
	hiddenByIsolate:boolean;
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
	/** Rest-pose decoded geometry of a part (positions, normals, index), shared; do not mutate. */
	restGeometry(index:number):T.BufferGeometry|undefined;
	/** A material for custom meshes that gets the same body warp. `segment` sets every vertex's segment (weight 1), or pass a per-vertex `seg` attribute on the geometry (itemSize 3: segA, segB, weightA) and leave it undefined. */
	material(opts:{color:T.ColorRepresentation;segment?:SegmentId;soft?:boolean;transparent?:boolean;opacity?:number;depthWrite?:boolean}):T.MeshStandardMaterial;
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
	/** Timeline stretch, as day ranges relative to onset, with `k` = how many times the natural width. */
	acute?:{from:number;to:number;k:number}[];
	/** Effects at `day` days since onset (fractional; may be negative or past resolve: return [] when there is nothing to show). Must be a pure function of (day, ctx). */
	fxAt(day:number,ctx:FxContext):PartFx[];
	/** Optional custom geometry. It may also return PartFx from fxAt to hide parts it replaces. */
	layer?:()=>CustomLayer;
	/** Short line under the title in the tracker, for example "Soft callus · day 12". Optional. */
	status?(day:number):string|null;
}

/** Per-part effects from growth (organs, teeth eruption, puberty, eye growth), from growth/organs.ts. */
export type GrowthFx=(body:Body)=>PartFx[];
```

---

## Wave A: foundation (serial, one agent, on `anyhealth-timeline`)

### Task 1: Contracts, check harness, decode extraction, basis doc skeleton

**Files:**
- Create: `app/anyhealth/timeline/types.ts` (exactly the block above)
- Create: `app/anyhealth/atlas/decode.ts`
- Modify: `app/anyhealth/atlas/scene.tsx` (the decode loop in `loadChunk` calls `decodePart`, with no behaviour change)
- Create: `scripts/anyhealth-timeline-check.ts`, `app/anyhealth/timeline/check/harness.ts`, `app/anyhealth/timeline/check/index.ts`, `app/anyhealth/timeline/check/node-atlas.ts`
- Create: stub check files `app/anyhealth/timeline/check/{growth,warp,fx,engine,tracker,bones,airway,digestive,eyes-teeth,skin,systemic,clipping}.check.ts`, each `export const checks:Check[]=[];`
- Create: `docs/anyhealth/timeline-medical-basis/README.md` and stub area files `{growth,bones,airway,digestive,eyes-teeth,skin,systemic}.md`
- Modify: `package.json` (devDependency `tsx`, script `"check:timeline":"tsx scripts/anyhealth-timeline-check.ts"`)

**Interfaces:**
- Produces: `decodePart(buffer:ArrayBuffer,p:Part,decoder:MeshoptDecoderLike):{position:Float32Array;normal:Int8Array;index:Uint32Array}`
- Produces: `Check`, `CheckContext` (below), `loadAtlasNode():Promise<NodeAtlas>` where `NodeAtlas={atlas:Atlas;parts:{position:Float32Array;normal:Int8Array;index:Uint32Array}[];indicesOf(name:string):number[]}`

- [ ] **Step 1: Install tsx**

Run: `npm i -D tsx`
Expected: package.json devDependencies includes `tsx`.

- [ ] **Step 2: Write `atlas/decode.ts`**

```ts
/** Decodes one part from an atlas chunk: meshopt-encoded 12-byte vertices (uint16 position within the part's bounds, int8 normal) and a meshopt index buffer. See scripts/encode-anyhealth-atlas.mjs. Shared by the viewer and the node check scripts. */
import type {Part} from './anatomy';

export interface MeshoptDecoderLike {decodeVertexBuffer(target:Uint8Array,count:number,size:number,source:Uint8Array):void;decodeIndexBuffer(target:Uint8Array,count:number,size:number,source:Uint8Array):void}

export function decodePart(buffer:ArrayBuffer,p:Part,decoder:MeshoptDecoderLike){
	const packed=new Uint8Array(p.vertexCount*12),index=new Uint32Array(p.indexCount);
	decoder.decodeVertexBuffer(packed,p.vertexCount,12,new Uint8Array(buffer,p.vertices,p.vertexBytes));
	decoder.decodeIndexBuffer(new Uint8Array(index.buffer),p.indexCount,4,new Uint8Array(buffer,p.indices,p.indexBytes));
	const q=new Uint16Array(packed.buffer),n=new Int8Array(packed.buffer),position=new Float32Array(p.vertexCount*3),normal=new Int8Array(p.vertexCount*3),[lo,hi]=p.bounds;
	for(let v=0;v<p.vertexCount;v++)for(let k=0;k<3;k++){position[v*3+k]=lo[k]+q[v*6+k]/65535*(hi[k]-lo[k]);normal[v*3+k]=n[v*12+8+k];}
	return {position,normal,index};
}
```

- [ ] **Step 3: Use it in `scene.tsx`**

In `loadChunk`, replace the block from `const packed=` through the `for(let v=0;…)` loop with:

```ts
    const {position,normal,index}=decodePart(buffer,p,MeshoptDecoder);
```

Add `import {decodePart} from './decode';`. Keep every following line (`const g=new T.BufferGeometry()…`) unchanged.

- [ ] **Step 4: Write the harness**

`app/anyhealth/timeline/check/harness.ts`:

```ts
/** A tiny check runner for node (npx tsx scripts/anyhealth-timeline-check.ts [filter]). No test framework in this repo. */
export interface CheckContext {
	assert(cond:unknown,msg:string):void;
	/** |a-b| <= tol. */
	near(a:number,b:number,tol:number,msg:string):void;
	/** Lazily decoded atlas geometry (all parts, rest pose). */
	geometry():Promise<import('./node-atlas').NodeAtlas>;
}
export interface Check {name:string;run(ctx:CheckContext):void|Promise<void>}
export class CheckFailure extends Error {}
```

(`class` is fine here: tsx handles all syntax.)

`app/anyhealth/timeline/check/node-atlas.ts`:

```ts
/** Loads public/anyhealth/models/atlas.json and every chunk from disk and decodes every part (rest pose). */
import fs from 'node:fs';import path from 'node:path';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {decodePart} from '../../atlas/decode';
import type {Atlas} from '../../atlas/anatomy';
export interface NodeAtlas {atlas:Atlas;parts:{position:Float32Array;normal:Int8Array;index:Uint32Array}[];indicesOf(name:string):number[]}
let cached:Promise<NodeAtlas>|null=null;
export function loadAtlasNode():Promise<NodeAtlas>{
	return cached??=(async()=>{
		const root=path.resolve('public'),atlas=JSON.parse(fs.readFileSync(path.join(root,'anyhealth/models/atlas.json'),'utf8')) as Atlas;
		await MeshoptDecoder.ready;
		const bufs=atlas.chunks.map(c=>{const b=fs.readFileSync(path.join(root,c.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;});
		const parts=atlas.parts.map(p=>decodePart(bufs[p.chunk],p,MeshoptDecoder));
		const byName=new Map<string,number[]>();atlas.parts.forEach((p,i)=>{const l=byName.get(p.name)??[];l.push(i);byName.set(p.name,l);});
		return {atlas,parts,indicesOf:n=>byName.get(n)??[]};
	})();
}
```

`app/anyhealth/timeline/check/index.ts`:

```ts
import type {Check} from './harness';
import {checks as growth} from './growth.check';import {checks as warp} from './warp.check';import {checks as fx} from './fx.check';
import {checks as engine} from './engine.check';import {checks as tracker} from './tracker.check';
import {checks as bones} from './bones.check';import {checks as airway} from './airway.check';import {checks as digestive} from './digestive.check';
import {checks as eyesTeeth} from './eyes-teeth.check';import {checks as skin} from './skin.check';import {checks as systemic} from './systemic.check';
import {checks as clipping} from './clipping.check';
export const ALL:Record<string,Check[]>={growth,warp,fx,engine,tracker,bones,airway,digestive,eyesTeeth,skin,systemic,clipping};
```

`scripts/anyhealth-timeline-check.ts`:

```ts
// Runs the AnyHealth timeline checks: npx tsx scripts/anyhealth-timeline-check.ts [group-or-name-filter]
import {ALL} from '../app/anyhealth/timeline/check/index';
import {CheckFailure,type CheckContext} from '../app/anyhealth/timeline/check/harness';
import {loadAtlasNode} from '../app/anyhealth/timeline/check/node-atlas';
const filter=process.argv[2]??'';let failed=0,ran=0;
const ctx:CheckContext={
	assert(c,msg){if(!c)throw new CheckFailure(msg);},
	near(a,b,tol,msg){if(!(Math.abs(a-b)<=tol))throw new CheckFailure(`${msg}: ${a} vs ${b} (tol ${tol})`);},
	geometry:loadAtlasNode,
};
for(const [group,checks] of Object.entries(ALL))for(const c of checks){
	if(filter&&!group.includes(filter)&&!c.name.includes(filter))continue;ran++;
	try{await c.run(ctx);console.log(`ok   ${group} · ${c.name}`);}catch(e){failed++;console.log(`FAIL ${group} · ${c.name}\n     ${e instanceof Error?e.message:e}`);}
}
console.log(`\n${ran-failed}/${ran} passed`);process.exit(failed?1:0);
```

- [ ] **Step 5: Add one real check to prove the harness and decode work**

In `growth.check.ts` (replaced later by Task 5 with its own contents, which must keep this check):

```ts
import type {Check} from './harness';
export const checks:Check[]=[
	{name:'atlas decodes with the documented rest stature',async run(c){const g=await c.geometry();let top=-Infinity,bottom=Infinity;g.parts.forEach(p=>{for(let i=1;i<p.position.length;i+=3){top=Math.max(top,p.position[i]);bottom=Math.min(bottom,p.position[i]);}});c.near(bottom,0,0.002,'floor');c.near(top,1.7297,0.002,'vertex');}},
];
```

- [ ] **Step 6: Run it**

Run: `npm run check:timeline`
Expected: `ok   growth · atlas decodes with the documented rest stature` then `1/1 passed`.

- [ ] **Step 7: Basis doc skeleton**

`docs/anyhealth/timeline-medical-basis/README.md` explains the format. Each area file has a table `| key | value | rationale | source |`, where the key is the anchor that code comments reference (`// basis: airway#croup-duration`). Each source is a full citation with a URL. The README also has a section "Model gaps and approximations" (lung parenchyma absent, liver caudate lobe only, no sigmoid colon, no brain hemispheres, no third molars, adult-only dentition) and "Illustrative effects", filled in by the area agents. Area stubs: a `# <Area>` heading and the empty table header.

- [ ] **Step 8: Verify nothing regressed and commit**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass.

```bash
git add -A app/anyhealth/timeline app/anyhealth/atlas/decode.ts app/anyhealth/atlas/scene.tsx scripts/anyhealth-timeline-check.ts docs/anyhealth package.json package-lock.json
git commit -m "AnyHealth timeline: contracts, check harness, shared part decoder"
```

### Task 2: Rig and segment weights (offline script + assets)

**Files:**
- Create: `scripts/anyhealth-timeline-rig.ts`
- Create (generated): `app/anyhealth/timeline/growth/rig.json`, `public/anyhealth/models/segments.bin`
- Create: `app/anyhealth/timeline/growth/segment-map.ts` (the part-name → segment table used for bones)
- Modify: `app/anyhealth/timeline/check/warp.check.ts` (rig checks only. Task 6 appends warp checks below them in the same array)

**Interfaces:**
- Consumes: `loadAtlasNode()`, `SEGMENTS`, `Rig`
- Produces: `rig.json` (a `Rig`). `segments.bin`: for every atlas part in order, `vertexCount` × 2 bytes: byte0 = `segA | segB<<4`, byte1 = `round(weightA*255)`. Also `boneSegment(name:string):SegmentId|null` from `segment-map.ts`.

- [ ] **Step 1: Write the segment map**

`segment-map.ts` exports `boneSegment(name)`. Patterns (case-insensitive; first match wins; `L`/`R` from a leading "Left"/"Right" or "of left/right"):
  - head: skull bones (frontal, parietal, occipital, temporal, sphenoid, ethmoid, nasal, lacrimal, zygomatic, maxilla, palatine, vomer, inferior nasal concha, mandible), any `tooth`, `Gingiva`, hyoid → **neck** (hyoid only), atlas/axis/cervical vertebrae and their disks → **neck**
  - trunk: thoracic and lumbar vertebrae and disks, sacrum, ribs, costal cartilages, sternum, manubrium, xiphoid, clavicle, scapula, hip bone, and the laryngeal cartilages (cricoid, thyroid, arytenoid, corniculate, cuneiform) → **neck**
  - upper arm: humerus. Forearm: radius, ulna. Hand: carpals (scaphoid, lunate, triquetrum, pisiform, trapezium, trapezoid, capitate, hamate), metacarpals, finger phalanges
  - thigh: femur, patella. Shank: tibia, fibula. Foot: tarsals (talus, calcaneus, navicular, cuboid, cuneiform bones of the foot), metatarsals, toe phalanges
  - Anything else returns `null` (non-bone parts are weighted by proximity).
  - Disambiguation: "cuneiform cartilage" is laryngeal (neck) and "cuneiform bone" is foot. The rule order must put laryngeal first.

- [ ] **Step 2: Write the rig script**

`scripts/anyhealth-timeline-rig.ts`:
  1. `loadAtlasNode()`. For each bone part with `boneSegment ≠ null`, collect its vertices into a per-segment point list (subsample every 4th vertex for the proximity grid).
  2. **Joints** = centroid of the vertices of bone A within 6 mm of any vertex of bone B (use a 6 mm spatial hash on B):
     - hip L/R: `Left femur`↔`Left hip bone`. Knee: `Left femur`↔`Left tibia`. Ankle: `Left tibia`↔`Left talus`.
     - shoulder: `Left humerus`↔`Left scapula`. Elbow: `Left humerus`↔`Left ulna`. Wrist: `Left radius`↔`Left scaphoid`.
     - neck base: `Seventh cervical vertebra`↔`First thoracic vertebra`. Head: `Atlas`↔`Occipital bone`.
     - Right side the same with `Right …`.
  3. **Distal ends:** hand = the lowest vertex of `Distal phalanx of left middle finger`. Foot = the most-forward (max z) vertex of `Distal phalanx of left big toe`. Head top = the max-y vertex of all head-segment bones. Trunk root = midpoint of hipL and hipR, and its distal end = neck base.
  4. Segments (parent): trunk(null; root→neck base), neck(trunk; neck base→head joint), head(neck; head joint→head top), l/rUpperArm(trunk; shoulder→elbow), l/rForearm(upperArm; elbow→wrist), l/rHand(forearm; wrist→fingertip), l/rThigh(trunk; hip→knee), l/rShank(thigh; knee→ankle), l/rFoot(shank; ankle→toe tip). `axis` = normalized distal−proximal and `length` = the distance. Foot axis: use ankle→toe tip.
  5. `stature` = max y of all vertices minus min y (≈1.7297).
  6. **Weights:** for every vertex of every part: if `boneSegment(part.name)` is set → segA=segB=that, weight 255. Otherwise find, per segment, the nearest distance to that segment's bone points (query the grid within 12 cm, and fall back to the nearest segment by joint distance if none). segA = nearest and segB = second nearest. `weightA = 0.5 + 0.5*smoothstep(0, 0.02, dB - dA)`. Write the 2 bytes per vertex.
  7. Print each joint, each segment length, the file sizes, and the time taken.

- [ ] **Step 3: Write rig checks** (in `warp.check.ts`)

```ts
import rig from '../growth/rig.json';
import {SEGMENTS,type Rig} from '../types';
const R=rig as Rig;
export const checks:Check[]=[
	{name:'rig has all 15 segments with parents first',run(c){c.assert(R.segments.length===15,'count');R.segments.forEach((s,i)=>{c.assert(s.id===SEGMENTS[i],`order ${s.id}`);if(s.parent)c.assert(SEGMENTS.indexOf(s.parent)<i,`parent before ${s.id}`);});}},
	{name:'rig is left/right symmetric within 1.5 cm',run(c){for(const [l,r] of [['lUpperArm','rUpperArm'],['lForearm','rForearm'],['lThigh','rThigh'],['lShank','rShank'],['lHand','rHand'],['lFoot','rFoot']] as const){const a=R.segments.find(s=>s.id===l)!,b=R.segments.find(s=>s.id===r)!;c.near(a.joint[0],-b.joint[0],0.015,`${l} x`);c.near(a.joint[1],b.joint[1],0.015,`${l} y`);c.near(a.length,b.length,0.015,`${l} length`);}}},
	{name:'adult segment lengths are anatomically plausible',run(c){const L=(id:string)=>R.segments.find(s=>s.id===id)!.length;c.near(L('lUpperArm'),0.30,0.04,'humerus');c.near(L('lThigh'),0.44,0.05,'femur');c.near(L('lShank'),0.39,0.05,'tibia');c.near(R.stature,1.7297,0.003,'stature');}},
	{name:'segments.bin covers every vertex',async run(c){const g=await c.geometry();const fs=await import('node:fs');const n=fs.statSync('public/anyhealth/models/segments.bin').size;c.assert(n===g.parts.reduce((s,p)=>s+p.position.length/3,0)*2,'size');}},
];
```

- [ ] **Step 4: Run the script, then the checks**

Run: `npx tsx scripts/anyhealth-timeline-rig.ts && npm run check:timeline warp`
Expected: joints printed (left shoulder ≈ [0.18, 1.40, −0.03]), `segments.bin` ≈ 3.6 MB, all rig checks pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/anyhealth-timeline-rig.ts app/anyhealth/timeline/growth/rig.json app/anyhealth/timeline/growth/segment-map.ts public/anyhealth/models/segments.bin app/anyhealth/timeline/check/warp.check.ts
git commit -m "AnyHealth timeline: 15-segment rig and nearest-bone segment weights"
```

### Task 3: Engine skeleton, scene hooks, page, stub scripts (identity everything)

**Files:**
- Create: `app/anyhealth/timeline/page.tsx`, `app/anyhealth/timeline/engine.ts`, `app/anyhealth/timeline/issues/index.ts`, `app/anyhealth/timeline/issues/catalog/{bones,airway,digestive,eyes-teeth,skin,systemic}.ts`, `app/anyhealth/timeline/growth/organs.ts` (stub `export const growthFx:GrowthFx=()=>[]`), `app/anyhealth/timeline/growth/proportions.ts` (stub below), `app/anyhealth/timeline/growth/warp.ts` + `warp-glsl.ts` (identity stubs below), `app/anyhealth/timeline/fx/part-fx.ts` + `part-fx-glsl.ts` (stubs below), `app/anyhealth/timeline/tracker/issue-tracker.tsx` (stub list), `app/anyhealth/timeline/issues/pacing.ts` (stub `export const pacing=():Density[]=>[]`)
- Modify: `app/anyhealth/atlas/atlas-app.tsx`, `app/anyhealth/atlas/scene.tsx`, `app/anyhealth/atlas/atlas.css` (a `.studio.timeline` block only)

**Interfaces (stubs other tasks replace; the signatures are final):**

```ts
// growth/proportions.ts
export function bodyAt(date:string):Body;             // stub: adult proportions, scale=1, all factors 1
// growth/warp.ts
export interface WarpState {/** per segment, index = SEGMENTS order */ restJoint:Float32Array;axis:Float32Array;newJoint:Float32Array;alongScale:Float32Array;boneScale:Float32Array;softScale:Float32Array;/** y shift to keep the feet on the floor */ ground:number}
export function warpState(rig:Rig,body:Body):WarpState;
export function warpPoint(ws:WarpState,p:Vec3,segA:number,segB:number,wA:number,soft:boolean,out:Vec3):Vec3;
// growth/warp-glsl.ts
export const WARP_PARS:string;   // GLSL declarations (uniforms + function)
export const WARP_APPLY:string;  // GLSL that rewrites `transformed` and `objectNormal`; see Task 6
export function warpUniforms():Record<string,{value:unknown}>;  // uniform objects, shared by every material
export function writeWarpUniforms(u:ReturnType<typeof warpUniforms>,ws:WarpState):void;
// fx/part-fx.ts
export const FX_ROWS=6;
export interface FxTexture {texture:import('three').DataTexture;width:number;data:Float32Array}
export function createFxTexture(partCount:number):FxTexture;
export function mergeFx(list:PartFx[],indicesOf:(name:string)=>number[],restCenter:(i:number)=>Vec3):Map<number,ResolvedFx>;
export interface ResolvedFx {visible:number;swell:number;tint:[number,number,number,number];scale:Vec3;rotate:Quat;translate:Vec3;pivot:Vec3;swellBand:[number,number]|null}
export function writeFx(tex:FxTexture,merged:Map<number,ResolvedFx>):boolean; // true if any texel changed
export function applyFxPoint(fx:ResolvedFx,p:Vec3,n:Vec3,out:Vec3):Vec3;       // TS mirror of the shader
// fx/part-fx-glsl.ts
export const FX_PARS:string; export const FX_APPLY:string;
// issues/index.ts
export const SCRIPTS:IssueScript[];  // concatenation of every catalog area's SCRIPTS
export function scriptFor(id:string):IssueScript|undefined;
export function activeWindow(s:IssueScript,today:string):{from:string;to:string}; // to = resolve, or today when chronic
// engine.ts
export interface EngineFrame {date:string;visible:SystemId[];isolate:string|null;now:number}
export interface Engine {
	patchMaterial(m:import('three').Material,opts:{partFx:boolean;soft:boolean}):void;
	/** Per-vertex attributes to add to each part geometry before merging (segment weights). */
	segAttribute(partIndex:number):import('three').BufferAttribute;
	/** After every chunk is decoded: build custom layers. */
	ready(pickers:(import('three').Mesh|undefined)[]):void;
	update(f:EngineFrame):{changed:boolean;animating:boolean;fly:import('three').Box3|null};
	/** Re-warp picker geometry and the shared per-part bounds (in place). Call when the date settles. */
	settle():void;
	/** Warped union box of an issue's parts and layer, for Isolate. */
	isolateBox(id:string):import('three').Box3|null;
	dispose():void;
}
export function createEngine(o:{atlas:import('../atlas/anatomy').Atlas;scene:import('three').Scene;bounds:import('three').Box3[];rig:Rig;segments:ArrayBuffer}):Engine;
```

- [ ] **Step 1: Stubs.** Write every stub file above with identity behaviour, so the page renders the adult model unchanged. `WARP_PARS=''`, `WARP_APPLY=''`, `FX_PARS=''`, `FX_APPLY=''`. `bodyAt` returns scale 1 and all factors 1. Each catalog area file exports `SCRIPTS:IssueScript[]` with one stub script per issue id it owns (the table below), with `parts` set to the anchor part from `health/anchors.ts`, `onset` = the record date, `resolve` = endDate or onset+30 days, and `fxAt:()=>[]`.

**Issue ownership (all 45; each id appears in exactly one area):**

| Area | Issue ids |
|---|---|
| bones | left-humerus-fracture-2009, healing-humerus-callus-2009, scoliosis-upper-thoracic-2025 |
| airway | infant-laryngomalacia-2003, infant-croup-neck-xray-2003, recurrent-croup-childhood, sky-ridge-er-airway-2016, chco-picu-subglottitis-2016, microlaryngoscopy-bronchoscopy-2016, asthma-diagnosis-chronic, spirometry-asthma-confirmed-2022, pulmonary-reeval-2024, budesonide-formoterol-rx-2026, covid-19-infection-2020 |
| digestive | encopresis-constipation-childhood, silent-reflux-lpr-omeprazole, gerd-diagnosis-pantoprazole-famotidine-2026, famotidine-nightly-rx-2026 |
| eyes-teeth | infant-left-exotropia, bilateral-myopia, first-cavity-filling-tooth-3, fillings-teeth-30-31-composite, city-creek-fillings-30-31, wisdom-teeth-extraction |
| skin | neonatal-acne-cradle-cap, childhood-atopic-dyshidrotic-eczema, chin-laceration-er-2010, forehead-laceration-2011, right-shin-laceration-2014, verruca-vulgaris-2018, acne-diagnosis-topical-treatment, isotretinoin-accutane-course |
| systemic | peanut-tree-nut-food-allergy, allergy-workup-tree-nuts-egg-2004, egg-anaphylaxis-daycare, allergic-rhinitis-oral-allergy-syndrome-2016, allergy-ige-panel-2016, allergic-rhinitis-immunotherapy-eval, walnut-accidental-exposure-2026, microcytosis-suspected-thalassemia-2004, first-abnormal-cbc-2023, hematology-eval-2024, beta-thalassemia-minor-confirmed-2024, function-health-cbc-thalassemia-signature-2026, function-health-out-of-range-2026 |

- [ ] **Step 2: Engine skeleton.** `createEngine` holds a `WarpState`, the shared warp uniforms, an `FxTexture` sized to `atlas.parts.length`, and the list of `SCRIPTS`. It decodes `segments` into per-part `Float32Array` attributes `seg` (itemSize 3: segA, segB, weightA/255). `patchMaterial` chains any existing `onBeforeCompile`. It injects `FX_PARS`/`WARP_PARS` after `#include <common>`, and `FX_APPLY` then `WARP_APPLY` after `#include <begin_vertex>` (and after `#include <beginnormal_vertex>` for normals, as Task 6 defines), and binds the uniforms. The stub `update` computes `bodyAt(date)` and `warpState`, writes uniforms, collects `SCRIPTS.flatMap(s=>s.fxAt(days(date)-days(s.onset),ctx))` plus `growthFx(body)` plus isolate visibility (every part not in the isolated script's `parts` gets `visible:0`), merges with `mergeFx`, calls `writeFx`, and runs each layer's `update`. It returns `changed` when the date or isolate changed, or a layer reported a change. `settle` and `isolateBox` are real from the start: `settle` rewrites each picker's position attribute via `applyFxPoint` then `warpPoint` from a stored rest copy, recomputes its bounding sphere, and recomputes `bounds[i]`.

- [ ] **Step 3: Scene hooks (opt-in).** `scene.tsx` gains props `timeline?:{date:string;isolate:string|null;onFly?:()=>void}` and `segments?:ArrayBuffer`, `rig?:Rig`. When `timeline` is set:
  - Create the engine right after `partTexture`: `const engine=timeline?createEngine({atlas,scene,bounds,rig,segments}):null`.
  - In `materialFor`, after setting `m.onBeforeCompile`, call `engine?.patchMaterial(m,{partFx:true,soft:['muscular','integumentary','connective'].includes(system)})`.
  - In `loadChunk`, before pushing `g` into its system group, `if(engine)g.setAttribute('seg',engine.segAttribute(i));`
  - When `ready` becomes true, call `engine.ready(pickers)`.
  - In `animate`, use a `latestTimeline` ref (like `latestDate` in the fracture code): `const r=engine.update({date,visible:s.visible,isolate,now:performance.now()});if(r.changed||r.animating)dirty=true;if(r.fly)focusBox(r.fly,1.35);`. Also track the last date change: if the date hasn't changed for 150 ms and no settle has run since, call `engine.settle()`.
  - **Visibility in timeline mode goes through the engine only.** The `lastState` block writes `data[i*4+3]=1` for every part (partState never discards). The engine writes fx row 0 `visible` from `visibilityFor(atlas.parts,visibleSystems,isolatedParts)`: when isolating, 1 only for parts named in the isolated script (whatever the switches say); otherwise 1 when the part's system is switched on. That result is multiplied into the merged PartFx visibility. Export `visibilityFor(parts:{name:string;system:SystemId}[],visible:SystemId[],isolate:Set<string>|null):Float32Array` from `engine.ts`.
  - Issue dots are not rendered in timeline mode (`{!timeline&&<IssueDots …/>}`).
  - Expose `focusBox` for Isolate through a new optional prop `onApi?:(api:{focusBox(b:T.Box3):void})=>void`, called once after mount.
  - Cleanup calls `engine?.dispose()`.
  - The fracture props (`date`, `fracture`) stay untouched. Timeline mode never sets them.
- [ ] **Step 4: AtlasApp.** Add `mode?:'default'|'timeline'` (default `'default'`). In timeline mode:
  - Fetch `/anyhealth/models/segments.bin` alongside atlas.json.
  - Parse `?date=` exactly as the fracture code does.
  - Pass `timeline={{date,isolate}}`, `rig`, `segments` to the scene.
  - Render `TimelineBar` with `issues={[]}` and `warp={pacing()}`.
  - Render `<IssueTracker …/>` instead of `IssuePanel`.
  - Add the class `timeline` on `<main>`.
  - Keep BodyStats.
  - The Systems switches clear `isolate` on any change.
- [ ] **Step 5: Page.**

```tsx
import { type JSX } from "react";
import type { Metadata } from "next";
import AtlasApp from "../atlas/atlas-app";

/** AnyHealth timeline: growth and every health issue animated on the atlas (see app/anyhealth/timeline). Not indexed while in progress. */
export const metadata: Metadata = {
	title: { absolute: "AnyHealth · timeline" },
	description: "My body's growth and health story, animated.",
	robots: { index: false, follow: false },
};

export default function AnyHealthTimelinePage(): JSX.Element {
	return <AtlasApp mode="timeline" />;
}
```

- [ ] **Step 6: Engine checks** (`engine.check.ts`), with a fake `LayerContext`-free pure part:

```ts
import {SCRIPTS,scriptFor} from '../issues';
import issues from '../../health/issues.json';
import atlas from '../../../../public/anyhealth/models/atlas.json';
export const checks:Check[]=[
	{name:'every issue has exactly one script',run(c){const ids=(issues as {id:string}[]).map(i=>i.id);ids.forEach(id=>c.assert(SCRIPTS.filter(s=>s.id===id).length===1,`script count for ${id}`));c.assert(SCRIPTS.length===ids.length,'no extra scripts');}},
	{name:'every script part exists in the atlas',run(c){const names=new Set((atlas as {parts:{name:string}[]}).parts.map(p=>p.name));SCRIPTS.forEach(s=>{c.assert(s.parts.length>0,`${s.id} parts`);s.parts.forEach(p=>c.assert(names.has(p),`${s.id}: no part "${p}"`));});}},
	{name:'every script has a resolve date or is chronic',run(c){SCRIPTS.forEach(s=>c.assert(s.chronic||!!s.resolve,`${s.id} window`));}},
	{name:'fxAt is pure: same inputs give the same output, and scrubbing backwards restores state',run(c){/* for every script, at days [-1,0,0.5,3,30,400]: JSON.stringify(fxAt(d)) equal on two calls, and evaluating d=30 then d=-1 equals a fresh d=-1 */}},
];
```

The last check body must be written out fully:

```ts
run(c){const ctx={body:bodyAt('2010-01-01'),date:'2010-01-01'};for(const s of SCRIPTS){const at=(d:number)=>JSON.stringify(s.fxAt(d,ctx));for(const d of [-1,0,0.5,3,30,400])c.assert(at(d)===at(d),`${s.id} impure at ${d}`);const before=at(-1);at(30);c.assert(at(-1)===before,`${s.id} not reversible`);}}
```

(with `import {bodyAt} from '../growth/proportions';`)

- [ ] **Step 6b: Visibility check** (in `engine.check.ts`):

```ts
import {visibilityFor} from '../engine';
{name:'isolate overrides the system switches; switches apply otherwise',run(c){const parts=[{name:'Left humerus',system:'skeletal' as const},{name:'Heart',system:'cardiac' as const}];const iso=visibilityFor(parts,['cardiac'],new Set(['Left humerus']));c.assert(iso[0]===1&&iso[1]===0,'isolate shows humerus with skeleton off, hides heart');const off=visibilityFor(parts,['cardiac'],null);c.assert(off[0]===0&&off[1]===1,'switches');}},
```

- [ ] **Step 7: Page date parsing check.** Move the `?date=` parser into `timeline/url-date.ts` as `parseDateParam(q:string|null,today:string):string`, and have AtlasApp timeline mode use it. Check in `engine.check.ts`:

```ts
{name:'?date= clamps and falls back',run(c){const t='2026-09-25';c.assert(parseDateParam(null,t)==='2003-06-22','none');c.assert(parseDateParam('1999-01-01',t)==='2003-06-22','before birth');c.assert(parseDateParam('2030-01-01',t)===t,'future');c.assert(parseDateParam('2009-02-30',t)==='2003-06-22','invalid day');c.assert(parseDateParam('2009-09-02',t)==='2009-09-02','valid');}},
```

- [ ] **Step 8: Verify**

Run: `npm run check:timeline && npx tsc --noEmit && npm run build`
Expected: all pass. `npm run dev`, then `curl -s -o /dev/null -w '%{http_code}' localhost:3000/anyhealth/timeline` prints `200`, and the same for `/anyhealth` and `/anyhealth/test`.

- [ ] **Step 9: Commit**

```bash
git add -A app/anyhealth
git commit -m "AnyHealth timeline: engine skeleton, opt-in scene hooks, /anyhealth/timeline page"
```

---

## Wave B: parallel (each in its own worktree off `anyhealth-timeline` after Task 3; each touches only its listed files)

### Task 4: Medical basis research: growth

**Files:** `docs/anyhealth/timeline-medical-basis/growth.md` only (research lands as markdown; no code).

- [ ] **Step 1:** Research and tabulate, with citations and URLs:
  - WHO 0–5 y and CDC 2–20 y stature and weight medians (for reference girth).
  - **Segment-to-stature ratios by age** (0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, adult) for: head+neck height (vertex to C7), head height (vertex to chin/occiput base), sitting height (trunk+neck+head), upper arm, forearm, hand, thigh, shank, foot length. Sources: Snyder et al. 1977 (UM-HSRI-77-17, "Anthropometry of infants, children and youths to age 18"), NHANES/CDC sitting height, and Tanner.
  - Limb and trunk circumferences (arm, thigh, chest, waist) relative to stature by age, and their dependence on BMI-for-age.
  - Scammon growth-type curves (general, neural, lymphoid, genital) as % of adult by age.
  - Organ-specific data: thymus mass by age (peak around puberty, then involution), liver % body mass by age, eye axial length by age (≈16.5–17 mm at birth → ≈23.5–24 mm adult), testicular volume by Tanner stage and age.
  - Primary and permanent tooth eruption ages (ADA chart), per tooth position in the model (central/lateral incisor, canine, first/second premolar, first/second molar, upper vs lower).
- [ ] **Step 2:** Every row: `key | value | rationale | source`. Keys used by Task 5: `ratio-head`, `ratio-neck`, `ratio-trunk`, `ratio-upperarm`, `ratio-forearm`, `ratio-hand`, `ratio-thigh`, `ratio-shank`, `ratio-foot`, `girth-bone`, `girth-soft`, `scammon-neural`, `scammon-lymphoid`, `scammon-genital`, `thymus`, `liver`, `eye-axial`, `testis`, `erupt-<tooth>`.
- [ ] **Step 3: Commit** `git add docs/anyhealth/timeline-medical-basis/growth.md && git commit -m "AnyHealth timeline: growth medical basis"`

Tasks 5 and 10 run at the same time as this one. They research the same sources themselves for their numbers and put the same keys in comments. The orchestrator reconciles any disagreement in integration (Task 15).

### Task 5: Proportions and organ growth

**Files:**
- Modify: `app/anyhealth/timeline/growth/proportions.ts` (replace the stub), `app/anyhealth/timeline/growth/organs.ts` (replace the stub)
- Modify: `app/anyhealth/timeline/check/growth.check.ts` (keep the Task 1 check)

**Interfaces:**
- Consumes: `health/growth.ts` `makeGrowth`, `growth.json`, `rig.json`, `Body`, `GrowthFx`
- Produces: `bodyAt(date):Body`; `growthFx:GrowthFx` (organ scale fx about the part centre: thymus, liver caudate lobe, eyeballs (all left/right eye parts: sclera, cornea, lens, iris, choroid, vitreous, retina, anterior chamber, corona ciliaris), testes, penis parts, prostate, seminal vesicles, epididymides)

- [ ] **Step 1: Write the failing checks**

```ts
import {bodyAt} from '../growth/proportions';import {growthFx} from '../growth/organs';
import growth from '../../health/growth.json';
// (keep the Task 1 decode check first)
{name:'bodyAt reproduces every measurement within 0.5%',run(c){for(const g of growth as {date:string;heightCm?:number;weightKg?:number}[]){const b=bodyAt(g.date);if(g.heightCm)c.near(b.statureM*100,g.heightCm,g.heightCm*0.005,`height ${g.date}`);if(g.weightKg)c.near(b.weightKg,g.weightKg,g.weightKg*0.005,`weight ${g.date}`);}}},
{name:'bodyAt clamps before birth and after the last measurement',run(c){c.near(bodyAt('2000-01-01').statureM,bodyAt('2003-06-22').statureM,1e-9,'before birth');c.near(bodyAt('2030-01-01').statureM,bodyAt('2026-01-02').statureM,1e-9,'future');}},
{name:'head ratio: ~1/4 of stature at birth, ~1/8 adult',run(c){const head=(d:string)=>{const b=bodyAt(d);return b.length.head*b.scale*headRest/b.statureM;};c.near(head('2003-06-22'),0.25,0.02,'birth');c.near(head('2026-01-02'),headRest/1.7297,0.005,'adult = model');}},
{name:'leg ratio grows from ~0.32 at birth to adult',run(c){/* thigh+shank+foot-height vs stature, same pattern */}},
{name:'segment factors are continuous day to day (no jump > 0.5%)',run(c){let prev=bodyAt('2003-06-22');for(let d=1;d<8500;d+=1){const b=bodyAt(fromDays(toDays('2003-06-22')+d));for(const s of SEGMENTS){c.assert(Math.abs(b.length[s]-prev.length[s])<0.005,`${s} jump at ${b.date}`);}prev=b;}}},
{name:'thymus peaks in childhood, eyes reach adult size, testes grow in puberty',run(c){const f=(d:string,part:string)=>growthFx(bodyAt(d)).find(x=>x.part===part)?.scale?.[0]??1;c.assert(f('2013-01-01','Left lobe of thymus')>f('2026-01-01','Left lobe of thymus'),'thymus involutes');c.near(f('2026-01-01','Left sclera'),1,0.02,'adult eye');c.assert(f('2003-06-22','Left sclera')<0.8,'infant eye smaller relative');c.assert(f('2012-01-01','Left testis')<f('2020-01-01','Left testis'),'puberty');}},
```

Write out the leg-ratio check body in full: `const b=bodyAt(d);const leg=(b.length.lThigh*thighRest+b.length.lShank*shankRest)*b.scale/b.statureM`. Assert ≈0.32±0.03 at birth and within 0.01 of the model ratio at adult. `headRest`, `thighRest` and `shankRest` come from `rig.json` segment lengths.

Note: the organ factors in `growthFx` are *relative to the warp*. The warp already scales everything by `scale × segment factors`, so `growthFx` holds only the deviation (organ size relative to adult ÷ body scale at that location).

- [ ] **Step 2:** Run `npm run check:timeline growth` → FAIL (the stub returns scale 1).
- [ ] **Step 3: Implement `bodyAt`**
  - Stature and weight from `makeGrowth(growth.json)`, clamped to [first, last] measurement. `scale = statureM / rig.stature`.
  - Age-indexed reference ratio tables (cited `// basis: growth#ratio-*`), with monotone cubic (Fritsch–Carlson) interpolation in age.
  - `length[s] = ratio_s(age) / ratio_s(adult model)`, where the adult-model ratio = rig segment length / rig stature (and for the head, the rig head+neck length).
  - Renormalise so the sum of vertical segments (shank + thigh + trunk + neck + head, projected on y) × scale equals `statureM` exactly.
  - Girth: `boneGirth[s]` = the age-based width/length reference. `softGirth[s] = boneGirth[s] × (1 + k·(BMI(age) − BMI_ref(age))/BMI_ref(age))`, with k from `growth#girth-soft`, clamped to [0.85, 1.25].
- [ ] **Step 4: Implement `growthFx`** from the Scammon and organ tables (scale about the part centre, uniform xyz). Reproductive: prepubertal size until 11, then Tanner-timed growth to adult by 16.
- [ ] **Step 5:** Run `npm run check:timeline growth` → PASS. Run `npx tsc --noEmit` → pass.
- [ ] **Step 6: Commit** `git commit -am "AnyHealth timeline: growth proportions from measurements and reference curves"`

### Task 6: Body warp (TS + GLSL) and part effects (TS + GLSL)

**Files:**
- Modify: `app/anyhealth/timeline/growth/warp.ts`, `warp-glsl.ts`, `app/anyhealth/timeline/fx/part-fx.ts`, `part-fx-glsl.ts`
- Modify: `app/anyhealth/timeline/check/warp.check.ts` (append after the rig checks), `fx.check.ts`
- Create: `scripts/anyhealth-timeline-glsl.ts` (the headless compile and parity check)

**Interfaces:** exactly the Task 3 signatures.

**Warp math (both TS and GLSL must implement exactly this):**

For segment i (in SEGMENTS order): rest joint `J_i`, axis `a_i`, along factor `ℓ_i = body.length[id]`, perpendicular factor `γ_i = soft ? body.softGirth[id] : body.boneGirth[id]` (bone factor for joints), global `S = body.scale`.

```
newJoint[trunk] = J_trunk * S                       (scale about the origin; the floor is fixed up by `ground`)
newJoint[i] = T_parent(J_i) using the parent's BONE girth    (parents are always computed first)
T_i(p) = newJoint[i] + S * ( ℓ_i * (d·a_i) a_i + γ_i * (d − (d·a_i) a_i) ),  d = p − J_i
p' = wA * T_segA(p) + (1 − wA) * T_segB(p);  p'.y += ground
ground = −min over the four foot points: rest (ankle joint − (0, footHeight, 0)) warped as a bone, i.e. keep the lowest warped sole point at y=0.
Normal: M_i = S*(ℓ_i a aᵀ + γ_i (I − a aᵀ)); N_i = (1/ℓ_i) a aᵀ + (1/γ_i)(I − a aᵀ); n' = normalize(wA N_segA n + (1−wA) N_segB n).
```

GLSL: uniforms `uniform vec4 twJ[15]; uniform vec4 twA[15]; uniform vec4 twN[15]; uniform vec4 twS[15]; uniform float twGround; uniform float twSoft;` where `twJ=(restJoint,0)`, `twA=(axis,0)`, `twN=(newJoint,0)`, `twS=(along, bone, soft, 0)`. Per material: `twSoft` (0/1) comes from `patchMaterial` opts. The attribute is `attribute vec3 seg;`. Use `int(seg.x+0.5)` for indexing. Constant-index loops are required in WebGL1, but three uses WebGL2 (GLSL ES 3.0), where dynamic uniform array indexing is allowed. Guard with `#if __VERSION__ < 300` → `#error`. Avoid reserved words (`patch`, `sample`, `input`, `output`, `filter`, `active`, `common`, `partition`, `smooth`, `flat` as identifiers).

**Part-fx texture:** `FX_ROWS=6` rows × `width = ceilPowerOfTwo(partCount)` columns, RGBA float, `NearestFilter`:
- row 0: `(visible, swell, swellBandY0, swellBandY1)`. A band of `(0,0)` means no band.
- row 1: `tint (r,g,b,amount)`
- row 2: `(pivot.xyz, 0)`
- row 3: `rotate quat (x,y,z,w)`
- row 4: `(scale.xyz, 0)`
- row 5: `(translate.xyz, 0)`

Applied in rest space before the warp: `p1 = pivot + rotate(scale*(p − pivot)) + translate`, then `p1 += n * swell * bandWeight(p.y)`. The normal is rotated by the quat and scaled by the inverse scale. In the fragment shader, `diffuseColor.rgb = mix(diffuseColor.rgb, tint.rgb, tint.a)` (inject after `#include <color_fragment>`), and `visible < 0.5` discards (in addition to the existing partState discard). Identity defaults: visible 1, swell 0, tint amount 0, pivot = rest centre, quat (0,0,0,1), scale 1, translate 0.

**mergeFx rules:** visible = product; swell = sum; tint = the entry with max amount; scale = componentwise product; rotate = quaternion product in list order; translate = sum; pivot = first specified, else the rest bounds centre; swellBand = first specified.

- [ ] **Step 1: Write the failing checks** (`warp.check.ts` appended, `fx.check.ts`):

```ts
// warp.check.ts (append)
{name:'identity body leaves every point unchanged',run(c){const ws=warpState(R,unitBody());const out:Vec3=[0,0,0];for(const p of [[0,1,0],[0.2,1.3,0],[0.1,0.4,0]] as Vec3[]){warpPoint(ws,p,0,3,0.5,false,out);c.near(out[0],p[0],1e-9,'x');c.near(out[1],p[1],1e-9,'y');c.near(out[2],p[2],1e-9,'z');}}},
{name:'children stay attached: each joint maps to the same point under parent and child',run(c){const ws=warpState(R,bodyAt('2008-01-01'));R.segments.forEach((s,i)=>{if(!s.parent)return;const pi=SEGMENTS.indexOf(s.parent);const a:Vec3=[0,0,0],b:Vec3=[0,0,0];warpPoint(ws,s.joint,i,i,1,false,a);warpPoint(ws,s.joint,pi,pi,1,false,b);c.near(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),0,1e-6,`${s.id} joint`);});}},
{name:'warped stature equals bodyAt stature and feet stay on the floor',async run(c){const g=await c.geometry();for(const d of ['2003-06-22','2006-06-22','2012-01-01','2026-01-02']){const b=bodyAt(d),ws=warpState(R,b);let lo=Infinity,hi=-Infinity;/* warp every 7th vertex of every part with its seg weights from segments.bin */ c.near(lo,0,0.003,`floor ${d}`);c.near(hi-lo,b.statureM,b.statureM*0.01,`stature ${d}`);}}},
{name:'warp is continuous across segment weights (no seam tears > 1 mm)',async run(c){/* for each part with mixed seg weights, for each triangle, the warped edge length / rest edge length stays within [0.2, 5] × the triangle's max segment scale — no triangle stretched across a seam */}},
```

Write both geometry checks in full. They read `segments.bin` with `fs.readFileSync` and slice per part in atlas order (offset += vertexCount×2). Helper: `unitBody()` = a `Body` with scale 1 and every factor 1.

```ts
// fx.check.ts
{name:'mergeFx combines by the documented rules',run(c){const idx=(n:string)=>n==='A'?[0]:[];const m=mergeFx([{part:'A',visible:0.5,swell:0.001,scale:[2,1,1],tint:[1,0,0,0.3]},{part:'A',visible:0.5,swell:0.002,scale:[1.5,1,1],tint:[0,0,1,0.6],translate:[0,0.01,0]}],idx,()=>[0,0,0]).get(0)!;c.near(m.visible,0.25,1e-9,'visible');c.near(m.swell,0.003,1e-9,'swell');c.near(m.scale[0],3,1e-9,'scale');c.near(m.tint[2],1,1e-9,'tint winner');c.near(m.translate[1],0.01,1e-9,'translate');}},
{name:'identity fx leaves points unchanged; scale about pivot keeps the pivot fixed',run(c){/* applyFxPoint with default ResolvedFx → same point; with scale 2 about pivot [1,1,1], point [1,1,1] → [1,1,1] and [2,1,1] → [3,1,1] */}},
{name:'swellBand only swells inside the band',run(c){/* point y inside band moves by swell along n; point 2 cm outside does not move */}},
```

Write out the two fx bodies in full with the numbers given.

- [ ] **Step 2:** Run `npm run check:timeline warp` and `npm run check:timeline fx` → FAIL.
- [ ] **Step 3: Implement the TS** (`warp.ts`, `part-fx.ts`) per the math above.
- [ ] **Step 4:** Run both → PASS.
- [ ] **Step 5: Implement the GLSL** strings (`warp-glsl.ts`, `part-fx-glsl.ts`), line for line with the TS.
- [ ] **Step 6: GLSL compile + parity script** `scripts/anyhealth-timeline-glsl.ts`:
  - Install playwright-core in the scratchpad (`npm i playwright-core` in `$SCRATCHPAD/glsl`) and launch the cached Chromium at `~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` with `--use-angle=swiftshader --enable-unsafe-swiftshader`.
  - In a blank page with an inline WebGL2 program, render 64 test points (as `gl.POINTS`, one per pixel) through a vertex shader made from `FX_PARS + WARP_PARS` and a body that calls the same code as `FX_APPLY`/`WARP_APPLY`. Write the warped xyz to an RGBA32F target (`EXT_color_buffer_float`) and read it back.
  - Compare against `applyFxPoint` + `warpPoint` in node. Max error < 1e-5 m.
  - Print compile errors verbatim.
- [ ] **Step 7:** Run `npx tsx scripts/anyhealth-timeline-glsl.ts` → `compile ok · parity max err <1e-5`.
- [ ] **Step 8: Commit** `git commit -am "AnyHealth timeline: body warp and part effects (TS + GLSL, parity-checked)"`

### Task 7: Issue tracker, Isolate, pacing

**Files:**
- Modify: `app/anyhealth/timeline/tracker/issue-tracker.tsx`
- Create: `app/anyhealth/timeline/tracker/tracker.css`, `app/anyhealth/timeline/tracker/tracker-model.ts`
- Modify: `app/anyhealth/timeline/issues/pacing.ts`
- Modify: `app/anyhealth/timeline/check/tracker.check.ts`
- Modify (light): `app/anyhealth/health/issue-panel.tsx`, only to `export` the existing `Figure`, `Labs`, `Chart` components (no behaviour change)

**Interfaces:**
- Consumes: `SCRIPTS`, `scriptFor`, `activeWindow`, `Issue` data, and the `Figure`/`Labs`/`Chart` exports
- Produces:
  - `trackerEntries(date:string,today:string,isolated:string|null):TrackerEntry[]`, where `TrackerEntry={issue:Issue;script:IssueScript;state:'active'|'resolved'|'isolated-inactive';day:number}`
  - `<IssueTracker date today isolated onIsolate(id|null)/>`
  - `pacing(today:string):Density[]`

- [ ] **Step 1: Write the failing checks**

```ts
import {trackerEntries} from '../tracker/tracker-model';import {pacing} from '../issues/pacing';import {makeWarp} from '../../health/warp';
const T0='2026-09-25';
{name:'fracture is active on 2009-09-10 and gone by 2011',run(c){c.assert(trackerEntries('2009-09-10',T0,null).some(e=>e.issue.id==='left-humerus-fracture-2009'&&e.state==='active'),'active');c.assert(!trackerEntries('2011-01-01',T0,null).some(e=>e.issue.id==='left-humerus-fracture-2009'),'gone');}},
{name:'resolved issues linger 7 days with state resolved',run(c){const s=scriptFor('chco-picu-subglottitis-2016')!;const d=fromDays(toDays(s.resolve!)+3);c.assert(trackerEntries(d,T0,null).find(e=>e.issue.id===s.id)?.state==='resolved','resolved chip');c.assert(!trackerEntries(fromDays(toDays(s.resolve!)+8),T0,null).some(e=>e.issue.id===s.id),'faded');}},
{name:'chronic issues stay through today',run(c){c.assert(trackerEntries(T0,T0,null).some(e=>e.issue.id==='asthma-diagnosis-chronic'),'asthma');}},
{name:'isolated issue stays pinned first when inactive',run(c){const e=trackerEntries('2020-01-01',T0,'left-humerus-fracture-2009');c.assert(e[0]?.issue.id==='left-humerus-fracture-2009'&&e[0].state==='isolated-inactive','pinned');}},
{name:'entries are newest onset first',run(c){const e=trackerEntries('2016-12-23',T0,null).filter(x=>x.state!=='isolated-inactive');for(let i=1;i<e.length;i++)c.assert(e[i-1].script.onset>=e[i].script.onset,'order');}},
{name:'pacing keeps quiet time >= 40% of the track',run(c){const min=toDays('2003-06-22'),max=toDays(T0),w=makeWarp(min,max,pacing(T0));const dens=pacing(T0);let quiet=0;for(let d=min;d<max;d++){const inDense=dens.some(r=>d>=toDays(r.from)&&d<toDays(r.to));if(!inDense)quiet+=w.toT(d+1)-w.toT(d);}c.assert(quiet>=0.4,`quiet ${quiet}`);}},
{name:'pacing ranges are sorted and non-overlapping',run(c){const d=pacing(T0);for(let i=1;i<d.length;i++)c.assert(d[i-1].to<=d[i].from,'overlap');}},
```

- [ ] **Step 2:** Run `npm run check:timeline tracker` → FAIL.
- [ ] **Step 3: Implement `tracker-model.ts`.** An issue is shown if `onset ≤ date ≤ resolve+7d` (or chronic and `onset ≤ date`). State is `resolved` when `date > resolve`. The isolated id is always included first, as `isolated-inactive` when outside its window. The rest are sorted by onset descending.
- [ ] **Step 4: Implement `pacing.ts`.** Gather `onset+from..onset+to` ranges with `k` from every script's `acute`. Union overlaps, taking max k. Then, if the quiet share is below 40%, scale every `k` down, `k' = 1 + (k−1)·f`, finding `f` by bisection so the quiet share is exactly ≥ 0.40.
- [ ] **Step 5: Implement `issue-tracker.tsx`**, styled in `tracker.css` (imported by the component). A glass panel at the right (`.issue-tracker`, using `--issue-panel-w` / `--panel-inset` so `scene.tsx` `issueFootprint()` reserves its space). Contents:
  - Heading "Issue tracker" and a count "N active".
  - Cards: title, `formatRange`, system dot + `SYSTEMS` name (from `anchorFor(issue).system`), `CATEGORY_LABEL`, "Source: …" (same wording as `issue-panel.tsx`), `script.status?.(day)`, "Illustrative" tag, summary, Figure/Labs/Chart.
  - Button "Isolate issue" / "Show all" (`aria-pressed`).
  - A new card animates in (`@keyframes tracker-in`: 180 ms opacity/translate). Resolved cards get a "Resolved" chip at opacity .6.
  - On ≤767px: a bottom sheet collapsed to a 44px peek bar "N active issues", which expands on tap to 60vh with its own scroll.
  - An empty state: "No active issues on this date."
- [ ] **Step 6:** Run `npm run check:timeline tracker && npx tsc --noEmit` → PASS.
- [ ] **Step 7: Commit** `git commit -am "AnyHealth timeline: Issue tracker, isolate, event pacing"`

### Tasks 8–13: Issue catalog areas (one agent each, in parallel)

Every area agent follows the same shape. Each one owns `app/anyhealth/timeline/issues/catalog/<area>.ts`, `app/anyhealth/timeline/check/<area>.check.ts`, `docs/anyhealth/timeline-medical-basis/<area>.md`, and any new files under `app/anyhealth/timeline/issues/<area>/`. They must not edit any other file.

**Shared steps for every area task:**
- [ ] **Research:** fill the area's basis doc table. Every numeric parameter has a key, value, rationale and cited source with URL. Read each owned issue's full `summary` in `app/anyhealth/health/issues.json` and use the record's own facts first (dates, sites, counts, severity). Add "Illustrative" and "Model gap" notes to the README sections, appending only under your own `### <area>` subheading.
- [ ] **Write failing checks** (the area-specific checks below, plus this shared set, written in full in `<area>.check.ts`):

```ts
import {SCRIPTS as AREA} from '../issues/catalog/<area>';import {bodyAt} from '../growth/proportions';
const at=(id:string,d:number,date='2016-01-01')=>AREA.find(s=>s.id===id)!.fxAt(d,{body:bodyAt(date),date});
{name:'<area>: no effect before onset',run(c){AREA.forEach(s=>c.assert(s.fxAt(-1,{body:bodyAt(s.onset),date:s.onset}).every(f=>(f.swell??0)===0&&(f.tint?.[3]??0)===0&&(f.scale??[1,1,1]).every(v=>v===1)&&(f.visible??1)===1&&!f.translate&&!f.rotate),`${s.id} before onset`));}},
{name:'<area>: resolved non-chronic issues return to baseline',run(c){AREA.filter(s=>!s.chronic&&!s.layer).forEach(s=>{const d=toDays(s.resolve!)-toDays(s.onset)+60;c.assert(s.fxAt(d,{body:bodyAt(s.resolve!),date:s.resolve!}).every(f=>(f.swell??0)===0&&(f.tint?.[3]??0)===0),`${s.id} after resolve`);});}},
{name:'<area>: effects ramp (no step > 25% of peak between adjacent hours in the first 3 days)',run(c){/* sample d=0..3 step 1/24; track max |Δswell| and |Δtint.a| and max |Δscale-1| relative to each's peak */}},
```

  Write the ramp check body out in full. The "resolved" check skips scripts whose record says a permanent change (scar, filling, extraction). Those must set `chronic:true`.
- [ ] **Run** `npm run check:timeline <area>` → FAIL. **Implement.** **Run** → PASS, and `npx tsc --noEmit` passes.
- [ ] **Commit** `git commit -am "AnyHealth timeline: <area> issues"`

#### Task 8: bones

- Port the fracture to a `CustomLayer`. Move `app/anyhealth/fracture/fracture-scene.ts` logic into `app/anyhealth/timeline/issues/bones/fracture-layer.ts`, and **import** `fractureAt`, `breakKick` and the constants from `app/anyhealth/fracture/model.ts` (leave the fracture folder in place: `/anyhealth/test` still uses it).
  - Custom meshes use `ctx.material({color,segment:'lUpperArm'})`, so they grow with the arm.
  - Hide the original humerus by returning `{part:'Left humerus',visible:0}` from `fxAt` while `fractureAt` is non-null (instead of writing `data`).
  - The snap plays only when `direction===1` crosses day 0. The camera fly uses `ctx.requestFly(box)` once per forward crossing.
- `left-humerus-fracture-2009`: onset 2009-09-02, resolve = onset+400 d (HEALED_DAY), `layer`, `status` from `fractureAt(...).phase`, `acute` = the fracture PR's `TIMELINE_DENSITY` expressed relative to onset. `parts: ['Left humerus']`.
- `healing-humerus-callus-2009`: onset 2009-09-25, resolve = fracture onset+400, `parts: ['Left humerus']`, `fxAt: ()=>[]` (the fracture script draws it). `status` = "Callus on the day-23 film".
- `scoliosis-upper-thoracic-2025`: chronic. It develops over 2020-01 → 2025-07 (adolescent onset, discovered on 2025-07-08 imaging; basis: the record's measured angle if the summary gives one, else a mild 10–15° Cobb, cited). T1–T6 vertebrae (+ disks) get lateral translate and axial rotate along a smooth arc with its apex at T3–T4, convexity per the record. Ribs 1–6 on each side follow their vertebra's translate. `parts`: T1–T6 names + their disks + ribs 1–6 L/R.
- Area checks: (a) fracture: at day 10 the fx hides `Left humerus`, at day 401 it doesn't, and at day −1 it doesn't (reverse scrub). (b) scoliosis: at today, the lateral offset of T3/T4 ≥ that of T1 and T6, and |offset| ≤ 1.2 cm. (c) adjacent vertebra translates differ by < 4 mm (no shearing apart).

#### Task 9: airway

- Laryngomalacia: epiglottis scale `[0.85,1,1.1]` curl plus a slight posterior rotate, peaking at 2–4 months of age and resolving by 12–18 months (cited).
- Croup episodes: build an explicit episode list. The 2003-09-08 X-ray episode, recurrent episodes 2004-01-15 → 2016-12-15 (the summary gives counts/frequency: use them, spread deterministically with a seeded PRNG if the dates aren't given, and say so in the basis doc), the 2016-11-02 ER + PICU (the worst, 3 days).
  - Each episode: `Trachea` swell negative −(1.5–3.5) mm with `swellBand` = the subglottic band (y from the cricoid lower edge to −2 cm; take it from the `Cricoid cartilage` rest bounds), tint red, 4-day course.
- Microlaryngoscopy/bronchoscopy 2016-12-15: a 1-day highlight tint on `Epiglottis`, `Trachea`, main bronchi.
- Asthma (chronic from 2016-12-22): all bronchial-tree parts (every atlas name matching /bronch/i in the respiratory system) get a baseline swell −0.3 mm and a faint tint. Flares at the 2016-12-22, 2022-08-01, 2024-12-05 and 2026-09-02 visits: −0.8 mm over 10 days, then back to baseline. Budesonide-formoterol 2026-09-02 → 09-15 eases toward a reduced baseline. `spirometry-*`, `pulmonary-reeval-*` and `budesonide-*` are short windows that point at the same parts.
- COVID 2020-08-28: `illustrative`, patchy tint on a deterministic 40% subset of the segmental bronchial trees, 14 days.
- Area checks: (a) PICU peak narrowing > every other croup episode's. (b) The subglottic swell only affects the Trachea within the band (use `applyFxPoint` on a vertex 5 cm below the band → unchanged). (c) The asthma baseline is present on 2019-01-01 and stronger on 2016-12-25.

#### Task 10: eyes-teeth

- Files also include `app/anyhealth/timeline/issues/teeth/wisdom-layer.ts` and `app/anyhealth/timeline/issues/teeth/eruption.ts`. Eruption fx is exported as `eruptionFx:GrowthFx`, and **Task 15 wires it** into the engine next to `growthFx`.
- Exotropia 2003-07-07 → 2004-03-22: the left globe parts (sclera, cornea, lens, iris, choroid, vitreous body, retina, anterior chamber, corona ciliaris, suspensory ligament) rotate outward (+yaw toward +x) about the left globe centre by the angle for 1–2 mm corneal reflex displacement (Hirschberg: ≈ 7°/mm, cited), then return to straight by the end date.
- Myopia (chronic from 2018-12-15): both globes elongate along z about the globe centre by `0.35 mm × dioptres`. Use the record's refraction if the summary gives it, else a cited typical value. Progress from onset to 2 years after onset.
- Fillings: a composite-coloured tint (a slightly whiter, bluish enamel, amount 0.55) on the named molar, `chronic`. Tooth #3 = `Right upper first secondary molar tooth`. #30 = `Right lower first secondary molar tooth`. #31 = `Right lower second secondary molar tooth`. The 2024 refill brightens the same teeth again.
- Wisdom teeth: a `CustomLayer` that clones the four second molars' rest geometry, scaled 0.9, and places it distal to each second molar (offset along the dental arch tangent by that molar's mesiodistal width + 1 mm). `ctx.material({segment:'head'})`. They erupt 17–21 y (cited) or stay partly impacted per the summary. Hidden from 2023-12-26 on, with a socket healing tint on the gingiva for 6 weeks. `chronic:true` (the extraction is permanent).
- Eruption (`eruptionFx`): per tooth type and arch, hidden before the eruption start age, then a translate along the occlusal direction (upper teeth move down, lower up) from −6 mm to 0 plus a scale of 0.6 → 1 over the eruption window, visible once above half-way. Before the permanent teeth come in, the incisor, canine and premolar positions show scaled-down (0.7) stand-ins for the baby teeth from their primary eruption ages. They swap to the permanent tooth through a brief 0 visibility during exfoliation. Cite the ADA tables.
- Area checks: (a) no permanent molar visible at age 2. The first molars are visible at age 7, and every tooth at 14. (b) Exotropia angle at 2003-08 > 0 and at 2004-03-22 = 0. (c) Myopia elongation at today is within the cited range. (d) Wisdom layer: `box()` sits behind the second molars (smaller z than their centres) in rest space.

#### Task 11: skin

- A `CustomLayer` module `app/anyhealth/timeline/issues/skin/marks-layer.ts`, shared by all skin scripts.
  - It finds the Skin vertex nearest each anchor hint (from `health/anchors.ts`), builds a local tangent frame from that vertex's normal, and draws small meshes offset 0.3 mm along the normal. `ctx.material({color,segment:<segment at the hint>})`, where the segment comes from that Skin vertex's `seg` weights (`LayerContext.restGeometry` + a new helper `segOfVertex` implemented inside the layer by reading `segments.bin` from the engine through `ctx.restGeometry(index).getAttribute('seg')`).
- **Lacerations:** a red line (a thin tapered ribbon, with length from the record, else cited typical lengths) plus suture ticks for the recorded counts (shin: 11). Healing: inflamed 0–7 d, sutures removed at the cited day (face 5 d, leg 10–14 d), pink scar to 90 d, then a pale scar at 25% opacity forever (`chronic:true`).
- **Neonatal acne & cradle cap:** a cluster of 12–20 small papules on the cheeks and a scalp scale tint (tint `Hair of head`/`Skin` near the scalp via the marks layer), clearing by 3–4 months.
- **Eczema:** a dyshidrotic vesicle cluster on the right palm with flares, improving through childhood (cite the natural history). Resolve per the summary.
- **Warts:** 2–4 rough papules on the left hand, cleared by the cited typical duration or the record.
- **Acne 2021:** comedones + inflammatory papules on the face. **Isotretinoin** 2022-01-03 → 06-28: marks fade over the course (cite the response curve), plus an `illustrative` lip-dryness tint on `Lip`.
- Area checks: (a) the marks layer places every anchor within 3 mm of the Skin surface (rest). (b) Shin suture count = 11 at day 3 and 0 after removal. (c) Acne marks at 2022-06-28 < 20% of their 2021-12-31 count.

#### Task 12: digestive

- **Encopresis** 2010-01-19 → 2012-06-22: `Rectum` and `Descending colon` scale radially (x and z about their centres; y ×1.1 for the rectum) up to the cited dilation (rectal diameter in chronic functional constipation vs normal for age), developing over the 6 months before onset (onset = diagnosis). It shrinks back over the treatment period to the end date. Faecal loading shown as a darker tint.
- **LPR** 2026-01-03: `Esophagus` tint (inflammation red, amount ≤0.35) with `swellBand` over the upper esophagus (the laryngopharyngeal junction region, from the Esophagus rest bounds top 5 cm). It fades over 8–12 weeks on PPI.
- **GERD** 2026-08-11 → 08-28: `Esophagus` distal-band tint + `Stomach` mild tint, fading with the pantoprazole/famotidine course. **Famotidine** 2026-09-02 (chronic nightly) holds a very low residual.
- Area checks: (a) the rectum scale peak is within the cited range. (b) At 2012-12-22 the rectum scale is 1. (c) The LPR band doesn't touch the distal 10 cm (applyFxPoint check).

#### Task 13: systemic (illustrative)

- **Thalassemia** (microcytosis suspected 2004-07-01; then chronic): every arterial part gets tint `[0.86,0.52,0.40,0.18]` (paler, more orange red). The amount steps up slightly at confirmation 2024-05-20. The CBC/hematology/Function Health ids are short windows (30 d) on `Wall of ventricle` + the aorta parts with a slightly stronger tint that rises and falls over 7 days (`fxAt` must be pure, so no wall-clock pulsing).
- **Food allergy** (chronic from 2003-12-22): a faint `Tongue` + `Lip` tint. Allergy workup 2004 and IgE panel 2016: 14-day glow.
- **Egg anaphylaxis** 2005-05-02: `Tongue` scale 1.15, `Lip` scale 1.2, pharyngeal constrictors swell +1 mm, `Epiglottis` swell +1 mm, and `Trachea` subglottic narrowing −1.5 mm. Onset over 30 min (day 0 → 0.02), peak to 0.25 d, resolved by 2 d.
- **Walnut exposure** 2026-03-01: the same pattern at 40% severity, resolved by 1 d.
- **Allergic rhinitis** (chronic from 2016-07-11): inferior nasal conchae swell +1 mm with seasonal pulses (spring/fall peaks by date). Immunotherapy from 2022-08-01 reduces the amplitude linearly over 3 years (cited).
- Every script in this area is `illustrative:true`.
- `acute` for anaphylaxis: `{from:-0.5,to:3,k:60}`.
- Area checks: (a) anaphylaxis tongue scale at day 0.1 > at day 1.5, and at day 2.5 = 1. (b) The arterial tint is present on 2010-01-01 and absent on 2004-06-30. (c) The rhinitis pulse amplitude in 2025 < in 2021.

---

## Wave C: integration (serial)

### Task 14: Merge the waves and wire the growth fx

**Files:** `app/anyhealth/timeline/engine.ts`, `app/anyhealth/timeline/issues/index.ts` (the orchestrator merges the worktree branches first)

- [ ] **Step 1:** Merge each Wave B branch into `anyhealth-timeline` in order: 4, 5, 6, 7, 8–13. Resolve conflicts, which should only be in files a task was not allowed to touch; if a task touched them, keep the owner's version.
- [ ] **Step 2:** In `engine.update`, include `eruptionFx(body)` next to `growthFx(body)`. Pass `direction` (the sign of the date change) and `requestFly` to layers. Layer `update(day)` is called for every script with a layer, with `day` = days since its onset.
- [ ] **Step 3:** `isolateBox(id)` = the union of the warped `bounds[i]` of `parts` + the layer `box()` warped through `warpPoint` (8 corners).
- [ ] **Step 4: Performance fallback.** On `ready`, read `WEBGL_debug_renderer_info`. If it matches /SwiftShader|llvmpipe/i → `renderer.setPixelRatio(1)`. During play, keep an exponential frame-time average. If it is below 30 fps for 2 s → pixel ratio 1. If it is still below 30 fps, the engine skips `writeFx`/uniform updates unless ≥100 ms have passed since the last one (and always applies on pause or settle).
- [ ] **Step 5:** Run `npm run check:timeline && npx tsc --noEmit && npm run build` → all pass. Run `npx tsx scripts/anyhealth-timeline-glsl.ts` → compile ok. Also compile-check the real page: load `/anyhealth/timeline?date=2009-09-10` under the headless Chromium and fail on any `THREE.WebGLProgram: Shader Error` console message. This is a compile check, not a screenshot.
- [ ] **Step 6: Commit** `git commit -am "AnyHealth timeline: integrate growth, warp, effects, tracker and every issue area"`

### Task 15: Clipping, containment and overlap checks, and fixes

**Files:** `app/anyhealth/timeline/check/clipping.check.ts`. Fixes go in whichever module is at fault (coordinate with the owner's code; the orchestrator makes the edits).

**Method:** for each test date, warp every vertex in node with `applyFxPoint` (merged fx from all scripts + growth + eruption) then `warpPoint` (seg weights from segments.bin). Build the needed hulls:
- **Rib cage hull** = the convex hull of the warped vertices of ribs 1–12 L/R + sternum + manubrium + costal cartilages + T1–T12. **Pelvis/abdomen hull** = the convex hull of the warped vertices of the hip bones, sacrum, L1–L5 and the lower ribs 10–12, extended up to the xiphoid.
- Use a simple quickhull or, simpler and robust: the hull as a set of half-planes from `three/examples/jsm/math/ConvexHull.js` (it works in node).
- "Inside skin" is tested by casting a ray from the vertex toward +x/−x/+z/−z and counting Skin crossings (odd = inside), using the warped Skin mesh with a BVH-free grid of triangles (bucket triangles in a 1 cm grid).

**Dates:** `['2003-06-22','2004-06-22','2006-06-22','2009-06-22','2013-06-22','2017-06-22','2021-06-22','2026-01-02']` plus each script's peak day (the day in [0, window] where the sum of |swell| + |scale−1| + tint is highest; sample daily).

- [ ] **Step 1: Write the checks** (each prints the failing part, date and worst distance):
  1. `organs inside rib cage`: `Wall of ventricle` (all heart parts), bronchial trees, main bronchi, thymus lobes. ≥ 98% of each part's vertices inside the hull, and none more than 3 mm outside.
  2. `abdominal organs inside the abdomen`: rectum, the colons, stomach, bladder, kidneys. Same thresholds (hull extended by 1 cm anteriorly, since the abdominal wall is soft tissue).
  3. `eyes inside the orbits`: the globe parts' centre stays within 4 mm of the rest-relative orbit centre (the frontal/zygomatic/maxilla orbit opening centroid, warped), and no globe vertex is outside the Skin.
  4. `teeth seated`: each visible tooth's lowest (lower arch: highest) 30% of vertices lie inside the jaw bone's (maxilla/mandible) bounding hull, inflated by 1 mm.
  5. `bones inside the skin`: ≥ 99.5% of each bone's vertices inside the Skin (hands and feet allow 99%). The worst offender is reported.
  6. `joint seams`: for each rig joint, the warped positions of the joint point under the parent vs child transforms agree within 1 mm, and bones of adjacent segments near the joint (within 1 cm rest) don't come closer than −1 mm (interpenetration) compared with rest.
  7. `vertebrae don't interpenetrate` at the scoliosis peak: adjacent vertebral bodies' warped bounding boxes overlap in y by no more than their rest overlap + 1 mm.
  8. `fracture fragments vs callus` at days 0, 10, 25 and 45: the distal fragment's end cap lies inside the callus shell or within 2 mm of the proximal cap (reuse the fracture layer's geometry via a node-side `init` with a fake `LayerContext`).
  9. `GLSL/TS parity at scale`: re-run the glsl script with 2,048 real vertices from mixed-weight parts; max error < 1e-5.
- [ ] **Step 2:** Run `npm run check:timeline clipping` and record the failures.
- [ ] **Step 3:** Fix each failure at its source, one commit per fix:
  - growth ratios → Task 5 code
  - seams → segment weights (rerun the rig script with an adjusted blend width) or warp
  - organ escapes → per-organ growth fx
  - teeth → eruption translate
- [ ] **Step 4:** Rerun until everything passes. Then run `npm run check:timeline && npx tsc --noEmit && npm run build`.
- [ ] **Step 5: Commit** `git commit -am "AnyHealth timeline: clipping, containment and overlap checks pass"`

### Task 16: Final review and handoff

- [ ] Confirm `/anyhealth` and `/anyhealth/test` return 200, and that the diff of `atlas/*`/`health/*` shows only opt-in additions (read `git diff main -- app/anyhealth/atlas app/anyhealth/health`).
- [ ] Update the about-sheet copy in timeline mode only: add a paragraph that growth is fitted to Roshan's measurements with reference proportions, and that effects tagged Illustrative are stylized.
- [ ] Whole-branch review (superpowers:requesting-code-review). Push the branch and open a draft PR `AnyHealth timeline: growth and health story` with the Netlify preview.
- [ ] Hand over to the user for visual review with a list of what is verified (checks) vs unverified (looks).
