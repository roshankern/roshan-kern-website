# The AnyDerm lattices

`/anyderm` carries three point-cloud figures drawn as one continuous population.
A robot arm rests its lens on a woman's cheek; scrolling takes the image apart
one dot at a time. Some of those dots reassemble into the AnyDerm wordmark over
the hero heading, a few thousand drift in the page margins for the length of the
article, and at the foot of the page they gather back in and settle into a
portrait of Roshan. Rig, to margins, to portrait — the closing figure is the
opening one run backwards.

## Where it lives

| Path | What it is |
|---|---|
| `app/anyderm/lattice.tsx` | opening figure: the rig break-up, the wordmark assembly, the margin field |
| `app/anyderm/portrait-lattice.tsx` | closing figure: the convergence into the portrait |
| `public/anyderm/lattice/anim.json` | 124,194 points in three sets: `face`, `robot`, `halo` |
| `public/anyderm/lattice/rig-silhouette.png` | white-on-transparent alpha mask of the rig |
| `public/anyderm/lattice/wordmark.json` | 3,729 points, one set — the logotype |
| `public/anyderm/portrait/portrait.json` | 29,730 points, one set — the portrait |
| `public/anyderm/card.png` | the share card: a still of the opening frame |

Both components render their own fixed canvas plus their own scroll runway.
`<main>` in `page.tsx` carries `relative isolate` and each canvas is
`fixed inset-0 -z-10`, so they sit over the route's white ground and under every
section. The closing canvas is later in the DOM and clears transparent with
premultiplied blending, so the opening figure's margin drift still shows through
it rather than being erased. Remove the `isolate` and both canvases escape behind
the white ground and vanish.

Data is fetched at runtime, not bundled. If a fetch fails the article still
reads, it just has no dots — and the hero heading keeps its real glyphs, because
they are only hidden once the wordmark is actually ready to replace them.

## The wordmark is the heading

`page.tsx` gives the hero `<h1>` `id="anyderm-wordmark"`. `lattice.tsx` measures
that element's *ink* box — `getBoundingClientRect()` plus canvas `measureText`,
with CSS letter-spacing added back by hand since canvas ignores it — and lands
the wordmark on it, then sets the element's colour to `transparent`. So the dots
are the heading: same size at every breakpoint, no hardcoded dimensions, and the
accessible text stays in the DOM.

The placement is deliberately rigid. It is recomputed at the top of `draw()`, in
the same frame that paints, with no easing or damping of any kind on the
position — the wordmark and the tagline must read as one typeset block with a
constant gap. Anything that smooths the position reintroduces visible bounce on
a fast scroll. See "Known limits" below for the one frame that cannot be
removed.

## Choreography

Both figures work the same way. Scroll sets a target, the frame eases towards it
(`SCRUB = 0.15` seconds in each, framerate-independent), and everything that
animates is read off the eased value — so a flick plays the piece through at its
own pace instead of jumping a third of it in one frame, and a slow scroll still
tracks within a pixel or two.

Placement is the deliberate exception, in both. The wordmark's registration to
its heading and the portrait's to the foot of the article are recomputed raw, in
the frame that paints, with no easing anywhere near them. Easing a position is
what makes two things that should read as one block bounce against each other.

The opening is one run of scroll: `master()` maps the top of the page to the
offset that leaves the heading's ink centre on screen centre onto 0 to 1, and
the two phases lie across it. They overlap on purpose — waiting for the
withdrawal to finish before starting the break-up left the rig and the head
parked at the edges doing nothing, which was the thing that read worst.

Opening figure, in `lattice.tsx`:

    PULL       = [0, 0.44]     together, then apart to the edges
    BREAK      = [0.38, 1]     comes apart / the wordmark comes together
    SCRUB      = 0.15          seconds to close most of the distance
    FOCUS      = [1305, 569]   what the close framing centres on, box units
    ZOOM       = 1.10
    HALO_W     = 0.45          white border width, fraction of the baked band
    PAD        = 96            headroom below the box so the base never clips
    MEASURE    = 672           article measure the settled dots clear (max-w-2xl)
    FIELD_N    = 1401          the margin field — see the next section
    FIELD_SEED = 0x0f1e1d

Closing figure, in `portrait-lattice.tsx`:

    FIT        = 0.5     share of viewport height the portrait box fills
    RESERVE    = 360     CSS px kept clear for the contact copy on short windows
    GAP_TOP    = -0.058  negative: tucks up into the section's own bottom padding
    GAP_BOTTOM = 0.03
    LEADIN     = 1.2     viewports of lead-in before the runway enters
    GATHER     = [0.4, 1]
    SCRUB      = 0.15    the same easing, for the same reason
    GROW       = 1.8     how much larger a travelling dot is than a landed one
    FIELD_N, FIELD_SEED  identical to the opening's, and must stay identical

The gathering ends with the face **centred on the screen**, not with the
document at its foot: Roshan's account of why AnyDerm exists is set under the
portrait, and the last dot should land while the reader still has the whole face
in front of them and the first line of that quote is coming up from the bottom
edge. `layout` derives `view.span` for exactly that offset, and the page scrolls
on normally from there. Two consequences worth knowing. The quote section has to
be at least about `0.47vh - boxH/2` tall or the gathering can never reach 1 (at
the shipped fit that is `0.22vh`, and the quote is more than twice it at every
size). And `measure` must read the figure's edge straight off the element rather
than deriving it from the clamped progress — derive it and the figure freezes on
screen at p = 1 and the quote scrolls straight over the top of it.

The closing runway is *derived* from the gaps and the box height rather than
being a constant, so page height and figure stay in step. One consequence worth
knowing: `GAP_TOP` cancels out of the figure's on-screen position and only
shortens the page, which brings the copy down to meet the figure. Changing the
top gap therefore does not disturb the spacing below it.

Nothing animates while the opening image is whole, and `prefers-reduced-motion`
holds both figures to a static frame that still tracks scroll.

## One field, two figures

There is only ever one population of dots on this page. The rig comes apart into
it, it drifts beside the article, and the portrait is built out of it. **Nothing
is ever added.** Scroll the whole page measuring ink in the margins and it is
flat from the hero to the last section, then falls to zero as the face resolves;
the closing figure puts no ink in the margins *at all* until `data-q` leaves 0.
That is the property to protect, and the thing to re-measure if either figure is
touched.

It holds because both files generate the same field and then hand each dot over.
Two halves:

**The list.** `FIELD_N` and `FIELD_SEED` are declared identically in both files
and both run an identical `fieldDots()` over them — five numbers per dot in a
fixed draw order: when the portrait comes to collect it, then the four that
place it in the band and set its drift. So field dot j is the same dot in both:
same position, same size, same grey, same wobble. Both also read the same wall
clock (`performance.now() / 1000`, deliberately not a mount-relative one, which
would differ by however long the other figure spent compiling shaders) and
derive the band from the same `MEASURE`. Change any of that on one side and you
must change the other. A *near* match is worse than no match: it shows as a
doubled dot rather than as one dot.

**The signal.** `portrait-lattice.tsx` puts `id="anyderm-portrait-runway"` on
its runway and writes its gather progress to that element's `data-q`, 0 to 1, on
every update — including when its RAF loop is idle, so a parked scroll position
still publishes a current value. It publishes the *eased* value rather than raw
scroll, because that is the clock the dots are actually travelling on.
`lattice.tsx` reads `Number(el.dataset.q) || 0` and hands it to the shader,
which recovers each dot's own departure delay from `aDis.w` (it holds
`1 + delay`, so the `> 0.5` test that marks a survivor still works) and releases
the dot the instant the portrait starts moving it. Both sides ramp over the same
0.02 of that dot's travel, by which point it has moved well under a pixel — so
the dot does not vanish here and reappear there, it changes canvas.

Either file works with the other absent. No element means `q` stays 0, no dot is
ever released, and the field simply drifts for the life of the page.

## Capture hooks

Scrolled captures do not work headlessly — `window.scrollTo` plus
`--virtual-time-budget` yields a blank frame. This reproduces on the original
standalone reference pages, so it is the harness, not the page. Use the
fragments instead. A blank ~5.8KB PNG means the capture failed; real renders are
60KB+. The bottom ~90px of a headless screenshot is a window-vs-viewport
artifact, not page content.

Opening figure: `#flat` hides its runway, `#fp=N` pins progress, `#p=N` scrolls
to that fraction. Closing figure, namespaced so the two cannot collide:
`#pflat`, `#pf=N`, and `#psolo`, which strips the page back to the contact
section plus the figure over an opaque ground. `#flat&fp=1&pf=N` shows the
closing composition against real text.

For anything defined by on-screen position — which is now most of the opening
figure's choreography — drive a real browser over CDP instead; the fragments
pin progress, not layout.

## The share card

`public/anyderm/card.png` is the Open Graph and Twitter image, set in
`page.tsx`. Both blocks are spelled out there in full, including the fields the
root layout already sets, because Next does **not** deep-merge `openGraph` and
`twitter` across segments — inherit them and the page gets whatever card the
site root happens to carry rather than AnyDerm's own.

The image is a still of this page's own opening frame rather than a separate
drawing, so it cannot drift out of step with the figure. To make it again: serve
the page, open `/anyderm#flat&fp=0` in a real browser at 1200x630 with
`deviceScaleFactor: 2`, hide `main > section`, `main > div[aria-hidden="true"]`
and `.sr-only` (and the dev overlay), screenshot, then box-downsample the
2400x1260 result to 1200x630 and save it as an 8-bit greyscale PNG. That lands
around 196KB; do not reach for JPEG, which comes out *larger* here because the
dot grain is hostile to a DCT.

Render at dpr 2 and downsample rather than rendering 1200x630 directly — at
dpr 1 the cell falls under the 2px point floor and the grain degrades in exactly
the way the next section describes.

## Regenerating the data

**Read this before assuming you can.** `anyderm-lattice-export/`, the bundle
these figures were ported from — named in the "Ported from" line at the top of
both components — no longer exists on this machine. It held the generators, the
standalone reference pages, *and* the source renders the lattices were sampled
from. The generators were rescued into `apps/mymodernbio/docs/anyderm-generators/`
in the separate `modern-bio` monorepo — the page's former home — and did not
follow it here. They are configured exactly as the shipped data was baked:

    apps/mymodernbio/docs/anyderm-generators/build_wordmark_hero.py    FIT 0.2714, FILL 2.12
    apps/mymodernbio/docs/anyderm-generators/build_portrait_page.py    FIT 0.50,   FILL 2.6

    uv run --with numpy --with pillow python build_wordmark_hero.py out.json
    uv run --with numpy --with pillow python build_portrait_page.py out.json

The source renders were not rescued, and each script's `SRC` points into the
deleted bundle. So these will not run as they stand: they are the exact recipe,
not a working pipeline. To rebake anything you need the original PNGs back
(check wherever the bundle was archived), then repoint `SRC` at them.

**One render has since been recovered:**
`apps/mymodernbio/docs/anyderm-generators/source/robot-face-scan-clean-render-white-square.png`
(in `modern-bio`, alongside the generators)
— the rig-and-face scene, 1254x1254, greyscale in an RGB wrapper, on white.
It turned up outside the repo and is kept there so it cannot be lost twice; it is
the same family as the portrait's missing `roshan-clean-render-white-square-
portrait.png`, right down to the filename.

It is **not** the plate `anim.json` was baked from. Its ink box is 1106x953
(1.16:1); the baked cloud, rig at full `reach`, measures 1461x1120 box units
(1.30:1), so the rig sits differently against the head. Treat it as the scene,
not as the source — `anim.json` still has no generator anywhere and still cannot
be remade. What it is good for is anything that wants the picture rather than the
lattice: see `apps/mymodernbio/docs/anyderm-cards.md` in `modern-bio`.

`anim.json` and `rig-silhouette.png` have no generator at all — they came out of
the bundle already baked, and there is no way to remake them from what survives
in either repo. Treat all three data files as irreplaceable, and prefer changing a
component's constants over rebaking.

### Match the generator's FIT to how big the figure actually renders

**This is the trap that has bitten both figures.** Each generator bakes the
lattice for one on-screen size, via `TARGET_CELL_CSS = 1.788` and a `FIT` that
says what share of the reference window the figure fills. If the page renders it
smaller than `FIT` claims, the cell lands under the shader's 2px point floor,
every dot gets drawn at 2px with alpha compensation, and the result degrades in
a way no amount of shader tuning will fix: the wordmark washes out to mid-grey,
and the portrait grows a crosshatch moiré in its dark areas.

Both shipped files were rebaked for their real sizes:

| | generator default | rebaked at | dots | on-screen cell |
|---|---|---|---|---|
| wordmark | `FIT 0.80` | `FIT 0.2714` | 30,271 → 3,729 | 1.77 CSS px |
| portrait | `FIT 0.88` | `FIT 0.50` | 92,002 → 29,730 | 1.77 CSS px |

The wordmark's 0.2714 is the measured ink width of the `text-8xl` heading
(390.87 px) over a 1440 px window. The portrait's 0.50 is the component's own
`FIT`. If either figure is ever resized, the data must be rebaked to match or it
will regress in exactly these two ways. Dot count falls with the *square* of the
crop, not linearly.

### How the dots are made

Flood-fill the white ground away and crop to what is left; build an ink map from
the greyscale; average the ink over 2x2 source-pixel cells and place one dot per
surviving cell, jittered 40% of a cell off the lattice so the grain reads as
continuous rather than as a screen; size each dot by **area**,
`r = 0.5642 * cell * sqrt(ink)`; pack each into one uint32 as
`x(11) | y(11) | ink(8)` and base64 it.

`FILL` differs on purpose and must not be levelled:

- **2.12** for the animation and the wordmark. A full-ink dot is 1.196 cells
  across, so dots overlap side to side but corner-to-corner neighbours sit 1.414
  cells apart and cannot meet. That gap is the white showing through the black,
  and it is the point of the piece.
- **2.6** for the portrait, which wants the overlap that closes the lattice into
  continuous tone. The correction solves for the dot area that hits a target
  tone; text has no tone to hit, which is why the wordmark does not get it.

The lattice is laid out in **source** pixels, then scaled into a virtual box, so
the cell that reaches the screen is `step * box / crop_px`, not `step`.
Resampling the source to a different width silently changes the grain.

Because the halo's ring index is stored in the tone field, the white border
width can be changed from `HALO_W` without rebuilding anything.

## Known limits

- **One frame of lag on the wordmark during a fast scroll.** A `position: fixed`
  canvas is painted on the main thread and composited a vsync after the frame it
  was drawn for, while the compositor scrolls the DOM text immediately. Reading
  the ink box inside `draw()` removes every *extra* frame; it cannot remove that
  one. Measured under SwiftShader the residual is exactly one frame with no
  accumulation. If it ever reads as bounce on real hardware, the fix is to move
  the settled mark into the scrolling layer — either a second canvas inside the
  hero section, or rasterising the finished mark once and setting it as a
  `background-image` on `#anyderm-wordmark`.
- **The dot mark sits ~1–1.5px right and below the real glyphs**, from the ~4px
  pad baked into the wordmark box plus the font-metric baseline estimate.
  Invisible without a colour overlay.
- **Dots do cross the margins mid-gather, heavily.** Around the middle of the
  gathering the margins measure several times the settled field. That is the
  convergence itself — the portrait's other 28k dots scatter up to 0.72 viewports
  out before they land, and thousands of them are in the gutters at once — not
  the field being topped up, and it clears completely as the face resolves. The
  invariant that matters, and the one to re-measure, is the flat stretch: the
  closing figure must put **no** ink in the margins anywhere `data-q` is 0.
- **Short windows re-introduce a faint portrait moiré at 1x.** Below roughly
  1440x700 the `RESERVE` bound shrinks the portrait below the size its data is
  baked for, putting the cell back under the 2px floor. Inherent to capping the
  fit — the data can only be baked for one size. Clean at dpr 2.
- The source wordmark PNG's glyph box is 782px and is upscaled before sampling.
  A vector or higher-resolution logotype would give cleaner curves on the D
  and y.
