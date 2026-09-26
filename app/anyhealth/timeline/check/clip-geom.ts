/** Geometry helpers for the clipping checks (node only): convex hulls as half-planes, and a triangle mesh bucketed in a 1 cm grid for inside tests (ray votes far from the surface, the nearest triangle's pseudo-normal sign near it) and nearest-surface distance. No BVH, no new dependency. */
import * as T from 'three';
import {ConvexHull} from 'three/examples/jsm/math/ConvexHull.js';

/** A convex hull as half-planes n·p ≤ c. */
export interface Hull {
	/** Signed distance to the hull, metres: > 0 outside (the largest face-plane distance), ≤ 0 inside. */
	dist(x:number,y:number,z:number):number;
	/** Outward normal of the face plane that gives dist() (the side a point leaves through). */
	exitNormal(x:number,y:number,z:number):[number,number,number];
	faces:number;
}
/** The convex hull of flat xyz points (every `stride`-th point). */
export function hullOf(points:ArrayLike<number>,stride=1):Hull{
	const v:T.Vector3[]=[];for(let k=0;k<points.length;k+=3*stride)v.push(new T.Vector3(points[k],points[k+1],points[k+2]));
	const h=new ConvexHull().setFromPoints(v),nf=h.faces.length,P=new Float64Array(nf*4);
	h.faces.forEach((f,i)=>{P[i*4]=f.normal.x;P[i*4+1]=f.normal.y;P[i*4+2]=f.normal.z;P[i*4+3]=f.constant;});
	const arg=(x:number,y:number,z:number)=>{let d=-Infinity,f=0;for(let i=0;i<nf*4;i+=4){const s=P[i]*x+P[i+1]*y+P[i+2]*z-P[i+3];if(s>d){d=s;f=i;}}return [d,f];};
	return {faces:nf,dist:(x,y,z)=>arg(x,y,z)[0],exitNormal(x,y,z){const f=arg(x,y,z)[1];return [P[f],P[f+1],P[f+2]];}};
}

/** The closest point found by the last triDist2 call. */
const CQ=new Float64Array(3);
/** Squared distance from p to triangle abc (Ericson, Real-Time Collision Detection 5.1.5); the closest point goes to CQ. */
function triDist2(px:number,py:number,pz:number,A:ArrayLike<number>,a:number,b:number,c:number){
	const ax=A[a*3],ay=A[a*3+1],az=A[a*3+2],abx=A[b*3]-ax,aby=A[b*3+1]-ay,abz=A[b*3+2]-az,acx=A[c*3]-ax,acy=A[c*3+1]-ay,acz=A[c*3+2]-az,apx=px-ax,apy=py-ay,apz=pz-az;
	const d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;let qx:number,qy:number,qz:number;
	const set=(v:number,w:number)=>{qx=ax+abx*v+acx*w;qy=ay+aby*v+acy*w;qz=az+abz*v+acz*w;};
	if(d1<=0&&d2<=0)set(0,0);
	else{
		const bpx=px-A[b*3],bpy=py-A[b*3+1],bpz=pz-A[b*3+2],d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
		if(d3>=0&&d4<=d3)set(1,0);
		else{
			const vc=d1*d4-d3*d2;
			if(vc<=0&&d1>=0&&d3<=0)set(d1/(d1-d3),0);
			else{
				const cpx=px-A[c*3],cpy=py-A[c*3+1],cpz=pz-A[c*3+2],d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
				if(d6>=0&&d5<=d6)set(0,1);
				else{
					const vb=d5*d2-d1*d6;
					if(vb<=0&&d2>=0&&d6<=0)set(0,d2/(d2-d6));
					else{const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));qx=A[b*3]+(A[c*3]-A[b*3])*w;qy=A[b*3+1]+(A[c*3+1]-A[b*3+1])*w;qz=A[b*3+2]+(A[c*3+2]-A[b*3+2])*w;}else{const den=1/(va+vb+vc);set(vb*den,vc*den);}}
				}
			}
		}
	}
	CQ[0]=qx!;CQ[1]=qy!;CQ[2]=qz!;return (px-qx!)**2+(py-qy!)**2+(pz-qz!)**2;
}

/** Within this distance of a surface, a split ray vote defers to the nearest-triangle sign. */
const NEAR_SIGN=0.003;
/** Compressed buckets: cell → triangle ids. */
interface Buckets {start:Int32Array;items:Int32Array}
function bucket(nCells:number,nTri:number,cells:(t:number,visit:(cell:number)=>void)=>void):Buckets{
	const count=new Int32Array(nCells+1);for(let t=0;t<nTri;t++)cells(t,c=>{count[c+1]++;});
	for(let i=0;i<nCells;i++)count[i+1]+=count[i];const fill=count.slice(0,nCells),items=new Int32Array(count[nCells]);
	for(let t=0;t<nTri;t++)cells(t,c=>{items[fill[c]++]=t;});return {start:count,items};
}

/** A triangle mesh in a `cell`-sized grid: ray crossing counts along ±x / ±z (2D columns) and nearest-surface distance (3D buckets). */
export class TriGrid {
	readonly lo:[number,number,number];readonly n:[number,number,number];
	private colX:Buckets;private colZ:Buckets;private vox:Buckets;
	/** Shell meshes: 1 for triangles of the outer surface (their normal faces away from the body), 0 for the inner one. */
	outer:Uint8Array|null=null;
	readonly shell:boolean;private parityOnly:boolean;private flip=1;
	/** Options: `shell`, the mesh is a closed shell with thickness (two surfaces), as the atlas Skin; `outer`, the shell's triangle classes from classifyShell() on the rest mesh (same topology; computed here when omitted);
	 * `parityOnly`, an open surface (a tube such as the fracture callus): inside by the ray votes alone. A plain closed surface is signed by its winding, flipped when its signed volume is negative. */
	constructor(readonly pos:ArrayLike<number>,readonly index:ArrayLike<number>,readonly cell=0.01,opts:{shell?:boolean;outer?:Uint8Array;parityOnly?:boolean}={}){
		this.shell=!!opts.shell;this.parityOnly=!!opts.parityOnly;
		const lo:[number,number,number]=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
		for(let k=0;k<pos.length;k+=3)for(let j=0;j<3;j++){const v=pos[k+j];if(v<lo[j])lo[j]=v;if(v>hi[j])hi[j]=v;}
		for(let j=0;j<3;j++)lo[j]-=cell;this.lo=lo;const n=[0,1,2].map(j=>Math.max(1,Math.ceil((hi[j]-lo[j])/cell)+2)) as [number,number,number];this.n=n;
		const nt=index.length/3,I=index,P=pos,ci=(v:number,j:number)=>Math.min(n[j]-1,Math.max(0,Math.floor((v-lo[j])/cell)));
		const box=(t:number,j:number):[number,number]=>{const a=P[I[t*3]*3+j],b=P[I[t*3+1]*3+j],c=P[I[t*3+2]*3+j];return [ci(Math.min(a,b,c),j),ci(Math.max(a,b,c),j)];};
		this.colX=bucket(n[1]*n[2],nt,(t,visit)=>{const [y0,y1]=box(t,1),[z0,z1]=box(t,2);for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)visit(y*n[2]+z);});
		this.colZ=bucket(n[0]*n[1],nt,(t,visit)=>{const [x0,x1]=box(t,0),[y0,y1]=box(t,1);for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)visit(x*n[1]+y);});
		this.vox=bucket(n[0]*n[1]*n[2],nt,(t,visit)=>{const [x0,x1]=box(t,0),[y0,y1]=box(t,1),[z0,z1]=box(t,2);for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)visit((x*n[1]+y)*n[2]+z);});
		if(this.shell)this.outer=opts.outer??this.classifyShell();
		else if(!this.parityOnly){let v=0;for(let t=0;t<nt;t++){const a=I[t*3]*3,b=I[t*3+1]*3,c=I[t*3+2]*3;v+=P[a]*(P[b+1]*P[c+2]-P[b+2]*P[c+1])-P[a+1]*(P[b]*P[c+2]-P[b+2]*P[c])+P[a+2]*(P[b]*P[c+1]-P[b+1]*P[c]);}if(v<0)this.flip=-1;}
	}
	/** Unit face normal of triangle t from its winding. */
	private faceN(t:number):[number,number,number]{
		const P=this.pos,a=this.index[t*3]*3,b=this.index[t*3+1]*3,c=this.index[t*3+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];
		const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];
	}
	/** Shell triangles: inner (0) when the point 1 mm along the normal from the centroid is inside the body by the ray vote (both ±z rays, or 3 of 4, shell counting), else outer (1); then 8 rounds of a majority filter over
	 * edge neighbours (welded by position), since single votes misfire where rays graze the lids, nostrils and the eye pocket, and a lone misclassified triangle flips the sign test for every point near it. */
	classifyShell():Uint8Array{
		const nt=this.index.length/3,o=new Uint8Array(nt),P=this.pos,I=this.index;
		for(let t=0;t<nt;t++){const n=this.faceN(t),c=[0,1,2].map(j=>(P[I[t*3]*3+j]+P[I[t*3+1]*3+j]+P[I[t*3+2]*3+j])/3+n[j]*0.001),v=this.votes(c[0],c[1],c[2]);o[t]=(v[2]&&v[3])||v[0]+v[1]+v[2]+v[3]>=3?0:1;}
		const id=new Map<string,number>(),w=(v:number)=>{const k=`${P[v*3]},${P[v*3+1]},${P[v*3+2]}`;let x=id.get(k);if(x===undefined){x=id.size;id.set(k,x);}return x;},edge=new Map<number,number[]>(),nb:number[][]=Array.from({length:nt},()=>[]);
		for(let t=0;t<nt;t++){const a=[w(I[t*3]),w(I[t*3+1]),w(I[t*3+2])];for(let k=0;k<3;k++){const u=a[k],v=a[(k+1)%3],key=u<v?u*4194304+v:v*4194304+u,l=edge.get(key);if(l){for(const x of l){nb[x].push(t);nb[t].push(x);}l.push(t);}else edge.set(key,[t]);}}
		for(let r=0;r<8;r++){const next=o.slice();for(let t=0;t<nt;t++){let s=o[t];for(const x of nb[t])s+=o[x];next[t]=2*s>nb[t].length+1?1:2*s<nb[t].length+1?0:o[t];}o.set(next);}
		return o;
	}
	private ci(v:number,j:number){return Math.floor((v-this.lo[j])/this.cell);}
	/** Crossings of the axis-aligned lines through p along `axis` (0 = x, 2 = z): [count on the + side, count on the − side]. */
	private crossings(px:number,py:number,pz:number,axis:0|2):[number,number]{
		// Axis u is the ray, (v, w) the projection plane.
		const [u,v,w]=axis===0?[0,1,2]:[2,0,1],p=[px,py,pz],pv=p[v]+1.3e-7,pw=p[w]+0.7e-7,pu=p[u];
		const iv=this.ci(pv,v),iw=this.ci(pw,w),n=this.n;if(iv<0||iw<0||iv>=n[v]||iw>=n[w])return [0,0];
		const B=axis===0?this.colX:this.colZ,cell=axis===0?iv*n[2]+iw:iv*n[1]+iw,P=this.pos,I=this.index;let plus=0,minus=0;
		for(let k=B.start[cell];k<B.start[cell+1];k++){
			const t=B.items[k],a=I[t*3]*3,b=I[t*3+1]*3,c=I[t*3+2]*3;
			const av=P[a+v]-pv,aw=P[a+w]-pw,bv=P[b+v]-pv,bw=P[b+w]-pw,cv=P[c+v]-pv,cw=P[c+w]-pw;
			const e0=bv*cw-bw*cv,e1=cv*aw-cw*av,e2=av*bw-aw*bv;
			if(!((e0>0&&e1>0&&e2>0)||(e0<0&&e1<0&&e2<0)))continue;
			const s=e0+e1+e2,hit=(e0*P[a+u]+e1*P[b+u]+e2*P[c+u])/s;if(hit>pu)plus++;else minus++;
		}
		return [plus,minus];
	}
	/** Inside votes of the rays [+x, −x, +z, −z] (1 = inside). A plain closed surface votes inside on an odd count. The atlas Skin is a closed shell about 2.5 mm thick (an outer and an inner surface, no boundary edges),
	 * so each pass through it is 2 crossings: a ray from inside the body crosses 2 (+ 4k), from outside 0 (+ 4k), and from within the shell 1 or 3; with `shell` a ray votes inside when its count is not a multiple of 4. */
	votes(x:number,y:number,z:number):[number,number,number,number]{const [a,b]=this.crossings(x,y,z,0),[c,d]=this.crossings(x,y,z,2),v=(k:number)=>this.shell?+(k%4!==0):k&1;return [v(a),v(b),v(c),v(d)];}
	/** Inside test. When all four rays agree, the ray vote decides. When they split (a ray grazed a surface near the point, or crossed two touching shells: a hand on the thigh, an arm on the flank, the lids over the eye):
	 * within NEAR_SIGN of the surface, or on a 2–2 tie, the sign against the nearest triangle's pseudo-normal decides (signedInside); farther out, the 3-of-4 majority (a far nearest triangle may belong to another sheet). */
	inside(x:number,y:number,z:number):boolean{const v=this.votes(x,y,z),s=v[0]+v[1]+v[2]+v[3];if(this.parityOnly)return s>=3||!!(v[2]&&v[3]);if(s===0||s===4)return s===4;if(s!==2&&!this.near(x,y,z,NEAR_SIGN))return s>=3;return this.signedInside(x,y,z);}
	/** Inside by the nearest surface: s = (p − q)·n with q the closest point and n its angle-weighted pseudo-normal (so edges and vertices are signed right).
	 * Plain surface: inside when s ≤ 0. Shell: outside only when the nearest triangle is on the outer surface and s > 0 (s > 0 on the inner surface is the body cavity; s ≤ 0 is within the shell). Beyond 5 cm: the ray vote (both ±z rays, or 3 of 4: the ±x rays of a trunk point cross the arms, whose shell touches the flank's). */
	signedInside(x:number,y:number,z:number):boolean{
		const h=this.nearestHit(x,y,z,0.05);if(!h){const v=this.votes(x,y,z);return !!(v[2]&&v[3])||v[0]+v[1]+v[2]+v[3]>=3;}
		const s=(x-h.q[0])*h.n[0]+(y-h.q[1])*h.n[1]+(z-h.q[2])*h.n[2];return this.outer?!(this.outer[h.t]&&s>0):s*this.flip<=0;
	}
	/** Whether some triangle lies within `r` of p (stops at the first). */
	near(x:number,y:number,z:number,r:number):boolean{
		const n=this.n,r2=r*r,lo=[x-r,y-r,z-r].map((v,j)=>Math.max(0,this.ci(v,j))),hi=[x+r,y+r,z+r].map((v,j)=>Math.min(n[j]-1,this.ci(v,j)));
		for(let i=lo[0];i<=hi[0];i++)for(let j=lo[1];j<=hi[1];j++)for(let k=lo[2];k<=hi[2];k++){const cell=(i*n[1]+j)*n[2]+k;for(let q=this.vox.start[cell];q<this.vox.start[cell+1];q++){const t=this.vox.items[q];if(triDist2(x,y,z,this.pos,this.index[t*3],this.index[t*3+1],this.index[t*3+2])<r2)return true;}}
		return false;
	}
	/** The nearest triangle within `maxR`: its id, distance, closest point and pseudo-normal (the unit normals of every triangle within 1e-6 m of the nearest distance, weighted by the corner angle at q when q is a vertex, summed and normalized), or null. */
	nearestHit(x:number,y:number,z:number,maxR=0.05):{t:number;d:number;q:[number,number,number];n:[number,number,number]}|null{
		const n=this.n,c=[this.ci(x,0),this.ci(y,1),this.ci(z,2)],R=Math.ceil(maxR/this.cell),EPS=1e-6;let best=maxR,bt=-1;const q:[number,number,number]=[0,0,0],seen=new Set<number>(),ties:number[]=[];
		for(let r=0;r<=R;r++){
			if(r>0&&(r-1)*this.cell>best+EPS)break;
			for(let i=c[0]-r;i<=c[0]+r;i++)for(let j=c[1]-r;j<=c[1]+r;j++)for(let k=c[2]-r;k<=c[2]+r;k++){
				if(Math.max(Math.abs(i-c[0]),Math.abs(j-c[1]),Math.abs(k-c[2]))!==r)continue;if(i<0||j<0||k<0||i>=n[0]||j>=n[1]||k>=n[2])continue;
				const cell=(i*n[1]+j)*n[2]+k;for(let p=this.vox.start[cell];p<this.vox.start[cell+1];p++){const t=this.vox.items[p];if(seen.has(t))continue;seen.add(t);
					const d=Math.sqrt(triDist2(x,y,z,this.pos,this.index[t*3],this.index[t*3+1],this.index[t*3+2]));
					if(d>=best+EPS)continue;if(bt<0||d<best-EPS)ties.length=0;ties.push(t);if(bt<0||d<best){best=d;bt=t;q[0]=CQ[0];q[1]=CQ[1];q[2]=CQ[2];}}
			}
		}
		if(bt<0)return null;const m:[number,number,number]=[0,0,0];for(const t of ties){const f=this.faceN(t),w=this.cornerAngle(t,q);m[0]+=f[0]*w;m[1]+=f[1]*w;m[2]+=f[2]*w;}const l=Math.hypot(...m)||1;
		return {t:bt,d:best,q,n:[m[0]/l,m[1]/l,m[2]/l]};
	}
	/** Angle-weighted pseudo-normal weight (Bærentzen & Aanæs 2005): the interior angle of triangle t at the corner that coincides with q, or 1 when q is not a corner (inside a face or on an edge). */
	private cornerAngle(t:number,q:[number,number,number]):number{
		const P=this.pos,v=[this.index[t*3]*3,this.index[t*3+1]*3,this.index[t*3+2]*3];
		for(let k=0;k<3;k++){const a=v[k];if(Math.hypot(P[a]-q[0],P[a+1]-q[1],P[a+2]-q[2])>1e-9)continue;const b=v[(k+1)%3],c=v[(k+2)%3],ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],wx=P[c]-P[a],wy=P[c+1]-P[a+1],wz=P[c+2]-P[a+2];
			return Math.acos(Math.max(-1,Math.min(1,(ux*wx+uy*wy+uz*wz)/((Math.hypot(ux,uy,uz)*Math.hypot(wx,wy,wz))||1))));}
		return 1;
	}
	/** Generalized winding number (Jacobson et al. 2013: the summed signed solid angles of the triangles / 4π, Van Oosterom–Strackee) of the outer surface (a shell: its outer-class triangles only; a plain mesh: every triangle, signed by its
	 * volume): ≈ 1 inside, ≈ 0 outside, and it degrades gracefully at holes and where two sheets touch, unlike ray parity. Brute force over every triangle (the Skin has 44,744), so it only confirms the few points a fast test flags. */
	winding(x:number,y:number,z:number):number{
		const P=this.pos,I=this.index,nt=I.length/3;let w=0;
		for(let t=0;t<nt;t++){if(this.outer&&!this.outer[t])continue;const a=I[t*3]*3,b=I[t*3+1]*3,c=I[t*3+2]*3;
			const ax=P[a]-x,ay=P[a+1]-y,az=P[a+2]-z,bx=P[b]-x,by=P[b+1]-y,bz=P[b+2]-z,cx=P[c]-x,cy=P[c+1]-y,cz=P[c+2]-z,la=Math.hypot(ax,ay,az),lb=Math.hypot(bx,by,bz),lc=Math.hypot(cx,cy,cz);
			const det=ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx),den=la*lb*lc+(ax*bx+ay*by+az*bz)*lc+(bx*cx+by*cy+bz*cz)*la+(cx*ax+cy*ay+cz*az)*lb;w+=2*Math.atan2(det,den);}
		return w/(4*Math.PI)*(this.outer?1:this.flip);
	}
	/** Distance to the nearest triangle, searching out to `maxR` metres (returns maxR when none is nearer). */
	nearest(x:number,y:number,z:number,maxR=0.05):number{return this.nearestHit(x,y,z,maxR)?.d??maxR;}
}

/** Least-squares affine map rest → warped over paired points (flat xyz): returns f(p) mapping a rest point. */
export function affineFit(rest:ArrayLike<number>,warped:ArrayLike<number>):(p:[number,number,number])=>[number,number,number]{
	const n=rest.length/3,r0=[0,0,0],w0=[0,0,0];for(let i=0;i<n;i++)for(let j=0;j<3;j++){r0[j]+=rest[i*3+j]/n;w0[j]+=warped[i*3+j]/n;}
	const RR=new T.Matrix3().set(0,0,0,0,0,0,0,0,0),WR=new T.Matrix3().set(0,0,0,0,0,0,0,0,0),a=RR.elements,b=WR.elements;
	for(let i=0;i<n;i++)for(let r=0;r<3;r++)for(let c=0;c<3;c++){const rc=rest[i*3+c]-r0[c];a[c*3+r]+=(rest[i*3+r]-r0[r])*rc;b[c*3+r]+=(warped[i*3+r]-w0[r])*rc;}
	const M=WR.multiply(RR.invert());
	return p=>{const v=new T.Vector3(p[0]-r0[0],p[1]-r0[1],p[2]-r0[2]).applyMatrix3(M);return [v.x+w0[0],v.y+w0[1],v.z+w0[2]];};
}
