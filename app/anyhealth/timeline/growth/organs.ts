/** Per-part growth effects: organs that do not grow like the body around them (eyes, thymus, liver, reproductive organs).
 *
 * The warp already scales every part by `scale` × its segment factors, so each factor here is only the deviation: the organ's linear size
 * relative to its adult size, over the warp's local size relative to the adult warp (uniform, the cube root of along × girth²). "Adult" is the
 * body on the last measurement, so every factor is exactly 1 there and the adult model is unchanged. */
import type {Body,GrowthFx,PartFx,Rig,SegmentId,Vec3} from '../types';
import {bodyAt,LAST_MEASURED,monotone} from './proportions';
import {warpState,axialRates} from './warp';
import rig from './rig.json';

/** Piecewise-linear interpolation through [x,y] nodes, held constant outside them: how growth.md fills the grid between ICRP reference ages. */
const linear=(t:[number,number][])=>(v:number)=>{if(v<=t[0][0])return t[0][1];for(let i=1;i<t.length;i++)if(v<=t[i][0]){const [x0,y0]=t[i-1],[x1,y1]=t[i];return y0+(y1-y0)*(v-x0)/(x1-x0);}return t[t.length-1][1];};
/** Eyeball axial length, mm: Rozema 2023 meta-analytic bi-exponential fit (294 studies, valid −0.5 to 20 y), AL = 23.61 − 3.340·e^(−3.006·age) − 3.217·e^(−0.187·age). */
const EYE_AXIAL=(a:number)=>23.61-3.340*Math.exp(-3.006*a)-3.217*Math.exp(-0.187*a); // basis: growth#eye-axial
/** Thymus mass, g, ICRP 89 reference male (13, 30, 30, 40, 35 g at 0, 1, 5, 10, 15 y; adult 25 g placed at 20 y), linear in mass between nodes. */
const THYMUS=linear([[0,13],[1,30],[5,30],[10,40],[15,35],[20,25]]); // basis: growth#thymus
/** Liver as a fraction of body mass, ICRP 89 reference male liver ÷ body mass (130/3.5, 330/10, 570/19, 830/32, 1300/56, 1800/73 at 0, 1, 5, 10, 15, 20 y), linear between nodes; times the measured weight. */
const LIVER_PCT=linear([[0,0.0371],[1,0.0330],[5,0.0300],[10,0.0259],[15,0.0232],[20,0.0247]]); // basis: growth#liver
/** Testicular volume per testis, mL: ultrasound P50 (Joustra 2015, Dutch boys 0.5–19 y); birth extrapolated with ICRP's newborn : 1 y testis mass ratio. */
const TESTIS=monotone([[0,0.23],[0.5,0.40],[1,0.41],[2,0.43],[3,0.44],[4,0.46],[6,0.53],[8,0.58],[10,0.75],[11,1.0],[12,2.0],[13,3.9],[14,6.5],[15,8.8],[16,10.8],[17,12.1],[18,12.9],[19,13.1]]); // basis: growth#testis
/** Prostate mass, g, ICRP 89 reference male (adult 17 g placed at 20 y), linear between nodes. Seminal vesicles have no reference value and follow it. */
const PROSTATE=linear([[0,0.8],[1,1.0],[5,1.2],[10,1.6],[15,4.3],[20,17]]); // basis: growth#prostate
/** Epididymis mass (pair), g, ICRP 89 reference male (adult 4 g placed at 20 y), linear between nodes. */
const EPIDIDYMIS=linear([[0,0.25],[1,0.35],[5,0.45],[10,0.6],[15,1.6],[20,4]]); // basis: growth#epididymis
/** Stretched penile length, cm (Schonfeld & Beebe 1942): 3.5 at term, 6.4 at 10–11 y, 13.3 adult; puberty growth from 11 to 16 y. */
const PENIS=monotone([[0,3.5],[0.25,3.9],[0.75,4.3],[1.5,4.7],[2.5,5.1],[3.5,5.5],[4.5,5.7],[5.5,6.0],[6.5,6.1],[7.5,6.2],[8.5,6.3],[9.5,6.3],[10.5,6.4],[11,6.4],[16,13.3]]); // basis: growth#scammon-genital

/** Rest-space globe centres, from each side's sclera vertex bounds. The atlas.json bounds of "Right sclera", "Right cornea", one "Right choroid" and "Suspensory ligament of right lens" include a stray vertex near x = +0.031, so the default pivot (the rest bounds centre) is wrong for them: every eye part pivots here instead. */
export const GLOBE_CENTRE:Record<'Left'|'Right',Vec3>={Left:[0.0291,1.5962,0.0511],Right:[-0.0305,1.5962,0.0511]};
/** Rest-space anterior poles (corneal apex, the cornea's most anterior vertex). */
export const GLOBE_FRONT:Record<'Left'|'Right',Vec3>={Left:[0.0291,1.5956,0.0660],Right:[-0.0301,1.5958,0.0660]};
/** Eye growth is anchored EYE_ANCHOR of the way from the globe centre to the anterior pole. Relative to the warp the infant globe is large (fx 1.26 at birth, 1.14–1.17 at 3–10 y). About the centre (0) it pushed the cornea 0.7–2.5 mm into the lids
 * and 2–4% of the globe out through them (Task 14c controller note; Task 15b clipping check); about the anterior pole (1, Task 14c) it sank the globe centre 1.5–2.1 mm behind the orbit's (the brief: ≤ 1 mm). 0.45 keeps the centre within
 * 0.8 mm of the orbit's and the globe inside the lids (≤ 0.6% newly outside): a fit between those two gates, not an anatomical landmark. */
export const EYE_ANCHOR=0.45; // basis: growth#eye-axial
/** The eyelid tarsal plates are moulded on the globe (the tarsus follows the curvature of the eye it rests on), so they take the eye's growth transform: with the plates warped alone the grown globe pressed 0.4–0.6 mm into them
 * (Task 15b clipping check: cornea 0.2–0.3 mm, sclera 0.4–0.6 mm; merely riding the displacement at each plate's centre left 0.6 mm at the ends), and with the transform they meet exactly as at rest while staying inside the lid Skin. They scale with the globe (up to 1.26× at birth), so in infancy they may run large relative to the lids. */
const TARSAL_PLATES=(s:'Left'|'Right')=>['upper','lower'].map(u=>`Tarsal plate of ${s.toLowerCase()} ${u} eyelid`);
/** The fixed point of a side's eye growth (EYE_ANCHOR). */
export const eyeAnchor=(s:'Left'|'Right'):Vec3=>{const c=GLOBE_CENTRE[s],f=GLOBE_FRONT[s];return [c[0]+EYE_ANCHOR*(f[0]-c[0]),c[1]+EYE_ANCHOR*(f[1]-c[1]),c[2]+EYE_ANCHOR*(f[2]-c[2])];};
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
/** The warp's real local size at the globe centre (rest y 1.5962): the axial remap's ∛(f′·g²) there (growth/warp.ts axialRates), which sits inside the face → cranium girth window, so it is neither the face nor the head girth alone (fix round 1: head girth left the newborn eye 4.4% under Rozema). */
export const eyeLocal=(b:Body)=>{const [fp,g]=axialRates(warpState(rig as Rig,b),GLOBE_CENTRE.Left[1]);return Math.cbrt(fp*g*g);};
let adult:Body|null=null;
const adultBody=()=>adult??=bodyAt(LAST_MEASURED);

/** Part effects for the body on one date: uniform scale about the part (or assembly) centre. */
export const growthFx:GrowthFx=body=>{
	const A=adultBody(),age=body.ageYears,aAge=A.ageYears,out:PartFx[]=[];
	const put=(parts:string[],size:number,seg:SegmentId,pivot?:Vec3)=>{const k=size*local(A,seg)/local(body,seg);for(const part of parts)out.push(pivot?{part,scale:[k,k,k],pivot}:{part,scale:[k,k,k]});};
	const eye=EYE_AXIAL(age)/EYE_AXIAL(aAge),ke=eye*eyeLocal(A)/eyeLocal(body);
	for(const s of ['Left','Right'] as const){const a=eyeAnchor(s),c=GLOBE_CENTRE[s],t:Vec3=[(1-ke)*(a[0]-c[0]),(1-ke)*(a[1]-c[1]),(1-ke)*(a[2]-c[2])];for(const part of EYE_PARTS(s))out.push({part,scale:[ke,ke,ke],pivot:c,translate:t}); // scale about the centre, then shift so the anchor stays put (the pivot stays the centre for the rotations that share it)
		for(const part of TARSAL_PLATES(s))out.push({part,scale:[ke,ke,ke],pivot:c,translate:t});}
	put(['Left lobe of thymus','Right lobe of thymus'],Math.cbrt(THYMUS(age)/THYMUS(aAge)),'trunk',THYMUS_PIVOT);
	put(['Caudate lobe of liver'],Math.cbrt(LIVER_PCT(age)*body.weightKg/(LIVER_PCT(aAge)*A.weightKg)),'trunk');
	const cb=(g:(a:number)=>number)=>Math.cbrt(g(age)/g(aAge));
	put(['Left testis','Right testis'],cb(TESTIS),'trunk');
	put(['Prostate','Left seminal vesicle','Right seminal vesicle'],cb(PROSTATE),'trunk');
	for(const s of ['Left','Right'] as const)put([`${s} epididymis`],cb(EPIDIDYMIS),'trunk',TESTIS_CENTRE[s]);
	put(PENIS_PARTS,PENIS(age)/PENIS(aAge),'trunk',PENIS_PIVOT);
	return out;
};
