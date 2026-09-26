# AnyHealth timeline: running the checks

`npm run check:timeline` runs every node check for `/anyhealth/timeline` (`scripts/anyhealth-timeline-check.ts`, checks in `app/anyhealth/timeline/check/`). Pass a filter to run one group or the checks whose name contains it: `npm run check:timeline -- integration`.

## Environment variables

| Variable | Effect |
|---|---|
| `ANYHEALTH_PLAYWRIGHT=<dir>` | A directory holding `node_modules/playwright-core`, kept **outside** the repo (no new dependency): `mkdir -p <dir> && cd <dir> && npm i playwright-core`. The clipping group's "GLSL/TS parity at scale" check, the ghost group's "GPU ghost: …" checks (the engine's two render passes with a real three.js renderer, bundled with esbuild, resolved from tsx's own package: no dependency of the repo) and `npx tsx scripts/anyhealth-timeline-glsl.ts` (headless shader compile + parity) run headless Chromium through it. |
| `ANYHEALTH_CHROME=<binary>` | The Chromium to launch; default: the newest cached `~/Library/Caches/ms-playwright/chromium-*` build. |
| `ANYHEALTH_SKIP_GPU=1` | Skip the GPU checks (parity, ghost passes) explicitly when playwright-core is not available. Without it (and without `ANYHEALTH_PLAYWRIGHT`) they fail, so a missing browser never passes silently. The runner prints a one-line hint whenever they were skipped. |
| `ANYHEALTH_CLIP_DATES=a,b,…` | Limit the clipping checks to these dates while iterating; the full date set is the gate. |

Full gate before merging: `ANYHEALTH_PLAYWRIGHT=<dir> npm run check:timeline`, `npx tsc --noEmit`, `npm run build`, and `ANYHEALTH_PLAYWRIGHT=<dir> npx tsx scripts/anyhealth-timeline-glsl.ts`.
