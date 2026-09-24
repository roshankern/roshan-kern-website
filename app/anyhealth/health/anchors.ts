/** Where each issue's dot sits on the body. `part` is an exact BodyParts3D part name from
 *  public/anyhealth/models/atlas.json. `hint` is a model-space point in metres (y up, +x = the
 *  body's left, +z = front); the dot goes on the part's vertex nearest the hint, or nearest the
 *  part's bounds centre without one. See docs/superpowers/specs/2026-09-24-anyhealth-health-issues-design.md. */
import {SYSTEMS, type SystemId} from '../atlas/anatomy';
import type {Category, Issue} from './types';

/** `system` is the part's system in atlas.json, hardcoded so the dot colour needs no fetch. */
export interface Anchor {part: string; system: SystemId; hint?: [number, number, number]}

const HEART: Anchor = {part: 'Wall of ventricle', system: 'cardiac', hint: [0.03, 1.3, 0.09]};
/** Subglottic airway: top of the trachea, just below the cricoid (which BodyParts3D files under skeletal). */
const SUBGLOTTIS: Anchor = {part: 'Trachea', system: 'respiratory', hint: [0, 1.465, 0.01]};
const LEFT_BRONCHUS: Anchor = {part: 'Left main bronchus', system: 'respiratory'};
const RIGHT_BRONCHUS: Anchor = {part: 'Right main bronchus proper', system: 'respiratory'};
const TONGUE: Anchor = {part: 'Tongue', system: 'digestive', hint: [0, 1.535, 0.07]};
const NOSE: Anchor = {part: 'Right lateral nasal cartilage', system: 'respiratory', hint: [-0.012, 1.575, 0.1]};
const STOMACH: Anchor = {part: 'Stomach', system: 'digestive', hint: [0.05, 1.18, 0.1]};
const HUMERUS: Anchor = {part: 'Left humerus', system: 'skeletal', hint: [0.21, 1.31, 0.01]};

const ANCHORS: Record<string, Anchor> = {
	// Blood: all on the heart.
	'microcytosis-suspected-thalassemia-2004': HEART,
	'first-abnormal-cbc-2023': HEART,
	'hematology-eval-2024': HEART,
	'beta-thalassemia-minor-confirmed-2024': HEART,
	'function-health-cbc-thalassemia-signature-2026': HEART,
	'function-health-out-of-range-2026': HEART,
	// Upper airway.
	'infant-laryngomalacia-2003': {part: 'Epiglottis', system: 'respiratory'},
	'infant-croup-neck-xray-2003': SUBGLOTTIS,
	'recurrent-croup-childhood': SUBGLOTTIS,
	'chco-picu-subglottitis-2016': SUBGLOTTIS,
	'microlaryngoscopy-bronchoscopy-2016': {part: 'Epiglottis', system: 'respiratory', hint: [0, 1.5, 0.016]},
	'sky-ridge-er-airway-2016': {part: 'Trachea', system: 'respiratory', hint: [0, 1.42, 0.02]},
	// Lungs.
	'asthma-diagnosis-chronic': LEFT_BRONCHUS,
	'spirometry-asthma-confirmed-2022': LEFT_BRONCHUS,
	'pulmonary-reeval-2024': RIGHT_BRONCHUS,
	'budesonide-formoterol-rx-2026': RIGHT_BRONCHUS,
	'covid-19-infection-2020': RIGHT_BRONCHUS,
	// Allergy.
	'peanut-tree-nut-food-allergy': TONGUE,
	'allergy-workup-tree-nuts-egg-2004': TONGUE,
	'egg-anaphylaxis-daycare': TONGUE,
	'walnut-accidental-exposure-2026': TONGUE,
	'allergic-rhinitis-oral-allergy-syndrome-2016': NOSE,
	'allergy-ige-panel-2016': NOSE,
	'allergic-rhinitis-immunotherapy-eval': NOSE,
	// Skin. Eczema: right palm. Warts: site unstated, so the left hand.
	'childhood-atopic-dyshidrotic-eczema': {part: 'Skin', system: 'integumentary', hint: [-0.28, 0.78, 0.1]},
	'verruca-vulgaris-2018': {part: 'Skin', system: 'integumentary', hint: [0.28, 0.78, 0.1]},
	'neonatal-acne-cradle-cap': {part: 'Skin', system: 'integumentary', hint: [-0.045, 1.575, 0.09]},
	'acne-diagnosis-topical-treatment': {part: 'Skin', system: 'integumentary', hint: [0.045, 1.575, 0.09]},
	'isotretinoin-accutane-course': {part: 'Skin', system: 'integumentary', hint: [0.035, 1.655, 0.1]},
	'chin-laceration-er-2010': {part: 'Skin', system: 'integumentary', hint: [0, 1.495, 0.1]},
	'forehead-laceration-2011': {part: 'Skin', system: 'integumentary', hint: [-0.01, 1.665, 0.1]},
	'right-shin-laceration-2014': {part: 'Skin', system: 'integumentary', hint: [-0.09, 0.32, 0.03]},
	// Eyes.
	'infant-left-exotropia': {part: 'Left sclera', system: 'sensory', hint: [0.03, 1.596, 0.07]},
	'bilateral-myopia': {part: 'Right sclera', system: 'sensory', hint: [-0.031, 1.596, 0.07]},
	// Bones.
	'left-humerus-fracture-2009': HUMERUS,
	'healing-humerus-callus-2009': HUMERUS,
	'scoliosis-upper-thoracic-2025': {part: 'Third thoracic vertebra', system: 'skeletal', hint: [0, 1.4, -0.1]},
	// Teeth (the model has no third molars).
	'first-cavity-filling-tooth-3': {part: 'Right upper first secondary molar tooth', system: 'skeletal'},
	'fillings-teeth-30-31-composite': {part: 'Right lower first secondary molar tooth', system: 'skeletal'},
	'city-creek-fillings-30-31': {part: 'Right lower second secondary molar tooth', system: 'skeletal'},
	'wisdom-teeth-extraction': {part: 'Left lower second secondary molar tooth', system: 'skeletal'},
	// Digestive.
	'encopresis-constipation-childhood': {part: 'Rectum', system: 'digestive'},
	'silent-reflux-lpr-omeprazole': {part: 'Esophagus', system: 'digestive', hint: [0.005, 1.47, 0]},
	'gerd-diagnosis-pantoprazole-famotidine-2026': STOMACH,
	'famotidine-nightly-rx-2026': STOMACH,
};

/** Fallback for an issue id with no entry above. */
const CATEGORY_ANCHOR: Record<Category, Anchor> = {
	skin: {part: 'Skin', system: 'integumentary', hint: [-0.28, 0.78, 0.1]},
	vision: {part: 'Right sclera', system: 'sensory', hint: [-0.031, 1.596, 0.07]},
	dental: {part: 'Right upper first secondary molar tooth', system: 'skeletal'},
	respiratory: {part: 'Trachea', system: 'respiratory', hint: [0, 1.42, 0.02]},
	allergy: TONGUE,
	blood: HEART,
	bones: {part: 'Body of sternum', system: 'skeletal', hint: [0, 1.31, 0.12]},
	digestive: STOMACH,
};

export const anchorFor = (issue: Pick<Issue, 'id' | 'category'>): Anchor =>
	ANCHORS[issue.id] ?? CATEGORY_ANCHOR[issue.category] ?? HEART;

/** Stable key for an anchor: issues with the same key share a point and fan out on screen. */
export const anchorKey = (a: Anchor) => a.part + (a.hint ? '@' + a.hint.join(',') : '');

/** The dot colour for an issue: the AnyHealth system colour of the tissue its anchor sits on. */
export function issueColor(issue: Issue): string {
	const system = anchorFor(issue).system;
	return SYSTEMS.find(s => s.id === system)?.color ?? '#20242b';
}
