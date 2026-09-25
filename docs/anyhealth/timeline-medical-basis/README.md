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

### eyes-teeth

- **Tooth eruption over growth** (`issues/teeth/eruption.ts`, `eruptionFx`): each of the 28 atlas permanent teeth is hidden until it (or, at incisor, canine and premolar sites, its primary predecessor) erupts. The primary teeth are the permanent meshes at 0.7 scale, with the primary first and second molars standing in at the premolar sites, although real primary molars are wider than premolars. Every eruption is a 6 mm occlusal rise plus a 0.6 → 1 scale, visible from half-way, so the primary → permanent swap passes through a gap with no tooth there.
- **Third molars** are clones of the second molars (0.9 scale), set one tooth-width + 1 mm distal along the arch. They are not real third-molar anatomy. #1's partial impaction is shown as a crown stopped at 60% eruption. The clones ride the `head` segment as one rigid piece.
- **Fillings** tint the whole tooth. The atlas has no per-surface mesh, so an occlusal, buccal or DO/MO restoration can't be localised.
- **Socket healing** tints the whole upper and lower gingiva (one mesh per jaw), not four socket sites.
- **Myopia** is a z-only (front-to-back) scale of every globe part about the globe centre. The lens and cornea are stretched with it, although real axial myopia is mostly vitreous-chamber elongation. The model's globe is 27.2 mm long (a real adult eye is ~23–24 mm), and the 0.35 mm is added in model space.
- **Exotropia** turns the whole left globe rigidly about its centre. The extraocular muscles and optic nerve do not follow.

## Illustrative effects

Effects that are stylized rather than literal anatomy (`illustrative: true` on the issue script, shown with an "Illustrative" tag in the tracker). Filled in by each area's agent as scripts are written:

*(none yet — populated by the area tasks)*

### eyes-teeth

- `first-cavity-filling-tooth-3`, `fillings-teeth-30-31-composite`, `city-creek-fillings-30-31`: a whole-tooth composite tint (slightly whiter and bluish), not the filled surfaces. The 2024 refill tints #30 and #31 brighter.
- `wisdom-teeth-extraction`: the third molars are cloned, scaled second molars (the atlas has none), and the socket healing is a 6-week tint on the whole gingiva.
- Tooth eruption (`eruptionFx`, not a script): the primary teeth are 0.7-scale stand-ins, and the rise-and-grow animation is stylised.
