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
        note: "Only modality that reliably writes affective state on command: intraoperative VC/VS stimulation triggers immediate smiling, laughter, mood lift on the table (Okun et al. 2004).",
      },
      steerability: {
        value: 6,
        note: "Electrodes sit within a millimeter of target, but current spreads through a fixed volume of tissue, driving every neuron and passing fiber inside it regardless of type (Butson & McIntyre 2008).",
      },
      reliability: {
        value: 6,
        note: "OCD responders run ~60% (Alonso et al. 2015), but blinded depression trials failed: VC/VS showed 20% active vs 14% sham (Dougherty et al. 2015); SCC showed 20% vs 17% (Holtzheimer et al. 2017).",
      },
      durability: {
        value: 9,
        note: "One implant, effect persists indefinitely as long as the device is powered; over 40,000 patients now carry Medtronic Percept systems for years (Medtronic 2025).",
      },
      tolerance: {
        value: 7,
        note: "Chronic efficacy holds for years with periodic reprogramming rather than dose escalation; clinicians routinely re-titrate settings to counter habituation, not replace the therapy.",
      },
      safety: {
        value: 3,
        note: "Symptomatic intracranial hemorrhage in ~1.6% of leads, infection in ~4%, hardware revision in ~5%, plus stimulation-induced hypomania up to 4-7% in some cohorts (systematic reviews, 2024).",
      },
      invasiveness: {
        value: 1,
        note: "Craniotomy plus permanently implanted intracranial leads and a subcutaneous pulse generator: the deepest possible intervention on this table, a floor by construction.",
      },
      reversibility: {
        value: 7,
        note: "Effect washes out within minutes to hours of turning stimulation off, and hardware can be explanted; intraoperative microlesion effects and revision surgery are the real costs (2021 reviews).",
      },
      burden: {
        value: 5,
        note: "Weekly-to-biweekly programming visits for months after implant, then indefinite battery charging or replacement surgery every 3-9 years depending on device type.",
      },
      speed: {
        value: 8,
        note: "Motor and limbic circuits respond within seconds at the correct contact, but psychiatric benefit accrues over days to weeks as plasticity mechanisms take over (gateway trial data, 2019).",
      },
      regulation: {
        value: 1,
        note: "Humanitarian Device Exemption for OCD only (FDA 2009); depression remains investigational under IDE trials (TRANSCEND, FORESEE III) with no enhancement pathway proposed anywhere.",
      },
      cost: {
        value: 2,
        note: "Surgery, device, and hospital fees run $35-100k+ per patient in the US, before years of programming visits and battery-replacement procedures (global cost reviews, 2024).",
      },
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
        note: "OFC and amygdala stimulation acutely lift self-reported mood in epilepsy cohorts (Rao et al. 2018), but no chronic cortical BCI trial has replicated or scaled affective control beyond single sessions.",
      },
      steerability: {
        value: 5,
        note: "Layer7's 1,024 microelectrodes and a 65,536-electrode subdural array resolve individual units precisely (Jung et al. 2025), but cortex reaches limbic valuation circuits only through indirect, transsynaptic pathways.",
      },
      reliability: {
        value: 3,
        note: "Synchron's COMMAND cohort hit 100% accurate deployment and stable motor-signal capture across all six patients (Synchron 2024); zero patients have attempted an affective-control protocol.",
      },
      durability: {
        value: 3,
        note: "Stimulation-evoked cortical effects, motor or affective, track the pulse train and decay within seconds of it stopping (Rao et al. 2018); nothing persists once current is switched off.",
      },
      tolerance: {
        value: 5,
        note: "Gliosis and glial scarring degrade signal-to-noise over months (Salatino et al. 2017), but decoders that continuously realign to drift keep performance from collapsing outright (Degenhart et al. 2020).",
      },
      safety: {
        value: 4,
        note: "COMMAND's six endovascular patients logged zero device-related SAEs at 12 months (Synchron 2024); intracortical arrays still carry full craniotomy risk that endovascular access avoids.",
      },
      invasiveness: {
        value: 2,
        note: "Every current modality needs an implant procedure, penetrating shank, subdural film, or catheterized stent, with no non-surgical route to cortical access (Mitchell et al. 2023).",
      },
      reversibility: {
        value: 6,
        note: "Stimulation halts the instant current stops (Rao et al. 2018), but the Stentrode endothelializes into the vessel wall within weeks and becomes unretrievable (Opie et al. 2016); Layer7 is removable only within 30 days.",
      },
      burden: {
        value: 5,
        note: "Every deployed intracortical BCI needs recurring recalibration sessions as unit yield and impedance drift (Degenhart et al. 2020); unsupervised algorithms shrink but do not remove this.",
      },
      speed: {
        value: 8,
        note: "Electrical stimulation produces effects within milliseconds of current onset, the fastest true onset of any modality here (Rao et al. 2018), though no affective protocol exists yet to time.",
      },
      regulation: {
        value: 1,
        note: "No cortical BCI holds a PMA; Layer7's 510(k) covers only 30-day recording and stimulation, and COMMAND remains an early feasibility IDE study, not a pivotal trial (FDA 2025).",
      },
      cost: {
        value: 2,
        note: "No commercial cortical BCI is priced; comparable implants like RNS and DBS run $35-100k in hardware and surgery alone, and full BCI development costs run $150-200M per device (bciintel.com 2026).",
      },
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
        note: "SNT's double-blind trial hit 79% remission vs 13% sham within 4 weeks (Cole et al. 2022) — a real shift, but it moves a slow mood baseline over days, not an on-demand state.",
      },
      steerability: {
        value: 5,
        note: "fMRI-guided sgACC-anticorrelated targeting causally evokes the depression circuit itself (Cole et al. 2022), but the induced field still spans centimeters of cortex, not one pathway.",
      },
      reliability: {
        value: 6,
        note: "Standard 6-week rTMS remits ~30% (George et al. 2010); accelerated iTBS looked far stronger in SNT's trial but replicated at only 50% response / 12.5% remission without precision targeting (Chen et al. 2025).",
      },
      durability: {
        value: 5,
        note: "In a year-long naturalistic registry, only 13% of remitters relapsed within 6 months when paired with continuation medication and retreatment access (Dunner et al. 2014) — durability needs upkeep, not a cure.",
      },
      tolerance: {
        value: 7,
        note: "No receptor-level tachyphylaxis: a second course remits 73% of relapsers versus 87% on the first (Pridmore et al. 2019), close enough to call repeatable rather than degrading like a drug.",
      },
      safety: {
        value: 8,
        note: "Across a half-million sessions, seizure risk is 0.31 per 10,000 overall and under 1 per 60,000 in guideline-adherent patients without risk factors (Taylor et al. 2021) — rare, not eliminated.",
      },
      invasiveness: {
        value: 10,
        note: "Coil sits at the scalp; nothing penetrates skin or skull. FDA clears every TMS system as a noninvasive device across its MDD, OCD, and smoking-cessation indications (FDA 2024).",
      },
      reversibility: {
        value: 7,
        note: "Single-session cortical excitability shifts decay within roughly an hour (Huang et al. 2005); the course's cumulative antidepressant effect likewise fades over weeks, tracking relapse curves (Dunner et al. 2014).",
      },
      burden: {
        value: 3,
        note: "Standard course is 20-36 daily clinic visits over 4-6 weeks; SNT compresses this to 10 sessions/day for 5 days but adds a same-day fMRI scan for individualized targeting (Cole et al. 2022).",
      },
      speed: {
        value: 5,
        note: "SNT's accelerated protocol reaches peak remission by day 5 (Cole et al. 2022), the field's fastest verified course; unaccelerated rTMS still needs its full 4-6 week daily schedule to show effect.",
      },
      regulation: {
        value: 3,
        note: "FDA-cleared for MDD, OCD via BrainsWay's H7 De Novo pathway, and smoking cessation, plus adolescent MDD as of 2024 (NeuroStar) and 2025 (BrainsWay) — every clearance is disease-labeled and prescription-only.",
      },
      cost: {
        value: 4,
        note: "A standard 20-36 session course runs $6,000-15,000 cash-pay, driven by a $50-100k coil system and a technician present for every session rather than any consumable (Healingmaps 2026).",
      },
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
        note: "Flow's FDA pivotal reported 58% vs 29% remission at 10 weeks (FDA 2025), but Borrione et al. (2024, n=174) found active tDCS no better than sham on remission, 18% vs 21%.",
      },
      steerability: {
        value: 2,
        note: "1-2 mA scalp current loses ~45% to shunting and spreads diffusely across gyri, not one circuit (Datta et al. 2009); taVNS drives the whole ascending vagal-arousal system at once.",
      },
      reliability: {
        value: 3,
        note: "An individual patient data meta-analysis found real but small pooled effects (Moffa et al. 2020), while a fully powered home trial (n=174) found zero separation from sham (Borrione et al. 2024).",
      },
      durability: {
        value: 3,
        note: "Single-session excitability shifts last minutes to hours (Nitsche & Paulus 2001); the FDA pivotal needed 10 weeks of daily sessions before symptom gains appeared (FDA 2025).",
      },
      tolerance: {
        value: 6,
        note: "No pharmacological tolerance builds across sessions, but excess intensity or duration can flip excitability the opposite direction via homeostatic metaplasticity (Jamil et al. 2017), a distinct failure mode.",
      },
      safety: {
        value: 9,
        note: "Home trials report mild tingling, redness, and rare scalp burns from poor electrode contact, with no significant active-vs-sham adverse-event difference (Borrione et al. 2024; FDA 2025).",
      },
      invasiveness: {
        value: 10,
        note: "All three modalities are fully external: scalp electrodes for tDCS/tACS, an ear clip for taVNS. No skin penetration, no implant, no procedure of any kind — the strongest score in the matrix.",
      },
      reversibility: {
        value: 8,
        note: "Stopping a session ends current flow immediately, and the excitability after-effects it leaves behind decay within hours to at most a day (Nitsche & Paulus 2001) — nothing structural persists.",
      },
      burden: {
        value: 6,
        note: "FDA labeling calls for 20-30 minute sessions up to five days a week for weeks, unsupervised at home: low effort per session but a real recurring routine (FDA 2025).",
      },
      speed: {
        value: 5,
        note: "Cortical excitability shifts appear within a single session (Nitsche & Paulus 2000), but Flow's pivotal needed 10 weeks of daily use before depression scores moved (FDA 2025).",
      },
      regulation: {
        value: 8,
        note: "FDA granted the first home-use PMA to Flow's tDCS device for moderate-to-severe MDD on Dec 8, 2025 (FDA 2025); healthy-adult enhancement still sells only under the wellness carve-out.",
      },
      cost: {
        value: 9,
        note: "US retail is set at $500-800 for the FDA-cleared device, already sold in the EU since 2020 near $537; component cost keeps consumer tDCS units in the low hundreds (Flow Neuroscience 2025).",
      },
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
        note: "Barksdale et al. (2025) report unblinded secondary effects of d=0.43-1.50 on depression, anxiety, and PTSD symptoms after 15 amygdala sessions; no blinded trial has yet shown a comparable clinical-magnitude endpoint.",
      },
      steerability: {
        value: 8,
        note: "Skull-conformal arrays now hit 8.9mm axial focus at 36mm depth through ex vivo skull (Zhang et al. 2025) — subcortex no other noninvasive tool reaches; docked for the auditory confound and amygdala lateralization inconsistency.",
      },
      reliability: {
        value: 4,
        note: "Barksdale et al. (2025) confirm BLA target engagement and a shifted excitation/inhibition balance by double-blind MRS, but every amygdala, ALIC, and thalamic-pain efficacy trial to date enrolls fewer than 50 patients.",
      },
      durability: {
        value: 3,
        note: "A single ~20-minute sonication's neural signature fades within the session; the strongest course-level report is Barksdale et al.'s (2025) 15-session, 3-week protocol, with no data on effects persisting past one course.",
      },
      tolerance: {
        value: 6,
        note: "No tachyphylaxis across a 15-session human course (Barksdale et al. 2025); repeated-exposure dose-response data stay thin, and animal work flags chronic high-frequency exposure as a live caution (Connolly et al. 2025).",
      },
      safety: {
        value: 8,
        note: "No serious AEs across published low-intensity psychiatric trials; a 2025 brain-injury case report from a higher-intensity substance-use trial (Rezai et al. 2025) pushed ITRUSST toward standardized dosing and cavitation monitoring.",
      },
      invasiveness: {
        value: 10,
        note: "Acoustic energy alone crosses the intact skull; nothing is implanted, injected, or incised. The MRI/neuronavigation apparatus around the session is a burden cost, not a bodily one.",
      },
      reversibility: {
        value: 8,
        note: "Tsuchiyagaito et al. (2025) title the ALIC study reversible for a reason: unlike ablative MRgFUS or DBS, low-intensity sonication leaves no lesion and effects decay after the session or course ends.",
      },
      burden: {
        value: 4,
        note: "Barksdale et al.'s (2025) protocol required 15 daily visits over 3 weeks, each with MRI-based neuronavigation re-registration; no home or wearable LIFU device has reached clinical use as of 2026.",
      },
      speed: {
        value: 6,
        note: "A single ~20-minute sonication produces measurable BOLD and connectivity shifts within the session (Barksdale et al. 2025), but the clinical trial's depression and anxiety gains accrued only after multiple daily sessions.",
      },
      regulation: {
        value: 2,
        note: "No FDA IDE pathway or standardized dosing protocol exists for LIFU neuromodulation as of 2026 (per ITRUSST 2025); MRgFUS clearances for tremor and Parkinson's are thermal ablation only, a different regulatory class entirely.",
      },
      cost: {
        value: 5,
        note: "Custom multi-element transducers plus MRI-suite time for neuronavigation keep per-session cost high; marginal reagent cost is near zero, and the 2025 UCL/Oxford wearable helmet spinout has not yet reached commercial pricing.",
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
        note: "COMP005's single 25 mg dose cut MADRS by 3.6 points vs placebo; COMP006 replicated at 3.8 points after two doses (Compass Pathways 2025; 2026). Modest group means, but no other one-shot agent rewrites valuation like this.",
      },
      steerability: {
        value: 4,
        note: "5-HT2A agonists activate receptors cortex-wide, and MDMA floods oxytocin, serotonin, and dopamine at once. Selectivity comes only from set, setting, and integration, not molecular targeting (Cameron et al. 2021).",
      },
      reliability: {
        value: 5,
        note: "COMP005 set a low bar: only 25% of the 25 mg arm reached even a 25% MADRS drop, not the usual 50% cutoff. The EPISODE RCT found no significant separation from niacinamide (Mertens et al. 2026).",
      },
      durability: {
        value: 8,
        note: "COMP005 responders held their gains through at least week 26 after just one or two doses (Compass Pathways 2025) — the strongest single-administration persistence of any non-permanent modality here.",
      },
      tolerance: {
        value: 4,
        note: "5-HT2A receptors downregulate and desensitize within days of repeat dosing (Cameron et al. 2021), capping frequency; ketamine carries dependence liability and MDMA depletes serotonergic terminals with reuse.",
      },
      safety: {
        value: 5,
        note: "AEs cluster on dosing day and are mostly mild (Compass Pathways 2026), but 5-HT2B valvulopathy risk under chronic exposure is biologically plausible (FDA 2025), and MDMA raises heart rate and blood pressure acutely.",
      },
      invasiveness: {
        value: 9,
        note: "Delivered by mouth (psilocybin, MDMA), intranasal spray (esketamine, FDA 2019), or IV/IM infusion (racemic ketamine) — no implant, device, or surgery anywhere in the treatment course.",
      },
      reversibility: {
        value: 3,
        note: "Acute effects run four to six hours for psilocybin and MDMA and cannot be aborted mid-session; ketamine's dissociation clears in about an hour. Durable, not undoable, change is the entire mechanism of action.",
      },
      burden: {
        value: 4,
        note: "Every dose needs a monitored multi-hour session with pre-dosing prep and post-dosing integration; esketamine's REMS alone mandates two hours of onsite observation after each dose (FDA REMS 2024).",
      },
      speed: {
        value: 8,
        note: "MADRS separation from placebo is measurable within 24 hours of a single dose, and ketamine's antidepressant effect peaks within hours — versus weeks for standard SSRIs (Compass Pathways 2025).",
      },
      regulation: {
        value: 4,
        note: "Esketamine, approved in 2019, is the only scaled legal channel; psilocybin's NDA carries a National Priority Voucher toward a Q4 2026 decision, while MDMA's 2024 CRL shows how easily this stalls (FDA 2024; 2026).",
      },
      cost: {
        value: 8,
        note: "Raw synthesis runs single dollars per dose, but supervision is what patients pay for: real-world psilocybin courses cost $3,500-9,500 and esketamine sessions average about $750 (Avancena et al. 2025).",
      },
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
        note: "Raises arousal and effort tolerance within the hour, but measured cognition gain is small: SMD 0.21 methylphenidate, 0.12 modafinil, null d-amphetamine in healthy adults (Montgomery et al. 2020).",
      },
      steerability: {
        value: 3,
        note: "Amphetamine reverses DAT/NET transport, methylphenidate blocks reuptake: both flood arousal, appetite, cardiovascular tone, sleep, and mood circuits at once, not just the target one (Sulzer et al. 2005).",
      },
      reliability: {
        value: 8,
        note: "Near-universal dose-dependent response: DAT/NET blockade raises extracellular monoamines in essentially every user, unlike the small, subject-dependent cognitive gains layered on top (Volkow et al. 2002).",
      },
      durability: {
        value: 1,
        note: "Effect tracks plasma level exactly: methylphenidate half-life is 2-3h (Kimko et al. 1999), modafinil 12-15h (Robertson & Hellriegel 2003), and arousal ends with clearance either way, no persistence after.",
      },
      tolerance: {
        value: 2,
        note: "Repeated dosing blunts striatal dopamine release and the motivational lift within days to weeks, even as the peripheral and cognitive effects persist longer (Volkow et al. 1999).",
      },
      safety: {
        value: 5,
        note: "Amphetamines raise systolic/diastolic BP 1.9/1.8 mmHg and heart rate 3.7 bpm (Chan et al. 2025); high-dose amphetamine carries 5.3x incident psychosis/mania odds vs 1.8x at low dose (Moran et al. 2024).",
      },
      invasiveness: {
        value: 10,
        note: "Oral tablet or capsule; nothing crosses skin or vasculature, and absorption is passive across the gut, the least invasive route on the table (ceiling dimension).",
      },
      reversibility: {
        value: 6,
        note: "A swallowed dose cannot be recalled or blocked; d-amphetamine's ~10h elimination half-life means unwanted arousal or insomnia has to be waited out, not switched off (FDA prescribing information 2023).",
      },
      burden: {
        value: 9,
        note: "Take a pill, but Schedule II bars refills and caps prescriptions at a 90-day supply, and a multi-year amphetamine shortage left ~2% pharmacy availability mid-2026 (DEA 2025).",
      },
      speed: {
        value: 9,
        note: "Plasma Tmax is 2h for methylphenidate (Kimko et al. 1999) and 2-4h for modafinil (Robertson & Hellriegel 2003), but subjective alerting is felt within 30-60 minutes, near the fastest onset in the set.",
      },
      regulation: {
        value: 4,
        note: "Schedule II with no enhancement indication; DEA has renewed pandemic telehealth prescribing annually through 2026 while a permanent rule would exclude Schedule II from general telemedicine (DEA 2025).",
      },
      cost: {
        value: 10,
        note: "Generic amphetamine/methylphenidate runs under $1 per dose at retail pharmacy pricing, the floor of the entire table; caffeine is effectively free (GoodRx 2026).",
      },
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
        note: "Oxytocin's emotion-recognition effect is near-null in meta-analysis (Hedges g=0.08); orexin met its primary endpoint only in orexin-deficient patients, effect in intact adults untested (Keech et al. 2018; Takeda 2025).",
      },
      steerability: {
        value: 4,
        note: "OX2R-selective agonists hit one receptor cleanly, but oral dosing floods the whole body; oxytocin's brain penetration is itself contested, CSF rise decoupled from plasma peak (Striepens et al. 2013; Leng & Ludwig 2016).",
      },
      reliability: {
        value: 4,
        note: "Oveporexton held: over 95 percent of NT1 completers rolled into the extension (Takeda 2025). Oxytocin's largest pediatric RCT to date found no between-group difference on social outcomes (Sikich et al. 2021).",
      },
      durability: {
        value: 2,
        note: "Effect tracks plasma exposure for both routes: oveporexton is dosed twice daily and oxytocin's nasal half-life is minutes; neither leaves lasting change once dosing stops, and no depot exists (Takeda 2025).",
      },
      tolerance: {
        value: 5,
        note: "Repeated oxytocin dosing downregulates forebrain OXTR and blunts social effects in mice (Huang et al. 2014); testosterone silences LH/FSH drive; orexin showed no loss of effect through the 12-week extension (Takeda 2025).",
      },
      safety: {
        value: 6,
        note: "Oveporexton logged insomnia in 48% and urinary urgency in 33% of trial patients (Takeda 2025); testosterone raises MACE/VTE risk via polycythemia (Ory et al. 2022); chronic cortisol impairs memory (Brown 2009).",
      },
      invasiveness: {
        value: 9,
        note: "All four modalities are oral tablet, nasal spray, or injection, with no implant, surgery, or device anywhere in the category; oveporexton and oxytocin are the least invasive routes in the whole matrix (Takeda 2025).",
      },
      reversibility: {
        value: 6,
        note: "Short-half-life agents like oveporexton and nasal oxytocin clear within hours of the last dose, but testosterone's HPG-axis suppression can take months to recover, sometimes needing rFSH support (Liberto et al. 2025).",
      },
      burden: {
        value: 8,
        note: "Oveporexton is twice-daily dosing for life with no extended-release formulation in the pipeline yet; oxytocin and testosterone regimens run similarly daily-to-weekly, a real but modest routine (Takeda 2025).",
      },
      speed: {
        value: 6,
        note: "Orexin agonism improves wakefulness within one to seven hours post-dose (Takeda 2025); testosterone's mood and motivation effects build over weeks as levels normalize, not an acute response (Lieberman et al. 2023).",
      },
      regulation: {
        value: 4,
        note: "Approved Aug 5, 2026 for narcolepsy type 1 only, but commercial launch waits on a DEA scheduling decision due within 90 days and specialty-pharmacy setup; no enhancement pathway exists for healthy adults (FDA 2026).",
      },
      cost: {
        value: 7,
        note: "Generic testosterone cypionate runs $15-30 a month and injectable oxytocin cents per dose, but oveporexton carries branded specialty-narcolepsy pricing under patent, pulling the blended category cost up (Takeda 2025).",
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
        note: "No human CNS gene therapy has achieved affective circuit control. The most advanced work is AMT-130 huntingtin knockdown and MCO-010 retinal optogenetics restoring only crude light sensitivity (Nanoscope 2026; uniQure 2026).",
      },
      steerability: {
        value: 7,
        note: "AMT-130's catheter reaches caudate/putamen with confirmed biodistribution (uniQure 2026), but no trial has validated cell-type-specific promoter selectivity for affective circuits. In-principle 10, demonstrated 4, blend 7.",
      },
      reliability: {
        value: 2,
        note: "FDA called uniQure's Phase 1/2 data insufficient in Jan 2026, then accepted its 3-year cUHDRS dataset (75% slowing, p=.003) as BLA-ready that June (uniQure 2026); anti-AAV antibodies bar half of candidates (Boutin et al. 2010).",
      },
      durability: {
        value: 10,
        note: "A single AMT-130 infusion sustained 75% cUHDRS progression slowing through 3 years versus external controls with no re-dosing (uniQure 2026); NHP DREADD expression stays stable up to two years post-injection (Nagai et al. 2025).",
      },
      tolerance: {
        value: 6,
        note: "No receptor tachyphylaxis, but anti-capsid immunity from one dose blocks re-dosing and transgene expression can silence over time; chemogenetic control instead inherits its ligand's own tolerance profile (Verdera et al. 2020).",
      },
      safety: {
        value: 2,
        note: "Capsida's CAP-002 STXBP1 trial killed its first patient from cerebral edema of undetermined cause within two months, closing the program (Capsida 2026); CNO reverse-metabolizes into psychoactive clozapine (Gomez et al. 2017).",
      },
      invasiveness: {
        value: 1,
        note: "Delivery is stereotactic neurosurgery into brain parenchyma — AMT-130 infuses caudate/putamen via implanted catheter (uniQure 2026) — on top of permanent genomic transgene integration; nothing about the route is non-invasive.",
      },
      reversibility: {
        value: 2,
        note: "Chemogenetic receptors go inert once the ligand clears — JHU37160 and uPSEM817 wash out within hours (Bonaventura et al. 2019) — but the AAV transgene itself integrates or persists as an episome and cannot be excised.",
      },
      burden: {
        value: 6,
        note: "Chemogenetic designs require a standing ligand dose, and FDA guidance sets long-term follow-up at up to 5 years for non-integrating AAV vectors and 15 years for integrating ones (FDA 2020) — real monitoring, not zero-effort.",
      },
      speed: {
        value: 2,
        note: "Macaque DREADD expression peaks around 60 days post-injection and needs up to a year to fully stabilize (Nagai et al. 2025) — roughly 12x slower than TMS's fastest 5-day protocol.",
      },
      regulation: {
        value: 1,
        note: "No CNS gene therapy is approved for any psychiatric indication. China registered the first seven human DREADD trials in 2026, for epilepsy, Parkinson's, and pain, with no data published yet (Roth, NIH BRAIN 2026).",
      },
      cost: {
        value: 1,
        note: "AAV gene therapies list at $850k-$3.5M per dose against $500k-$1M manufacturing COGS, driven by low viral yields and costly downstream purification — no engineering path to consumer-scale pricing (Cell & Gene 2026).",
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
        note: "Extinction is the only entry that directly rewrites valuation circuitry rather than modulating it. CBT scores g=0.79 vs waitlist/care-as-usual (Cuijpers et al. 2023), shrinking against active comparators.",
      },
      steerability: {
        value: 7,
        note: "Shaping reinforces successive approximations and extinction erases one specific CS-US association without touching others — real precision, bounded by what you can reliably evoke to train on.",
      },
      reliability: {
        value: 5,
        note: "About half of CBT patients reach remission with 16-26% dropout across 115 trials (Cuijpers et al. 2023); sham-controlled neurofeedback shows no separation from placebo feedback (Schabus et al. 2017).",
      },
      durability: {
        value: 9,
        note: "Gains outlast treatment: trauma-focused therapy follow-up effect sizes exceed post-treatment scores (g=1.36), and CBT overtakes pharmacotherapy at long-term but not short-term follow-up (Cuijpers et al. 2023).",
      },
      tolerance: {
        value: 9,
        note: "Repetition strengthens rather than fatigues the effect: habits reach 95% of peak automaticity at a median 66 days of consistent practice (Lally et al. 2010) — the only entry that gets stronger with use.",
      },
      safety: {
        value: 9,
        note: "Exposure causes small, transient symptom spikes early in treatment that resolve within months in PTSD trials; genuine deterioration hits roughly 5-10% of psychotherapy patients overall (Cuijpers et al. 2021).",
      },
      invasiveness: {
        value: 10,
        note: "No device, substance, or surgical field ever touches the body — the entire intervention is verbal instruction, scheduled practice, and scalp-surface sensors for neurofeedback, nothing implanted.",
      },
      reversibility: {
        value: 5,
        note: "Extinguished associations aren't erased but suppressed by a second, context-bound inhibitory memory (Bouton 1993) — renewal, reinstatement, and spontaneous recovery make both relapse and deliberate undoing unpredictable.",
      },
      burden: {
        value: 1,
        note: "Requires the exact executive function and follow-through the training aims to build — homework completion predicts outcome, and unsupported digital CBT loses up to 74% of users before benefit accrues.",
      },
      speed: {
        value: 1,
        note: "Standard CBT and exposure protocols run 8-20 sessions before response is assessed, since extinction consolidation itself needs spaced repeated trials rather than a single exposure to take hold.",
      },
      regulation: {
        value: 9,
        note: "Self-help apps, coaching, and neurofeedback studios sell directly to healthy adults with no FDA gate; only the AI-delivery channel is starting to narrow, with Illinois and Nevada banning AI chatbot therapy in 2025.",
      },
      cost: {
        value: 7,
        note: "Median in-person session runs $100-250, but LLM-delivered protocols (Therabot, a 4-week RCT vs waitlist: Heinz et al. 2025) run on cents of inference per user, pulling marginal cost toward zero.",
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
