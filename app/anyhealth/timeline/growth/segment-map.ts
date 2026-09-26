/** Fixed part-name → rig segment table for bones (and the teeth, gums and laryngeal cartilages that ride with them). Non-bone parts return null and are weighted by proximity (scripts/anyhealth-timeline-rig.ts). */
import type {SegmentId} from '../types';

type Limb='UpperArm'|'Forearm'|'Hand'|'Thigh'|'Shank'|'Foot';
const S='(?:left|right)';
/** Ordered rules, first match wins. Patterns are anchored on the whole lower-cased name so muscles, vessels and nerves named after a bone (tibialis anterior, ulnar artery, lacrimal gland) never match. Laryngeal comes before the foot so "cuneiform cartilage" is neck and "cuneiform bone" is foot. */
const RULES:[RegExp,SegmentId|Limb][]=[
	[/^(?:(?:left|right) )?(?:cricoid|thyroid|arytenoid|corniculate|cuneiform) cartilage$/,'neck'],
	[/^hyoid bone$/,'neck'],
	[/^(?:atlas|axis|\w+ cervical vertebra|intervertebral disk of (?:axis|\w+ cervical vertebra))$/,'neck'],
	[new RegExp(`^(?:frontal bone|occipital bone|sphenoid bone|ethmoid|vomer|mandible|${S} (?:parietal|temporal|nasal|lacrimal|zygomatic|palatine) bone|${S} maxilla|${S} inferior nasal concha|gingiva of (?:upper|lower) jaw|.* tooth)$`),'head'],
	[new RegExp(`^(?:\\w+ (?:thoracic|lumbar) vertebra|intervertebral disk(?: of \\w+ (?:thoracic|lumbar) vertebra)?|sacrum|coccyx|body of sternum|manubrium|xiphoid process|${S} \\w+ rib|${S} \\w+ costal cartilage|${S} (?:clavicle|scapula|hip bone))$`),'trunk'],
	[new RegExp(`^${S} humerus$`),'UpperArm'],
	[new RegExp(`^${S} (?:radius|ulna)$`),'Forearm'],
	[new RegExp(`^(?:${S} (?:scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|\\w+ metacarpal bone)|(?:proximal|middle|distal) phalanx of ${S} (?:thumb|index finger|middle finger|ring finger|little finger))$`),'Hand'],
	[new RegExp(`^${S} (?:femur|patella)$`),'Thigh'],
	[new RegExp(`^${S} (?:tibia|fibula)$`),'Shank'],
	[new RegExp(`^(?:${S} (?:talus|calcaneus|cuboid bone|(?:medial|intermediate|lateral) cuneiform bone|\\w+ metatarsal bone)|(?:navicular|sesamoid) bone of ${S} foot|(?:proximal|middle|distal) phalanx of ${S} (?:big|second|third|fourth|little) toe)$`),'Foot'],
];

/** The rig segment a bone part belongs to, or null for anything that isn't a mapped bone (weighted by proximity instead). Left/right comes from a leading "Left"/"Right" or "of left/right". */
export function boneSegment(name:string):SegmentId|null{
	const n=name.toLowerCase();
	for(const [re,seg] of RULES){
		if(!re.test(n))continue;
		if(seg==='trunk'||seg==='neck'||seg==='head')return seg;
		const side=/^left\b|\bof left\b/.test(n)?'l':/^right\b|\bof right\b/.test(n)?'r':null;
		return side?`${side}${seg}` as SegmentId:null;
	}
	return null;
}

/** Soft parts that ride wholly on the trunk (Task 14d): the rig script gives every vertex of a matching part weight 1 on the trunk (the axial remap), removing the upper-arm / thigh weight that bleeds in from the distance field
 * at the shoulders and the groin, where it folded them between the remap and the limb map (Task 14c review: 96% of the limb flips at birth). Whole lower-cased name, first match wins:
 * - rib cage wall: external / internal / innermost intercostal muscles, serratus anterior, external / internal oblique, transversus abdominis, subcostales, transversus thoracis;
 * - rib cage vessels: lateral thoracic, thoracodorsal, posterior / anterior / superior intercostal arteries and veins (costal cartilages are bones, mapped to the trunk above);
 * - genitals: testis, epididymis, testicular artery / vein, spermatic cord, ductus deferens (deferent duct), seminal vesicle, prostate, penis (corpus cavernosum / spongiosum, glans, dorsal vessels), urethra;
 * - pelvic floor: coccygeus, iliococcygeus, pubococcygeus, puborectalis, levator ani and its tendinous arch, perineal muscles, external anal sphincter, bulbospongiosus, ischiocavernosus. */
export const TRUNK_ONLY:RegExp[]=[
	/^(?:set of )?(?:external|internal|innermost) intercostal (?:muscle|membrane)s?$/,/^(?:left|right) serratus anterior$/,/^(?:left|right) (?:external|internal) oblique$/,/^(?:left|right) transversus (?:abdominis|thoracis)$/,/^(?:left|right) subcostal(?:is|es)?$/,
	/^(?:left|right) (?:lateral thoracic|thoracodorsal) (?:artery|vein)$/,/^(?:(?:left|right) (?:first |second )?)?(?:posterior|anterior|superior) intercostal (?:artery|arteries|vein|veins)$/,/^set of (?:posterior|anterior) intercostal (?:arteries|veins)$/,
	/^(?:left|right) (?:testis|epididymis|testicular (?:artery|vein)|spermatic cord|ductus deferens|deferent duct|seminal vesicle)$/,/^prostate$/,/penis$/,/^urethra$/,
	/^(?:left|right) (?:coccygeus|iliococcygeus|pubococcygeus|puborectalis|levator ani)$/,/^tendinous arch of levator ani$/,/perineal muscle$/,/^external anal sphincter$/,/^(?:left|right )?(?:bulbospongiosus|ischiocavernosus)$/,
];
/** True when every vertex of this soft part rides wholly on the trunk (TRUNK_ONLY). */
export const trunkOnly=(name:string)=>{const n=name.toLowerCase();return TRUNK_ONLY.some(r=>r.test(n));};
