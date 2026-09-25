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
