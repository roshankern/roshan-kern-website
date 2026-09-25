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
