// Scores and rationale from "Programming Personality" — each dimension scored 1–10.

export type GroupKey = "efficacy" | "tolerability" | "deployability";

export const GROUPS: { key: GroupKey; label: string; blurb: string }[] = [
  {
    key: "efficacy",
    label: "Efficacy",
    blurb: "Does it work, on whom, and does it keep working.",
  },
  {
    key: "tolerability",
    label: "Tolerability",
    blurb: "What it costs the user to accept and sustain.",
  },
  {
    key: "deployability",
    label: "Deployability",
    blurb: "Whether you can legally and economically ship it.",
  },
];

export const DIMENSIONS: {
  key: string;
  label: string;
  group: GroupKey;
  definition: string;
}[] = [
  {
    key: "magnitude",
    label: "Magnitude",
    group: "efficacy",
    definition: "How large a change the intervention produces in the intended mental state.",
  },
  {
    key: "steerability",
    label: "Steerability",
    group: "efficacy",
    definition: "How selectively the effect hits the intended process rather than everything else.",
  },
  {
    key: "reliability",
    label: "Reliability",
    group: "efficacy",
    definition: "What fraction of users get the intended effect rather than nothing or the opposite.",
  },
  {
    key: "durability",
    label: "Durability",
    group: "efficacy",
    definition: "How long the effect lasts after a single treatment.",
  },
  {
    key: "tolerance",
    label: "Tolerance",
    group: "efficacy",
    definition: "Whether the effect holds up across repeated use.",
  },
  {
    key: "safety",
    label: "Safety",
    group: "tolerability",
    definition: "The probability and severity of harm from normal use.",
  },
  {
    key: "invasiveness",
    label: "Invasiveness",
    group: "tolerability",
    definition: "How much the intervention physically enters or disrupts the body.",
  },
  {
    key: "reversibility",
    label: "Reversibility",
    group: "tolerability",
    definition: "How quickly an unwanted effect can be stopped or undone.",
  },
  {
    key: "burden",
    label: "Burden",
    group: "tolerability",
    definition: "How much time, effort, and repetition the user must contribute.",
  },
  {
    key: "speed",
    label: "Speed",
    group: "tolerability",
    definition: "How long from administration to peak effect.",
  },
  {
    key: "regulation",
    label: "Regulation",
    group: "deployability",
    definition: "How difficult it is to legally sell to a healthy adult for enhancement.",
  },
  {
    key: "cost",
    label: "Cost",
    group: "deployability",
    definition: "Raw materials and production cost per user, absent regulatory overhead.",
  },
];

/**
 * Row seriation compresses the twelve dimensions into one value per family by
 * averaging, which keeps all three families on the same 1–10 scale the
 * individual dimensions use. Internal to TECH_ORDER — nothing else needs them.
 */
const dimsInGroup = (group: GroupKey) =>
  DIMENSIONS.filter((d) => d.group === group);

function axisValue(scores: ScoreMap, group: GroupKey): number {
  const dims = dimsInGroup(group);
  return dims.reduce((acc, d) => acc + scores[d.key].value, 0) / dims.length;
}

const axisTriple = (scores: ScoreMap) =>
  GROUPS.map((g) => axisValue(scores, g.key)) as [number, number, number];

/** Evenly spaced soft pastel hues — one system, and always paired with a text label. */
export const techColor = (index: number) => `hsl(${(index * 36) % 360}, 60%, 72%)`;

export type ScoreMap = Record<string, { value: number; note: string }>;

export type Technology = {
  id: string;
  name: string;
  shortName: string;
  modalities: string;
  summary: string;
  scores: ScoreMap;
};

export const TECHNOLOGIES: Technology[] = [
  {
    id: "dbs",
    name: "Deep brain stimulation",
    shortName: "Deep brain stim",
    modalities: "implanted electrodes, closed-loop DBS",
    summary:
      "Surgically placed electrodes stimulate deep targets directly — the only modality that reliably writes affective state today.",
    scores: {
      magnitude: {
        value: 9,
        note: "Only modality that writes affective state on command; intraoperative VC/VS stimulation produces immediate, unmistakable mood elevation.",
      },
      steerability: {
        value: 6,
        note: "Millimeter anatomical precision but electrically indiscriminate — drives every cell type and passing fiber in the volume activated.",
      },
      reliability: {
        value: 6,
        note: "~60% response in OCD, but blinded TRD trials (BROADEN, RECLAIM) failed endpoints; the 50%/35% BNST-NAc figures are open-label only.",
      },
      durability: { value: 9, note: "One surgery, indefinite effect while powered." },
      tolerance: {
        value: 7,
        note: "Holds over years with periodic reprogramming; habituation is standard clinical experience.",
      },
      safety: {
        value: 3,
        note: "Hemorrhage, infection, hardware revision, stimulation-induced hypomania.",
      },
      invasiveness: { value: 1, note: "Floor." },
      reversibility: {
        value: 7,
        note: "Reverses in minutes when switched off; docked for microlesion effects and explant surgery.",
      },
      burden: {
        value: 5,
        note: "Months of programming titration plus battery/recharge management — the titration period is the user's problem, not just the clinic's.",
      },
      speed: {
        value: 8,
        note: "Seconds at the right contact; therapeutic effect takes weeks.",
      },
      regulation: {
        value: 1,
        note: "HDE for OCD only, TRD investigational, no enhancement pathway.",
      },
      cost: { value: 2, note: "$50–100k+ with surgery." },
    },
  },
  {
    id: "cortical",
    name: "Cortical interfaces",
    shortName: "Cortical interfaces",
    modalities: "intracortical arrays, ECoG, endovascular stents",
    summary:
      "Electrode arrays on or in cortex read neural activity at high resolution and can stimulate it — currently read-dominant.",
    scores: {
      magnitude: {
        value: 3,
        note: "Read-dominant; no human demonstration of writing affective state from cortex at useful magnitude.",
      },
      steerability: {
        value: 5,
        note: "Superb read resolution, but cortex is the wrong place to set valuation — subcortical targets reached only transsynaptically.",
      },
      reliability: {
        value: 3,
        note: "Signal capture is dependable; the affective use case has zero demonstrated protocol.",
      },
      durability: {
        value: 3,
        note: "Stimulation effects do not outlast stimulation. Implant lifetime belongs in Tolerance, not here.",
      },
      tolerance: {
        value: 5,
        note: "Gliosis, encapsulation, ongoing decoder recalibration.",
      },
      safety: {
        value: 4,
        note: "Endovascular markedly safer (COMMAND: no device-related SAEs in 6/6); intracortical carries full craniotomy risk.",
      },
      invasiveness: { value: 2, note: "Permanent implant either way." },
      reversibility: {
        value: 6,
        note: "Stimulation stops instantly; a stent endothelializes and is unremovable.",
      },
      burden: {
        value: 5,
        note: "Recalibration sessions are the documented chronic burden in every deployed BCI.",
      },
      speed: {
        value: 8,
        note: "Stimulation-evoked effects immediate — but see Magnitude.",
      },
      regulation: {
        value: 1,
        note: "No permanently implanted BCI has PMA; all investigational.",
      },
      cost: { value: 2, note: "Hardware plus surgery." },
    },
  },
  {
    id: "tms",
    name: "Transcranial magnetic stimulation",
    shortName: "TMS",
    modalities: "rTMS, theta-burst",
    summary:
      "Magnetic pulses induce currents in superficial cortex, delivered in clinic across repeated sessions.",
    scores: {
      magnitude: {
        value: 6,
        note: "SNT reported 57% remission / 71% response at day 5, but it moves a mood set point over sessions rather than producing state on demand.",
      },
      steerability: {
        value: 5,
        note: "Superficial cortex only; fMRI-guided sgACC-anticorrelated targeting is a real gain but still a broad cortical volume.",
      },
      reliability: {
        value: 6,
        note: "Standard protocols 20–30% remission; accelerated protocols report far more but replication without precision components gave 50% response / 12.5% remission at one month.",
      },
      durability: {
        value: 5,
        note: "Subset remains in remission at 12 weeks; relapse is the norm.",
      },
      tolerance: {
        value: 7,
        note: "No pharmacological tolerance and repeat courses work — structurally closer to behavioral training's 9 than to tDCS's 6.",
      },
      safety: { value: 8, note: "Seizure ~1 in 10,000–30,000 sessions." },
      invasiveness: {
        value: 10,
        note: "Nothing penetrates the body. Scalp electrodes are not less invasive than a coil held near the head.",
      },
      reversibility: {
        value: 7,
        note: "Washes out over weeks; cannot abort an induced state.",
      },
      burden: {
        value: 3,
        note: "The killer: six weeks daily, or SNT's 10 sessions/day × 5 days plus an fMRI.",
      },
      speed: {
        value: 5,
        note: "Frontier is 5 days to peak, which has to sit meaningfully above gene therapy's weeks-to-expression.",
      },
      regulation: {
        value: 3,
        note: "Cleared for MDD/OCD/smoking; prescription and clinic-bound; no enhancement route.",
      },
      cost: { value: 4, note: "Capital equipment plus technician time." },
    },
  },
  {
    id: "estim",
    name: "Electronic stimulation",
    shortName: "Electronic stimulation",
    modalities: "tDCS, tACS, taVNS",
    summary:
      "Weak scalp or nerve currents shift excitability at low cost from home, with highly variable response.",
    scores: {
      magnitude: {
        value: 2,
        note: "~2.3-point HDRS delta over sham after 36 sessions in the pivotal home trial; the n=210 Borrione trial found no active-vs-sham difference at all.",
      },
      steerability: {
        value: 2,
        note: "1–2 mA scalp current spreads diffusely; taVNS engages a broad ascending arousal system.",
      },
      reliability: {
        value: 3,
        note: "Inter-individual variability is the field's signature pathology.",
      },
      durability: {
        value: 3,
        note: "After-effects minutes to hours; benefit requires weeks of daily use.",
      },
      tolerance: {
        value: 6,
        note: "No pharmacological tolerance; homeostatic metaplasticity can invert effects, a distinct failure mode.",
      },
      safety: {
        value: 9,
        note: "Tingling, skin irritation, rare burns; no active-vs-sham AE difference.",
      },
      invasiveness: { value: 10, note: "Scalp or ear electrodes." },
      reversibility: {
        value: 8,
        note: "Stop the session; after-effects decay in hours.",
      },
      burden: {
        value: 6,
        note: "20–30 min/day at home, but you aren't going anywhere.",
      },
      speed: {
        value: 5,
        note: "Excitability shifts within a session; symptom change takes weeks.",
      },
      regulation: {
        value: 8,
        note: "The standout: FDA approved the Flow Neuroscience tDCS device on Dec 8, 2025 for moderate-to-severe MDD — the first PMA for a home-use non-invasive brain-stimulation device. Launching 2026 at $500–800, with a large parallel wellness-claim market.",
      },
      cost: { value: 9, note: "BOM in the low hundreds." },
    },
  },
  {
    id: "fus",
    name: "Focused ultrasound",
    shortName: "Focused ultrasound",
    modalities: "low-intensity transcranial FUS",
    summary:
      "Acoustic energy modulates deep targets non-invasively with millimeter precision — the only non-surgical route to subcortex.",
    scores: {
      magnitude: {
        value: 4,
        note: "Primary outcome d = 0.77 but from a single-arm unblinded clinical arm; the honest controlled evidence is target engagement plus a small single-blind RCT.",
      },
      steerability: {
        value: 8,
        note: "The strategic asset — millimeter precision to subcortex non-invasively. Docked for the auditory confound and unresolved lateralization targeting.",
      },
      reliability: {
        value: 4,
        note: "7T connectivity and metabolite measures confirm target engagement — BLA-TUS lowered the BLA's excitation/inhibition balance — but essentially no double-blind clinical efficacy data.",
      },
      durability: {
        value: 3,
        note: "Tens of minutes per session; best course-level report ~4 weeks.",
      },
      tolerance: {
        value: 6,
        note: "Unknown-with-no-red-flags in a non-pharmacological modality should sit at tDCS's 6, not below it.",
      },
      safety: {
        value: 8,
        note: "No serious AEs at low intensity to date; docked for thin longitudinal data.",
      },
      invasiveness: {
        value: 10,
        note: "Nothing enters the body. The MRI/neuronavigation requirement is burden, already priced into Burden.",
      },
      reversibility: { value: 8, note: "Effects decay quickly." },
      burden: {
        value: 4,
        note: "Clinic-bound, daily × 3 weeks, neuronavigated each time. No home form factor.",
      },
      speed: {
        value: 6,
        note: "Neural effect from a single ~10-min sonication; behavioral change accrues over sessions.",
      },
      regulation: {
        value: 2,
        note: "No FDA clearance for LIFU neuromodulation anywhere; MRgFUS clearance is ablation only.",
      },
      cost: {
        value: 5,
        note: "Transducer plus navigation is capital-intensive; marginal cost low.",
      },
    },
  },
  {
    id: "plastogens",
    name: "Neuroplastogens",
    shortName: "Neuroplastogens",
    modalities: "psilocybin, ketamine, MDMA, non-hallucinogenic analogs",
    summary:
      "Compounds that open a plasticity window in which learned valuations can be durably rewritten.",
    scores: {
      magnitude: {
        value: 7,
        note: "Group means are modest — COMP005 showed −3.6 MADRS for a single 25 mg dose — but these are the only agents that rewrite learned valuation from one exposure.",
      },
      steerability: {
        value: 4,
        note: "Whole-brain 5-HT2A agonism; the only steering wheel is set-and-setting plus integration, not circuit selectivity.",
      },
      reliability: {
        value: 5,
        note: "≥25% MADRS reduction in 25% of the 25 mg arm in COMP005 — a lower bar than the usual 50% cutoff. The negative EPISODE trial (17.0% vs 10.6%) confirms this belongs at 5.",
      },
      durability: {
        value: 8,
        note: "Best per-administration durability of any non-permanent modality; COMP005 responders maintained effect through at least week 26.",
      },
      tolerance: {
        value: 4,
        note: "Structural ceiling: rapid 5-HT2A tachyphylaxis, ketamine abuse liability, MDMA frequency limits. Cannot be a daily tool.",
      },
      safety: {
        value: 5,
        note: "AEs cluster on dosing day and are mild-to-moderate, but psychosis risk, 5-HT2B valvulopathy concern, and ketamine cystitis/dependence sit underneath.",
      },
      invasiveness: { value: 9, note: "Oral or IV." },
      reversibility: {
        value: 3,
        note: "Ride it out 4–6 hours, and durable plasticity change is the point.",
      },
      burden: {
        value: 4,
        note: "Monitored multi-hour dosing with prep and integration.",
      },
      speed: {
        value: 8,
        note: "Significant onset from the day after administration.",
      },
      regulation: {
        value: 4,
        note: "Ketamine/esketamine is the only legal scaled channel; Q4 2026 NDA and priority vouchers are moving the rest fast — but toward disease, not enhancement.",
      },
      cost: { value: 8, note: "Synthesis is dollars per dose." },
    },
  },
  {
    id: "stimulants",
    name: "Stimulants and nootropics",
    shortName: "Stimulants",
    modalities: "amphetamine, methylphenidate, modafinil, caffeine",
    summary:
      "Monoamine and wake-promoting drugs that raise arousal and effort tolerance within an hour, limited by tolerance.",
    scores: {
      magnitude: {
        value: 6,
        note: "Large and immediate on arousal and effort tolerance; but measured cognitive enhancement is small (SMD 0.21 methylphenidate, 0.12 modafinil, null for d-amphetamine). Biggest subjective/objective gap in the table.",
      },
      steerability: {
        value: 3,
        note: "Systemic monoamine release hits arousal, appetite, cardiovascular tone, sleep, and mood simultaneously.",
      },
      reliability: { value: 8, note: "Highest in the set." },
      durability: { value: 1, note: "Hours; zero persistence past clearance." },
      tolerance: {
        value: 2,
        note: 'The defining failure — rapid tolerance to the motivational component. Directly fatal to "discipline on demand" as a standing solution.',
      },
      safety: {
        value: 5,
        note: "Cardiovascular load, sleep disruption, Schedule II dependence liability, psychosis at dose.",
      },
      invasiveness: { value: 10, note: "Oral." },
      reversibility: { value: 6, note: "Cannot abort a dose." },
      burden: { value: 9, note: "Take a pill." },
      speed: { value: 9, note: "30–60 min to peak." },
      regulation: {
        value: 4,
        note: "De facto accessibility is real, but the telehealth channel is no more legitimate than ketamine clinics. Schedule II with no enhancement indication; caffeine and modafinil pull it to 4, not above.",
      },
      cost: { value: 10, note: "Pennies per dose." },
    },
  },
  {
    id: "neuroendocrine",
    name: "Neuroendocrine modulators",
    shortName: "Neuroendocrine",
    modalities: "oxytocin, testosterone, cortisol, orexin agonists",
    summary:
      "Endogenous hormones and peptides given exogenously to shift affective and motivational tone systemically.",
    scores: {
      magnitude: {
        value: 4,
        note: "Oxytocin near-null (emotion recognition g = 0.08); orexin pulls the category up hard — FirstLight/RadiantLight met the MWT primary endpoint — but in an orexin-deficient population. Effect in intact healthy adults unknown.",
      },
      steerability: {
        value: 4,
        note: "Receptor-selective pharmacology is genuinely good; distribution is systemic.",
      },
      reliability: {
        value: 4,
        note: "Oveporexton highly reliable in indication (>95% extension uptake); oxytocin famously not. Blended.",
      },
      durability: { value: 2, note: "Tracks exposure; oveporexton is twice-daily." },
      tolerance: {
        value: 5,
        note: "Chronic oxytocin downregulates OXTR, exogenous testosterone suppresses the HPG axis; no orexin tolerance over 12 weeks plus extension.",
      },
      safety: {
        value: 6,
        note: "Insomnia, urinary frequency/urgency, hypersalivation; testosterone erythrocytosis, cortisol metabolically destructive.",
      },
      invasiveness: { value: 9, note: "Oral, nasal, or injection." },
      reversibility: {
        value: 6,
        note: "Short-half-life agents clear in hours; HPG suppression takes months.",
      },
      burden: { value: 8, note: "Daily dosing." },
      speed: {
        value: 6,
        note: "Orexin within an hour; testosterone's mood effects take weeks.",
      },
      regulation: {
        value: 4,
        note: "Approved Aug 5, 2026 but narrowly, with commercial availability pending a DEA scheduling determination and specialty pharmacy distribution. TRT clinics are a real parallel channel.",
      },
      cost: {
        value: 7,
        note: "Peptides and generic hormones cheap; novel small molecule priced high under patent.",
      },
    },
  },
  {
    id: "gene",
    name: "Gene and molecular therapy",
    shortName: "Gene therapy",
    modalities: "AAV delivery, chemogenetics, optogenetics",
    summary:
      "Engineered receptors or gene expression give cell-type-specific control of defined circuits — essentially permanent once delivered.",
    scores: {
      magnitude: {
        value: 2,
        note: "In rodents this is a 10. In humans, circuit-specific affective control has never been done; the most advanced human CNS gene therapy is protein knockdown, not circuit control.",
      },
      steerability: {
        value: 7,
        note: "Human delivery precision is real (AMT-130 micro-catheter to caudate/striatum); human cell-type selectivity has never been validated in a living brain. Mechanism-in-principle 10, demonstrated-in-human ~4, blend 7.",
      },
      reliability: {
        value: 2,
        note: "FDA told uniQure in Jan 2026 the Phase 1/2 data were insufficient, then reversed in June 2026 to accept the 3-year dataset. That whiplash is itself the signal. Add transduction variability and anti-AAV immunity exclusions.",
      },
      durability: {
        value: 10,
        note: "Single administration, expression for years. Unmatched.",
      },
      tolerance: {
        value: 6,
        note: "No pharmacological tolerance, but transgene silencing and anti-capsid immunity mean you generally cannot re-dose. For chemogenetics, the ligand is the tolerance-bearing element.",
      },
      safety: {
        value: 2,
        note: "Stereotactic neurosurgery plus irreversible genetic modification; CNO converts to clozapine, and cleaner ligands (uPSEM817, bradanicline) remain translationally unproven.",
      },
      invasiveness: {
        value: 1,
        note: "Intracranial infusion plus permanent genome alteration.",
      },
      reversibility: {
        value: 2,
        note: "Chemogenetics is the partial exception — stop the ligand, the receptor goes inert — but the transgene stays.",
      },
      burden: {
        value: 6,
        note: "A daily ligand for chemogenetic designs, plus FDA-mandated 5–15 year long-term follow-up for CNS vectors. Not near-zero ongoing effort.",
      },
      speed: {
        value: 2,
        note: "Macaque DREADD expression peaks around 60 days — roughly 12× slower than TMS's frontier 5 days.",
      },
      regulation: {
        value: 1,
        note: "No CNS gene therapy approved for any psychiatric indication; chemogenetics has zero human trials.",
      },
      cost: {
        value: 1,
        note: "Six-figure per-dose COGS even stripping regulatory overhead.",
      },
    },
  },
  {
    id: "behavioral",
    name: "Behavioral training",
    shortName: "Behavioral training",
    modalities: "CBT, exposure, operant conditioning, neurofeedback",
    summary:
      "Structured repeated practice that rewrites valuation through learning — cheap and safe but high effort across many sessions.",
    scores: {
      magnitude: {
        value: 6,
        note: "Extinction learning is valuation rewriting — the only entry acting on the target mechanism directly. CBT g ≈ 0.7–0.8 vs waitlist, dropping to ~0.3 vs active controls.",
      },
      steerability: {
        value: 7,
        note: "Best after gene therapy. You can extinguish one specific association without touching anything else — limited by only being able to retrain what you can reliably evoke.",
      },
      reliability: {
        value: 5,
        note: "~50% CBT response with 15–25% dropout; neurofeedback much weaker than its reputation (8 of 22 controlled trials showed significant clinical benefit).",
      },
      durability: {
        value: 9,
        note: "Persists for years; follow-up effects larger than post-training (g = 1.19 vs 0.81).",
      },
      tolerance: {
        value: 9,
        note: "Improves with repetition. The only entry with negative tolerance.",
      },
      safety: {
        value: 9,
        note: "Transient symptom exacerbation during exposure; rare deterioration.",
      },
      invasiveness: { value: 10, note: "None." },
      reversibility: {
        value: 5,
        note: "Awkward at both ends — renewal and reinstatement make fade unpredictable, yet you can't deliberately undo a learned change on command.",
      },
      burden: {
        value: 1,
        note: "The floor, and the reason this project exists. It demands the exact motivational capacity you're trying to install.",
      },
      speed: { value: 1, note: "Weeks to months." },
      regulation: {
        value: 9,
        note: "Effectively unregulated for enhancement — coaching, apps, and self-directed protocols sell to healthy adults freely.",
      },
      cost: {
        value: 7,
        note: "Frontier here is deployed digital/LLM-delivered protocols at near-zero marginal cost, not the $150/hr median therapist.",
      },
    },
  },
];

/**
 * Row order for the matrix: neighbours are technologies with similar family
 * profiles, so bands of colour form instead of scattered cells.
 *
 * A greedy nearest-neighbour walk over the three family averages — start at the
 * most extreme profile, then repeatedly append whichever unplaced technology is
 * closest to the last one placed. Cheap, deterministic, and it reads as an
 * ordering rather than a hierarchy, which is all the matrix needs.
 *
 * Computed once from the 2026 baseline and then held fixed, so scrubbing the
 * timeline changes the colours without reshuffling the rows underneath them.
 */
function proximityOrder(profiles: [number, number, number][]): number[] {
  const dist = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  const centroid = [0, 1, 2].map(
    (i) => profiles.reduce((s, p) => s + p[i], 0) / profiles.length
  );

  const remaining = profiles.map((_, i) => i);
  let current = remaining.reduce((far, i) =>
    dist(profiles[i], centroid) > dist(profiles[far], centroid) ? i : far
  );
  const order = [current];
  remaining.splice(remaining.indexOf(current), 1);

  while (remaining.length) {
    const next = remaining.reduce((best, i) =>
      dist(profiles[i], profiles[current]) < dist(profiles[best], profiles[current])
        ? i
        : best
    );
    order.push(next);
    remaining.splice(remaining.indexOf(next), 1);
    current = next;
  }
  return order;
}

/** Fixed row order for the matrix, seriated on the 2026 family averages. */
export const TECH_ORDER = proximityOrder(
  TECHNOLOGIES.map((t) => axisTriple(t.scores))
);
