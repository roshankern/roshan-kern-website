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
- presses Continue, and checks the phase leaves the hold;
- fails on any page or console error.

Under SwiftShader the page renders at about 4 fps, so the first hold can take 10–20 s of wall-clock time even though its story time is about 4 s.

## v2 director groups

- **`director`:** covers the story schedule and the clock:
  - one stop per script;
  - cruise legs within 1.5–5 s;
  - the day is monotone and C¹, including a local bound at the leg joints;
  - holds are exact;
  - ghost and zoom ramps have the right order and continuity;
  - `storyMsForDay` inverts the day, including at exact stop days and at today;
  - the clock's hold, continue, re-arm, seek and end behaviour.
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
  - the frozen focus box is taken at the climax day.
- **`ghost`:**
  - the focus flag and `focusAlso`;
  - the ghost crossfade is a uniform write only;
  - the pass-0 and pass-1 discards;
  - hidden parts never draw;
  - picking ignores ghosted parts;
  - layers fade instead of hiding;
  - fractional days drive the fx;
  - `focusBox` matches `isolateBox`, and its prefetch completes;
  - GPU checks (SwiftShader): program count is stable after `prewarm`, the ghost onset is continuous, focus parts occlude ghosts, and a ghost shows only its frontmost surface.

