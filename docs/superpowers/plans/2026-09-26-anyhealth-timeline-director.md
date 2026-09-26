# AnyHealth Timeline v2 Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace v1's real-time playback with a guided "director": one pure story clock that cruises the growing body in a constant framing and, at each issue's climax, ghosts the rest, zooms in, holds for Continue, then zooms out and cruises on.

**Architecture:** A pure schedule (`timeline/director/schedule.ts`) maps story time → {day, phase, stop, ghost, zoom} with C¹ date motion and smootherstep ramps; a tiny clock state machine adds play/pause/hold/continue/seek. The engine renders focus as a two-pass ghost driven by one uniform. The scene poses the camera from the cue (growth-scaled default pose ↔ focus pose, log-distance + slerp), with a timed rejoin after manual input. The tracker and timeline bar become director UIs.

**Tech Stack:** Next.js 15 / React 19 client components, three.js (onBeforeCompile shader patching), TypeScript, node checks via `npm run check:timeline` (tsx), headless Chromium (playwright-core, SwiftShader) for GPU parity.

**Spec:** `docs/superpowers/specs/2026-09-26-anyhealth-timeline-director-design.md` (read it; it is the authority). v1 spec: `docs/superpowers/specs/2026-09-25-anyhealth-timeline-design.md`.

## Global Constraints

- Task 0 contracts are committed (53d4cf4): `app/anyhealth/timeline/director/types.ts` (constants RELEASE_MS=1800, APPROACH_MS=2500, CRUISE_MS_PER_YEAR=2000, CRUISE_MIN_MS=1500, CRUISE_MAX_MS=5000, GHOST_ALPHA=0.12, REJOIN_MS=800, ISOLATE_FADE_MS=600, ISOLATE_FLY_MS=1200, FOCUS_MARGIN=1.35; types Phase, Stop, Sample, Schedule, Clock, CameraCue, DirectorApi), `IssueScript.climax/approachDays/view`, `LayerFrame.ghost?`, `EngineFrame.day?/focus?`, `Engine.focusBox(id,day)` (stubbed), scene `timeline.cue?/onManualCamera?`. Change a contract only if it is wrong, and say so in the report.
- `/anyhealth` default page and `/anyhealth/test` behaviour unchanged; everything new is opt-in in timeline mode. The default `/anyhealth` bundle must not import `timeline/director/*` (it arrives through `runtime.ts`, the kit).
- Code style: match the surrounding files — tabs, dense one-line bodies, `/** */` doc comments on exports, `// basis: area#key` on medical values.
- Checks: every new check lives in `app/anyhealth/timeline/check/<group>.check.ts` and is registered in `check/index.ts`. `npm run check:timeline`, `npx tsc --noEmit -p .`, `npm run build` must pass at the end of each task. GPU checks run with `ANYHEALTH_PLAYWRIGHT=1` (see docs/anyhealth/timeline-checks.md).
- Never use `git reset --hard`; commit on your own branch only; no pushes.
- Visual verification is the user's; do not build screenshot loops. Headless checks assert numbers.
- Site glass style for any new UI (existing `.glass` class, white-on-dark palette in tracker.css).

## Review Focus

1. Pausing or orbiting mid-approach, then pressing Play: the camera must rejoin smoothly (no jump) and the stop must still hold. → Task 4 check `rejoin is continuous` + Task 1 clock check `pause mid-approach then play still holds`.
2. Two issues with the same climax day (or < 1 day apart): both stop, in order, zooming out between. → Task 1 check `same-day stops`.
3. Scrubbing backwards past already-continued stops then pressing Play: they hold again. → Task 1 check `seekDay re-arms`.
4. A system switched off while its issue is focused: hidden parts stay hidden in both passes, custom layer respects it. → Task 3 check `hidden never draws`.
5. Resize / tracker footprint change during a hold: the focus pose refits (box stays inside the open area). → Task 4 check `focus pose fits open area` runs at two viewport sizes.

---

### Task 1: Director — schedule, clock, hook

**Files:**
- Create: `app/anyhealth/timeline/director/schedule.ts`, `director/clock.ts`, `director/ease.ts`, `director/use-director.ts`
- Modify: `app/anyhealth/timeline/runtime.ts` (export `useDirector`, `buildSchedule`)
- Test: `app/anyhealth/timeline/check/director.check.ts` (+ register in `check/index.ts`)

**Interfaces:**
- Consumes: `director/types.ts` (all), `IssueScript.climax/approachDays/view`, `SCRIPTS`, `BIRTH_DATE`, `toDays/fromDays`, `LEAD_DAYS` per catalog (for the approachDays default: `min(30, climax + lead)`; lead 0 when absent), issues.json titles.
- Produces: `buildSchedule(scripts:IssueScript[], today:string, opts?:{reducedMotion?:boolean}):Schedule`; `createClock(s:Schedule):Clock`; `useDirector(today:string):DirectorApi`; `smootherstep(e0,e1,x)`, `hermite` helpers in ease.ts.

A script without `climax` (Task 2 fills them in parallel) is scheduled at `climax = the day in [−lead, end] maximising fx magnitude` computed by `autoClimax(script, today)` (sample every 1 day, sum over PartFx of |swell|·100 + |translate|·100 + rotation angle + tint[3] + (1−visible)); document this as a fallback, warn once in dev. Task 2's check makes the fallback unused in the final build.

- [ ] **Step 1: ease.ts**

```ts
/** C² ramp 0→1 over [e0,e1]. */
export const smootherstep=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*t*(t*(t*6-15)+10);};
/** Cubic Hermite on [x0,x1] with values y0,y1 and slopes m0,m1 (per unit x). */
export function hermite(x:number,x0:number,x1:number,y0:number,y1:number,m0:number,m1:number){const h=x1-x0;if(h<=0)return y1;const t=(x-x0)/h,t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*y0+(t3-2*t2+t)*h*m0+(-2*t3+3*t2)*y1+(t3-t2)*h*m1;}
```

- [ ] **Step 2: write failing checks** in `director.check.ts` using synthetic scripts (`{id, parts:['Heart'], onset, resolve, climax, fxAt:()=>[{part:'Heart',swell:.001}]}`) and `today='2025-01-01'`:
  - `one stop per script, sorted by day then id` (3 scripts incl. two on the same day).
  - `cruise legs within [CRUISE_MIN_MS, CRUISE_MAX_MS]` — for every trip with gap ≥ 1 day, `holdMs[i+1]-holdMs[i]-RELEASE_MS-APPROACH_MS` ∈ [1500,5000]; birth trip = cruise+APPROACH_MS.
  - `day is C1 and monotone` — sample every 1 ms over [0,totalMs]: day non-decreasing; |Δvelocity| between consecutive 1 ms samples ≤ 0.02 × that trip's peak velocity; velocity at each holdMs (one-sided, 1 ms) ≤ 1e-3 × peak.
  - `day hits the climax exactly at the hold` — `sample(holdMs[i],true).day === stops[i].day`, phase 'hold', ghost 1, zoom 1, focusId = id.
  - `ghost/zoom ramps` — continuous (step ≤ 0.02 per ms), 0 during cruise, on approach ghost reaches 0.5 before zoom leaves 0.05, on release zoom reaches 0.05 before ghost drops below 0.95; exact 0 at trip ends away from holds.
  - `same-day stops` — two scripts climaxing on the same day: two holds, zoom returns to 0 between them.
  - `storyMsForDay inverts day` — for 50 days, `sample(storyMsForDay(d),false).day` within 1e-6 d of d and no earlier story time reaches d.
  - clock: `plays to a hold and stays` (tick past holdMs[0] → holding 0, storyMs = holdMs[0], playing false); `continue passes once`; `pause mid-approach then play still holds`; `seekDay re-arms` (continue stop 0, seekDay before it, play → holds at 0 again); `seekStop lands at approach start and plays`; `end then play restarts at 0`.

- [ ] **Step 3: run** `npm run check:timeline director` → FAIL (module missing).

- [ ] **Step 4: implement schedule.ts** per spec §2: stops → trips; per trip keys (tA=hold_i, dA=day_i, v=0) → (tA+RELEASE_MS, dA+releaseSpan, v=cruiseV) → (tB−APPROACH_MS, dB−approachSpan, v=cruiseV) → (tB, dB, v=0), cruiseV = cruiseDays/cruiseMs (cruiseMs=0 ⇒ collapse the middle key; use the Fritsch–Carlson limiter on the key slopes so the Hermite is monotone). releaseSpan=min(30,.3·gap), approachSpan=min(approachDays,.3·gap). Birth trip starts at storyMs 0 at day 0 with no release (first key velocity = cruiseV, phase idle only at storyMs 0 when not playing); end trip ends at today with no approach, final velocity 0, phase 'end' at totalMs. ghost/zoom by smootherstep on leg fractions (approach: ghost [0,.5], zoom [.3,1]; release: zoom [0,.7] reversed, ghost [.4,1] reversed); reducedMotion: ramps become [0,.08]/[.92,1] windows. `sample()` finds the trip by binary search on holdMs.

- [ ] **Step 5: implement clock.ts** — fields storyMs, playing, holding, lastNow, passed:Set<number>; `tick(now)`: if playing, next = storyMs + (now−lastNow); if it crosses holdMs[i] with i∉passed → clamp, holding=i, playing=false; clamp at totalMs → playing=false. `continue` adds holding to passed. `seekDay/seekStop` delete from passed every i with holdMs[i] ≥ new storyMs.

- [ ] **Step 6: use-director.ts** — `'use client'`; `useDirector(today)`: `useMemo(buildSchedule(SCRIPTS,today,{reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches}))`, clock in a ref, rAF loop while playing calling `tick(performance.now())` and setting the sample state; returns DirectorApi with `cue={day,guided:playing||holding!=null,phase,stop:stop!=null?{id,view}:null,ghost,zoom}`; keyboard: Space toggles play/pause/continue, Enter continues at a hold (ignored when focus is in an input/slider or a dialog is open).

- [ ] **Step 7: run checks → PASS; tsc; commit** `AnyHealth timeline v2 Task 1: director schedule, clock and hook`.

### Task 2: Climax, approach and view for every issue script (medical)

**Files:**
- Modify: `app/anyhealth/timeline/issues/catalog/{bones,airway,digestive,eyes-teeth,skin,systemic}.ts`; `docs/anyhealth/timeline-medical-basis/*.md` (a "Climax" line per issue with the reasoning and citation key)
- Modify: `app/anyhealth/timeline/types.ts` — make `climax` required (last step)
- Test: `app/anyhealth/timeline/check/climax.check.ts` (+ register)

**Interfaces:** Consumes `IssueScript`, `activeWindow`, `LEAD_DAYS`, `bodyAt`. Produces a `climax` (+ `approachDays` / `view` where the default is wrong) on all 45 scripts.

- [ ] **Step 1: failing checks** in `climax.check.ts`: `every script has a climax`; `climax inside the active window` (onset − lead ≤ onset+climax ≤ resolve, or ≤ today when chronic); `fx at the climax is non-empty or the script has a layer`; `climax is at (≥ 90% of) the script's peak fx magnitude over its window` (same magnitude measure as Task 1's autoClimax: Σ|swell|·100 + |translate|·100 + rotation angle + tint[3] + (1−visible)) — scripts whose medically-defined climax deliberately differs from the magnitude peak are listed in an explicit `CLIMAX_NOT_PEAK` set in the check with a one-line reason each; `view is a unit vector`; `approachDays > 0`.
- [ ] **Step 2: run** → FAIL.
- [ ] **Step 3: set values**, one per script, each with `// basis: <area>#<key>` and a Climax line in the matching basis doc. Rules: the climax is the day the anatomy most visibly shows the issue (acute injury: the moment of injury fully displayed, e.g. the fracture right after displacement, a laceration when open; inflammatory/obstructive: peak severity; chronic progressive: peak before today; developmental: the most characteristic moment, e.g. wisdom teeth at maximal impaction/eruption). `approachDays`: ≤ 1 for instant injuries (so the break plays slowly in focus), the ramp-up duration for gradual ones (capped 365). `view` where the default three-quarter front view hides the finding: back for spine/scoliosis/posterior skin, front for teeth/eyes/face, side for sinuses if needed.
- [ ] **Step 4: make `climax` required in types.ts**, run checks + tsc → PASS. Do not edit other existing check files.
- [ ] **Step 5: commit** `AnyHealth timeline v2 Task 2: climax, approach and view for every issue`.

### Task 3: Engine ghosting, fractional day, focusBox

**Files:**
- Modify: `app/anyhealth/timeline/engine.ts`, `fx/part-fx.ts` (row 4 `.w` = focus flag), `fx/part-fx-glsl.ts`, `types.ts` (remove `hiddenByIsolate`, make `ghost` required), `issues/bones/fracture-layer.ts`, `issues/teeth/wisdom-layer.ts`, `issues/skin/marks-layer.ts`, and the four checks using `hiddenByIsolate` (`check/{eyes-teeth,bones,clipping,skin}.check.ts`), `check/engine.check.ts`, `check/integration.check.ts`, `check/clip-gpu.ts` / GPU parity harness as needed
- Test: `app/anyhealth/timeline/check/ghost.check.ts` (+ register)

**Interfaces:**
- Consumes: EngineFrame `day?`, `focus?`; GHOST_ALPHA.
- Produces: engine renders focus as ghost; `Engine.focusBox(id,day)` real; `Engine.renderGhostPass(renderer, scene, camera)`: scene.tsx calls it right after its normal `renderer.render` whenever the current ghost > 0 (Task 4 wires the call; export it on Engine now). `Engine.partVisible(i)` returns 0 for non-focus parts once ghost ≥ 0.5 (picking).

- [ ] **Step 1: failing checks** `ghost.check.ts`: `focus flag row 4.w is 1 exactly for the focused script's parts`; `ghost uniform only — changing ghost does not rewrite the fx texture` (texture version unchanged across two frames that differ only in ghost); `pass 1 discards non-focus at ghost>0, keeps them at ghost 0` and `pass 2 draws only non-focus, hidden never draws` (GPU, SwiftShader: render a 64×64 target of two parts; read pixels); `picking ignores ghosted parts at ghost ≥ 0.5`; `layers fade instead of hide` (fracture layer opacity = mix(1,.12,ghost) when another script is focused, hidden when its system is off); `fractional day drives fx` (`update({…,day:d+0.5})` gives fx of dayOf+0.5 for the fracture); `focusBox matches isolateBox after settle at the same day` (within 1 mm) and `focusBox at another day uses that day's body` (birth box height < today's × 0.4).
- [ ] **Step 2: run** → FAIL.
- [ ] **Step 3: implement**: fx row 4 .w written from `focus?.id` parts (manual `isolate` maps to focus when `focus` absent, ghost 1 — backwards compatible for existing checks); shader: `uniform float tfxGhost; uniform float tfxPass;` vertex passes the focus flag as a varying; fragment pass 0: `if (tfxVisible<0.5 || (tfxFocus<0.5 && tfxGhost>0.001)) discard;` pass 1: `if (tfxVisible<0.5 || tfxFocus>0.5) discard; diffuseColor.a *= mix(1., GHOST_ALPHA, tfxGhost) * (0.35 + 0.65 * rim);` with rim = 1−|dot(normal, viewDir)| (fresnel, pow 1.5). `renderGhostPass`: set tfxPass=1, toggle every patched material to transparent/depthWrite false (cache and restore), `renderer.autoClear=false; renderer.render(scene,camera)`, restore. Fractional `day`: fx day = `day − toDays(onset)+toDays(BIRTH_DATE)`; growth still uses `date`. focusBox: per part rest bounds → 8 corners → `warpPoint` with `warpState(bodyAt(fromDays(day)))` → union, plus the layer's box warped the same way.
- [ ] **Step 4: update existing checks** from `hiddenByIsolate` to `ghost`; run all checks (with `ANYHEALTH_PLAYWRIGHT=1`), tsc, build → PASS.
- [ ] **Step 5: commit** `AnyHealth timeline v2 Task 3: ghosted focus, fractional day, focusBox`.

### Task 4: Scene camera — growth framing, focus pose, posed path, rejoin

**Files:**
- Create: `app/anyhealth/timeline/camera/pose.ts` (pure: Pose type, `scalePose`, `lerpPose`, `fitDistance`, `projectedHeight`)
- Modify: `app/anyhealth/atlas/scene.tsx` (timeline mode only)
- Test: `app/anyhealth/timeline/check/camera.check.ts` (+ register)

**Interfaces:**
- Consumes: `timeline.cue`, `timeline.onManualCamera`, `Engine.focusBox`, `Engine.renderGhostPass`, EngineFrame `day/focus`, `bodyAt`, constants REJOIN_MS / ISOLATE_FADE_MS / ISOLATE_FLY_MS / FOCUS_MARGIN.
- Produces: `pose.ts` — `export interface Pose {target:Vec3;position:Vec3;ox:number;oy:number}`, `scalePose(p,s)` (target, position × s about the origin), `lerpPose(a,b,t)` (target lerp; distance a.d^(1−t)·b.d^t; direction slerp; offsets lerp), `fitDistance(boxSize, fovDeg, aspect, open)`. scene.tsx calls `engine.update({...,day:cue.day,focus})` and `engine.renderGhostPass` when ghost>0.

- [ ] **Step 1: failing checks** `camera.check.ts` (pure, three.js math in node): `lerpPose endpoints exact`, `lerpPose distance is geometric` (t=.5 → √(d0·d1)), `lerpPose continuous` (1e-3 steps, position step ≤ 0.5% of distance); `growth framing ±3%`: for 25 dates birth→today, warped body box = rest body box × bodyAt(date).scale (feet at y=0), pose = scalePose(adultPose, stature(date)/stature(today)); projected height / adult projected height ∈ [0.97,1.03]; `focus pose fits open area` for every script's focusBox at its climax (use node engine `check/engine-node.ts`) and its `view`, at 1440×900 and 390×844, with the tracker footprint excluded: projected box within the open rect with ≥ 4% margin; `rejoin is continuous` — pose(t)=lerpPose(user, scripted(t), smootherstep(0,REJOIN_MS,t)) has no step > 0.5% of distance per ms while scripted moves.
- [ ] **Step 2: run** → FAIL.
- [ ] **Step 3: implement pose.ts**, then scene.tsx in timeline mode:
  - adult default pose: the existing `defaultPose()` fit but fit points = today's warped body box only (no platform ring), computed on resize; `defaultPoseFor(day)=scalePose(adult, stature(day)/stature(today))`.
  - `focusPoseFor(stop)`: box = `engine.focusBox(id, stopDay)` frozen when the stop's approach begins (keyed by stop index), refit on resize; direction = `view ?? fitDirection`; distance = fitDistance(box×FOCUS_MARGIN, …, openArea()).
  - guided (`cue.guided`): each frame `applyPose(lerpPose(defaultPoseFor(cue.day), focusPoseFor(stop), cue.zoom))` (zoom 0 → default only); ghost = cue.ghost, focus id = cue.stop?.id.
  - manual input (OrbitControls 'start' event, wheel, dblclick) while guided → `onManualCamera()`, set `userMoved=true`, stop posing. When a cue arrives with guided and userMoved: start rejoin (capture current pose, t0), blend REJOIN_MS, clear userMoved.
  - free mode: follow `defaultPoseFor(day)` until userMoved; double-click empty = fly back (posed path, ISOLATE_FLY_MS) and clear userMoved.
  - manual isolate (prop `isolate` set, not guided): ghost animates 0→1 over ISOLATE_FADE_MS smootherstep, camera flies lerpPose(current→focus) over ISOLATE_FLY_MS; clearing reverses to `defaultPoseFor(day)`.
  - non-timeline pages keep the v1 code path unchanged (guard every change on timeline mode).
- [ ] **Step 4: run checks, tsc, build → PASS; commit** `AnyHealth timeline v2 Task 4: growth framing, focus pose, posed camera path`.

### Task 5: UI — director bar, tracker Continue, wiring

**Files:**
- Modify: `app/anyhealth/health/timeline-bar.tsx` (optional `director` prop; unchanged without it), `app/anyhealth/timeline/tracker/issue-tracker.tsx`, `tracker/tracker-model.ts`, `tracker/tracker.css`, `app/anyhealth/atlas/atlas-app.tsx`, `app/anyhealth/atlas/atlas.css` (tick styles if needed)
- Test: `app/anyhealth/timeline/check/tracker.check.ts` (extend)

**Interfaces:**
- Consumes: `DirectorApi` via `kit.useDirector(today)` (hook exported from runtime.ts by Task 1 — until merged, import type only and guard), scene `timeline.cue/onManualCamera`.
- Produces: TimelineBar `director?:{fraction:number;ticks:{t:number;title:string}[];playing:boolean;holding:boolean;onPlay():void;onPause():void;onContinue():void;onSeekFraction(t:number):void;onSeekStop(i:number):void;onReset():void;years:{year:number;t:number}[]}`; IssueTracker extra props `focus?:{id:string;phase:Phase}|null; onContinue?:()=>void`; `entriesFrom(..., focus)` pins the focused entry first (state as now; 'isolated-inactive' logic reused for a focus outside its window).

- [ ] **Step 1: failing checks** (tracker.check.ts): `focused entry pinned first during approach/hold/release`; `focus outside its active window lists as isolated-inactive`; `no focus: order unchanged from v1`.
- [ ] **Step 2: implement**:
  - atlas-app (timeline mode): `const director=kit.useDirector(today)` — call the hook unconditionally inside a `TimelineDirector` child component that renders the bar + tracker and lifts `cue`/`date` up via callbacks, so hooks rules hold when kit is null. `date` = director.sample.date while guided or on seek; scene gets `timeline:{date,isolate,cue,onManualCamera:director.manualCamera}`. Manual Isolate from the tracker pauses the director.
  - TimelineBar with `director`: no internal rAF; fill/handle at `fraction` (= storyMs/totalMs); ticks at `t` (class `timeline-tick stop`, title); click tick → onSeekStop; drag → onSeekFraction (atlas-app maps fraction → story ms → `seekDay(sample(…).day)`); play button shows Pause / Play / "Continue" (text label + icon, aria-label "Continue") at a hold; year labels at `years[i].t`.
  - Tracker: focused card pinned, class `focused`, expanded; at phase 'hold' a primary `Continue →` button (autofocus on hold arrival via ref, `tracker-continue`), Isolate hidden on the focused card; scroll the focused card into view (`block:'nearest'`, smooth unless reduced motion); mobile sheet opens at hold, closes on Continue.
  - CSS: glass style; Continue as the one filled white button.
- [ ] **Step 3: checks, tsc, build → PASS; commit** `AnyHealth timeline v2 Task 5: director bar ticks, tracker Continue, wiring`.

### Task 6: Integration and end-to-end verification (controller)

**Files:** merge Tasks 1–5; `docs/anyhealth/timeline-checks.md` (new groups); `scripts/anyhealth-timeline-e2e.ts` (headless: load /anyhealth/timeline on `next start`, press Play, wait for phase hold at stop 0 via `data-phase` attribute on the tracker, assert the canvas has non-background pixels, press Continue, assert the phase leaves hold, no console errors).

- [ ] **Step 1:** merge in order 0→1→2→3→4→5 resolving `check/index.ts` registration conflicts.
- [ ] **Step 2:** remove the `autoClimax` fallback usage warning if Task 2's check passes (keep the function for dev only), run `npm run check:timeline` (all + GPU), tsc, build, e2e.
- [ ] **Step 3:** whole-branch review on the most capable model; one fix wave; push; update PR #2 description; report the preview URL.
