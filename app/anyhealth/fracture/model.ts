/** The 2009 left humerus fracture as a function of the timeline date: how far the fragments sit
 *  apart and how far healing has gone. Pure data, no three.js, shared by the 3D layer
 *  (fracture-scene.ts) and the UI (the healing status line and the timeline warp).
 *
 *  Record: transverse fracture of the proximal third of the left humeral shaft on 2009-09-02,
 *  hanging arm cast, cast off 2009-09-25, films on 2009-10-15 show new callus in stable alignment.
 *  The phase lengths between those dates follow typical paediatric shaft healing. */
import {toDays} from '../health/dates';

export const FRACTURE_DATE = '2009-09-02';
export const FRACTURE_ISSUE_ID = 'left-humerus-fracture-2009';
/** BodyParts3D part name of the broken bone. */
export const FRACTURE_PART = 'Left humerus';
/** Break level as a fraction of the humerus length, measured from the proximal (shoulder) end. */
export const FRACTURE_LEVEL = 0.34;
/** Wall-clock length of the "snap" played when the date crosses the fracture moving forward. */
export const BREAK_MS = 700;

export type FracturePhase = 'Fracture' | 'Hematoma' | 'Soft callus' | 'Hard callus' | 'Remodeling';

export interface FractureState {
	/** Days since the fracture (fractional). */
	day: number;
	phase: FracturePhase;
	/** Separation of the fragment ends along the bone axis, metres. */
	gap: number;
	/** Sideways shift of the distal fragment, metres. */
	shift: number;
	/** Angulation of the distal fragment about the break, radians. */
	angle: number;
	/** 0..1 strength of the blood clot around the break. */
	hematoma: number;
	/** 0..1 size of the callus sleeve (1 = its full bulge). */
	callus: number;
	/** 0..1 mineralisation: 0 soft cartilage, 1 woven bone. */
	mineral: number;
	/** 0..1 visibility of the dark fracture line. */
	line: number;
}

/** Maximum radial bulge of the callus over the bone surface, metres. */
export const CALLUS_BULGE = 0.0055;
/** Half-length of the callus sleeve along the bone, metres. */
export const CALLUS_HALF_LENGTH = 0.022;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => {const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t);};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Last day of the model: from here the bone is drawn intact again. */
export const HEALED_DAY = 400;

/** The fracture at a timeline date, or null when the bone is intact (before the break, or fully remodelled). */
export function fractureAt(iso: string, fractionalDay?: number): FractureState | null {
	const day = fractionalDay ?? toDays(iso) - toDays(FRACTURE_DATE);
	if (day < 0 || day >= HEALED_DAY) return null;
	// Displaced at the fall; the hanging cast pulls it into alignment over ~3 days; the residual
	// angulation then remodels away over the year (children straighten small angles fully).
	const reduce = smooth(0, 3, day), remodel = smooth(45, HEALED_DAY - 20, day);
	const gap = lerp(lerp(0.0045, 0.0015, reduce), 0, smooth(20, 45, day));
	const shift = lerp(lerp(0.007, 0.0018, reduce), 0, remodel);
	const angle = lerp(lerp(0.2, 0.06, reduce), 0, remodel);
	const hematoma = smooth(0, 0.6, day) * (1 - smooth(4, 16, day));
	const callus = smooth(6, 30, day) * (1 - smooth(60, HEALED_DAY - 10, day));
	const mineral = smooth(20, 50, day);
	const line = 1 - smooth(25, 70, day);
	const phase: FracturePhase = day < 1 ? 'Fracture' : day < 8 ? 'Hematoma' : day < 23 ? 'Soft callus' : day < 60 ? 'Hard callus' : 'Remodeling';
	return {day, phase, gap, shift, angle, hematoma, callus, mineral, line};
}

/** Multiplier on the displacement while the break plays (t = ms since it started): the fragments
 *  fly past their resting offset and settle with a small damped wobble. 1 when done. */
export function breakKick(ms: number): number {
	if (ms >= BREAK_MS) return 1;
	const t = ms / BREAK_MS;
	return 1 + 0.9 * Math.exp(-5 * t) * Math.sin(t * Math.PI * 3.5) - (1 - smooth(0, 0.12, t));
}

/** Timeline density: the track gives these date ranges `k` times their natural width, so a slow
 *  drag across the fracture moves the date about a day at a time. Everything else stays linear. */
export const TIMELINE_DENSITY: {from: string; to: string; k: number}[] = [
	{from: '2009-08-26', to: '2009-12-01', k: 26},
	{from: '2009-12-01', to: '2010-10-06', k: 3},
];
