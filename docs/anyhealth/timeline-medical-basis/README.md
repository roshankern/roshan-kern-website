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

### systemic

- **No blood, mucosa or immune tissue to animate.** Red-cell size, IgE sensitisation and mucosal edema have no mesh. Thalassemia is shown as a tint on the 426 arterial part names (639 parts) and, for each CBC, on the heart walls and aorta. Food allergy is a tint on `Tongue` and `Lip`. Rhinitis is a swell of the inferior nasal conchae (bony parts standing in for their mucosa).
- **No subglottic lumen.** Anaphylactic subglottic narrowing is a banded negative swell on the top ~25 mm of the `Trachea` mesh (rest y 1.449–1.474 m), just below the cricoid. It adds to the airway area's croup/subglottitis narrowing of the same part.
- **Immunotherapy start is uncertain.** The record prepared shot extracts in 2022, but a December 2023 note still lists immunotherapy as only being considered. The model uses the 2022-08-01 start.

## Illustrative effects

Effects that are stylized rather than literal anatomy (`illustrative: true` on the issue script, shown with an "Illustrative" tag in the tracker). Filled in by each area's agent as scripts are written:

*(none yet — populated by the area tasks)*

### systemic

Every systemic script is illustrative (see [systemic.md](systemic.md)):

- **Beta-thalassemia minor** (chronic from 2004-07-01): a pale, orange-shifted tint on every arterial part for small, hypochromic red cells. It steps up slightly at the 2024-05-20 confirmation, which marks certainty, not worsening.
- **CBC / hematology / Function Health visits:** 30-day windows with a stronger tint on the heart walls and aorta, rising and falling over 7 days.
- **Food allergy** (chronic from 2003-12-22): a faint red on the tongue and lip. The 2004 workup and the 2016 IgE panel add a 14-day glow (the panel also on the nasal conchae), and so does the 2022 re-evaluation (conchae).
- **Egg anaphylaxis 2005 / walnut exposure 2026:** stylized angioedema: tongue and lip enlarge, the pharyngeal constrictors and epiglottis swell, and the subglottic trachea narrows. Egg peaks in ~30 min and clears by day 2. Walnut is the same pattern at 40%, gone by day 1. The magnitudes are visible stand-ins, not measurements.
- **Allergic rhinitis** (chronic from 2016-07-11): the inferior conchae swell with a perennial base plus spring and late-summer pollen pulses, as a pure function of the calendar date. Immunotherapy halves the pulse linearly over 2022-08-01 → 2025-08-01.
