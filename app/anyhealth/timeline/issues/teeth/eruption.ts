/** Tooth eruption over growth (`eruptionFx`, wired into the engine next to growthFx). The atlas has one adult set of 28 permanent teeth (no third molars, no primary teeth), so each permanent tooth is animated through its own life:
 * - hidden until its primary predecessor erupts (or, for the molars, until it erupts itself);
 * - incisor, canine and premolar sites first show a 0.7-scale stand-in for the baby tooth (the primary canine, or the primary first / second molar at the premolar sites), which rises into place over the primary eruption window;
 * - the stand-in is shed at the start of the permanent eruption window, and the permanent tooth rises from 6 mm below its place (above, for upper teeth) while growing from 0.6 to full scale, visible once past half-way, so the swap passes through a gap with no tooth.
 * Ages are the ADA eruption charts' ranges (docs/anyhealth/timeline-medical-basis/eyes-teeth.md). */
import type {GrowthFx,PartFx,Vec3} from '../../types';

type Arch='upper'|'lower';
/** One permanent tooth position (both sides share it). `perm` = permanent eruption window, years; `primary` = the predecessor's eruption window, years (none for the permanent molars). */
interface ToothType {name:string;perm:[number,number];primary?:[number,number]}

const m=(months:number)=>months/12;
/** ADA permanent eruption charts, by arch. */
const TYPES:Record<Arch,ToothType[]>={
	upper:[
		{name:'central secondary incisor',perm:[7,8],primary:[m(8),m(12)]}, // basis: eyes-teeth#erupt-upper, eyes-teeth#primary-upper
		{name:'lateral secondary incisor',perm:[8,9],primary:[m(9),m(13)]}, // basis: eyes-teeth#erupt-upper, eyes-teeth#primary-upper
		{name:'secondary canine',perm:[11,12],primary:[m(16),m(22)]}, // basis: eyes-teeth#erupt-upper, eyes-teeth#primary-upper
		{name:'first secondary premolar',perm:[10,11],primary:[m(13),m(19)]}, // basis: eyes-teeth#erupt-upper, eyes-teeth#primary-upper (primary first molar)
		{name:'second secondary premolar',perm:[10,12],primary:[m(25),m(33)]}, // basis: eyes-teeth#erupt-upper, eyes-teeth#primary-upper (primary second molar)
		{name:'first secondary molar',perm:[6,7]}, // basis: eyes-teeth#erupt-upper
		{name:'second secondary molar',perm:[12,13]}, // basis: eyes-teeth#erupt-upper
	],
	lower:[
		{name:'central secondary incisor',perm:[6,7],primary:[m(6),m(10)]}, // basis: eyes-teeth#erupt-lower, eyes-teeth#primary-lower
		{name:'lateral secondary incisor',perm:[7,8],primary:[m(10),m(16)]}, // basis: eyes-teeth#erupt-lower, eyes-teeth#primary-lower
		{name:'secondary canine',perm:[9,10],primary:[m(17),m(23)]}, // basis: eyes-teeth#erupt-lower, eyes-teeth#primary-lower
		{name:'first secondary premolar',perm:[10,12],primary:[m(14),m(18)]}, // basis: eyes-teeth#erupt-lower, eyes-teeth#primary-lower (primary first molar)
		{name:'second secondary premolar',perm:[11,12],primary:[m(23),m(31)]}, // basis: eyes-teeth#erupt-lower, eyes-teeth#primary-lower (primary second molar)
		{name:'first secondary molar',perm:[6,7]}, // basis: eyes-teeth#erupt-lower
		{name:'second secondary molar',perm:[11,13]}, // basis: eyes-teeth#erupt-lower
	],
};

/** Occlusal travel of an erupting tooth, metres (it starts this far short of its place). */
export const ERUPT_TRAVEL=0.006; // basis: eyes-teeth#erupt-travel
/** Scale of an erupting tooth at the start of its window (1 when in place). */
export const ERUPT_SCALE0=0.6; // basis: eyes-teeth#erupt-scale
/** Scale of a primary stand-in relative to the permanent tooth. */
export const PRIMARY_SCALE=0.7; // basis: eyes-teeth#primary-scale

/** Every permanent tooth part in the atlas with its arch and eruption ages. */
export const TEETH:{part:string;arch:Arch;perm:[number,number];primary?:[number,number]}[]=(['upper','lower'] as Arch[]).flatMap(arch=>['Left','Right'].flatMap(side=>TYPES[arch].map(t=>({part:`${side} ${arch} ${t.name} tooth`,arch,perm:t.perm,primary:t.primary}))));

const clamp01=(x:number)=>Math.min(1,Math.max(0,x));
/** Eruption progress 0..1 at `age` through window [a,b]. */
export const progress=(age:number,[a,b]:[number,number])=>clamp01((age-a)/(b-a));

/** The fx for one tooth rising into place: progress `p`, arch, final scale `s`. Hidden below half-way. Upper teeth start above their place (+y) and move down; lower teeth start below and move up. */
export function erupting(part:string,p:number,arch:Arch,s=1):PartFx{
	const k=s*(ERUPT_SCALE0+(1-ERUPT_SCALE0)*p),dy=(arch==='upper'?1:-1)*ERUPT_TRAVEL*s*(1-p);
	return {part,visible:p>=0.5?1:0,scale:[k,k,k],translate:[0,dy,0] as Vec3};
}

/** Eruption effects for the body's age. Empty once every permanent tooth is in place (from 13 y). */
export const eruptionFx:GrowthFx=body=>{
	const age=body.ageYears,out:PartFx[]=[];
	for(const t of TEETH){
		if(age>=t.perm[1])continue;
		if(age>=t.perm[0]||!t.primary){out.push(age<t.perm[0]?{part:t.part,visible:0}:erupting(t.part,progress(age,t.perm),t.arch));continue;}
		// Before the permanent window: the primary stand-in (hidden before it erupts).
		const p=progress(age,t.primary);out.push(age<t.primary[0]?{part:t.part,visible:0}:erupting(t.part,p,t.arch,PRIMARY_SCALE));
	}
	return out;
};
