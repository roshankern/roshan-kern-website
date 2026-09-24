# AnyHealth test: the humerus breaks and heals on the 3D atlas

Date: 2026-09-24. Status: approved in chat, executing.

## Goal

`/anyhealth/test` is the same viewer as `/anyhealth`. The one difference: the 2009 left humerus fracture is drawn on the 3D skeleton. With Skeleton on, the user drags the timeline slowly past 2 Sep 2009. They see the bone snap, the fragments settle in the cast, a clot, a soft callus that hardens, and then a year of remodelling back to a normal bone.

`/anyhealth` must stay exactly as it is. Every change to shared files is opt-in through a prop that is off by default.

## Healing model (`app/anyhealth/fracture/model.ts`, written first)

`fractureAt(date)` returns `null` while the bone is intact, which is before the break and from day 400 on. Otherwise it returns `{day, phase, gap, shift, angle, hematoma, callus, mineral, line}`.

| Days | Phase | What is drawn |
|---|---|---|
| 0 | Fracture | Transverse break at 34% of the humerus length from the shoulder. The distal fragment is displaced: 4.5 mm gap, 7 mm shift, 11° angulation. |
| 0–3 | | The hanging cast pulls it into a small residual displacement. |
| 0–16 | Hematoma | A red, translucent clot around the break, peaking over days 1–4. |
| 6–30 | Soft callus | A translucent blue-white cartilage sleeve grows over the break. |
| 20–50 | Hard callus | The sleeve turns bone-coloured and the gap closes. The dark fracture line fades by day 70. |
| 60–400 | Remodeling | The bulge and the residual angle shrink to zero. At day 400 the original part is shown again. |

`breakKick(ms)` is a wall-clock multiplier on the displacement. It is played once when the date crosses the fracture moving forward, and makes the break look like a snap rather than a jump between two frames.

## 3D (`app/anyhealth/fracture/fracture-scene.ts` + opt-in hooks in `atlas/scene.tsx`)

- Once all chunks have loaded, the humerus's own geometry is read from its per-part picker geometry, and its long axis is found (PCA).
- The mesh is cut on the CPU with a plane normal to the axis at the break level. Triangles go to the proximal or distal fragment by their centroid, which gives a naturally jagged break edge.
- Each fragment's open boundary is capped with a fan in a marrow colour.
- While `fractureAt(date)` is non-null, the original humerus is hidden through the part-state texture (`w = 0`) and the fragments are shown in the skeletal material's colour. When it is null, the reverse.
- The distal fragment is transformed about the break point by `gap`, `shift` and `angle`, times `breakKick` while the snap plays.
- **Callus**: a copy of the humerus triangles within ±22 mm of the break, pushed out along their normals by `callus × CALLUS_BULGE × bump(distance)`. Its colour and opacity blend from cartilage to bone with `mineral`.
- **Hematoma**: a soft red sprite or sphere at the break, with opacity set by `hematoma`.
- The skeletal visibility toggle hides all of these, like the rest of the skeleton.
- **Camera**: when the date first crosses into the fracture moving forward, the camera flies once to frame the left upper arm, using the existing `flyTo`. It does not fly again while the user scrubs inside the window.
- New scene props: `date?: string` and `fracture?: boolean`.

## UI (`atlas/atlas-app.tsx`, `health/timeline-bar.tsx`, `app/anyhealth/test/page.tsx`)

- `AtlasApp` gains a `fracture?: boolean` prop, and the test page renders `<AtlasApp fracture/>`. The prop passes `date` and `fracture` to the scene.
- The timeline warp comes from `TIMELINE_DENSITY`. At a 1000 px track, the first three months after the break get about 22% of the track, which is about 2 px per day, so slow dragging shows healing day by day.
  - Ticks, year labels, handle, dragging, keyboard and play all use the same mapping. Play therefore slows through the fracture.
  - It is off by default.
- While a fracture state exists, a status line under the body stats reads `Left humerus · Soft callus · day 12`.

## Testing

- `npx tsc --noEmit` and `npm run build` pass.
- Headless Chromium screenshots with Skeleton only, zoomed to the arm, at the day before, day 0, days 2, 10, 25, 45 and 150, and day 420.
- Visually confirm `/anyhealth` is unchanged.
