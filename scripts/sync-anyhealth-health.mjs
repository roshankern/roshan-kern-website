// Copies my health history from the private roshan-health atlas into the
// public shape app/anyhealth serves.
//
//   node scripts/sync-anyhealth-health.mjs [path/to/roshan-health]
//
// Reads atlas/src/data/timeline.json, atlas/src/data/growth.json and the record
// figures under atlas/public/figures (default ../roshan-health), and writes:
//
//   app/anyhealth/health/issues.json   Issue[]  (see app/anyhealth/health/types.ts)
//   app/anyhealth/health/growth.json   GrowthPoint[]
//   public/anyhealth/figures/<id>.jpg  re-encoded, with staff initials blacked out
//
// The site is public, so every clinician, prescriber and tech name is removed
// from the text (regex first, then a per-id override table for sentences that
// need rewording), and pharmacy store numbers are dropped. Practice and
// hospital names stay. The script throws if a name pattern survives.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const repo = path.resolve(process.argv[2] ?? "../roshan-health", "atlas");
const figuresIn = path.join(repo, "public/figures");
const issuesOut = path.resolve("app/anyhealth/health/issues.json");
const growthOut = path.resolve("app/anyhealth/health/growth.json");
const figuresOut = path.resolve("public/anyhealth/figures");

/** Record body system (event.layers[0]) to display category. */
const CATEGORY = {
	skin: "skin",
	vision: "vision",
	dental: "dental",
	respiratory: "respiratory",
	allergy: "allergy",
	cardiovascular: "blood",
	skeletal: "bones",
	digestive: "digestive",
};

/**
 * Hand-written replacements, by issue id, for text where cutting the name out
 * with a regex would leave an awkward sentence. Keys are `summary`, `title`, or
 * `chartTitle`. Every clinician mention in the current record is covered here;
 * the regexes below are the safety net for future recollections.
 */
const OVERRIDES = {
	"infant-left-exotropia": {
		summary:
			"A slight asymmetry of the corneal light reflex was flagged at his 2-week check, then measured as a mild outward drift (1-2 mm) of the LEFT eye at his 1- and 2-month well-child visits. The pediatrician consulted ophthalmology, who advised watchful waiting; by his 9-month visit the light reflex was symmetric and normal, with no treatment needed.",
	},
	"childhood-atopic-dyshidrotic-eczema": {
		summary:
			"Eczema began in infancy — his allergist's history puts onset at about 1 month, on the chin and ears — and at 4 months he had scaly, nummular patches on his back, thigh and elbow creases. By age 1 his allergist called it severe atopic dermatitis, treated with Protopic/Elidel, topical steroids and wet wraps. It became mild through later childhood; in 2022 his allergist characterized it as dyshidrotic eczema, controlled with fluocinonide. It is part of his atopic triad with asthma and food allergy.",
	},
	"allergy-workup-tree-nuts-egg-2004": {
		summary:
			"At about age 1, the allergy clinic at The Children's Hospital found skin-test reactions to brazil nut, cashew, hazelnut (2+), almond and pecan (1+). A CAP-RAST drawn the same day confirmed IgE-mediated allergy to peanut (50.9, class 5), egg (15.7), brazil nut (11.9), cashew (11.7) and almond (4.48), with a markedly elevated total IgE of 524. An open soy challenge the same day was passed (he drank more than 4 oz of soymilk). This established the multi-food allergy and severe eczema picture managed through childhood.",
		chartTitle: "CAP-RAST specific IgE (age ~1)",
	},
	"microcytosis-suspected-thalassemia-2004": {
		summary:
			"His first CBC, at age 1, already showed tiny, pale red cells: MCV 55.5, MCH 17.8, RDW 17.8, an elevated red-cell count and marked hypochromia. Because his mother has thalassemia, his allergist wrote that 'he likely does as well.' The same pattern was seen again on his 2016 PICU CBC (MCV 57.3, RBC 6.46), almost 20 years before beta-thalassemia minor was formally confirmed in 2024.",
	},
	"forehead-laceration-2011": {
		summary:
			"At age 7 he was struck in the forehead by a falling tree branch, opening a mid-forehead laceration. The Children's Hospital Colorado ED irrigated it with ~500 mL saline and closed it with three 5-0 nylon sutures under topical (LET) anesthesia; discharged the same day, sutures out 3/17/11.",
	},
	"allergic-rhinitis-oral-allergy-syndrome-2016": {
		summary:
			"At his first visit to the Children's Hospital Colorado allergy clinic (age 13), he was diagnosed with allergic rhinitis (cats, dust, pollens; swollen red nasal turbinates) and oral allergy syndrome: cantaloupe, watermelon, banana, kiwi and avocado made his mouth and ears itch. The melon reaction had first appeared as a +3 cantaloupe skin test in 2009. He was started on nasal washes, Flonase and Zyrtec and was re-issued an EpiPen 0.3 mg with a food-allergy action plan.",
	},
	"microlaryngoscopy-bronchoscopy-2016": {
		summary:
			"Six weeks after the PICU stay he underwent an operative microlaryngoscopy and bronchoscopy to size the airway and rule out an underlying cause of recurrent croup. Findings were reassuring: no subglottic stenosis, no laryngeal cleft, no tracheomalacia, normal mainstem bronchi.",
	},
	"allergy-ige-panel-2016": {
		summary:
			"A comprehensive specific-IgE panel after the PICU stay (Children's Allergy) showed his main airborne triggers are molds (Alternaria 25.7 and Cladosporium 19.7, class IV) and cat (11.9, class III), with smaller positives to grass, tree and weed pollens, dog, dust mite and cockroach. Peanut was still class IV (21.2), and all tree nuts were class I-III. Egg had fallen to class I-II (0.57-0.74), low enough to plan an egg challenge. Total IgE was 489.",
	},
	"asthma-diagnosis-chronic": {
		summary:
			"Wheezing with croup was noted as reactive airway disease from infancy (Jan 2004), but asthma was first formally evaluated at age 13 by Children's Hospital Colorado pulmonology, six weeks after the PICU stay. Spirometry was normal (FEV1 92% of predicted, FeNO 24 ppb), so it was recorded as a 'questionable' mild intermittent asthma and kept on Flovent with albuterol as needed. Spirometry confirmed obstructive asthma in 2022, and UH Cleveland pulmonology classified it as mild-persistent, Th2-predominant asthma in 2024.",
	},
	"allergic-rhinitis-immunotherapy-eval": {
		summary:
			"Adult allergy re-evaluation at Colorado Asthma & Allergy Center for perennial allergic rhinitis, formally diagnosed at Children's Hospital Colorado in 2016. Skin testing showed marked reactivity to nearly all trees, grasses and weeds, cat and dog dander, and every tree nut. Flonase and cetirizine were recommended, the EpiPen 0.3 mg was renewed, and allergy-shot extracts (30 planned doses) were prepared to start over winter break — though a December 2023 note still lists immunotherapy as only being considered.",
	},
	"wisdom-teeth-extraction": {
		summary:
			"All four third molars (#1, #16, #17, #32) — erupted/malpositioned, with #1 partially impacted — surgically removed under IV sedation by an oral surgeon; consultation was 8/21/2023 and surgery 12/26/2023, without complication.",
	},
	"first-abnormal-cbc-2023": {
		summary:
			"A routine fasting CBC (LabCorp, ordered by his adult PCP at Willard Family Practice) flagged marked microcytosis (MCV 64), a high RDW of 18.9 and an elevated red-cell count with normal hemoglobin. This finding launched the hematology workup. It was not the first such result: the same microcytic picture (MCV 55.5) had been found at age 1 in 2004 but was never followed up.",
	},
	"hematology-eval-2024": {
		summary:
			"Seen at UH Seidman Cancer Center hematology for the abnormal CBC. Exam was benign with no splenomegaly; picture judged suspicious for thalassemia trait, and a full workup (thal trait, iron studies, hemolysis, slide review) was ordered.",
	},
	"beta-thalassemia-minor-confirmed-2024": {
		summary:
			'A telehealth hematology follow-up confirmed beta-thalassemia minor. Hemoglobin electrophoresis showed a raised HbA2 of 4.9%, which the pathologist read as "consistent with beta-thalassemia minor." Iron stores were normal (ferritin 67), and the smear showed target cells with no schistocytes or spherocytes. It is a benign inherited trait that explains his small, numerous red cells, and no further workup was needed. A mildly raised AST (41) was flagged for his PCP to recheck.',
	},
	"city-creek-fillings-30-31": {
		summary:
			"New interproximal decay on the lower-right molars restored while out of town: composite fillings #30 DO and #31 MO at City Creek Dental (Salt Lake City); the lingual surfaces flagged by the referring office were judged unnecessary.",
	},
	"pulmonary-reeval-2024": {
		summary:
			"First adult pulmonology visit (UH Cleveland) after a fall flare of shortness of breath linked to allergic rhinitis and inhaled marijuana. Assessed as mild-persistent Th2 asthma; started as-needed Symbicort (ICS/LABA) with counseling to limit inhaled marijuana.",
	},
	"silent-reflux-lpr-omeprazole": {
		summary:
			"On a Teladoc video visit, a year of worsening sore throat and throat-clearing was put down to suspected silent reflux (laryngopharyngeal reflux), perhaps with allergy postnasal drip as well. He started omeprazole 20 mg daily and was told not to eat or drink alcohol within 3 hours of bed and to raise the head of the bed. He was to see ENT if not better in 2 weeks.",
	},
	"gerd-diagnosis-pantoprazole-famotidine-2026": {
		summary:
			"A Doctronic telehealth video consult diagnosed gastro-esophageal reflux disease without esophagitis. This came after the January 2026 Teladoc LPR assessment and an earlier 3–4 week omeprazole trial that he said helped only a little. He was prescribed pantoprazole 40 mg each morning and famotidine 40 mg at night, a 15-day course with no refills that he took from 2026-08-14 to 2026-08-28.",
	},
	"famotidine-nightly-rx-2026": {
		summary:
			"A new prescription for reflux/LPR: famotidine 40 mg, one tablet at bedtime, filled at CVS in Cambridge, MA with 7 refills through September 2027. He reports taking it as directed since the fill date, and it continues after the Symbicort stop.",
	},
	"budesonide-formoterol-rx-2026": {
		summary:
			"A new asthma maintenance prescription: budesonide-formoterol 80/4.5 mcg (generic Symbicort), 2 inhalations twice daily, filled at CVS in Cambridge, MA. He had used no albuterol rescue inhaler since starting it. He stopped on 2026-09-15 after talking with his PCP, who said stopping was fine; his stated reason was a thrush-like white tongue coating that had not been clinically evaluated.",
	},
};

/**
 * Staff initials on the X-ray side markers, as [x0, y0, x1, y1] in the source
 * image's own pixels. Each box covers the tech's initials and leaves the L/R
 * letter visible. Checked by eye against the output.
 */
const REDACT = {
	// "LA" under and right of the big "L" marker, top right.
	"childrens-hospital-colorado/imaging/2009-09-03-left-humerus/47699978443/p01.jpg": [
		[643, 212, 723, 280],
		[613, 278, 695, 328],
	],
	// "TR" under the "L" marker, right edge.
	"childrens-hospital-colorado/imaging/2009-09-25-left-humerus/47699978571/p01.jpg": [[904, 525, 1000, 591]],
	// "AJD" under the "R" marker, left edge. The marker is tilted, so "AJ" and
	// "D" get separate boxes to keep clear of the R's feet.
	"childrens-hospital-colorado/imaging/2016-11-02-neck/47699978821/p01.jpg": [
		[157, 867, 214, 904],
		[186, 861, 206, 868],
		[204, 859, 231, 898],
	],
};

const JPEG_QUALITY = 82;
const MAX_EDGE = 1600;

// ---- Text scrubbing -------------------------------------------------------

const NAME = "[A-Z][a-zA-Z'’-]+";
const SCRUBS = [
	// "(Dr. Atkins)", "(Dr. Dan Atkins, Allergy)" -> "" / "(Allergy)"
	[new RegExp(`\\s*\\(Dr\\.\\s+(?:${NAME}\\s+){0,2}${NAME}\\)`, "g"), ""],
	[new RegExp(`\\(Dr\\.\\s+(?:${NAME}\\s+){0,2}${NAME},\\s*`, "g"), "("],
	[new RegExp(`,?\\s*prescriber\\s+${NAME}(?:\\s+${NAME})?`, "g"), ""],
	[new RegExp(`\\b(?:with|by|from)\\s+Dr\\.\\s+(?:${NAME}\\s+){0,2}${NAME}'?s?`, "g"), ""],
	[new RegExp(`Dr\\.\\s+(?:${NAME}\\s+){0,2}${NAME}'s`, "g"), "the"],
	[new RegExp(`Dr\\.\\s+(?:${NAME}\\s+){0,2}${NAME}`, "g"), "the clinician"],
	// Pharmacy store numbers: "CVS #11242" -> "CVS", "(#11242, Cambridge MA)" -> "(Cambridge MA)"
	[/\s*#\d{3,}\b,?\s*/g, " "],
];

function tidy(s) {
	return s
		.replace(/\(\s*[,;]?\s*\)/g, "")
		.replace(/\(\s*[,;]\s*/g, "(")
		.replace(/\s*[,;]\s*\)/g, ")")
		.replace(/\s+([,.;:)])/g, "$1")
		.replace(/\(\s+/g, "(")
		.replace(/ {2,}/g, " ")
		.trim();
}

function scrub(s) {
	if (typeof s !== "string") return s;
	let out = s;
	for (const [re, to] of SCRUBS) out = out.replace(re, to);
	return tidy(out);
}

/** Words around which a capitalized "First Last" pair is probably a person. */
const PERSON_CUE =
	/\b(?:by|with|saw|seen by|prescriber|provider|physician|surgeon|ophthalmologist|allergist|pulmonologist|hematologist|dermatologist|dentist|orthodontist|pediatrician|PCP|nurse|tech|technician)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g;
const CREDENTIAL = /\b(?:MD|M\.D\.|PA-C|NP|RN|DDS|DMD|FNP|APRN|PharmD)\b/;
const FORBIDDEN = /\bDr\.|prescriber|#\d{3,}/;
/** Capitalized pairs after a cue word that are places or products, not people. */
const NOT_PEOPLE = new Set([
	"Village Pediatrics",
	"Children's Hospital",
	"City Creek",
	"Advanced Dermatology",
	"Sky Ridge",
	"Function Health",
	"Cherry Hills",
]);

function warnings(issue) {
	const out = [];
	const walk = (v, where) => {
		if (typeof v === "string") {
			for (const m of v.matchAll(PERSON_CUE)) {
				if (!NOT_PEOPLE.has(m[1])) out.push(`${where}: possible name "${m[0]}"`);
			}
			if (CREDENTIAL.test(v)) out.push(`${where}: credential in "${v.slice(0, 80)}"`);
		} else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
		else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
	};
	walk(issue, issue.id);
	return out;
}

// ---- Mapping --------------------------------------------------------------

function practice(office) {
	const text = (office ?? "").trim();
	if (/^Self-reported/i.test(text)) return "Self-reported";
	let cut = text.length;
	for (const sep of [" / ", " — ", " ("]) {
		const i = text.indexOf(sep);
		if (i >= 0 && i < cut) cut = i;
	}
	return text.slice(0, cut).trim();
}

const isoDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().startsWith(s);

async function writeFigure(rel, id) {
	const src = path.join(figuresIn, rel.replace(/^\/?figures\//, ""));
	if (!fs.existsSync(src)) throw new Error(`${id}: figure missing at ${src}`);
	const key = path.relative(figuresIn, src).split(path.sep).join("/");
	let img = sharp(src).rotate();
	const rects = REDACT[key] ?? [];
	if (rects.length) {
		// Redact at full resolution first, so the boxes stay in source pixels.
		const { width, height } = await sharp(src).metadata();
		const composites = rects.map(([x0, y0, x1, y1]) => {
			if (x0 < 0 || y0 < 0 || x1 > width || y1 > height || x1 <= x0 || y1 <= y0) {
				throw new Error(`${id}: redaction box ${[x0, y0, x1, y1]} outside ${width}x${height}`);
			}
			return {
				input: { create: { width: x1 - x0, height: y1 - y0, channels: 3, background: "#000" } },
				left: x0,
				top: y0,
			};
		});
		img = sharp(await img.composite(composites).png().toBuffer());
	}
	const file = path.join(figuresOut, `${id}.jpg`);
	await img
		.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
		.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
		.toFile(file);
	return { url: `/anyhealth/figures/${id}.jpg`, redacted: rects.length, file };
}

// ---- Run ------------------------------------------------------------------

const timeline = JSON.parse(fs.readFileSync(path.join(repo, "src/data/timeline.json"), "utf8"));
const growthIn = JSON.parse(fs.readFileSync(path.join(repo, "src/data/growth.json"), "utf8"));

fs.rmSync(figuresOut, { recursive: true, force: true });
fs.mkdirSync(figuresOut, { recursive: true });

const issues = [];
const warned = [];
for (const e of [...timeline].sort((a, b) => a.date.localeCompare(b.date))) {
	const category = CATEGORY[e.layers?.[0]];
	if (!category) throw new Error(`${e.id}: no category for layer ${e.layers?.[0]}`);
	const o = OVERRIDES[e.id] ?? {};
	const issue = {
		id: e.id,
		date: e.date,
		...(e.endDate ? { endDate: e.endDate } : {}),
		title: o.title ?? scrub(e.title),
		summary: o.summary ?? scrub(e.summary),
		category,
		source: practice(e.source?.office),
		...(e.selfReported === true ? { selfReported: true } : {}),
	};
	if (e.figure) {
		const fig = await writeFigure(e.figure, e.id);
		issue.figure = fig.url;
		if (fig.redacted) console.log(`  ${e.id}: ${fig.redacted} redaction box(es)`);
	}
	if (e.labs?.length) {
		issue.labs = e.labs.map((l) => ({ ...l, name: scrub(l.name), refText: scrub(l.refText) }));
	}
	if (e.chart) {
		issue.chart = {
			...e.chart,
			title: o.chartTitle ?? scrub(e.chart.title),
			note: scrub(e.chart.note),
			items: e.chart.items.map((it) => ({ ...it, label: scrub(it.label) })),
		};
	}
	warned.push(...warnings(issue));
	issues.push(issue);
}

const growth = growthIn
	.map((g) => ({
		date: g.date,
		...(g.heightCm != null ? { heightCm: g.heightCm } : {}),
		...(g.weightKg != null ? { weightKg: g.weightKg } : {}),
	}))
	.filter((g) => g.heightCm != null || g.weightKg != null)
	.sort((a, b) => a.date.localeCompare(b.date));

// ---- Checks ---------------------------------------------------------------

const ids = new Set();
for (const i of issues) {
	if (ids.has(i.id)) throw new Error(`duplicate id ${i.id}`);
	ids.add(i.id);
	if (!isoDate(i.date)) throw new Error(`${i.id}: bad date ${i.date}`);
	if (i.endDate && !isoDate(i.endDate)) throw new Error(`${i.id}: bad endDate ${i.endDate}`);
	if (!i.source) throw new Error(`${i.id}: empty source`);
	if (i.figure && !fs.existsSync(path.resolve("public", i.figure.slice(1)))) throw new Error(`${i.id}: figure not written`);
}
for (const g of growth) if (!isoDate(g.date)) throw new Error(`growth: bad date ${g.date}`);

const text = JSON.stringify(issues);
const hit = text.match(new RegExp(`.{0,60}(?:${FORBIDDEN.source}).{0,40}`));
if (hit) throw new Error(`name or store number survived scrubbing: …${hit[0]}…`);
const messy = text.match(/.{0,40}(?: {2}|\(\)|\( |, ,|with ,|by \.|by ,).{0,40}/);
if (messy) throw new Error(`text left messy by scrubbing: …${messy[0]}…`);

fs.writeFileSync(issuesOut, JSON.stringify(issues, null, "\t") + "\n");
fs.writeFileSync(growthOut, JSON.stringify(growth, null, "\t") + "\n");

if (warned.length) {
	console.warn(`\n${warned.length} possible name(s) to review (add to OVERRIDES if real):`);
	for (const w of warned) console.warn("  " + w);
}
console.log(
	`\n${issues.length} issues, ${issues.filter((i) => i.figure).length} figures, ${growth.length} growth points.`,
);
console.log(`Sources: ${[...new Set(issues.map((i) => i.source))].join(", ")}`);
