# Programmable Mind State — Ten-Year Timeline (2026–2036)

Forecast data for every technology × dimension in the Programmable Mind State analysis, plus the research and reasoning behind each trajectory. `data.ts` holds the 2026 baseline as argued in the source document; this file adds the ten projected years that follow.

Researched August 2026. Ten parallel agents, one per technology, each grounding its trajectory against four questions: how the research frontier is moving, how fast milestones are actually landing, where regulation is heading, and what drives the cost curve.

## Scoring convention

Every dimension is 1–10 and **higher is always better for the technology**. That inverts the plain-English reading of several of them:

| Dimension | 10 means | 1 means |
|---|---|---|
| Magnitude | Large change in the intended mental state | Negligible change |
| Steerability | Hits only the intended process | Hits everything at once |
| Reliability | Nearly all users get the intended effect | Almost nobody does |
| Durability | Effect lasts indefinitely after one treatment | Effect ends with clearance |
| Tolerance | Improves with repetition | Rapid tolerance destroys the effect |
| Safety | Harmless | Severe risk in normal use |
| Invasiveness | Nothing enters the body | Surgery plus permanent alteration |
| Reversibility | Can be stopped or undone instantly | Effectively permanent |
| Burden | Near-zero user effort ("take a pill") | Enormous ongoing effort |
| Speed | Near-instant to peak effect | Weeks to months |
| Regulation | Freely sellable to a healthy adult for enhancement | No legal pathway |
| Cost | Pennies per user | Six figures per user |

## Forecasting rules the agents worked under

1. Integers 1–10 only.
2. Trajectories gradual and mostly monotonic. Year-over-year moves of 0 or 1 are normal; a 2-point jump needs a named catalyst.
3. Dimensions bound by physics or mechanism barely move. A surgical implant does not become non-invasive; 5-HT2A tachyphylaxis is pharmacology, not an engineering problem.
4. Movement belongs where engineering, evidence accumulation, regulation, and scale actually operate.
5. Ten years is not that long. Most scores end within 1–3 points of where they started.
6. Erosion is allowed. Where evidence is deteriorating or regulation tightening, scores decline.

---

## Cross-cutting findings

**Nothing opens an enhancement pathway by 2036.** This is the single most consistent result across all ten technologies. Every regulatory advance found in research — the Flow tDCS PMA, the dystonia HDE-to-PMA conversion, psilocybin's priority voucher, oveporexton's approval, AMT-130's accelerated pathway, adolescent TMS clearance — is disease-labelled. Not one agent found a proposed route for selling affective enhancement to a healthy adult. The regulation column stays low for everything except the two entries that were already high (consumer e-stim's wellness carve-out and behavioral training's unregulated coaching space), and behavioral training's actually *falls*.

**The regulation ceiling and the efficacy ceiling are on opposite ends of the table.** Everything that works is unshippable; everything shippable barely works. Ten years does not resolve this, and in the one case where a technology is both effective and freely sellable (behavioral training), the binding constraint is burden — which barely moves.

**Two technologies got meaningfully *worse* than the unresearched draft.** Focused ultrasound and TMS both had optimistic first-pass trajectories that research corrected downward. FUS has no FDA IDE pathway or standardized dosing at all, pushing clearance later than assumed. TMS's accelerated protocols replicate at 16–25% remission in naturalistic settings against ~80% in trial cohorts.

**Cost falls almost everywhere, but rarely fast enough to matter.** Only three entries reach the top of the cost scale by 2036: stimulants (already there), consumer e-stim, and behavioral training — where LLM inference at $0.15–0.40 per user per month is genuinely collapsing marginal cost. Gene therapy's manufacturing COGS can reach ~$10k/dose at scale while patient-facing prices stay at $850k–$3.5M, a 10–100× gap that does not close.

**The final year is a plateau, and that is a result rather than an artifact.** Extending to 2036 moved only 4 of 120 dimensions: cortical reliability (7→8), consumer e-stim steerability (6→7), and focused ultrasound's burden (7→8) and regulation (5→6). Every agent, asked independently, concluded its technology had converged — either onto a mechanistic ceiling it cannot cross, or onto a regulatory wall that a further year does not breach. The three that still move are the two least-mature entries plus the one whose wearable form factor is still arriving. Nothing about the shape of the analysis changes in the eleventh year.

**Behavioral training is the only entry whose regulation score declines.** Illinois, Nevada, Rhode Island, and Maine banned commercial AI therapy delivery across 2025–26, with fines up to $10k. This is a real, durable tightening of what was the freest space in the analysis.

---

## 1. Deep brain stimulation

**Frontier** — Medtronic's BrainSense Adaptive DBS (closed-loop, biomarker-driven) won FDA approval in Feb 2025 and is now shipping to Percept patients. Real closed-loop DBS did not exist in 2023.

**Pace** — Dystonia moved from 20-year HDE status to full PMA approval in Dec 2025. Depression pivotals TRANSCEND (US) and FORESEE III (EU CE mark) are running now, with readouts plausible around 2029–2031.

**Regulation** — No healthy-adult enhancement pathway in evidence. Progress is confined to expanding disease indications via PMA and HDE routes.

**Cost** — US DBS remains $35–100k+ per patient. The device market grows via volume (~$1.84B to $3.8B by 2033) rather than falling unit price; robotic-assisted implantation trims surgical cost only modestly.

| Dimension | '26 | '27 | '28 | '29 | '30 | '31 | '32 | '33 | '34 | '35 | '36 | Driver |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Magnitude | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | At ceiling; mechanism-bound, unchanged by adaptive hardware |
| Steerability | 6 | 6 | 7 | 7 | 7 | 8 | 8 | 8 | 9 | 9 | 9 | BrainSense Adaptive plus directional-lead electrode ID maturing across centers |
| Reliability | 6 | 6 | 7 | 7 | 7 | 8 | 8 | 8 | 9 | 9 | 9 | ADAPT-PD-scale evidence; TRANSCEND/FORESEE III readouts ~2029–31 |
| Durability | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | Persists while powered; mechanism-bound |
| Tolerance | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 9 | 9 | 9 | 9 | Closed-loop adjustment directly targets fixed-parameter habituation |
| Safety | 3 | 3 | 4 | 4 | 4 | 5 | 5 | 5 | 6 | 6 | 6 | Robotic stereotactic implantation; fewer over-stimulation effects |
| Invasiveness | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | Remains surgical; no non-surgical route visible by 2036 |
| Reversibility | 7 | 7 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 8 | 8 | Stays stoppable; explant technique improves modestly |
| Burden | 5 | 6 | 6 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 8 | BrainSense Electrode Identifier cuts programming time ~85% |
| Speed | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | Near-instant on-stimulation effect is mechanism-bound |
| Regulation | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | Dystonia HDE→PMA shows disease-pathway maturation only |
| Cost | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 4 | 4 | 4 | Still $35–100k+; market grows on volume, not unit price |

**2036 outlook** — DBS has matured into a reliable, well-engineered but still surgical, expensive, disease-only therapy. The ceiling is technical maturity, not a missing breakthrough.

**Sources**
- Medtronic earns FDA approval for the world's first Adaptive deep brain stimulation system for Parkinson's — Medtronic, 2025
- Deep brain stimulation succeeds for 1 in 2 patients with treatment-resistant severe depression and anxiety in trial — Medical Xpress, 2025
- Medtronic earns FDA approval for expanded deep brain stimulation labeling for Dystonia — Medtronic, 2025
- Deep Brain Stimulation Devices Market Size & Forecast 2033 — Coherent Market Insights, 2026
- Unlocking the future of deep brain stimulation: innovations, challenges, and promising horizons — PMC, 2024

---

## 2. Cortical interfaces

**Frontier** — Precision Neuroscience's Layer7 (1,024-electrode thin-film) won FDA 510(k) clearance in 2025 for recording *and* stimulation, and multi-thousand-channel research arrays now exist (5,376-channel systems; a 65,536-electrode subdural device). This is capability 2023 lacked. Affective or valence control remains entirely undemonstrated.

**Pace** — Neuralink scaled from 7 to 26+ implanted patients through 2026 with international expansion (UK, UAE, Canada). Synchron launches its 2026 pivotal COMMAND trial toward a first BCI PMA. China's national roadmap targets core breakthroughs by 2027.

**Regulation** — Motor and speech PMA tracks stay disease-only. No pathway exists or is proposed for healthy-adult affective enhancement via implants.

**Cost** — No commercial BCI pricing exists yet. Analysts project $50–100k+ per patient at first launch on cochlear and DBS comparables, with roughly $150–200M development cost per device. LASIK-level pricing is explicitly years away.

| Dimension | '26 | '27 | '28 | '29 | '30 | '31 | '32 | '33 | '34 | '35 | '36 | Driver |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Magnitude | 3 | 3 | 3 | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 5 | Layer7 records and stimulates, but no affective demonstration in any trial |
| Steerability | 5 | 6 | 6 | 7 | 7 | 7 | 8 | 8 | 8 | 9 | 9 | Multi-thousand-channel arrays already demonstrated, ahead of expectation |
| Reliability | 3 | 4 | 4 | 5 | 5 | 6 | 6 | 6 | 7 | 7 | 8 | Synchron's 6/6 COMMAND patients met endpoints; decoder iterations compound |
| Durability | 3 | 3 | 3 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | Effects stay stimulation-locked; no persistence in 2026 data |
| Tolerance | 5 | 5 | 5 | 5 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | Adaptive decoders offset drift; no repeated-affective-use data exists |
| Safety | 4 | 4 | 5 | 5 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | COMMAND met safety endpoint, zero device-related SAEs; Layer7 cleared as lower-risk class |
| Invasiveness | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 4 | 4 | 4 | 4 | Shift to endovascular Stentrode and subdural thin-film vs penetrating arrays |
| Reversibility | 6 | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | 7 | Endovascular retrievability; Layer7's 30-day removable design |
| Burden | 5 | 5 | 6 | 6 | 6 | 7 | 7 | 7 | 8 | 8 | 8 | Automated robotic implantation and higher-volume production |
| Speed | 8 | 8 | 8 | 8 | 8 | 9 | 9 | 9 | 9 | 9 | 9 | Already near-instant electrical onset |
| Regulation | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | Pivotals target PMA for paralysis/speech ~2029–31; enhancement undefined |
| Cost | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 4 | 4 | 4 | First commercial BCIs projected $50–100k+ |

**2036 outlook** — A mature, reliable medical technology for motor and speech disease that remains mechanistically boxed out of safe, non-invasive, affordable affective enhancement.

**Sources**
- Neuralink Reaches 26th Patient in Ongoing BCI Trials — Basenor, 2026
- Synchron Preps 2026 Stentrode Pivotal Trial For First BCI PMA — The Robotics Media, 2026
- Precision Neuroscience Receives FDA Clearance for High-Resolution Cortical Electrode Array — GlobeNewswire, 2025
- A wireless subdural-contained BCI with 65,536 electrodes and 1,024 channels — Nature Electronics, 2025
- How Much Does a Brain Implant Cost? 2026 Pricing Guide — bciintel.com, 2026

---

## 3. Transcranial magnetic stimulation

**Frontier** — Connectivity-guided personalized targeting (SAINT-style) is spreading clinically and indications are expanding to adolescents. But simplified, non-neuronavigated accelerated protocols replicate markedly weaker than the precision originals.

**Pace** — Steady and incremental. New adolescent-depression FDA clearance in 2026, ongoing bipolar/autism/inpatient-TRD trials, courses compressing from five days toward two. The gap that matters: naturalistic remission runs 16–25% against ~80% in trial populations.

**Regulation** — FDA and payers keep expanding disease-specific indications and coverage (Medicare/Medicaid MDD, new adolescent clearance) with zero movement toward a healthy-adult enhancement pathway.

**Cost** — Per-session Medicare reimbursement is roughly flat at $175–235. Market analysts still flag device and equipment cost as a major adoption restraint; early-stage home-use devices are the only visible future lever.

| Dimension | '26 | '27 | '28 | '29 | '30 | '31 | '32 | '33 | '34 | '35 | '36 | Driver |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Magnitude | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | 7 | 8 | 8 | Connectivity targeting refines which cortex is hit, not field strength |
| Steerability | 5 | 5 | 6 | 6 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | Personalized fMRI targeting spreads from 17 to 34+ clinics by end-2026 |
| Reliability | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 8 | 8 | 8 | Naturalistic 16–25% remission vs ~80% in trials; access is the bottleneck |
| Durability | 5 | 5 | 5 | 5 | 5 | 6 | 6 | 6 | 6 | 7 | 7 | Continuation/booster protocols emerging; real-world relapse still common |
| Tolerance | 7 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | Maintenance protocols improve durability across repeated courses |
| Safety | 8 | 8 | 8 | 8 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | Expanding pediatric and adult safety databases |
| Invasiveness | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | Nothing enters the body; ceiling is fixed |
| Reversibility | 7 | 7 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 8 | 8 | Non-permanent; better titration allows earlier stopping |
| Burden | 3 | 3 | 4 | 4 | 5 | 5 | 5 | 6 | 6 | 6 | 6 | Five-day SAINT and two-day adolescent protocols spread; home TMS unproven |
| Speed | 5 | 5 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | 7 | Two-day adolescent iTBS beats SAINT's original five-day timeline |
| Regulation | 3 | 3 | 3 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 5 | Disease indications expand; no enhancement signal anywhere |
| Cost | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 5 | 6 | 6 | 6 | Equipment cost a persistent restraint; home devices a distant lever |

**2036 outlook** — Dominated by a hard mechanistic ceiling — superficial cortex only — with the decade's gains coming from targeting precision, protocol compression, and reimbursement rather than any new capability.

**Sources**
- SAINT-TMS: A New Era of Accelerated Brain Stimulation for Severe Depression — UTHealth Psychiatry, 2026
- Personalized continuation therapy with SAINT for maintaining remission in TRD — Transcranial Magnetic Stimulation, 2026
- Extended course accelerated iTBS as ECT substitute — Neuropsychopharmacology, 2024
- TMS Billing, Insurance Coverage & CPT Codes 2026 — Mozu Health, 2026
- Transcranial Magnetic Stimulator Market Forecast 2026–2033 — Coherent Market Insights, 2026

---

## 4. Consumer electrical stimulation

**Frontier** — Temporal interference stimulation is now demonstrated in humans (Nature Biomedical Engineering, 2026) targeting GPi and hippocampus. This proves deep, focal, non-invasive electrical stimulation is physically possible — the ceiling that caps this entire category. But it is clinical-stage hardware, not consumer, and does not reach home devices within the window.

**Pace** — The FDA-cleared Flow FL-100 launches Q2 2026 on a strong pivotal trial (58% vs 29% remission). Against that, a 2026 meta-analysis of 31 sham-controlled trials (n=1,833) shows real but heterogeneous effects that do not guarantee remission.

**Regulation** — The Dec 2025 PMA opens a disease-treatment pathway for home tDCS. Healthy-adult enhancement is still sold only under the pre-existing general-wellness carve-out, with no explicit enhancement approval.

**Cost** — Consumer devices already retail at $100–800 from entry to medical grade, with the market growing ~8.9% annually through 2035 and wearable competition pushing toward commodity pricing.

| Dimension | '26 | '27 | '28 | '29 | '30 | '31 | '32 | '33 | '34 | '35 | '36 | Driver |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Magnitude | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 4 | 4 | 4 | Multichannel precision tDCS separates better from sham; TI not consumer-grade |
| Steerability | 2 | 2 | 2 | 3 | 3 | 4 | 4 | 5 | 5 | 6 | 7 | Temporal interference proves focal deep targeting, slowly informing montages |
| Reliability | 3 | 3 | 3 | 4 | 4 | 4 | 5 | 5 | 5 | 6 | 6 | Flow's 58% vs 29% is strong; 31-trial meta-analysis shows persistent heterogeneity |
| Durability | 3 | 3 | 3 | 3 | 4 | 4 | 4 | 4 | 5 | 5 | 5 | Optimized multi-session protocols extend after-effects modestly |
| Tolerance | 6 | 6 | 6 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **Declines** — homeostatic metaplasticity concerns persist unresolved |
| Safety | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | PMA approval and 55,000+ EU/UK users confirm benign profile at ceiling |
| Invasiveness | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | Ceiling dimension, unaffected by any research trend |
| Reversibility | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | Already instantly stoppable; no mechanism to move it |
| Burden | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | 8 | 8 | Wearable/handheld segment trends toward automated home use |
| Speed | 5 | 5 | 5 | 5 | 5 | 5 | 6 | 6 | 6 | 6 | 6 | Flow's pivotal needed 10 weeks to peak; no faster protocol emerging |
| Regulation | 8 | 8 | 8 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | First home-tDCS PMA opens further disease clearances; no enhancement route |
| Cost | 9 | 9 | 9 | 9 | 9 | 10 | 10 | 10 | 10 | 10 | 10 | Devices retail $100–500; ~8.9% CAGR pushes toward commodity |

**2036 outlook** — Settles into a mature, cheap, safe commodity whose ceiling is fundamentally mechanistic rather than economic or regulatory.

**Sources**
- FDA Approves First At-Home Brain Stimulation Device for Depression — Forbes, 2026
- US FDA approves home-delivered tDCS for treating depression — Brain Stimulation, 2026
- Temporal interference stimulation for deep brain neuromodulation in humans — Nature Biomedical Engineering, 2026
- Systematic review and meta-analysis of transcranial electrical stimulation RCTs in depression — ScienceDirect, 2025–26
- tDCS Devices Market Forecast 2026–2034 — Data Insights Market, 2026

---

## 5. Focused ultrasound

**Frontier** — New acoustic-coupling sham hardware (2025) finally enables genuine double-blind human LIFU trials, which the field previously could not run. Amygdala and ALIC-depression studies show target engagement with modest effects.

**Pace** — Small double-blind RCTs (n=21–47) for depression, amygdala, and thalamic pain are reading out across 2025–26. Epilepsy, tremor, and larger pivotal trials remain years out.

**Regulation** — No FDA IDE pathway *or standardized dosing protocol* exists for LIFU neuromodulation as of 2026. This is later-stage than the draft assumed and pushes any clearance out; healthy-adult enhancement is a distant prospect.

**Cost** — Systems still rely on custom multi-element arrays and MRI neuronavigation. The NeuroHarmonics wearable helmet only spun out of the 2025 UCL/Oxford work in 2025 and has not yet driven costs down.

| Dimension | '26 | '27 | '28 | '29 | '30 | '31 | '32 | '33 | '34 | '35 | '36 | Driver |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Magnitude | 4 | 4 | 4 | 5 | 5 | 6 | 6 | 6 | 7 | 7 | 7 | Double-blind amygdala/ALIC/NAc studies show real but modest effects |
| Steerability | 8 | 8 | 9 | 9 | 9 | 10 | 10 | 10 | 10 | 10 | 10 | 256-element phased array and personalized acoustic metamaterials |
| Reliability | 4 | 4 | 4 | 5 | 5 | 5 | 6 | 6 | 7 | 7 | 7 | True double-blind trials only starting 2025–26, still sub-pivotal scale |
| Durability | 3 | 3 | 4 | 4 | 4 | 5 | 5 | 5 | 6 | 6 | 6 | No new durability data; single-treatment persistence under-studied |
| Tolerance | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 8 | 8 | 8 | Repeated-exposure data limited per 2026 reviews; gains stay conservative |
| Safety | 8 | 8 | 8 | 8 | 8 | 9 | 9 | 9 | 9 | 9 | 9 | Reviews still flag adverse-effect thresholds as poorly characterized |
| Invasiveness | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | At ceiling; acoustic mechanism never enters the body |
| Reversibility | 8 | 8 | 8 | 8 | 8 | 9 | 9 | 9 | 9 | 9 | 9 | Effects remain transient and stoppable |
| Burden | 4 | 4 | 4 | 5 | 5 | 5 | 6 | 6 | 7 | 7 | 8 | Wearable helmet spinout is real but pre-commercial |
| Speed | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 8 | 8 | 8 | No faster onset yet; incremental protocol optimization only |
| Regulation | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 4 | 4 | 5 | 6 | No IDE pathway or standardized dosing as of 2026, pushing clearance later |
| Cost | 5 | 5 | 5 | 5 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | Custom arrays plus MRI neuronavigation; wearables too early to cut cost |

**2036 outlook** — The ceiling is set by thin long-run safety and efficacy data and a still-nascent regulatory pathway, not by the technology's inherent precision.

**Sources**
- Acoustic Coupling for Double-Blind Human LIFU Neuromodulation — bioRxiv, 2025
- Low-intensity transcranial focused ultrasound amygdala neuromodulation: double-blind target engagement study and unblinded single-arm trial — Molecular Psychiatry, 2025
- Reversible modulation of a deep white matter surgical target for depression with low-intensity focused ultrasound — Neuropsychopharmacology, 2025
- Ultrasound helmet enables deep brain stimulation without surgery — UCL/Oxford via Medical Xpress, 2025
- LIFU Neuromodulation in Psychiatric Disorders: Mechanisms, Models, and Missing Links — ScienceDirect, 2026

---

## 6. Neuroplastogens

**Frontier** — Compass Pathways posted two positive Phase 3 trials for COMP360 in treatment-resistant depression across 2025–26, the first positive psychedelic Phase 3s ever run. Non-hallucinogenic analogs (Delix's DLX-001) have only just entered Phase 1 human dosing, so the structural lever that would fix burden and safety is a decade out, not a near-term one.

**Pace** — NDA rolling review completes Q4 2026, with FDA priority vouchers compressing review to one or two months and an approval decision expected late 2026.

**Regulation** — An April 2026 executive order plus three National Priority Vouchers (Compass psilocybin, Usona psilocybin, Transcend methylone) and ibogaine IND clearance accelerate disease pathways sharply. But FDA requires approved use in a supervised clinical setting — which is exactly what keeps burden pinned.

**Cost** — Real-world psilocybin therapy runs $3,500–9,500 per course and REMS infrastructure is still unbuilt, so cost likely *rises* briefly after approval before scale and generics bring it down.

| Dimension | '26 | '27 | '28 | '29 | '30 | '31 | '32 | '33 | '34 | '35 | '36 | Driver |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Magnitude | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | Two independent Phase 3s confirm durable MADRS reduction; whole-brain ceiling holds |
| Steerability | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 5 | 6 | 6 | DLX-001 only began first-in-human 2026; circuit selectivity a decade away |
| Reliability | 5 | 6 | 6 | 6 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | Back-to-back positive Phase 3s and standardized protocols |
| Durability | 8 | 8 | 8 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | Six-month data confirm durability; maintenance dosing locks in gains |
| Tolerance | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 5 | 6 | 6 | 5-HT2A tachyphylaxis unchanged; analogs too early to offset before 2030s |
| Safety | 5 | 5 | 5 | 5 | 6 | 6 | 6 | 7 | 7 | 8 | 8 | Analogs still Phase 1 in 2026, pushing safety gains to early-mid 2030s |
| Invasiveness | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | Oral/IV under mandated supervision; no structural change |
| Reversibility | 3 | 3 | 3 | 3 | 4 | 4 | 4 | 5 | 5 | 6 | 6 | Shorter-acting analogs years from clinic |
| Burden | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 6 | 6 | 7 | 7 | FDA requires supervised clinical setting, keeping session burden high |
| Speed | 8 | 8 | 8 | 8 | 8 | 9 | 9 | 9 | 9 | 9 | 9 | Onset already near-instant |
| Regulation | 4 | **6** | 6 | 7 | 7 | 7 | 7 | 7 | 8 | 8 | 8 | Executive order plus priority vouchers drive TRD/PTSD approval; enhancement blocked |
| Cost | 8 | **7** | 7 | 8 | 8 | 8 | 8 | 9 | 9 | 9 | 9 | **Dips first** — REMS build-out adds overhead before generics bring it down |

**2036 outlook** — Converges on a durable but structurally capped profile: strong disease-indication numbers plateaued by unfixable whole-brain non-selectivity, and a persistent wall between medical approval and healthy-adult enhancement.

**Sources**
- Compass Pathways Announces FDA Granted NDA Rolling Review and National Priority Voucher — Compass Pathways, 2026
- MDMA-Assisted Therapy NDA Resubmitted to FDA for PTSD — HCPLive, 2026
- Psychedelics and the Executive Order: From Schedule I to Treatment Priority — Foley & Lardner, 2026
- FDA moves to fast-track review of psilocybin and methylone for mental health — CNN, 2026
- Psilocybin-assisted therapy for TRD in the US: a model-based cost-effectiveness analysis — Translational Psychiatry, 2025

---

## 7. Stimulants and nootropics

**Frontier** — Mostly static, and that is the finding. No fundamentally new stimulant mechanism is nearing market. The real movement is centanafadine (triple reuptake inhibitor, positive pivotal Phase 3 topline), cleaner wake-promoting TAAR1-adjacent agents like solriamfetol already used off-label, and 2026 FDA approvals of ultra-long-acting 16-hour formulations.

**Pace** — Centanafadine and CTx-1301 are in Phase 3 for ADHD with plausible approvals around 2027–2029. No readout beyond that reaches a healthy-adult enhancement indication.

**Regulation** — DEA and HHS have extended pandemic-era telehealth controlled-substance prescribing year by year (through Dec 2026, a fourth extension). Permanent rules under review would *exclude* Schedule II stimulants from general telemedicine registration, reserving them for specialist Advanced Registration. Meanwhile a three-plus-year amphetamine shortage persists despite a 25% DEA quota increase in late 2025.

**Cost** — Per-dose generic pricing remains pennies. The shortage is an availability problem (2% availability mid-2026), not a price problem — so it hits burden, not cost.

| Dimension | '26 | '27 | '28 | '29 | '30 | '31 | '32 | '33 | '34 | '35 | '36 | Driver |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Magnitude | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | Centanafadine and novel-mechanism agents diffuse in; effect sizes stay modest |
| Steerability | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 4 | 5 | 5 | 5 | Triple reuptake inhibitors and TAAR1-class marginally more selective |
| Reliability | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 9 | 9 | Already near ceiling; new formulations add little |
| Durability | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | Ultra-long-acting 16-hour formulations approved 2026; that is the whole gain |
| Tolerance | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | Rapid motivational tolerance is intrinsic to the mechanism |
| Safety | 5 | 5 | 5 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | Newer non-classical agents show cleaner cardiovascular/abuse profiles |
| Invasiveness | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | Oral dosing at ceiling |
| Reversibility | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | Bound by half-life; structurally unchanged |
| Burden | 9 | **8** | 8 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | **Dips** — amphetamine shortage adds sourcing friction until quotas resolve it |
| Speed | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | Onset within an hour, near ceiling |
| Regulation | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | Flat — telehealth renewed annually; permanent rules exclude Schedule II |
| Cost | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | Generic pricing at floor; shortage affects availability, not price |

**2036 outlook** — A fully mature category whose trajectory has flattened into pharmacological and regulatory facts — tolerance, durability, scheduling — that no incremental drug development can move.

**Sources**
- DEA and HHS Extend Telemedicine Prescribing Flexibilities Through 2026 — Holland & Knight, 2026
- DEA Extends Telemedicine Flexibilities to Ensure Continued Access to Care — DEA.gov, 2025
- Adderall Shortage Timeline and Tracker — Medfinder/ISSUP, 2026
- Otsuka Announces Positive Topline Phase 3 Results for Centanafadine in ADHD — Otsuka US
- Wakefulness Induced by TAAR1 Partial Agonism Mediated Through Dopaminergic Neurotransmission — PMC, 2024–25

---

## 8. Neuroendocrine modulators

**Frontier** — ORZEYFUL (oveporexton) was approved Aug 5, 2026 as the first orexin agonist. The pipeline — Centessa's ORX750, Alkermes' ALKS2680, danavorexton — shows efficacy in idiopathic hypersomnia, a *less* orexin-deficient population than narcolepsy type 1. That partially resolves the category's central question in the optimistic direction, though genuinely healthy-volunteer studies are only entering Phase 1 as of 2026.

**Pace** — DEA scheduling is due within 90 days of approval. Idiopathic hypersomnia and NT2 registrational readouts are expected 2026–2029.

**Regulation** — FDA approval is narrow and disease-labelled. Scheduling and specialty-pharmacy distribution resolve access by 2027, but no healthy-adult enhancement pathway exists anywhere in the pipeline. TRT clinics remain a real parallel gray channel.

**Cost** — An oral small molecule rather than a costly peptide, but branded specialty-pharmacy pricing typical of narcolepsy drugs keeps cost high. Four-plus competing agonists compress price only gradually, with no generics within the decade.

| Dimension | '26 | '27 | '28 | '29 | '30 | '31 | '32 | '33 | '34 | '35 | '36 | Driver |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Magnitude | 4 | 5 | 5 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | IH trials show real effect beyond frank orexin deficiency, raising the ceiling |
| Steerability | 4 | 4 | 5 | 5 | 5 | 5 | 6 | 6 | 6 | 6 | 6 | OX2R-selective second-gen agonists; delivery stays systemic |
| Reliability | 4 | 5 | 5 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | Label expansion into NT2/IH broadens who responds |
| Durability | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | Still a dosed oral agent tracking exposure; no depot in evidence |
| Tolerance | 5 | 5 | 5 | 5 | 5 | 6 | 6 | 6 | 6 | 6 | 6 | OXTR downregulation and HPG suppression concerns stand |
| Safety | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | 8 | 8 | Post-launch real-world data plus benign cognitive profile |
| Invasiveness | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | Oral small-molecule route unchanged |
| Reversibility | 6 | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | 7 | Shorter-acting next-gen agonists by early 2030s |
| Burden | 8 | 8 | 8 | 8 | 8 | 9 | 9 | 9 | 9 | 9 | 9 | Once-daily/long-acting formulations as the pipeline matures |
| Speed | 6 | 6 | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | Wake/cognitive effects within one to seven hours post-dose |
| Regulation | 4 | **6** | 6 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 8 | DEA scheduling resolves ~90 days post-approval, enabling 2027 launch |
| Cost | 7 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 9 | 9 | 9 | Branded specialty pricing offsets cheap generic hormones |

**2036 outlook** — Capped less by pharmacology than by its disease-only regulatory ceiling and irreducibly systemic delivery.

**Sources**
- FDA Approves Takeda's ORZEYFUL (oveporexton) for Narcolepsy Type 1 — Takeda/BusinessWire, 2026
- Advances in Orexin-Based Therapies: Key Updates From the Past 6 Months — NeurologyLive, 2026
- Effects of Oveporexton on Cognition in Narcolepsy Type 1: Secondary Analysis of RCT — PMC, 2026
- Safety and pharmacodynamics of a single infusion of danavorexton in idiopathic hypersomnia — PMC
- Oxytocin-augmented psychotherapy for depression: meta-analysis — 2025

---

## 9. Gene and molecular therapy

**Frontier** — BBB-crossing IV AAV capsids (Voyager TRACER / VY1706) begin human dosing in 2026, showing 50–75% targeted brain transduction with liver detargeting. But **no chemogenetic or optogenetic circuit-control construct has entered human trials, and none is scheduled through 2036.** That single fact caps the entire category: what advances is knockdown-type AAV, not circuit control.

**Pace** — AMT-130 filed an accelerated-approval BLA in Q3 2026 after the FDA reversed its earlier position on the 3-year data.

**Regulation** — AMT-130 nears the first CNS-AAV approval around 2027, opening a disease-modifying precedent. Psychiatric and healthy-enhancement use remain entirely unaddressed.

**Cost** — Manufacturing COGS can reach ~$10k/dose at scale, but real patient-facing CNS-AAV pricing still runs $850k–$3.5M. A 10–100× cut is still needed and does not arrive in this window.

**Safety caveat worth flagging:** a patient death occurred in the Capsida CAP-002 BBB-crossing IV AAV trial, which tempers the safety trajectory despite AMT-130's reassuring long-term data.

| Dimension | '26 | '27 | '28 | '29 | '30 | '31 | '32 | '33 | '34 | '35 | '36 | Driver |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Magnitude | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | Zero chemogenetic human trials found or scheduled; only knockdown AAV advances |
| Steerability | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 9 | 9 | 9 | 9 | Voyager TRACER capsids: 50–75% targeted transduction, IV dosing 2026 |
| Reliability | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 4 | 4 | 4 | 4 | AMT-130's 3-year 75% slowing builds AAV-CNS precedent, not circuit control |
| Durability | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | Single-administration durability already maximal |
| Tolerance | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | 8 | 8 | Cleaner DREADD agonists reported preclinically, untested in humans |
| Safety | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 4 | 4 | 4 | 4 | Capsida CAP-002 patient death tempers gains despite AMT-130 reassurance |
| Invasiveness | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | IV BBB-crossing capsids begin displacing intracranial surgery, slowly |
| Reversibility | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | No inducible/off-switch constructs reaching clinic |
| Burden | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | IV dosing vs neurosurgery, plus prospect of oral ligands |
| Speed | 2 | 2 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | ~60-day AAV expression peak is fixed biology |
| Regulation | 1 | 1 | 2 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | 3 | AMT-130 BLA sets first CNS-AAV precedent, disease-only |
| Cost | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 3 | 3 | 3 | 3 | COGS ~$10k/dose at scale, but pricing still $850k–$3.5M |

**2036 outlook** — Mechanistically mature but human-untested for circuit-level mind-state control, so it plateaus well short of a shippable enhancement product.

**Sources**
- uniQure Provides Regulatory Update on AMT-130 for Huntington's Disease — uniQure, 2026
- FDA and uniQure Align on Accelerated Approval Pathway for AMT-130 — Rare Disease Advisor, 2026
- Voyager Demonstrates Single IV Dose of VY1706 Well Tolerated; Trial Initiation H2 2026 — Voyager Therapeutics, 2026
- Reporter's Notebook: Child Dies in Brain-Targeting AAV Gene Therapy Trial — Inside Precision Medicine, 2026
- Advances in chemogenetics: a review of DREADDs in psychiatric disorders — Molecular Psychiatry, 2025

---

## 10. Behavioral training

**Frontier** — Dartmouth's Therabot RCT (NEJM AI, 2025) showed a fully generative AI chatbot cut depression 51% and anxiety 31%, with therapist-level working alliance and high four-week engagement. This is the first proof that generative AI can deliver clinical-grade behavioral treatment — the one credible route at the burden floor.

**Pace** — FDA's Digital Health Advisory Committee held its second generative-AI mental-health meeting in Nov 2025 and issued PCCP guidance in Aug 2025, but no generative-AI therapy device is cleared yet. The pathway is forming, not arrived.

**Regulation** — This is the one entry where regulation *tightens*. Illinois, Nevada, Rhode Island, and Maine now ban commercial AI therapy delivery (2025–26, fines up to $10k); Utah instead mandates disclosure. A genuine, fragmented tightening layered onto an otherwise permissive wellness space.

**Cost** — LLM inference for a chatbot already costs $0.15–0.40 per user per month and keeps falling with cheaper model tiers, confirming that marginal cost is collapsing toward pennies.

**The number that matters most:** burden, at the floor of 1, is why behavioral training fails despite being the only entry acting directly on the target mechanism. Research says AI delivery is genuinely attacking it — but broader 2025–26 digital-therapeutic data still shows 19–45% dropout, so the gain is hard-won and slow. Burden reaches only 4 by 2035 and holds there through 2036 — the agent judged the dropout floor structural rather than a deployment problem AI has solved.

| Dimension | '26 | '27 | '28 | '29 | '30 | '31 | '32 | '33 | '34 | '35 | '36 | Driver |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Magnitude | 6 | 6 | 6 | 7 | 7 | 7 | 7 | 7 | 8 | 8 | 8 | Therabot RCT showed AI-delivered effect sizes rivaling outpatient therapy |
| Steerability | 7 | 7 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | 8 | 8 | Passive sensing enables finer targeting of the evocable association |
| Reliability | 5 | 5 | 6 | 6 | 7 | 7 | 7 | 8 | 8 | 8 | 8 | Personalized LLM delivery improves response; 19–45% dropout caps gains |
| Durability | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | Near ceiling; extinction persistence is mechanism-bound |
| Tolerance | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | Improvement-with-repetition is intrinsic and already maxed |
| Safety | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | 9 | No new safety signal; FDA scrutiny concerns claims, not method harm |
| Invasiveness | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | Nothing enters the body; permanently at ceiling |
| Reversibility | 5 | 5 | 5 | 5 | 5 | 6 | 6 | 6 | 6 | 6 | 6 | Modular AI-adjustable protocols slowly ease undoing associations |
| Burden | 1 | 1 | 1 | 2 | 2 | 3 | 3 | 3 | 4 | 4 | 4 | Therabot engagement strong, but 19–45% dropout keeps gains hard-won |
| Speed | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | Mechanism-bound; extinction still takes weeks regardless of channel |
| Regulation | 9 | 9 | **8** | **7** | 7 | 7 | 7 | 7 | 7 | 7 | 7 | **Declines** — four states banned commercial AI therapy delivery in 2025–26 |
| Cost | 7 | 7 | 8 | 9 | 9 | 9 | 9 | 10 | 10 | 10 | 10 | LLM inference $0.15–0.40/user/month and falling |

**2036 outlook** — The mechanism edge is intact but capped by the same wall it started with: AI cut delivery cost to near zero without solving the human adherence problem that defines its burden score.

**Sources**
- Randomized Trial of a Generative AI Chatbot for Mental Health Treatment (Therabot) — NEJM AI / Dartmouth, 2025
- 5 states restrict AI therapy chatbots in 2026 — Becker's Behavioral Health, 2026
- FDA Digital Health Advisory Committee meeting on generative AI mental health devices — FDA/Sidley Austin, Nov 2025
- Retention and Engagement in Digital Mental Health Interventions — JMIR Mental Health, 2026
- LLM API Pricing Comparison In 2026 — CloudZero, 2026

---

## Judgment calls worth revisiting

These are the places where a trajectory breaks the "gradual and monotonic" rule, or where a single unresolved question drives a whole column. Each is defensible but load-bearing, so they are the first things to challenge if the numbers get used for anything.

**Non-monotonic moves (deliberate declines):**

| Entry | Dimension | Move | Reason |
|---|---|---|---|
| Consumer e-stim | Tolerance | 6 → 5 in 2029 | Homeostatic metaplasticity can invert effects; no evidence it gets solved |
| Neuroplastogens | Cost | 8 → 7 then recovering | REMS build-out adds real overhead before generics arrive |
| Stimulants | Burden | 9 → 8 then recovering | Amphetamine shortage at 2% availability mid-2026 |
| Behavioral training | Regulation | 9 → 7 | Four states banned commercial AI therapy delivery |

**Two-point jumps (each needs its catalyst to actually land):**

- **Neuroplastogens, regulation 4 → 6 in 2027** — rests on the April 2026 executive order plus priority-voucher approvals landing on schedule. If approval slips, this jump slips.
- **Neuroendocrine, regulation 4 → 6 in 2027** — rests on DEA scheduling resolving within 90 days of the Aug 2026 approval and commercial launch following. Scheduling delays would flatten it.

**Single questions that dominate a whole column:**

- **Neuroendocrine** hinges on whether orexin agonism does anything in people with intact orexin systems. Idiopathic hypersomnia data points yes, but healthy-volunteer work is only entering Phase 1. If it turns out to be deficiency-only, magnitude and reliability should be flat rather than rising.
- **Gene therapy** hinges on chemogenetics reaching first-in-human. Research found zero trials and none scheduled. If one starts in the late 2020s, magnitude and reliability move up materially; if not, the current near-flat trajectory is right.
- **Focused ultrasound** hinges on whether the small double-blind RCTs now reading out replicate at scale. The steerability advantage is real and physical; the efficacy evidence is not yet.
- **Behavioral training** hinges on whether AI-delivered adherence holds outside trial conditions. Therabot's four-week engagement was strong; the field's 19–45% dropout is not. Pear Therapeutics went bankrupt in 2023 with FDA-cleared products because engagement collapsed.

## Method notes

- Ten Sonnet subagents, one per technology, run in parallel. First pass produced trajectories from model knowledge; a second pass required each agent to research the four questions above and revise, with instructions to change numbers where evidence contradicted the draft.
- A third pass extended each trajectory one year to 2036. Each agent continued from its own 2035 value under a hard ±1 constraint, was told not to manufacture a final-year jump, and was told not to reverse any decline it had established. Every returned value was checked against that constraint before being written in.
- Agents were explicitly told erosion was permitted and that a flat trajectory was the correct answer where the category is mature — to avoid manufacturing progress for visual interest.
- Every score is an integer 1–10. Each technology has 12 dimensions × 11 years = 132 points; 1,320 across the analysis.
- The 2026 column reproduces `data.ts` exactly and should stay in sync with it.
- Research was capped at roughly 4–6 searches per technology to control cost, so these citations are a starting point rather than an exhaustive literature review. Several are market-research and trade sources rather than primary literature, particularly for the cost trajectories.
