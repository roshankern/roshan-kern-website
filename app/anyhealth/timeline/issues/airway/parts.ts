/** Airway part names and rest-space landmarks, hardcoded so the catalog stays pure and the client bundle doesn't pull in atlas.json.
 *
 * Generated once from public/anyhealth/models/atlas.json with:
 *   node -e "const a=require('./public/anyhealth/models/atlas.json');console.log([...new Set(a.parts.filter(p=>p.system==='respiratory'&&/bronch/i.test(p.name)).map(p=>p.name))].sort())"
 * (22 unique names covering 100 atlas parts; the two arterial 'Bronchial …' names are excluded by the system filter). Landmark numbers are the atlas part `bounds` (metres, rest space). check/airway.check.ts re-derives both from the atlas and fails if they drift. */
import type {Vec3} from '../../types';

/** Every respiratory-system atlas part whose name matches /bronch/i. */
export const BRONCHIAL_TREES=['Inferior lingular bronchial tree','Lateral segmental bronchial tree','Left anterior basal segmental bronchial tree','Left anterior segmental bronchial tree','Left apical segmental bronchial tree','Left lateral basal segmental bronchial tree','Left main bronchus','Left medial basal segmental bronchial tree','Left posterior basal segmental bronchial tree','Left posterior segmental bronchial tree','Left superior segmental bronchial tree','Medial segmental bronchial tree','Right anterior basal segmental bronchial tree','Right anterior segmental bronchial tree','Right apical segmental bronchial tree','Right lateral basal segmental bronchial tree','Right main bronchus proper','Right medial basal segmental bronchial tree','Right posterior basal segmental bronchial tree','Right posterior segmental bronchial tree','Right superior segmental bronchial tree','Superior lingular bronchial tree'];
/** The two main (mainstem) bronchi. */
export const MAIN_BRONCHI=['Left main bronchus','Right main bronchus proper'];
/** The segmental (and lingular) bronchial trees: BRONCHIAL_TREES without the main bronchi. */
export const SEGMENTAL_TREES=BRONCHIAL_TREES.filter(n=>!MAIN_BRONCHI.includes(n));
/** Vocal folds (the atlas has the vocal ligaments). */
export const VOCAL_FOLDS=['Left vocal ligament','Right vocal ligament'];

/** 'Cricoid cartilage' rest bounds, min y: the cricoid's lower edge. */
export const CRICOID_MIN_Y=1.4653112;
/** The subglottic band on the Trachea: from the cricoid lower edge down 2 cm (rest-space y). */
export const SUBGLOTTIC_BAND:[number,number]=[CRICOID_MIN_Y-0.02,CRICOID_MIN_Y]; // basis: airway#subglottic-band
/** Epiglottis pivot for the laryngomalacia curl: its base (rest bounds min y), centred in x and z. */
export const EPIGLOTTIS_BASE:Vec3=[(-0.00859202+0.00723443)/2,1.4868412,(0.008188999999999988+0.015899999999999997)/2];
