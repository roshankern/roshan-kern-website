# AnyHealth timeline: growth and health story on the 3D atlas

Date: 2026-09-25. Status: design approved in chat. The written spec is waiting for review.
Branch: `anyhealth-timeline`. It is the fracture PR (#1) rebased onto `main`, so the fracture layer, `health/warp.ts` and the opt-in prop pattern are already here.

## Goal

`/anyhealth/timeline` plays my life from birth to today on the 3D anatomy:

1. **Growth.** Every one of the 2,234 parts changes size and proportion the way a body normally grows. The overall size is fitted to my 35 measured height and weight points.
2. **Issues.** All 45 issues change the anatomy while they are active. Examples: the humerus breaks and heals, the rectum dilates, the airway narrows, the eye turns out, the spine curves.
3. **Issue tracker.** A right-hand panel that is always open. It lists the issues active on the current date, and each one has an **Isolate issue** button.

Play and pause, scrubbing, orbit, pan, zoom, double-click focus and the system switches all keep working. The page aims to be as medically accurate as the source data allows.

## Non-goals and constraints

- `/anyhealth` is frozen. `/anyhealth/test` (the fracture test) can stay as it is. Every change to a shared file (`atlas/atlas-app.tsx`, `atlas/scene.tsx`, `health/timeline-bar.tsx`, `atlas/atlas.css`) is behind an opt-in prop that is off by default.
- No new runtime dependencies.
- The model is one adult male reference (BodyParts3D). Things it lacks: lung parenchyma (lungs are the bronchial trees only), most of the liver (caudate lobe and ducts only), the sigmoid colon, the brain hemispheres, and third molars. Effects use what exists, and anything we add is noted in the medical basis doc.
- Site style: the blurred glass panels and the minimal palette already in `atlas.css`.

## Architecture

Everything new lives in `app/anyhealth/timeline/`. The page is `app/anyhealth/timeline/page.tsx`, which renders `<AtlasApp mode="timeline"/>` and is noindex while in progress. Like the test page, it reads `?date=YYYY-MM-DD`.

| Unit | File(s) | Job | Depends on |
|---|---|---|---|
| Proportions | `timeline/growth/proportions.ts` | Pure. `bodyAt(date)` returns stature, weight, BMI z-like girth factor, per-segment length ratios, and per-organ size factors | `health/growth.ts`, growth.json |
| Warp | `timeline/growth/warp.ts`, `timeline/growth/warp-glsl.ts` | A continuous position warp, written once in TS and once in GLSL. Both are fed by the same uniform struct built from `bodyAt` | proportions |
| Part effects | `timeline/fx/part-fx.ts`, `timeline/fx/part-fx-glsl.ts` | A float DataTexture with per-part rows: visibility, tint, swelling, scale, rotation and pivot. Also the shader chunk that applies it | none |
| Issue catalog | `timeline/issues/catalog/<area>.ts`, `timeline/issues/index.ts` | One `IssueScript` per issue id. Areas: `bones`, `airway`, `digestive`, `eyes`, `teeth`, `skin`, `systemic` (blood and allergy) | part-fx types |
| Custom geometry | inside the catalog areas that need it | Meshes the texture can't express: fracture fragments, callus and clot (moved from `app/anyhealth/fracture/`), wisdom teeth, skin lesions and cuts | three |
| Pacing | `timeline/issues/pacing.ts` | Builds `Density[]` for `health/warp.ts` from the active phase of every script | catalog |
| Tracker | `timeline/tracker/issue-tracker.tsx`, `tracker.css` | The right-hand panel | catalog, `health/issue-panel.tsx` pieces |
| Engine | `timeline/engine.ts` | Given date, visible systems and isolate, it sets the warp uniforms, fills the part-fx texture, and updates custom meshes | all of the above |
| Scene hooks | `atlas/scene.tsx` (opt-in) | Timeline mode: injects the warp and part-fx GLSL into every material's `onBeforeCompile`, calls `engine.update` each frame, and passes picking through the TS warp | engine |

### Data flow per frame

`date` → `bodyAt(date)` → warp uniforms. At the same time, `date` → each active script's `fxAt(days since onset)` → a merged per-part fx → texture upload (only when changed) → one render. Rendering stays on demand: frames are drawn only when the date, camera or state changed.

### Picking and focus

The warp runs on the GPU, so the CPU picker meshes would otherwise sit in rest pose. When the date settles (no change for 150 ms, or on pause), the engine rewrites each picker's positions through the TS warp and part-fx and recomputes its bounds. Raycasts, double-click focus and Isolate framing then hit the body as it is drawn. The GLSL and TS warps must match exactly. The verification script compares them on sample points.

## Growth model (`proportions.ts`, `warp.ts`)

**Sources.** WHO child growth standards (0–5 y) and CDC 2000 charts (2–20 y) give the reference curves. Segment proportions come from anthropometric references for head length, sitting height and leg length vs stature (for example Snyder et al. 1977, the NHANES segment data). Organ growth follows Scammon's curves: general, neural, lymphoid and genital. Tooth eruption uses the ADA eruption chart. Every number used in code carries a citation key from `docs/anyhealth/timeline-medical-basis.md`.

**Stature and weight.** These are interpolated from my measurements (`health/growth.ts`). The model's native stature is measured once from atlas bounds. The global scale is `stature(date) / modelStature`.

**Segments.** The rest model is split by position into regions: head, neck, trunk, and left/right upper arm, forearm, hand, thigh, shank and foot. Joint pivots (atlanto-occipital, C7/T1, shoulders, elbows, wrists, hips, knees, ankles) are found once from named bones (for example the bounds of `Left humerus` head and condyles) and hardcoded with a comment. Each region's length along its axis scales so that the segment-to-stature ratio matches the reference for my age. Limbs scale away from their parent joint, so they stay attached. Across each joint the scales blend with a smoothstep over about 3 cm (in rest-model units), so no part tears or overlaps at a boundary.

**Girth.** Width (x/z about the local segment axis) scales with weight-for-height relative to the reference. Soft tissue (muscular, integumentary, connective) gets the full factor. Bones and organs get an age-based factor only, so bones keep their correct width for my age whatever my weight.

**Per-part factors** (through part-fx, about each part's own centre, multiplied on top of the warp):
- Neural (Scammon): the head region warp already gives the large infant cranium. Sensory eyeballs follow eye axial-length growth, about 16.5 mm at birth to about 24 mm in adults.
- Lymphoid: the thymus follows its size curve (relatively largest in childhood, involuting after puberty).
- Organs follow general growth. The liver's caudate lobe is relatively larger in infancy.
- Genital: reproductive parts stay at prepubertal size until about 11 y, then grow through Tanner stages to adult size by about 16 y.
- Teeth: adult teeth are hidden before their eruption window. During it they rise out of the gingiva: translation along the occlusal axis plus a scale from 0.6 to 1, and they only become visible once above the gum line. Before the adult teeth come in (about 6 mo to 6 y), the incisors, canines and premolar positions show scaled-down stand-ins for the baby teeth. This is labelled in the medical basis doc.

## Part effects (`part-fx.ts`)

Per part: `visible`, `tint (rgb, amount)`, `swell` (push along the normal, metres), `scale (xyz about pivot)`, `rotate (quaternion about pivot)`, `translate`. Scripts return partial fx for named parts. `engine` merges them: scales and rotations compose, swells add, and tint takes the one with the highest amount. It uses one texture width × 4 rows (RGBA float). The shader runs the part-fx transform in rest space first, then the body warp, then the normal pipeline.

## Issue scripts

```ts
interface IssueScript {
  id: string;                    // issues.json id
  parts: string[];               // exact atlas part names (used by Isolate and focus)
  onset: string; resolve?: string; chronic?: boolean;   // active window; resolve from endDate or a cited typical duration
  illustrative?: boolean;        // stylized, not literal anatomy (shown as a tag in the tracker)
  fxAt(day: number, ctx: {body: Body; dt: number}): PartFx[];   // day = days since onset
  mesh?: CustomLayer;            // optional extra geometry, same lifecycle as the fracture layer
}
```

Effects ramp in and out; nothing switches on or off abruptly. Chronic issues keep a baseline state up to today. Per area:

- **bones:** the fracture exactly as the fracture PR has it, moved behind this interface. Scoliosis (2025, upper thoracic): the T1–T6 vertebrae get lateral translation and axial rotation matching a mild measured curve (Cobb angle from the record, or a cited mild default if none). The attached ribs follow through the same per-part transform.
- **airway:** Laryngomalacia (2003–04): the epiglottis curls (non-uniform scale, omega shape) and resolves by about 12–18 months. Croup and recurrent croup (2003–): episodic subglottic narrowing. The trachea swells inward near the subglottis (negative swell weighted by height) and turns red, each episode lasting about 3–5 days. The PICU subglottitis (2016) is the worst case, plus the microlaryngoscopy highlight. The ER visit leads into the PICU episode. Asthma (2016–, chronic): bronchial tree walls thicken and narrow, with a mild baseline and flares around the recorded visits. COVID (2020): patchy inflammation tint over the bronchial trees for about 14 days. *Illustrative*.
- **digestive:** Encopresis (2010): the rectum and descending colon dilate over months (scale about 1.3–1.5× in radius), then shrink back over the treatment period. LPR (2026) and GERD (2026): an inflammation tint on the distal esophagus, and on the stomach for GERD, fading over the medication course. Famotidine keeps the GERD fade going.
- **eyes:** Exotropia (2003–04): the left globe (sclera, cornea, lens, iris and so on) rotates outward by the prism-dioptre equivalent of 1–2 mm of light-reflex deviation, then returns to straight by 2004-03-22. Myopia (2018–, chronic): both globes elongate axially by the amount that matches the recorded refraction (about 0.35 mm per dioptre).
- **teeth:** Fillings: a composite-coloured tint on the named molar from the filling date on. Wisdom teeth: add four small third-molar meshes (cloned and scaled second molars placed behind them). They erupt or stay impacted per the record, are hidden on 2023-12-26, and the socket shows a healing tint for about 6 weeks.
- **skin:** Cuts (chin 2010, forehead 2011, right shin 2014): a red line decal mesh on the skin at the anchor hint, with sutures for the recorded counts. It fades to a pale scar over the cited healing course, and the scar stays faint. Neonatal acne, eczema, warts and acne: small instanced raised spots at the anchor site, sized and counted from the record. Isotretinoin clears the acne spots over the course.
- **systemic (illustrative):** Thalassemia minor (2004 suspected, confirmed 2024, chronic): an arterial tint that is slightly paler and more orange, visible from the suspicion onward. Food allergies (chronic): a faint tongue and lip tint. Egg anaphylaxis (2005): the tongue, lips, pharyngeal constrictors and epiglottis swell and the trachea narrows over hours, resolving within about 2 days. The walnut exposure (2026) is a milder version. Allergy panels and rhinitis: nasal conchae swell and tint, with seasonal pulses while chronic. Immunotherapy (2022): the rhinitis baseline gradually eases.

Every script's parts are checked against atlas part names by the verification script.

## Pacing (`pacing.ts`)

Each script adds density ranges around its acute phase. Examples: fracture day 0–90 at k from the fracture PR, a laceration's first 3 weeks, anaphylaxis 0–2 days, croup episodes. Overlapping ranges take the max k. The total stretch is capped, so quiet years still take at least about 40% of the track. Play, scrubbing and keyboard all use the warp, as in the fracture PR.

## Issue tracker (`tracker/issue-tracker.tsx`)

- The glass panel is always open on the right at desktop widths. On mobile it is a collapsible bottom sheet with a peek bar reading "3 active issues".
- It lists the issues whose window contains the current date, newest onset first. Resolved issues stay about 7 timeline-days with a "Resolved" chip, then fade out. New issues slide in.
- Each card shows the title, date range, body-system colour dot and name, category, source, summary, figure, labs and chart (reusing the components from `health/issue-panel.tsx`), an "Illustrative" tag when set, and an **Isolate issue** button.
- Isolate shows only that script's `parts` (a per-part mask that overrides the system switches), flies the camera to their union bounds, and the button becomes **Show all**. Changing a system switch, or isolating a different issue, ends the current isolation.
- The bottom bar has play/pause, the scrubber (no issue ticks), and reset. Body stats stay above it. The old issue panel and issue dots are not rendered in timeline mode.

## Performance and fallbacks

- WebGL is required, as today. The existing error message covers browsers that can't start it.
- A software renderer (`WEBGL_debug_renderer_info` containing `SwiftShader` or `llvmpipe`), or sustained play below 30 fps, lowers the pixel ratio to 1. If it is still slow, the engine updates at about 10 Hz during play.
- The texture uploads only when a value changes. The warp uniforms are a few floats.

## Verification

1. `npx tsc --noEmit` and `npm run build` pass.
2. **Unit checks** (`scripts/anyhealth-timeline-check.ts`, run with `node scripts/anyhealth-timeline-check.ts`; Node 24 strips the types natively, so the timeline modules it imports must use only erasable TS syntax: no enums and no parameter properties):
   - `bodyAt` reproduces the measured stature and weight at every measurement date, within 0.5%.
   - The segment ratios are monotonic and match the reference tables at birth, 2, 6, 12 and 18 y, within 2%.
   - Every script's `parts` exist in atlas.json. Every issues.json id has a script.
3. **Clipping and overlap** (the same script, loading the real `.bin` chunks with the meshopt decoder and running the TS warp and fx on vertices). This runs at ages 0, 1, 3, 6, 10, 14, 18 and 23, and at each script's peak day:
   - Containment: the heart, bronchial trees, thymus and stomach stay inside the rib cage hull. Abdominal organs (colon at peak dilation, rectum, bladder) stay inside the pelvis and abdominal wall hull. Eyeballs stay inside the orbits. Teeth roots stay inside the jaw bones. All bones stay inside the skin.
   - Seams: the vertices within 1 cm of each joint pivot move continuously, with no gap above 1 mm between adjacent bones.
   - Overlap: adjacent vertebrae (scoliosis peak), and fracture fragments against the callus, don't interpenetrate beyond a small tolerance.
   - A failure prints the part pair, the age and the worst distance, and exits non-zero.
4. The user checks the visuals in the browser. We don't run a screenshot loop.
5. `/anyhealth` and `/anyhealth/test` look unchanged.

## Medical basis doc

`docs/anyhealth/timeline-medical-basis.md` gives every numeric parameter: the value, a citation (with a link), and which file uses it. It also lists every effect marked illustrative, and every place the model's missing anatomy forced an approximation. It is written first, and the code parameters point back to it.

## Parallel build order

1. **Contracts (one agent, first):** the `Body`, `PartFx`, `IssueScript` and `CustomLayer` types, and the engine skeleton with the scene hooks and page. Stub scripts so the page runs.
2. **In parallel:** the medical basis research, proportions + warp, part-fx GLSL, the tracker UI, and one agent per catalog area (bones, airway, digestive, eyes + teeth, skin, systemic).
3. **Integration:** pacing, then the verification script, then fixes.
