# AnyHealth timeline: running the checks

`npm run check:timeline` runs every node check for `/anyhealth/timeline` (`scripts/anyhealth-timeline-check.ts`, checks in `app/anyhealth/timeline/check/`). Pass a filter to run one group or the checks whose name contains it: `npm run check:timeline -- integration`.

## Environment variables

| Variable | Effect |
|---|---|
| `ANYHEALTH_PLAYWRIGHT=<dir>` | A directory holding `node_modules/playwright-core`, kept **outside** the repo (no new dependency): `mkdir -p <dir> && cd <dir> && npm i playwright-core`. The clipping group's "GLSL/TS parity at scale" check, the ghost group's "GPU ghost: …" checks (the engine's two render passes with a real three.js renderer, bundled with esbuild, resolved from tsx's own package: no dependency of the repo) and `npx tsx scripts/anyhealth-timeline-glsl.ts` (headless shader compile + parity) run headless Chromium through it. |
| `ANYHEALTH_CHROME=<binary>` | The Chromium to launch; default: the newest cached `~/Library/Caches/ms-playwright/chromium-*` build. |
| `ANYHEALTH_SKIP_GPU=1` | Skip the GPU checks (parity, ghost passes) explicitly when playwright-core is not available. Without it (and without `ANYHEALTH_PLAYWRIGHT`) they fail, so a missing browser never passes silently. The runner prints a one-line hint whenever they were skipped. |
| `ANYHEALTH_CLIP_DATES=a,b,…` | Limit the clipping checks to these dates while iterating; the full date set is the gate. |

Full gate before merging:
1. `ANYHEALTH_PLAYWRIGHT=<dir> npm run check:timeline`
2. `npx tsc --noEmit`
3. `npm run build`
4. `ANYHEALTH_PLAYWRIGHT=<dir> npx tsx scripts/anyhealth-timeline-glsl.ts`
5. `ANYHEALTH_PLAYWRIGHT=<dir> npx tsx scripts/anyhealth-timeline-e2e.ts`

`anyhealth-timeline-e2e.ts` starts `next start` on port 3417; set `ANYHEALTH_E2E_URL` to use a running server instead. It then:
- presses Play on /anyhealth/timeline;
- waits for the tracker's `data-phase="hold"` at the first stop;
- checks the focused card and its Continue button;
- clicks Isolate on another card (skipped, with a log line, when no other card is listed), checks the hold is left, presses Play, and checks that no Isolate is left on and that the same stop holds again;
- clicks another stop's tick from the hold, and checks for the `approach` phase, then a hold whose focused card has the tick's title;
- presses Continue, and checks the phase leaves the hold;
- fails on any page or console error.

Under SwiftShader the page renders at 0.5–4 fps (machine dependent), and the clock advances at most 100 ms of story time per frame (`MAX_STEP_MS`), so reaching a hold can take one to two minutes of wall-clock time even though its story time is only a few seconds (the first hold is 4 s of story, 40 frames); the script allows 5 minutes per hold.

## v2 director groups

- **`tracker`** (bar part): stop ticks, year labels, and a drag fraction → `seekMs` → handle round trip that is exact.
- **`director`:** covers the story schedule and the clock:
  - one stop per script;
  - cruise legs within 1.5–5 s;
  - the day is monotone and C¹, including a local bound at the leg joints;
  - holds are exact;
  - ghost and zoom ramps have the right order and continuity;
  - `storyMsForDay` inverts the day, including at exact stop days and at today;
  - play from birth eases in (velocity 0 at story 0);
  - the clock's hold, continue, re-arm, seek and end behaviour;
  - `seekMs` is exact, paused and free, and re-arms stops at or after it: at the second stop of a same-day pair, Play holds that second stop;
  - one tick advances story time by at most `MAX_STEP_MS` (100 ms).
- **`climax`:**
  - every script has a climax inside its active window;
  - the anatomy shows at the climax;
  - the climax is at 90% of the peak or more, measured by fx magnitude plus skin-mark alpha, or it is a listed `CLIMAX_NOT_PEAK` exception;
  - views are unit vectors;
  - basis keys exist.
- **`camera`:**
  - pose interpolation: exact endpoints, geometric distance, continuity, and elevation kept within the endpoints' range (azimuth plus elevation, not slerp);
  - growth framing: the projected body height stays within ±3% of the adult's at 25 dates;
  - every stop's focus box fits the open area at desktop and phone sizes;
  - the rejoin blend is continuous;
  - `needsRejoin`: a guided/free switch or a guided seek (`cue.seq`) rejoins, a seek within free mode does not;
  - the focus handover (`blendFocus`) is exact at its ends and never steps, and a new id fades in only after the old one fades out;
  - reduced motion: the cue zoom is a cut at the ghost ramp's midpoint, and the ghost still ramps over about 0.2 s;
  - the frozen focus box is taken at the climax day, clamped to today exactly as the director places the stop.
- **`ghost`:**
  - the focus flag and `focusAlso`;
  - the ghost crossfade is a uniform write only;
  - the pass-0 and pass-1 discards;
  - hidden parts never draw;
  - picking ignores ghosted parts;
  - layers fade instead of hiding;
  - fractional days drive the fx;
  - `focusBox` matches `isolateBox`, and its prefetch completes;
  - the prefetch runs in the director's stop order, and `prefetchSlice` keeps to its budget, never settles, and completes;
  - a sub-day step recomputes the fx only (the body and warp are cached by date), and the settle afterwards is exact;
  - GPU checks (SwiftShader): program count is stable after `prewarm`, the ghost onset is continuous, focus parts occlude ghosts, and a ghost shows only its frontmost surface.

