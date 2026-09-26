// Builds the AnyHealth timeline rig and per-vertex segment weights from the rest-pose atlas: npx tsx scripts/anyhealth-timeline-rig.ts
// Writes app/anyhealth/timeline/growth/rig.json (a Rig) and public/anyhealth/models/segments.bin
// (per atlas part in order, vertexCount × 4 bytes: byte0 = segA | segB<<4, byte1 = round(weightA*255), bytes 2-3 = uint16 LE round(dBone / 2 µm), the rest distance to the nearest bone (distance field; made sliver-safe on soft parts, SLIVER_BETA); see growth/warp.ts SEG_STRIDE).
// Weights (Task 14a): per joint, a child-side indicator centred on the joint plane, faded into the nearest-bone side where one bone clearly owns the tissue; the indicators combine into a tree partition of unity (see WEIGHTS below).
import fs from 'node:fs';
import {loadAtlasNode} from '../app/anyhealth/timeline/check/node-atlas';
import {boneSegment,trunkOnly} from '../app/anyhealth/timeline/growth/segment-map';
import {SEG_STRIDE,D_UNIT} from '../app/anyhealth/timeline/growth/warp';
import {SEGMENTS,type Rig,type Segment,type SegmentId,type Vec3} from '../app/anyhealth/timeline/types';
import {SOFT_SYSTEMS} from '../app/anyhealth/timeline/engine';
import {TriGrid} from '../app/anyhealth/timeline/check/clip-geom';

const RIG_OUT='app/anyhealth/timeline/growth/rig.json',BIN_OUT='public/anyhealth/models/segments.bin';
/** Contact radius for joints, widened step by step if two bones never come that close. */
const CONTACT=[0.006,0.008,0.010,0.012];
/** Weights (Task 14a, Ruling 15). Distances come from per-segment distance fields (GRID voxels, trilinear). For the joint of each child segment C with parent P (d_P = distance to P's bones, d_C = to C's subtree):
 *   plane = smoothstep(−PLANE_B, PLANE_B, (p − J_C)·a_C); nearest = smoothstep(−BLEND, BLEND, d_P − d_C); c_C = mix(plane, nearest, smoothstep(FADE[0], FADE[1], |d_P − d_C|));
 *   siblings (trunk's children) gate each other apart: c_C ×= smoothstep(0, q, (d_M − d_C)/(d_M + d_C)) per sibling M, q = SIB·(1 − smoothstep(SIB_FAR[0], SIB_FAR[1], (d_P − d_C)/(d_P + d_C)))
 *     (a smooth hand-over to the trunk at the crotch / shoulders, a sharp one where the trunk is far, e.g. between the knees, where no tissue crosses the midline);
 *   w_s = (Π c along the path root → s) · (1 − Σ c over s's children); the two heaviest adjacent segments are kept.
 * Chosen by a sweep (see the Task 14a report); overridable as ANYHEALTH_<NAME> (pairs as "lo,hi"). */
const env=(k:string,d:number)=>Number(process.env[`ANYHEALTH_${k}`]??d),pair=(k:string,d:string)=>(process.env[`ANYHEALTH_${k}`]??d).split(',').map(Number);
const GRID=env('GRID',0.005),PLANE_B=env('PLANE_B',0.05),BLEND=env('BLEND',0.02),FADE=pair('FADE','0.02,0.06'),SIB=env('SIB',0.3),SIB_FAR=pair('SIB_FAR','0.1,0.4');
/** Sliver-safe bone distance (Task 14c). The soft inflation moves a vertex by S(γs − γb)·min(1, dBone/ρ)·r, so a per-vertex dBone that is not near-linear across a thin triangle tilts that triangle past 90° (a flip):
 * the distance field is only C0 (trilinear on GRID voxels, with medial-axis kinks between bones), and the atlas has slivers with altitudes down to 0.01 mm on 5 mm edges (intercostals, pharyngeal constrictors).
 * So, per soft part, every triangle's apex (the vertex opposite its longest edge, at altitude h from it, projecting to parameter s along it) must satisfy |dBone_apex − lerp(dBone_a, dBone_b, s)| ≤ SLIVER_BETA·h.
 * Cyclic projection onto these convex slabs (and dBone ≥ 0), moving the apex and both edge ends by the least-squares split, until no vertex moves more than D_UNIT (or SLIVER_ITERS passes): it converges because a constant field satisfies every slab.
 * With |γs − γb| ≤ 0.4·γb that bounds the inflation's tilt of any triangle well below 90° (Task 14c report: axial seam flips at birth 136 → 34; the hand-built infants 1483 → 13). */
const SLIVER_BETA=env('SLIVER_BETA',1),SLIVER_ITERS=env('SLIVER_ITERS',400);
/** Clean weights (Task 14d): every vertex of a soft part matching growth/segment-map.ts TRUNK_ONLY is set to weight 1 on the trunk (the axial remap). The rules, by whole lower-cased part name:
 *   rib cage wall — external / internal / innermost intercostal muscles, serratus anterior, external / internal oblique, transversus abdominis / thoracis, subcostales;
 *   rib cage vessels — lateral thoracic and thoracodorsal arteries / veins, posterior / anterior / superior intercostal arteries and veins;
 *   genitals — testes, epididymides, testicular arteries / veins, spermatic cords, ductus deferentes (deferent ducts), seminal vesicles, prostate, penis (corpora, glans, dorsal vessels), urethra;
 *   pelvic floor — coccygeus, iliococcygeus, pubococcygeus, puborectalis, levator ani and its tendinous arch, perineal muscles, external anal sphincter, bulbospongiosus, ischiocavernosus.
 * Every other vertex keeps its distance-field weights byte for byte (but for the groin, ROOT_T below); the number of vertices this changes (weight bytes differ from the distance-field ones) is asserted, so a rule or mesh change is noticed. dBone is untouched. */
const TRUNK_ONLY_CHANGED=72234;
/** Narrow the groin blend (Task 14d fix round 1): past ROOT_T (rest metres along the thigh axis from the hip joint, smoothstep) a vertex is wholly on the limb side of that joint whatever the distance field says, behind a sharp sibling gate
 * (ROOT_Q: the midline perineum, equidistant from both thighs, still goes to the trunk; the blunt SIB gate had put inner-thigh tissue a third on the trunk). The nearest-bone term had left inner-thigh tissue down to 20 cm below the hip at 20–40% trunk weight (the pubis is as near as the femur there), where the thigh's own along rate
 * (past its short along window, growth/warp.ts LIMB_ALONG) and the remap's differ and folded it. The vertices this changes are counted and asserted (ROOT_T_CHANGED). */
const ROOT_T:Partial<Record<SegmentId,number[]>>=Object.fromEntries((['lThigh','rThigh'] as const).map(id=>[id,pair('ROOT_T_HIP','0.04,0.10')]));
/** ROOT_T acts only inside the limb's cylinder: radius from its axis < ROOT_R (smoothstep off), along it t < the segment length. */
const ROOT_R=pair('ROOT_R','0.06,0.10'),ROOT_Q=env('ROOT_Q',0.14);
const ROOT_T_CHANGED=2250;
/** Skin facing rule (Task 15b): where two body parts rest against each other (the forearm and elbow on the flank, the hand on the thigh), the distance field cannot tell whose skin a vertex is and the joint-plane indicator gives the
 * flank's own Skin 50–90% upper-arm / forearm weight; in infancy the arm's map then drags the flank Skin 4–10 mm inside the lower ribs (clipping check, bones in the Skin). A Skin surface belongs to the body part BEHIND it, not the
 * one it faces: per limb joint (child C) whose subtree does not hold the vertex's nearest bone segment O, with n the rest vertex normal and ∇d the distance fields' unit gradients (pointing away from the bones), the child indicator is
 * scaled by 1 − face(C)·behind(O), face(C) = smoothstep(FACE[0], FACE[1], −n·∇d_C) (the Skin looks at C's subtree), behind(O) = smoothstep(BEHIND[0], BEHIND[1], n·∇d_O) (its nearest bones are behind it). The rule fades in along the limb root's axis (FACE_ROOT). A limb's own Skin
 * (O in C's subtree: between the toes, the fingers, the elbow crease) is never touched. Smoothsteps keep the weights continuous where the normal turns (the axilla dome: ≈ 0 there). Skin only; the changed vertices are counted and
 * asserted (FACING_CHANGED). */
const FACE=pair('FACE','0.3,0.7'),BEHIND=pair('BEHIND','0,0.4');
/** The rule fades in along the limb root's axis (rest metres from the shoulder / hip joint): the axilla and groin keep their distance-field weights (there the Skin turns from trunk to limb and the joint taper blends the two maps). */
const FACE_ROOT=pair('FACE_ROOT','0.18,0.28'),AXIAL_N=3;
const FACING_CHANGED=95;
/** Skin on bone (Task 15b): where a Skin triangle of a limb passes within CONTACT_SKIN of a bone at rest (the coarse Skin mesh lies on the lateral malleolus, knuckles, fingertips and toes), its vertices' dBone (tens of mm: the vertices
 * are far from the bone, the face is not) is lowered to that face distance, so the soft-girth term leaves them on the bone's map there. Otherwise the infant shank's soft deflation (γs 1.02 vs γb 1.59 at birth) drew the Skin
 * 0.6 mm inside the lateral malleolus (clipping check, bones in the Skin). Shank vertices only (dominant segment a shank: the malleoli and the shin): the trunk and head inflate in infancy, and on the fingertips and toes the small Skin triangles flipped (2 at 10 y, 2 on each hand-built infant). Counted and asserted (CONTACT_SKIN_CHANGED). */
const CONTACT_SKIN=env('CONTACT_SKIN',0.001),CONTACT_SKIN_CHANGED=4,LEG=new Set(['lShank','rShank'].map(s=>SEGMENTS.indexOf(s as SegmentId)));
/** One sliver-safe pass over a part (see SLIVER_BETA); returns how many constraints moved a vertex by more than D_UNIT. */
function sliverPass(pos:Float32Array,index:Uint32Array,D:Float64Array,beta:number):number{
	let m=0;const L=(i:number,j:number)=>Math.hypot(pos[i*3]-pos[j*3],pos[i*3+1]-pos[j*3+1],pos[i*3+2]-pos[j*3+2]);
	for(let t=0;t<index.length;t+=3){
		const v0=index[t],v1=index[t+1],v2=index[t+2],e0=L(v1,v2),e1=L(v2,v0),e2=L(v0,v1),k=e0>=e1&&e0>=e2?0:e1>=e2?1:2,c=index[t+k],a=index[t+(k+1)%3],b=index[t+(k+2)%3],ab=[e0,e1,e2][k];if(ab<1e-9)continue;
		const ux=pos[b*3]-pos[a*3],uy=pos[b*3+1]-pos[a*3+1],uz=pos[b*3+2]-pos[a*3+2],wx=pos[c*3]-pos[a*3],wy=pos[c*3+1]-pos[a*3+1],wz=pos[c*3+2]-pos[a*3+2];
		const s=Math.min(1,Math.max(0,(ux*wx+uy*wy+uz*wz)/(ab*ab))),h=Math.hypot(uy*wz-uz*wy,uz*wx-ux*wz,ux*wy-uy*wx)/ab,lim=beta*h,dd=D[c]-(D[a]+(D[b]-D[a])*s);
		const ex=dd>lim?dd-lim:dd<-lim?dd+lim:0;if(!ex)continue;
		const l=ex/(1+(1-s)*(1-s)+s*s);D[c]=Math.max(0,D[c]-l);D[a]=Math.max(0,D[a]+l*(1-s));D[b]=Math.max(0,D[b]+l*s);if(Math.abs(ex)>D_UNIT)m++;
	}
	return m;
}
const NS=SEGMENTS.length,SEG=(id:SegmentId)=>SEGMENTS.indexOf(id);
const r5=(v:number)=>Math.round(v*1e5)/1e5;
const smoothstep=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

async function main(){
	const t0=Date.now(),A=await loadAtlasNode(),{atlas,parts}=A;
	console.log(`atlas: ${parts.length} parts, ${parts.reduce((s,p)=>s+p.position.length/3,0)} vertices (${Date.now()-t0} ms)`);

	// Skeletal parts that intentionally stay unmapped (tendons, muscles filed under skeletal, nose cartilage).
	const unmapped=[...new Set(atlas.parts.filter(p=>p.system==='skeletal'&&!boneSegment(p.name)).map(p=>p.name))];
	console.log(`skeletal parts with no bone segment (weighted by proximity): ${unmapped.length}\n  ${unmapped.join('\n  ')}`);

	/** Every vertex of every part with this exact name, flattened. */
	const verts=(name:string)=>{const ix=A.indicesOf(name);if(!ix.length)throw new Error(`no atlas part named "${name}"`);const n=ix.reduce((s,i)=>s+parts[i].position.length,0),out=new Float32Array(n);let o=0;for(const i of ix){out.set(parts[i].position,o);o+=parts[i].position.length;}return out;};
	/** Centroid of the vertices of `a` within `r` of any vertex of `b` (sparse hash on b with cell r). */
	const contactAt=(a:Float32Array,b:Float32Array,r:number):Vec3|null=>{
		const h=new Map<string,number[]>(),k=(x:number,y:number,z:number)=>`${x},${y},${z}`;
		for(let i=0;i<b.length;i+=3){const key=k(Math.floor(b[i]/r),Math.floor(b[i+1]/r),Math.floor(b[i+2]/r));let l=h.get(key);if(!l)h.set(key,l=[]);l.push(i);}
		let sx=0,sy=0,sz=0,n=0;const r2=r*r;
		for(let i=0;i<a.length;i+=3){
			const x=a[i],y=a[i+1],z=a[i+2],cx=Math.floor(x/r),cy=Math.floor(y/r),cz=Math.floor(z/r);let hit=false;
			for(let dx=-1;dx<=1&&!hit;dx++)for(let dy=-1;dy<=1&&!hit;dy++)for(let dz=-1;dz<=1&&!hit;dz++){const l=h.get(k(cx+dx,cy+dy,cz+dz));if(l)for(const j of l){const ex=b[j]-x,ey=b[j+1]-y,ez=b[j+2]-z;if(ex*ex+ey*ey+ez*ez<=r2){hit=true;break;}}}
			if(hit){sx+=x;sy+=y;sz+=z;n++;}
		}
		return n?[sx/n,sy/n,sz/n]:null;
	};
	const contact=(label:string,a:string,b:string):Vec3=>{
		const va=verts(a),vb=verts(b);
		for(const r of CONTACT){const c=contactAt(va,vb,r);if(c){if(r!==CONTACT[0])console.warn(`WARNING: joint ${label} (${a} ↔ ${b}) had no contact within ${CONTACT[0]*1000} mm; widened to ${r*1000} mm`);return c;}}
		throw new Error(`joint ${label}: ${a} and ${b} never come within ${CONTACT[CONTACT.length-1]*1000} mm`);
	};
	/** The vertex of a part (or parts) that maximises f. */
	const extreme=(v:Float32Array,f:(x:number,y:number,z:number)=>number):Vec3=>{let best=-Infinity,p:Vec3=[0,0,0];for(let i=0;i<v.length;i+=3){const s=f(v[i],v[i+1],v[i+2]);if(s>best){best=s;p=[v[i],v[i+1],v[i+2]];}}return p;};

	// Joints from where bones touch.
	const J:Record<string,Vec3>={};
	for(const [s,S] of [['l','Left'],['r','Right']] as const){
		J[`${s}Hip`]=contact(`${s}Hip`,`${S} femur`,`${S} hip bone`);
		J[`${s}Knee`]=contact(`${s}Knee`,`${S} femur`,`${S} tibia`);
		J[`${s}Ankle`]=contact(`${s}Ankle`,`${S} tibia`,`${S} talus`);
		J[`${s}Shoulder`]=contact(`${s}Shoulder`,`${S} humerus`,`${S} scapula`);
		J[`${s}Elbow`]=contact(`${s}Elbow`,`${S} humerus`,`${S} ulna`);
		J[`${s}Wrist`]=contact(`${s}Wrist`,`${S} radius`,`${S} scaphoid`);
		J[`${s}Fingertip`]=extreme(verts(`Distal phalanx of ${S.toLowerCase()} middle finger`),(x,y)=>-y);
		J[`${s}ToeTip`]=extreme(verts(`Distal phalanx of ${S.toLowerCase()} big toe`),(x,y,z)=>z);
	}
	J.neckBase=contact('neckBase','Seventh cervical vertebra','First thoracic vertebra');
	J.head=contact('head','Atlas','Occipital bone');
	{let best=-Infinity,p:Vec3=[0,0,0];parts.forEach((g,i)=>{if(boneSegment(atlas.parts[i].name)!=='head')return;const q=extreme(g.position,(x,y)=>y);if(q[1]>best){best=q[1];p=q;}});J.headTop=p;}
	J.root=J.lHip.map((v,i)=>(v+J.rHip[i])/2) as Vec3;

	// Segments, parents first (SEGMENTS order): [id, parent, proximal, distal].
	const spec:Record<SegmentId,[SegmentId|null,string,string]>={
		trunk:[null,'root','neckBase'],neck:['trunk','neckBase','head'],head:['neck','head','headTop'],
		lUpperArm:['trunk','lShoulder','lElbow'],lForearm:['lUpperArm','lElbow','lWrist'],lHand:['lForearm','lWrist','lFingertip'],
		rUpperArm:['trunk','rShoulder','rElbow'],rForearm:['rUpperArm','rElbow','rWrist'],rHand:['rForearm','rWrist','rFingertip'],
		lThigh:['trunk','lHip','lKnee'],lShank:['lThigh','lKnee','lAnkle'],lFoot:['lShank','lAnkle','lToeTip'],
		rThigh:['trunk','rHip','rKnee'],rShank:['rThigh','rKnee','rAnkle'],rFoot:['rShank','rAnkle','rToeTip'],
	};
	const segments:Segment[]=SEGMENTS.map(id=>{
		const [parent,a,b]=spec[id],p=J[a],q=J[b],d=q.map((v,i)=>v-p[i]),len=Math.hypot(d[0],d[1],d[2]);
		return {id,parent,joint:p.map(r5) as Vec3,axis:d.map(v=>r5(v/len)) as Vec3,length:r5(len)};
	});
	let yMin=Infinity,yMax=-Infinity;for(const g of parts){const v=g.position;for(let i=1;i<v.length;i+=3){if(v[i]<yMin)yMin=v[i];if(v[i]>yMax)yMax=v[i];}}
	const rig:Rig={segments,stature:r5(yMax-yMin)};
	fs.writeFileSync(RIG_OUT,JSON.stringify(rig,null,'\t')+'\n');
	console.log('\njoints (model metres, +x = body left):');for(const [k,v] of Object.entries(J))console.log(`  ${k.padEnd(11)} [${v.map(x=>x.toFixed(4)).join(', ')}]`);
	console.log('\nsegments:');for(const s of segments)console.log(`  ${s.id.padEnd(10)} length ${s.length.toFixed(4)}  axis [${s.axis.map(x=>x.toFixed(3)).join(', ')}]  parent ${s.parent??'-'}`);
	console.log(`\nstature ${rig.stature} (y ${yMin.toFixed(4)} → ${yMax.toFixed(4)})  (${Date.now()-t0} ms)`);

	// Per-segment distance fields: squared EDT (Felzenszwalb) on a GRID voxel grid seeded by every bone vertex, read back trilinearly (smooth, no point-sample noise).
	const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
	for(const g of parts){const v=g.position;for(let i=0;i<v.length;i+=3)for(let a=0;a<3;a++){if(v[i+a]<lo[a])lo[a]=v[i+a];if(v[i+a]>hi[a])hi[a]=v[i+a];}}
	for(let a=0;a<3;a++){lo[a]-=2*GRID;hi[a]+=2*GRID;}
	const dim=lo.map((l,a)=>Math.ceil((hi[a]-l)/GRID)+1),[nx,ny,nz]=dim,nc=nx*ny*nz,INF=1e20;
	const field:Float32Array[]=[];
	{
		const f=new Float64Array(Math.max(nx,ny,nz)),d=new Float64Array(f.length),vv=new Int32Array(f.length),zz=new Float64Array(f.length+1);
		/** 1-D squared distance transform of f[0..n) into d (Felzenszwalb & Huttenlocher). */
		const dt1=(n:number)=>{let k=0;vv[0]=0;zz[0]=-INF;zz[1]=INF;for(let q=1;q<n;q++){let s=((f[q]+q*q)-(f[vv[k]]+vv[k]*vv[k]))/(2*q-2*vv[k]);while(s<=zz[k]){k--;s=((f[q]+q*q)-(f[vv[k]]+vv[k]*vv[k]))/(2*q-2*vv[k]);}k++;vv[k]=q;zz[k]=s;zz[k+1]=INF;}k=0;for(let q=0;q<n;q++){while(zz[k+1]<q)k++;d[q]=(q-vv[k])*(q-vv[k])+f[vv[k]];}};
		for(let s=0;s<NS;s++){
			const g2=new Float64Array(nc).fill(INF);
			parts.forEach((g,i)=>{if(boneSegment(atlas.parts[i].name)!==SEGMENTS[s])return;const v=g.position;for(let j=0;j<v.length;j+=3){const c=Math.round((v[j]-lo[0])/GRID)+nx*(Math.round((v[j+1]-lo[1])/GRID)+ny*Math.round((v[j+2]-lo[2])/GRID));g2[c]=0;}});
			for(let z=0;z<nz;z++)for(let y=0;y<ny;y++){const o=nx*(y+ny*z);for(let x=0;x<nx;x++)f[x]=g2[o+x];dt1(nx);for(let x=0;x<nx;x++)g2[o+x]=d[x];}
			for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){for(let y=0;y<ny;y++)f[y]=g2[x+nx*(y+ny*z)];dt1(ny);for(let y=0;y<ny;y++)g2[x+nx*(y+ny*z)]=d[y];}
			for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){for(let z=0;z<nz;z++)f[z]=g2[x+nx*(y+ny*z)];dt1(nz);for(let z=0;z<nz;z++)g2[x+nx*(y+ny*z)]=d[z];}
			const out=new Float32Array(nc);for(let c=0;c<nc;c++)out[c]=Math.sqrt(g2[c])*GRID;field.push(out);
		}
	}
	console.log(`\ndistance fields: ${NS} segments on ${nx}×${ny}×${nz} @ ${GRID*1000} mm (${Date.now()-t0} ms)`);
	/** Trilinear samples of every segment's field at (x,y,z) into D. */
	const sample=(x:number,y:number,z:number,D:Float64Array)=>{
		const fx=Math.min(nx-1.001,Math.max(0,(x-lo[0])/GRID)),fy=Math.min(ny-1.001,Math.max(0,(y-lo[1])/GRID)),fz=Math.min(nz-1.001,Math.max(0,(z-lo[2])/GRID));
		const ix=Math.floor(fx),iy=Math.floor(fy),iz=Math.floor(fz),tx=fx-ix,ty=fy-iy,tz=fz-iz,c=ix+nx*(iy+ny*iz),X=1,Y=nx,Z=nx*ny;
		for(let s=0;s<NS;s++){const F=field[s];D[s]=((F[c]*(1-tx)+F[c+X]*tx)*(1-ty)+(F[c+Y]*(1-tx)+F[c+Y+X]*tx)*ty)*(1-tz)+((F[c+Z]*(1-tx)+F[c+Z+X]*tx)*(1-ty)+(F[c+Z+Y]*(1-tx)+F[c+Z+Y+X]*tx)*ty)*tz;}
	};
	/** Rig neighbours of each segment (parent and children). segB is only ever chosen from these, so no blend spans segments the warp scales independently (thigh↔thigh, hand↔thigh, forearm↔trunk). */
	const ADJ=SEGMENTS.map((id,i)=>SEGMENTS.map((_,j)=>j).filter(j=>segments[i].parent===SEGMENTS[j]||segments[j].parent===id));
	const PAR=segments.map(s=>s.parent?SEG(s.parent):-1),KIDS=SEGMENTS.map((_,i)=>PAR.map((p,j)=>p===i?j:-1).filter(j=>j>=0));
	/** Each segment's subtree (itself and every descendant). */
	const SUBTREE=SEGMENTS.map((_,i)=>{const out=[i];for(let k=0;k<out.length;k++)out.push(...KIDS[out[k]]);return out;});
	const D=new Float64Array(NS),DS=new Float64Array(NS),c=new Float64Array(NS),W=new Float64Array(NS),EPS=1e-4;
	/** Unit gradients of every segment's field (GD) and subtree field (GS) at (x,y,z): central differences over one voxel. */
	const GD=new Float64Array(NS*3),GS=new Float64Array(NS*3),Dp=new Float64Array(NS),Dm=new Float64Array(NS);
	const grads=(x:number,y:number,z:number)=>{const h=GRID;for(let a=0;a<3;a++){sample(x+(a===0?h:0),y+(a===1?h:0),z+(a===2?h:0),Dp);sample(x-(a===0?h:0),y-(a===1?h:0),z-(a===2?h:0),Dm);
		for(let s=0;s<NS;s++){GD[s*3+a]=Dp[s]-Dm[s];let mp=Infinity,mm=Infinity;for(const t of SUBTREE[s]){mp=Math.min(mp,Dp[t]);mm=Math.min(mm,Dm[t]);}GS[s*3+a]=mp-mm;}}
		for(const G of [GD,GS])for(let s=0;s<NS;s++){const l=Math.hypot(G[s*3],G[s*3+1],G[s*3+2])||1;G[s*3]/=l;G[s*3+1]/=l;G[s*3+2]/=l;}};
	let facing=0;
	const out=new Uint8Array(parts.reduce((s,p)=>s+p.position.length/3,0)*SEG_STRIDE);let o=0,mixed=0,dropped=0,maxDrop=0,cleaned=0,cleanedParts=0,rootChanged=0;
	const dbgF=process.env.ANYHEALTH_FLOAT_OUT?new Float32Array(out.length/SEG_STRIDE*2):null,dB=new Float64Array(out.length/SEG_STRIDE);
	parts.forEach((g,pi)=>{
		const fixed=boneSegment(atlas.parts[pi].name),v=g.position,nv=v.length/3;
		if(fixed){const s=SEG(fixed);for(let i=0;i<nv;i++){if(dbgF){dbgF[o/SEG_STRIDE*2]=1;dbgF[o/SEG_STRIDE*2+1]=0;}out[o++]=s|s<<4;out[o++]=255;out[o++]=0;out[o++]=0;}return;}
		const toTrunk=trunkOnly(atlas.parts[pi].name);if(toTrunk)cleanedParts++;const isSkin=atlas.parts[pi].name==='Skin',nrm=g.normal;
		for(let i=0;i<nv;i++){
			const x=v[3*i],y=v[3*i+1],z=v[3*i+2];sample(x,y,z,D);let rootMoved=false;
			for(let s=0;s<NS;s++){let m=Infinity;for(const t of SUBTREE[s])m=Math.min(m,D[t]);DS[s]=m;}
			// Child-side indicator per joint (WEIGHTS above).
			c[0]=1;
			for(let s=1;s<NS;s++){
				const P=PAR[s],r=(D[P]-DS[s])/(D[P]+DS[s]+EPS),J=segments[s].joint,a=segments[s].axis,e=D[P]-DS[s];
				const plane=smoothstep(-PLANE_B,PLANE_B,(x-J[0])*a[0]+(y-J[1])*a[1]+(z-J[2])*a[2]),near=smoothstep(-BLEND,BLEND,e);
				let cs=plane+(near-plane)*smoothstep(FADE[0],FADE[1],Math.abs(e));
				const q=Math.max(1e-3,SIB*(1-smoothstep(SIB_FAR[0],SIB_FAR[1],r)));for(const m of KIDS[P])if(m!==s)cs*=smoothstep(0,q,(DS[m]-DS[s])/(DS[m]+DS[s]+EPS));
				const rootT=ROOT_T[SEGMENTS[s]];if(rootT){const t=(x-J[0])*a[0]+(y-J[1])*a[1]+(z-J[2])*a[2],rho=Math.hypot(x-J[0]-t*a[0],y-J[1]-t*a[1],z-J[2]-t*a[2]);let raise=smoothstep(rootT[0],rootT[1],t)*(1-smoothstep(ROOT_R[0],ROOT_R[1],rho))*(t<segments[s].length?1:0);
					if(raise>cs){for(const m of KIDS[P])if(m!==s)raise*=smoothstep(0,ROOT_Q,(DS[m]-DS[s])/(DS[m]+DS[s]+EPS));if(raise>cs){cs=raise;rootMoved=true;}}}
				c[s]=cs;
			}
			// Skin facing rule (FACE above), limb joints only (the axial segments share one remap, so their weights do not move anything).
			let c0:Float64Array|null=null;
			if(isSkin){grads(x,y,z);const n0=nrm[3*i]/127,n1=nrm[3*i+1]/127,n2=nrm[3*i+2]/127,nl=Math.hypot(n0,n1,n2)||1,dot=(G:Float64Array,s:number)=>(n0*G[s*3]+n1*G[s*3+1]+n2*G[s*3+2])/nl;c0=c.slice();
				let own=0;for(let s=1;s<NS;s++)if(D[s]<D[own])own=s;
				for(let s=3;s<NS;s++){if(SUBTREE[s].includes(own))continue;let r=s;while(PAR[r]>=AXIAL_N)r=PAR[r];const Jr=segments[r].joint,ar=segments[r].axis,t=(x-Jr[0])*ar[0]+(y-Jr[1])*ar[1]+(z-Jr[2])*ar[2];
					c[s]*=1-smoothstep(FACE[0],FACE[1],-dot(GS,s))*smoothstep(BEHIND[0],BEHIND[1],dot(GD,own))*smoothstep(FACE_ROOT[0],FACE_ROOT[1],t);}}
			// Tree partition of unity: w_s = (Π of c along the path to s) × (1 − Σ c over s's children).
			let sum=0;
			for(let s=0;s<NS;s++){let path=1;for(let t=s;t>=0;t=PAR[t])path*=c[t];let ch=0;for(const k of KIDS[s])ch+=c[k];W[s]=path*Math.max(0,1-ch);sum+=W[s];}
			// Keep the heaviest segment and its heaviest rig neighbour.
			let sA=0;for(let s=1;s<NS;s++)if(W[s]>W[sA])sA=s;let sB=-1;for(const s of ADJ[sA])if(sB<0||W[s]>W[sB])sB=s;
			const kept=W[sA]+(sB<0?0:W[sB]),drop=sum>0?1-kept/sum:0;if(drop>1e-3)dropped++;if(drop>maxDrop)maxDrop=drop;
			let w=sB<0||kept<=0?1:W[sA]/kept;
			if(Math.round(w*255)>=255){w=1;sB=sA;}else mixed++;
			let dBone=Infinity;for(let s=0;s<NS;s++)dBone=Math.min(dBone,D[s]);
			if(rootMoved&&!toTrunk)rootChanged++;
			if(toTrunk&&(sA|sB<<4)!==0){cleaned++;if(w<1)mixed--;sA=sB=0;w=1;}
			if(c0){const cur=[sA|sB<<4,Math.round(w*255)];c.set(c0);let s2=0;for(let s=0;s<NS;s++){let path=1;for(let t=s;t>=0;t=PAR[t])path*=c[t];let ch=0;for(const k of KIDS[s])ch+=c[k];W[s]=path*Math.max(0,1-ch);s2+=W[s];}
				let a0=0;for(let s=1;s<NS;s++)if(W[s]>W[a0])a0=s;let b0=-1;for(const s of ADJ[a0])if(b0<0||W[s]>W[b0])b0=s;const k0=W[a0]+(b0<0?0:W[b0]);let w0=b0<0||k0<=0?1:W[a0]/k0;if(Math.round(w0*255)>=255){w0=1;b0=a0;}
				if(cur[0]!==(a0|b0<<4)||cur[1]!==Math.round(w0*255)){facing++;if(process.env.ANYHEALTH_FACE_DUMP)console.log(`FACE ${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)} ${SEGMENTS[a0]}/${SEGMENTS[b0]} ${w0.toFixed(2)} -> ${SEGMENTS[sA]}/${SEGMENTS[sB]} ${w.toFixed(2)}`);}}
			if(dbgF){dbgF[o/SEG_STRIDE*2]=w;dbgF[o/SEG_STRIDE*2+1]=dBone;}dB[o/SEG_STRIDE]=dBone;out[o++]=sA|sB<<4;out[o++]=Math.round(w*255);o+=2;
		}
	});
	// Sliver-safe dBone for the soft parts (the only ones inflated), then the uint16 bytes.
	{let vo=0,maxMove=0,left=0;const t1=Date.now();
		parts.forEach((g,pi)=>{const nv=g.position.length/3;
			if(!boneSegment(atlas.parts[pi].name)&&SOFT_SYSTEMS.includes(atlas.parts[pi].system)){const D=dB.subarray(vo,vo+nv),D0=D.slice();let m=1;for(let it=0;it<SLIVER_ITERS&&m;it++)m=sliverPass(g.position,g.index,D,SLIVER_BETA);left+=m;for(let v=0;v<nv;v++)maxMove=Math.max(maxMove,Math.abs(D[v]-D0[v]));}
			vo+=nv;});
		// Skin on bone (CONTACT_SKIN above), after the sliver-safe pass (which would lift the lowered vertices straight back to their neighbours' level).
		{let vo=0,changed=0;parts.forEach((g,pi)=>{const nv=g.position.length/3;if(atlas.parts[pi].name==='Skin'){
			const grid=new TriGrid(g.position,g.index,0.005),faceD=new Float64Array(g.index.length/3).fill(Infinity);
			parts.forEach((b,bi)=>{if(!boneSegment(atlas.parts[bi].name))return;const P=b.position;for(let v=0;v<P.length/3;v++){const h=grid.nearestHit(P[v*3],P[v*3+1],P[v*3+2],CONTACT_SKIN);if(h&&h.d<faceD[h.t])faceD[h.t]=h.d;}});
			for(let t=0;t<faceD.length;t++){if(!(faceD[t]<CONTACT_SKIN))continue;for(let k=0;k<3;k++){const v=g.index[t*3+k],q=(vo+v)*SEG_STRIDE,a=out[q]&15,b=out[q]>>4,wa=out[q+1]/255,dom=wa>=0.5?a:b;if(!LEG.has(dom))continue;if(faceD[t]<dB[vo+v]){dB[vo+v]=faceD[t];changed++;}}}}
			vo+=nv;});
		console.log(`Skin on bone (CONTACT_SKIN): ${changed} shank Skin vertices with dBone lowered (expected ${CONTACT_SKIN_CHANGED})`);
		if(changed!==CONTACT_SKIN_CHANGED&&!process.env.ANYHEALTH_ANY_CLEAN)throw new Error(`CONTACT_SKIN changed ${changed} vertices, expected ${CONTACT_SKIN_CHANGED} (update the constant deliberately, or set ANYHEALTH_ANY_CLEAN=1 to sweep)`);}
		for(let v=0;v<dB.length;v++){const du=Math.min(65535,Math.round(dB[v]/D_UNIT));out[v*SEG_STRIDE+2]=du&255;out[v*SEG_STRIDE+3]=du>>8;}
		console.log(`sliver-safe dBone (beta ${SLIVER_BETA}): largest change ${(maxMove*1000).toFixed(2)} mm, ${left} constraints still moving after ${SLIVER_ITERS} passes (${Date.now()-t1} ms)`);}
	console.log(`trunk-only parts (TRUNK_ONLY): ${cleanedParts} parts, ${cleaned} vertices moved onto the trunk (expected ${TRUNK_ONLY_CHANGED})`);
	console.log(`limb-root blends (ROOT_T): ${rootChanged} vertices with a raised limb-side indicator (expected ${ROOT_T_CHANGED})`);
	console.log(`Skin facing rule (FACE): ${facing} Skin vertices changed (expected ${FACING_CHANGED})`);
	if(facing!==FACING_CHANGED&&!process.env.ANYHEALTH_ANY_CLEAN)throw new Error(`the Skin facing rule changed ${facing} vertices, expected ${FACING_CHANGED} (update the constant deliberately, or set ANYHEALTH_ANY_CLEAN=1 to sweep)`);
	if(rootChanged!==ROOT_T_CHANGED&&!process.env.ANYHEALTH_ANY_CLEAN)throw new Error(`ROOT_T changed ${rootChanged} vertices, expected ${ROOT_T_CHANGED} (update the constant deliberately, or set ANYHEALTH_ANY_CLEAN=1 to sweep)`);
	if(cleaned!==TRUNK_ONLY_CHANGED&&!process.env.ANYHEALTH_ANY_CLEAN)throw new Error(`TRUNK_ONLY changed ${cleaned} vertices, expected ${TRUNK_ONLY_CHANGED}: the rules or the mesh changed (update the constant deliberately, or set ANYHEALTH_ANY_CLEAN=1 to sweep)`);
	if(dbgF)fs.writeFileSync(process.env.ANYHEALTH_FLOAT_OUT!,Buffer.from(dbgF.buffer));
	if(o!==out.length)throw new Error(`wrote ${o} of ${out.length} bytes`);
	fs.writeFileSync(BIN_OUT,out);
	console.log(`blended vertices: ${mixed}; vertices with > 0.1% weight on a third segment (dropped): ${dropped}, max dropped ${maxDrop.toFixed(3)}`);
	console.log(`\nwrote ${RIG_OUT} (${fs.statSync(RIG_OUT).size} B), ${BIN_OUT} (${(fs.statSync(BIN_OUT).size/1e6).toFixed(2)} MB) in ${((Date.now()-t0)/1000).toFixed(1)} s`);
}
main().catch(e=>{console.error(e);process.exit(1);});
