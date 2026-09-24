/** The 2009 left humerus fracture drawn on the 3D atlas (see model.ts for the healing timeline).
 *  Built once from the humerus's own decoded geometry: the mesh is refined around the break, cut into a
 *  proximal (head) and distal (shaft) fragment along a jagged transverse surface, and each open end is
 *  capped with a cortex + marrow cross-section. A lumpy callus cuff and a soft clot sit over the break.
 *  While fractureAt(date) is non-null the original part is hidden through the part-state texture. */
import * as T from 'three';
import {SYSTEMS,type Atlas} from '../atlas/anatomy';
import {BREAK_MS,CALLUS_BULGE,CALLUS_HALF_LENGTH,FRACTURE_DATE,FRACTURE_LEVEL,FRACTURE_PART,breakKick,fractureAt} from './model';

export interface FractureUpdate {changed:boolean;animating:boolean;fly:boolean}
export interface FractureHandle {
	/** Applies the fracture for a timeline date. `now` is performance.now(). `fly` is true once when the
	 *  date crosses the fracture moving forward (with the skeleton showing): the scene frames `box`. */
	update(date:string,skeletal:boolean,now:number):FractureUpdate;
	/** The left upper arm, for the camera. */
	box:T.Box3;
	dispose():void;
}
interface Options {scene:T.Scene;atlas:Atlas;pickers:(T.Mesh|undefined)[];data:Float32Array;partTexture:T.DataTexture}

const BONE=SYSTEMS.find(s=>s.id==='skeletal')?.mesh??'#e2d9ba',CARTILAGE='#abcddb',WOVEN='#cbb98d';
/** Mesh refinement around the break: edge length in the break zone and over the rest of the callus. */
const FINE=.0012,COARSE=.0024,NEAR=.0075,BAND=CALLUS_HALF_LENGTH+.004;
/** Snap waits for the camera flight so the break is seen happening. */
const SNAP_DELAY=380;
const clamp01=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(a:number,b:number,x:number)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
const random=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const ISO=/^\d{4}-\d{2}-\d{2}$/;

export function createFracture({scene,atlas,pickers,data,partTexture}:Options):FractureHandle|null{
	const part=atlas.parts.findIndex(p=>p.name===FRACTURE_PART&&p.system==='skeletal'),source=pickers[part]?.geometry;
	if(part<0||!source?.index)return null;
	const srcPos=source.getAttribute('position').array as Float32Array,srcNrm=source.getAttribute('normal').array as Int8Array,srcIndex=source.index.array as Uint32Array;

	// Weld by position (the part has duplicate vertices along normal seams) so the topology is one closed surface.
	// Render vertices keep their own normals; `rw` maps each to its welded vertex.
	const wp:number[]=[],rp:number[]=[],rn:number[]=[],rw:number[]=[],weld=new Map<string,number>();
	for(let v=0;v<srcPos.length/3;v++){
		const k=`${srcPos[v*3]},${srcPos[v*3+1]},${srcPos[v*3+2]}`;let w=weld.get(k);
		if(w===undefined){w=wp.length/3;weld.set(k,w);wp.push(srcPos[v*3],srcPos[v*3+1],srcPos[v*3+2]);}
		const n=new T.Vector3(srcNrm[v*3],srcNrm[v*3+1],srcNrm[v*3+2]).normalize();
		rp.push(srcPos[v*3],srcPos[v*3+1],srcPos[v*3+2]);rn.push(n.x,n.y,n.z);rw.push(w);
	}
	const tw:number[]=[],tr:number[]=[];srcIndex.forEach(r=>{tr.push(r);tw.push(rw[r]);});
	const W=(i:number,out=new T.Vector3())=>out.set(wp[i*3],wp[i*3+1],wp[i*3+2]);

	// Long axis by area-weighted PCA of the triangles, pointing distally (down the arm).
	const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),mean=new T.Vector3();let area=0;
	const tris=[] as {c:T.Vector3;w:number}[];
	for(let t=0;t<tw.length;t+=3){W(tw[t],a);W(tw[t+1],b);W(tw[t+2],c);const w=b.clone().sub(a).cross(c.clone().sub(a)).length()/2,m=a.clone().add(b).add(c).divideScalar(3);tris.push({c:m,w});mean.addScaledVector(m,w);area+=w;}
	mean.divideScalar(area);
	const cov=new T.Matrix3(),e=cov.elements;tris.forEach(({c:m,w})=>{const d=m.clone().sub(mean);for(let i=0;i<3;i++)for(let j=0;j<3;j++)e[i*3+j]+=w*d.getComponent(i)*d.getComponent(j);});
	let axis=new T.Vector3(0,-1,0);for(let k=0;k<40;k++)axis.applyMatrix3(cov).normalize();if(axis.y>0)axis.negate();
	let tmin=Infinity,tmax=-Infinity;for(let i=0;i<wp.length/3;i++){const t=W(i,a).dot(axis);tmin=Math.min(tmin,t);tmax=Math.max(tmax,t);}
	const tb=tmin+FRACTURE_LEVEL*(tmax-tmin);
	// Centre of the bone's cross-section at axial position t (mean of the edge/plane crossings).
	const section=(t:number,u:T.Vector3)=>{const sum=new T.Vector3();let n=0;for(let i=0;i<tw.length;i+=3)for(let k=0;k<3;k++){W(tw[i+k],a);W(tw[i+(k+1)%3],b);const da=a.dot(u)-t,db=b.dot(u)-t;if(da*db<0){sum.add(a.lerp(b,da/(da-db)));n++;}}return n?sum.divideScalar(n):null;};
	// The break is near the metaphysis, so the cut plane follows the local shaft direction just below it.
	const s0=section(tb+.004,axis),s1=section(tb+.045,axis);const u=s0&&s1?s1.clone().sub(s0).normalize():axis.clone();
	const B=section(tb,axis)??mean.clone(),lenA=tb-tmin,lenB=tmax-tb;
	// Lateral (away from the body; +x for the left arm) and anterior-ish directions perpendicular to the shaft.
	const lateral=new T.Vector3(1,0,0).addScaledVector(u,-u.x).normalize(),front=new T.Vector3().crossVectors(u,lateral).normalize();
	const polar=(p:T.Vector3)=>{const d=a.copy(p).sub(B);return {d:d.dot(u),th:Math.atan2(d.dot(front),d.dot(lateral))};};
	// Jagged transverse break surface: small serrations plus a spike on the lateral corner of the head fragment.
	const jag=(th:number)=>.0009*Math.sin(3*th+.7)+.0006*Math.sin(7*th+2.1)+.0004*Math.sin(13*th+.4)+.0026*Math.exp(-(((Math.atan2(Math.sin(th),Math.cos(th))+.15)/.42)**2));
	const cutS=(p:T.Vector3)=>{const {d,th}=polar(p);return d-jag(th);};

	// Refine the surface around the break by longest-edge bisection (both triangles on the split edge, so it stays watertight).
	const ek=(x:number,y:number)=>x<y?x*1048576+y:y*1048576+x,edges=new Map<number,number[]>();
	const link=(x:number,y:number,t:number)=>{const k=ek(x,y),l=edges.get(k);if(l)l.push(t);else edges.set(k,[t]);};
	const relink=(x:number,y:number,from:number,to:number)=>{const l=edges.get(ek(x,y));if(l){const i=l.indexOf(from);if(i>=0)l[i]=to;}};
	for(let t=0;t<tw.length/3;t++)for(let k=0;k<3;k++)link(tw[t*3+k],tw[t*3+(k+1)%3],t);
	const wd:number[]=[];for(let i=0;i<wp.length/3;i++)wd.push(W(i,a).sub(B).dot(u));
	const midW=new Map<number,number>(),midR=new Map<number,number>();
	const weldMid=(x:number,y:number)=>{const k=ek(x,y);let m=midW.get(k);if(m===undefined){m=wp.length/3;midW.set(k,m);wp.push((wp[x*3]+wp[y*3])/2,(wp[x*3+1]+wp[y*3+1])/2,(wp[x*3+2]+wp[y*3+2])/2);wd.push((wd[x]+wd[y])/2);}return m;};
	const renderMid=(x:number,y:number,m:number)=>{const k=ek(x,y);let r=midR.get(k);if(r===undefined){r=rw.length;midR.set(k,r);const n=new T.Vector3(rn[x*3]+rn[y*3],rn[x*3+1]+rn[y*3+1],rn[x*3+2]+rn[y*3+2]).normalize();rp.push(wp[m*3],wp[m*3+1],wp[m*3+2]);rn.push(n.x,n.y,n.z);rw.push(m);}return r;};
	const len2=(x:number,y:number)=>(wp[x*3]-wp[y*3])**2+(wp[x*3+1]-wp[y*3+1])**2+(wp[x*3+2]-wp[y*3+2])**2;
	// Longest edge of a triangle (ties broken by edge key so the longest-edge paths below never cycle).
	const longest=(t:number)=>{let best=0,bl=-1,bk=-1;for(let k=0;k<3;k++){const x=tw[t*3+k],y=tw[t*3+(k+1)%3],l=len2(x,y),key=ek(x,y);if(l>bl||(l===bl&&key>bk)){bl=l;bk=key;best=k;}}return best;};
	const needs=(t:number)=>{
		const d0=wd[tw[t*3]],d1=wd[tw[t*3+1]],d2=wd[tw[t*3+2]],lo=Math.min(d0,d1,d2),hi=Math.max(d0,d1,d2);if(hi<-BAND||lo>BAND)return false;
		const target=hi>-NEAR&&lo<NEAR?FINE:COARSE,k=longest(t);return len2(tw[t*3+k],tw[t*3+(k+1)%3])>target*target;
	};
	const bisect=(x0:number,y0:number,stack:number[])=>{
		const m=weldMid(x0,y0);
		for(const x of [...(edges.get(ek(x0,y0))??[])]){
			let j=0;while(j<3&&ek(tw[x*3+j],tw[x*3+(j+1)%3])!==ek(x0,y0))j++;if(j===3)continue;
			const p=tw[x*3+j],q=tw[x*3+(j+1)%3],o=tw[x*3+(j+2)%3],rpj=tr[x*3+j],rq=tr[x*3+(j+1)%3],ro=tr[x*3+(j+2)%3],rm=renderMid(rpj,rq,m),y=tw.length/3;
			tw[x*3]=p;tw[x*3+1]=m;tw[x*3+2]=o;tr[x*3]=rpj;tr[x*3+1]=rm;tr[x*3+2]=ro;tw.push(m,q,o);tr.push(rm,rq,ro);
			relink(q,o,x,y);link(p,m,x);link(m,q,y);link(m,o,x);link(m,o,y);stack.push(x,y);
		}
		edges.delete(ek(x0,y0));
	};
	// Rivara's longest-edge propagation: walk to an edge that is the longest of both its triangles and bisect that,
	// so triangles keep their shape (splitting a neighbour's short edge would breed ever-thinner slivers).
	const stack=Array.from({length:tw.length/3},(_,t)=>t);
	while(stack.length&&tw.length<3*80000){
		const t=stack.pop()!;if(!needs(t))continue;
		let cur=t;for(let guard=0;guard<64;guard++){const k=longest(cur),x=tw[cur*3+k],y=tw[cur*3+(k+1)%3],n=(edges.get(ek(x,y))??[]).find(o=>o!==cur);if(n===undefined){break;}const kn=longest(n);if(ek(tw[n*3+kn],tw[n*3+(kn+1)%3])===ek(x,y))break;cur=n;}
		const k=longest(cur);bisect(tw[cur*3+k],tw[cur*3+(k+1)%3],stack);stack.push(t);
	}
	const triCount=tw.length/3;

	// Side of each triangle by its centroid against the jagged surface (0 head, 1 shaft), then fold stray islands into the other side.
	const side=new Uint8Array(triCount);for(let t=0;t<triCount;t++){W(tw[t*3],a);W(tw[t*3+1],b);W(tw[t*3+2],c);side[t]=cutS(a.add(b).add(c).divideScalar(3))<0?0:1;}
	const neighbours=(t:number)=>[0,1,2].map(k=>(edges.get(ek(tw[t*3+k],tw[t*3+(k+1)%3]))??[]).find(o=>o!==t)??-1);
	for(let pass=0;pass<6;pass++){
		const comp=new Int32Array(triCount).fill(-1),sizes:number[]=[],sides:number[]=[];
		for(let t=0;t<triCount;t++){if(comp[t]>=0)continue;const id=sizes.length,q=[t];comp[t]=id;let n=0;while(q.length){const x=q.pop()!;n++;for(const o of neighbours(x))if(o>=0&&comp[o]<0&&side[o]===side[t]){comp[o]=id;q.push(o);}}sizes.push(n);sides.push(side[t]);}
		const keep=[0,1].map(s=>{let best=-1;sizes.forEach((n,i)=>{if(sides[i]===s&&(best<0||n>sizes[best]))best=i;});return best;});
		let flipped=false;for(let t=0;t<triCount;t++)if(comp[t]!==keep[side[t]]){side[t]^=1;flipped=true;}if(!flipped)break;
	}
	// Winding: the atlas renders double-sided, so check whether this part's triangles face outwards.
	let facing=0;for(let t=0;t<triCount;t++){W(tw[t*3],a);W(tw[t*3+1],b);W(tw[t*3+2],c);const n=b.sub(a).cross(c.sub(a));facing+=n.x*(rn[tr[t*3]*3]+rn[tr[t*3+1]*3]+rn[tr[t*3+2]*3])+n.y*(rn[tr[t*3]*3+1]+rn[tr[t*3+1]*3+1]+rn[tr[t*3+2]*3+1])+n.z*(rn[tr[t*3]*3+2]+rn[tr[t*3+1]*3+2]+rn[tr[t*3+2]*3+2]);}
	const outward=facing>=0;
	const cutDist=(r:number)=>Math.abs(cutS(a.set(rp[r*3],rp[r*3+1],rp[r*3+2])));

	const disposables:{dispose():void}[]=[];
	const root=new T.Group();root.visible=false;root.name='fracture';scene.add(root);
	// Fragment surfaces: the skeletal material plus a dark, blood-stained band along the crack, faded by `line`.
	const uLine={value:1};
	const withCrack=(m:T.MeshStandardMaterial,strength:number)=>{m.onBeforeCompile=sh=>{sh.uniforms.uLine=uLine;sh.vertexShader='attribute float cutDist; varying float vCut;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCut = cutDist;');sh.fragmentShader='uniform float uLine; varying float vCut;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat crack = uLine * (1.0 - smoothstep(0.0005, 0.005, vCut));\ncrack *= crack * (3.0 - 2.0 * crack);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.014, 0.01), crack * ${strength.toFixed(2)});`);};m.customProgramCacheKey=()=>`fracture-crack-${strength}`;return m;};
	const boneMat=withCrack(new T.MeshStandardMaterial({color:BONE,metalness:.08,roughness:.53,side:T.DoubleSide}),.9);disposables.push(boneMat);
	const fragment=(s:number)=>{
		const map=new Map<number,number>(),pos:number[]=[],nrm:number[]=[],cut:number[]=[],index:number[]=[];
		const vert=(r:number)=>{let i=map.get(r);if(i===undefined){i=pos.length/3;map.set(r,i);pos.push(rp[r*3],rp[r*3+1],rp[r*3+2]);nrm.push(rn[r*3],rn[r*3+1],rn[r*3+2]);cut.push(cutDist(r));}return i;};
		for(let t=0;t<triCount;t++)if(side[t]===s)index.push(vert(tr[t*3]),vert(tr[t*3+1]),vert(tr[t*3+2]));
		const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nrm,3));g.setAttribute('cutDist',new T.Float32BufferAttribute(cut,1));g.setIndex(index);g.computeBoundingSphere();disposables.push(g);
		const mesh=new T.Mesh(g,boneMat);mesh.matrixAutoUpdate=false;root.add(mesh);return mesh;
	};
	const head=fragment(0),shaft=fragment(1);

	// Caps: the open end of each fragment, as a rough cross-section (cortex ring, then cancellous marrow).
	const next=new Map<number,number>();
	for(let t=0;t<triCount;t++){if(side[t])continue;const nb=neighbours(t);for(let k=0;k<3;k++)if(nb[k]>=0&&side[nb[k]]===1)next.set(tw[t*3+k],tw[t*3+(k+1)%3]);}
	const loops:number[][]=[];while(next.size){const start=next.keys().next().value!;const loop=[start];let v=next.get(start)!;next.delete(start);while(v!==start&&next.has(v)&&loop.length<1e5){loop.push(v);const n=next.get(v)!;next.delete(v);v=n;}if(loop.length>=3)loops.push(loop);}
	const rand=random(20090902),capPos:number[]=[],capCol:number[]=[],col=new T.Color();
	const cortex=new T.Color('#b5a47c'),marrowA=new T.Color('#6e2a20'),marrowB=new T.Color('#a2644a');
	loops.forEach(loop=>{
		const pts=loop.map(w=>W(w)),C=pts.reduce((s,p)=>s.add(p),new T.Vector3()).divideScalar(pts.length),n=pts.length;
		// Rings from the rim inwards: the cortex band, then cancellous bone whose height and colour vary smoothly (a rough, not spiky, surface).
		const ph=[rand()*6.28,rand()*6.28,rand()*6.28],wave=(i:number,f:number)=>{const t=i/n*Math.PI*2;return Math.sin(5*t+ph[0]+f*4)*.6+Math.sin(11*t+ph[1]-f*7)*.4;};
		const ring=(f:number,h:number)=>pts.map((p,i)=>p.clone().lerp(C,f).addScaledVector(u,wave(i,f)*h));
		const rings=[pts,ring(.28,.0003),ring(.5,.0009),ring(.72,.0009),ring(.9,.0005)],center=C.clone();
		const shade=(i:number,f:number)=>col.copy(marrowA).lerp(marrowB,.5+.5*Math.sin(i/n*Math.PI*6+ph[2]+f*9)*Math.cos(f*5)).clone(),shades=rings.map((_,r)=>Array.from({length:n},(_,i)=>r===0?cortex:shade(i,r)));
		const tri=(p:T.Vector3,q:T.Vector3,r:T.Vector3,cp:T.Color,cq:T.Color,cr:T.Color)=>{capPos.push(p.x,p.y,p.z,q.x,q.y,q.z,r.x,r.y,r.z);capCol.push(cp.r,cp.g,cp.b,cq.r,cq.g,cq.b,cr.r,cr.g,cr.b);};
		for(let r=0;r<rings.length;r++)for(let i=0;i<n;i++){
			const j=(i+1)%n,A=rings[r],ca=r===0?cortex:shades[r][i],cb=r===0?cortex:shades[r][j];
			if(r+1<rings.length){const Bn=rings[r+1],da=r===0?cortex:shades[r+1][i],db=r===0?cortex:shades[r+1][j];tri(A[i],A[j],Bn[j],ca,cb,db);tri(A[i],Bn[j],Bn[i],ca,db,da);}
			else tri(A[i],A[j],center,ca,cb,marrowA);
		}
	});
	const capMat=new T.MeshStandardMaterial({vertexColors:true,metalness:0,roughness:.86,side:T.DoubleSide});disposables.push(capMat);
	const cap=(dir:number,parent:T.Mesh)=>{
		const p=capPos.slice(),v0=new T.Vector3(),v1=new T.Vector3(),v2=new T.Vector3();
		// Wind each triangle to face out of its fragment: +u from the head, -u from the shaft.
		for(let i=0;i<p.length;i+=9){v0.fromArray(p,i);v1.fromArray(p,i+3);v2.fromArray(p,i+6);if(v1.sub(v0).cross(v2.sub(v0)).dot(u)*dir<0)for(let k=0;k<3;k++){const x=p[i+3+k];p[i+3+k]=p[i+6+k];p[i+6+k]=x;}}
		const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(capCol,3));g.computeVertexNormals();g.computeBoundingSphere();disposables.push(g);
		parent.add(new T.Mesh(g,capMat));
	};
	cap(1,head);cap(-1,shaft);

	// Callus: the refined surface within ±CALLUS_HALF_LENGTH of the break, pushed out along its normals into
	// a lumpy, cloud-like cuff (larger medially) and skinned across the break to both fragments.
	const inBand:number[]=[];for(let t=0;t<triCount;t++){const d=(wd[tw[t*3]]+wd[tw[t*3+1]]+wd[tw[t*3+2]])/3;if(Math.abs(d)<CALLUS_HALF_LENGTH)inBand.push(t);}
	const cmap=new Map<number,number>(),cBase:number[]=[],cNrm:number[]=[],cBulge:number[]=[],cSpindle:number[]=[],cWeight:number[]=[],cCut:number[]=[],cFade:number[]=[],cIndex:number[]=[];
	// Lumps of periosteal new bone, more of them (and larger) on the medial side, as on the day-23 film.
	const blobs=Array.from({length:46},()=>{const th=rand()<.6?Math.PI+(rand()*2-1)*1.5:(rand()*2-1)*Math.PI,medial=(1-Math.cos(th))/2;return {th,d:(rand()*2-1)*CALLUS_HALF_LENGTH*.8,r:.003+rand()*.0035,h:(.5+rand()*.5)*(.45+.8*medial)};});
	const R=.012;
	const lumps=(th:number,d:number)=>{let s=0;for(const k of blobs){const dth=Math.atan2(Math.sin(th-k.th),Math.cos(th-k.th))*R,dd=d-k.d;s+=k.h*Math.exp(-(dth*dth+dd*dd)/(k.r*k.r));}return Math.min(1.3,s);};
	const envelope=(d:number)=>{const x=clamp01(1-(d/CALLUS_HALF_LENGTH)**2);return x*x;};
	const bulgeAt=(th:number,d:number)=>{const medial=(1-Math.cos(th))/2,e=envelope(d);return e**.8*(.2+.3*medial)+e**.4*.95*lumps(th,d);};
	// Remodelling first smooths the lumps into a plain spindle, which then shrinks away.
	const spindleAt=(th:number,d:number)=>{const medial=(1-Math.cos(th))/2;return envelope(d)*(.55+.35*medial);};
	const cvert=(w:number,r:number)=>{let i=cmap.get(w);if(i===undefined){i=cBase.length/3;cmap.set(w,i);W(w,b);cBase.push(b.x,b.y,b.z);cNrm.push(0,0,0);const {d,th}=polar(b);cBulge.push(bulgeAt(th,d));cSpindle.push(spindleAt(th,d));cWeight.push(smooth(-.0025,.0025,cutS(b)));cCut.push(Math.abs(cutS(b)));}
		cNrm[i*3]+=rn[r*3];cNrm[i*3+1]+=rn[r*3+1];cNrm[i*3+2]+=rn[r*3+2];return i;};
	inBand.forEach(t=>{const v=[0,1,2].map(k=>cvert(tw[t*3+k],tr[t*3+k]));cIndex.push(...(outward?v:[v[0],v[2],v[1]]));});
	const maxBulge=Math.max(...cBulge,1e-6);
	for(let i=0;i<cBulge.length;i++){cBulge[i]/=maxBulge;cSpindle[i]/=maxBulge;cFade.push(smooth(0,.3,cBulge[i]));const n=new T.Vector3().fromArray(cNrm,i*3).normalize();cNrm[i*3]=n.x;cNrm[i*3+1]=n.y;cNrm[i*3+2]=n.z;}
	const callusGeo=new T.BufferGeometry(),callusPos=new Float32Array(cBase.length);callusGeo.setAttribute('position',new T.BufferAttribute(callusPos,3));callusGeo.setAttribute('normal',new T.BufferAttribute(new Float32Array(cBase.length),3));callusGeo.setAttribute('fade',new T.Float32BufferAttribute(cFade,1));callusGeo.setAttribute('cutDist',new T.Float32BufferAttribute(cCut,1));callusGeo.setIndex(cIndex);disposables.push(callusGeo);
	const uCallus={fadeMix:{value:0}};
	const callusMat=new T.MeshStandardMaterial({color:CARTILAGE,metalness:.02,roughness:.62,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-4});disposables.push(callusMat);
	callusMat.onBeforeCompile=sh=>{
		sh.uniforms.uLine=uLine;sh.uniforms.fadeMix=uCallus.fadeMix;sh.uniforms.boneColor={value:new T.Color(BONE)};
		sh.vertexShader='attribute float fade; attribute float cutDist; varying float vFade; varying float vCut;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFade = fade; vCut = cutDist;');
		sh.fragmentShader='uniform float uLine; uniform float fadeMix; uniform vec3 boneColor; varying float vFade; varying float vCut;\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(boneColor, diffuseColor.rgb, mix(1.0, vFade, fadeMix));\ndiffuseColor.a *= mix(vFade, 1.0, fadeMix);\ndiffuseColor.rgb *= 1.0 - 0.45 * uLine * (1.0 - smoothstep(0.0006, 0.0035, vCut));').replace('#include <opaque_fragment>','float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));\ndiffuseColor.a = mix(min(1.0, diffuseColor.a * (0.7 + 0.8 * rim)), diffuseColor.a, fadeMix);\n#include <opaque_fragment>');
	};
	callusMat.customProgramCacheKey=()=>'fracture-callus';
	const callus=new T.Mesh(callusGeo,callusMat);callus.frustumCulled=false;callus.renderOrder=2;root.add(callus);

	// Hematoma: two soft, lumpy ellipsoids around the break, most opaque where they face the camera.
	const clot=(rx:number,ry:number,color:string,seed:number)=>{
		const g=new T.SphereGeometry(1,64,40),p=g.getAttribute('position') as T.BufferAttribute,pole=new Float32Array(p.count),r2=random(seed),ph=Array.from({length:6},()=>r2()*6.28);
		for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+.035*Math.sin(3*x+ph[0])*Math.sin(2*y+ph[1])+.025*Math.sin(4*z+ph[2]);pole[i]=y;p.setXYZ(i,x*rx*k,y*ry*k,z*rx*k*(x<0?1.12:1));}
		g.setAttribute('pole',new T.BufferAttribute(pole,1));
		g.computeVertexNormals();disposables.push(g);
		const m=new T.ShaderMaterial({uniforms:{uColor:{value:new T.Color(color)},uOpacity:{value:0}},transparent:true,depthWrite:false,
			vertexShader:'attribute float pole; varying vec3 vN; varying vec3 vV; varying float vPole; void main(){ vPole = pole; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
			fragmentShader:'uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying float vPole; void main(){ float f = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0); gl_FragColor = vec4(uColor, uOpacity * f * f * (1.0 - smoothstep(0.35, 0.8, abs(vPole)))); \n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
		disposables.push(m);const mesh=new T.Mesh(g,m);mesh.renderOrder=1;return mesh;
	};
	const hematoma=new T.Group(),clots=[clot(.021,.03,'#b3262e',7),clot(.0175,.022,'#7e151d',11)];clots.forEach(m=>hematoma.add(m));hematoma.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),u);root.add(hematoma);

	// The whole left upper arm, for the camera.
	const box=new T.Box3(new T.Vector3().fromArray(atlas.parts[part].bounds[0]),new T.Vector3().fromArray(atlas.parts[part].bounds[1])).expandByScalar(.012);

	// Fragment poses. The head tilts about the shoulder and the shaft about the elbow, so both joints stay seated;
	// the tilts are split so the broken ends meet, then the shaft end is shifted laterally and the gap opened.
	const S=B.clone().addScaledVector(u,-lenA),E=B.clone().addScaledVector(u,lenB),hinge=new T.Vector3().crossVectors(u,lateral).normalize();
	const Mp=new T.Matrix4(),Md=new T.Matrix4(),tmp=new T.Matrix4();
	const about=(out:T.Matrix4,pivot:T.Vector3,angle:number,offset:number)=>out.makeTranslation(pivot.x+u.x*offset,pivot.y+u.y*offset,pivot.z+u.z*offset).multiply(tmp.makeRotationAxis(hinge,angle)).multiply(new T.Matrix4().makeTranslation(-pivot.x,-pivot.y,-pivot.z));
	const place=(gap:number,shift:number,angle:number)=>{
		const alpha=angle*lenB/(lenA+lenB),beta=angle*lenA/(lenA+lenB)+shift/lenB;
		about(Mp,S,alpha,-gap/2);about(Md,E,-beta,gap/2);
		head.matrix.copy(Mp);shaft.matrix.copy(Md);head.matrixWorldNeedsUpdate=shaft.matrixWorldNeedsUpdate=true;
	};
	const pose=(amount:number,smoothing:number)=>{
		const q=new T.Vector3(),p1=new T.Vector3(),p2=new T.Vector3(),n1=new T.Vector3(),n2=new T.Vector3(),nm=new T.Matrix3(),nd=new T.Matrix3();nm.getNormalMatrix(Mp);nd.getNormalMatrix(Md);
		const lift=amount*CALLUS_BULGE,nrm=callusGeo.getAttribute('normal') as T.BufferAttribute;
		for(let i=0;i<cBulge.length;i++){q.fromArray(cBase,i*3).addScaledVector(n1.fromArray(cNrm,i*3),lift*(cBulge[i]+(cSpindle[i]-cBulge[i])*smoothing));p1.copy(q).applyMatrix4(Mp);p2.copy(q).applyMatrix4(Md);p1.lerp(p2,cWeight[i]);callusPos[i*3]=p1.x;callusPos[i*3+1]=p1.y;callusPos[i*3+2]=p1.z;}
		callusGeo.getAttribute('position').needsUpdate=true;callusGeo.computeVertexNormals();
		// Where the cuff meets the bone, use the bone's own normals so its edge shades like the surface beneath.
		for(let i=0;i<cBulge.length;i++){const k=smooth(0,.35,cBulge[i]*amount*4);n1.fromArray(cNrm,i*3).applyMatrix3(nm);n2.fromArray(cNrm,i*3).applyMatrix3(nd);n1.lerp(n2,cWeight[i]).normalize();n2.fromBufferAttribute(nrm,i);n1.lerp(n2,k).normalize();nrm.setXYZ(i,n1.x,n1.y,n1.z);}
		nrm.needsUpdate=true;
	};

	const p1v=new T.Vector3(),p2v=new T.Vector3();
	let active=false,lastKey='',lastDate:string|null=null,snapAt:number|null=null;
	const update=(date:string,skeletal:boolean,now:number):FractureUpdate=>{
		let changed=false,fly=false;const valid=ISO.test(date),state=valid?fractureAt(date):null;
		if(valid){
			if(date<FRACTURE_DATE)snapAt=null;
			else if(lastDate!==null&&lastDate<FRACTURE_DATE&&state){fly=skeletal;snapAt=now+(fly?SNAP_DELAY:0);}
			lastDate=date;
		}
		const pending=snapAt!==null&&now<snapAt,kick=snapAt===null||pending?1:breakKick(now-snapAt),animating=snapAt!==null&&now-snapAt<BREAK_MS;
		if(snapAt!==null&&!animating)snapAt=null;
		const on=!!state&&!pending;
		if(on!==active){active=on;changed=true;}
		// Hide the original part while the fragments are drawn; otherwise leave it as the scene's visibility says.
		const want=active?0:skeletal?1:0;if(data[part*4+3]!==want){data[part*4+3]=want;partTexture.needsUpdate=true;changed=true;}
		const show=active&&skeletal;if(root.visible!==show){root.visible=show;changed=true;}
		if(active&&state){
			const key=`${date}|${kick}`;
			if(key!==lastKey){
				lastKey=key;changed=true;place(state.gap*kick,state.shift*kick,state.angle*kick);
				uLine.value=state.line;
				const soft=1-state.mineral;callus.visible=state.callus>.004;uCallus.fadeMix.value=state.mineral**2;
				callusMat.opacity=(.72*soft+state.mineral)*Math.min(1,state.callus*3);callusMat.depthWrite=state.mineral>.6;
				if(callus.visible)pose(state.callus,smooth(50,200,state.day));
				// Cartilage, then woven bone (a touch darker and matte so the cuff reads), remodelled to plain bone.
				callusMat.color.set(CARTILAGE).lerp(col.set(WOVEN),state.mineral).lerp(col.set(BONE),smooth(50,300,state.day));callusMat.roughness=.62+.1*state.mineral*(1-smooth(50,300,state.day))-.09*state.mineral;
				clots[0].visible=clots[1].visible=state.hematoma>.005;
				(clots[0].material as T.ShaderMaterial).uniforms.uOpacity.value=.42*state.hematoma;(clots[1].material as T.ShaderMaterial).uniforms.uOpacity.value=.5*state.hematoma;
				hematoma.position.copy(p1v.copy(B).applyMatrix4(Mp).add(p2v.copy(B).applyMatrix4(Md)).multiplyScalar(.5));
			}
		}else lastKey='';
		return {changed,animating,fly};
	};

	return {update,box,dispose:()=>{scene.remove(root);disposables.forEach(d=>d.dispose());}};
}
