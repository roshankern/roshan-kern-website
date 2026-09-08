# Reference notes: one inflammatory acne lesion under a DermLite DL1 on an iPhone

Visual reference for a photoreal real-time render of a single lesion on Fitzpatrick III–IV cheek skin, 4.5 mm field of view, ~5 µm/px (~900 px across the field), non-polarised LED ring, 21-day course: microcomedone → closed comedo → papule → pustule (peak ~day 11) → rupture/crust → flat post-inflammatory red mark.

Everything below was written from photographs that were downloaded and inspected (files live in the session scratchpad under `refs/`, with ×2–×3 crops under `refs/crops/`). Colour values are sRGB 0–255 triples sampled from the files with PIL (box means, plus 2nd / 98th percentiles where useful). Two caveats the shader author should keep in mind:

1. The only true dermoscopic series of all four acne stages (img 01) is a journal figure that is under-exposed and desaturated relative to a phone dermatoscope frame: whole-figure median luma ~150, base skin ~(175,150,155). The DermLite-on-phone frames of normal cheeks (img 04–08) sit at ~(205–225, 165–190, 130–175). Use the journal figure for **relative** relationships (how much darker/redder the halo is than base, how much lighter the pustule head is) and the phone frames for **absolute** exposure.
2. Img 01 is Fitzpatrick I–II hairy skin (probably trunk/limb), not a III–IV cheek. Base tone and pigment mottling for the target skin were taken from img 04, 06, 07 (Indian cheek/zygoma dermoscopy) and img 19–20 (FST III–IV cheek macro photos).

---

## (a) Sources

| # | File | Source URL | Licence | What it shows |
|---|------|------------|---------|---------------|
| 01 | `01_pmc8999263_fig2_acne_dermoscopy.jpg` | https://cdn.ncbi.nlm.nih.gov/pmc/blobs/6f4b/8999263/00dc414d0b96/jcm-11-01783-g002.jpg (from https://pmc.ncbi.nlm.nih.gov/articles/PMC8999263/ , Fig. 2) | CC BY 4.0 | **Key image.** Dermoscopy of (a) closed comedo, (b) open comedo, (c) papule, (d) pustule. 4 tiles, ~369 px each; light skin with terminal hairs. |
| 02 | `02_pmc5621214_fig2_nevus_comedonicus.jpg` | https://cdn.ncbi.nlm.nih.gov/pmc/blobs/263b/5621214/ce94cbec004f/IDOJ-8-388-g002.jpg (PMC5621214, Fig. 2) | CC BY-NC-SA 3.0 | Non-polarised ×50 dermoscopy of many keratin plugs: reference for open-comedone plug colour/edge and brown peri-follicular rings; fine white skin lines; vellus hairs. |
| 03 | `03_pmc8999263_fig4_oct.jpg` | https://cdn.ncbi.nlm.nih.gov/pmc/blobs/6f4b/8999263/f87cdaa1f72b/jcm-11-01783-g004.jpg | CC BY 4.0 | D-OCT cross-sections (not a photo). Used only for lesion geometry: papule/pustule are dome-shaped; pustule cavity is superficial. |
| 04 | `04_ijdvl_fig3b_cheek_patchy_pseudonetwork.png` | https://ijdvl.com/content/126/2026/92/1/img/IJDVL-92-1-6-g4.png (IJDVL "Mapping the dermoscopic features of the normal face", Fig. 3b) | CC BY-NC-SA 4.0 | Normal **cheek**, skin of colour, ~25 mm field: patchy accentuated pseudonetwork, terminal + vellus hairs, pale round follicular "holes". |
| 05 | `05_ijdvl_fig3d_cheek_unfocussed_pseudonetwork.png` | https://ijdvl.com/content/126/2026/92/1/img/IJDVL-92-1-6-g6.png (Fig. 3d) | CC BY-NC-SA 4.0 | Normal cheek: unfocused (soft) pseudonetwork, dense long vellus hairs, strong bright ring-light vignette. |
| 06 | `06_ijdvl_fig4d_cheek_brown_circles.png` | https://ijdvl.com/content/126/2026/92/1/img/IJDVL-92-1-6-g11.png (Fig. 4d) | CC BY-NC-SA 4.0 | Normal cheek: brown circles around follicular openings, uniform pore spacing, one tiny crusted follicle. |
| 07 | `07_ijdvl_fig4e_zygoma_dot_in_circle.png` | https://ijdvl.com/content/126/2026/92/1/img/IJDVL-92-1-6-g12.png (Fig. 4e) | CC BY-NC-SA 4.0 | Zygoma: crisp tan pseudonetwork mesh with "dot in circle" follicles; best reference for the pigment network on FST IV. |
| 08 | `08_ijdvl_fig5_cheek_vessels.png` | https://ijdvl.com/content/126/2026/92/1/img/IJDVL-92-1-6-g14.png (Fig. 5) | CC BY-NC-SA 4.0 | Cheek: unfocused linear branching vessels, white reticular skin-line mesh, abundant vellus hairs. |
| 09 | `09_ijdvl_fig4f_trichostasis_vellus.png` | https://ijdvl.com/content/126/2026/92/1/img/IJDVL-92-1-6-g13.png (Fig. 4f) | CC BY-NC-SA 4.0 | Nose: tufts of vellus hair from follicles; how a pore with hair reads as a dark dot. |
| 10 | `10_pmc12471122_fig2_malassezia_folliculocentric_150x.jpg` | https://cdn.ncbi.nlm.nih.gov/pmc/blobs/4821/12471122/53182d9b8893/jof-11-00662-g002.jpg (PMC12471122, Fig. 2) | CC BY 4.0 | 150× dermoscopy of folliculocentric papules with red halo, central hair, one tortuous vessel; heavy orange cast. |
| 11 | `11_pmc4844532_fig1_papule_vellus_hair.jpg` | https://cdn.ncbi.nlm.nih.gov/pmc/blobs/a57d/4844532/363f7e6b7e1d/jdcr-10-019-g001.jpg (PMC4844532) | Journal open access (© Specjalisci Dermatolodzy; PMC) | Polarised dermoscopy of an inflamed follicular papule: yellow-orange serum crust centre, red haemorrhagic dot, dotted vessels, pink halo, translucent vellus hairs. |
| 12 | `12_pmc10712575_sebaceous_filaments.jpg` | https://cdn.ncbi.nlm.nih.gov/pmc/blobs/3ae0/10712575/8a8b4a624831/cureus-0015-00000048656-i01.jpg (PMC10712575) | CC BY 4.0 | Clinical photo, FST V face with sebaceous filaments; only used for pore density on dark skin. |
| 13 | `13_commons_Closedcomedos.jpg` | https://upload.wikimedia.org/wikipedia/commons/5/54/Closedcomedos.jpg | CC BY 2.5 | Macro of closed comedones (whiteheads) at the nasolabial fold: yellow-tan glossy domes, open comedones as dark dots, surface scale. |
| 14 | `14_commons_Comedones.jpg` | https://upload.wikimedia.org/wikipedia/commons/6/62/Comedones.jpg | CC BY-SA 3.0 | Drawing, not a photo. Not used. |
| 15 | `15_commons_Nose_with_Blackhead_2009.jpg` | https://upload.wikimedia.org/wikipedia/commons/a/a4/Nose_with_Blackhead_2009.jpg | CC BY-SA 3.0 | Macro of an oily nose: pore dimples, broad sebum sheen, a 1 mm red spot with a crusted centre. |
| 16 | `16_commons_Reddish_zit.jpg` (PNG) | https://upload.wikimedia.org/wikipedia/commons/f/f6/Reddish_zit.png | CC BY-SA 4.0 | Phone macro, non-polarised: a single ~3 mm papule on hairy skin, crisp skin-line network with glints, vellus hairs crossing the dome, specular patch on the dome. |
| 17 | `17_commons_Scab_knee.jpg` | https://upload.wikimedia.org/wikipedia/commons/0/0b/Scab_%28knee%29.jpg | CC BY 2.0 | Flash macro of a wet-to-drying scab: crust colours, glints, pink rim, hairs over crust. (Knee, but the only good crust close-up found.) |
| 18 | `18_commons_Up_close_of_human_chin_and_lips.jpg` | https://upload.wikimedia.org/wikipedia/commons/b/b0/Up_close_of_human_chin_and_lips.jpg | CC0 | Phone photo of a chin with one 1 mm whitehead and one red macule. Low magnification; used only for whitehead colour at a glance. |
| 19 | `19_commons_Üzde_..._Acne_Vulgaris_05.jpg` | https://commons.wikimedia.org/wiki/File:%C3%9Czd%C9%99_d%C3%BCy%C3%BCnl%C3%BC_v%C9%99_kistik_s%C4%B1zanaqlar_(Acne_Vulgaris)_05.jpg | CC BY-SA 4.0 | FST III cheek with active pustules, yellow serum crusts, dark haemorrhagic crusts and confluent erythema. |
| 20 | `20_commons_Üzde_..._Acne_Vulgaris_11.jpg` | https://commons.wikimedia.org/wiki/File:%C3%9Czd%C9%99_d%C3%BCy%C3%BCnl%C3%BC_v%C9%99_kistik_s%C4%B1zanaqlar_(Acne_Vulgaris)_11.jpg | CC BY-SA 4.0 | **FST IV male cheek** covered in flat post-inflammatory red/mauve marks, open comedones, pores, vellus hair. Best reference for the healed-mark stage and for FST IV base tone. |
| 21 | `21_pmc3780804_pie.jpg` | https://pmc.ncbi.nlm.nih.gov/articles/PMC3780804 ("Easy as PIE") | Journal open access (JCAD) | Low-res before/after of post-inflammatory erythema on a cheek. Confirms PIE = pink-red macules 2–4 mm, no relief. |

Skipped/failed: Wikimedia Commons has no dermoscopic acne images (its Dermatoscopy category holds 4 files, none acne). OpenDerm has no acne samples. No open-licence dermoscopic photo of an acne crust was found; crust notes come from img 17 and 19.

---

## (b) Per-stage appearance spec

Scale conversions for the DL1 frame: 1 mm = 200 px, 100 µm = 20 px, 10 µm = 2 px.

### Stage 0 — microcomedone (days 0–3)
Not visible as a lesion. Under dermoscopy this is at most a single follicular opening whose plug is a shade more yellow than its neighbours. (Img 01a shows how little a sub-clinical/closed lesion changes the field; LC-OCT paper PMC13266275 confirms microcomedones are only detectable below the surface.)
- Render: the target pore's interior goes from the normal tan-grey (see section c) to a slightly paler, yellower fill, e.g. base pore (185,150,124) → (196,165,128). Nothing else changes. Diameter unchanged (60–120 µm = 12–24 px).

### Stage 1 — closed comedo (days 3–6)   [img 01a, 13, 18]
- **Shape:** low dome 0.6–1.2 mm across (120–240 px), height maybe 100–200 µm; no opening, or a pinpoint one.
- **Colour:** essentially skin-coloured, at most 5–8 % lighter and slightly yellower than base. In img 01a the dome is only found via a faint pale patch and a collarette of fine white scale over its upper edge; the dome tone (170,125,111) vs base (166,127,116) is a ~2 % shift. In the macro photo img 13 (clinical, not dermoscopic) mature whiteheads are clearly yellow-ochre (152,133,118 mean, darkest (113,69,44)) and glossy — that is a bigger, older lesion; for a day-4 cheek lesion aim between the two: dome colour ≈ base tint shifted +6 R, +4 G, −6 B, with a faint warmer yellow core 0.3 mm wide under the apex.
- **Edge:** no edge at all. Shape is read purely from shading: the apex gets a soft broad highlight (ring light reflected in the sebum film), and the far slope is 3–5 % darker than base. Ring-light highlight on img 13 whiteheads is a soft blob ~30 % of the dome diameter, not a hard dot.
- **Surface:** a thin crescent of fine white scale (flakes 50–150 µm) often sits at the shoulder of the dome (img 01a, upper edge). Skin-line network runs uninterrupted over the dome.
- **Erythema:** none, or a barely-there blush (Δ ≤ 5 in G/B) — img 01a shows a very faint pink field under the dome.
- **Gloss:** slightly higher than base (sebum-rich).

### Stage 2 — papule (days 6–9)   [img 01c, 11, 16, 10]
- **Shape:** dome 1.5–3 mm across (300–600 px — it fills a big chunk of the 4.5 mm field), height ~0.3–0.5 mm. Img 01c's papule is a broad shallow mound; img 16's is a taller ~3 mm bump.
- **Colour:** the most important thing is that a papule is a **diffuse red glow with no outline**. Sampled in img 01c: core 50 px box mean (166,102,105), broad 160 px box (170,119,120), skin at the tile edge (175,133,133) / (166,124,123). So in that (dark) figure the red is only ~−20 G, −20 B relative to base; on a properly exposed FST III–IV frame expect base (205,168,140) → papule core ≈ (198,120,112) → halo mid (200,140,125) → base. Hue shifts toward pink-red, saturation up, luminance down ~10 %.
- **Radial profile:** brightest/least red at the very apex (skin stretched thin + highlight), reddest in an annulus ~0.5–0.8 mm from centre, then fading over another 1–1.5 mm. The fade is not a smooth gaussian: img 01c and img 19 show the halo as **blotchy** — mottled patches 150–300 µm across of slightly deeper red inside the halo, following the underlying pseudonetwork. Halo edge is completely soft (transition width ≥ 0.7 mm = 140 px).
- **Central follicle:** a tiny dark-red/brown dot 60–120 µm (12–24 px) at the apex = the plugged/crusted follicular opening (img 01c: (145,32,36), the darkest thing in the tile; img 15 red spot (159,54,57)). Sharp-edged. Sometimes replaced by a yellow-orange serum dot (img 11: (151,115,54)) with a haemorrhagic red speck beside it (146,93,48).
- **Subsurface / translucency:** on the rim of the dome, where light enters the mound obliquely, the red intensifies and looks like it is coming from *under* the skin — the surface texture (skin lines, scale) stays skin-coloured on top of the red (img 01c, 19). Vellus hairs and scale on the dome are unchanged in colour; only the ground glows. In img 16 (phone macro) the dome reads (136,121,105) on skin (172,164,146): ~20 % darker, more saturated, with the far slope darker still ((101,92,78) p2), i.e. there *is* shape shading at macro scale, plus a bright smeared specular patch on the near-light slope.
- **Vessels:** around inflamed lesions, 1–3 faint unfocused linear/tortuous vessels may appear in the halo (img 10 blue arrow; img 08 shows the normal-cheek version). They are low contrast: ~(238,185,166) on (225,181,158) in img 08 — i.e. only 5–10 % redder than the halo they sit in, 40–80 µm wide (8–16 px), slightly blurred (they are 100–200 µm deep). Not sharp lines.
- **Gloss:** tense papule skin is a bit shinier than base; ring-light highlight becomes a soft arc/crescent on the near-light slope, ~0.3 mm wide (img 16, 19).

### Stage 3 — pustule at peak (~day 11)   [img 01d, 19, 18, 13]
- **Shape:** the red papule now carries a raised creamy head 0.5–1.0 mm across (100–200 px) sitting slightly off-centre on a 2–3 mm red dome. Head is a smooth hemispherical blister under a very thin roof.
- **Head colour:** img 01d head 44 px box mean (162,150,144); p98 (166,168,165) — i.e. the head is the **least saturated** thing in the frame (near-neutral cream/ivory), about +15 luma over base and ~25 points *less* red than the surrounding halo. Under the roof, a yellow-tan pus core (164,143,125) is visible, offset from centre; img 19's mature pustule heads read (189,147,105) — a distinct ochre yellow. So: head = ivory rim → yellow-ochre centre; the yellow gets deeper as the pustule ages (day 11 → 12). A small pink-red patch (haemorrhage) may sit at one edge of the core (img 01d bottom of head, ~5 px ≈ 100 µm in the figure).
- **Head edge:** crisp but not hard — transition ~40–60 µm (8–12 px). Immediately outside the head there is a **thin darker ring** (img 01d halo p2 (152,99,109); about 100–150 µm wide) before the halo proper. This dark ring is what makes the head look raised.
- **Halo:** erythema (172,121,133 in img 01d, i.e. −30 G, −25 B vs that tile's base (178,146,157)) extends 1.0–1.5 mm from the head, asymmetric (deeper on one side), feathering to base over a further 0.3–0.5 mm; blotchy as in stage 2. Beyond the halo the field is normal.
- **Specular:** on a non-polarised ring light the taut head carries one small bright dot or short arc 40–100 µm (8–20 px) near its apex, plus the broader soft ring-light reflection on the dome. In img 01d (fluid-contact, so glare suppressed) the head has only a broad soft brightening; img 13/19 (dry macro) show a compact highlight on each head. Model it as a hard small highlight (roughness low) on the head, a broad soft highlight on the surrounding dome.
- **Hairs over the lesion:** img 01d shows 3–4 hairs converging over the pustule, crossing directly over the head, one appearing to emerge from the head itself. Hairs are not displaced by the lesion; they cast no visible shadow; where they arch above the surface they go slightly out of focus.
- **Extras seen in the figure:** small white/translucent rings ~150–300 µm (immersion gel bubbles) — not skin; do not render.

### Stage 4 — rupture and crust (days 12–16)   [img 19, 17, 11, 15]
- **Wet phase (first ~24 h):** the head collapses; the opening exudes serum/blood. Colours from img 19 and 17: fresh serum crust yellow-ochre (185,144,107) ≈ pustule yellow but darker and greyer; fresh blood/haemorrhagic crust deep maroon (98,18,27) — the darkest element in the whole series, ~35 luma. Wet crust is **glossy**: hard white specular glints 20–60 µm (4–12 px) scattered over its surface (img 17 has dozens of them), i.e. tiny facets of a wet irregular surface, not one big highlight.
- **Dry phase:** crust 0.8–2 mm across (160–400 px), irregular chunky outline (lobulated, with 100–200 µm protrusions), slightly raised with a visible lip, matte. Body colour mid-brown-maroon (172,114,103 mean in img 17; (184,109,90) median) with darker streaks (112,39,30) and paler fibrin islands (~(215,190,150)). Cheek acne crusts in img 19 are smaller and two-toned: ochre-yellow granular (188,144,111) or near-black maroon (108,20,22). Fine white scale flakes 50–200 µm rim the crust edge and lift at the margin; a ring of flaking epidermis 0.2–0.4 mm wide surrounds it (img 19 crops show white flecks around every crusted lesion).
- **Surround:** erythema persists but the red-dome height drops; the pink rim immediately around the crust is brighter/pinker than the day-11 halo (img 17 rim (214,148,150)), then the halo tapers over 1–2 mm. Total lesion (crust + halo) ~3 mm.
- **Edge:** crust edge is the sharpest boundary in the whole animation (transition < 20 µm = 4 px), with a 1–2 px dark line where the lip shadows the skin.

### Stage 5 — flat post-inflammatory red mark (days 17–21)   [img 20, 21, 19 upper cheek]
- **Shape:** flat (no relief), irregular oval 2–4 mm across, often slightly larger than the papule was; the skin-line network runs across it uninterrupted; the central follicle is either a normal pore again or a slightly enlarged dark dot.
- **Colour (FST IV, img 20):** mark (175,125,128) on base (193,156,137): −18 R, −31 G, −9 B → a mauve/purple-pink, distinctly *bluer* than the peak halo (halo was red-pink; PIE is red-violet). Some marks have a faint tan/brown component at the edge (early PIH) ≈ (170,135,115). On FST III (img 19 upper cheek) the marks are pinker: ~(180,130,130) on (185,151,139).
- **Edge:** soft, feathered over ~0.3–0.5 mm (60–100 px); outline irregular, often with a slightly paler centre where the crust was (early scar/atrophy, +5–8 luma, very slight sheen).
- **Gloss:** same as base; a small healed atrophic centre can be a touch shinier.
- **Fade:** by day 21 the contrast should be down to ~half of day 17 (G channel −15 instead of −31).

---

## (c) Normal cheek skin under dermoscopy (FST III–IV)

### Base tone and exposure
- Phone-dermatoscope normal-cheek frames: img 06 cheek (219,191,164) mean; img 07 zygoma (206,164,132); img 04 cheek (211,173,129); img 05 (paler subject) (210,191,174). Macro FST IV cheek img 20 (193,156,137). **Recommended base for FST III–IV cheek under the DL1: (205±8, 168±8, 135±8)**, luma ~170, with hue a warm tan (R−B ≈ 70).
- Within-frame variation in a normal 4.5 mm patch: ±6 % luminance from pigment mottling, ±10 % from ring-light falloff (see d).

### Pseudonetwork / pigment mottling (img 04, 06, 07, 05)
- Facial skin has no true pigment network; it has a **pseudonetwork**: a tan/brown ground perforated by pale round follicular "holes". In img 07 (zygoma, the crispest example) the mesh strands are (165–185, 118–140, 84–105) and the holes (206,164,132); strand width ~100–150 µm (20–30 px), hole diameter 300–500 µm (60–100 px); luminance contrast between strand and hole ~15 %. In img 05 (a paler cheek) the same structure is "unfocused": the mesh is a soft blotch pattern with ~5 % contrast and no crisp lines. For FST III–IV cheek use something between: soft-edged (blur ~50 µm) tan mesh, 8–12 % contrast.
- **Patchy accentuation** (img 04): irregular darker patches 1–3 mm across, 10–15 % darker and redder-brown than the surrounding ground ((189,130,74) p2 vs (211,173,129) mean), with soft edges. Give the field 1–2 of these per 4.5 mm.
- **Follicular brown pigmentation** (img 06, 07): many pores are ringed by a brown annulus ("brown circle"): ring outer diameter 250–450 µm (50–90 px), ring width 40–80 µm, colour ~(195,153,132) vs base (219,191,164), i.e. −25 G, −30 B; hollow interior is pale. About 25–40 % of pores get one (IJDVL: 26–37 %).

### Pores (img 06, 07, 09, 15, 20, 02)
- Spacing 0.7–1.3 mm (140–260 px), fairly uniform grid-with-jitter (IJDVL: uniform size and spacing in the majority). ~12–25 pores in a 4.5 mm field.
- Opening 60–150 µm (12–30 px), roughly round; interior is a shallow pit that reads as a slightly darker, slightly yellower-grey dot: ~(185,150,124) on the (205,168,135) base in dermoscopy (img 06 p2). Macro non-polarised (img 15): pore dimples are tan-grey with a darker lower lip.
- Open comedone pores (a few per field on an acne-prone cheek, img 20, 02, 13): a dark brown-to-black plug filling the opening, 200–400 µm, colour ~(60–110, 25–70, 15–45) (img 02 plugs, img 13 dots), sharp-edged, sometimes with a paler tan rim. Include 1–3 of these as background lesions, not the hero.
- "Dot in circle" (img 07): a pore with a hair or plug appears as a dark dot centred in a pale hole in the mesh.

### Vellus hairs (img 05, 08, 04, 11, 16, 01)
- Density on cheek: high. Img 05/08 show ~40–80 hairs in a 25 mm field near the ear/jaw; a mid-cheek 4.5 mm field should show **6–15 hairs**, mostly aligned within ±30° of one direction (downward/backward), curving gently, some crossing.
- Width 30–60 µm (6–12 px), i.e. 2–5× narrower than a pore opening; length 1–3 mm (200–600 px) — many exit the frame.
- Colour: **translucent tan-brown, not black.** In img 05 the hairs are the darkest 2 % of the field at (184,167,141) vs (210,191,174) ground — only ~13 % darker. In img 08 (188,147,125) vs (225,181,158). In img 11 (polarised) they are almost skin-toned and slightly yellow ((156,131,106) on (154,131,119)): the shaft transmits light. Terminal hairs (img 04, 01) are much darker (189,130,74 → down to (134,84,85)) and thicker (60–100 µm); a female/adolescent cheek should have few or none in frame.
- Each hair has a **bright specular line** along one edge (ring-light reflection off the cylindrical shaft) — in img 08 and 16 hairs read as a dark line paired with a thin lighter line. No cast shadow is visible in any dermoscopic frame (img 01, 05, 08); at most a faint 1–2 px darkening where the shaft touches the surface (img 16, macro).
- Emergence: the hair exits the pore at 20–45° to the surface from one side of the opening (img 09, 01b: hair leaves the edge of the plug, not the centre), so the pore shows a dark dot with the hair as a tangent. Where the hair lifts off the skin it drifts out of focus (img 01d, 05: hairs crossing the pustule are softer than hairs lying flat).

### Skin-line network / sulci (img 08, 16, 15, 02)
- Under a non-polarised ring light without contact fluid (img 16, 15, macro): the ridges/plateaus catch the light as **short bright dashes** (glints 50–150 µm long, +20–30 luma) arranged in a rhomboid/triangular mesh; the sulci between them are slightly darker (−5 %). Plateau (cell) size 200–400 µm (40–80 px); sulcus width 30–60 µm (6–12 px). The primary lines run in two dominant directions crossing at ~60–80°; secondary lines subdivide the cells.
- In fluid-contact dermoscopy (img 08, 02): the sulci appear instead as a **fine white reticular mesh** ((255,214,195) on (225,181,158) — white lines from scale/air in the grooves), 20–40 µm wide, low-to-moderate contrast, softer than the pore/pigment structures. Cheek cells are smaller and the mesh finer than on limbs.
- On a well-hydrated young cheek the network is subtle: crisp enough to be seen when you look for it, never a wire-mesh. Contrast target: 5–8 % luminance, edge softness ~10 µm.
- Scale: scattered fine white flakes 50–200 µm (10–40 px), ~1–3 % coverage on normal skin, denser (10–20 % coverage in a 0.5 mm ring) around a crusted lesion (img 19, 01a).

### Vessels (img 08)
- Normal cheek shows unfocused linear branching vessels in ~half of subjects: pale pink-purple ((238,185,166) on (225,181,158)), 50–100 µm wide, blurred (they lie 100–200 µm deep), forming a sparse dendritic pattern with 1–2 mm branch lengths. Keep contrast under 8 %. Around an inflamed lesion they get slightly more visible and more numerous (img 10).

---

## (d) Lighting and camera character

- **Illumination geometry:** the LED ring surrounds the lens, so the field is lit nearly coaxially from a ring ~10–15 mm in diameter at ~10–20 mm distance. Consequences seen in the references: (1) radial brightness gradient — with the DL contact frames (img 04, 05, 06) the **periphery is brighter** than the centre (corner (252,235,215) vs centre (196,178,156) in img 05, up to +25 %; img 06 has a bright band at the top-left edge), and the extreme corners blow out toward warm white; (2) glossy surfaces show a **ring or arc** of glare (sebum film: broad soft ring segments 0.3–0.6 mm wide; hair shafts: a highlight line; taut pustule head: a compact dot/arc); (3) almost no cast shadows anywhere — hairs, scale and the crust lip produce only a 1–2 px dark contact line.
- **Non-polarised, no fluid (the DL1 case):** expect the macro look of img 15/16 rather than the fluid look of img 08 — skin-line ridges glint, sebum sheen on the dome, pore interiors slightly dark, pigment structures a little washed out by surface reflection. With a glass contact plate pressed on, the glints flatten into a broader sheen and blanching (paler, less red) appears where pressure is applied — subtle in the centre, can be used as a small idle animation cue.
- **Colour cast:** DermLite LEDs are cool-white; iPhone auto-white-balance pulls the frame back to neutral-warm. Net: base skin lands slightly warm (R−B ≈ 60–75), highlights are neutral-to-cool white (img 05 corners (252,235,215); img 08 white lines (255,214,195)). Do not add the heavy orange cast of img 10 or the flash-yellow of img 17.
- **Depth of field:** shallow — ~0.3–0.5 mm. The skin surface is in focus; hairs arching 0.2–0.5 mm above it are visibly soft (img 01d, 05); the top of a 0.4 mm papule/pustule dome can be a touch softer than the surrounding flat skin if the plate is focused on the base (img 01d head has slightly softer detail than the skin).
- **Resolution / softness:** even a sharp DL frame resolves ~10–15 µm features at best; the finest detail (scale edges, hair edges) is 2–3 px soft at 5 µm/px. Nothing should be pixel-sharp.
- **Noise and compression:** phone frames show mild luminance noise (σ ≈ 2–3 levels) and slight chroma smoothing in the darker red areas (img 20 and 19 show blocky chroma in the reds). A little blue-channel noise in the darkest pore interiors is realistic.
- **Vignette shape:** circular field edge with a soft dark rim (the DL housing) outside the illuminated disc (img 04–09 show the rounded rectangle/circle fade at the frame corners).

---

## (e) Top 10 things that make it look real vs fake (ordered by impact)

1. **No outlines on inflammation.** The papule/pustule halo is a soft, blotchy red *field* (edge width ≥ 0.7 mm) modulated by the pseudonetwork; the only hard edges in the whole sequence are the pustule head (60 µm), the follicular dot (sharp) and the crust (< 20 µm). (img 01c, 01d, 19)
2. **The red comes from below the texture.** Skin lines, scale and hairs keep their own colour on top of the erythema; the red is a ground-layer tint that intensifies at the dome's rim where light path length through tissue is longest. (img 01c, 19, 16)
3. **Pustule head is ivory, not white, and less saturated than everything around it**, with an off-centre yellow-ochre core and a thin darker ring just outside the head. (img 01d, 19)
4. **Vellus hairs are translucent tan, 6–12 px wide, with a bright edge line, no shadow, and they cross straight over the lesion** — many hairs, mostly one direction, some out of focus where they lift. (img 05, 08, 01d, 16)
5. **Pores on a regular-but-jittered ~1 mm grid, some ringed in brown**, one or two plugged dark; the hero lesion grows out of one of these, so the pore grid must exist before the lesion does. (img 06, 07, 20)
6. **Ring-light signature:** brighter periphery, a soft ring/arc of sheen on the dome and a compact dot on the pus head, short glints along skin-line ridges, no cast shadows. (img 05, 15, 16)
7. **Pseudonetwork pigment mottling at two scales** — a soft tan mesh with pale 300–500 µm follicular holes plus 1–3 mm darker patches — instead of uniform skin colour or high-frequency noise. (img 04, 07)
8. **Crust is two-toned and chunky:** maroon-black haemorrhagic parts next to ochre serum parts, lobulated edge with a lip, wet-phase micro-glints that go matte, and a ring of lifting white scale around it. (img 19, 17)
9. **Healed mark is mauve, flat and larger than the papule**, with the skin lines running through it and a slightly paler centre. Red-violet, not the red-pink of the peak. (img 20)
10. **Softness and noise of a phone through optics:** everything 2–3 px soft, mild luma noise, slight chroma blockiness in the reds, shallow DOF. Perfectly crisp procedural detail reads as CG instantly. (img 01, 20)

---

## Quick colour table (sRGB, FST III–IV cheek, DL1-style exposure)

| Element | Colour | Notes / derived from |
|---|---|---|
| Base skin | (205,168,135) | img 06/07/04/20 |
| Pseudonetwork strand | (185,140,105) | img 07 |
| Follicular hole (pale) | (215,178,145) | img 07 |
| Darker pigment patch | (190,145,100) | img 04 |
| Pore interior | (185,150,124) | img 06 p2 |
| Brown circle around pore | (195,153,132) | img 06 |
| Open comedone plug | (85,45,30) | img 02, 13, 20 |
| Vellus hair shaft | (180,155,125), alpha ~0.6 | img 05, 08, 11 |
| Terminal hair | (120,80,60) | img 04, 01 |
| Skin-line glint (no fluid) | +25 luma over local | img 16, 15 |
| White scale flake | (240,225,210) | img 01a, 08, 19 |
| Closed comedo dome | base +6R +4G −6B | img 01a, 13 |
| Papule core (annulus) | (198,120,112) | img 01c, 19 |
| Papule halo mid | (200,140,125) | img 01c |
| Central crusted follicle dot | (145,32,36) | img 01c, 15 |
| Pustule head rim (ivory) | (228,222,210) | img 01d relative to base |
| Pustule core (pus) | (215,190,140) → ageing to (189,147,105) | img 01d, 19 |
| Dark ring at head edge | (175,105,105) | img 01d p2 |
| Peak erythema halo | (195,125,125) | img 01d, 19 |
| Fresh serum crust (wet) | (185,144,107), glossy | img 19 |
| Haemorrhagic crust | (98,18,27) | img 19, 17 |
| Dry crust body | (150,85,70) with (112,39,30) streaks | img 17 |
| Pink rim around crust | (214,148,150) | img 17 |
| PIE mark (day 17) | (175,125,128) | img 20 |
| PIE mark (day 21) | (190,142,132) | img 20, halved contrast |
| Vessel (unfocused) | local +8 R, −5 G, blurred | img 08, 10 |
| Ring-light periphery | base ×1.15–1.25, toward (252,235,215) | img 05 |
