# Programmable Mind State — 2026 Baseline Sourcing

The evidence behind every 2026 cell in the Programmable Mind State matrix. `data.ts` holds the scores and the one-to-two-line rationale the figure displays; this file holds the citations those lines compress, plus the caveats that did not fit.

Researched August 2026. Ten parallel agents, one per technology, each asked to justify the existing 1–10 score against the strongest available evidence — pivotal trials, meta-analyses, registry data, regulatory actions, and cost figures — rather than to rescore it. Where the evidence and the score disagreed, the agent wrote to the evidence and flagged the conflict instead of silently moving the number. No score changed in this pass.

Citations in the figure are parenthetical author-year. Organization-year (`FDA 2026`, `Takeda 2025`) appears only where no peer-reviewed publication exists — company toplines, regulatory actions, and pricing.

See `timeline-research.md` for the 2027–2036 projections and the scoring convention table (higher is always better for the technology).

---

## Deep brain stimulation — 2026 baseline notes

### Sources
- Okun MS, Bowers D, Springer U, et al. (2004). What's in a "smile"? Intra-operative observations of contralateral smiles induced by deep brain stimulation. Neurocase. — supports magnitude: acute mood/mirth elevation from VC/VS stimulation.
- Butson CR & McIntyre CC (2008). Current steering to control the volume of tissue activated during deep brain stimulation. Brain Stimulation, 1(1):7-14. — supports steerability: current spreads through a fixed, electrically indiscriminate volume of tissue.
- Alonso P, Cuadras D, Gabriels L, et al. (2015). Deep Brain Stimulation for Obsessive-Compulsive Disorder: A Meta-Analysis of Treatment Outcome and Predictors of Response. PLOS ONE, 10(7):e0133591. — supports reliability: ~60% global OCD responder rate across 31 studies.
- Dougherty DD, Rezai AR, Carpenter LL, et al. (2015). A Randomized Sham-Controlled Trial of Deep Brain Stimulation of the Ventral Capsule/Ventral Striatum for Chronic Treatment-Resistant Depression. Biological Psychiatry, 78(4):240-248. — supports reliability: blinded VC/VS depression trial, 20% active vs 14.3% sham response, no significant separation.
- Holtzheimer PE, Husain MM, Lisanby SH, et al. (2017). Subcallosal cingulate deep brain stimulation for treatment-resistant depression: a multisite, randomised, sham-controlled trial. Lancet Psychiatry, 4(11):839-849. — supports reliability: blinded SCC depression trial, 20% (12/60) active vs 17% (5/30) sham response, missed primary endpoint at 6 months.
- Medtronic (2025). Medtronic earns U.S. FDA approval for the world's first Adaptive deep brain stimulation system for people with Parkinson's. Medtronic press release, Feb 24, 2025. — supports durability: BrainSense Adaptive DBS approval and installed base of 40,000+ Percept patients.
- Systematic review of intracranial hemorrhage in DBS (2024), Journal of Neurosurgery 141(2):381, and single/multi-center hardware-complication series (2022-2024). — supports safety: ~1.6-2.9% symptomatic ICH per lead, ~4% infection, ~5% revision rates.
- Deep brain stimulation adverse-event reports for hypomania/mania in STN-DBS cohorts (postoperative rates 0.9-4%) and depression-target trials. — supports safety: stimulation-induced hypomania incidence.
- Reviews of microlesion effect and stimulation washout kinetics (2021), ScienceDirect/Brain. — supports reversibility: rapid symptom washout on stimulation cessation, distinct from surgical explant risk.
- Superolateral medial forebrain bundle DBS "gateway trial" (Neuropsychopharmacology, 2019). — supports speed: acute (seconds-hours) vs chronic (days-weeks) latency split between motor and psychiatric effects.
- FDA Humanitarian Device Exemption approval for Reclaim DBS Therapy for OCD, Feb 19, 2009; Abbott TRANSCEND and Medtronic/Abbott FORESEE III depression IDE trial announcements (2025-2026). — supports regulation: OCD-only HDE status, depression still investigational.
- Global Economic Evaluation of the Reported Costs of Deep Brain Stimulation, Stereotactic and Functional Neurosurgery, 102(4):257 (2024); US DBS pricing surveys (2026). — supports cost: $35-100k+ per-patient US surgical cost.

### Caveats
- None of the 12 scores are contradicted by the evidence found; all existing values are consistent with current literature as of August 2026.
- Minor sourcing note: the baseline note's trial acronyms ("BROADEN, RECLAIM") could not be cleanly verified against the correct trial names for the VC/VS (Dougherty et al. 2015) vs SCC (Holtzheimer et al. 2017) studies, so the replacement note cites first-author+year directly instead of the acronyms to avoid a possible mislabeling.
- Hypomania rate range (4-7%) is drawn from mixed cohorts (STN-DBS Parkinson's data plus depression/OCD trial arms) rather than a single pooled estimate specific to psychiatric DBS; treat as an approximate, not a precise pooled figure.

## Cortical interfaces — 2026 baseline notes

### Sources
- Rao, V.R. et al. (2018). Direct Electrical Stimulation of Lateral Orbitofrontal Cortex Acutely Improves Mood in Individuals with Symptoms of Depression. Current Biology. — magnitude, durability, reversibility, speed: 25-patient epilepsy cohort, acute dose-dependent mood improvement, effect tracked the stimulation window rather than persisting.
- Jung, T. et al. (2025). A wireless subdural-contained brain-computer interface with 65,536 electrodes and 1,024 channels. Nature Electronics. — steerability: channel-count/resolution evidence for subdural arrays.
- Synchron (2024). COMMAND early feasibility study results, presented at Congress of Neurological Surgeons / reported via BusinessWire, MedTech Dive. — reliability, safety: 6/6 patients, 100% accurate deployment, zero device-related SAEs at 12 months.
- Salatino, J.W., Ludwig, K.A., Kozai, T.D.Y. et al. (2017). Glial responses to implanted electrodes in the brain. Nature Biomedical Engineering. — tolerance: gliosis/foreign-body-response mechanism and signal degradation timeline.
- Degenhart, A.D. et al. (2020). Stabilization of a brain-computer interface via the alignment of low-dimensional spaces of neural activity. Nature Biomedical Engineering. — tolerance, burden: nonstationarity/recalibration burden and unsupervised-alignment mitigation.
- Mitchell, P. et al. (2023). Assessment of Safety of a Fully Implanted Endovascular Brain-Computer Interface for Severe Paralysis in 4 Patients. JAMA Neurology. — invasiveness: implant-procedure requirement across modalities.
- Opie, N.L. et al. (2016). Feasibility of a chronic, minimally invasive endovascular neural interface. (Synchron/University of Melbourne Stentrode preclinical work.) — reversibility: endothelialization and non-retrievability of the endovascular stent.
- FDA (2025) / Precision Neuroscience press materials, GlobeNewswire (2025); MassDevice, MedTech Dive coverage of Synchron COMMAND. — regulation: Layer7 510(k) scope (30-day use, recording+stimulation only), COMMAND's IDE/feasibility (not pivotal) status.
- "How Much Does a Brain Implant Cost? 2026 Pricing Guide," bciintel.com (2026); NeuroPace RNS and DBS device pricing coverage. — cost: no commercial BCI pricing exists yet; comparable implant costs and BCI development-cost estimates.

### Caveats
- None of the 12 scores are contradicted by what I found this pass; all existing values are defensible against current evidence.
- Endothelialization timing for Stentrode varies by source (day 6 electrical stabilization vs. day 45 neointimal envelopment vs. ~190-day long-term incorporation); I used "within weeks" to stay accurate without overclaiming a single figure — worth a closer look if this note is revisited.
- No peer-reviewed journal publication of the COMMAND trial's full dataset was found as of this search (results are conference-presented and press-reported only); cited as "Synchron 2024" per the org+year convention for that reason.
- The magnitude note leans on Rao et al. 2018, which used depth/intracranial electrodes in an epilepsy (SEEG-style) cohort rather than a chronic implanted BCI — the most relevant available human evidence for cortical affective modulation, but worth flagging as adjacent rather than a Neuralink/Synchron/Precision trial finding.

## Transcranial magnetic stimulation — 2026 baseline notes

### Sources
- Cole EJ et al. (2022). Stanford Neuromodulation Therapy (SNT): A Double-Blind Randomized Controlled Trial. American Journal of Psychiatry. — magnitude, steerability (sgACC targeting), burden, speed
- Chen M et al. (2025). High dosage accelerated intermittent theta burst stimulation without precision targeting and dosing in depression: an open-label pilot study. European Archives of Psychiatry and Clinical Neuroscience. — reliability, replication without precision components
- George MS et al. (2010). Daily left prefrontal transcranial magnetic stimulation therapy for major depressive disorder (OPT-TMS trial). Archives of General Psychiatry. — standard-protocol remission baseline (~30%)
- Dunner DL et al. (2014). A Multisite, Naturalistic, Observational Study of TMS for Patients With Pharmacoresistant MDD: Durability of Benefit Over a 1-Year Follow-Up Period. Journal of Clinical Psychiatry. — durability, reversibility/washout framing
- Pridmore S, Erger S, May T (2019). Second Courses of Transcranial Magnetic Stimulation (TMS) in Major Depressive Episodes for Initial Responders and Non-Responders. Malaysian Journal of Medical Sciences. — tolerance / repeat-course efficacy
- Taylor JJ et al. (2021). Seizure risk with repetitive TMS: Survey results from over a half-million treatment sessions. Brain Stimulation. — safety, seizure incidence
- Huang YZ et al. (2005). Theta burst stimulation of the human motor cortex. Neuron. — single-session excitability decay timescale, used for reversibility
- FDA clearance history (2024-2025): NeuroStar adolescent MDD clearance (March 2024), BrainsWay Deep TMS adolescent MDD clearance (Nov 2025), BrainsWay H7 coil OCD De Novo clearance — regulation, invasiveness (device classification)
- Healingmaps (2026). TMS Therapy: A Complete 2026 Guide to Treatment, Cost, Insurance & Devices. — cost per course, equipment/technician cost driver

### Caveats
- None of the existing scores are contradicted by what I found. The reliability note's cited replication figure (50% response / 12.5% remission) is drawn from Chen et al. 2025, a small (n=8) open-label pilot — it is directionally consistent with the "far less than SNT's trial numbers" framing in the original note but is a thin evidentiary base for that specific figure; a larger naturalistic accelerated-iTBS cohort would strengthen this if found in a future pass.
- Durability note reframes the original "subset remains in remission at 12 weeks" using a 12-month/6-month naturalistic figure (Dunner et al. 2014) since that is the strongest citable durability dataset; the underlying claim (relapse is common without maintenance) still supports score 5.

## Electrical stimulation — 2026 baseline notes

### Sources
- Borrione, L. et al. (2024). Home-Use Transcranial Direct Current Stimulation for the Treatment of a Major Depressive Episode: A Randomized Clinical Trial. JAMA Psychiatry. — n=174 (not 210 as in the prior draft note), three-arm remote sham-controlled trial; active tDCS did not separate from sham (remission 14-18% active vs 21% sham).
- Moffa, A. H. et al. (2020). Efficacy and acceptability of transcranial direct current stimulation (tDCS) for major depressive disorder: an individual patient data meta-analysis. Progress in Neuro-Psychopharmacology and Biological Psychiatry. — pooled IPD evidence of a real but modest, heterogeneous effect.
- Datta, A. et al. (2009). Gyri-precise head model of transcranial direct current stimulation: improved spatial focality using a ring electrode versus conventional rectangular pad. Brain Stimulation. — finite-element modeling showing diffuse, non-focal cortical current spread; ~45% scalp shunting is the field-standard figure derived from this modeling tradition.
- Jamil, A., Batsikadze, G., Kuo, H.-I., Labruna, L., Hasan, A., Paulus, W., & Nitsche, M. A. (2017). Systematic evaluation of the impact of stimulation intensity on neuroplastic after-effects induced by transcranial direct current stimulation. Journal of Physiology. — documents homeostatic/non-linear reversal of excitability effects at higher intensity or duration.
- Nitsche, M. A. & Paulus, W. (2000, 2001). Excitability changes induced in the human motor cortex by weak transcranial direct current stimulation / Sustained excitability elevations. Journal of Physiology / Neurology. — foundational data on within-session onset and hours-scale decay of tDCS after-effects.
- FDA (2025). PMA approval of Flow Neuroscience's FL-100 tDCS headset for moderate-to-severe MDD, Dec 8, 2025; pivotal trial reported 58% vs 29% remission at 10 weeks. — basis for regulation, magnitude, durability, burden, speed, and safety notes.
- Flow Neuroscience (2025-2026). US pricing guidance ($500-800) for the FL-100 at Q2 2026 launch; EU retail price ~€459 (~$537) since 2020. — basis for the cost note.

### Caveats
- The prior magnitude note cited the Borrione trial as n=210; the actual published trial (JAMA Psychiatry 2024) randomized n=174 (87 active/tDCS-only, 87 sham). I corrected this in the new note rather than perpetuating the error. This does not affect the score, only the citation's accuracy.
- No taVNS-specific efficacy citation made it into the final 230-character notes (character budget was spent on tDCS evidence, which carries more weight for the disease-approval and pivotal-trial claims). For reference, a 2023 meta-analysis (12 studies, n=838) found taVNS response rates comparable to antidepressants with a favorable safety profile (ear pain, headache, tingling; no elevated serious-AE risk vs sham, per a 2022 safety meta-analysis of 177 studies/6,322 subjects) — consistent with the existing reliability/safety scores but not separately sourced in-line.
- All 12 existing score values are well-supported by the evidence found; none appear to need rescoring.

## Focused ultrasound — 2026 baseline notes

### Sources
- Barksdale, B.R. et al. (2025). Low-intensity transcranial focused ultrasound amygdala neuromodulation: a double-blind sham-controlled target engagement study and unblinded single-arm clinical trial. *Molecular Psychiatry*. — magnitude, reliability, durability, tolerance, burden, speed (effect sizes, BLA E/I balance, 15-session/3-week protocol)
- Tsuchiyagaito, A. et al. (2025). Reversible modulation of a deep white matter surgical target for depression with low-intensity focused ultrasound. *Neuropsychopharmacology*. — reliability (small-n ALIC trial), reversibility (no lesion, effects decay)
- Zhang et al. (2025). Flexible skull-conformal phased array for aberration-corrected transcranial focused ultrasound therapy. *bioRxiv* / *Ultrasonics*. — steerability (8.9mm axial FWHM at 36mm depth through ex vivo human skull)
- Rezai, A., Ranjan, M., Bhagwat, A. et al. (2025); response articles (2026). Brain injury during focused ultrasound neuromodulation for substance use disorder. *Brain Stimulation*. — safety (serious AE case report at higher intensity)
- ITRUSST consensus on biophysical safety for transcranial ultrasound stimulation (2025). — safety, regulation (no standardized dosing/IDE pathway)
- Connolly, P. et al. (2025). Neurodegeneration Associated with Repeated High-Frequency Transcranial Focused Ultrasound. *bioRxiv*. — tolerance (animal caution on repeated high-frequency exposure)
- Oh, S.-J. et al. (2023). The mechanosensitive ion channel Piezo1 contributes to ultrasound neuromodulation. *PNAS*. — mechanism background (not directly cited in a note, used to confirm magnitude/reliability framing is mechanistically grounded)

### Caveats
- **Safety AE evidence**: Existing safety note (score 8, "no serious AEs to date") predates the Rezai et al. (2025) brain-injury case report from a substance-use-disorder LIFU trial, which triggered an open-letter debate in *Brain Stimulation* (2025-26) over adverse-event reporting standards. That case used intermediate-to-high intensity parameters, arguably outside the "low-intensity" psychiatric-protocol envelope this row covers, so I did not rescore — but this is the first serious reported AE in the modality's short human history and is worth the author's awareness when the next research pass revisits safety.
- **Author-name confidence**: "Zhang et al. 2025" (skull-conformal phased array) and "Connolly et al. 2025" (NHP/animal neurodegeneration paper) were extracted from bioRxiv PDF metadata via automated fetch rather than a masthead read; the finding and year are solid, but double-check the exact author surname before treating the citation as final if this ever goes into print-quality copy.
- **No conflicts with existing 1-10 values**: all 12 scores are well-supported by the evidence found; none of the research contradicted the existing baseline numbers.

## Neuroplastogens — 2026 baseline notes

### Sources
- Compass Pathways (2025). Successfully Achieves Primary Endpoint in First Phase 3 Trial Evaluating COMP360 Psilocybin for Treatment-Resistant Depression (COMP005). — magnitude, durability, safety
- Compass Pathways (2026). Successfully Achieves Primary Endpoint in Second Phase 3 Trial Evaluating COMP360 Psilocybin for Treatment-Resistant Depression (COMP006). — magnitude, reliability, safety, speed
- Mertens, L. et al. (2026). Efficacy and Safety of Psilocybin in Treatment-Resistant Major Depression: The EPISODE Randomized Clinical Trial. — reliability
- Cameron, L.P. et al. (2021). A non-hallucinogenic psychedelic analogue with therapeutic potential. Nature. — steerability, tolerance (5-HT2A Gq-vs-arrestin bias, downregulation/tachyphylaxis mechanism)
- FDA (2025). Guidance for industry on clinical investigations for psychedelic drugs, recommending 5-HT2B receptor binding evaluation. — safety
- FDA (2019). Approval of SPRAVATO (esketamine) nasal spray. — invasiveness, regulation
- FDA / SPRAVATO REMS Program Overview (2024). Two-hour post-dose monitoring requirement. — burden
- FDA (2024). Complete Response Letter to Lykos Therapeutics for MDMA-assisted therapy for PTSD, citing unreliable safety data and blinding failure. — regulation
- Avanceña, A.L.V., Vuong, L., Kahn, J.G., & Marseille, E. (2025). Psilocybin-assisted therapy for treatment-resistant depression in the US: a model-based cost-effectiveness analysis. Translational Psychiatry. — cost
- Healingmaps / Discreet Ketamine (2026). Ketamine and Spravato pricing surveys. — cost (esketamine session price)

### Caveats
- **magnitude**: COMP005/COMP006 topline results are press-release/conference-poster data (ASCP 2026), not yet peer-reviewed full manuscripts. Treat "Compass Pathways 2025/2026" as a company-source citation until the papers publish — consistent with how timeline-research.md already treats this data.
- **reliability**: Confirmed the EPISODE trial (Mertens et al. 2026) is a genuine null result on its primary endpoint, supporting the score-5 placement, but could not independently verify the specific "17.0% vs 10.6%" response-rate figures already in the baseline note; I dropped those exact numbers rather than repeat unverified figures, while keeping the directional claim (no significant separation from niacinamide).
- **safety**: 5-HT2B valvulopathy risk remains theoretical/mechanistic (FDA guidance recommends screening for it) — no confirmed clinical cases of psilocybin/MDMA-induced valvulopathy were found. This supports a mid-range score (5) rather than a lower one; flagging in case the essay wants to distinguish theoretical vs. demonstrated risk more sharply.
- No conflicts found that would argue for rescoring any of the 12 dimensions; all existing values look defensible against 2026 evidence.

## Stimulants and nootropics — 2026 baseline notes

### Sources
- Montgomery, C. et al. (2020). How effective are pharmaceuticals for cognitive enhancement in healthy adults? A series of meta-analyses of cognitive performance during acute administration of modafinil, methylphenidate and D-amphetamine. European Neuropsychopharmacology, 38, 40-62. — SMDs for magnitude note (0.21 methylphenidate, 0.12 modafinil, null d-amphetamine)
- Sulzer, D., Sonders, M.S., Poulsen, N.W., Galli, A. (2005). Mechanisms of neurotransmitter release by amphetamines: a review. Progress in Neurobiology, 75(6), 406-433. — DAT/NET reverse-transport mechanism for steerability
- Volkow, N.D. et al. (2002). Mechanism of action of methylphenidate: insights from PET imaging studies. Journal of Attention Disorders. — dopamine transporter occupancy underlying near-universal pharmacologic response (reliability)
- Kimko, H.C., Cross, J.T., Abernethy, D.R. (1999). Pharmacokinetics and clinical effectiveness of methylphenidate. Clinical Pharmacokinetics, 37(6), 457-470. — methylphenidate half-life (2-3h) and Tmax (~2h) for durability/speed
- Robertson, P. Jr., Hellriegel, E.T. (2003). Clinical pharmacokinetic profile of modafinil. Clinical Pharmacokinetics, 42(2), 123-137. — modafinil half-life (12-15h) and Tmax (2-4h) for durability/speed
- Volkow, N.D. et al. (1999). Reinforcing effects of psychostimulants in humans are associated with increases in brain dopamine and occupancy of D2 receptors. Journal of Pharmacology and Experimental Therapeutics. — basis for motivational/reinforcing tolerance dissociating from cognitive/peripheral effects
- Chan, M., Chan, J.J., Wright, J.M. (2025). Effect of amphetamines on blood pressure. Cochrane Database of Systematic Reviews, CD007896. — pooled BP (+1.93/+1.84 mmHg) and HR (+3.71 bpm) deltas, 56 trials, n=10,583, high-certainty evidence
- Moran, L.V. et al. (2024). Risk of Incident Psychosis and Mania With Prescription Amphetamines. American Journal of Psychiatry. — dose-response odds ratios for incident psychosis/mania (aOR 1.79 low dose, 5.28 high dose >30mg dextroamphetamine-equivalent; methylphenidate not significantly associated)
- U.S. FDA. Dextroamphetamine sulfate prescribing information (2023, DailyMed). — d-amphetamine elimination half-life (~9-11h in adults) for reversibility
- DEA (2025). DEA Extends Telemedicine Flexibilities to Ensure Continued Access to Care; and Adderall Shortage Timeline and Tracker, Medfinder/ISSUP (2026). — Schedule II refill/90-day rule, telehealth renewal, and shortage availability figures for burden/regulation
- GoodRx (2026). Adderall pricing page. — generic per-dose retail pricing for cost

### Caveats
- None of the existing scores are contradicted by what I found this pass — all 12 values are defensible against the sourced evidence above.
- Mick, E., McManus, D.D., Goldberg, R.J. (2013, European Neuropsychopharmacology) is a second adult-specific CNS-stimulant HR/BP meta-analysis (HR +5.7 bpm, SBP +2.0 mmHg, n via 10 RCTs) that roughly corroborates Chan et al. 2025 but was not cited in the final notes for space; worth keeping in mind if the safety note is ever revised for methylphenidate specifically rather than amphetamine.
- The Volkow et al. 2002 citation (reliability) is attributed by title/topic match from search snippets rather than a directly confirmed DOI read — the mechanism claim (near-universal DAT/NET occupancy) is well-established in the literature, but if this note is audited later, verify the exact Volkow paper/year before treating the citation as pinned.

## Neuroendocrine modulators — 2026 baseline notes

### Sources
- Keech, B., Crowe, S., & Hocking, D.R. (2018). Intranasal oxytocin, social cognition and neurodevelopmental disorders: A meta-analysis. *Psychoneuroendocrinology*. — Hedges g = 0.08 for emotion recognition across 17 RCTs in neurodevelopmental-disorder populations; supports magnitude note.
- Striepens, N. et al. (2013). Elevated cerebrospinal fluid and blood concentrations of oxytocin following its intranasal administration in humans. *Scientific Reports*. — CSF oxytocin rise after intranasal dosing, but on a delayed and plasma-decoupled timecourse; supports steerability note.
- Leng, G. & Ludwig, M. (2016). Intranasal Oxytocin: Myths and Delusions. *Biological Psychiatry*. — Standard critique of assumed nose-to-brain CNS penetration for intranasal oxytocin; supports steerability note.
- Takeda (2025/2026 newsroom releases). Positive Phase 3 results for oveporexton (TAK-861) in FirstLight and RadiantLight; FDA approval of ORZEYFUL (Aug 5, 2026). — MWT primary endpoint met (P<.001), >95% extension-study uptake, no hepatotoxicity signal (unlike predecessor TAK-994/danavorexton), insomnia 48%/urinary urgency 33%/urinary frequency 32% adverse events, 2mg oral tablet BID dosing, DEA scheduling pending within 90 days. Supports magnitude, reliability, durability, tolerance, safety, invasiveness, burden, speed, regulation, cost notes.
- Sikich, L. et al. (2021). Intranasal Oxytocin in Children and Adolescents with Autism Spectrum Disorder (SOARS-B). *New England Journal of Medicine*. — 290-participant RCT, no significant between-group difference on social/cognitive outcomes after 24 weeks; supports reliability note.
- Huang, H. et al. (2014). Chronic and Acute Intranasal Oxytocin Produce Divergent Social Effects in Mice. *Neuropsychopharmacology*. — Chronic dosing blunts/reverses acute prosocial effects, consistent with receptor downregulation; supports tolerance note.
- Ory, J., Nackeeran, S., Balaji, N.C., Hare, J.M., & Ramasamy, R. (2022). Secondary Polycythemia in Men Receiving Testosterone Therapy Increases Risk of MACE and VTE in the First Year of Therapy. *Journal of Urology*. — Matched cohort of 5,842 men; polycythemia on TRT independently raised one-year MACE/VTE risk; supports safety note.
- Brown, E.S. (2009). Effects of Glucocorticoids on Mood, Memory, and the Hippocampus. *Annals of the New York Academy of Sciences*. — Chronic glucocorticoid exposure linked to declarative-memory deficits and reduced hippocampal volume/NAA; supports safety note.
- Liberto, R., Katlowitz, N., Sagalovich, D., & Davila, J. (2025). Strategies for Reversing Exogenous Testosterone-Induced Infertility. *Cureus*. — HPG-axis recovery after stopping exogenous testosterone is variable and can take months, sometimes requiring rFSH; supports reversibility note.
- Lieberman, H.R. et al. (2023). Effects of testosterone enanthate on aggression, risk-taking, competition, mood, and other cognitive domains during 28 days of severe energy deprivation. *Psychopharmacology*. — Weekly-dosed testosterone did not reliably alter mood/cognition acutely, consistent with a slow-onset (weeks-scale) effect profile; supports speed note.
- FDA (2026) / Takeda newsroom (2026). U.S. FDA Approves ORZEYFUL (oveporexton) for Narcolepsy Type 1. — Narrow disease label, DEA scheduling decision due within 90 days of approval, specialty-pharmacy-only distribution; supports regulation note.

### Caveats
- No named study was found quantifying healthy-adult (non-narcoleptic) response to orexin agonists — Phase 1 healthy-volunteer work is only just starting per the existing timeline-research.md file. The magnitude=4 and reliability=4 scores already reflect this uncertainty by blending oxytocin's near-null result with orexin's strong-but-narrow-population result; evidence does not contradict the scores, but the orexin side of both scores remains a genuine unknown rather than a settled negative.
- Could not verify ORZEYFUL's actual launch price (WAC) — no source had it publicly listed as of the search date (narcolepsy specialty drugs like Xywav/Wakix typically run in the tens of thousands annually, but I did not use an unconfirmed number in the cost note). The cost note relies on the well-sourced generic testosterone/oxytocin low end plus the qualitative "branded specialty pricing" characterization rather than a specific oveporexton dollar figure.
- Could not find a single named human study for chronic-oxytocin OXTR downregulation (used the closest well-sourced proxy, Huang et al. 2014's mouse chronic-vs-acute dosing divergence, rather than the human-specific literature, which is thinner).

## Gene and molecular therapy — 2026 baseline notes

### Sources
- uniQure (2026). Announces Plan for BLA Submission for AMT-130 in Huntington's Disease; FDA regulatory update. GlobeNewswire / HDSA. — 3-year cUHDRS data (75% slowing, p=.003), Jan 2026 FDA rejection then June 2026 acceptance, BLA timing, catheter delivery route.
- Gomez, J.L. et al. (2017). Chemogenetics revealed: DREADD occupancy and activation via converted clozapine. Science. — CNO reverse-metabolizes to clozapine; DREADDs are actually activated by clozapine, not CNO directly.
- Bonaventura, J. et al. (2019). High-potency ligands for DREADD imaging and activation in rodents and monkeys. Nature Communications. — JHU37160/JHU37152 as improved, brain-penetrant, rapidly-clearing DREADD ligands vs. CNO.
- Nagai, Y. et al. (2025). Longitudinal assessment of DREADD expression and efficacy in the monkey brain. eLife. — PET-quantified hM3Dq/hM4Di expression peaking ~60 days post-injection, stable 1-2 years.
- Boutin, S. et al. (2010). Prevalence of serum IgG and neutralizing factors against AAV types 1, 2, 5, 6, 8, and 9 in the healthy population. Human Gene Therapy. — Anti-AAV total IgG seroprevalence 38-72% depending on serotype, underpinning trial exclusion rates.
- Verdera, H.C., Kuranda, K., & Mingozzi, F. (2020). AAV Vector Immunogenicity in Humans: A Long Journey to Successful Gene Transfer. Molecular Therapy. — Anti-capsid immunity after first dose precludes vector re-administration; transgene silencing over time.
- Capsida Biotherapeutics (2026). An Important Update Regarding Our CAP-002 Program: A Letter to the STXBP1 Community; press coverage (BioPharma Dive, Inside Precision Medicine). — First-dosed patient death from cerebral edema (Sept 2025), cause undetermined, SYNRGY trial closed May 2026.
- FDA (2020). Long Term Follow-Up After Administration of Human Gene Therapy Products; Guidance for Industry. — Recommends up to 5-year LTFU for non-integrating AAV vectors, 15 years for integrating vectors.
- Roth, B. presentation, NIH BRAIN Initiative meeting (Aug 2026); reporting by C&EN and Intelligent Living. — First seven registered human DREADD trials, in China, for epilepsy/Parkinson's/neuropathic pain, no results published as of Aug 2026.
- Nanoscope Therapeutics (2026). REMAIN 3-year follow-up data for MCO-010 optogenetic therapy, presented at ARVO 2026. — Most advanced human optogenetic circuit intervention is retinal, restoring only crude light sensitivity, not affective control.
- Cell & Gene (2026); ArcticZymes (2026). Gene therapy pricing and manufacturing cost analyses. — AAV list prices $850k-$3.5M/dose; manufacturing COGS $500k-$1M/dose driven by low viral yield and downstream purification cost.

### Caveats
- **regulation**: The existing note's specific claim "chemogenetics has zero human trials" is now false — China registered the first seven human DREADD trials in 2026 (epilepsy, Parkinson's, neuropathic pain), disclosed at the Aug 2026 NIH BRAIN Initiative meeting. No results are published and no regulatory approval exists anywhere, so the score of 1 is still justified, but the note's factual claim needed updating rather than just softening.
- **safety**: New evidence (Capsida CAP-002 patient death, Sept 2025/confirmed Jan 2026) is a materially stronger justification for the existing score of 2 than anything in the original note — worth flagging that this event postdates the original note and should probably anchor future revisions of this dimension across other AAV-delivered rows too, not just chemogenetics.
- No conflicts found that would argue for a different score than the existing baseline on any of the 12 dimensions; all evidence found is consistent with or reinforces current values.

## Behavioral training — 2026 baseline notes

### Sources
- Cuijpers et al. (2023). Cognitive behavior therapy vs. control conditions, other psychotherapies, pharmacotherapies and combined treatment for depression: a comprehensive meta-analysis including 409 trials with 52,702 patients. World Psychiatry. — magnitude, reliability, durability effect sizes vs control and long-term vs pharmacotherapy
- Cuijpers et al. (2021). The effects of psychotherapies for depression on response, remission, reliable change, and deterioration: A meta-analysis. Acta Psychiatrica Scandinavica. — deterioration rate (safety)
- Schabus et al. (2017) as characterized in sham-controlled neurofeedback reviews (e.g. Thibault & Raz critiques; Brain, 2017). — neurofeedback sham-controlled null result (reliability)
- Bouton, M.E. (1993/2004). Context and behavioral processes in extinction. Learning & Memory. — extinction as new inhibitory learning, renewal/reinstatement/spontaneous recovery (reversibility)
- Lally et al. (2010). How are habits formed: Modelling habit formation in the real world. European Journal of Social Psychology. — median 66 days to 95% asymptotic automaticity (tolerance)
- Heinz et al. (2025). Randomized Trial of a Generative AI Chatbot for Mental Health Treatment (Therabot). — 4-week RCT vs waitlist control, digital-delivery cost frontier (cost)
- Meta-analysis of dropout from CBT (115 trials; ResearchGate/Swift & Greenberg-style dropout literature) reporting 15.9% pretreatment / 26.2% during-treatment weighted averages; internet-based CBT dropout up to 74% unsupported. — reliability, burden
- Long-term follow-up data on trauma-focused CBT/exposure for PTSD (meta-analysis reporting post-treatment follow-up effect size g=1.36; specific-phobia 4-year follow-up data showing ~90% symptom reduction maintained). — durability, safety (transient exacerbation resolving by ~3 months)
- Illinois HB 1806 (WOPR Act, Aug 2025) and Nevada AB 406 (eff. July 1, 2025) banning AI-delivered therapy/psychotherapy. — regulation

### Caveats
- None of the existing scores are contradicted by the evidence found; all 12 notes were rewritten to support the existing values.
- The Schabus et al. (2017) citation for the sham-neurofeedback null result is sourced indirectly (via reviews/critiques discussing that trial and related sham-controlled work), not from directly reading the original Brain 2017 paper — flagging as slightly weaker sourcing than the others.
- The g=1.36 long-term follow-up figure and the ~90%-at-4-years phobia figure came from meta-analysis summaries without a clean first-author name attached in search results; cited generically in the notes rather than with a specific misattributed author, consistent with the durability/safety notes above.

