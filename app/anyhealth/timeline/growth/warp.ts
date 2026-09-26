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
 *   The normal of R is its inverse transpose (times S): (n_x/g, (n_y − (A n_x + B n_z)/g)/f′, n_z/g)·S, A = ∂x′/∂y = c0_x′(f′ − g) + g′(x − c0_x), B the same in z.
 *
 * Segment i (SEGMENTS order): rest joint J_i, unit axis a_i, global scale S = body.scale, along factor ℓ_i = body.length, bone perpendicular factor γb_i = body.boneGirth, soft factor γs_i = body.softGirth.
 *   T_i(p) = N_i + S·(ℓ_i (d·a_i) a_i + γb_i (d − (d·a_i) a_i)),  d = p − J_i: ONE map (bone girth) for every vertex, so parent and child agree at their joint for soft tissue too (Task 14a).
 *   On a thigh S·γb_i is replaced by girth(t), t = d·a_i, which runs from the remap's g at the joint to S·γb_i over ROOT_TAPER (Task 14c: the femoral head grows with its socket).
 *   N_trunk = S·J_trunk (scale about the origin); N_i = T_parent(J_i), so every child stays attached at its joint.
 *   p' = wA·T_segA(p) + (1 − wA)·T_segB(p) + soft · Σ_{i∈{A,B}} w_i · S(γs_i − γb_i) · min(1, dBone/ρ_i) · r_i(p), then p'.y += ground.
 *     The soft-tissue girth is a post-warp inflation: r_i = d − (d·a_i) a_i is the point's rest offset from segment i's axis (ρ_i = |r_i|; the bone-girth map keeps its direction), and dBone is its rest distance to the nearest bone
 *     (segments.bin bytes 2-3; 0 for bone). So tissue dBone from the bone ends S·γs·dBone from it instead of S·γb·dBone, and near the axis (ρ < dBone) it is the plain soft-girth scaling. It vanishes at the bones, so parent and child agree at their joint.
 *     The direction is radial, not the vertex normal: a normal offset folds thin sheets (Task 14a report: 17,836 flipped triangles on the hand-built child, 51,202 on the infant). `soft` = the part is muscular / integumentary / connective.
 *   ground = −(lowest warped sole point): the four points under each ankle and each toe tip on the rest floor (y = 0), warped by their foot segment.
 *   Normal: n' = normalize(wA·M_A n + (1 − wA)·M_B n), M_i = the inverse transpose of segment i's map at p ((1/(S·ℓ_i)) a aᵀ + (1/(S·γb_i))(I − a aᵀ) away from a limb root's taper, see rootGirth). */
import {SEGMENTS,type Body,type Rig,type SegmentId,type Vec3} from '../types';

/** segments.bin: per atlas part in order, vertexCount × SEG_STRIDE bytes: byte0 = segA | segB<<4, byte1 = round(weightA·255), bytes 2-3 = round(dBone / D_UNIT) (uint16, little-endian): the rest distance to the nearest bone (0 for bone, capped at 65535 units = 13.1 cm).
 * 16 bits because 0.5 mm steps of dBone alone flip hundreds of thin-sheet triangles (Task 14a report). The engine hands these 4 bytes to the shader unchanged. */
export const SEG_STRIDE=4,D_UNIT=2e-6;
/** Decode vertex v of a segments.bin slice starting at byte `o`: [segA, segB, weightA 0..1, dBone metres]. */
export const segAt=(b:ArrayLike<number>,o:number,v:number):[number,number,number,number]=>{const k=o+v*SEG_STRIDE;return [b[k]&15,b[k]>>4,b[k+1]/255,(b[k+2]|b[k+3]<<8)*D_UNIT];};

export interface WarpState {/** per segment, index = SEGMENTS order */ restJoint:Float32Array;axis:Float32Array;newJoint:Float32Array;/** S·ℓ_i */ alongScale:Float32Array;/** S·γ_i (bone) */ boneScale:Float32Array;/** S·γ_i (soft) */ softScale:Float32Array;/** y shift to keep the feet on the floor */ ground:number;
	/** Axial remap parameters, AXIAL_VEC4 vec4s (the shader's twX): [Y0, S·Y0, f′0, g0], [c0(Y0).xz, c0′0.xz], [c(Y0).xz, (f′0·c0′0).xz], then per knot i = 1..3: [y_i, w_i, Δf′_i, Δg_i], [Δc0′_i.xz, α_i.xz = f′_left·Δc0′ + c0′_left·Δf′], [β_i.xz = Δf′·Δc0′, girth window centre, half-width]; then [S, gs0, 0, 0] and [Δgs_1..3, 0] (gs = the soft girth, blended like g). */ axial:Float64Array;
	/** Per segment: the axial remap's g at the joint for a tapered limb root (the thighs; the start of its girth taper, ROOT_TAPER), else 0. */ rootGirth:Float64Array}

/** Axial segments (the height remap): SEGMENTS indices below this (trunk, neck, head). */
export const AXIAL_SEGMENTS=3;
/** Rest menton height: the Mandible's lowest rest vertex (check: warp · axial knots). The face interval runs from here to the atlanto-occipital joint. */
export const MENTON_Y=1.4997412;
/** Half-widths (metres) of the f′ / c0′ smoothstep windows at the C7/T1, menton and atlanto-occipital knots. Non-overlapping: w1 + w2 ≤ menton − C7 (4.585 cm), w2 + w3 ≤ AO − menton (5.590 cm), both used in full.
 * The split was swept (Task 14c report); the seam counts barely move with it. */
export const AXIAL_WINDOW:[number,number,number]=[0.03,0.0158,0.04];
/** Girth windows [centre y, half-width] (metres) of the trunk → neck, neck → face and face → cranium steps of g (and of the soft girth gs). Wider than the f′ windows and allowed to overlap (g is blended, not integrated, so any g > 0 keeps det > 0):
 * the lateral scale's shear A = g′·(x − c0_x) acts on tissue up to 11 cm from the spine (the chin), and with the f′ windows it tore up to 725 triangles at birth (Task 14c report). g stays between its neighbours' values where the steps share a sign. */
export const AXIAL_GIRTH_WINDOW:[number,number][]=[[1.43,0.065],[1.51,0.08],[1.60,0.06]];
/** Length of WarpState.axial in vec4s. */
export const AXIAL_VEC4=14;
/** Limb-root girth taper [start, end], rest metres along the segment axis from its joint (rootGirth): past the femoral / humeral head (adult radius ≈ 2.4 cm), done by mid-neck / upper shaft. */
export const ROOT_TAPER:[number,number]=[0.03,0.15];
/** The limb roots that taper: the thighs only. Tapering the upper arms too sheared the pectoralis major at 6–14 y (limb torn 3450 → 3722 at 6 y, Task 14c report); the humeral head × glenoid gap stayed ≤ 0.4 mm without it. */
const TAPERED:SegmentId[]=['lThigh','rThigh'];
const AX9=9/35;

/** T_i(p) without the ground shift, `girth` = the absolute perpendicular scale (S·γb). Writes out[0..2]; p may alias out. */
function segPoint(ws:WarpState,i:number,x:number,y:number,z:number,out:number[]|Vec3){
	const k=i*3,ax=ws.axis[k],ay=ws.axis[k+1],az=ws.axis[k+2],dx=x-ws.restJoint[k],dy=y-ws.restJoint[k+1],dz=z-ws.restJoint[k+2],t=dx*ax+dy*ay+dz*az,al=ws.alongScale[i],girth=rootGirth(ws,i,t)[0];
	out[0]=ws.newJoint[k]+al*t*ax+girth*(dx-t*ax);out[1]=ws.newJoint[k+1]+al*t*ay+girth*(dy-t*ay);out[2]=ws.newJoint[k+2]+al*t*az+girth*(dz-t*az);
}
const rg=[0,0];
/** A limb segment's perpendicular (bone) scale at rest axial distance t from its joint, and its t-derivative: S·γb, except on a tapered limb root (the thighs, TAPERED) where it starts at the axial remap's g at the joint and reaches S·γb over ROOT_TAPER,
 * so the femoral head grows with the acetabulum (Task 14c controller note: hip bone × femur crossed 3.3 mm at 0–3 y with thigh 1.59 vs trunk 1.05 bone girth). det of the map stays S·ℓ·girth² > 0. */
function rootGirth(ws:WarpState,i:number,t:number):number[]{
	const g0=ws.rootGirth[i],g1=ws.boneScale[i];if(!(g0>0)){rg[0]=g1;rg[1]=0;return rg;}
	const w=ROOT_TAPER[1]-ROOT_TAPER[0],u=Math.min(1,Math.max(0,(t-ROOT_TAPER[0])/w));rg[0]=g0+(g1-g0)*u*u*(3-2*u);rg[1]=(g1-g0)*6*u*(1-u)/w;return rg;
}

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
/** The remap's local stretch at rest height y: [f′, g] (absolute, S included), for the seam check's scale bound. */
export function axialRates(ws:WarpState,y:number):[number,number]{axialCurves(ws,y,cv);return [cv[6],cv[1]];}

/** Per-segment warp parameters for one body: absolute scales, new joints (parents first) and the floor shift. */
export function warpState(rig:Rig,body:Body):WarpState{
	const n=SEGMENTS.length,S=body.scale,ws:WarpState={restJoint:new Float32Array(n*3),axis:new Float32Array(n*3),newJoint:new Float32Array(n*3),alongScale:new Float32Array(n),boneScale:new Float32Array(n),softScale:new Float32Array(n),ground:0,axial:new Float64Array(AXIAL_VEC4*4),rootGirth:new Float64Array(n)};
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
		// A child of an axial segment starts where the remap puts its joint (limb roots: upper arms, thighs).
		if(p<AXIAL_SEGMENTS){axialPoint(ws,ws.restJoint[i*3],ws.restJoint[i*3+1],ws.restJoint[i*3+2],q);if(TAPERED.includes(s.id))ws.rootGirth[i]=axialRates(ws,ws.restJoint[i*3+1])[1];}else segPoint(ws,p,ws.restJoint[i*3],ws.restJoint[i*3+1],ws.restJoint[i*3+2],q);ws.newJoint.set(q,i*3);
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
	const g=ws.boneScale,x=p[0],y=p[1],z=p[2];let ix=0,iy=0,iz=0;
	if(soft&&dBone>0){
		// Axial segments inflate radially from the remap's rest centre curve, (x − c0_x, 0, z − c0_z), by S·max(0, gs − g)(y): one field for trunk, neck and head, independent of their weights.
		// Never a deflation there: a lean date (γs < γb) would pull the abdominal wall, which sits far from bone, through the viscera, which are not soft tissue and do not move (Task 14c controller note: descending colon × external oblique 2.7 mm at 10–18 y).
		const add=(i:number,w:number)=>{if(i<AXIAL_SEGMENTS){axialCurves(ws,y,cv);const rx=x-cv[2],rz=z-cv[3],m=w*Math.max(0,cv[10]-cv[1])*Math.min(1,dBone/Math.max(Math.sqrt(rx*rx+rz*rz),1e-9));ix+=m*rx;iz+=m*rz;return;}const k=i*3,ax=ws.axis[k],ay=ws.axis[k+1],az=ws.axis[k+2],dx=x-ws.restJoint[k],dy=y-ws.restJoint[k+1],dz=z-ws.restJoint[k+2],t=dx*ax+dy*ay+dz*az,rx=dx-t*ax,ry=dy-t*ay,rz=dz-t*az,m=w*(ws.softScale[i]-g[i])*Math.min(1,dBone/Math.max(Math.sqrt(rx*rx+ry*ry+rz*rz),1e-9));ix+=m*rx;iy+=m*ry;iz+=m*rz;};
		add(segA,wA);if(wA<1)add(segB,1-wA);
	}
	if(segA<AXIAL_SEGMENTS)axialPoint(ws,x,y,z,out);else segPoint(ws,segA,x,y,z,out);
	if(wA<1){const ax=out[0],ay=out[1],az=out[2];if(segB<AXIAL_SEGMENTS)axialPoint(ws,x,y,z,out);else segPoint(ws,segB,x,y,z,out);out[0]=wA*ax+(1-wA)*out[0];out[1]=wA*ay+(1-wA)*out[1];out[2]=wA*az+(1-wA)*out[2];}
	out[0]+=ix;out[1]+=iy+ws.ground;out[2]+=iz;return out;
}

/** Warp one rest-space normal at rest point `p` the same way (inverse-transpose of each segment's map: the remap's at p for trunk / neck / head, the bone-girth map for a limb; blended, normalized). Writes and returns `out` (which may be `n`, not `p`). */
export function warpNormal(ws:WarpState,p:Vec3,n:Vec3,segA:number,segB:number,wA:number,out:Vec3):Vec3{
	const x=n[0],y=n[1],z=n[2],m=[0,0,0];let rx=0,ry=0,rz=0;
	const add=(i:number,w:number)=>{if(i<AXIAL_SEGMENTS){axialNormal(ws,p[0],p[1],p[2],x,y,z,m);rx+=w*m[0];ry+=w*m[1];rz+=w*m[2];return;}const k=i*3,ax=ws.axis[k],ay=ws.axis[k+1],az=ws.axis[k+2],t=x*ax+y*ay+z*az,dx=p[0]-ws.restJoint[k],dy=p[1]-ws.restJoint[k+1],dz=p[2]-ws.restJoint[k+2],tp=dx*ax+dy*ay+dz*az,[gE,gp]=rootGirth(ws,i,tp),ig=1/gE,
			// J = S·ℓ·a aᵀ + girth·(I − a aᵀ) + girth′·r aᵀ (r = the rest offset from the axis): J⁻ᵀn = n⊥/girth + a·(n·a − girth′·(r·n)/girth)/(S·ℓ).
			rn=(dx-tp*ax)*x+(dy-tp*ay)*y+(dz-tp*az)*z,al=(t-gp*rn*ig)/ws.alongScale[i];rx+=w*(al*ax+ig*(x-t*ax));ry+=w*(al*ay+ig*(y-t*ay));rz+=w*(al*az+ig*(z-t*az));};
	add(segA,wA);if(wA<1)add(segB,1-wA);
	const il=1/Math.sqrt(Math.max(rx*rx+ry*ry+rz*rz,1e-20));out[0]=rx*il;out[1]=ry*il;out[2]=rz*il;return out;
}
