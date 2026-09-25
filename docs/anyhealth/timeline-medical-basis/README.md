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
- **Physis not modelled.** A 6-year-old's proximal humerus has an open growth plate. The atlas humerus is one fused adult bone, so the break is placed by fraction of length (0.21 from the shoulder end) rather than relative to the physis.
- **Scoliosis moves parts rigidly.** T1–T6 and their disks shift, tilt and turn as whole parts. Ribs 1–6 only shift with their vertebra: they do not rotate into a rib hump. The costal cartilages and sternum stay put, so at the apex (≈4.5 mm) the rib ends can separate slightly from their cartilages. Vertebral wedging is not modelled.

## Illustrative effects

Effects that are stylized rather than literal anatomy (`illustrative: true` on the issue script, shown with an "Illustrative" tag in the tracker). Filled in by each area's agent as scripts are written:

*(none yet — populated by the area tasks)*

### bones

- **`scoliosis-upper-thoracic-2025`** (`illustrative: true`). The record has no imaging, so the angle (10° Cobb), side (right-convex), apex (T3–T4), axial rotation and 2020–2025 development are typical values from the literature. They are not measured on this patient (see [bones.md](bones.md)).
- **Fracture clot and callus lumps** (`left-humerus-fracture-2009`). The fragment displacement and the callus extent come from the films. The hematoma is drawn as two soft translucent ellipsoids (≈4 × 6 cm), and the callus lumps are a seeded random pattern: both are stylized. The script is not flagged illustrative because the break itself is literal.
