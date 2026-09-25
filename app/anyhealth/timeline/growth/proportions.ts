/** Body proportions by date: stature, weight and per-segment length and girth factors. Stub from Task 3 (the adult model unchanged); Task 5 implements it. */
import {SEGMENTS,type Body,type Rig,type SegmentId} from '../types';
import {BIRTH_DATE,type GrowthPoint} from '../../health/types';
import {toDays} from '../../health/dates';
import rigJson from './rig.json';
import growthJson from '../../health/growth.json';

const rig=rigJson as Rig;
const ones=()=>Object.fromEntries(SEGMENTS.map(s=>[s,1])) as Record<SegmentId,number>;
/** The latest recorded weight (the adult body the model stands for). */
const ADULT_KG=[...(growthJson as GrowthPoint[])].reverse().find(g=>g.weightKg)?.weightKg??0;

/** The body on `date`. Stub: adult proportions at the model's rest stature (scale 1, every factor 1). */
export function bodyAt(date:string):Body{
	return {date,ageYears:(toDays(date)-toDays(BIRTH_DATE))/365.25,statureM:rig.stature,weightKg:ADULT_KG,scale:1,length:ones(),boneGirth:ones(),softGirth:ones()};
}
