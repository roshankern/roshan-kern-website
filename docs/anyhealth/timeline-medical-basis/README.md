# AnyHealth timeline: medical basis

Every medical number used in `app/anyhealth/timeline/**` code carries a comment `// basis: <area>#<key>` (for example `// basis: airway#croup-duration`). That key names a row in the matching area file below, and the row gives the value actually used, why it was chosen, and a full citation with a URL. This doc is the paper trail for anyone checking a number against the source; it is not read by any script.

## Area files

| Area | File | Covers |
|---|---|---|
| Growth | [growth.md](growth.md) | Stature/weight interpolation, segment proportions, Scammon organ curves, girth |
| Bones | [bones.md](bones.md) | Fracture healing timeline, scoliosis |
| Airway | [airway.md](airway.md) | Laryngomalacia, croup, asthma, COVID |
| Digestive | [digestive.md](digestive.md) | Encopresis, LPR, GERD |
| Eyes & teeth | [eyes-teeth.md](eyes-teeth.md) | Exotropia, myopia, tooth eruption, fillings, wisdom teeth |
| Skin | [skin.md](skin.md) | Lacerations, acne, eczema, warts |
| Systemic | [systemic.md](systemic.md) | Thalassemia, food allergy, anaphylaxis, rhinitis |

## Row format

Each area file is one table:

| key | value | rationale | source |
|---|---|---|---|
| `example-key` | the number or range used in code | why this value, and why it applies here | full citation with a URL |

`key` is lowercase, hyphenated, unique within its file — it's the exact string that follows `#` in a `// basis:` comment. `value` is the literal number, formula or range as used in code (with units). `rationale` explains the choice: why this source, why it fits this case (age, growth stage, chronicity), and any adjustment made to fit the model. `source` is a full citation (authors/organization, title, year) with a URL, not just a bare link.

## Model gaps and approximations

The atlas is one adult male reference model (BodyParts3D), so some anatomy the timeline would otherwise animate is missing or simplified:

- **Lung parenchyma absent** — the respiratory system model is the bronchial tree only (trachea, main bronchi and branches); there is no alveolar lung tissue to swell or tint.
- **Liver: caudate lobe only** — the liver mesh covers the caudate lobe and ducts, not the full four-lobe organ, so liver-relative growth effects (relatively larger in infancy) apply only to that geometry.
- **No sigmoid colon** — the descending colon mesh ends before the sigmoid segment; digestive effects that would sit there (e.g. encopresis dilation) are shown on the rectum and descending colon instead.
- **No brain hemispheres** — the model has no cerebral cortex mesh, so neural (Scammon) growth is shown only through the cranial/head region warp, not a brain organ.
- **No third molars** — wisdom-tooth issues add small custom meshes (cloned, scaled second molars) rather than animating an existing part.
- **Adult-only dentition** — the atlas ships one adult tooth set; primary (baby) teeth before eruption are shown as scaled-down stand-ins on the same sockets, noted as illustrative.

### bones

- **Fracture on an adult humerus.** The 2009 break is cut into the adult atlas humerus in rest space. The fragments, caps, callus and clot then ride the `lUpperArm` segment warp, so they scale with the 6-year-old arm. Each fragment's pose is applied before the warp. The pose pivots at the rest shoulder and elbow ends of the bone, not at a child-sized skeleton's joints, but the displacements are millimetres, so the error is negligible.
- **Fracture meshes use one fixed segment.** The fragments, caps, callus and clot all warp with the fixed `lUpperArm` segment (weight 1). The atlas humerus blends trunk and upper-arm weights near the shoulder, so during childhood warp a slight seam is possible where the head fragment meets the shoulder.
- **Physis not modelled.** A 6-year-old's proximal humerus has an open growth plate. The atlas humerus is one fused adult bone, so the break is placed by fraction of length (0.21 from the shoulder end) rather than relative to the physis.
- **Scoliosis moves parts rigidly.** T1–T6 and their disks shift, tilt and turn as whole parts. Ribs 1–6 only shift with their vertebra: they do not rotate into a rib hump. The costal cartilages and sternum stay put, so at the apex (≈4.5 mm) the rib ends can separate slightly from their cartilages. Vertebral wedging is not modelled.

### airway

- **No subglottis part.** Croup narrowing is drawn as a `swellBand` on the `Trachea`, covering the 2 cm below the cricoid's lower edge. The true subglottis also runs inside the cricoid ring, which is cartilage in the atlas and does not swell.
- **Swell pushes along the mesh normals.** The trachea and bronchi are surface meshes, so a negative swell draws the tube narrowing. It does not model the mucosa thickening into a separate lumen. The mm values are set on the adult rest mesh, and the body warp scales them with the child.
- **Laryngomalacia on the epiglottis only.** The atlas has no aryepiglottic-fold or supraglottic mucosa mesh, so the curl and posterior tilt of the `Epiglottis` carry the whole sign.
- **Asthma and COVID live on the bronchial trees**, since there is no lung parenchyma. Asthma swells and tints all 22 respiratory `/bronch/i` names (100 parts). Small-airway disease below the segmental level is not modelled.
- **Recurrent croup dates.** The record gives counts, not dates, for most episodes ("about 3 each winter"). Those episodes are spread with a seeded PRNG across October–March. Documented episodes with only a month use the 15th. See `airway.md#croup-winter`.

### eyes-teeth

- **Tooth eruption over growth** (`issues/teeth/eruption.ts`, `eruptionFx`): each of the 28 atlas permanent teeth is hidden until it (or, at incisor, canine and premolar sites, its primary predecessor) erupts. The primary teeth are the permanent meshes at 0.7 scale, with the primary first and second molars standing in at the premolar sites, although real primary molars are wider than premolars. Every eruption is a 6 mm occlusal rise plus a 0.6 → 1 scale, visible from emergence (the start of the ADA window). The stand-in is shed the mean toothless period before its successor emerges (Nyström & Peck: 2 weeks to 4 months for incisors and canines, days for premolars), without the large individual variation.
- **Third molars** are clones of the second molars (0.9 scale), set one tooth-width + 1 mm distal along the arch. They are not real third-molar anatomy. #1's partial impaction is shown as a crown stopped at 60% eruption. The clones ride the `head` segment as one rigid piece.
- **Fillings** tint the whole tooth. The atlas has no per-surface mesh, so an occlusal, buccal or DO/MO restoration can't be localised.
- **Socket healing** tints the whole upper and lower gingiva (one mesh per jaw), not four socket sites.
- **Myopia** is a z-only (front-to-back) scale of every globe part about the globe centre. The lens and cornea are stretched with it, although real axial myopia is mostly vitreous-chamber elongation. The model's globe is 27.2 mm long (a real adult eye is ~23–24 mm), and the 0.35 mm is added in model space.
- **Exotropia** turns the whole left globe rigidly about its centre. The extraocular muscles and optic nerve do not follow.

### skin

- **One coarse Skin mesh at 10% opacity.** The Skin is a single part (about 45k triangles, mean edge 1.5 cm) drawn translucent, so skin issues can't be tinted in place. Every lesion, cut, suture and scar is a small opaque custom mesh (`issues/skin/marks-layer.ts`). Each one is projected onto the closest point of the rest Skin and lifted 0.3 mm along the normal. It carries the `seg` weights of the Skin vertex under it, so it warps with the skin.
- **Mark size vs body scale.** Mark sizes are physical at the time of the issue. The layer divides them by the local warp scale at the mark's segment on that date: body scale × the segment's length factor along its axis and soft-girth factor across it, blended over the Skin vertex's two segments like the warp. So a mark is life-size on the issue date and grows with the body afterwards, as scars do. Height uses the girth factor. Mark placement within a cluster is anatomy-relative (rest space).
- **Onset dates.** The chin wound is already 3 days old on its record date, a follow-up call (`LEAD_DAYS`; skin.md `chin-lead`). The ER date isn't recorded, so the lead is an assumption. Eczema starts at the 4-month record (the allergist's history says about 1 month). Cradle cap first shows at the 2-month visit, where the record first notes it.
- **Buried sutures are shown.** The shin's 4 deep chromic-gut sutures are drawn 1.5 mm under the translucent skin and fade as they absorb. In life they are invisible.
- **Acne drawn twice during isotretinoin.** Both the acne and isotretinoin layers draw the same seeded lesions, scars and PIH with the same look: the acne layer throughout, the isotretinoin layer during its course. Isolating either one shows the lesions clearing. When both are visible, the copies coincide and the marks' strict depth test drops the second.
- **Isotretinoin response curve is a proxy.** The course-day lesion curve (skin.md `isotretinoin-response`) uses IGA percentage reductions at weeks 8 and 12 as stand-ins for lesion counts. They come from a low-dose micronized isotretinoin study in severe nodular acne. This course was 40 → 80 mg/day for comedonal and inflammatory acne, so its real curve may differ. The end point (no active lesions on 2022-06-28) is from the record.
- **Wart and palm sites.** The warts' site is unrecorded, so they go on the left hand (the anchor). Palm vesicle flares start at age 2 on the right palm (the anchor). The record only names dyshidrotic eczema in 2022 and doesn't say when the palm became involved.

### digestive

- **Rectum dilation pivot.** The brief asks for a scale about the rectum's centre. That drives the posterior wall about 7 mm into the `Sacrum`, which sits 1.2 mm behind it at rest. So the scale pivots instead on the anorectal end (min y), the posterior wall (min z) and the midline (centre x). The ampulla then dilates up and forward into the soft `Urinary bladder`, `Prostate` and seminal vesicles (up to about 9 mm of overlap at the peak), which is what a loaded rectum actually does. It doesn't dilate back through bone or down through the pelvic floor. A check guards this.
- **Descending colon uses swell, not scale.** The mesh curves medially into the rectum (its bounds are 13.5 cm wide in x), so scaling about the bounds centre would pull its two limbs apart. A 1.7 mm swell along the normals widens the tube in place. Its lateral wall already touches `Left external oblique` and `Left iliacus` at rest, so any dilation adds a little overlap there.
- **No sigmoid colon.** The sigmoid–rectum dilation, which is the largest in constipation, is carried by `Rectum` alone.
- **LPR sits on the esophagus.** LPR findings are laryngeal and hypopharyngeal (oedema and erythema). The model shows them as a tint on the whole `Esophagus` plus a swell in its top 5 cm.
- **Tint is per part.** GERD's "distal esophagus" tint colours the whole `Esophagus`, because PartFx has no banded tint (`swellBand` only weights swell).
- **LPR fade is shorter than the evidence.** LPR fades over 12 weeks (the brief's upper bound), but laryngoscopic findings usually resolve over 6 months or more (Belafsky 2001).

### systemic

- **No blood, mucosa or immune tissue to animate.** Red-cell size, IgE sensitisation and mucosal edema have no mesh. Thalassemia is shown as a tint on the 426 arterial part names (639 parts) and, for each CBC, on the heart walls and aorta. Food allergy is a tint on `Tongue` and `Lip`. Rhinitis is a swell of the inferior nasal conchae (bony parts standing in for their mucosa).
- **No subglottic lumen.** Anaphylactic subglottic narrowing is a banded negative swell on the top ~25 mm of the `Trachea` mesh (rest y 1.449–1.474 m), just below the cricoid. It adds to the airway area's croup/subglottitis narrowing of the same part.
- **Immunotherapy start is uncertain.** The record prepared shot extracts in 2022, but a December 2023 note still lists immunotherapy as only being considered. The model uses the 2022-08-01 start.

## Illustrative effects

Effects that are stylized rather than literal anatomy (`illustrative: true` on the issue script, shown with an "Illustrative" tag in the tracker). Filled in by each area's agent as scripts are written:

*(none yet — populated by the area tasks)*

### bones

- **`scoliosis-upper-thoracic-2025`** (`illustrative: true`). The record has no imaging, so the angle (10° Cobb), side (left-convex, the classic side of a proximal thoracic curve; the side is uncertain because no imaging exists), apex (T3–T4), axial rotation and 2020–2025 development are typical values from the literature. They are not measured on this patient (see [bones.md](bones.md)).
- **Fracture clot and callus lumps** (`left-humerus-fracture-2009`). The fragment displacement and the callus extent come from the films. The hematoma is drawn as two soft translucent ellipsoids (≈4 × 6 cm), and the callus lumps are a seeded random pattern: both are stylized. The script is not flagged illustrative because the break itself is literal.

### airway

- **COVID-19 (2020-08-28)** (`illustrative: true`): a patchy warm tint on a deterministic 40% of the segmental bronchial trees for 14 days. It stands in for a lung infection the model has no parenchyma to show.
- **Not flagged, but partly stylized:**
  - The seeded winter croup dates (the counts come from the record, the days do not).
  - The laryngomalacia curl angle.
  - The blue highlight tints marking the bronchoscopy, spirometry, re-evaluation and budesonide windows.

### eyes-teeth

- `first-cavity-filling-tooth-3`, `fillings-teeth-30-31-composite`, `city-creek-fillings-30-31`: a whole-tooth composite tint (slightly whiter and bluish), not the filled surfaces. The 2024 refill tints #30 and #31 brighter.
- `wisdom-teeth-extraction`: the third molars are cloned, scaled second molars (the atlas has none), and the socket healing is a 6-week tint on the whole gingiva.
- Tooth eruption (`eruptionFx`, not a script): the primary teeth are 0.7-scale stand-ins, and the rise-and-grow animation is stylised.

### skin

- **Chin laceration** (`illustrative: true`). The record has no suture count or length. The script uses a typical 2 cm cut with 4 nylon sutures, out on day 5 (skin.md `facial-laceration-length`, `suture-spacing`, `suture-removal-face`).
- **Isotretinoin lip dryness** (`illustrative: true`). A tint on `Lip` stands in for cheilitis (skin.md `isotretinoin-cheilitis`).
- **Stylized sub-effects in otherwise record-based scripts:**
  - the eczema flare timing (seeded, and no flare dates are recorded);
  - the cradle-cap yellow tint on `Hair of head`;
  - the suture thread width (0.3 mm, wider than real 5-0/6-0 thread);
  - the direction of each cut (the shin along the tibia, the face cuts horizontal).

### digestive

- **Encopresis: faecal-loading tint** (dark brown on `Rectum` and `Descending colon`). The dilation itself is cited (Hamdy 2023, Sharif 2021), so this script is not flagged `illustrative`. Only the tint colour and amount are stylized.
- **Silent reflux (LPR)** — `illustrative: true`. A red tint and an upper-band swell on the esophagus stand in for laryngeal findings.
- **GERD 2026** — `illustrative: true`. Non-erosive reflux, so no mucosal change would actually be visible. The tint on the whole esophagus and the mild tint on the stomach are symbolic.
- **Famotidine nightly** — `illustrative: true`. A very low residual tint, marking reflux that is being controlled.

### systemic

Every systemic script is illustrative (see [systemic.md](systemic.md)):

- **Beta-thalassemia minor** (chronic from 2004-07-01): a pale, orange-shifted tint on every arterial part for small, hypochromic red cells. It steps up slightly at the 2024-05-20 confirmation, which marks certainty, not worsening.
- **CBC / hematology / Function Health visits:** 30-day windows with a stronger tint on the heart walls and aorta, rising and falling over 7 days.
- **Food allergy** (chronic from 2003-12-22): a faint red on the tongue and lip. The 2004 workup and the 2016 IgE panel add a 14-day glow (the panel also on the nasal conchae), and so does the 2022 re-evaluation (conchae).
- **Egg anaphylaxis 2005 / walnut exposure 2026:** stylized angioedema: tongue and lip enlarge, the pharyngeal constrictors and epiglottis swell, and the subglottic trachea narrows. Egg peaks in ~30 min and clears by day 2. Walnut is the same pattern at 40%, gone by day 1. The magnitudes are visible stand-ins, not measurements.
- **Allergic rhinitis** (chronic from 2016-07-11): the inferior conchae swell with a perennial base plus spring and late-summer pollen pulses, as a pure function of the calendar date. Immunotherapy halves the pulse linearly over 2022-08-01 → 2025-08-01.
