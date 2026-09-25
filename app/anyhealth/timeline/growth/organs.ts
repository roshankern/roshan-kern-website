/** Per-part growth effects: organs that do not grow like the body around them (eyes, thymus, liver, reproductive organs).
 *
 * The warp already scales every part by `scale` × its segment factors, so each factor here is only the deviation: the organ's linear size
 * relative to its adult size, over the warp's local size relative to the adult warp (uniform, the cube root of along × girth²). "Adult" is the
 * body on the last measurement, so every factor is exactly 1 there and the adult model is unchanged. */
import type {Body,GrowthFx,PartFx,SegmentId,Vec3} from '../types';
import {bodyAt,LAST_MEASURED,monotone} from './proportions';

/** Eyeball axial length, mm, by age (y): 16.8 at birth, 20 at 1 y, 22 at 3 y, 23 at 13 y (Fledelius & Christensen 1996); adult men 23.82 mm at 20–30 y (Larsen 1979). */
const EYE_AXIAL=monotone([[0,16.8],[1,20.0],[3,22.0],[13,23.0],[20,23.82]]); // basis: growth#eye-axial
/** Thymus mass, g: ~15 g at birth, ~35 g at 11–13 y (peak), back toward ~25 g by 20 and ~15 g by 50 (Hammar; Scammon lymphoid type). */
const THYMUS=monotone([[0,15],[12,35],[20,25],[50,15]]); // basis: growth#thymus
/** Liver mass as a fraction of body mass: 4% at birth, 3.5% in the first year, 2.9% at 1–6 y, 2% adult. */
const LIVER_PCT=monotone([[0,0.040],[0.5,0.035],[3.5,0.029],[18,0.020]]); // basis: growth#liver
/** Testicular volume, mL: prepubertal 1–1.5 mL until 11 y, 4 mL at 11.7 y (median onset), ~12 mL at the growth spurt, adult ~20 mL reached ~18 y (Koskela 2024: growth still under way at 17 y; 16.5–18 y ultrasound volumes 6–22 mL). Also used (as a mass fraction) for the epididymides, seminal vesicles and prostate (Scammon genital type). */
const TESTIS=monotone([[0,1.0],[11,1.5],[11.7,4],[13.5,12],[18,20]]); // basis: growth#testis
/** Stretched penile length, cm (Schonfeld & Beebe 1942): 3.5 at term, 6.4 at 10–11 y, 13.3 adult; puberty growth from 11 to 16 y. */
const PENIS=monotone([[0,3.5],[0.25,3.9],[0.75,4.3],[1.5,4.7],[2.5,5.1],[3.5,5.5],[4.5,5.7],[5.5,6.0],[6.5,6.1],[7.5,6.2],[8.5,6.3],[9.5,6.3],[10.5,6.4],[11,6.4],[16,13.3]]); // basis: growth#scammon-genital

/** Rest-space globe centres, from each side's sclera vertex bounds. The atlas.json bounds of "Right sclera", "Right cornea", one "Right choroid" and "Suspensory ligament of right lens" include a stray vertex near x = +0.031, so the default pivot (the rest bounds centre) is wrong for them: every eye part pivots here instead. */
export const GLOBE_CENTRE:Record<'Left'|'Right',Vec3>={Left:[0.0291,1.5962,0.0511],Right:[-0.0305,1.5962,0.0511]};
const EYE_PARTS=(s:'Left'|'Right')=>{const l=s.toLowerCase();return [`${s} sclera`,`${s} cornea`,`${s} lens`,`${s} iris`,`${s} choroid`,`${s} vitreous body`,`Optic part of ${l} retina`,`Anterior chamber of ${l} eyeball`,`${s} corona ciliaris`,`Suspensory ligament of ${l} lens`];};
/** The thymus lobes share one pivot (their joint bounds centre) so they stay together. */
const THYMUS_PIVOT:Vec3=[-0.0015,1.3718,0.0396];
/** Penis parts scale about the root, just in front of the pubic symphysis (hip-bone midline vertices centre y 0.872, front z 0.037), so the shaft stays attached. */
const PENIS_PIVOT:Vec3=[0,0.855,0.045];
const PENIS_PARTS=['Corpus cavernosum of penis','Corpus spongiosum of penis','Glans penis','Deep dorsal vein of penis','Superficial dorsal vein of penis','Left superficial dorsal vein of penis','Right superficial dorsal vein of penis','Left dorsal artery of penis','Right dorsal artery of penis'];
/** Each epididymis scales about its testis centre so the two stay in contact. */
const TESTIS_CENTRE:Record<'Left'|'Right',Vec3>={Left:[0.0175,0.7823,0.0524],Right:[-0.0207,0.7829,0.0523]};

/** The warp's uniform local size for a segment (bone girth): scale × ∛(along × girth²). The reproductive parts use the trunk here although they sit where the trunk and thigh weights blend: an approximation (the two segments' local sizes differ by a few % at most ages). */
const local=(b:Body,s:SegmentId)=>b.scale*Math.cbrt(b.length[s]*b.boneGirth[s]**2);
let adult:Body|null=null;
const adultBody=()=>adult??=bodyAt(LAST_MEASURED);

/** Part effects for the body on one date: uniform scale about the part (or assembly) centre. */
export const growthFx:GrowthFx=body=>{
	const A=adultBody(),age=body.ageYears,aAge=A.ageYears,out:PartFx[]=[];
	const put=(parts:string[],size:number,seg:SegmentId,pivot?:Vec3)=>{const k=size*local(A,seg)/local(body,seg);for(const part of parts)out.push(pivot?{part,scale:[k,k,k],pivot}:{part,scale:[k,k,k]});};
	const eye=EYE_AXIAL(age)/EYE_AXIAL(aAge);for(const s of ['Left','Right'] as const)put(EYE_PARTS(s),eye,'head',GLOBE_CENTRE[s]);
	put(['Left lobe of thymus','Right lobe of thymus'],Math.cbrt(THYMUS(age)/THYMUS(aAge)),'trunk',THYMUS_PIVOT);
	put(['Caudate lobe of liver'],Math.cbrt(LIVER_PCT(age)*body.weightKg/(LIVER_PCT(aAge)*A.weightKg)),'trunk');
	const gen=Math.cbrt(TESTIS(age)/TESTIS(aAge));
	put(['Left testis','Right testis','Prostate','Left seminal vesicle','Right seminal vesicle'],gen,'trunk');
	for(const s of ['Left','Right'] as const)put([`${s} epididymis`],gen,'trunk',TESTIS_CENTRE[s]);
	put(PENIS_PARTS,PENIS(age)/PENIS(aAge),'trunk',PENIS_PIVOT);
	return out;
};
