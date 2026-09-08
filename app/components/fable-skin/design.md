# Fable animation — design

The photoreal build of the acne-progression figure, rendered in the AnyDerm
whitepaper (`app/writing/anyderm/page.mdx`) via `<FableAcneProgression />`.
Everything lives in `app/components/fable-skin/`; the earlier flat-shaded and
Sol builds it replaced have been removed from the repo.

Same brief as the original: one untreated inflammatory lesion on a patch of cheek skin,
seen through a DermLite DL1 on an iPhone (RGB, non-polarised, LED ring), 21 days, scrub /
play / orbit / zoom, live scale bar, no labels on the image. See
`../anyderm_research.md` §8.3 for the optics derivation and `reference-notes.md` (written
from real photographs) for the appearance targets.

## Why it looked fake, and what changes

| Before | Now |
| --- | --- |
| Everything evaluated per frame, so the skin detail was capped by shader cost: two Worley scales, no ambient occlusion, one grain octave. | The **static skin is baked once** into textures at 4.9 µm/texel (4096² over 20 mm, the instrument's own resolution). The bake can afford five detail scales, real cavity occlusion, vessel networks and pigment. Per-frame work is only the lesion and the lighting. |
| Wrap-lit Lambert: skin read as painted clay. | **Pre-integrated subsurface scattering** (Penner) from a diffusion-profile LUT, plus a thickness-based red transmission through the raised dome edge. |
| One GGX lobe. | **Dual-lobe specular** (broad + tight) with a sebum gloss map; glare arcs from the LED ring the way a phone dermatoscope shows them. |
| Hairs were flat arcs painted into the height field. | **Hairs are geometry**: tapered tubes along curves rooted in real follicles, Kajiya-Kay shading with shifted highlights, translucency, and a **top-down shadow map** so they sit above the skin. |
| Pores were a hash inside the shader; nothing else could know where they were. | **Pores are generated on the CPU** (`pores.ts`) and shared: the bake draws them, the hairs grow out of them. |
| Raw shader output, tone-mapped. | A **camera pass**: subtle bloom on the LED glare, phone-style sharpening, radial chromatic aberration, sensor grain. It reads as a photograph, not a render. |
| Seven lesion drives. | Twelve: adds vessel visibility, scale/flaking, crust wetness, post-inflammatory pigment, and dome sebum gloss, so each stage has its own material, not a recolour. |

## Coordinate conventions (every module obeys these)

- World units are **millimetres**. The skin plane is **XZ**, height is **+Y**, the lesion is at the origin.
- The patch is `PATCH_MM = 20` square, centred. Baked textures use `uv = p.xz / PATCH_MM + 0.5`.
- The camera orbits the origin; polar 0 is straight down. Home field is 4.5 mm across the canvas.
- Anything within 10 mm of the origin can be seen; the vignette goes to black between 8.5 and 10 mm.

## Modules

### `lesion.ts` (shared model, written first)
`FableLesionState` — twelve fields — and `lesionAt(day)`, keyframed 0–21 with smoothstep.
`START_DAY`, `END_DAY`, `DAY_TICKS`, `OPTICS`. Also exports `STAGES` for reference; nothing renders them.

### `pores.ts` (shared, written first)
`generatePores(seed)` → `{ grid, cellMm, texture, pores }`. A 25×25 grid of 0.8 mm cells; each
cell holds at most one follicle (75 % occupancy → ~1.2 visible pores/mm², the 12–25 per 4.5 mm
field the dermoscopy frames show), jittered inside the middle 70 % of its cell. The
`DataTexture` (RGBA float, 25×25) stores `(x, z, radius, kind + 10·ring)` with `kind` 0 empty ·
1 plain · 2 sebaceous filament · 3 keratin plug (an open comedo, 200–400 µm) and `ring` marking
the brown pigment annulus a third of cheek pores carry. `pores[]` carries the same rows plus
`hair` and `hairAngle` for the hair module: half the follicles grow a vellus hair, which leaves
from the pore's edge on that side. No follicle within 0.5 mm of the origin (the lesion's own);
hairs are allowed anywhere, because in the photographs they cross straight over the lesion.

### `lesionGlsl.ts` (shared, written first)
The lesion uniforms and the dome/crater height functions as one GLSL string, included by the
skin vertex and fragment shaders so mesh and normal agree. Also `makeLesionUniforms()` and
`applyLesion()`.

### `skinBake.ts` — agent A
`bakeSkin(renderer, pores)` renders the static skin once into three 4096² textures over the patch:

| Texture | Type | R | G | B | A |
| --- | --- | --- | --- | --- | --- |
| `relief` | RGBA16F | height, mm | slope ∂h/∂x | slope ∂h/∂z | cavity AO 0..1 (1 = open) |
| `albedo` | RGBA8 | base albedo r | g | b | roughness 0..1 |
| `masks` | RGBA8 | sulci 0..1 | pore pit 0..1 | pore plug/filament tint 0..1 | haemoglobin excess (vessels + mottle) 0..1 |

Height includes: dermal undulation, primary/secondary/tertiary line network, pore pits with a
faint raised rim, micro-grain. Albedo is a melanin + haemoglobin absorption model with pigment
mottling, a faint pigment network, low-frequency vascular blotching and thin warped vessels.
Returns the three textures; caller disposes them.

### `skinShaders.ts` — agent B
`SKIN_VERTEX` and `SKIN_FRAGMENT` for the per-frame material, plus `makeSkinUniforms()` and
`sssLut.ts` (the pre-integrated scattering LUT as a `DataTexture`). Vertex: baked height +
dome. Fragment: baked slopes (scaled down by "tight" over the dome) + analytic dome slopes →
normal; lesion colouring (erythema ring/flush, vessels, plug, pus cap, crust wet→dry, scale,
PIE, PIH); pre-integrated SSS diffuse; dome-edge transmission; dual-lobe GGX from 8 ring
LEDs riding the camera; hair shadow term; vignette. **No tone mapping in the shader** — the
composer's OutputPass does it.

### `hair.ts` — agent C
`createHairs(pores, relief, seed)` → `{ mesh, lesionUniforms, shadowTexture, renderShadow, dispose }`.
Vellus hairs as tapered 6-sided tubes along cubic curves rooted at `pores[].hair` follicles,
leaving the pore edge at 20–45° then lying nearly flat, 1–3 mm long, 30–60 µm wide, growth
azimuth within ±30° of one direction. The vertex shader includes the lesion chunk and lifts
every vertex by the baked skin height plus the dome, so hairs ride over the pustule. Fragment:
Kajiya-Kay with two shifted lobes, translucent tan (only ~13 % darker than skin), a bright edge
line, backlight translucency, and a defocus fake (wider, fainter) where a shaft lifts off the
skin. The shadow map is only a faint contact line: the photographs show no cast hair shadows.

### `cameraPass.ts` + `SkinScene.tsx` + `FableAcneProgression.tsx` + `page.tsx` — agent D
Scene, camera, OrbitControls, EffectComposer (RenderPass → UnrealBloomPass → camera
ShaderPass → OutputPass), render-on-demand loop, view reporting for the scale bar; the state
owner with day / play / autoplay / reduced-motion; copies of `LesionTimeline` and `ScaleBar`
that import from the fable `lesion.ts`; and the route page, which is only the figure.

## Sequence
1. Shared modules (this doc, `lesion.ts`, `pores.ts`, `lesionGlsl.ts`).
2. Agents A–D in parallel against the interfaces above.
3. Integrate, `tsc`, headless shader-compile check in Chromium, dev server on a free port.
