# Programmable Mind State — Trajectory Sources (2027–2036)

Citations behind the per-cell reasoning shown for every year after the 2026 baseline. `baseline-research.md` covers the 2026 column; `timeline-research.md` covers how the 1–10 scores for each year were forecast. This file covers the third layer: why each row moves the way it does, with sources.

Researched August 2026. Ten parallel agents, one per technology, each asked to justify the existing trajectory rather than re-forecast it — no score was changed in this pass. Where an agent's research contradicted the forecast, the conflict is recorded under that technology's caveats rather than silently resolved.

Citations are author-year. Organization-year forms — (FDA 2025), (Medtronic 2025) — appear only where the claim is a regulatory action, trial registration, company milestone, or market figure with no peer-reviewed publication behind it.

## Verification status — read this before quoting anything here

This pass exhausted its live-search budget partway through. Verification is therefore **uneven across rows**, and the caveats below are not decorative:

| Row | Live verification |
|---|---|
| Deep brain stimulation | Full, except two citations (Sansur et al. 2007; Fenoy & Simpson 2014) recalled from training knowledge |
| Cortical interfaces | Full |
| Transcranial magnetic stimulation | Full |
| Consumer electrical stimulation | Full, except Miron et al. 2026 (secondary summary only) |
| Focused ultrasound | Full |
| Neuroplastogens | Partial — budget ran out mid-task |
| Stimulants and nootropics | Partial — budget ran out after five queries |
| Neuroendocrine modulators | Partial — search exhausted before start; WebFetch and rendered snippets only |
| Gene and molecular therapy | **None.** Search budget was fully exhausted before this agent ran a single query. Every citation rests on the prior research file plus training knowledge |
| Behavioral training | **None.** Same exhaustion; direct fetches to FDA.gov and trade press returned 403/404 |

The gene-therapy and behavioral-training rows should be re-run against live sources before this page is treated as fact-checked.

---

## 1. Deep brain stimulation

### Sources

- Butson CR & McIntyre CC. Current steering to control the volume of tissue activated during deep brain stimulation. Brain Stimulation, 2008 — used for magnitude (fixed volume-of-tissue-activated ceiling on effect size).
- Steigerwald F et al. Directional deep brain stimulation of the subthalamic nucleus: a pilot study using a novel neurostimulation device. Movement Disorders, 2016 — used for steerability (directional/current-steering therapeutic window widening); journal/venue recalled with moderate confidence, flagged below.
- Cascino S, Luiso F, Caffi L et al. Chronic adaptive deep brain stimulation in Parkinson's disease: ADAPT-START findings and programming principles. npj Parkinson's Disease, 2026 (vol 12, article 85; preprint on medRxiv Sept 2025) — used for steerability, reliability, and tolerance (unblinded ~35% greater motor improvement vs conventional DBS, well-being p=0.007, sustained chronic adaptive operation).
- Abbott. Abbott Launches World's Smallest Rechargeable System With Remote Programming Capabilities to Treat Movement Disorders (Liberta RC / Infinity IPG survival analysis: 50% of first 5,000 Infinity IPGs exceeded 5 years; charging as infrequently as ~10x/year). Press release, Jan 2024 — used for durability and burden.
- Huang Z, Meng L, Bi X, Xie Z, Liang W, Huang J. Efficacy and safety of robot-assisted deep brain stimulation for Parkinson's disease: a meta-analysis. 2024 (PMID 38882524; PMC11176545) — used for safety (robot-assisted radial/targeting error ~1.01mm vs ~1.32mm frame-based, comparable complication rates).
- Sansur CA et al. Incidence of symptomatic hemorrhage after stereotactic electrode placement with multiple microelectrode passes. J Neurosurg, 2007 — used for safety and invasiveness (~1.3% added hemorrhage risk per additional microelectrode brain pass); cited from memory, flagged below for verification.
- Fenoy AJ & Simpson RK Jr. Risks of common complications in deep brain stimulation surgery: management and avoidance. J Neurosurg, 2014 — used for reversibility (explant/revision risk profile relative to original implant surgery); cited from memory, flagged below for verification.
- Medtronic. Medtronic earns U.S. FDA approval for the world's first Adaptive deep brain stimulation system for people with Parkinson's (BrainSense Adaptive DBS + Electrode Identifier, ~85% faster initial programming). Press release, Feb 24, 2025 — used for burden.
- Medtronic. Medtronic earns FDA approval for expanded deep brain stimulation labeling for Dystonia (HDE-to-PMA conversion). Press release, Dec 2025 — used for regulation.
- Abbott. Abbott Initiates Clinical Study to Evaluate the Use of Its Deep Brain Stimulation System to Manage Severe Depression (TRANSCEND). Press release, Sept 4, 2024; FORESEE III (NCT04021823, CE-mark pivotal for medial forebrain bundle DBS in depression) — used for reliability (readout timing ~2029-2031).
- Straits Research. Deep Brain Stimulation Devices Market Size, Growth, Trends & Demand Report by 2033 (projected ~$7.19B by 2033, 14.9% CAGR 2025-2033) — used for cost, as a second independent market-size source alongside the Coherent Market Insights figure already cited in the baseline research.

### Caveats

- Steigerwald et al. 2016: I am confident this directional-DBS current-steering pilot study exists and reports a widened therapeutic window vs. ring-mode stimulation, but I recalled the exact journal (Movement Disorders) from memory rather than confirming it in this research pass — worth a citation-format check before publishing.
- Sansur et al. 2007 and Fenoy & Simpson 2014: both cited from trained knowledge rather than a fresh search this session (web search budget was exhausted before I could re-verify author/venue details). The underlying claims — ~1.3% hemorrhage risk per added microelectrode pass, and explantation/revision carrying a lower risk profile than initial implantation — are well-established findings in the DBS surgical-complications literature, but double-check the exact citations before treating them as load-bearing.
- The steerability and reliability drivers both lean on the same single source (Cascino et al. 2026, ADAPT-START) for the "narrows off-target spread" and "~35% greater motor improvement" claims. That trial was small (9 patients reached chronic adaptive DBS) and unblinded — real but thin evidence for a claim carrying two dimensions across a decade. The existing forecast's own ADAPT-PD framing has the same limitation.
- No new disease-indication trials (Alzheimer's, epilepsy, OCD-label expansion) could be verified for the regulation driver's "other indications may follow" claim before the search budget ran out; the driver was written conservatively to avoid asserting a specific unverified indication, resting only on the confirmed dystonia PMA precedent.
- Nothing here contradicts the existing forecast's scores or shape — all twelve drivers were written to support the given trajectory, not to challenge it.

---

## 2. Cortical interfaces

### Sources

- Willett, F. R. et al. 2023, "A high-performance speech neuroprosthesis," Nature — 62 words/minute decoding, 9.1% word-error rate on a 50-word vocabulary, 23.8% on a 125,000-word vocabulary. Used for steerability, reliability, speed.
- Fan, C. et al. 2024, "Plug-and-play stability for intracortical brain-computer interfaces: a one-year demonstration of seamless brain-to-text communication," Nature Medicine (originally posted as arXiv:2311.03611, 2023) — one year of stable decoding without full daily recalibration. Used for reliability.
- Wilson, G. H., Willett, F. R. et al. 2023 (bioRxiv preprint; published Nature Biomedical Engineering 2025), "Long-term unsupervised recalibration of cursor-based intracortical brain-computer interfaces using a hidden Markov model" — up to a month of unsupervised recalibration. Used for reliability, tolerance, burden.
- Scangos, K. W. et al. 2021, "Closed-loop neuromodulation in an individual with treatment-resistant depression," Nature Medicine — biomarker-triggered DBS produced rapid, sustained mood improvement outlasting individual stimulation episodes in an n-of-1 study. Used for magnitude, durability.
- Precision Neuroscience 2025, "Precision Neuroscience Receives FDA Clearance for High-Resolution Cortical Electrode Array," company release / FDA 510(k) K242618 (April 2025) — Layer7-T: 1,024-electrode thin-film, subdural, cleared for recording/stimulation up to 30 days, tested in 37 patients. Used for magnitude, safety, invasiveness, reversibility.
- Neuralink 2025, reporting on thread-retraction failure in patient one and its resolution via software update, not recurring in patients two through twelve — via Neuralink public updates and secondary press coverage (e.g., neurapod.com, robotcentral.com summaries of company statements). Used for safety.
- Neuralink 2026, R1 surgical robot automating implantation to under 30 minutes per procedure and a stated target of 1,000+ implants in 2026 — via Neuralink public statements and secondary press coverage (interestingengineering.com, techeblog.com, quasa.io). Used for invasiveness, reversibility, burden, cost.
- Synchron 2025, $200M Series D (closed November 2025) funding a 2026 pivotal COMMAND trial toward a first BCI PMA filing, with analysts projecting PMA no earlier than 2027-2028 — via company/press coverage (theroboticsmedia.com, techtimes.com). Used for regulation.
- FDA 2025, 510(k) clearance K242618 for Precision Neuroscience's Layer7-T, limited to 30-day recording/stimulation with no enhancement indication. Used for safety, regulation.
- China Briefing 2026, "China's Brain-Computer Interface Industry: Investing in the Future" — national roadmap target of roughly 3,000 invasive BCI surgeries annually and over 100,000 patients served by 2030. Used for cost.
- Opie, N. L. et al. 2016, "Focal stimulation of the sheep motor cortex with a chronically implanted minimally invasive electrode array mounted on an endovascular stent," Nature Biomedical Engineering — endovascular Stentrode endothelializes into the vessel wall within weeks, becoming unretrievable. Used for reversibility.

### Caveats

- The Fan et al. plug-and-play stability paper's exact journal (Nature Medicine, 2024) could not be independently confirmed this session — the arXiv preprint (2311.03611, Nov 2023) is solid, but I did not verify the peer-reviewed venue/year directly. Treat the "2024" / "Nature Medicine" attribution as moderate-confidence.
- Neuralink's thread-retraction resolution and R1 robot claims (30-minute implantation, 1,000+ implants target, patients 2-12 unaffected) come from company statements relayed through secondary tech press (interestingengineering.com, techeblog.com, quasa.io, neurapod.com, robotcentral.com), not peer-reviewed sources or SEC-grade disclosure — used org-year form per the rules, but confidence is lower than for FDA/journal citations.
- Scangos et al. 2021 is a DBS (subcortical, amygdala/OFC-region) closed-loop study, not a cortical-surface BCI trial. I used it as the best available mechanistic analogy for "sustained affective effect from implanted stimulation" to justify the magnitude/durability trajectories, consistent with how the baseline note already leans on Rao et al. 2018 (also DBS/ECoG-adjacent) for the same purpose. This is a real evidentiary gap the trajectory rests on, not a contradiction of the existing research, but it's worth flagging as thin.
- Reversibility's 2031 rise (6->7) is the weakest-justified move in this set: I could not find a specific device or trial that removes/extends explantability by that year. My driver leans on Neuralink's R1 robot being built for "thread-level revision" as a soft justification; this is inferential, not a confirmed serviceability claim from Neuralink.
- The $8-12B/$12.11B 2030/2035 BCI market-size figures found in research are inconsistent across sources (allied market research vs. ResearchAndMarkets) and were not used as a primary citation for cost; I used the China roadmap figure instead, which is more mechanism-specific (surgical volume) but still secondary-press sourced.
- No new evidence surfaced that contradicts any existing trajectory or score in the context file; all citations here supplement rather than conflict with the original forecast.

---

## 3. Transcranial magnetic stimulation

### Sources

- Martín-Bejarano M, Moleón Á, Álvarez de Toledo P, Pérez-Aquino I, Narbona-Antúnez J, Torres-Pereira J, García-Ferriol M (2025). High-Dose Accelerated Bilateral Theta Burst Stimulation for Depression and Anxiety: The Seville Protocol. PMC12437091. Supports: magnitude (30-session, 3,600 pulses/session protocol; 29.2% depression remission, 22% anxiety remission).
- FDA / Wave Neuroscience (2026). MeRT (Magnetic e-Resonance Therapy) FDA clearance for adjunctive PTSD treatment via breakthrough designation; pivotal trial reported ~68% remission and no serious adverse events. Supports: magnitude, safety, invasiveness, regulation.
- Zeta Surgical (2026). FDA 510(k) clearance (K261471) of the Zeta TMS Robotic System, a Class II stereotaxic instrument giving real-time, submillimeter robotic coil positioning with motion compensation; setup under one minute. Supports: steerability, reliability, safety, reversibility, burden, speed, invasiveness (context).
- Haxel L. et al. (2025). EEG-based machine-learning pipeline (sensor-, source-, and connectivity-level features) for optimizing TMS coil targeting, reported ~71% mean prediction accuracy, discussed in "Closing the Loop in Neuromodulation: A Review of Machine Learning Approaches for EEG-Guided Transcranial Magnetic Stimulation" (Algorithms, 2025, doi 10.3390/a19040323). Supports: steerability, reliability, reversibility.
- d'Andrea G. et al. (2023). Investigating the Role of Maintenance TMS Protocols for Major Depression: Systematic Review and Future Perspectives for Personalized Interventions. Journal of Personalized Medicine, PMC10141590. Reports acute-response duration of ~5 months before relapse risk rises to 20%, and that >2 maintenance sessions/month (vs ≤2) is needed to sustain remission. Supports: durability, tolerance.
- MAINT-R Trial (2025). Head-to-head comparison of maintenance low-frequency rTMS versus lithium for relapse prevention in treatment-resistant depression; comparable relapse rates with fewer adverse events on rTMS. Supports: durability, tolerance.
- Soterix Medical (2026). FDA clearance (March 5, 2026) of the SPRY TMS Therapy system for adult MDD; portable design with integrated rapid liquid cooling for continuous point-of-care operation. Supports: invasiveness, burden, cost.
- Mozu Health (2026). TMS Billing, Insurance Coverage & CPT Codes 2026 — reports 2026 national Medicare rates of roughly $200-235 (CPT 90867, initial), $130-160 (CPT 90868, subsequent), $175-210 (CPT 90869, re-mapping). Supports: cost.

### Caveats

- MAINT-R is described only through secondary/aggregator coverage; I could not verify the trial's registry ID, sponsor, or peer-reviewed publication status. Treat the (MAINT-R Trial 2025) citation as lower-confidence until a primary source (e.g., a ClinicalTrials.gov record or journal publication) is located.
- "Haxel et al. 2025" is attributed by a secondary search summary to results discussed inside a 2025 Algorithms review article; I could not directly confirm Haxel is the review's author versus a study it cites. Confidence: medium.
- The Seville Protocol (Martín-Bejarano et al. 2025) actually cuts against a naive "more dose = more magnitude" story — 30 sessions at higher pulse count than SNT's 5-day course produced a *lower* remission rate (29.2%) than SNT's 79% (Cole et al. 2022, in the 2026 baseline). I used it to argue magnitude gains are real but incremental/plateauing, which is consistent with the existing 6→8 (not higher) trajectory, but flagging in case this reads as contradicting "magnitude rises."
- MeRT's FDA clearance is for PTSD, not MDD — I used it for magnitude/safety/regulation as the newest disease-specific clearance and remission datapoint, but it is a different diagnostic population than the depression-focused rest of the row's evidence base (Cole, Chen, Dunner, Pridmore). This is a reasonable trajectory proxy but not a strict apples-to-apples continuation of the 2026 MDD baseline.
- I could not obtain full-text access (403 errors) to the Brain Stimulation modular multichannel/multi-locus TMS array paper (published online Aug 2026) or the connectivity-guided accelerated TBS inpatient-augmentation RCT (medRxiv, Aug 2026), both of which looked like strong candidates for steerability/magnitude drivers. Neither made it into the final drivers or source list — flagging as promising leads for follow-up if a fresh session can reach them.
- Nothing here contradicts the existing forecast's numbers or the cross-cutting findings (no enhancement pathway, regulation/efficacy ceilings on opposite ends, cost falling slowly). The new sources reinforce the same shape: incremental, hardware/targeting-driven gains layered on a fixed noninvasive-scalp-coil mechanism.

---

## 4. Consumer electrical stimulation

### Sources

- Kuo, M.F., Datta, A., Bikson, M. et al. (2013), Comparing cortical plasticity induced by conventional and high-definition 4x1 ring tDCS: a neurophysiological study, Brain Stimulation — HD-tDCS's greater spatial precision vs. conventional pad tDCS; used for magnitude.
- Grossman, N., Bono, D., Dedic, N. et al. (2017), Noninvasive Deep Brain Stimulation via Temporally Interfering Electric Fields, Cell 169(5) — original mouse demonstration of temporal interference reaching hippocampus without recruiting cortex; used for steerability and invasiveness.
- Temporal interference stimulation for deep brain neuromodulation in humans, Nature Biomedical Engineering, 2026 (also cited in the technology's existing frontier research) — first human TI trial targeting GPi/hippocampus; used for steerability.
- Datta, A., Truong, D., Minhas, P., Parra, L.C., Bikson, M. (2013), Inter-Individual Variation during Transcranial Direct Current Stimulation and Normalization of Dose Using MRI-Derived Computational Models, Frontiers in Psychiatry (PMC3477710) — basis for individualized current-flow dosing narrowing responder variability; used for reliability.
- Miron, J.-P., Daskalakis, Z.J., Blumberger, D.M., Weissman, C.R. et al. (2026), spaced/accelerated home tDCS protocol for major depression (five 20-minute sessions/day, 20-minute inter-session interval, two weeks), American Journal of Psychiatry — HAM-D-17 remission 10.7% at one week rising to 32.1% at four weeks; used for durability, tolerance, and speed.
- Jamil, A., Batsikadze, G., Kuo, H.I. et al. (2017), Systematic evaluation of the impact of stimulation intensity on neuroplastic after-effects induced by transcranial direct current stimulation, Journal of Physiology — homeostatic metaplasticity reversing excitability direction at higher intensity/duration; used for tolerance (same phenomenon as the 2026 baseline note, applied here to accelerated-dosing exposure specifically).
- Bikson, M., Grossman, P., Thomas, C. et al. (2016), Safety of Transcranial Direct Current Stimulation: Evidence Based Update 2016, Brain Stimulation — no serious adverse effects across >33,000 tDCS sessions, only minor scalp-site effects; used for safety.
- Nitsche, M.A., Fricke, K., Henschke, U. et al. (2003), Pharmacological modulation of cortical excitability shifts induced by transcranial direct current stimulation in humans, Journal of Physiology — NMDA-receptor blockade abolishes tDCS after-effects, showing the mechanism is transient synaptic rather than structural; used for reversibility.
- tDCS Devices Market Forecast 2026-2034, Data Insights Market, 2026 (same report already cited in the technology's existing research) — ~8.9% CAGR for the consumer/wearable neurostimulation segment; used for burden and cost.
- FDA (2025) — Flow FL-100 PMA approval, Dec 8, 2025, for moderate-to-severe MDD (same clearance already cited in the technology's existing research, applied here to the precedent it sets for future disease-specific submissions); used for regulation.

### Caveats

- Miron et al. 2026: I could not independently verify the exact author list or publication year via PubMed (search budget was exhausted mid-task; a PubMed query for the author combination returned zero results). The clinical details (protocol design, HAM-D-17 trajectory, response/remission rates, contact-dermatitis rate) come from a secondary summary (BBRF Foundation) that names the American Journal of Psychiatry and the investigator team (Miron, Daskalakis, Blumberger, Weissman) but not a full citation string. Treat this as the single lowest-confidence citation in the set — worth a direct PubMed/journal check before publishing. Both durability and speed drivers lean on it.
- Kuo et al. 2013: confirmed as the real, correct source for the "HD-tDCS is more spatially precise than conventional tDCS" claim via a secondary paper's citation of it (Guo et al. 2022, Frontiers in Neuroscience), but I did not read Kuo et al. 2013 directly, so I avoided citing any specific percentage figures from it — the driver text stays qualitative ("more focal, higher-intensity fields").
- No contradictions found with the existing forecast research or its trajectory shapes; all twelve drivers were written to support the fixed scores as given, including the flat rows (invasiveness, reversibility, safety) and the one declining row (tolerance).
- The regulation driver's claim that other sponsors "can follow" the Flow PMA precedent for separate conditions is an inference from standard FDA PMA-supplement practice and the existing cross-cutting finding ("no proposal targets healthy-adult enhancement... every regulatory advance is disease-labelled"), not a specific named pipeline submission I found evidence for. It is written conservatively (no named indication is claimed as filed) but flagging it as an inference rather than a documented fact.

---

## 5. Focused ultrasound

### Sources

- Barksdale et al. (2025), Molecular Psychiatry — amygdala LIFU double-blind target-engagement study; the same-session BOLD/connectivity shift and 15-session multi-visit protocol referenced in the speed and burden drivers.
- Chou et al. (2026), Epilepsia — randomized, sham-controlled crossover trial of NaviFUS-guided LIFU in 12 drug-resistant epilepsy patients (enrolled 2022-24, published 2026): safe and well tolerated but no significant antiseizure effect in the primary crossover analysis. Used in magnitude and reliability.
- Zhang et al. (2025) — skull-conformal phased-array study reporting 8.9mm axial focus at 36mm depth through ex vivo skull; used as the anchor for the forward-looking steerability claim.
- ITRUSST (2025), "ITRUSST consensus on biophysical safety for transcranial ultrasound stimulation," Brain Stimulation — sets the MI ≤1.9 nonsignificant-risk exposure limit cited in safety, reversibility, and regulation.
- ITRUSST (2026), "A standardized framework for reporting participant-experienced events in low intensity focused ultrasound neuromodulation," Brain Stimulation — cited in tolerance for cross-study chronic-exposure comparability.
- Rezai et al. (2025), "Brain injury during focused ultrasound neuromodulation for substance use disorder," Brain Stimulation — case report at 220 kHz targeting ventral striatum, with response letters (Brain Stimulation, 2026) estimating the procedure's mechanical index at 2.7-5.1, above the ITRUSST 1.9 threshold. Used in safety.
- Tsuchiyagaito et al. (2025), Neuropsychopharmacology — ALIC depression LIFU study framed as reversible (no lesion, decaying effect); used in reversibility for the claim about generalizing beyond one study.
- Connolly et al. (2025) — animal work flagging chronic high-frequency LIFU exposure as an unresolved caution; used in tolerance.
- NeuroHarmonics, "Our Journey" (2026), company statement — UCL/Oxford wearable spinout: MRI-free, no head-shaving design, currently in clinic-only essential-tremor pilots, explicitly describing "a long road of clinical validation still ahead" with no disclosed pricing or timeline. Used in invasiveness, burden, and cost.
- ClinicalTrials.gov NCT07094789, "Focused Ultrasound Neuromodulation in Patients With Treatment-Resistant Depression," Sunnybrook Health Sciences Centre — trial began July 2025, estimated completion August 2027. Used in magnitude, reliability, and regulation as the next evidentiary milestone.

### Caveats

- The Rezai et al. (2025) MI 2.7-5.1 figure and the ITRUSST MI ≤1.9 threshold both come from search-result snippets of paywalled Brain Stimulation articles (a 403 blocked direct fetch of the response letter); the numbers are consistent across two independent search snippets but I could not read the primary text to confirm authorship of the response letter itself, so I did not cite it by author name.
- I could not identify a named PI or "et al." author list for the NCT07094789 Sunnybrook trial, so it is cited as a ClinicalTrials.gov registration rather than an author-year study; treat it as a milestone date, not a peer-reviewed finding.
- Chou et al. (2026)'s null result in epilepsy is a different indication (seizures, not mood/affect) from the amygdala/ALIC/pain trials the magnitude and reliability rows track. I used it as evidence that blinded LIFU efficacy trials broadly are still hit-or-miss, which supports the existing gradual-rise shape, but it does not directly test the psychiatric endpoints those rows measure — flagging in case that's judged too indirect.
- I could not verify a NeuroHarmonics funding round, unit cost estimate, or home-use launch date beyond the company's own "long road ahead" framing; the cost and burden drivers are accordingly conservative and consistent with the existing flat-ish early trajectory, but if the company has since announced a concrete date, my driver text would need updating.
- Everything else here is consistent with the existing forecast's framing, including the deliberate hold on the safety score given Rezai's parameters sitting outside the low-intensity envelope — I did not find anything that contradicts that judgment call.

---

## 6. Neuroplastogens

### Sources

- Compass Pathways, "Compass Pathways Announces Six-Month Data from Second Phase 3 Trial Confirming Rapid and Durable Profile," investor press release, 2026 — COMP006 dual-dose design (two 25 mg doses, 3 weeks apart), ~39% Week-6 response, ~30% of retreated Part B responders reaching remission, six-month durability, and Q4 2026 NDA / H1 2027 launch timeline pending DEA scheduling. Used for magnitude, reliability, durability, regulation, cost.
- Delix Therapeutics, "Delix Presents Full Results from Phase 1 Trial of DLX-001 (Zalsupindole)," company news release, 2026 — Phase 1a/1b/MAD trial results: no SAEs, no psychotomimetic/hallucinatory/dissociative effects from 2-360 mg, CSF brain penetration, time/dose-dependent qEEG synaptic-strengthening markers, FDA-cleared at-home administration design for the forthcoming Phase 2. Used for steerability, tolerance, safety, invasiveness, burden, speed.
- Zalsupindole (DLX-001) overview, aggregating Delix Therapeutics disclosures and published pharmacology — 5-HT2A partial agonism at 17% maximal efficacy vs. 70% at 5-HT2C, non-hallucinogenic across the tested dose range, Phase 1 complete / Phase 2 pending as of 2026. Used for steerability.
- Cameron LP, Tombari RJ, Lu J, et al., "A non-hallucinogenic psychedelic analogue with therapeutic potential," Nature, 2021 — establishes the non-hallucinogenic-analog research program (tabernanthalog) that zalsupindole extends, and the baseline claim that classic 5-HT2A agonism is cortex-wide and non-selective. Used for steerability.
- Ly C, Greb AC, Cameron LP, et al., "Psychedelics Promote Structural and Functional Neural Plasticity," Cell Reports, 2018 — evidence that psychedelic-induced plasticity is a broad, non-circuit-specific structural effect, supporting the whole-brain ceiling on magnitude. Used for magnitude.
- Vollenweider FX, Vollenweider-Scherpenhuyzen MFI, Bäbler A, Vogel H, Hell D, "Psilocybin induces schizophrenia-like psychosis in humans via a serotonin-2 agonist action," NeuroReport, 1998 — ketanserin (5-HT2A antagonist) pretreatment blocks psilocybin's psychotomimetic/subjective effects, the pharmacological basis for a possible "off-switch." Used for reversibility.
- FDA psychedelics regulatory guidance discussion (as referenced in 2026 Compass Pathways earnings coverage) flagging a 12-month blinded-durability expectation for future psychedelic programs. Used for durability.
- HCPLive, "MDMA-Assisted Therapy NDA Resubmitted to FDA for PTSD," 2026 (already in the existing forecast source list) — basis for treating MDMA/Lykos's PTSD refiling as a later-decade second indication. Used for regulation.

### Caveats

- The "FDA's newly flagged 12-month durability bar" claim (durability driver) comes from secondary coverage of Compass's 2026 earnings call, not a primary FDA guidance document I could read directly — I could not locate the underlying FDA guidance text itself to confirm wording or date. Treat as directionally right but not verbatim-verified.
- "Lykos Therapeutics 2026" citation for the MDMA PTSD NDA resubmission is carried over from the existing forecast's own source list (HCPLive 2026); I did not re-verify Lykos's current corporate/regulatory status in this pass because the session's web search budget was exhausted before I could check it. If Lykos has since restructured or the filing has stalled again, the regulation driver's "adds a second indication later" framing should be revisited.
- I did not find or use fresh evidence for MDMA-specific dimension movement (tolerance, safety, reversibility) — all repeat-dosing and off-switch evidence in my drivers is psilocybin/zalsupindole-specific. This is consistent with the existing baseline notes, which are also psilocybin-heavy, but it means the MDMA/ketamine share of this technology's story is thinner in my drivers than the psilocybin share.
- Per instructions, I did not reintroduce the unverifiable 17.0%/10.6% response-rate figures; the only percentage I used (COMP006's ~39% Week-6 response at 25 mg, and ~30% of retreated Part B responders reaching remission) came directly from a source I read this pass (Compass Pathways 2026 six-month data release) and is not the same figure the earlier pass rejected.
- The zalsupindole 17%/70% efficacy figures came from a Wikipedia-sourced summary rather than the primary pharmacology paper; I'm reasonably but not fully confident in the exact percentages. Worth spot-checking against Delix's own publication if this needs to survive scrutiny.
- No change recommended to any score. All twelve drivers were written to be defensible against the existing 2026-2036 trajectory.

---

## 7. Stimulants and nootropics

### Sources

- Otsuka Announces FDA Acceptance and Priority Review of New Drug Application for Centanafadine — Otsuka US, 2026. Press materials on the July 24, 2026 approval of centanafadine (Simtriyo), the first norepinephrine-dopamine-serotonin reuptake inhibitor (NDSRI) for ADHD: mechanism, four-trial pivotal dataset, favorable abuse-liability/safety profile, adverse-event list, and PK/dosing. Supports magnitude, reliability, durability, tolerance, safety, invasiveness, reversibility, burden, speed, regulation, cost.
- Park S, Heu J, Hoener MC, Kilduff TS (2024). Wakefulness Induced by TAAR1 Partial Agonism in Mice Is Mediated Through Dopaminergic Neurotransmission. International Journal of Molecular Sciences 25(21):11351. Mechanistic basis for TAAR1 partial agonism producing wake-promotion via a dopaminergic route distinct from classical DAT/NET reversal. Supports magnitude, steerability, safety.
- Kimko HC, Cross JT, Abernethy DR (1999). Pharmacokinetics and clinical effectiveness of methylphenidate. Clinical Pharmacokinetics 37(6):457-70. Half-life/PK-ceiling basis for why extended-release formulations cannot extend duration further without accumulation risk. Supports durability.
- DEA and HHS Extend Telemedicine Prescribing Flexibilities Through 2026 — Holland & Knight, 2026. Basis for continued annual (not permanent) renewal of telehealth controlled-substance prescribing. Supports regulation.
- DEA quota increase for amphetamine active pharmaceutical ingredient, late 2025 (~25% increase to 2025 Aggregate Production Quota) — DEA, 2025, as reported in existing forecast research (Medfinder/ISSUP shortage tracker, 2026). Supports burden.

### Caveats

- Centanafadine's actual FDA approval (July 24, 2026, brand name Simtriyo) landed inside the 2026 column window this figure treats as baseline, not as a 2027+ catalyst — I used it as a fait accompli within the drivers rather than a future event, since research now shows it already happened. This slightly changes the framing implied by the existing '27-'29 approval-timing note in the source research, but does not require moving any score.
- Could not independently verify the exact figure for the late-2025 DEA amphetamine quota increase (~25%) beyond what the existing forecast research already asserted; I did not find a primary DEA Federal Register order in this pass and reused the pre-existing claim at face value.
- Could not confirm centanafadine's DEA scheduling status (non-controlled vs. scheduled) from a primary DEA source; Otsuka's own materials imply low abuse potential and no Schedule II listing but this is company-reported, not an independent DEA determination.
- Did not find author-level citation detail for solriamfetol's in vitro TAAR1 agonist binding data (Cambridge Core / CNS Spectrums preclinical pharmacology piece) with enough confidence to cite by author-year, so I omitted it rather than risk a fabricated attribution; Park et al. 2024 carries the TAAR1 mechanism claims instead.
- Web search budget for this session was exhausted after five queries, so oveporexton/orexin-agonist-class cross-check (flagged as worth checking in the task brief) and a deeper DEA quota primary-source check were not completed this pass.

---

## 8. Neuroendocrine modulators

### Sources

- Leng G. & Ludwig F., Intranasal Oxytocin: Myths and Delusions, Biological Psychiatry, 2016 — CSF penetration of intranasal oxytocin is minimal and decoupled from plasma kinetics; used for steerability's systemic-delivery ceiling.
- Huang H. et al., Chronic and acute intranasal oxytocin produce divergent social effects in mice, Neuropsychopharmacology, 2014 — repeated dosing downregulates forebrain OXTR; used for tolerance.
- Liberto C. M. et al., review/case series on testosterone-induced hypogonadotropic hypogonadism and recovery (including hCG/SERM adjuncts), 2025 — HPG-axis suppression and recovery timeline; used for durability and reversibility.
- Ory J. et al., meta-analysis of testosterone therapy and major adverse cardiovascular events/VTE risk, 2022 — safety ceiling for testosterone; used for safety.
- Alkermes, ALKS-2680 (alixorexton) Vibrance-2/Vibrance-3 program disclosures, investor communications and press, 2025 — Phase 2 idiopathic hypersomnia trial (Vibrance-3) underway, once-daily dosing design intent to differentiate from oveporexton's twice-daily regimen; used for magnitude, steerability, reliability, burden, regulation, cost.
- Centessa Pharmaceuticals, ORX750 Phase 2 data and registrational-study guidance, investor/conference disclosures, 2025 — positive Phase 2 data in NT1/NT2, registrational study teased; used for magnitude, reliability, burden, regulation, cost.
- Takeda, ORZEYFUL (oveporexton) prescribing information and danavorexton (TAK-925) infusion pharmacodynamics disclosures, 2026 — twice-daily 2 mg oral dosing confirmed (cross-checked via Drugs.com/Psychiatric Times coverage of the Aug 5, 2026 approval); danavorexton IV/SC onset within about an hour; used for invasiveness, speed.

### Caveats

- I could not independently verify exact efficacy numbers (ESS score deltas, responder rates) for ALKS-2680's Vibrance-3 or Centessa's ORX750 in idiopathic hypersomnia/NT2 — web search was unavailable for most of this session (budget exhausted) and fetches to primary sources (FDA, Takeda, Alkermes, Centessa investor pages, PubMed) mostly 404'd or returned CAPTCHA/JS-shell pages. The trial names, phase, and general direction (positive Phase 2, registrational-stage discussions) are corroborated by secondary financial-press summaries (Yahoo Finance, Nasdaq, Morgan Stanley commentary relayed via search snippets) but I would treat the specific "Vibrance-3" trial name and "ORX750 registrational study" framing as good-confidence but not FDA/company-primary-sourced.
- ALKS-2680's "designed for once-daily dosing" claim (used in the burden and durability drivers) is my inference from its positioning as a differentiator versus oveporexton's twice-daily regimen; I could not pull a primary-source PK statement confirming this. Flagged as moderate-confidence.
- Oveporexton's twice-daily, 2 mg dosing was confirmed via search snippets (Drugs.com, Psychiatric Times) after an initial Wikipedia-derived fetch incorrectly suggested once-daily dosing — the once-daily claim should be treated as a fetch-summarization error, not a real discrepancy; twice-daily is consistent with the existing baseline note and I used the twice-daily figure throughout.
- I could not verify the DEA scheduling class (II vs IV vs unscheduled) or an exact scheduling date for oveporexton; the "within 90 days" timeline is carried over from the existing forecast research (Pace section) rather than freshly confirmed, so the regulation driver leans on that prior finding rather than new verification.
- The Liberto et al. 2025 citation is reused from the existing baseline/forecast research (already vetted by a prior agent) for both durability and reversibility; I could not independently pull its full citation details (journal, exact title) during this session.
- No new evidence found that contradicts any existing trajectory in this row; the biggest genuine open question — whether orexin agonism does anything in orexin-intact healthy adults — remains unresolved as of this research pass, consistent with the original forecast's own flag on this point.

---

## 9. Gene and molecular therapy

### Sources

- Roth BL, NIH BRAIN Initiative report/registry summary — China's 2026 registration of the first seven human DREADD trials (epilepsy, Parkinson's, pain), no results published. Used for: magnitude, tolerance, regulation.
- Nagai Y, Miyakawa N, Takuwa H, et al. "Deschloroclozapine, a potent and selective chemogenetic actuator enables rapid neuronal and behavioral modulation in mice and monkeys." Nature Neuroscience, 2020 — describes DCZ's high potency, low off-target load, and behavioral effect sizes achievable with DREADD silencing in non-human primates; also basis for oral/low-dose ligand claim. Used for: magnitude, burden.
- Nagai et al. 2025 — carried over from the existing baseline research (NHP DREADD expression stability to two years, ~60-day expression peak). Used for: speed (extrapolated continuation of the same expression-kinetics finding).
- Huang Q, et al. "Targeting AAV vectors to the CNS via de novo engineered capsid-receptor interactions." Science, 2024 — Broad Institute capsid-engineering work (e.g., CAP-B10/B22 via GPR75) enabling defined CNS cell-type/receptor targeting in non-human primates, the logical next step after PHP.eB's mouse-only tropism. Used for: steerability.
- Boutin S, et al. "Prevalence of serum IgG and neutralizing factors against adeno-associated virus (AAV) types 1, 2, 5, 6, 8, and 9 in the healthy population." Human Gene Therapy, 2010 — establishes the ~40-60% pre-existing anti-AAV seroprevalence that excludes candidates from dosing. Used for: reliability.
- Verdera HC, Kuranda K, Mingozzi F. "AAV Vector Immunogenicity in Humans: A Long Journey to Successful Gene Transfer." Molecular Therapy, 2020 — anti-capsid immunity blocking re-dosing, and discussion of transgene silencing risk over time. Used for: reliability, durability.
- Magnus CJ, et al. "Ultrapotent chemogenetics for research and potential clinical applications." Science, 2019 — introduces PSAM4-GlyR/uPSEM as an orthogonal, non-muscarinic chemogenetic actuator class with reported stable repeat-dosing performance in animal studies. Used for: tolerance.
- Hordeaux J, et al. — AAV dose-dependent dorsal root ganglion (DRG) toxicity findings in non-human primate high-dose systemic/CNS AAV studies. Human Gene Therapy, 2020. Used for: safety.
- Voyager Therapeutics — VY1706/TRACER capsid IV dosing initiation and BBB-crossing biodistribution disclosures, 2026 (carried over from baseline). Used for: invasiveness.
- uniQure — AMT-130 regulatory and safety-database updates, 2026 (carried over from baseline). Used for: safety, regulation.
- Banaszynski LA, Chen LC, Maynard-Smith LA, Ooi AGL, Wandless TJ. "A rapid, reversible, and tunable method to regulate protein function in living cells using synthetic small molecules." Cell, 2006 — destabilizing-domain (DD) technology underlying inducible/silenceable transgene expression cassettes now in preclinical gene-therapy pipelines. Used for: reversibility.
- FDA. "Long Term Follow-Up After Administration of Human Gene Therapy Products" guidance, 2020 (carried over from baseline) — 5-year LTFU for non-integrating AAV, 15-year for integrating. Used for: burden.
- Cell & Gene (trade press), 2026 (carried over from baseline) — AAV manufacturing COGS vs. list-price analysis. Used for: cost.

### Caveats

- The Nagai et al. 2020 DCZ paper and the "Nagai et al. 2025" citation already embedded in the baseline research appear to be the same research group's work at two different dates; I could not independently verify a distinct 2025 Nagai publication, so I reused the baseline's own citation for the speed driver rather than inventing a new one. Treat "Nagai et al. 2025" as inherited, unverified-by-me baseline sourcing.
- Huang et al. 2024 (Science, CAP-B10/B22 capsids) is used here to justify the steerability trajectory; I am recalling this from pre-2026 training knowledge and could not re-verify it via web search this session (web search budget was exhausted before I could run confirming queries). Confidence: moderate-high, but unverified live.
- Hordeaux et al. 2020 DRG toxicity citation is likewise from training knowledge, not re-verified live this session. The underlying finding (high-dose systemic/intrathecal AAV causing DRG neuronal toxicity in NHPs) is well established in the gene-therapy safety literature, but I could not confirm this exact author/year pairing live.
- I was unable to run any new web searches for this task — the session's WebSearch budget was already exhausted (200/200) before my first query returned. All twelve drivers are built from the facts already supplied in ctx-gene.md plus my own pre-existing scientific knowledge of the AAV/DREADD/chemogenetics literature, not fresh 2026 verification. If live confirmation of China's exact 2026 DREADD trial count/indications, VY1706 trial progress, or CAP-002 root-cause details has moved since the baseline research was done, these drivers have not been checked against it.
- No trajectory in the given score table looks indefensible to me; I did not find grounds to contradict any of the fixed year-by-year scores. The magnitude and reliability rows both hinge, as the original judgment-call log already notes, on whether chemogenetics reaches first-in-human for circuit (not just motor/pain) control — I treated China's 2026 trials as necessary-but-not-sufficient for that, consistent with the existing 2031 rise rather than an earlier one.

---

## 10. Behavioral training

### Sources

- Heinz, M.V. et al., "Randomized Trial of a Generative AI Chatbot for Mental Health Treatment" (Therabot), NEJM AI, 2025 — 4-8 week RCT of a generative-AI chatbot vs waitlist, ~51% depression / ~31% anxiety symptom reduction, therapist-level working alliance, strong engagement. Supports magnitude, reliability, durability, burden.
- Cuijpers, P. et al., meta-analysis of CBT for depression, World Psychiatry / Cochrane-adjacent synthesis, 2023 — g=0.79 vs waitlist/care-as-usual across ~115 trials, 16-26% dropout, long-term advantage over pharmacotherapy. Supports magnitude, reliability, tolerance.
- Nahum-Shani, I. et al., "Just-in-Time Adaptive Interventions (JITAIs) in Mobile Health," Annals of Behavioral Medicine, 2018 — foundational framework for passive-sensing-triggered, momentary intervention delivery. Supports steerability.
- "Retention and Engagement in Digital Mental Health Interventions," JMIR Mental Health, 2026 — synthesis putting digital-intervention dropout at 19-45%. Supports reliability, burden.
- FDA Digital Health Advisory Committee meeting on generative-AI mental health devices (second meeting, Nov 2025) and related PCCP guidance (Aug 2025) — FDA proceedings, 2025. Supports safety, and the broader regulation/pace context.
- Bouton, M.E., "Context, Time, and Memory Retrieval in the Interference Paradigms of Pavlovian Learning," Psychological Bulletin, 1993 — renewal, reinstatement, and spontaneous recovery of extinguished associations. Supports reversibility.
- Pear Therapeutics Chapter 11 bankruptcy, April 2023 — FDA-cleared digital therapeutics (reSET/reSET-O) failed commercially despite clearance, due to weak real-world engagement; widely reported in trade press (e.g., MobiHealthNews, STAT News, 2023). Supports burden.
- Sloan, D.M. & Marx, B.P. et al., Written Exposure Therapy vs. Cognitive Processing Therapy noninferiority trial, JAMA Psychiatry, 2018 — 5-session WET noninferior to 12-session CPT for PTSD. Supports speed.
- Illinois Wellness and Oversight for Psychological Resources (WOPR) Act, Illinois General Assembly, 2025 (HB 1806) — bars AI from delivering therapy/psychotherapy without a licensed professional; IDFPR enforcement, fines up to $10,000 per violation. Supports regulation.
- "LLM API Pricing Comparison In 2026," CloudZero, 2026 — falling per-token inference costs across model tiers. Supports cost.

### Caveats

- WebSearch was unavailable for this task (session search budget was already exhausted before I could run any queries) and direct WebFetch attempts to FDA.gov and Becker's Behavioral Health returned 403/404. Every driver above is built on the citations already verified in the existing timeline-research.md context plus my own pre-existing knowledge of these sources — I could not do fresh independent verification this session. Treat the Nahum-Shani 2018, Sloan et al. 2018, and Pear Therapeutics citations as moderate-confidence (well-established facts I'm recalling, not re-checked today); the Heinz et al. 2025, Cuijpers et al. 2023, Bouton 1993, FDA 2025, Illinois WOPR Act, and CloudZero 2026 citations are high-confidence since they were already validated in the supplied context file.
- The regulation driver states Illinois's WOPR Act "gains enforcement teeth through 2028" and "more states copy the model into 2029" as the mechanism for the 2028/2029 score drops. This is a plausible enforcement-lag story consistent with the fixed score path (2026-27 flat at 9, drop to 8 in 2028, drop to 7 in 2029), but I could not verify a specific second wave of state bills landing exactly in 2028-29 — the original research already had Illinois, Nevada, Rhode Island, and Maine acting in 2025-26, ahead of the score's own decline. If the real driver is enforcement-date lag rather than new states, that is still defensible, but flag this as the weakest-sourced claim in the set.
- I did not find (and did not have search access to independently confirm) a peer-reviewed source narrower than the general JMIR Mental Health 2026 retention synthesis for the specific claim that AI-chatbot engagement specifically outperforms unguided digital CBT at scale outside trial conditions — the burden and reliability drivers lean on the tension between Therabot's strong trial-condition engagement and the field's general dropout rate, which is the same tension the original research already flagged as unresolved (see "Behavioral training hinges on whether AI-delivered adherence holds outside trial conditions" in the judgment-calls section). I did not resolve that open question; my drivers describe it as an active, capping tension rather than claiming it's settled.

---
