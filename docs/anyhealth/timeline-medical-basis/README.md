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

### skin

- **One coarse Skin mesh at 10% opacity.** The Skin is a single part (about 45k triangles, mean edge 1.5 cm) drawn translucent, so skin issues can't be tinted in place. Every lesion, cut, suture and scar is a small opaque custom mesh (`issues/skin/marks-layer.ts`). Each one is projected onto the closest point of the rest Skin and lifted 0.3 mm along the normal. It carries the `seg` weights of the Skin vertex under it, so it warps with the skin.
- **Mark size vs body scale.** Mark sizes are physical at the time of the issue. The layer divides them by the local warp scale at the mark's segment on that date: body scale × the segment's length factor along its axis and soft-girth factor across it, blended over the Skin vertex's two segments like the warp. So a mark is life-size on the issue date and grows with the body afterwards, as scars do. Height uses the girth factor. Mark placement within a cluster is anatomy-relative (rest space).
- **Onset dates.** The chin wound is already 3 days old on its record date, a follow-up call (`LEAD_DAYS`; skin.md `chin-lead`). The ER date isn't recorded, so the lead is an assumption. Eczema starts at the 4-month record (the allergist's history says about 1 month). Cradle cap first shows at the 2-month visit, where the record first notes it.
- **Buried sutures are shown.** The shin's 4 deep chromic-gut sutures are drawn 1.5 mm under the translucent skin and fade as they absorb. In life they are invisible.
- **Acne drawn twice during isotretinoin.** Both the acne and isotretinoin layers draw the same seeded lesions, scars and PIH with the same look: the acne layer throughout, the isotretinoin layer during its course. Isolating either one shows the lesions clearing. When both are visible, the copies coincide and the marks' strict depth test drops the second.
- **Isotretinoin response curve is a proxy.** The course-day lesion curve (skin.md `isotretinoin-response`) uses IGA percentage reductions at weeks 8 and 12 as stand-ins for lesion counts. They come from a low-dose micronized isotretinoin study in severe nodular acne. This course was 40 → 80 mg/day for comedonal and inflammatory acne, so its real curve may differ. The end point (no active lesions on 2022-06-28) is from the record.
- **Wart and palm sites.** The warts' site is unrecorded, so they go on the left hand (the anchor). Palm vesicle flares start at age 2 on the right palm (the anchor). The record only names dyshidrotic eczema in 2022 and doesn't say when the palm became involved.

## Illustrative effects

Effects that are stylized rather than literal anatomy (`illustrative: true` on the issue script, shown with an "Illustrative" tag in the tracker). Filled in by each area's agent as scripts are written:

*(none yet — populated by the area tasks)*

### skin

- **Chin laceration** (`illustrative: true`). The record has no suture count or length. The script uses a typical 2 cm cut with 4 nylon sutures, out on day 5 (skin.md `facial-laceration-length`, `suture-spacing`, `suture-removal-face`).
- **Isotretinoin lip dryness** (`illustrative: true`). A tint on `Lip` stands in for cheilitis (skin.md `isotretinoin-cheilitis`).
- **Stylized sub-effects in otherwise record-based scripts:**
  - the eczema flare timing (seeded, and no flare dates are recorded);
  - the cradle-cap yellow tint on `Hair of head`;
  - the suture thread width (0.3 mm, wider than real 5-0/6-0 thread);
  - the direction of each cut (the shin along the tibia, the face cuts horizontal).
