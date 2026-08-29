// GENERATED from timeline-research.md — do not edit by hand.
// Regenerate with the script in that file's commit if the research changes.
//
// Each dimension carries 11 integers, one per year from 2026 to 2036, plus the
// one-line reason the row moves (or holds). The 2026 column is copied from
// data.ts at generation time, so the baseline can never drift between views.

import { DIMENSIONS, TECHNOLOGIES, type ScoreMap, type Technology } from "./data";

export const BASE_YEAR = 2026;
export const END_YEAR = 2036;
export const YEARS = Array.from(
  { length: END_YEAR - BASE_YEAR + 1 },
  (_, i) => BASE_YEAR + i
);

export type Trajectory = { years: number[]; driver: string };

export const TRAJECTORIES: Record<string, Record<string, Trajectory>> = {
  dbs: {
    magnitude: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Effect size is capped by the fixed volume of tissue directly activated at the electrode tip; closed-loop sensing changes when to stimulate, not how large the acute response is (Butson & McIntyre 2008).",
    },
    steerability: {
      years: [6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9],
      driver: "Directional leads with current steering narrow the stimulated field and widen the therapeutic window (Steigerwald et al. 2016); biomarker-guided contact selection further narrows off-target spread (Cascino et al. 2026).",
    },
    reliability: {
      years: [6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9],
      driver: "Movement-disorder responders climb as ADAPT-PD data accrues, with unblinded motor gains ~35% over fixed settings (Cascino et al. 2026); psychiatric reliability stays open until TRANSCEND/FORESEE III read out near 2029-2031.",
    },
    durability: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Rechargeable IPGs increasingly run 5+ years between service events (Abbott 2024 Infinity survival data), but that is battery engineering — stimulation still washes out within minutes once power stops, unchanged from today.",
    },
    tolerance: {
      years: [7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9],
      driver: "ADAPT-START's dual-threshold algorithm sustained motor gains and improved well-being (p=0.007) over months of continuous closed-loop adjustment, without the manual re-titration fixed-parameter DBS needs (Cascino et al. 2026).",
    },
    safety: {
      years: [3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6],
      driver: "Robot-assisted implantation narrows targeting error to ~1.0mm vs 1.3mm for frame-based surgery (Huang et al. 2024); fewer microelectrode passes cut the ~1.3% hemorrhage risk each added brain pass carries (Sansur et al. 2007).",
    },
    invasiveness: {
      years: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
      driver: "Single-pass microelectrode targeting reduces brain penetrations per lead, each historically adding about 1.3% hemorrhage risk (Sansur et al. 2007), but craniotomy and permanent intracranial hardware stay the floor through 2036.",
    },
    reversibility: {
      years: [7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8],
      driver: "Explantation and lead revision carry lower infection and hemorrhage risk than the original implant surgery when scalp coverage is managed well (Fenoy & Simpson 2014), marginally shortening the path back to baseline.",
    },
    burden: {
      years: [5, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8],
      driver: "Remote virtual-clinic programming and the BrainSense Electrode Identifier cut initial setup visits by roughly 85% (Medtronic 2025), while newer rechargeable IPGs need charging as few as ten times a year (Abbott 2024).",
    },
    speed: {
      years: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
      driver: "Peak motor response is set by axonal conduction and synaptic latency at the stimulated nucleus: effects appear within seconds and plateau there (Okun et al. 2004); no hardware or algorithm advance moves that physical floor.",
    },
    regulation: {
      years: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3],
      driver: "Dystonia's HDE-to-PMA conversion in Dec 2025 sets a template other indications may follow (Medtronic 2025), but every advance stays disease-labeled — no enhancement pathway appears in FDA guidance or any pending IDE application.",
    },
    cost: {
      years: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4],
      driver: "DBS device-market volume doubles this decade (~$7B by 2033, 14.9% CAGR) (Straits Research 2026); robotic implantation trims OR time, but device and surgical fees do not fall — growth is volume, not unit price.",
    },
  },
  cortical: {
    magnitude: {
      years: [3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5],
      driver: "Closed-loop stimulation sustained mood gains past the triggering episode in one DBS case (Scangos et al. 2021); cortical arrays add stimulation channels (Precision Neuroscience 2025), but affective replication stays untested.",
    },
    steerability: {
      years: [5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9],
      driver: "Speech decoding hit 62 words/minute at 9.1% word-error on a 50-word set (Willett et al. 2023), showing unit-level precision keeps climbing for motor and language circuits cortex reaches directly, not limbic valuation pathways.",
    },
    reliability: {
      years: [3, 4, 4, 5, 5, 6, 6, 6, 7, 7, 8],
      driver: "A one-year trial held decoding stable without daily retraining (Fan et al. 2024), and a hidden Markov model extends unsupervised recalibration to about a month (Wilson et al. 2023), compounding gains for motor and speech users.",
    },
    durability: {
      years: [3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4],
      driver: "Closed-loop DBS produced mood gains that outlasted the triggering stimulation episode in one patient (Scangos et al. 2021), but no cortical BCI trial has replicated persistence beyond the pulse train through 2036.",
    },
    tolerance: {
      years: [5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6],
      driver: "Unsupervised recalibration holds cursor decoding stable for about a month without retraining (Wilson et al. 2023); no chronic affective-use protocol exists yet to test whether tolerance holds there too.",
    },
    safety: {
      years: [4, 4, 5, 5, 6, 6, 6, 7, 7, 7, 7],
      driver: "Neuralink's thread-retraction failure was fixed via software and did not recur in patients two through twelve (Neuralink 2025); Layer7-T's 510(k) still covers only 30-day, lower-risk temporary implantation (FDA 2025).",
    },
    invasiveness: {
      years: [2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4],
      driver: "Neuralink's R1 robot implants in under 30 minutes (Neuralink 2026); thin-film subdural arrays avoid penetrating shanks (Precision Neuroscience 2025), but every modality still needs a surgical or endovascular procedure.",
    },
    reversibility: {
      years: [6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7],
      driver: "Neuralink's R1 robot is built for thread-level revision as well as insertion (Neuralink 2026), hinting at serviceable implants, but the Stentrode still endothelializes past retrievability within weeks (Opie et al. 2016).",
    },
    burden: {
      years: [5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8],
      driver: "Neuralink's R1 robot implants in under 30 minutes toward a 1,000-procedure 2026 target (Neuralink 2026), and month-long unsupervised recalibration cuts the manual retraining sessions users sit through (Wilson et al. 2023).",
    },
    speed: {
      years: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9],
      driver: "Electrical stimulation's onset sits near the physical ceiling for neural conduction; speech decoding now runs at near-conversational latency (Willett et al. 2023), but no affective protocol exists yet to clock against it.",
    },
    regulation: {
      years: [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
      driver: "Synchron's pivotal trial enrolling through 2026 puts a first BCI PMA filing no earlier than 2027-2028 (Synchron 2025); that motor/communication approval still carries no enhancement indication for healthy adults (FDA 2025).",
    },
    cost: {
      years: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4],
      driver: "Neuralink's R1 robot targets 1,000+ automated implants in 2026, cutting per-procedure labor (Neuralink 2026); China's roadmap targets 3,000 BCI surgeries a year by 2030 (China Briefing 2026), but unit-cost data stays unpublished.",
    },
  },
  tms: {
    magnitude: {
      years: [6, 6, 6, 7, 7, 7, 7, 7, 7, 8, 8],
      driver: "High-dose bilateral TBS (30 days, 3,600 pulses/session) nets just 29% remission (Martín-Bejarano et al. 2025); EEG-personalized MeRT claims 68% in its PTSD trial (FDA 2026) — incremental, not a new mechanism.",
    },
    steerability: {
      years: [5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8],
      driver: "Robotic coils hold submillimeter accuracy through head motion (Zeta Surgical 2026); EEG-informed targeting hits roughly 71% placement accuracy (Haxel et al. 2025) — still centimeter-wide fields, just aimed better.",
    },
    reliability: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8],
      driver: "Robotic motion-compensated tracking (Zeta Surgical 2026) and EEG-guided targeting (Haxel et al. 2025) cut the operator-dependent placement error behind naturalistic response trailing trial cohorts.",
    },
    durability: {
      years: [5, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7],
      driver: "Maintenance beyond twice monthly sustains remission past the roughly five-month relapse point (d'Andrea et al. 2023); MAINT-R (2025) found maintenance rTMS matches lithium's relapse-prevention with fewer side effects.",
    },
    tolerance: {
      years: [7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8],
      driver: "MAINT-R (2025) found monthly maintenance rTMS matched lithium's relapse-prevention with fewer side effects; repeated low-frequency dosing shows no drug-like tachyphylaxis (d'Andrea et al. 2023).",
    },
    safety: {
      years: [8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9],
      driver: "MeRT's PTSD pivotal trial reported no serious adverse events (FDA 2026); robotic motion-compensated tracking (Zeta Surgical 2026) narrows the off-target energy delivery behind rare adverse events.",
    },
    invasiveness: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Every fresh 2026 clearance — MeRT for PTSD (FDA 2026), Soterix's portable SPRY (Soterix Medical 2026) — is still a scalp coil; the ceiling is the physical mechanism, not the label, and cannot move.",
    },
    reversibility: {
      years: [7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8],
      driver: "EEG-informed targeting (Haxel et al. 2025) and robotic tracking (Zeta Surgical 2026) let clinicians monitor cortical response mid-session, catching and stopping excitability shifts before a full course ends.",
    },
    burden: {
      years: [3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 6],
      driver: "Soterix's portable SPRY adds point-of-care flexibility with continuous rapid-cooling operation (Soterix Medical 2026); Zeta's robotic coil sets up in under a minute (Zeta Surgical 2026) — daily visits still the norm.",
    },
    speed: {
      years: [5, 5, 6, 6, 6, 7, 7, 7, 7, 7, 7],
      driver: "Robotic coil setup drops to under a minute per session (Zeta Surgical 2026), letting clinics pack more sessions per day and pull accelerated courses closer to a one-day ceiling by the early 2030s.",
    },
    regulation: {
      years: [3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5],
      driver: "Wave Neuroscience's MeRT wins the field's first clearance beyond MDD/OCD/smoking — PTSD, via breakthrough designation (FDA 2026) — and like every clearance before it, stays disease-labeled and prescription-only.",
    },
    cost: {
      years: [4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6],
      driver: "Medicare reimbursement holds near $130-235 by CPT code through 2026 (Mozu Health 2026); portable entrants like Soterix's SPRY (Soterix Medical 2026) undercut $50-100k coil systems, pulling cost down slowly.",
    },
  },
  estim: {
    magnitude: {
      years: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4],
      driver: "HD-tDCS arrays deliver more focal, higher-intensity fields than conventional pads (Kuo et al. 2013), letting later montages separate further from sham; deep temporal-interference gains stay lab-bound, not consumer hardware.",
    },
    steerability: {
      years: [2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7],
      driver: "Temporal interference proves deep, off-target stimulation is physically possible (Grossman et al. 2017; Nature Biomedical Engineering 2026), and its current-steering math slowly filters into scalp-electrode montage design.",
    },
    reliability: {
      years: [3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6],
      driver: "MRI-derived current-flow models correct for skull and gyral variability that scatters response (Datta et al. 2013), narrowing the gap between Moffa's pooled signal and Borrione's null home trial as dosing personalizes.",
    },
    durability: {
      years: [3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5],
      driver: "Spaced same-day dosing, five 20-minute sessions with 20-minute gaps over two weeks, lifts four-week remission to 32% versus single daily sessions (Miron et al. 2026), stretching after-effects further than one-a-day protocols.",
    },
    tolerance: {
      years: [6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5],
      driver: "As accelerated multi-session dosing spreads to chase efficacy (Miron et al. 2026), exposure grows to the excitability-reversal window described by Jamil et al. (2017), and no titration standard resolves it by 2036.",
    },
    safety: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Surveillance across tens of thousands of sessions finds no serious adverse effects at conventional doses (Bikson et al. 2016), but recurring contact dermatitis and rare burns keep the ceiling below a perfect score.",
    },
    invasiveness: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Even temporal interference's deep-brain targeting uses only scalp electrodes, not implants (Grossman et al. 2017); no consumer roadmap trades external delivery for anything that penetrates skin.",
    },
    reversibility: {
      years: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
      driver: "Excitability shifts trace to transient NMDA-receptor and ion-flux changes rather than structural remodeling (Nitsche et al. 2003), so nothing in the pipeline changes how fast an unwanted effect can be stopped.",
    },
    burden: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8],
      driver: "App-guided electrode placement and headband form factors cut setup time as the wearable neurostimulation segment scales near 8.9% CAGR (Data Insights Market 2026), automating a routine FDA's pivotal still ran manually.",
    },
    speed: {
      years: [5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6],
      driver: "Spaced same-day protocols, five sessions with 20-minute gaps, push measurable response within a week and remission to 32% by four weeks (Miron et al. 2026), compressing the single-session-per-day 10-week timeline.",
    },
    regulation: {
      years: [8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "The Flow PMA sets a disease-specific precedent other sponsors can follow for separate conditions like anxiety or chronic pain (FDA 2025), widening clinical access modestly, but no proposal targets healthy-adult enhancement.",
    },
    cost: {
      years: [9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10],
      driver: "Component costs for current-source electronics keep falling as the wearable neurostimulation market grows near 8.9% annually (Data Insights Market 2026), pushing consumer units toward commodity parts pricing by the early 2030s.",
    },
  },
  fus: {
    magnitude: {
      years: [4, 4, 4, 5, 5, 6, 6, 6, 7, 7, 7],
      driver: "Blinded depression and pain readouts (NCT07094789, due 2027) should confirm Barksdale-scale gains, but Chou et al.'s (2026) sham-controlled epilepsy crossover found no significant effect on seizures.",
    },
    steerability: {
      years: [8, 8, 9, 9, 9, 10, 10, 10, 10, 10, 10],
      driver: "Higher-channel conformal arrays and patient-specific acoustic modeling aim to resolve the auditory off-target confound and amygdala lateralization noise Zhang et al. (2025) flagged, nearing the ceiling by the early 2030s.",
    },
    reliability: {
      years: [4, 4, 4, 5, 5, 5, 6, 6, 7, 7, 7],
      driver: "Reliability climbs only as trials clear the n=50 barrier: Sunnybrook's depression trial (NCT07094789, due 2027) is a step, but Chou et al.'s (2026) 12-patient epilepsy crossover shows how thin pivotal evidence remains.",
    },
    durability: {
      years: [3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6],
      driver: "Durability data barely exist past one course: no amygdala or ALIC trial has published 3-6 month follow-up, so gains stay incremental until maintenance-dosing studies, none registered as of 2026, begin reporting.",
    },
    tolerance: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8],
      driver: "ITRUSST's 2026 standardized adverse-event framework should let repeated-course studies compare chronic-exposure data directly, but Connolly et al.'s (2025) chronic high-frequency caution in animals stays unresolved in humans.",
    },
    safety: {
      years: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9],
      driver: "ITRUSST's 2025 biophysical-safety consensus sets an MI ≤1.9 nonsignificant-risk limit; Rezai et al.'s (2025) injury occurred at MI 2.7-5.1, outside that envelope, so adoption narrows uncertainty without fully resolving it.",
    },
    invasiveness: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Pinned at the ceiling by physics, not policy: sonication has no failure mode that adds tissue penetration, so nothing in the trials or wearable pipeline, including NeuroHarmonics' (2026) home-use concept, can lower this score.",
    },
    reversibility: {
      years: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9],
      driver: "As ITRUSST's (2025) cavitation-monitoring standard rules out subclinical lesioning across repeated sessions, confidence that Tsuchiyagaito et al.'s (2025) reversible framing holds beyond one study edges the score up by 2031.",
    },
    burden: {
      years: [4, 4, 4, 5, 5, 5, 6, 6, 7, 7, 8],
      driver: "NeuroHarmonics' (2026) wearable drops MRI monitoring and head-shaving but starts in clinic-only essential-tremor pilots, calling validation a long road; burden falls only as the device matures toward home use by 2036.",
    },
    speed: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8],
      driver: "No trial has decoupled the same-session BOLD shift Barksdale et al. (2025) reported from the need for repeated daily dosing; speed rises only if dose-titration studies show fewer sessions can still reach clinical effect.",
    },
    regulation: {
      years: [2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6],
      driver: "ITRUSST's 2025-26 dosing and safety consensus is the evidentiary base FDA wants before an IDE pathway; disease-specific clearance, modeled on MRgFUS's device class, looks plausible only once trials like NCT07094789 mature.",
    },
    cost: {
      years: [5, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7],
      driver: "NeuroHarmonics' (2026) MRI-free wearable is the structural lever that could cut per-session cost by removing MRI-suite time, but the firm reports a long validation road with no pricing yet, so cost falls only gradually.",
    },
  },
  plastogens: {
    magnitude: {
      years: [7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8],
      driver: "COMP006's added second dose deepened MADRS reduction versus COMP005's single dose (Compass Pathways 2026), but effects stay capped by 5-HT2A's whole-brain, non-selective mechanism (Ly et al. 2018).",
    },
    steerability: {
      years: [4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6],
      driver: "Zalsupindole is a low-efficacy 5-HT2A partial agonist (17% efficacy) causing no hallucinogenic effects (Cameron et al. 2021; Delix Therapeutics 2026), but it only reaches Phase 2 in 2026 — Phase 3 selectivity data is past 2030.",
    },
    reliability: {
      years: [5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8],
      driver: "COMP006's retreatment arm pushed nearly 30% of retreated participants into remission by six months (Compass Pathways 2026); standardized dual-dosing across two replicated Phase 3s narrows variance through the early 2030s.",
    },
    durability: {
      years: [8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Open-label extensions push follow-up past the 26-week COMP360 endpoint toward FDA's newly flagged 12-month durability bar (Compass Pathways 2026; FDA 2026), with retreatment sustaining gains into the 2030s.",
    },
    tolerance: {
      years: [4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6],
      driver: "Zalsupindole's multi-dose arm tolerated repeat oral dosing over 7 days with no serious adverse events (Delix Therapeutics 2026) — first repeat-dose data escaping 5-HT2A tachyphylaxis, but still Phase 1 through mid-decade.",
    },
    safety: {
      years: [5, 5, 5, 5, 6, 6, 6, 7, 7, 8, 8],
      driver: "Zalsupindole caused no psychotomimetic, hallucinatory, or dissociative effects across a 2-360 mg range in Phase 1 (Delix Therapeutics 2026), but that edge only reaches adequately powered later-phase trials in the early 2030s.",
    },
    invasiveness: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Even zalsupindole keeps oral dosing, now under an FDA-cleared at-home design (Delix Therapeutics 2026) — no program in this class pursues an implant or device route, so the delivery ceiling holds through 2036.",
    },
    reversibility: {
      years: [3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6],
      driver: "Ketanserin pretreatment blocks, or terminates, an established psilocybin or LSD trip (Vollenweider et al. 1998) — a real off-switch, but still a research tool, not an approved protocol, until the 2030s.",
    },
    burden: {
      years: [4, 4, 4, 4, 5, 5, 5, 6, 6, 7, 7],
      driver: "FDA cleared an at-home dosing design for zalsupindole's Phase 2 trial (Delix Therapeutics 2026), a first step off the monitored-session model — though confirmatory Phase 3 data only lands in the early 2030s.",
    },
    speed: {
      years: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9],
      driver: "Zalsupindole's synaptic qEEG markers shift within hours of one dose, matching classic psychedelics' near-instant onset (Delix Therapeutics 2026); the ceiling is already close, so later gains stay marginal.",
    },
    regulation: {
      years: [4, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8],
      driver: "Compass targets a H1 2027 launch pending DEA scheduling after its Q4 2026 NDA (Compass Pathways 2026), and MDMA's resubmitted PTSD filing (Lykos Therapeutics 2026) adds a second indication later — enhancement stays unapproved.",
    },
    cost: {
      years: [8, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9],
      driver: "REMS and DEA-controlled distribution setup ahead of Compass's H1 2027 launch add near-term overhead (Compass Pathways 2026); take-home analogs like zalsupindole later strip out the monitored-session cost driver.",
    },
  },
  stimulants: {
    magnitude: {
      years: [6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7],
      driver: "Centanafadine (approved as Simtriyo, July 2026, the first NDSRI) and TAAR1-agonist agents diffuse into wider use through the early 2030s, but pivotal-trial effect sizes stay in the same small-to-modest band (Otsuka 2026).",
    },
    steerability: {
      years: [3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5],
      driver: "Centanafadine's balanced triple-reuptake profile and TAAR1 partial agonism drive wakefulness through a dopaminergic pathway distinct from raw DAT/NET flooding, trimming off-target spillover by the early 2030s (Park et al. 2024).",
    },
    reliability: {
      years: [8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9],
      driver: "Four pivotal trials show centanafadine's monoamine-reuptake blockade reproduces the same near-universal dose response as older agents; broader post-launch data by 2035 nudges the ceiling up only slightly (Otsuka 2026).",
    },
    durability: {
      years: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      driver: "Centanafadine's 2-3h half-life needs twice-daily dosing, no longer than existing agents; extending release further risks next-day accumulation, so the 2026 16h ceiling holds for the rest of the decade (Kimko et al. 1999).",
    },
    tolerance: {
      years: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      driver: "No multi-year chronic-dosing data exists yet for centanafadine or TAAR1 partial agonists; absent contrary evidence the same DAT/D2-receptor downregulation that blunts motivation in older agents is assumed to apply (Otsuka 2026).",
    },
    safety: {
      years: [5, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7],
      driver: "Centanafadine trials report low abuse-liability, no Schedule II listing; TAAR1 partial agonism avoids amphetamine-like dopamine surges, trimming cardiovascular and psychiatric risk into the early 2030s (Park et al. 2024).",
    },
    invasiveness: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Every agent in the near-term pipeline, including centanafadine and TAAR1-class compounds, ships as an oral tablet; no injectable, transdermal, or implanted stimulant route reaches even Phase 2 this decade (Otsuka 2026).",
    },
    reversibility: {
      years: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
      driver: "No receptor-blocking reversal agent for stimulant overdose or insomnia is in development; centanafadine's 2-3h half-life keeps unwanted effects clearance-bound just like existing DAT/NET blockers (Otsuka 2026).",
    },
    burden: {
      years: [9, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "The amphetamine shortage eases as a 2025 DEA quota increase works through supply chains and centanafadine's 2026 launch adds a non-Schedule-II manufacturing pathway outside the amphetamine quota system (DEA 2025).",
    },
    speed: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Centanafadine's plasma Tmax runs several hours, no faster than methylphenidate or modafinil, so newly approved agents add capacity without beating the existing near-ceiling subjective onset window (Otsuka 2026).",
    },
    regulation: {
      years: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      driver: "Centanafadine launches with an ADHD label only, no enhancement pathway, while DEA telehealth prescribing flexibilities keep renewing annually rather than becoming permanent through the decade (Holland & Knight 2026).",
    },
    cost: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Branded launches like centanafadine still synthesize via standard small-molecule chemistry; production cost per dose stays near the amphetamine and caffeine floor even as list prices for new brands run higher (Otsuka 2026).",
    },
  },
  neuroendocrine: {
    magnitude: {
      years: [4, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7],
      driver: "Alkermes' Vibrance-3 and Centessa's ORX750 read out in idiopathic hypersomnia and NT2 through 2029; healthy-volunteer signal matures enough to raise the ceiling again only near 2032 (Alkermes 2025; Centessa 2025).",
    },
    steerability: {
      years: [4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6],
      driver: "OX2R-only second-gen agonists (ALKS-2680, ORX750, danavorexton) drop OX1R side effects of dual agonists, but oxytocin and testosterone stay systemic with no brain-targeted delivery in any trial (Leng & Ludwig 2016).",
    },
    reliability: {
      years: [4, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7],
      driver: "Vibrance-3 and ORX750 readouts in idiopathic hypersomnia and NT2 (2027-2029) extend response beyond NT1's near-total orexin loss to partial-deficiency patients, broadening who responds (Alkermes 2025; Centessa 2025).",
    },
    durability: {
      years: [2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3],
      driver: "Long-acting testosterone undecanoate depot (~10-week interval) already anchors TRT, but oveporexton's successors stay short-half-life; no depot oxytocin or orexin formulation reaches Phase 1 by 2036 (Liberto et al. 2025).",
    },
    tolerance: {
      years: [5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6],
      driver: "Oveporexton's open-label extension crosses 52 weeks without efficacy loss near 2029-2031, easing orexin tachyphylaxis fears, while oxytocin OXTR downregulation and testosterone HPG suppression get no fix (Huang et al. 2014).",
    },
    safety: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8],
      driver: "Post-launch FAERS surveillance on oveporexton's insomnia and urinary-urgency signals accrues through the early 2030s without new severe-harm findings, while testosterone's MACE/VTE risk stays the ceiling (Ory et al. 2022).",
    },
    invasiveness: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "No implant, depot pump, or CNS-targeted device enters any neuroendocrine pipeline through 2036; the four existing routes (tablet, spray, injection) give no incentive toward anything more invasive (Takeda 2026).",
    },
    reversibility: {
      years: [6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7],
      driver: "Clomiphene or hCG co-therapy to speed HPG-axis recovery becomes routine alongside TRT by the early 2030s, cutting testosterone's months-long window even as newer orexin agonists keep sub-24-hour clearance (Liberto et al. 2025).",
    },
    burden: {
      years: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9],
      driver: "Alkermes designed ALKS-2680 for once-daily dosing to beat oveporexton's twice-daily regimen; if it or ORX750 reaches approval near 2031, the category's pill burden finally eases (Alkermes 2025; Centessa 2025).",
    },
    speed: {
      years: [6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7],
      driver: "Danavorexton's IV/subcutaneous route already produces wake effects within about an hour; a fast-onset injectable reaching approval near 2032 would pull the average faster than oveporexton's 1-7 hour oral peak (Takeda 2026).",
    },
    regulation: {
      years: [4, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8],
      driver: "IH and NT2 approvals for ALKS-2680 and ORX750 near 2028-2029 widen specialty-pharmacy access and prescriber familiarity, and by the early 2030s off-label use echoes testosterone's TRT-clinic gray channel (Alkermes 2025).",
    },
    cost: {
      years: [7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9],
      driver: "ALKS-2680 and ORX750 add two more branded orexin agonists by roughly 2029-2031; four-plus rivals compress blended price gradually, though patents on all of them run into the 2040s, keeping generics off the table (Alkermes 2025).",
    },
  },
  gene: {
    magnitude: {
      years: [2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3],
      driver: "China's 2026 DREADD trials target epilepsy, Parkinson's, and pain, not mood (Roth, NIH BRAIN 2026); primate DREADD silencing shows large effects (Nagai et al. 2020), but psychiatric-circuit trials aren't likely before 2031.",
    },
    steerability: {
      years: [7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9],
      driver: "Capsid-receptor engineering for defined CNS cell types (Huang et al. 2024) moves toward clinic after VY1706, but no trial has paired an engineered capsid with a cell-type-restricted promoter in humans yet.",
    },
    reliability: {
      years: [2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4],
      driver: "Antibody-evading capsids targeting the ~50% seroprevalence exclusion (Boutin et al. 2010; Verdera et al. 2020) are in preclinical work, and a second CNS-AAV program replicating AMT-130's responder rate should report near 2029.",
    },
    durability: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "No human AAV-CNS cohort shows expression loss past three years, and promoter silencing seen in some liver-directed AAV programs hasn't appeared in CNS serotypes, so the ceiling holds by default (Verdera et al. 2020).",
    },
    tolerance: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8],
      driver: "Orthogonal PSAM4/uPSEM actuators show no potency loss across months of repeat primate dosing (Magnus et al. 2019); China's 2026 DREADD cohorts should yield the first multi-year human repeat-dosing data by the early 2030s.",
    },
    safety: {
      years: [2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4],
      driver: "AMT-130's safety base passes 100 patients with no new serious events (uniQure 2026); developers answer CAP-002 with lower doses and immunosuppression against high-dose AAV's DRG and edema toxicity (Hordeaux et al. 2020).",
    },
    invasiveness: {
      years: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3],
      driver: "VY1706's IV, BBB-crossing capsid (Voyager 2026) reaches efficacy trials by 2030, the first real substitute for AMT-130's stereotactic catheter delivery, though parenchymal injection stays standard for potency-limited programs.",
    },
    reversibility: {
      years: [2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3],
      driver: "Destabilizing-domain and inducible cassettes that can silence a transgene post-hoc (Banaszynski et al. 2006) advance through primate IND-enabling studies, though excising integrated AAV DNA once delivered remains unsolved.",
    },
    burden: {
      years: [6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8],
      driver: "Deschloroclozapine's low dose and oral bioavailability in monkeys (Nagai et al. 2020) point toward oral chemogenetic dosing over injections, even as AAV follow-up burden stays fixed by FDA's 5-15-year LTFU schedule (FDA 2020).",
    },
    speed: {
      years: [2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3],
      driver: "Self-complementary AAV genomes and stronger promoters shorten onset preclinically, but expression still builds via transcription and protein turnover, keeping peak effect weeks off through the early 2030s (Nagai et al. 2025).",
    },
    regulation: {
      years: [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3],
      driver: "AMT-130's ~2027 approval becomes the FDA's first CNS-AAV precedent (uniQure 2026); positive China DREADD readouts could prompt an FDA chemogenetics framework by the early 2030s, but still disease-only (Roth, NIH BRAIN 2026).",
    },
    cost: {
      years: [1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3],
      driver: "Suspension-bioreactor culture and higher-titer capsid yields keep pushing COGS toward the ~$10k/dose floor (Cell & Gene 2026), but patient pricing stays anchored near $1-3M with no pressure to pass savings through before 2033.",
    },
  },
  behavioral: {
    magnitude: {
      years: [6, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8],
      driver: "Through 2036 gains track completion, not a new mechanism: AI coaching lifts adherence toward trial-arm levels, converging on Cuijpers's g=0.79 ceiling (Cuijpers et al. 2023; Heinz et al. 2025).",
    },
    steerability: {
      years: [7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8],
      driver: "Passive-sensing triggers, building on just-in-time adaptive designs (Nahum-Shani et al. 2018), let AI fire the CS-specific trial exactly when the association is evocable by 2031 — bounded by what you can evoke.",
    },
    reliability: {
      years: [5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8],
      driver: "Personalized LLM delivery (Heinz et al. 2025) lifts responder rates stepwise through 2033, but dropout stuck at 19-45% (JMIR Mental Health 2026) blocks convergence on trial-arm remission, capping the climb at 8.",
    },
    durability: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Durability is fixed by consolidation biology, not channel: Therabot tracked outcomes 4-8 weeks, not years (Heinz et al. 2025), so no trial through 2036 tests AI-delivered relapse timelines — the ceiling holds.",
    },
    tolerance: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "No mechanism for use-related fatigue exists in associative learning, and no trial through 2036 finds diminishing returns across repeated CBT courses (Cuijpers et al. 2023) — delivery channel cannot move this ceiling.",
    },
    safety: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "FDA scrutiny (FDA 2025) through 2036 targets chatbot crisis-detection gaps and marketing claims, not the CBT or exposure method itself — safety holds at 9 unless a method-specific harm signal emerges.",
    },
    invasiveness: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Even AI-guided neurofeedback tops out at scalp electrodes; nothing under study through 2036 crosses into implanted or systemic delivery, leaving this the only entry pinned at the ceiling all decade.",
    },
    reversibility: {
      years: [5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6],
      driver: "Passive-monitoring apps start flagging renewal and spontaneous recovery of the suppressed association (Bouton 1993) around 2031, letting AI trigger booster extinction trials faster than clinician-scheduled follow-up.",
    },
    burden: {
      years: [1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4],
      driver: "Coaching sustains Therabot's strong engagement (Heinz et al. 2025), but dropout still runs 19-45% (JMIR Mental Health 2026); FDA clearance didn't save Pear Therapeutics in 2023 — burden climbs slowly, plateaus at 4.",
    },
    speed: {
      years: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
      driver: "Compressed protocols echoing Written Exposure Therapy's 5-session noninferiority to 12-session CPT (Sloan et al. 2018) reach AI apps near 2031, trimming response time slightly — consolidation still needs weeks.",
    },
    regulation: {
      years: [9, 9, 8, 7, 7, 7, 7, 7, 7, 7, 7],
      driver: "Illinois's WOPR Act (Illinois General Assembly 2025) — IDFPR fines up to $10,000 per violation — gains enforcement teeth through 2028, and more states copy the model into 2029; coaching apps stay untouched after that.",
    },
    cost: {
      years: [7, 7, 8, 9, 9, 9, 9, 10, 10, 10, 10],
      driver: "Inference costs keep falling as cheaper model tiers and open-weight alternatives mature (CloudZero 2026), pushing per-user cost from dimes toward fractions of a cent by the early 2030s as hardware friction clears.",
    },
  },
};

export const yearIndex = (year: number) =>
  Math.min(YEARS.length - 1, Math.max(0, year - BASE_YEAR));

/** A dimension's score in a given year, falling back to the 2026 baseline. */
export function scoreAt(techId: string, dimKey: string, year: number): number {
  const row = TRAJECTORIES[techId]?.[dimKey];
  if (!row) {
    const tech = TECHNOLOGIES.find((t) => t.id === techId);
    return tech?.scores[dimKey]?.value ?? 0;
  }
  return row.years[yearIndex(year)];
}

export const driverFor = (techId: string, dimKey: string) =>
  TRAJECTORIES[techId]?.[dimKey]?.driver ?? "";

/**
 * The whole score map for a technology in a given year.
 *
 * In 2026 the notes are the source document's per-cell rationale. Later years
 * swap in the forecast driver, since the original note argues a number that no
 * longer applies.
 */
export function scoresAt(tech: Technology, year: number): ScoreMap {
  const map: ScoreMap = {};
  for (const dim of DIMENSIONS) {
    const base = tech.scores[dim.key];
    const value = scoreAt(tech.id, dim.key, year);
    map[dim.key] =
      year === BASE_YEAR
        ? base
        : { value, note: driverFor(tech.id, dim.key) || base.note };
  }
  return map;
}
