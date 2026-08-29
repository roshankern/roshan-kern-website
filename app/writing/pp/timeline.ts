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
      driver: "At ceiling; mechanism-bound, unchanged by adaptive hardware",
    },
    steerability: {
      years: [6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9],
      driver: "BrainSense Adaptive plus directional-lead electrode ID maturing across centers",
    },
    reliability: {
      years: [6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9],
      driver: "ADAPT-PD-scale evidence; TRANSCEND/FORESEE III readouts ~2029–31",
    },
    durability: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Persists while powered; mechanism-bound",
    },
    tolerance: {
      years: [7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9],
      driver: "Closed-loop adjustment directly targets fixed-parameter habituation",
    },
    safety: {
      years: [3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6],
      driver: "Robotic stereotactic implantation; fewer over-stimulation effects",
    },
    invasiveness: {
      years: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
      driver: "Remains surgical; no non-surgical route visible by 2036",
    },
    reversibility: {
      years: [7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8],
      driver: "Stays stoppable; explant technique improves modestly",
    },
    burden: {
      years: [5, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8],
      driver: "BrainSense Electrode Identifier cuts programming time ~85%",
    },
    speed: {
      years: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
      driver: "Near-instant on-stimulation effect is mechanism-bound",
    },
    regulation: {
      years: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3],
      driver: "Dystonia HDE→PMA shows disease-pathway maturation only",
    },
    cost: {
      years: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4],
      driver: "Still $35–100k+; market grows on volume, not unit price",
    },
  },
  cortical: {
    magnitude: {
      years: [3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5],
      driver: "Layer7 records and stimulates, but no affective demonstration in any trial",
    },
    steerability: {
      years: [5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9],
      driver: "Multi-thousand-channel arrays already demonstrated, ahead of expectation",
    },
    reliability: {
      years: [3, 4, 4, 5, 5, 6, 6, 6, 7, 7, 8],
      driver: "Synchron's 6/6 COMMAND patients met endpoints; decoder iterations compound",
    },
    durability: {
      years: [3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4],
      driver: "Effects stay stimulation-locked; no persistence in 2026 data",
    },
    tolerance: {
      years: [5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6],
      driver: "Adaptive decoders offset drift; no repeated-affective-use data exists",
    },
    safety: {
      years: [4, 4, 5, 5, 6, 6, 6, 7, 7, 7, 7],
      driver: "COMMAND met safety endpoint, zero device-related SAEs; Layer7 cleared as lower-risk class",
    },
    invasiveness: {
      years: [2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4],
      driver: "Shift to endovascular Stentrode and subdural thin-film vs penetrating arrays",
    },
    reversibility: {
      years: [6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7],
      driver: "Endovascular retrievability; Layer7's 30-day removable design",
    },
    burden: {
      years: [5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8],
      driver: "Automated robotic implantation and higher-volume production",
    },
    speed: {
      years: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9],
      driver: "Already near-instant electrical onset",
    },
    regulation: {
      years: [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
      driver: "Pivotals target PMA for paralysis/speech ~2029–31; enhancement undefined",
    },
    cost: {
      years: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4],
      driver: "First commercial BCIs projected $50–100k+",
    },
  },
  tms: {
    magnitude: {
      years: [6, 6, 6, 7, 7, 7, 7, 7, 7, 8, 8],
      driver: "Connectivity targeting refines which cortex is hit, not field strength",
    },
    steerability: {
      years: [5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8],
      driver: "Personalized fMRI targeting spreads from 17 to 34+ clinics by end-2026",
    },
    reliability: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8],
      driver: "Naturalistic 16–25% remission vs ~80% in trials; access is the bottleneck",
    },
    durability: {
      years: [5, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7],
      driver: "Continuation/booster protocols emerging; real-world relapse still common",
    },
    tolerance: {
      years: [7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8],
      driver: "Maintenance protocols improve durability across repeated courses",
    },
    safety: {
      years: [8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9],
      driver: "Expanding pediatric and adult safety databases",
    },
    invasiveness: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Nothing enters the body; ceiling is fixed",
    },
    reversibility: {
      years: [7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8],
      driver: "Non-permanent; better titration allows earlier stopping",
    },
    burden: {
      years: [3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 6],
      driver: "Five-day SAINT and two-day adolescent protocols spread; home TMS unproven",
    },
    speed: {
      years: [5, 5, 6, 6, 6, 7, 7, 7, 7, 7, 7],
      driver: "Two-day adolescent iTBS beats SAINT's original five-day timeline",
    },
    regulation: {
      years: [3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5],
      driver: "Disease indications expand; no enhancement signal anywhere",
    },
    cost: {
      years: [4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6],
      driver: "Equipment cost a persistent restraint; home devices a distant lever",
    },
  },
  estim: {
    magnitude: {
      years: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4],
      driver: "Multichannel precision tDCS separates better from sham; TI not consumer-grade",
    },
    steerability: {
      years: [2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7],
      driver: "Temporal interference proves focal deep targeting, slowly informing montages",
    },
    reliability: {
      years: [3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6],
      driver: "Flow's 58% vs 29% is strong; 31-trial meta-analysis shows persistent heterogeneity",
    },
    durability: {
      years: [3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5],
      driver: "Optimized multi-session protocols extend after-effects modestly",
    },
    tolerance: {
      years: [6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5],
      driver: "Declines — homeostatic metaplasticity concerns persist unresolved",
    },
    safety: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "PMA approval and 55,000+ EU/UK users confirm benign profile at ceiling",
    },
    invasiveness: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Ceiling dimension, unaffected by any research trend",
    },
    reversibility: {
      years: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
      driver: "Already instantly stoppable; no mechanism to move it",
    },
    burden: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8],
      driver: "Wearable/handheld segment trends toward automated home use",
    },
    speed: {
      years: [5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6],
      driver: "Flow's pivotal needed 10 weeks to peak; no faster protocol emerging",
    },
    regulation: {
      years: [8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "First home-tDCS PMA opens further disease clearances; no enhancement route",
    },
    cost: {
      years: [9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10],
      driver: "Devices retail $100–500; ~8.9% CAGR pushes toward commodity",
    },
  },
  fus: {
    magnitude: {
      years: [4, 4, 4, 5, 5, 6, 6, 6, 7, 7, 7],
      driver: "Double-blind amygdala/ALIC/NAc studies show real but modest effects",
    },
    steerability: {
      years: [8, 8, 9, 9, 9, 10, 10, 10, 10, 10, 10],
      driver: "256-element phased array and personalized acoustic metamaterials",
    },
    reliability: {
      years: [4, 4, 4, 5, 5, 5, 6, 6, 7, 7, 7],
      driver: "True double-blind trials only starting 2025–26, still sub-pivotal scale",
    },
    durability: {
      years: [3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6],
      driver: "No new durability data; single-treatment persistence under-studied",
    },
    tolerance: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8],
      driver: "Repeated-exposure data limited per 2026 reviews; gains stay conservative",
    },
    safety: {
      years: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9],
      driver: "Reviews still flag adverse-effect thresholds as poorly characterized",
    },
    invasiveness: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "At ceiling; acoustic mechanism never enters the body",
    },
    reversibility: {
      years: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9],
      driver: "Effects remain transient and stoppable",
    },
    burden: {
      years: [4, 4, 4, 5, 5, 5, 6, 6, 7, 7, 8],
      driver: "Wearable helmet spinout is real but pre-commercial",
    },
    speed: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8],
      driver: "No faster onset yet; incremental protocol optimization only",
    },
    regulation: {
      years: [2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6],
      driver: "No IDE pathway or standardized dosing as of 2026, pushing clearance later",
    },
    cost: {
      years: [5, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7],
      driver: "Custom arrays plus MRI neuronavigation; wearables too early to cut cost",
    },
  },
  plastogens: {
    magnitude: {
      years: [7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8],
      driver: "Two independent Phase 3s confirm durable MADRS reduction; whole-brain ceiling holds",
    },
    steerability: {
      years: [4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6],
      driver: "DLX-001 only began first-in-human 2026; circuit selectivity a decade away",
    },
    reliability: {
      years: [5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8],
      driver: "Back-to-back positive Phase 3s and standardized protocols",
    },
    durability: {
      years: [8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Six-month data confirm durability; maintenance dosing locks in gains",
    },
    tolerance: {
      years: [4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6],
      driver: "5-HT2A tachyphylaxis unchanged; analogs too early to offset before 2030s",
    },
    safety: {
      years: [5, 5, 5, 5, 6, 6, 6, 7, 7, 8, 8],
      driver: "Analogs still Phase 1 in 2026, pushing safety gains to early-mid 2030s",
    },
    invasiveness: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Oral/IV under mandated supervision; no structural change",
    },
    reversibility: {
      years: [3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6],
      driver: "Shorter-acting analogs years from clinic",
    },
    burden: {
      years: [4, 4, 4, 4, 5, 5, 5, 6, 6, 7, 7],
      driver: "FDA requires supervised clinical setting, keeping session burden high",
    },
    speed: {
      years: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9],
      driver: "Onset already near-instant",
    },
    regulation: {
      years: [4, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8],
      driver: "Executive order plus priority vouchers drive TRD/PTSD approval; enhancement blocked",
    },
    cost: {
      years: [8, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9],
      driver: "Dips first — REMS build-out adds overhead before generics bring it down",
    },
  },
  stimulants: {
    magnitude: {
      years: [6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7],
      driver: "Centanafadine and novel-mechanism agents diffuse in; effect sizes stay modest",
    },
    steerability: {
      years: [3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5],
      driver: "Triple reuptake inhibitors and TAAR1-class marginally more selective",
    },
    reliability: {
      years: [8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9],
      driver: "Already near ceiling; new formulations add little",
    },
    durability: {
      years: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      driver: "Ultra-long-acting 16-hour formulations approved 2026; that is the whole gain",
    },
    tolerance: {
      years: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      driver: "Rapid motivational tolerance is intrinsic to the mechanism",
    },
    safety: {
      years: [5, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7],
      driver: "Newer non-classical agents show cleaner cardiovascular/abuse profiles",
    },
    invasiveness: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Oral dosing at ceiling",
    },
    reversibility: {
      years: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
      driver: "Bound by half-life; structurally unchanged",
    },
    burden: {
      years: [9, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Dips — amphetamine shortage adds sourcing friction until quotas resolve it",
    },
    speed: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Onset within an hour, near ceiling",
    },
    regulation: {
      years: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      driver: "Flat — telehealth renewed annually; permanent rules exclude Schedule II",
    },
    cost: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Generic pricing at floor; shortage affects availability, not price",
    },
  },
  neuroendocrine: {
    magnitude: {
      years: [4, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7],
      driver: "IH trials show real effect beyond frank orexin deficiency, raising the ceiling",
    },
    steerability: {
      years: [4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6],
      driver: "OX2R-selective second-gen agonists; delivery stays systemic",
    },
    reliability: {
      years: [4, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7],
      driver: "Label expansion into NT2/IH broadens who responds",
    },
    durability: {
      years: [2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3],
      driver: "Still a dosed oral agent tracking exposure; no depot in evidence",
    },
    tolerance: {
      years: [5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6],
      driver: "OXTR downregulation and HPG suppression concerns stand",
    },
    safety: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8],
      driver: "Post-launch real-world data plus benign cognitive profile",
    },
    invasiveness: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Oral small-molecule route unchanged",
    },
    reversibility: {
      years: [6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7],
      driver: "Shorter-acting next-gen agonists by early 2030s",
    },
    burden: {
      years: [8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9],
      driver: "Once-daily/long-acting formulations as the pipeline matures",
    },
    speed: {
      years: [6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7],
      driver: "Wake/cognitive effects within one to seven hours post-dose",
    },
    regulation: {
      years: [4, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8],
      driver: "DEA scheduling resolves ~90 days post-approval, enabling 2027 launch",
    },
    cost: {
      years: [7, 7, 7, 7, 8, 8, 8, 8, 9, 9, 9],
      driver: "Branded specialty pricing offsets cheap generic hormones",
    },
  },
  gene: {
    magnitude: {
      years: [2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3],
      driver: "Zero chemogenetic human trials found or scheduled; only knockdown AAV advances",
    },
    steerability: {
      years: [7, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9],
      driver: "Voyager TRACER capsids: 50–75% targeted transduction, IV dosing 2026",
    },
    reliability: {
      years: [2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4],
      driver: "AMT-130's 3-year 75% slowing builds AAV-CNS precedent, not circuit control",
    },
    durability: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Single-administration durability already maximal",
    },
    tolerance: {
      years: [6, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8],
      driver: "Cleaner DREADD agonists reported preclinically, untested in humans",
    },
    safety: {
      years: [2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4],
      driver: "Capsida CAP-002 patient death tempers gains despite AMT-130 reassurance",
    },
    invasiveness: {
      years: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3],
      driver: "IV BBB-crossing capsids begin displacing intracranial surgery, slowly",
    },
    reversibility: {
      years: [2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3],
      driver: "No inducible/off-switch constructs reaching clinic",
    },
    burden: {
      years: [6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8],
      driver: "IV dosing vs neurosurgery, plus prospect of oral ligands",
    },
    speed: {
      years: [2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3],
      driver: "~60-day AAV expression peak is fixed biology",
    },
    regulation: {
      years: [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3],
      driver: "AMT-130 BLA sets first CNS-AAV precedent, disease-only",
    },
    cost: {
      years: [1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3],
      driver: "COGS ~$10k/dose at scale, but pricing still $850k–$3.5M",
    },
  },
  behavioral: {
    magnitude: {
      years: [6, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8],
      driver: "Therabot RCT showed AI-delivered effect sizes rivaling outpatient therapy",
    },
    steerability: {
      years: [7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8],
      driver: "Passive sensing enables finer targeting of the evocable association",
    },
    reliability: {
      years: [5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8],
      driver: "Personalized LLM delivery improves response; 19–45% dropout caps gains",
    },
    durability: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Near ceiling; extinction persistence is mechanism-bound",
    },
    tolerance: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "Improvement-with-repetition is intrinsic and already maxed",
    },
    safety: {
      years: [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
      driver: "No new safety signal; FDA scrutiny concerns claims, not method harm",
    },
    invasiveness: {
      years: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      driver: "Nothing enters the body; permanently at ceiling",
    },
    reversibility: {
      years: [5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6],
      driver: "Modular AI-adjustable protocols slowly ease undoing associations",
    },
    burden: {
      years: [1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4],
      driver: "Therabot engagement strong, but 19–45% dropout keeps gains hard-won",
    },
    speed: {
      years: [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
      driver: "Mechanism-bound; extinction still takes weeks regardless of channel",
    },
    regulation: {
      years: [9, 9, 8, 7, 7, 7, 7, 7, 7, 7, 7],
      driver: "Declines — four states banned commercial AI therapy delivery in 2025–26",
    },
    cost: {
      years: [7, 7, 8, 9, 9, 9, 9, 10, 10, 10, 10],
      driver: "LLM inference $0.15–0.40/user/month and falling",
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
