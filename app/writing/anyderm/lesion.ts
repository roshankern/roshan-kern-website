/**
 * The one lesion the acne-progression figure follows, as a function of day.
 *
 * Everything the figure shows derives from here: the renderer reads the
 * physical state to shape and colour the skin, the scrubber reads the day
 * range and ticks, and the scale bar reads the optics block. Numbers are in
 * mm and days so they can be checked against the literature without a
 * conversion.
 *
 * The arc is an untreated inflammatory lesion over three weeks: a plugged
 * follicle that becomes a closed comedo, inflames into a papule, pustulates,
 * ruptures and crusts, then flattens into a post-inflammatory red mark. Sizes
 * follow the clinical definitions (a papule is ≤5 mm; most run 1–3 mm) and
 * the timings follow the usual textbook course for a single lesion, which is
 * one to two weeks from visible papule to resolution. The keyframes are a
 * plausible instance, not a measurement — nobody has published a per-lesion
 * time series at this resolution, which is rather the point of the article.
 */

export const START_DAY = 0;
export const END_DAY = 21;

/** Day ticks drawn under the scrubber. */
export const DAY_TICKS = [0, 3, 6, 9, 12, 15, 18, 21];

/**
 * What a DermLite DL1 on an iPhone 17 1x camera can actually see. Derivation
 * in anyderm_research.md ("DL1 scale derivation"): DermLite publishes a 15 mm
 * lens and a 10 mm faceplate scale, and no field of view, working distance or
 * magnification at all — "10×" is the dermoscopy convention, not their spec.
 *
 * World units in the renderer are millimetres.
 */
export const OPTICS = {
  /**
   * Field the figure opens on, mm across the canvas: a tight crop of the DL1
   * field, sized so the 3 mm papule at its peak spans about 70% of the width
   * with a third of the frame left as surrounding skin.
   */
  homeFieldMm: 4.5,
  /** Zoom bounds, as field width across the canvas. */
  minFieldMm: 1.5,
  /** Capped so the instrument's dark field edge never enters frame, even at full tilt. */
  maxFieldMm: 7,
  /** Camera tilt clamp, degrees from straight down. Past ~50° the plane reads edge-on. */
  maxPolarDeg: 50,
  /** Narrow, because a dermatoscope is near-telecentric; a wide lens would fisheye a 6 mm patch. */
  cameraFovDeg: 28,
  /** Skin geometry extent, mm square. Sized so no edge enters frame at max zoom-out and max tilt. */
  patchMm: 20,
  /** Soft circular vignette to black, mm from centre — the DL1's own field edge, and it hides the patch edge. */
  vignetteStartMm: 8.5,
  vignetteEndMm: 10,
} as const;

// ----------------------------------------------------------------- stages

/**
 * The arc in words, with the day range each phase spans. The figure itself
 * shows only the day; these name the phases the keyframes below are shaped
 * around, so the timing there can be checked against the clinical course.
 */
export type Stage = {
  key: string;
  label: string;
  from: number;
  to: number;
};

export const STAGES: Stage[] = [
  { key: "microcomedone", label: "microcomedone", from: 0, to: 3 },
  { key: "comedo", label: "closed comedo", from: 3, to: 6 },
  { key: "papule", label: "papule", from: 6, to: 9 },
  { key: "pustule", label: "pustule", from: 9, to: 13 },
  { key: "crust", label: "rupture & crust", from: 13, to: 17 },
  { key: "pie", label: "post-inflammatory mark", from: 17, to: 21 },
];

export function stageAt(day: number): Stage {
  return STAGES.find((s) => day < s.to) ?? STAGES[STAGES.length - 1];
}

// ----------------------------------------------------------------- state

/**
 * Physical state of the lesion. All 0–1 fields are dimensionless drive
 * signals for the shader, scaled so 1 is the peak this arc reaches.
 */
export type LesionState = {
  /** Visible lesion diameter, mm: the raised or discoloured disc. */
  diameterMm: number;
  /** Dome height above the surrounding skin, mm. */
  elevationMm: number;
  /** Perilesional haemoglobin excess: the red ring and flush. */
  erythema: number;
  /** Optical density of the keratin plug at the central ostium. */
  plugDensity: number;
  /** Fraction of the dome capped by a yellow-white pus head. */
  pustuleFrac: number;
  /** Dried serum and blood over the ruptured centre. */
  crust: number;
  /** Flat post-inflammatory erythema left behind as the dome resolves. */
  pie: number;
};

type Keyframe = { day: number } & LesionState;

/**
 * Keyframes, one per turning point. Interpolated with a smoothstep between
 * neighbours, so every field is monotone between keys and never overshoots.
 *
 * Sizes: ostium ~150 µm at rest; a closed comedo 0.5–1 mm; a papule 1–3 mm
 * with a peak here of 3 mm; elevation of a 3 mm papule ~0.5 mm. Timing: the
 * comedo is subclinical for the first week, inflammation builds over days 6–9,
 * pustulation peaks near day 11, rupture and crusting follow within two days,
 * and the mark that remains at day 21 is the one that outlasts everything.
 */
const KEYFRAMES: Keyframe[] = [
  { day: 0,  diameterMm: 0.15, elevationMm: 0.00, erythema: 0.00, plugDensity: 0.15, pustuleFrac: 0.0, crust: 0.0, pie: 0.0 },
  { day: 3,  diameterMm: 0.60, elevationMm: 0.05, erythema: 0.05, plugDensity: 0.50, pustuleFrac: 0.0, crust: 0.0, pie: 0.0 },
  { day: 6,  diameterMm: 1.00, elevationMm: 0.15, erythema: 0.35, plugDensity: 0.70, pustuleFrac: 0.0, crust: 0.0, pie: 0.0 },
  { day: 9,  diameterMm: 2.60, elevationMm: 0.40, erythema: 0.80, plugDensity: 0.60, pustuleFrac: 0.2, crust: 0.0, pie: 0.0 },
  { day: 11, diameterMm: 3.00, elevationMm: 0.50, erythema: 1.00, plugDensity: 0.40, pustuleFrac: 0.8, crust: 0.0, pie: 0.0 },
  { day: 13, diameterMm: 2.80, elevationMm: 0.35, erythema: 0.90, plugDensity: 0.10, pustuleFrac: 0.4, crust: 0.6, pie: 0.0 },
  { day: 15, diameterMm: 2.20, elevationMm: 0.20, erythema: 0.70, plugDensity: 0.05, pustuleFrac: 0.0, crust: 1.0, pie: 0.2 },
  { day: 17, diameterMm: 1.60, elevationMm: 0.08, erythema: 0.50, plugDensity: 0.05, pustuleFrac: 0.0, crust: 0.5, pie: 0.5 },
  { day: 19, diameterMm: 1.20, elevationMm: 0.02, erythema: 0.30, plugDensity: 0.05, pustuleFrac: 0.0, crust: 0.1, pie: 0.8 },
  { day: 21, diameterMm: 1.00, elevationMm: 0.00, erythema: 0.20, plugDensity: 0.05, pustuleFrac: 0.0, crust: 0.0, pie: 0.9 },
];

const FIELDS = [
  "diameterMm", "elevationMm", "erythema", "plugDensity", "pustuleFrac", "crust", "pie",
] as const satisfies readonly (keyof LesionState)[];

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Lesion state on a (fractional) day, clamped to the arc. */
export function lesionAt(day: number): LesionState {
  const d = Math.min(Math.max(day, START_DAY), END_DAY);
  let i = 0;
  while (i < KEYFRAMES.length - 2 && d >= KEYFRAMES[i + 1].day) i++;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  const t = smooth((d - a.day) / (b.day - a.day));
  const out = {} as LesionState;
  for (const f of FIELDS) out[f] = a[f] + (b[f] - a[f]) * t;
  return out;
}
