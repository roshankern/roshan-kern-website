# AnyHealth timeline v2: the guided "director"

Status: approved in brainstorming 2026-09-26. Builds on the v1 timeline (tag `anyhealth-timeline-v1`, spec `2026-09-25-anyhealth-timeline-design.md`). Everything v1 does (growth warp, 45 issue scripts, tracker, systems, 155 checks) stays; this reworks how time, camera and isolate move.

## Intent

The timeline is for viewing issues. Playback should feel like one continuous, Lenis-smooth shot: follow the body growing in a steady framing, and at each issue's climax slow down, isolate (ghost the rest), zoom in, and wait. The viewer reads, presses **Continue**, and the shot zooms out, un-ghosts and cruises to the next issue. Every issue is stopped at exactly once, even long or chronic ones. Timing is for the viewer, not proportional to real dates.

What the user said, verbatim decisions:
- Default view: the slightly tilted three-quarter view; the body takes the same vertical screen height at every age (start zoomed in, zoom out as it grows). The platform keeps its world size, so growth reads against it.
- Stop sequence: slow down → isolate → zoom in → hold → Continue → zoom out → un-isolate → cruise. All smooth.
- Isolate look: **ghosted context** — the issue's parts solid, everything else a faint translucent silhouette (~12% opacity), 0.6 s crossfade.
- Pacing: **steady cruise with eased stops** — about 2 s per year of life between stops, each cruise leg clamped to 1.5–5 s wall-clock, easing smoothly into and out of stops.
- Scrubbing: **free** — dragging the bar moves through time in the normal view with no auto stops; the bar shows one tick per stop; clicking a tick flies to that stop; Play resumes guided mode from wherever you are.
- Architecture: **approach A** — one pure story clock drives everything; no springs. The only concession to user input: when the camera was moved by hand, the next automated leg starts from the actual camera (a timed rejoin blend), not the scripted pose.

## Glossary

- **Story time** `s` (ms): the director's single scalar. Holds occupy zero story time; the clock simply stops at a hold's story time until Continue.
- **Stop**: one per issue script, at its climax date.
- **Trip**: story time between consecutive hold instants (or birth → first stop, last stop → today).
- **Legs of a trip**: release (1800 ms, leaving the previous stop), cruise (1500–5000 ms), approach (2500 ms, arriving at the next stop). The first trip has no release; the last trip has no approach (it ends at today in the default view, phase `end`).
- **ghost** ∈ [0,1]: 0 = everything solid, 1 = non-focus parts at ghost opacity.
- **zoom** ∈ [0,1]: 0 = default pose for the date, 1 = focus pose of the stop.

## Components

### 1. Script fields (`timeline/types.ts`, catalogs)

`IssueScript` gains:
- `climax:number` — **required**. Days since onset (fractional allowed) of the issue's peak visible state: the moment the anatomy looks most like the issue (fracture: just displaced; constipation: peak colon dilation; scoliosis: its maximum curve before today; croup: peak subglottic narrowing). Must lie inside the active window (onset−lead … resolve, or … today when chronic) and `fxAt(climax)` must be non-empty (or the layer visible). Each value carries a `// basis: area#key` comment; the basis docs in `docs/anyhealth/timeline-medical-basis/` get a "Climax" line per issue.
- `approachDays?:number` — days of the issue's lead-in the approach leg covers (so the onset animation plays slowly while in focus). Default: `min(30, climax + lead)`; fracture-like instant events use ≤ 1.
- `view?:Vec3` — unit direction from focus target to camera for this stop (e.g. teeth from the front `[0,0,1]`, scoliosis from behind `[0,0.15,-1]`). Default: the default view's direction.

### 2. Director (`timeline/director/`, pure, node-testable)

```ts
export type Phase='idle'|'release'|'cruise'|'approach'|'hold'|'end';
export interface Stop {id:string;/** Fractional days since BIRTH_DATE. */day:number;approachDays:number;view:Vec3|null;/** issues.json title, for bar ticks. */title:string}
export interface Sample {
  storyMs:number;
  /** Fractional days since BIRTH_DATE (smooth; the engine animates sub-day). */ day:number;
  /** ISO date of floor(day). */ date:string;
  phase:Phase;
  /** The stop being approached / held / released, else null. */ stop:number|null;
  focusId:string|null;
  ghost:number; zoom:number;
}
export interface Schedule {
  stops:Stop[];
  /** Story time of each stop's hold instant. */ holdMs:number[];
  totalMs:number;
  sample(storyMs:number,holding:boolean):Sample;
  /** Inverse of day(s) (monotone; bisection): the story time at which the date first reaches `day`. */
  storyMsForDay(day:number):number;
}
export function buildSchedule(scripts:IssueScript[],today:string):Schedule;
```

`schedule.ts`:
- Stops = every script, at `onset + climax`, sorted by day then id. Two stops on the same day get a trip of release + approach only (cruise 0), still zooming out between them.
- Day as a function of story time within a trip is a monotone C¹ cubic Hermite (Fritsch–Carlson) through keys: (hold_i, day_i, v=0) → (hold_i+1800, day_i+releaseSpan, v=cruise) → (hold_{i+1}−2500, day_{i+1}−approachSpan, v=cruise) → (hold_{i+1}, day_{i+1}, v=0). `cruise` = 1 year per 2000 ms; cruiseMs = clamp(cruiseDays/365·2000, 1500, 5000), and the cruise leg's own velocity is its days / cruiseMs so the Hermite velocities match at the leg joints. `approachSpan` = min(approachDays, 0.3 × gap days), `releaseSpan` = min(30, 0.3 × gap days); the remaining ≥ 0.4 × gap is the cruise (cruise may be 0 ms only when the gap is < 1 day).
- ghost / zoom: approach: ghost 0→1 over [0, 0.5] of the leg, zoom 0→1 over [0.3, 1] (isolate reads before zoom). Release: zoom 1→0 over [0, 0.7], ghost 1→0 over [0.4, 1]. All smootherstep (C²). Cruise: 0 / 0. Hold: 1 / 1.
- Birth trip: starts at day 0 (birth) in `idle` at storyMs 0; no release leg. End trip: from the last stop to today (release + cruise), then `end`.

`clock.ts` (a tiny state machine over the schedule, still pure — `tick(nowMs)` takes time in):
```ts
export interface Clock {
  readonly storyMs:number; readonly playing:boolean; readonly holding:number|null;
  play(nowMs:number):void; pause(nowMs:number):void;
  /** At a hold: leave it (marks the stop passed) and play. */ continue(nowMs:number):void;
  /** Free scrub: pause, set story time from a day (storyMsForDay), no hold. */ seekDay(day:number):void;
  /** Tick click: story time = holdMs[i] − 2500 (the approach start), play. */ seekStop(i:number,nowMs:number):void;
  tick(nowMs:number):Sample;
}
export function createClock(schedule:Schedule):Clock;
```
- While playing, crossing `holdMs[i]` for a stop not yet continued clamps to it and sets `holding=i`, `playing=false`. `continue()` clears holding and plays; a stop is passed once per play-through (scrubbing before it re-arms it).
- Reaching `totalMs` → phase `end`, playing false. Play at `end` restarts from 0.
- Play button: at a hold it means Continue. Space / Enter while holding = Continue.
- `prefers-reduced-motion`: the approach/release legs keep their story length but zoom/ghost ramps become 0.2 s crossfades at the leg ends (flag passed to buildSchedule).

React glue: `useDirector(today)` hook in `timeline/director/use-director.ts` — owns the clock, a rAF loop while playing, and returns `{sample, stops, playing, holding, play, pause, continue, seekDay, seekStop}`. Exported through `runtime.ts` (kit) so `/anyhealth` never bundles it.

### 3. Engine ghosting (`timeline/engine.ts`, `fx/`, layers)

- `EngineFrame` gains `day?:number` (fractional days since birth; when present it wins over `date` for fx days, so sub-day animation is smooth) and `focus:{id:string;ghost:number}|null` (replaces the binary isolate for rendering; `isolate` remains for the manual tracker button and maps to `{id, ghost}` animated by the scene).
- Focus membership per part goes in fx texture row 4 `.w` (1 = in the focused script's parts). A shared uniform `tfxGhost` (0..1) sets non-focus opacity `mix(1, GHOST_ALPHA=0.12, tfxGhost)`, so a crossfade is one uniform write per frame, never a texture rewrite.
- Two render passes when `tfxGhost > 0`: (1) the opaque pass as now, except non-focus fragments are discarded whenever their opacity < 0.999; (2) ghost pass: the same meshes with `transparent=true, depthWrite=false`, drawing only non-focus parts with alpha = opacity × (0.35 + 0.65·fresnel rim) — a silhouette, not a fog. Hidden parts (switch off / fx visible < 0.5) stay hidden in both passes. The already translucent skin surface keeps its own opacity multiplied in.
- Picking: non-focus parts are unpickable while `tfxGhost ≥ 0.5`.
- `LayerFrame` gains `ghost:number` (0 unless this layer's script is not the focused one); layers scale their material opacity by `mix(1, GHOST_ALPHA, ghost)` instead of hiding. `hiddenByIsolate` is removed.
- `focusBox(id, day):T.Box3|null` — the focused script's warped union box at `day` (rest part bounds + layer box, warped with that day's body; no settle needed), for the camera. `isolateBox` stays as a wrapper at the current date.

### 4. Scene camera (`atlas/scene.tsx`, opt-in in timeline mode only)

- **Growth framing:** `defaultPoseFor(day)`: the adult default pose (today's body, the existing fit but fitting the body height, not body + platform) with target and camera position scaled about the floor origin by `s = stature(day)/stature(today)`; view offset unchanged. Because the body grows about the floor origin, the projected body height stays ≈ constant (checked ±3%). The platform does **not** scale: at birth it spreads well past the body (it may overflow the frame sideways — intended, it is the scale cue).
- **Focus pose:** `focusPoseFor(box, view)`: target = box centre; direction = `view ?? default direction`; distance fits the box ×1.35 in the open area (the tracker footprint excluded), with minDistance respected.
- **Posed path:** pose(zoom) interpolates target linearly, distance geometrically (`d0^(1−z)·d1^z`), direction by slerp, view offset linearly — so a zoom from the full body to a 6 cm tooth is uniform speed in perceived scale.
- **Guided mode** (`cue.guided`; superseded definition: see "Rulings made during execution", Free mode): each frame the camera is set from the sample: `pose(defaultPoseFor(day), focusPoseFor(focusBox(stop,…), view), zoom)`. The focus box is computed once when a stop's approach begins and frozen for that stop.
- **Manual input** (orbit, pan, wheel, double-click) during guided mode: the scene calls `onManualCamera()` (the director pauses; in a hold it just stays held) and stops posing. When guided posing resumes (Play / Continue), a **rejoin blend** runs: pose = lerpPose(userPose, scripted, smootherstep(t/800 ms)), same interpolation rules. Deterministic, no springs.
- **Free mode** (after a scrub or reset; see the execution rulings): the camera follows `defaultPoseFor(day)` until the user moves it, then stays where they put it; double-click on empty space returns to the default pose.
- **Manual Isolate** (tracker button, not guided): ghost crossfades 0→1 over 600 ms (smootherstep) and the camera flies with the posed path over 1200 ms to the focus pose; Show all reverses to `defaultPoseFor(day)`. The v1 420 ms cubic flight stays for non-timeline pages only.

### 5. UI

- **Timeline bar** (timeline mode): playback comes from the director (the bar's own rAF loop is off when `director` is passed). Track position = the story fraction `storyMs/totalMs`, so the bar moves at the pace you watch. One tick per stop at its hold position; hover/title = issue title; clicking a tick = `seekStop(i)`. Dragging = `seekDay` (free scrub). Play/Pause button: Play / Pause / **Continue** (at a hold, with the label "Continue"). Reset = seekDay(0), paused.
- **Tracker**: unchanged list semantics, plus: during approach/hold/release the focused issue's card is pinned first and expanded (scrolled into view); during the hold it shows a primary **Continue →** button, focused on arrival for the keyboard, and Space/Enter continue. Its Isolate button is hidden while guided focus is on it. Other cards keep Isolate (which pauses the director). Phones: the sheet opens to the focused card at a hold and collapses on Continue.
- The v1 fracture test page and `/anyhealth` are untouched.

## Checks (added to `npm run check:timeline`)

- **Schedule**: one stop per script, sorted; each climax inside the active window with non-empty fx; every cruise leg in [1500, 5000] ms (or 0 for same/near-day gaps); totalMs finite.
- **Continuity** (dense sampling, 1 ms): day is monotone non-decreasing; its velocity has no jump larger than 2% of the trip's peak velocity between samples; velocity is 0 at every hold; ghost/zoom are continuous with no step > 0.02 per 1 ms and exactly 0/1 at leg ends; ghost ramp begins before zoom ramp on approach and ends after it on release.
- **Clock**: plays through to a hold and stays; continue passes it once; seekDay before a passed stop re-arms it; seekStop lands at the approach start; end then play restarts.
- **Framing**: at 25 dates birth→today, the default pose's projected body height (warped body box) is within ±3% of today's; for every stop, the focus box at the climax projects inside the open area (tracker footprint excluded) with ≥ 4% margin, from its `view`.
- **Ghost**: GPU parity of the ghost/focus path (SwiftShader); a hidden part never draws in either pass; focus parts draw opaque at ghost 1.
- Existing 155 checks still pass (the isolate checks are updated to the ghost semantics).

## Out of scope

Audio, narration text beyond the tracker card, per-stop custom camera paths (orbits), multiple simultaneous focus issues, changes to growth or issue anatomy.

## Rulings made in the spec (cost if wrong)

- Holds cost zero story time; the bar shows story fraction, not calendar fraction (cost: the bar no longer reads as a linear calendar; year labels are placed by story time).
- The platform does not scale and may overflow at birth (cost: if it looks odd, a one-line change fades its outer rim).
- Focus box frozen per stop at approach start (cost: an issue that grows a lot during the approach may slightly outgrow the frame; the framing check covers climax).

## Rulings made during execution (2026-09-26)

- **Cruise profile.** The cruise leg is not a Hermite at constant speed. Its speed follows `v(u)=mA+(mB−mA)·smootherstep(u)+K·smootherstep′(u)` (K ≥ 0), integrated exactly, so acceleration is 0 at both joints. Speed peaks at about 1.8× the cruise mean mid-leg (a smooth bell). Release and approach stay limited Hermites. Why: a Hermite could not slow from cruise into a slow approach without a kink at the joint.
- **Free mode.** Free mode starts only after a scrub or reset (`seekDay`) and lasts until play, continue or seekStop. `cue.guided` is `!scrubbed`, so pausing mid-leg freezes the shot instead of snapping to the default view. In free mode, ghost and zoom are 0.
- **Camera direction.** The camera turns by interpolating azimuth (the shortest arc about +y) and elevation, not by a great-circle slerp. Front↔back stops then orbit around the body instead of swinging over the head.
- **Ghost onset.** Alpha is `mix(1,GHOST_ALPHA,g)·mix(1,0.35+0.65·rim,g)`. A depth-only pre-pass of the non-focus parts means only the frontmost ghost surface shows. This gives a continuous onset with no unsorted see-through.
- **No hitches.**
  - The ghost-pass shader variants are precompiled at `ready()` (`Engine.prewarm`).
  - `focusBox` is memoised, and the focus box for every stop is prefetched in idle settle slices.
- **Stops drawn by another script.** A stop drawn by another script's layer (the callus, drawn by the fracture layer) uses `IssueScript.focusAlso`.
- **Manual Isolate at a hold.** It leaves guided mode (`seekDay` at the same day), so Play returns to that climax.
- **Release ramp ordering.** The check asserts zoom ≤ 0.05 before ghost drops below 0.5, mirroring the approach. The ramps overlap on purpose, for smoothness.
- **Record-date holds.** Record-window glows (CBCs, allergy tests, thalassemia) pre-roll so these stops hold on the record date (climax 0).
- **Final fix wave.**
  - `Clock.seekMs` provides an exact story-time seek. Isolate at a hold and bar drags use it, so a same-day stop pair never re-holds the first stop.
  - `CameraCue.seq` counts seeks. A seek while guided, or a switch between guided and free mode, starts a rejoin, so a tick click from a hold flies instead of cutting. Ghost and focus hand over by blending from the last rendered value.
  - Under reduced motion the camera cuts at the ramp midpoints, the ghost keeps a 0.2 s fade, and flights and rejoins last 150 ms.
  - The focus-box prefetch runs in stop order, 1.5 ms per frame, even during play.
  - The birth trip eases in from rest.
  - Each clock tick advances at most 100 ms.
