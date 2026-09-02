# AnyDerm — Research Notes

Working file. Not routed: Next.js only serves `page.md` / `page.mdx`, so this filename
never becomes a page. Same pattern as `app/writing/pp/baseline-research.md`.

Sources are marked by origin. **[RK]** = Roshan's own prior work/conversations,
**[CGPT]** / **[CL]** = prior LLM sessions (unverified, treat numbers as claims to
check), **[WEB]** = scraped/cited this session with a URL.

---

## 0. Framing for the article

**The paper is about pushing the information/cost limit, not about hitting a target.**

The question is: *how much information can you extract from a sub-$500 setup?* We are
not trying to accomplish any particular clinical or cosmetic goal, and not arguing that
some specific capability is achieved. We are pushing the boundary as far as it goes and
reporting where it lands.

Consequences for how everything below is written:
- Success criteria are **not** pass/fail thresholds. There is no "we need X to work."
- Comparisons to Lumeria / OpenDerm / VISIA are reference points on a cost–information
  curve, not competitors to beat.
- Constraints (biological latency, registration error, magnification stability, ambient
  light) are inputs that *determine* where the limit sits — not obstacles to a goal.
- Wherever a number below reads as a requirement, restate it as a limit.

Performance is **not** claimed anywhere in these notes. It gets estimated once, later,
in the article's **Estimated Performance** section, from the constraints derived here.

---

## 1. The thesis, in one paragraph

A low-cost, non-contact, multimodal **robotic dermatoscope** that carries an optical
head around the face and produces spatially registered longitudinal maps of the whole
facial surface. The defensible claim is not optical quality — it is **repeatability**:
the same square millimetre of skin, under the same illumination geometry, every
session. The eventual asset is the dataset that produces: *skin state → treatment →
trajectory → outcome*, densely sampled across many people. **[RK]**

Explicitly **not** a melanoma/mole screening device. See §9 for why that framing is a
regulatory and clinical trap right now.

---

## 2. V1 architecture (converged)

```
SO-101 arm (6-DOF, scripted trajectories)
  → iPhone 17 as camera + compute
  → achromatic macro / close-up lens
  → small non-contact shroud
  → RGB LED ring + fixed cross-polarization optics
  → UVA (405 nm) LED ring
  → scripted continuous facial sweep
  → robot pose + CV registration
  → canonical 3D face map
  → longitudinal comparison software
```

**Deferred out of V1:** dedicated camera + ISP, OCT / confocal / ultrasound,
mechanically rotating polarizers, precision depth hardware, contact dermoscopy,
any diagnostic claim. **[CGPT §17]**

### Cost target

| Item | Cost | Source |
| --- | --- | --- |
| SO-101 follower arm, parts | $125–225 | [CL], [CGPT] |
| 12 V STS3215 servos | (included above) | [CGPT] |
| 3D printed structure, 350–700 g PLA+ | $10–18, or free at MIT makerspace | [CL] |
| Print time | 10–25 h | [CL] |
| Optical head (LEDs, polarizer film, lens, shroud) | remainder | — |
| **Total BOM target, excl. phone** | **≤ $500** (est. range $370–685) | [CL] |

Alternatives surveyed and rejected: AM-ARM, Koch v1.1, Hiwonder NexArm, reBot B601,
PAROL6, Annin AR4. No SO-102 exists. **[CL]**

---

## 3. The load-bearing engineering argument

> **The arm does not provide precision. Registration closes optically, not
> kinematically.**

Consumer servos and gear drives cannot hit sub-millimetre repeatability. Backlash is
~0.43°, which is **~1.9 mm at 25 cm** — backlash, not torque, is the binding
constraint. The arm therefore only needs **±10 mm** to put the target in frame; visual
servoing against stored reference tiles then closes to **tens of microns**. **[CL]**

Cheap ground truth: an **ArUco fiducial** on the head fixture plus a **white reference
patch in every frame** gives geometric and photometric references for ~$2 of
cardstock. **[CL]**

### Error budget, ranked worst → least

1. Skin deformation (dominates everything else)
2. Head fixture repeatability
3. Illumination consistency
4. Focus repeatability
5. The robot itself

**Geometry check already done:** 5 cm working distance verified with the iPhone 17.
This collapses the reach problem — temple stations that sat 43 cm away at 12 cm
standoff drop to ~32 cm, inside the arm's ~40 cm envelope. **[CL]**

---

## 4. Optics and illumination

### Modalities

| Mode | Mechanism | Measures | V1? |
| --- | --- | --- | --- |
| RGB / normal | Uncontrolled-polarization white LED | Appearance, pigmentation, lesions, texture, colour, gloss | Yes |
| Cross-polarized | Polarizer on illumination, analyzer ~90° at lens | Erythema, pigmentation, subsurface colour, inflammation, acne redness | Yes — highest value |
| UVA fluorescence | 405 nm excitation of **porphyrins** from *C. acnes* | Follicular/bacterial activity, possibly pre-inflammatory | Yes |
| Parallel-polarized | Polarizers aligned | Surface texture, oil, fine topography, shine | **No** — see below |

Porphyrins are small organic molecules, not proteins. UVA fluorescence signal is far
weaker than reflected RGB, so it is the modality most sensitive to ambient light.
**[CGPT §5]**

**On parallel polarization:** genuinely complementary to cross-pol, but mechanically
rotating a polarizer between frames is too slow. Options are fixed multi-channel
illumination, an electronic polarization approach, or — simplest — capture
**unpolarized + cross-polarized and infer the surface component from the
difference**. Not required for V1. **[CGPT §6]**

### Hardware

Cross-polarized LED ring (polarizer film over LEDs, second film rotated 90° at the
lens), achromatic close-up lens or clip-on dermatoscope, high-CRI constant-current
emitters, matte black shroud. Non-contact — robot pose replaces the spacer. **[CL]**

Capture: **stills over video**, Bayer RAW via AVFoundation, locked exposure / focus /
white balance, focus bracketing, dark-frame subtraction. **[CL]**

### Ambient light

The design constraint that makes this hard. Dermatoscopes touch skin partly *because*
contact fixes distance, stabilises the image, and blocks external light — all three of
which we give up by going non-contact.

Mitigations, in order of preference:
1. **Short shroud** around the head, close to but not touching the face. Cuts ambient
   dramatically, sets approximate working distance, makes UVA viable, improves
   repeatability. Must stay small — nose, nostrils, eye region and facial curvature
   make a large rigid shroud impossible.
2. **Overpower rather than exclude.** LEDs are cheap enough that illumination is not a
   BOM constraint; over a ~cm-scale patch the head can be far brighter than room light.
   This is the primary strategy for RGB.
3. **Ambient-only frame subtraction** as a fallback. **[CGPT §7–8]**

### Resolution tiers

Three-tier capture: **~100 µm/px** geometry pass, **~25–30 µm/px** regional survey,
**5–8 µm/px** targeted dermoscopy. The bottom tier is set by the **40 µm terminal /
vellus hair threshold** used in registered trial protocols. **[CL]**

Reference scale: DermLite-class dermatoscope is roughly a **32 mm field of view**,
~10× dermoscopic view. Small enough for high detail, large enough that a full-face
mosaic is feasible. Microscopic per-pore imaging is not the goal; the bar is
reliably following the same follicles, comedones, inflammatory lesions, pigmented
structures and texture features over time. **[CGPT §9]**

**iPhone caveat:** the ultrawide macro nominally hits **250 px/mm**, but it oversamples
soft optics and uses Quad-Bayer demosaicing that degrades **chroma** — precisely the
channel that carries erythema and pigmentation. Trading field coverage for per-tile
magnification is the mitigation. **[CL]**

---

## 5. Scan protocol

Two competing proposals — resolve before V1.

**A. Continuous sweep [CGPT §10]:** ~3 images/sec, ~2 min full face, up to ~360 raw
frames with heavy overlap/discard. Arm continuously adjusts position, orientation and
distance to stay roughly normal to local facial curvature.

**B. Coarse pass + fixed anchors [CL]:** a full-face dermatoscope-resolution scan
would run **40–50 min and ~150 GB of ProRAW** — self-defeating, because sebum
regenerates and erythema drifts *within that window*. Instead: a **~1 min coarse
whole-face pass** for global metrics and registration, plus **six fixed high-mag anchor
tiles** covering **~10,000 tracked follicles**. Target **under 5 minutes per session**,
which is the real compliance constraint.

> B is almost certainly right, and the "the scan must be shorter than the biology it
> measures" argument is a good figure/section for the whitepaper.

### Registration and geometry

Candidate pose sources: robot joint positions, visual SLAM / SfM, facial landmarks,
image feature matching, phone depth where available, a cheap depth/proximity sensor in
the head. Arm gives approximate pose; CV refines. **[CGPT §11]**

Output representation: **3D face surface + per-modality high-resolution texture maps**.
Conceptually between VISIA, photogrammetry, dermoscopy, and robot-tiled microscopy.

Naive 2D panorama stitching is insufficient — skin is curved, deformable, repetitive,
somewhat specular and slightly moving. Correct approach is **project each tile onto an
estimated 3D face surface**, then register longitudinal scans to that canonical
surface. **[CGPT §12]**

---

## 6. What can be measured

**Acne endpoints:** open comedones, closed comedones, papules, pustules, nodules (if
visible), lesion size, lesion redness, surrounding inflammation, post-inflammatory
pigmentation, porphyrin fluorescence, pore/follicle appearance, sebum/gloss,
texture/scarring. Possibly very early perifollicular change before visible
inflammatory lesions — **needs validation, currently speculative**. **[CGPT §15]**

**Hard limits.** This is a surface and shallow-optical-property instrument. Ordinary
RGB / polarized / UVA photography cannot visualise whole sebaceous glands, deep
follicle structure, or deep inflammatory processes. No OCT-like depth. Adding OCT,
ultrasound or confocal microscopy changes cost and complexity by orders of
magnitude. **[CGPT §16]**

### Biological latency — the real limiter

Precision is not the binding constraint; **biological latency and physiological noise
are.** Endpoint-specific minimum durations run **2 weeks** (irritation/harm detection
via cross-pol erythema) to **24 weeks** (dermal remodeling). Conventional acne lesion
counts need **8–12+ weeks**. **[CL]**

**The methodological win:** tracking **follicular plugging fraction across 300–500
registered follicles** converts a Poisson counting problem into a **binomial** one,
potentially compressing detectable signal to **~3 weeks**. Caveat: optics cannot see
closed microcomedones through scattering, so the practical proxy is a composite of
ostium area, optical density, perifollicular erythema, and 405 nm porphyrin
fluorescence. **[CL]**

> **The single most important number to publish is same-day test–retest ICC.** It
> defines the noise floor. Nothing longitudinal is interpretable without it. **[CL]**

---

## 7. Competitive landscape

### Robotic skin scanners — only three exist

| System | Cost | Spec | Status |
| --- | --- | --- | --- |
| **Swan / SquareMind** (Paris) | commercial | — | $18M raised Apr 2026, FDA Class I, CE-marked. The commercial target. |
| **iToBoS** (EU) | €12M project | 20 µm/px | Research only |
| **OpenDerm** (Marion Lepert) | $8,500 ✓ | **4-DOF gantry** (not an arm), Canon R7 + RF 100 mm, 78 px/mm ✓ (~13 µm/px) | Open, MIT repo. Closest prior art. See §8.2. |

### Cosmetic imaging comparables

- **Canfield VISIA** — $5k–17.5k used, ~$20–30k new. Med-spa sessions run $0–75;
  **worth booking one as ground truth.**
- **Lumeria Lumoscope** — YC S26, **$199 launch / $299 / $329** (not $229), shipping
  Sept–Oct 2026, non-contact clip-on. See §8.1.

**Position: nobody has built a sub-$500 open version.** **[CL]**

---

## 8. Web research

### 8.1 Lumeria Lumoscope — the consumer comparable

Researched 2026-09-01. Crawled `/`, `/buy`, `/how-it-works`, `/about`, `/faq`,
`/privacy`, `/terms`, `/preorder-terms`, `/refund`, `/glossary`, `/blog` (+3 posts),
`/why-we-are-building-lumeria`, `/careers`. No `/science` page exists.

> **Two corrections to my prior notes.** Price is **$199 launch / $299 post-launch /
> $329 regular**, not $229 — that changes the price-delta argument. And the UV LED is
> **365 nm**, not 405 nm; 405 nm violet appears nowhere on their site.

#### Product

| | |
| --- | --- |
| Price | $199 founder (first 5,000) · $299 post-launch · $329 regular |
| Subscription | Free tier permanent; Premium $10/mo or $100/yr; 3 mo included |
| Ships | Sept–Oct 2026, US only. First batch sold out in <24 h at $199 |
| In box | "Lumoscope multi-spectrum scanner (RGB, UV, Polarized)" — nothing else itemised |
| Returns | 30-day money-back, 1-year limited warranty |
| Form factor | Clip-on phone attachment, non-contact, "pre-production renders" only |
| Phone compatibility | **Not stated anywhere.** No models, no App Store link |

Sources: [/buy](https://lumeria.skin/buy), [/preorder-terms](https://lumeria.skin/preorder-terms),
[/faq](https://lumeria.skin/faq), [YC](https://www.ycombinator.com/companies/lumeria)

#### Optics — the whole spec sheet is missing

**Magnification, FOV, resolution (MP or px/mm), working distance, lens type, and which
phone camera it uses are NOT STATED on any page.** Confirmed absent on `/buy`,
`/how-it-works`, `/glossary`, `/faq`. The only capture number published is scan
duration: **"about a minute."**

This is the single most useful fact in the whole report. **They cannot publish px/mm
because a handheld clip-on has no defined standoff.** A robot with a fixed 5 cm
working distance can publish and *guarantee* that number. That asymmetry is the
whitepaper's opening.

#### Illumination

- **UV: "calibrated 365nm LED rather than a mercury bulb and filter."** Claimed to give
  porphyrin fluorescence + hyperpigmentation + sebum. ([/how-it-works](https://lumeria.skin/how-it-works))
- **Polarization: "Cross-polarized channel for texture; paired specular channel for
  gloss."** So they *do* ship both cross-pol and a specular/parallel channel —
  independent convergent evidence that the parallel channel is worth having. They never
  say how they switch between them. Hardware architecture unpublished.
- White LED CRI: not stated.
- One founder interview claims **NIR** as a fourth modality
  ([Berkeley SCET](https://scet.berkeley.edu/from-berkeley-to-y-combinator-lumeria-founders-build-the-oura-ring-for-skin/));
  it appears nowhere official. Treat as roadmap or reporter error.

> **365 vs 405 nm is a real decision I have to make.** They chose 365; my notes assumed
> 405. Porphyrin excitation peaks near 405 (Soret band), but 365 is more available in
> cheap LEDs and further from visible. Needs a paragraph and a citation in the paper.

#### Metrics claimed

RGB → redness/inflammation, lesion size &amp; distribution. UV → hyperpigmentation, sebum
patterns, porphyrin fluorescence, "detects breakouts before visible surface
appearance." Polarized → texture, topography, gloss, pores. Aggregate → evenness, fine
lines, tone, a proprietary **"Daily Skin Health Index,"** 7/30/90-day trends. Plus an
ingredient scanner over an 18,000-product database.

#### Repeatability — asserted, never measured

Their claim, verbatim: **"Same light, same distance, same bands, every time."** And:
results are **"comparable against your own baseline."**

But:
- **No fixture, headrest, or positioning aid is described anywhere.** Nothing enforces
  "same distance" except the user's hand.
- **No ICC, test–retest, or any numerical repeatability figure is published.**
- No scan protocol — no frame count, no facial zones, no angles.
- Their own careers page gives it away. The "Skin-Imaging Scientist" role is scoped as:
  **"Make the same capture mean the same thing eight weeks later — calibration and
  signal work."** ([/careers](https://lumeria.skin/careers))

> **They are hiring to solve the problem their marketing says is solved.** This is the
> single best quote in the file. It is the whole argument for mechanical pose control,
> stated by the competitor, in a job posting.

The one number they do cite for tracking value is behavioural, not optical: *"Across
138 experiments and 19,951 participants, prompting people to monitor their progress
measurably improved whether they reached the goal at all."* That is a self-monitoring
meta-analysis, not device validation.

#### Software

**"Lumi"** = AI coach reading scans + sleep/hydration/diet/environment/stress + Apple
Health; generates dermatologist-ready PDFs. **"Dermbot"** = conversational intake.
Claim: **"Lumeria trains its own models rather than passing your scans to a
general-purpose vision API,"** trained on "consented, dermatologist-labelled imaging
contributed by partner clinics."

But the privacy policy lists **Anthropic as a processor for "AI inference"** — so the
coaching layer is a third-party LLM even if the metric model is proprietary. Storage is
on-device plus encrypted Supabase with row-level security. Marketing site runs Meta
Pixel / Google Ads / PostHog, with an explicit carve-out: *"We never send Meta anything
about your skin: no scan data, skin metrics, concerns, or quiz answers, ever."*

#### Regulatory posture — copy this line for line

Site-wide footer: **"Lumeria is a general-wellness product, not a medical device. It is
not intended to diagnose, treat, cure, or prevent any disease."**

ToS: **"Lumeria is a wellness and self-optimization tool, not a medical device, and it
does not provide medical advice, diagnosis, or treatment."** · **"Scores and
suggestions may be inaccurate or incomplete and should not be relied on for medical
decisions."** FAQ: "Surfaces and tracks signals; offers insight and monitoring, not
diagnosis." Lumi is scoped as **"a coach, not a doctor."** Liability capped at $50.

**No FDA class is stated anywhere.** They avoid FDA language entirely — consistent with
sitting inside the General Wellness enforcement-discretion carve-out. Their counsel job
posting confirms this is deliberate: **"Prosecute the patent estate, open up HSA/FSA
eligibility, and hold the general-wellness line."**

> This is the exact posture AnyDerm should adopt, and their wording is a free template.
> "Hold the general-wellness line" while pursuing HSA/FSA eligibility is a smarter
> commercial path than I had written down.

#### Validation

**None published.** No study, no ICC, no sensitivity/accuracy for any metric. Blog
cites third-party literature to motivate the product, not validate it: 120 controlled
acne trials / ~29,592 people with 10–12 week windows; a 903-adult sunscreen trial
("24% less skin aging over four and a half years"); adherence falling 84.6% → 51% over
eight weeks. Two internally contradictory market figures — **$5B/yr** on one blog post
vs **$75B/yr** on `/why-we-are-building-lumeria` — neither sourced.

#### Company

YC **S26**, 3 people. Founders **Maryanne Alhallak** (CEO, Berkeley Econ '26, prior
biotech exit, large social following) and **Anthea Guo** (CTO, Berkeley EECS +
Bioengineering '26, ex-Google DeepVariant PM; developed severe eczema and was
misdiagnosed four times in five months). 150+ customer interviews, 5 advisors, 2
clinical partnerships, "patent pending" (no USPTO publication found — likely
provisional). Funding undisclosed. ~1.7M views across launch posts.

#### Where AnyDerm is structurally different

1. **No mechanical positioning control.** Their repeatability is asserted, not
   engineered, and not measured. Ours is the entire product.
2. **Spot capture, not registered full-face.** A ~1-minute handheld scan with no
   described stitching, no multi-angle sweep, no coverage guarantee.
3. **No publishable optical spec** — because standoff is undefined.
4. **User-induced variance** in angle, distance and pressure, session to session.
5. **No follicle-level longitudinal identity.** They report pores/texture as aggregate
   scores; nothing claims spatial correspondence of individual follicles across
   sessions. That is the binomial-compression trick in §6, and they cannot do it.
6. **No 3D or deformation correction.** Flat 2D multispectral only.

Points 1 and 5 are the paper's thesis, validated by a funded competitor's omissions.

#### Not published — where to look

| Missing | Route |
| --- | --- |
| Resolution, magnification, working distance, FOV, lens | Post-ship teardown; **FCC ID filing** once registered; watch for a future spec page |
| Phone compatibility | App Store / Play listing once the app goes live |
| ICC / test–retest | Not published. Watch the Skin-Imaging Scientist role's output; YC Launch HN thread |
| CRI, polarization switching architecture, any 405 nm channel | Ask contact@lumeria.skin, or teardown |
| Patent | Nothing found in USPTO/Google Patents under Lumeria/Alhallak/Guo as of 2026-09-01. Recheck post-ship |
| Funding | Undisclosed |
| Scan protocol (frames, zones, alignment UI) | Hands-on app review after ship |

### 8.2 OpenDerm — the closest prior art

Researched 2026-09-01. Sources: [openderm.github.io](https://openderm.github.io/),
repo [github.com/MarionLepert/openderm](https://github.com/MarionLepert/openderm)
(`LICENSE`, `README.md`, `docs/*.md` read raw), and Marion Lepert's blog.
**No arXiv paper or peer-reviewed publication exists** — searches surface only
unrelated robot-learning work (Phantom, Masquerade, Shadow, DROID, TidyBot).

> **Correction to my notes:** OpenDerm is a **4-DOF gantry (X, Y, Z, RX)**, not an arm.
> $8,500 and 78 px/mm both confirmed.

#### The three findings that change my design

**1. Autofocus is disqualifying at macro distance.** Their docs state it flatly:

> **"Lock manual focus at capture. Autofocus changes magnification ~1%/frame at macro
> distance (focus position *is* effective focal length)."**
> — [docs/skin-registration.md](https://raw.githubusercontent.com/MarionLepert/openderm/main/docs/skin-registration.md)

Their operator checklist: *"The Canon lens is manually focused at the 110 mm working
distance, and image stabilization is off."*

This is a direct hit on the iPhone plan. A 1%/frame magnification wobble is catastrophic
for a system whose entire claim is measuring sub-millimetre change. **Action: verify
whether AVFoundation `AVCaptureDevice.focusMode = .locked` genuinely freezes the lens
element, and whether locking it still permits a sharp image across the shroud's standoff
tolerance.** If iOS focus lock is not truly fixed, the phone-camera thesis is in
trouble and a fixed-focus dedicated camera comes back onto the table. **This is now
open question #1, ahead of everything in §10.**

**2. Their encoder-vs-optical delta is the number my §3 argument needs.** On a
purpose-built precision gantry with ballscrews and closed-loop steppers:

- Raw encoder poses differ from optically refined poses by a **median of 3.5 mm, up to
  14.3 mm**.
- The same lesion is displaced **up to 3.7 mm** across observations before optical
  optimization.
- Frames with **fewer than 20 usable observations** are left at their encoder prior.

A rigid gantry costing $8,500 still misses by 3.5 mm median. That is *strong* support
for "the arm does not provide precision" — but it also means my ±10 mm SO-101 budget
needs proportionally *more* optical correction, not less. Cite these numbers in §3.

**3. Narrow FOV creates a depth/rotation degeneracy.** Their tile FOV is **~8°**, and
they call it out as a problem: *"The narrow field of view limits depth information …
small camera translations can appear similar to rotations, causing image-only estimates
to drift."* They handle it by refusing to solve for focal length at all — locking
`--fx-full = 39,237 px` from independent calibration, because *"the narrow ~8° FOV makes
focal length and depth nearly degenerate."*

My standoff is 5 cm vs their 11 cm. Whether my angular FOV lands in the same
ill-conditioned regime depends on the macro lens, and **I have not computed this.**
Add it to the calculations section of the paper.

#### Hardware

| | |
| --- | --- |
| Kinematics | 4-DOF gantry: X, Y, Z linear + RX pan/tilt head |
| Envelope | X 0–800 mm, Y 0–665 mm, Z 0–392 mm (scan Y-window 50–570 mm) |
| Structure | 8020 aluminium extrusion; HGR20 linear rails; ballscrews (BF12/BK12) |
| Motors | 4× closed-loop NEMA23 2.0 Nm; CubeMars AK45-36 QDD gimbal for RX on a crossed-roller bearing |
| Control | BIGTREETECH Octopus Pro running **Klipper** (X); Raspberry Pi Pico + MicroPython (Y, Z); CAN servo service (RX) |
| Standoff | **110 mm**, held by 2× Panasonic HG-C1100-P laser displacement sensors that also drive RX to keep the axis normal to skin |
| Scan pattern | Serpentine raster, 300 mm X travel, 20 mm X spacing, 15 mm Y spacing, continuous motion |
| Safety | Offline CAD→URDF→FCL clearance envelope, 20 mm margin, ±2.5° RX backlash pad, runtime numpy lookup |

**Cost reality check.** The $8,500 is not mostly robot. Camera and imaging alone:
R7 body $1,549 + RF 100 mm F2.8L Macro $1,349 + Godox MF-R76 ring flash $179 +
Edmund Optics 38% linear polarizing film $45.75 = **$3,122.75**, over a third of the
total. Core-build big-ticket: the two laser sensors are **$651.20 for the pair**.
Full itemised BOM: [assets/data/bom.json](https://openderm.github.io/assets/data/bom.json).
Which sections sum to $8,500 is not stated.

> **Read this as validation of the phone strategy.** Removing the camera, lens and flash
> from the BOM removes ~$3.1k. That is the single biggest cost lever in the category,
> and it is the lever AnyDerm pulls. But see finding #1 — the lever has a hidden cost.

Blog admissions: the patient currently **lies beneath the robot**, which she calls
*"unsafe"*; ballscrews limit scan speed and belt drive is the stated V2 fix.

#### Optics and illumination

Canon EOS R7 (APS-C, 32.5 MP) + RF 100 mm F2.8L Macro at 110 mm, **manual focus locked,
IS off**. Achieved **78 px/mm ≈ 13 µm/px**. Tile FOV ~8°. Adjacent images overlap
**~75%**, yielding ~6,000 candidate SIFT features per frame. Dual JPEG + CR3 RAW per
pose. Camera driven over USB by Canon's **proprietary EDSDK** via a custom
`openderm-canon-capture` CLI on the Pi — the SDK is not open and must be downloaded
from Canon separately.

Illumination is a Godox MF-R76 macro ring flash with a single 150×150 mm 38%-transmission
linear polarizing film in the BOM. The site says "cross-polarization filter to reduce
glare," but **only one film is itemised** — so whether there is a true matched
flash+lens polarizer pair, or flash-side polarization only, is ambiguous. Worth
resolving before citing them as a cross-pol reference.

**No UV, no fluorescence, anywhere** — not in the site, repo, or blog. **No colour
calibration target, gray card, ColorChecker, or white reference either.** Instead they
engineer around it: the melanin metric **M = −log(R)** is deliberately exposure-invariant,
so a multiplicative exposure/WB gain cancels in the log-ratio.

> Both gaps are AnyDerm differentiation. UVA/porphyrin is genuinely unattempted in the
> open prior art. And note the limit of their trick: a log-ratio cancels *global
> multiplicative* gain only, not spectral shift — so it does **not** substitute for real
> colour calibration if I want absolute erythema/pigmentation values rather than relative
> change. Since erythema magnitude is one of my headline metrics, I need the white patch.

Not stated: ISO, shutter, aperture, depth of field, images per scan, or scan time.

#### Registration — the section to read twice

Their philosophy, verbatim:

> *"The diagnostic signal is the 2D skin texture, not 3D shape. So the 3D surface is only
> a scaffold to unwrap onto — it must be smooth, stable, and reproducible, not an accurate
> instantaneous reconstruction."*

**Method: encoder prior + SIFT bundle adjustment.** Not pure kinematics, not COLMAP,
**no ArUco, no ICP, no learned matching.**

1. CLAHE contrast equalization → **SIFT** keypoints.
2. Robot pose used as a *prior* to predict which frames overlap — it prunes the matching
   search space, it is not ground truth.
3. **RANSAC**, minimum **25 correspondences** per accepted pair (worked example: 920 of
   1,321 matches retained).
4. **Two-block bundle adjustment**: triangulate landmarks with poses fixed, then refine
   poses with landmarks fixed. Encoder poses are the initialisation and remain as **soft
   constraints**.

**Surface + stitching.** The scaffold is fitted from the subject contour (`--contour on`)
— a smooth fitted surface, not a dense mesh. Texture unwraps into a **gantry-anchored
proprioceptive frame** so "the same skin lands at the same map coordinate every scan."
Residual breathing/motion is removed by a **smooth per-frame affine warp in the 2D map**,
not in 3D, so stitch seams don't cross moles. Blending is **two-band: winner-take-all
per texel for high frequency** (no ghosting) + **feather-blended low frequency** (no
tiling). Default texture density 78 px/mm; preview 20 px/mm.

**Cross-session alignment** is a separate tiered fallback, since the gantry frame is no
longer shared once the subject repositions:
1. SIFT + RANSAC similarity transform, **accepted only if near-identity** — the shared
   gantry gauge is a strong prior that rejects false global rotation/flip/scale fits.
2. Fallback: **mole-constellation fit** — moles as their own fiducials.
3. Fallback: gantry-only, flagged low confidence.

**Change detection:** melanin transform M = −log(R), background-flattened over a ≥12 mm
window; moles found by **multiscale Laplacian-of-Gaussian** blob detection, contrast
threshold, radius NMS; matched nearest-neighbour under the alignment-residual prior with
a constellation cross-check. Verdicts tier as **RELIABLE / PROVISIONAL / LOW-CONFIDENCE**,
and NEW/DISAPPEARED calls are **hard-gated to mutual coverage** — you cannot call a lesion
new in a region that was not imaged in both scans.

**Their significance gate, worth stealing wholesale:** registration σ (local residual of
the chosen transform's inliers — RBF interpolation for dense SIFT, IDW for sparse
mole-based fits) combined **in quadrature** with detector σ (jittered-redetection std)
plus a null floor. Threshold: **|z| ≥ 2.5 AND |Δ| ≥ 0.30 mm**, both stated as conservative
defaults.

And a design rule I should copy: **size is measured in each scan's own un-warped frame**
— *"the transform is used only to MATCH moles, never to resample lesion pixels."* This
prevents the alignment warp from manufacturing apparent size change. Directly applicable
to lesion-area and pore-area metrics.

#### Calibration

- **Camera intrinsics: not provided.** *"OpenDerm does not provide a camera-calibration
  utility"* — delegated entirely to the user, no method or target specified. Pass the
  result via `--fx-full` (reference 39,237 px); recalibrate after any change to camera,
  lens, focus, or image dimensions.
- **RX pivot (their hand-eye equivalent):** `scripts/calibration/rx_pivot_capture.py`
  records ≥6 same-point poses across the RX range, `rx_pivot_fit.py` fits the lever-arm
  model → `captures/rx_pivot_model.json`.
- `cad/frame_calibration.json` registers real-to-CAD for the collision engine.
- Standoff verified against an inert target before each session (110 mm, sensor
  differential → ~0).
- **No colour/WB calibration procedure and no geometric calibration gauge exist.**

#### Software

Python 3.11+ and MicroPython. **No ROS** — deliberately. Three independent servers
(gantry :8090, pico-bridge :8095, rx-axis :8091) with, in their words, *"no shared state
or atomic full-pose command,"* which the collision-guard doc calls out as an architectural
constraint they had to design around. Two hard-won warnings: a blocking `/move` *"can
return 200 with `status='failed'`"*, and live `/state` reads are *"extrapolated mid-move"*
and unsafe for safety checks — use commanded targets.

Repo: `src/openderm/` (CLI, motion/gantry, motion/pico, motion/rx_axis, camera,
calibration, sensors, processing), `src/skinmap/` (registration, reconstruction,
comparison, GPU matching/rendering, `ghost_check.py`, `find_doublings.py`,
`track_moles.py`, Three.js viewer), `pico/`, `klipper/`, `scripts/calibration/`,
`scripts/collision/`, `cad/` (URDF, STL, collision data), `docs/`, `tests/`, CI.

The described pipeline **is actually checked in** — not vaporware. But the repo shows a
**single push event on 2026-07-27** (173 stars, 14 forks): a one-shot release, not public
iterative development.

#### Validation — there is none

**No accuracy, repeatability, ICC, subject count, dataset size, or lesion-detection
performance is published anywhere.** `results.html` is explicitly a demo: *"Reconstruction
detail reduced for faster loading," "Scan cropped for patient privacy," "Not a medical
device · Research use only."* The one shown example is two marker dots added between
scans and correctly flagged as new — a sanity check. Their only described evaluation is a
**same-scan null test** (verify all lesions match, no false new/disappeared) — internal
consistency, not external validation.

> **So the entire open prior art publishes no repeatability statistic.** Their z≥2.5 /
> 0.30 mm gate is an engineering heuristic, not a validated sensitivity. This is
> simultaneously the biggest gap in the field and the cheapest way for AnyDerm to lead:
> **publish same-day test–retest ICC and it is the first such number in open robotic skin
> imaging.** Reinforces §6.

#### Licence

Repo root `LICENSE` is **MIT** ("Copyright (c) 2026 OpenDerm authors") — permissive,
commercial derivatives fine, attribution only. The **website** claims **CERN-OHL-P-2.0**
for hardware, but **no separate hardware licence file was found in the repo**, so by
GitHub convention MIT applies repo-wide including `cad/`. Low risk either way — both are
permissive — but do not assume CERN-OHL-P notice mechanics apply unless a dedicated file
turns up.

#### What argues *against* my design

- Their registration is **not independently validated**, so I cannot cite OpenDerm as
  proof that SIFT+RANSAC+BA reaches clinical-grade repeatability. Budget for my own study.
- The ~8° FOV depth/rotation degeneracy may be **worse at 5 cm** than at their 11 cm.
  Unverified; compute it.
- Their whole working configuration is **manual focus, manual exposure, tethered,
  operator-supervised**. A consumer phone autofocusing and auto-exposing per tile diverges
  from the only configuration anyone has demonstrated working, and re-introduces exactly
  the two failure modes they deliberately engineered out.

#### Her strategic view, which is worth arguing with

She rejects the dedicated-device endgame: *"the path to scale is not a dedicated screening
robot in every household — it is to make skin screening one of the many useful things a
general-purpose home robot can do,"* framing OpenDerm as a data-collection bridge, with
lower-resolution clinic deployment (e.g. Neko) as an interim path. She also cites a
randomized trial in which Canfield's VECTRA WB360 **failed to increase melanoma detection
rates**, as her rationale for prioritising resolution over coverage — independent support
for §9's "oncologic surveillance is a trap."

> AnyDerm's counter is the face-only scope: a small, cheap, fixed-install appliance for a
> cosmetic use case people already pay for is a different bet than a whole-body screening
> robot, and does not need to wait for general-purpose home robotics.

#### Not published — where to look

| Missing | Route |
| --- | --- |
| Aperture / ISO / shutter | EXIF from any downloadable sample CR3/JPEG, or email marion.lepert@gmail.com (listed on site) |
| Images per scan, scan time | Not stated. Rough inference only: ~15 X-stations × ~34 Y-stations from default spacings — **my estimate, not their claim** |
| True cross-pol pair vs flash-only polarization | Only one film in BOM. Ask, or inspect build photos |
| Depth of field (numeric) | Not stated |
| Camera intrinsic calibration method/target | Explicitly delegated to the user, no method given |
| Any ICC / accuracy / subject count | None published |
| $8,500 vs itemised BOM reconciliation | Not stated which sections sum to it |
| arXiv / peer-reviewed paper | Does not exist as of 2026-09-01 |
| Hardware licence file matching the CERN-OHL-P claim | Not found in repo |


---

## 9. Commercial and regulatory framing

**Oncologic surveillance is a trap right now.** A prespecified RCT found 3D total-body
photography with sequential dermoscopy cost **~$945 more per person over 2 years** and
caught a similar number of malignancies versus usual care. A CE-marked consumer app
flagged high-risk lesions at a rate that would have caused clinically harmful
excisions. **[CL — verify both citations before publishing]**

**The stronger wedge: n-of-1 measurement of interventions people already pay for** —
retinoids, minoxidil, finasteride, GLP-1 skin effects — where no objective feedback
loop currently exists. This:
- dodges the diagnostic-claim regulatory cliff,
- targets a population already spending money,
- builds the dataset needed for higher-stakes claims later.

**Structural edge over clinic systems is interval, not optics.** A weekly home scan
from a fixed fixture has a far easier registration problem than an annual clinic scan.
SOTA longitudinal lesion matching drops to **71%** once detection errors are
counted. **[CL — verify]**

**Dataset defensibility:** good longitudinal datasets exist for skin cancer, but large
dense longitudinal *cosmetic facial* datasets with treatment/outcome data are much less
developed. That dataset may end up more defensible than the robot. **[CGPT §14]**

---

## 10. Open engineering questions

Ranked by how much they gate the project. **[CGPT §18 + CL]**

1. **Image quality** — can iPhone + close-up optics resolve the target features at 5 cm standoff?
2. **Motion blur** — can we get sharp frames while sweeping continuously at ~3 fps?
3. **Registration** — can repeat scans align skin patches accurately enough to measure subtle change?
4. **Geometry** — how much depth sensing beyond kinematics + CV is actually needed?
5. **Head size** — how small can the RGB/cross-pol/UVA head be with uniform illumination?
6. **Access** — can the arm safely reach good angles around nose and eyes?
7. **UVA value** — how much incremental acne information do porphyrins really add?
8. **Clinical utility** — does dense longitudinal measurement change treatment decisions enough to matter?

---

## 11. Next actions

- [ ] Book a **VISIA session** as ground truth
- [ ] Measure iPhone 17 **rolling-shutter readout** (horshack-dpreview tool)
- [ ] Print **calibration gauges** before the full arm; check MIT makerspace filament caps and queue policy
- [ ] **Run the $40 version first** — fixture + cross-pol ring, phone on a tripod, ~15 stations by hand in RAW, into COLMAP. A clean point cloud confirms the approach before buying motors.
- [ ] **Dark-room video test** with stop-and-shoot frame extraction (move, pause ~1 s, pull frames from stationary intervals)
- [ ] Verify the three [CL] literature claims in §9 against primary sources

---

## 12. Numbers to verify before publishing

Everything below came from an LLM session and has **not** been checked against a
primary source. The whitepaper is a feasibility argument; unverified numbers are the
fastest way to lose the reader.

| Claim | Value | §  |
| --- | --- | --- |
| SO-101 backlash | ~0.43° → ~1.9 mm @ 25 cm | 3 |
| iPhone ultrawide macro | 250 px/mm nominal | 4 |
| Vellus/terminal hair threshold | 40 µm | 4 |
| Full-face dermoscopy scan cost | 40–50 min, ~150 GB ProRAW | 5 |
| Follicles trackable in 6 anchor tiles | ~10,000 | 5 |
| Follicle count for binomial compression | 300–500 → ~3 weeks | 6 |
| 3D TBP RCT incremental cost | ~$945 / person / 2 yr | 9 |
| SOTA longitudinal lesion matching | 71% with detection errors | 9 |
| ~~OpenDerm BOM / resolution~~ | **VERIFIED** $8,500 / 78 px/mm (~13 µm/px) | 8.2 |
| ~~Lumeria price~~ | **CORRECTED** $199/$299/$329, not $229 | 8.1 |
| ~~Lumeria UV wavelength~~ | **CORRECTED** 365 nm, not 405 nm | 8.1 |
| Swan/SquareMind raise | $18M, Apr 2026 | 7 |
| iToBoS | €12M, 20 µm/px | 7 |

### New items added by the 2026-09-01 web research

| Claim | Value | § |
| --- | --- | --- |
| **iPhone AF magnification drift** | OpenDerm: AF changes magnification ~1%/frame at macro. **Does iOS focus-lock actually freeze the element?** | 8.2 |
| Encoder vs optical pose error, precision gantry | median 3.5 mm, max 14.3 mm | 8.2 |
| Lesion displacement before optical refinement | up to 3.7 mm | 8.2 |
| OpenDerm tile FOV → depth degeneracy | ~8° at 110 mm standoff. **My FOV at 50 mm: not computed** | 8.2 |
| OpenDerm camera+lens+flash share of BOM | $3,122.75 of $8,500 | 8.2 |
| 365 nm vs 405 nm porphyrin excitation | Soret band ~405; Lumeria ships 365. **Decision unresolved** | 8.1 |
| Published ICC anywhere in open robotic skin imaging | **Zero.** Nobody has one | 8.1, 8.2 |
