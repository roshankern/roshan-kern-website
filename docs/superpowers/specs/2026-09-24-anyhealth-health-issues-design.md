# AnyHealth: health issues on the 3D atlas

Date: 2026-09-24. Status: approved in chat, executing.

## Goal

Bring my health history from the private `roshan-health` atlas onto
roshankern.com/anyhealth, drawn in the AnyHealth style: floating glass
panels, plain short text, nothing decorative. The page gets four additions.

1. A **timeline bar** at the bottom. Scrubbing it moves the date; issues appear once their date is reached.
2. A line of **age, height, and weight** under the body for the current date.
3. **Dots on the body** where each issue lives: the bone, organ, or patch of skin.
4. A **right issue panel** that opens when a dot or timeline tick is clicked.

## What the user decided

- Publish all 45 issues and the 7 record figures on the public site.
- Strip every clinician and prescriber name, plus pharmacy store numbers, from the text.
  - Practice and hospital names stay.
  - In the images, black boxes cover staff identifiers. The only ones are the radiology tech initials on the three X-ray side markers ("LA", "AJD", "TR"). The L/R letter stays.
- The source line reads `Source: <Practice> Records`, for example `Source: Village Pediatrics Records`.
  - Self-reported issues read `Source: Self-reported`.
  - No file names or page numbers.
- The right panel is for issues only. The old anatomy explanation sheet is removed. Clicking a body part still highlights it.
- When in doubt, simpler UI and text.

## Data

The source is `roshan-health/atlas/src/data/timeline.json`: 45 events, re-extracted and verified in commit 552e3cf. The growth series is `growth.json` with 35 points. Both are read by a sync script so the page can be refreshed when the record is recollected.

`scripts/sync-anyhealth-health.mjs [path/to/roshan-health]` writes:

- `app/anyhealth/health/issues.json`, holding `Issue[]` (see `app/anyhealth/health/types.ts`). It keeps only what the page shows: `id`, `date`, `endDate`, `title`, `summary`, `category`, `source`, `selfReported`, `figure`, `labs`, `chart`. Anchors, severity, tooth ids, and file paths are dropped.
  - `source` is the practice name. Take the text before the first ` / `, ` — ` or ` (`. Anything starting with "Self-reported" becomes `Self-reported`.
  - Name scrubbing is regex plus a small per-id override table in the script. It covers `(Dr. X)`, `Dr. X Y`, `prescriber X Y` and `#12345` store numbers. Any sentence that reads badly after a regex is rewritten through the override table.
  - The script fails if any `Dr.` or `prescriber` survives.
- `app/anyhealth/health/growth.json`, holding `{date, heightCm?, weightKg?}[]`.
- `public/anyhealth/figures/<issue-id>.jpg`, copied from `atlas/public/figures`. The three X-rays get a black box over the tech initials, at fixed pixel rectangles listed in the script. The script uses `sharp` if it is available and otherwise ImageMagick.

## Anchors: where each dot goes

This lives in `app/anyhealth/health/anchors.ts`, a hand-written map from issue id to `{part, hint?}`.

- `part` is an exact BodyParts3D part name from `public/anyhealth/models/atlas.json`.
- `hint` is a model-space point in metres. The model is y-up, +x is the body's left, and +z is the front.

At runtime the dot sits on the vertex of that part nearest the hint. With no hint, it uses the vertex nearest the part's bounds centre, so the dot is always on the surface. If an id has no entry, it falls back to a per-category default.

Placement follows the anatomy logic below. Blood issues go on the heart, as the user suggested.

| Issues | Anchor |
|---|---|
| Blood: 2004 microcytosis, 2023 CBC, hematology eval, beta-thal minor, both 2026 Function Health panels | Heart |
| Laryngomalacia | Epiglottis |
| Croup (first, recurrent, 2016 PICU subglottitis) | Cricoid cartilage |
| Microlaryngoscopy & bronchoscopy | Thyroid cartilage |
| 2016 Sky Ridge ER airway | Trachea |
| Asthma, 2022 spirometry, 2024 pulmonary re-eval, Symbicort | Left and right main bronchus |
| COVID-19 | Right main bronchus |
| Food allergy, 2004 allergy workup, egg anaphylaxis, walnut exposure | Tongue |
| Rhinitis & oral allergy, 2016 IgE panel, 2022 allergy re-eval | Nose (lateral nasal cartilage) |
| Eczema | Skin, right palm |
| Warts | Skin, where the summary says (a hand if unstated) |
| Neonatal acne & cradle cap, acne, Accutane | Skin, cheeks and forehead |
| Chin / forehead / right shin lacerations | Skin at chin, forehead, right shin |
| Left exotropia | Left eyeball |
| Myopia | Right eyeball |
| Humerus fracture and callus | Left humerus |
| Tooth #3 | Right upper first molar |
| Fillings #30/#31 (both) | Right lower first and second molars |
| Wisdom teeth | Left lower second molar (the model has no third molars) |
| Encopresis / constipation | Rectum |
| Silent reflux (LPR) | Esophagus, upper end |
| GERD, famotidine | Stomach |
| Scoliosis (upper thoracic) | Third thoracic vertebra |

Several issues share a spot, such as the heart and the cricoid. Each one keeps its own dot. Dots on the same anchor fan out in a tight screen-space ring, about 10px, so each stays clickable.

## Dots

- Dots are an HTML overlay above the canvas. Each frame the anchors are projected to screen and written straight to `transform`, with no React render per frame.
  - This keeps them crisp and styled with the same CSS as the panels.
  - It also gives them normal focus, hover and click, and `aria-label` = title.
- They are always drawn, even when the anchored part is inside the body or hidden. That matches the original atlas.
- Look: a 10px white dot with a thin ink ring and the panels' soft shadow.
  - Hover grows it slightly and shows a small glass tooltip: title and year.
  - The selected dot is filled with ink.
  - No per-system rainbow, so it matches the rest of the site.
- Only issues whose `date` is on or before the timeline date are shown.

## Timeline bar

- A floating glass panel centred at the bottom, above the footer hint line, with the same margin as the Systems panel.
- It contains a play/pause button and a track from birth (2003-06-22) to today.
  - Each issue is a small tick in the dot style, and clicking a tick jumps there and opens it.
  - A draggable handle carries the date label.
  - Sparse year labels sit under the track.
- The date starts at today.
- Play runs birth to today in about 26 seconds, as the original does. Dragging pauses it.

## Age · height · weight

- Plain text, no panel, centred just under the body's feet and above the timeline.
- Three big numbers with small uppercase labels, as in the screenshot: `23 yr` AGE, `5′ 11″` HEIGHT, `160.1 lb` WEIGHT.
- Values are interpolated from `growth.json` at the timeline date and clamped at the ends. Under 2 years the age is shown in months.

## Issue panel (right)

- A floating glass panel mirroring the Systems panel: the same top and bottom insets, and a width of about 340px.
- It exists only while an issue is selected. It closes with ×, Escape, or a click on the selected dot.
- Content, top to bottom:
  - The category eyebrow (Skin, Vision, Dental, Respiratory, Allergy, Blood, Bones, Digestive).
  - The title.
  - The date, or a range for issues with `endDate`.
  - The summary.
  - The figure, which opens full size in a new tab.
  - Labs as a plain three-column list with ▲/▼ on out-of-range values.
  - The allergy chart as plain labelled bars.
  - `Source: … Records`.
- On mobile it becomes a bottom sheet over the timeline.

## Layout and framing

The camera fit (`openArea()` in `scene.tsx`) also measures `.timeline-panel` and `.body-stats`. On desktop it always reserves the issue panel's footprint on the right, even when the panel is closed. That way the body sits centred between the two side panels and does not jump when an issue opens. It also puts the body under the centred title, which answers the earlier title-alignment question.

## Code ownership

These are the units, split so they can be built in parallel.

- `app/anyhealth/health/types.ts` is the shared contract, written first.
- Data owns the sync script, `issues.json`, `growth.json`, the figures and the redaction.
- Scene owns `scene.tsx`, `health/anchors.ts`, the dot overlay (`health/issue-dots.tsx` plus its own CSS) and the `openArea()` additions.
  - New props: `issues: Issue[]` (already filtered to the date), `selectedIssue: string|null`, `onSelectIssue(id|null)`.
- UI owns `atlas-app.tsx` and `atlas.css`.
  - New components: `health/timeline-bar.tsx`, `health/body-stats.tsx`, `health/issue-panel.tsx`, `health/growth.ts`, `health/dates.ts`.
  - It holds date and selection state and removes the anatomy sheet.

Class names shared across units: `.timeline-panel`, `.body-stats`, `.issue-panel`.

## Testing

- `npx tsc --noEmit` and `npm run build` pass.
- The sync script's own checks pass: no clinician names, every figure exists, every issue has an anchor.
- Headless screenshots at 1440×900 and 390×844 cover four states: today, mid-timeline, an issue open, and mobile.
- Before publishing, check the redacted X-rays by eye.

## Out of scope

- Scaling the body by height over time.
- Per-system dot colours.
- Camera fly-to on select.
- Search.
- Filtering issues by the Systems toggles.

## Changes after review (2026-09-24)

These decisions from review replace the sections above.

- **Timeline:**
  - The timeline starts at birth.
  - A reset button sits at the far right.
  - Issue marks are plain dots, faded after the current date.
  - Pills, per-issue time windows, and a wall-clock linger were tried and then removed.
- **Body dots:**
  - All issue dots show at every date.
  - Each dot is borderless and coloured by the system of the tissue it sits on.
  - A dot hides when its system is toggled off.
  - Dots scale with zoom: 2.5px at the default fit, clamped to 1.5–5px.
- **Colours:**
  - System UI colours (legend, dots, ticks) follow a seaborn-style "hls" palette: 15 evenly spaced hues at lightness .6 and saturation .65.
  - The 3D meshes keep their original anatomical colours (`mesh` in `SYSTEMS`).
- **Anchors:** croup issues sit on the top of the trachea, and the microlaryngoscopy on the epiglottis. BodyParts3D files airway cartilage under skeletal.
- **Layout:**
  - The body, title, stats, timeline and footer hints are all centred between the Systems panel and the issue panel's footprint.
  - Age, height and weight are one small ink line.
- **Removed:**
  - Part selection and its highlight.
  - Isolate mode.
  - The anatomy detail sheet and its CSS.
  - The anatomy explanations.
  - The agent tools.

  Double-click still flies to the part under the pointer.
