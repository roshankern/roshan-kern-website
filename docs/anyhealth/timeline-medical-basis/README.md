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

### digestive

- **Rectum dilation pivot.** The brief asks for a scale about the rectum's centre. That drives the posterior wall about 7 mm into the `Sacrum`, which sits 1.2 mm behind it at rest. So the scale pivots instead on the anorectal end (min y), the posterior wall (min z) and the midline (centre x). The ampulla then dilates up and forward into the soft `Urinary bladder`, `Prostate` and seminal vesicles (up to about 9 mm of overlap at the peak), which is what a loaded rectum actually does. It doesn't dilate back through bone or down through the pelvic floor. A check guards this.
- **Descending colon uses swell, not scale.** The mesh curves medially into the rectum (its bounds are 13.5 cm wide in x), so scaling about the bounds centre would pull its two limbs apart. A 1.7 mm swell along the normals widens the tube in place. Its lateral wall already touches `Left external oblique` and `Left iliacus` at rest, so any dilation adds a little overlap there.
- **No sigmoid colon.** The sigmoid–rectum dilation, which is the largest in constipation, is carried by `Rectum` alone.
- **LPR sits on the esophagus.** LPR findings are laryngeal and hypopharyngeal (oedema and erythema). The model shows them as a tint on the whole `Esophagus` plus a swell in its top 5 cm.
- **Tint is per part.** GERD's "distal esophagus" tint colours the whole `Esophagus`, because PartFx has no banded tint (`swellBand` only weights swell).
- **LPR fade is shorter than the evidence.** LPR fades over 12 weeks (the brief's upper bound), but laryngoscopic findings usually resolve over 6 months or more (Belafsky 2001).

## Illustrative effects

Effects that are stylized rather than literal anatomy (`illustrative: true` on the issue script, shown with an "Illustrative" tag in the tracker). Filled in by each area's agent as scripts are written:

*(none yet — populated by the area tasks)*

### digestive

- **Encopresis: faecal-loading tint** (dark brown on `Rectum` and `Descending colon`). The dilation itself is cited (Hamdy 2023, Sharif 2021), so this script is not flagged `illustrative`. Only the tint colour and amount are stylized.
- **Silent reflux (LPR)** — `illustrative: true`. A red tint and an upper-band swell on the esophagus stand in for laryngeal findings.
- **GERD 2026** — `illustrative: true`. Non-erosive reflux, so no mucosal change would actually be visible. The tint on the whole esophagus and the mild tint on the stomach are symbolic.
- **Famotidine nightly** — `illustrative: true`. A very low residual tint, marking reflux that is being controlled.
