/** Body warp: moves rest-pose points to the body's proportions on a date: an axial height remap for trunk / neck / head (Task 14c) and, for the limbs, linear-blend skinning of per-segment affine maps. The GLSL twin is warp-glsl.ts and must stay line for line with this file (scripts/anyhealth-timeline-glsl.ts checks parity).
 *
 * Axial remap (segments trunk, neck, head = indices 0..2, bones included), in model space before the ground shift:
 *   R(p) = (c_x(y) + g(y)·(x − c0_x(y)), f(y), c_z(y) + g(y)·(z − c0_z(y))),  p = (x, y, z) at rest.
 *   Knots (rest y): Y0 = hip joint (trunk joint), y1 = C7/T1 (neck joint), y2 = MENTON_Y (Mandible rest min y), y3 = atlanto-occipital (head joint). Interval rates:
 *   f′ = S·(ℓ_trunk | ℓ_neck | faceLength | craniumLength), g = S·(γb_trunk | γb_neck | γb_head | γb_head), c0′ = the rest axis slope (dx/dy, dz/dy) of (trunk | neck | neck | head).
 *   Each knot i has a symmetric window [y_i − w_i, y_i + w_i] (AXIAL_WINDOW, non-overlapping); inside it every rate goes from its left to its right value along the C1 smoothstep h_i. f, c0 and c are the integrals
 *   (f(Y0) = S·Y0, c0(Y0) = J_trunk.xz, c(Y0) = S·J_trunk.xz, c′ = f′·c0′ so the warped axis keeps its rest direction); a symmetric window's integral equals the kinked one past the window, so f lands exactly on the
 *   piecewise-linear knot heights outside the windows and f′ stays between its neighbours' rates. g is blended, not integrated.
 *   det ∂R/∂p = g²·f′ > 0 everywhere, so the remap cannot fold (Task 14a review: the per-segment head map stretched the 5.6 cm below the AO joint by ℓ_head and sank the chin into the chest).
 *   A limb whose parent is axial (upper arms, thighs) starts at N_i = R(J_i); each segment term of a vertex uses R for an axial segment and T_i for a limb, so limbs blend into the remap at shoulders and hips.
 *   The normal of R is its inverse transpose: (n_x/g, (n_y − (A n_x + B n_z)/g)/f′, n_z/g) (the same scale as a limb's, so blends are consistent), A = ∂x′/∂y = c0_x′(f′ − g) + g′(x − c0_x), B the same in z.
 *
 * Segment i (SEGMENTS order): rest joint J_i, unit axis a_i, global scale S = body.scale, along factor ℓ_i = body.length, bone perpendicular factor γb_i = body.boneGirth, soft factor γs_i = body.softGirth.
 *   Limb segments (Task 14d, Jacobian-matched joints): d = p − J_i, t = d·a_i, r = d − t a_i, and (u_i, v_i = a_i × u_i) an orthonormal basis of the plane ⟂ a_i:
 *   T_i(p) = N_i + F(t) a_i + λu(t)(u·r) u + λv(t)(v·r) v + (1 − h(t))(β·r) a_i: ONE map (bone girth) for every vertex, so parent and child agree at their joint for soft tissue too (Task 14a).
 *   Over the taper [t0, t1] (LIMB_TAPER, rest metres from the joint; h = the C1 smoothstep, 0 before t0) every rate blends from the PARENT's Jacobian J_P at the joint to the segment's own:
 *     F′ = F0 + (ℓe − F0)·h with F0 = |J_P a_i| (F is its closed-form integral, F(0) = 0); λu, λv = the eigenvalues (eigenvector u) of J_P symmetrised and restricted to the plane ⟂ a_i, → S·γb_i;
 *     the soft coefficient κ = κ0 + (S(γs_i − γb_i) − κ0)·h, κ0 = the parent's at the joint (the remap's max(0, gs − g), or a limb parent's κ).
 *     β = J_Pᵀ a_i − (a_i·J_P a_i) a_i, the parent's along-from-perpendicular block (how an offset ⟂ the axis moves along it: the remap's lateral shear g′·x at the shoulders, a bent joint's off-axis rows), fades out with 1 − h.
 *     (The perpendicular-from-along block, the parent's turn of the axis, is not matched: at the shoulders it sheared the chest wall, birth limb flips 182 → 241; |J_P a| stands in for it in F0, as the brief asks.)
 *     ℓe is solved so F(L_i) = S·ℓ_i·L_i: the segment keeps its length and its child joint's place. So the tissue on both sides of a joint blends two maps with (nearly) the same Jacobian and cannot fold across the blend
 *     (Task 14c review: 96% of the birth limb flips were in the trunk ↔ upper arm / thigh blends). Without β, det = F′·λu·λv > 0 (F′ blends two positive rates, λu, λv two positive-definite blocks); β adds (1 − h)β and −h′(β·r) to
 *     the along row, small against F′ (checked: det > 0 sampled along every limb, warp.check). On t < t0 (the parent side) the map is the joint's linear extension.
 *   N_trunk = S·J_trunk (scale about the origin); N_i = T_parent(J_i), so every child stays attached at its joint.
 *   p' = wA·T_segA(p) + (1 − wA)·T_segB(p) + soft · Σ_{i∈{A,B}} w_i · κ_i(t) · min(1, dBone/ρ_i) · r_i(p), then p'.y += ground (κ = S(γs − γb) past the taper; the axial segments use their own field, below).
 *     The soft-tissue girth is a post-warp inflation: r_i = d − (d·a_i) a_i is the point's rest offset from segment i's axis (ρ_i = |r_i|; the bone-girth map keeps its direction), and dBone is its rest distance to the nearest bone
 *     (segments.bin bytes 2-3; 0 for bone). So tissue dBone from the bone ends S·γs·dBone from it instead of S·γb·dBone, and near the axis (ρ < dBone) it is the plain soft-girth scaling. It vanishes at the bones, so parent and child agree at their joint.
 *     The direction is radial, not the vertex normal: a normal offset folds thin sheets (Task 14a report: 17,836 flipped triangles on the hand-built child, 51,202 on the infant). `soft` = the part is muscular / integumentary / connective.
 *   ground = −(lowest warped sole point): the four points under each ankle and each toe tip on the rest floor (y = 0), warped by their foot segment.
 *   Normal: n' = normalize(wA·M_A n + (1 − wA)·M_B n), M_i = the inverse transpose of segment i's map at p (for a limb, cof(J)/det J of its full Jacobian, warpNormal). */
import {SEGMENTS,type Body,type Rig,type SegmentId,type Vec3} from '../types';

/** segments.bin: per atlas part in order, vertexCount × SEG_STRIDE bytes: byte0 = segA | segB<<4, byte1 = round(weightA·255), bytes 2-3 = round(dBone / D_UNIT) (uint16, little-endian): the rest distance to the nearest bone (0 for bone, capped at 65535 units = 13.1 cm).
 * 16 bits because 0.5 mm steps of dBone alone flip hundreds of thin-sheet triangles (Task 14a report). The engine hands these 4 bytes to the shader unchanged. */
export const SEG_STRIDE=4,D_UNIT=2e-6;
/** Decode vertex v of a segments.bin slice starting at byte `o`: [segA, segB, weightA 0..1, dBone metres]. */
export const segAt=(b:ArrayLike<number>,o:number,v:number):[number,number,number,number]=>{const k=o+v*SEG_STRIDE;return [b[k]&15,b[k]>>4,b[k+1]/255,(b[k+2]|b[k+3]<<8)*D_UNIT];};

export interface WarpState {/** per segment, index = SEGMENTS order */ restJoint:Float32Array;axis:Float32Array;newJoint:Float32Array;/** S·ℓ_i */ alongScale:Float32Array;/** S·γ_i (bone) */ boneScale:Float32Array;/** S·γ_i (soft) */ softScale:Float32Array;/** y shift to keep the feet on the floor */ ground:number;
	/** Axial remap parameters, AXIAL_VEC4 vec4s (the shader's twX): [Y0, S·Y0, f′0, g0], [c0(Y0).xz, c0′0.xz], [c(Y0).xz, (f′0·c0′0).xz], then per knot i = 1..3: [y_i, w_i, Δf′_i, Δg_i], [Δc0′_i.xz, α_i.xz = f′_left·Δc0′ + c0′_left·Δf′], [β_i.xz = Δf′·Δc0′, girth window centre, half-width]; then [S, gs0, 0, 0] and [Δgs_1..3, 0] (gs = the soft girth, blended like g). */ axial:Float64Array;
	/** Per segment, TAPER_STRIDE values (limbs; 0 for trunk / neck / head): [F0, λu0, λv0, κ0, t0, t1, u.xyz, ℓe, β.xyz] (the Task 14d joint taper, see the header). */ taper:Float64Array}

/** Length of one segment's entry in WarpState.taper. */
export const TAPER_STRIDE=13;
/** Axial segments (the height remap): SEGMENTS indices below this (trunk, neck, head). */
export const AXIAL_SEGMENTS=3;
/** Rest menton height: the Mandible's lowest rest vertex (check: warp · axial knots). The face interval runs from here to the atlanto-occipital joint. */
export const MENTON_Y=1.4997412;
/** Half-widths (metres) of the f′ / c0′ smoothstep windows at the C7/T1, menton and atlanto-occipital knots. Non-overlapping: w1 + w2 ≤ menton − C7 (4.585 cm), w2 + w3 ≤ AO − menton (5.590 cm), both used in full.
 * The split was swept (Task 14c report); the seam counts barely move with it. */
export const AXIAL_WINDOW:readonly [number,number,number]=[0.03,0.0158,0.04];
/** Girth windows [centre y, half-width] (metres) of the trunk → neck, neck → face and face → cranium steps of g (and of the soft girth gs). Wider than the f′ windows and allowed to overlap (g is blended, not integrated, so any g > 0 keeps det > 0):
 * the lateral scale's shear A = g′·(x − c0_x) acts on tissue up to 11 cm from the spine (the chin), and with the f′ windows it tore up to 725 triangles at birth (Task 14c report). g stays between its neighbours' values where the steps share a sign.
 * The face → cranium step reaches up to 1.72 m: narrower, its shear tore 25–33 long Skin / hair edges on the back of the head at 3–6 y once the seam bound used the blended soft girth (fix round 1). */
export const AXIAL_GIRTH_WINDOW:readonly (readonly [number,number])[]=[[1.43,0.065],[1.51,0.08],[1.63,0.09]];
/** Length of WarpState.axial in vec4s. */
export const AXIAL_VEC4=14;
/** Joint tapers [t0, t1] (Task 14d), rest metres along the child segment's axis from its joint, by the joint the segment hangs from: over it the child's map goes from the parent's Jacobian at the joint to its own rates (header).
 * Roots (shoulder, hip) start past the humeral / femoral head (adult radius ≈ 2.4 cm) and are done by mid-neck / upper shaft (Task 14c's thigh girth taper); elbow, knee, wrist and ankle start at the joint. */
export const LIMB_TAPER:Readonly<Record<'shoulder'|'hip'|'elbow'|'knee'|'wrist'|'ankle',readonly [number,number]>>={shoulder:[0.03,0.20],hip:[0.06,0.30],elbow:[0,0.12],knee:[0,0.12],wrist:[0,0.12],ankle:[0,0.12]};
/** The LIMB_TAPER entry of a limb segment (the joint it hangs from). */
export const taperOf=(id:SegmentId):readonly [number,number]=>LIMB_TAPER[/UpperArm$/.test(id)?'shoulder':/Thigh$/.test(id)?'hip':/Forearm$/.test(id)?'elbow':/Shank$/.test(id)?'knee':/Hand$/.test(id)?'wrist':'ankle'];
const AX9=9/35;

const lr=[0,0,0,0,0,0,0,0,0,0];
/** A limb segment's rates at rest axial distance t from its joint: [F(t), F′, λu, λv, λu′, λv′, κ, κ′, h, h′] (header; h = the taper smoothstep). Returns a shared array. */
function limbAt(ws:WarpState,i:number,t:number):number[]{
	const T=ws.taper,o=i*TAPER_STRIDE,F0=T[o],t0=T[o+4],t1=T[o+5],le=T[o+9],gb=ws.boneScale[i],k1=ws.softScale[i]-gb,u=(t-t0)/(t1-t0);let h=0,H=0,hp=0;
	if(u>=1){h=1;H=t-(t0+t1)/2;}else if(u>0){const u2=u*u,u3=u2*u;h=u2*(3-2*u);H=(t1-t0)*(u3-0.5*u3*u);hp=6*u*(1-u)/(t1-t0);}
	lr[0]=F0*t+(le-F0)*H;lr[1]=F0+(le-F0)*h;lr[2]=T[o+1]+(gb-T[o+1])*h;lr[3]=T[o+2]+(gb-T[o+2])*h;lr[4]=(gb-T[o+1])*hp;lr[5]=(gb-T[o+2])*hp;lr[6]=T[o+3]+(k1-T[o+3])*h;lr[7]=(k1-T[o+3])*hp;lr[8]=h;lr[9]=hp;return lr;
}
/** T_i(p) of a limb segment without the ground shift. Writes out[0..2]; p may alias out. */
function segPoint(ws:WarpState,i:number,x:number,y:number,z:number,out:number[]|Vec3){
	const k=i*3,o=i*TAPER_STRIDE,T=ws.taper,ax=ws.axis[k],ay=ws.axis[k+1],az=ws.axis[k+2],dx=x-ws.restJoint[k],dy=y-ws.restJoint[k+1],dz=z-ws.restJoint[k+2],t=dx*ax+dy*ay+dz*az,L=limbAt(ws,i,t);
	// G r = λv r + (λu − λv)(u·r) u with r = d − t a exactly, so an identity body maps every point to itself (the stored axis is float32, not exactly unit).
	const ux=T[o+6],uy=T[o+7],uz=T[o+8],rx=dx-t*ax,ry=dy-t*ay,rz=dz-t*az,lv=L[3],su=(L[2]-lv)*(rx*ux+ry*uy+rz*uz),F=L[0];
	out[0]=ws.newJoint[k]+F*ax+lv*rx+su*ux;out[1]=ws.newJoint[k+1]+F*ay+lv*ry+su*uy;out[2]=ws.newJoint[k+2]+F*az+lv*rz+su*uz;
	// The parent's along-from-perpendicular block β (a vector ⟂ a), faded out over the taper: + (1 − h)(β·r) a.
	const br=(1-L[8])*(T[o+10]*rx+T[o+11]*ry+T[o+12]*rz);out[0]+=br*ax;out[1]+=br*ay;out[2]+=br*az;
}
/** A limb segment's local rates at rest point p: [F′, λu, λv, κ, in the taper] (absolute, S included; `in the taper` = rest t < t1, the parent side included), for the seam check's scale bound (Task 14d). */
export function limbRates(ws:WarpState,i:number,x:number,y:number,z:number):[number,number,number,number,boolean]{const k=i*3,t=(x-ws.restJoint[k])*ws.axis[k]+(y-ws.restJoint[k+1])*ws.axis[k+1]+(z-ws.restJoint[k+2])*ws.axis[k+2],L=limbAt(ws,i,t);return [L[1],L[2],L[3],L[6],t<ws.taper[i*TAPER_STRIDE+5]];}

/** One knot's window terms at rest height y: [R, Q, h, h′] with u = (y − y_i + w)/(2w): R = ∫h (the smoothed ramp max(0, y − y_i)), Q = ∫h², h = smoothstep, h′ = dh/dy. */
function knot(X:Float64Array,k:number,y:number,out:number[]){
	const yi=X[k],w=X[k+1],u=(y-yi+w)/(2*w);
	if(u>=1){out[0]=y-yi;out[1]=y-yi-AX9*w;out[2]=1;out[3]=0;}
	else if(u>0){const u2=u*u,u3=u2*u;out[0]=2*w*(u3-0.5*u3*u);out[1]=2*w*u3*u2*(1.8-2*u+(4/7)*u2);out[2]=u2*(3-2*u);out[3]=3*u*(1-u)/w;}
	else{out[0]=0;out[1]=0;out[2]=0;out[3]=0;}
}
const kt=[0,0,0,0];
/** The remap's curves at rest height y: [f, g, c0x, c0z, cx, cz, f′, g′, c0x′, c0z′, gs]. */
function axialCurves(ws:WarpState,y:number,o:number[]){
	const X=ws.axial,d=y-X[0];let f=X[1]+X[2]*d,g=X[3],gs=X[49],c0x=X[4]+X[6]*d,c0z=X[5]+X[7]*d,cx=X[8]+X[10]*d,cz=X[9]+X[11]*d,fp=X[2],gp=0,kx=X[6],kz=X[7];
	for(let k=12;k<48;k+=12){knot(X,k,y,kt);const R=kt[0],Q=kt[1],h=kt[2];{const wg=X[k+11],u=Math.min(1,Math.max(0,(y-X[k+10]+wg)/(2*wg))),hg=u*u*(3-2*u);g+=X[k+3]*hg;gs+=X[51+k/12]*hg;gp+=X[k+3]*3*u*(1-u)/wg;}f+=X[k+2]*R;c0x+=X[k+4]*R;c0z+=X[k+5]*R;cx+=X[k+6]*R+X[k+8]*Q;cz+=X[k+7]*R+X[k+9]*Q;fp+=X[k+2]*h;kx+=X[k+4]*h;kz+=X[k+5]*h;}
	o[0]=f;o[1]=g;o[2]=c0x;o[3]=c0z;o[4]=cx;o[5]=cz;o[6]=fp;o[7]=gp;o[8]=kx;o[9]=kz;o[10]=gs;
}
const cv=[0,0,0,0,0,0,0,0,0,0,0];
/** R(p) without the ground shift. Writes out[0..2]; p may alias out. */
function axialPoint(ws:WarpState,x:number,y:number,z:number,out:number[]|Vec3){axialCurves(ws,y,cv);out[0]=cv[4]+cv[1]*(x-cv[2]);out[1]=cv[0];out[2]=cv[5]+cv[1]*(z-cv[3]);}
/** The inverse transpose of ∂R/∂p at p applied to n (not normalized; the same scale as a limb's, so the blend is consistent). */
function axialNormal(ws:WarpState,x:number,y:number,z:number,nx:number,ny:number,nz:number,out:number[]){
	axialCurves(ws,y,cv);const g=cv[1],fp=cv[6],A=cv[8]*(fp-g)+cv[7]*(x-cv[2]),B=cv[9]*(fp-g)+cv[7]*(z-cv[3]);
	out[0]=nx/g;out[1]=(ny-(A*nx+B*nz)/g)/fp;out[2]=nz/g;
}
/** The remap's local rates at rest height y: [f′, g, gs] (absolute, S included; gs = the blended soft girth), for the seam check's scale bound and the eye's local size. */
export function axialRates(ws:WarpState,y:number):[number,number,number]{axialCurves(ws,y,cv);return [cv[6],cv[1],cv[10]];}

/** Per-segment warp parameters for one body: absolute scales, new joints (parents first) and the floor shift. */
export function warpState(rig:Rig,body:Body):WarpState{
	const n=SEGMENTS.length,S=body.scale,ws:WarpState={restJoint:new Float32Array(n*3),axis:new Float32Array(n*3),newJoint:new Float32Array(n*3),alongScale:new Float32Array(n),boneScale:new Float32Array(n),softScale:new Float32Array(n),ground:0,axial:new Float64Array(AXIAL_VEC4*4),taper:new Float64Array(n*TAPER_STRIDE)};
	const segs=SEGMENTS.map(id=>{const s=rig.segments.find(x=>x.id===id);if(!s)throw new Error(`rig has no segment ${id}`);return s;});
	segs.forEach((s,i)=>{const al=Math.hypot(...s.axis);ws.restJoint.set(s.joint,i*3);ws.axis.set(s.axis.map(v=>v/al),i*3);ws.alongScale[i]=S*body.length[s.id];ws.boneScale[i]=S*body.boneGirth[s.id];ws.softScale[i]=S*body.softGirth[s.id];});
	const q=[0,0,0];
	// Axial remap: interval rates [trunk, neck, face, cranium] and knots [C7/T1, menton, AO].
	{
		const J=ws.restJoint,A=ws.axis,X=ws.axial,T=0,N=3,H=6,lf=body.faceLength??body.length.head,lc=body.craniumLength??body.length.head;
		if(SEGMENTS[0]!=='trunk'||SEGMENTS[1]!=='neck'||SEGMENTS[2]!=='head')throw new Error('axial segments must be SEGMENTS 0..2');
		const sl=[S*body.length.trunk,S*body.length.neck,S*lf,S*lc],gi=[ws.boneScale[0],ws.boneScale[1],S*(body.faceGirth??body.boneGirth.head),ws.boneScale[2]];
		const kx=[A[T]/A[T+1],A[N]/A[N+1],A[N]/A[N+1],A[H]/A[H+1]],kz=[A[T+2]/A[T+1],A[N+2]/A[N+1],A[N+2]/A[N+1],A[H+2]/A[H+1]],ky=[J[N+1],MENTON_Y,J[H+1]];
		X.set([J[T+1],S*J[T+1],sl[0],gi[0],J[T],J[T+2],kx[0],kz[0],S*J[T],S*J[T+2],sl[0]*kx[0],sl[0]*kz[0]]);
		for(let i=0;i<3;i++){const ds=sl[i+1]-sl[i],dx=kx[i+1]-kx[i],dz=kz[i+1]-kz[i];X.set([ky[i],AXIAL_WINDOW[i],ds,gi[i+1]-gi[i],dx,dz,sl[i]*dx+kx[i]*ds,sl[i]*dz+kz[i]*ds,ds*dx,ds*dz,AXIAL_GIRTH_WINDOW[i][0],AXIAL_GIRTH_WINDOW[i][1]],12+i*12);}
		const si=[ws.softScale[0],ws.softScale[1],S*(body.faceGirth!==undefined?body.faceGirth*body.softGirth.head/body.boneGirth.head:body.softGirth.head),ws.softScale[2]];X.set([S,si[0],0,0,si[1]-si[0],si[2]-si[1],si[3]-si[2],0],48);
	}
	segs.forEach((s,i)=>{
		if(!s.parent){ws.newJoint.set([S*ws.restJoint[i*3],S*ws.restJoint[i*3+1],S*ws.restJoint[i*3+2]],i*3);return;}
		const p=SEGMENTS.indexOf(s.parent);if(p>=i)throw new Error(`rig parent ${s.parent} after ${s.id}`);
		// A child of an axial segment starts where the remap puts its joint (limb roots: upper arms, thighs); any other child where its parent's map puts it.
		const k=i*3,x=ws.restJoint[k],y=ws.restJoint[k+1],z=ws.restJoint[k+2];if(p<AXIAL_SEGMENTS)axialPoint(ws,x,y,z,q);else segPoint(ws,p,x,y,z,q);ws.newJoint.set(q,k);
		if(i<AXIAL_SEGMENTS)return;
		// The joint taper (header): the parent's Jacobian J at the joint (rows = output) and its soft coefficient κ0.
		const J=[0,0,0,0,0,0,0,0,0];let k0=0;
		if(p<AXIAL_SEGMENTS){axialCurves(ws,y,cv);const g=cv[1],fp=cv[6];J[0]=g;J[1]=cv[8]*(fp-g)+cv[7]*(x-cv[2]);J[4]=fp;J[7]=cv[9]*(fp-g)+cv[7]*(z-cv[3]);J[8]=g;k0=Math.max(0,cv[10]-g);}
		else{const kp=p*3,op=p*TAPER_STRIDE,T=ws.taper,ap=Math.hypot(ws.axis[kp],ws.axis[kp+1],ws.axis[kp+2]),a=[ws.axis[kp]/ap,ws.axis[kp+1]/ap,ws.axis[kp+2]/ap],u=[T[op+6],T[op+7],T[op+8]],v=[a[1]*u[2]-a[2]*u[1],a[2]*u[0]-a[0]*u[2],a[0]*u[1]-a[1]*u[0]];
			const L=limbAt(ws,p,(x-ws.restJoint[kp])*a[0]+(y-ws.restJoint[kp+1])*a[1]+(z-ws.restJoint[kp+2])*a[2]);for(let r=0;r<3;r++)for(let c=0;c<3;c++)J[r*3+c]=L[1]*a[r]*a[c]+L[2]*u[r]*u[c]+L[3]*v[r]*v[c];k0=L[6];}
		const al0=Math.hypot(ws.axis[k],ws.axis[k+1],ws.axis[k+2]),a=[ws.axis[k]/al0,ws.axis[k+1]/al0,ws.axis[k+2]/al0],Ja=[0,1,2].map(r=>J[r*3]*a[0]+J[r*3+1]*a[1]+J[r*3+2]*a[2]),aJ=[0,1,2].map(c=>J[c]*a[0]+J[3+c]*a[1]+J[6+c]*a[2]),aJa=Ja[0]*a[0]+Ja[1]*a[1]+Ja[2]*a[2],F0=Math.hypot(Ja[0],Ja[1],Ja[2]),bet=aJ.map((v,c)=>v-aJa*a[c]);
		// The plane ⟂ a: e1, e2 = a × e1; M = e_jᵀ sym(J) e_k; its eigenvalues λu ≥ λv and eigenvector u.
		const m=Math.abs(a[0])<0.6?[1,0,0]:[0,0,1],d=m[0]*a[0]+m[1]*a[1]+m[2]*a[2],e1r=[m[0]-d*a[0],m[1]-d*a[1],m[2]-d*a[2]],e1l=Math.hypot(e1r[0],e1r[1],e1r[2]),e1=e1r.map(c=>c/e1l),e2=[a[1]*e1[2]-a[2]*e1[1],a[2]*e1[0]-a[0]*e1[2],a[0]*e1[1]-a[1]*e1[0]];
		const sym=(e:number[],f:number[])=>{let r=0;for(let i2=0;i2<3;i2++)for(let c=0;c<3;c++)r+=e[i2]*0.5*(J[i2*3+c]+J[c*3+i2])*f[c];return r;},m11=sym(e1,e1),m12=sym(e1,e2),m22=sym(e2,e2);
		const mid=(m11+m22)/2,rad=Math.hypot((m11-m22)/2,m12),th=0.5*Math.atan2(2*m12,m11-m22),u=[0,1,2].map(c=>Math.cos(th)*e1[c]+Math.sin(th)*e2[c]);
		const [t0,t1]=taperOf(s.id),len=s.length,le=F0+(ws.alongScale[i]-F0)*len/(len-(t0+t1)/2);
		if(!(mid-rad>0)||!(le>0))throw new Error(`joint taper of ${s.id}: λ ${mid-rad}, ℓe ${le} not positive`);
		ws.taper.set([F0,mid+rad,mid-rad,k0,t0,t1,u[0],u[1],u[2],le,...bet],i*TAPER_STRIDE);
	});
	let lo=Infinity;
	for(const id of ['lFoot','rFoot'] as const){
		const i=SEGMENTS.indexOf(id),k=i*3,len=segs[i].length,J=ws.restJoint,A=ws.axis;
		for(const [x,z] of [[J[k],J[k+2]],[J[k]+A[k]*len,J[k+2]+A[k+2]*len]]){segPoint(ws,i,x,0,z,q);lo=Math.min(lo,q[1]);}
	}
	ws.ground=-lo;return ws;
}

/** Warp one rest-space point with blend weights (segA with weight wA, segB with 1-wA). `soft` parts with a bone distance `dBone` (metres) get the soft-girth inflation. Writes and returns `out` (which may be `p`). */
export function warpPoint(ws:WarpState,p:Vec3,segA:number,segB:number,wA:number,soft:boolean,out:Vec3,dBone=0):Vec3{
	const x=p[0],y=p[1],z=p[2];let ix=0,iy=0,iz=0;
	if(soft&&dBone>0){
		// Limbs inflate radially from their axis by κ(t)·min(1, dBone/ρ) (κ = S(γs − γb) past the joint taper). Axial segments inflate radially from the remap's rest centre curve, (x − c0_x, 0, z − c0_z), by S·max(0, gs − g)(y): one field for trunk, neck and head, independent of their weights.
		// Never a deflation there: a lean date (γs < γb) would pull the abdominal wall, which sits far from bone, through the viscera, which are not soft tissue and do not move (Task 14c controller note: descending colon × external oblique 2.7 mm at 10–18 y).
		const add=(i:number,w:number)=>{if(i<AXIAL_SEGMENTS){axialCurves(ws,y,cv);const rx=x-cv[2],rz=z-cv[3],m=w*Math.max(0,cv[10]-cv[1])*Math.min(1,dBone/Math.max(Math.sqrt(rx*rx+rz*rz),1e-9));ix+=m*rx;iz+=m*rz;return;}const k=i*3,ax=ws.axis[k],ay=ws.axis[k+1],az=ws.axis[k+2],dx=x-ws.restJoint[k],dy=y-ws.restJoint[k+1],dz=z-ws.restJoint[k+2],t=dx*ax+dy*ay+dz*az,rx=dx-t*ax,ry=dy-t*ay,rz=dz-t*az,m=w*limbAt(ws,i,t)[6]*Math.min(1,dBone/Math.max(Math.sqrt(rx*rx+ry*ry+rz*rz),1e-9));ix+=m*rx;iy+=m*ry;iz+=m*rz;};
		add(segA,wA);if(wA<1)add(segB,1-wA);
	}
	if(segA<AXIAL_SEGMENTS)axialPoint(ws,x,y,z,out);else segPoint(ws,segA,x,y,z,out);
	if(wA<1){const ax=out[0],ay=out[1],az=out[2];if(segB<AXIAL_SEGMENTS)axialPoint(ws,x,y,z,out);else segPoint(ws,segB,x,y,z,out);out[0]=wA*ax+(1-wA)*out[0];out[1]=wA*ay+(1-wA)*out[1];out[2]=wA*az+(1-wA)*out[2];}
	out[0]+=ix;out[1]+=iy+ws.ground;out[2]+=iz;return out;
}

/** Warp one rest-space normal at rest point `p` the same way (inverse-transpose of each segment's map: the remap's at p for trunk / neck / head, the tapered bone-girth map for a limb; blended, normalized). Writes and returns `out` (which may be `n`, not `p`). */
export function warpNormal(ws:WarpState,p:Vec3,n:Vec3,segA:number,segB:number,wA:number,out:Vec3):Vec3{
	const x=n[0],y=n[1],z=n[2],m=[0,0,0];let rx=0,ry=0,rz=0;
	const add=(i:number,w:number)=>{if(i<AXIAL_SEGMENTS){axialNormal(ws,p[0],p[1],p[2],x,y,z,m);rx+=w*m[0];ry+=w*m[1];rz+=w*m[2];return;}
		const k=i*3,o=i*TAPER_STRIDE,T=ws.taper,a=[ws.axis[k],ws.axis[k+1],ws.axis[k+2]],u=[T[o+6],T[o+7],T[o+8]],v=[a[1]*u[2]-a[2]*u[1],a[2]*u[0]-a[0]*u[2],a[0]*u[1]-a[1]*u[0]],d=[p[0]-ws.restJoint[k],p[1]-ws.restJoint[k+1],p[2]-ws.restJoint[k+2]];
		const t=d[0]*a[0]+d[1]*a[1]+d[2]*a[2],r=[d[0]-t*a[0],d[1]-t*a[1],d[2]-t*a[2]],L=limbAt(ws,i,t),ru=r[0]*u[0]+r[1]*u[1]+r[2]*u[2],rv=r[0]*v[0]+r[1]*v[1]+r[2]*v[2],q=1-L[8],hp=L[9],b=[T[o+10],T[o+11],T[o+12]],br=b[0]*r[0]+b[1]*r[1]+b[2]*r[2];
		// J = F′ a aᵀ + λv (I − a aᵀ) + (λu − λv) u uᵀ + (λu′(u·r) u + λv′(v·r) v) aᵀ + (1 − h) a βᵀ − h′(β·r) a aᵀ (row R0, column C); the normal is J⁻ᵀ n = cof(J) n / det J.
		const J=[0,0,0,0,0,0,0,0,0];for(let R0=0;R0<3;R0++)for(let C=0;C<3;C++)J[R0*3+C]=(L[1]-hp*br)*a[R0]*a[C]+L[3]*((R0===C?1:0)-a[R0]*a[C])+(L[2]-L[3])*u[R0]*u[C]+(L[4]*ru*u[R0]+L[5]*rv*v[R0])*a[C]+q*a[R0]*b[C];
		const c0=J[4]*J[8]-J[5]*J[7],c1=J[5]*J[6]-J[3]*J[8],c2=J[3]*J[7]-J[4]*J[6],c3=J[2]*J[7]-J[1]*J[8],c4=J[0]*J[8]-J[2]*J[6],c5=J[1]*J[6]-J[0]*J[7],c6=J[1]*J[5]-J[2]*J[4],c7=J[2]*J[3]-J[0]*J[5],c8=J[0]*J[4]-J[1]*J[3],id=1/(J[0]*c0+J[1]*c1+J[2]*c2);
		rx+=w*id*(c0*x+c1*y+c2*z);ry+=w*id*(c3*x+c4*y+c5*z);rz+=w*id*(c6*x+c7*y+c8*z);};
	add(segA,wA);if(wA<1)add(segB,1-wA);
	const il=1/Math.sqrt(Math.max(rx*rx+ry*ry+rz*rz,1e-20));out[0]=rx*il;out[1]=ry*il;out[2]=rz*il;return out;
}
