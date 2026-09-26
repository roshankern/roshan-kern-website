/** The 2009 left humerus fracture as a timeline CustomLayer: a port of app/anyhealth/fracture/fracture-scene.ts (the approved /anyhealth/test build) with the healing model imported from fracture/model.ts.
 *  Built once from the humerus's rest geometry: the mesh is refined around the break, cut into a proximal (head) and distal (shaft) fragment along a jagged transverse surface, and each open end is capped with a cortex + marrow cross-section. A lumpy callus cuff and a soft clot sit over the break.
 *  Differences from the /anyhealth/test build:
 *  - Every mesh uses ctx.material(segment 'lUpperArm'), so it gets the body warp and grows with the arm. Fragment, cap and clot poses are a `uPose` matrix applied to the rest-space vertex before the engine's fx/warp block (a mesh matrix would act after the warp and pivot about the wrong, un-grown joints); the callus is posed on the CPU in rest space as before. Meshes keep identity matrices and are not frustum-culled.
 *  - The original humerus is hidden by the script's fxAt ({part:'Left humerus',visible:0} while fractureAt is non-null), not by writing the part texture. So while the snap waits for the camera the fragments are drawn intact (kick 0) instead.
 *  - The snap plays, and the camera fly is requested (ctx.requestFly, once), only when the date crosses day 0 with direction 1.
 *  - While another script is focused, every mesh fades by frame.ghost (issues/layer-fade.ts) instead of hiding; the skeletal switch still hides it (a focus on this script overrides the switch, as for atlas parts). */
import * as T from 'three';
import {SYSTEMS} from '../../../atlas/anatomy';
import {BREAK_MS,CALLUS_BULGE,CALLUS_HALF_LENGTH,FRACTURE_DATE,FRACTURE_LEVEL,FRACTURE_PART,breakKick,fractureAt} from '../../../fracture/model';
import type {CustomLayer,LayerContext,LayerFrame} from '../../types';
import {fadeMaterial,fadeMesh,ghostOpacity,ghostTwin} from '../layer-fade';

const BONE=SYSTEMS.find(s=>s.id==='skeletal')?.mesh??'#e2d9ba',CARTILAGE='#abcddb',WOVEN='#cbb98d';
/** Mesh refinement around the break: edge length in the break zone and over the rest of the callus. */
const FINE=.0012,COARSE=.0024,NEAR=.0075,BAND=CALLUS_HALF_LENGTH+.004;
/** Snap waits for the camera flight so the break is seen happening. */
const SNAP_DELAY=380;
const SEGMENT='lUpperArm';
const clamp01=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(a:number,b:number,x:number)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
const random=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
/** Chain a shader edit after the engine's patch (which ctx.material installed), and extend the program cache key. */
function chain(m:T.Material,key:string,edit:(sh:Shader)=>void){
	const prev=m.onBeforeCompile,prevKey=m.customProgramCacheKey.bind(m);
	m.onBeforeCompile=(sh,r)=>{prev.call(m,sh,r);edit(sh);};m.customProgramCacheKey=()=>`${prevKey()}|${key}`;m.needsUpdate=true;
}
/** Rest-space pose: `transformed` (and the normal) go through uPose before the engine's fx/warp block, which follows the hoisted begin_vertex. */
function withPose(m:T.Material,pose:{value:T.Matrix4},key:string,extra:(sh:Shader)=>void=()=>{}){
	chain(m,`fracture-${key}`,sh=>{
		sh.uniforms.uPose=pose;
		sh.vertexShader=sh.vertexShader.replace('#include <common>',()=>'#include <common>\nuniform mat4 uPose;').replace('#include <begin_vertex>',()=>'#include <begin_vertex>\ntransformed = (uPose * vec4(transformed, 1.0)).xyz; objectNormal = mat3(uPose) * objectNormal;');
		extra(sh);
	});
}

/** The fracture layer for the script `left-humerus-fracture-2009`. */
export function fractureLayer():CustomLayer{
	let root:T.Group|null=null,ctxRef:LayerContext|null=null,layerBox:T.Box3|null=null;
	const disposables:{dispose():void}[]=[];
	let apply:((day:number,frame:LayerFrame)=>{changed:boolean;animating:boolean})|null=null;

	const init=(ctx:LayerContext):boolean=>{
		ctxRef=ctx;const {atlas}=ctx;
		const part=ctx.indicesOf(FRACTURE_PART).find(i=>atlas.parts[i].system==='skeletal')??-1,source=part>=0?ctx.restGeometry(part):undefined;
		if(part<0||!source?.index)return false;
		const srcPos=source.getAttribute('position').array as Float32Array,srcNrm=source.getAttribute('normal').array as ArrayLike<number>,srcIndex=source.index.array as ArrayLike<number>;

		// Weld by position (the part has duplicate vertices along normal seams) so the topology is one closed surface.
		// Render vertices keep their own normals; `rw` maps each to its welded vertex.
		const wp:number[]=[],rp:number[]=[],rn:number[]=[],rw:number[]=[],weld=new Map<string,number>();
		for(let v=0;v<srcPos.length/3;v++){
			const k=`${srcPos[v*3]},${srcPos[v*3+1]},${srcPos[v*3+2]}`;let w=weld.get(k);
			if(w===undefined){w=wp.length/3;weld.set(k,w);wp.push(srcPos[v*3],srcPos[v*3+1],srcPos[v*3+2]);}
			const n=new T.Vector3(srcNrm[v*3],srcNrm[v*3+1],srcNrm[v*3+2]).normalize();
			rp.push(srcPos[v*3],srcPos[v*3+1],srcPos[v*3+2]);rn.push(n.x,n.y,n.z);rw.push(w);
		}
		const tw:number[]=[],tr:number[]=[];Array.from(srcIndex).forEach(r=>{tr.push(r);tw.push(rw[r]);});
		const W=(i:number,out=new T.Vector3())=>out.set(wp[i*3],wp[i*3+1],wp[i*3+2]);

		// Long axis by area-weighted PCA of the triangles, pointing distally (down the arm).
		const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),mean=new T.Vector3();let area=0;
		const tris=[] as {c:T.Vector3;w:number}[];
		for(let t=0;t<tw.length;t+=3){W(tw[t],a);W(tw[t+1],b);W(tw[t+2],c);const w=b.clone().sub(a).cross(c.clone().sub(a)).length()/2,m=a.clone().add(b).add(c).divideScalar(3);tris.push({c:m,w});mean.addScaledVector(m,w);area+=w;}
		mean.divideScalar(area);
		const cov=new T.Matrix3(),e=cov.elements;tris.forEach(({c:m,w})=>{const d=m.clone().sub(mean);for(let i=0;i<3;i++)for(let j=0;j<3;j++)e[i*3+j]+=w*d.getComponent(i)*d.getComponent(j);});
		const axis=new T.Vector3(0,-1,0);for(let k=0;k<40;k++)axis.applyMatrix3(cov).normalize();if(axis.y>0)axis.negate();
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

		const group=new T.Group();group.visible=false;group.name='fracture';ctx.scene.add(group);root=group;
		const add=(mesh:T.Mesh,order=0)=>{mesh.frustumCulled=false;mesh.renderOrder=order;group.add(mesh);return mesh;};
		const geo=(g:T.BufferGeometry)=>{disposables.push(g);return g;};
		// Fragment surfaces: the skeletal material plus a dark, blood-stained band along the crack, faded by `line`.
		const uLine={value:1},poseHead={value:new T.Matrix4()},poseShaft={value:new T.Matrix4()},poseClot={value:new T.Matrix4()};
		const crackVertex=(sh:Shader)=>{sh.vertexShader=sh.vertexShader.replace('#include <common>',()=>'#include <common>\nattribute float cutDist; varying float vCut;').replace('#include <begin_vertex>',()=>'#include <begin_vertex>\nvCut = cutDist;');};
		// Opaque meshes (fragments, caps) and their own materials: faded by swapping to the materials' ghost twins.
		const solids:{mesh:T.Mesh;own:T.Material}[]=[],solid=(mesh:T.Mesh)=>{solids.push({mesh,own:mesh.material as T.Material});return mesh;};
		const boneMat=(pose:{value:T.Matrix4},key:string)=>{
			const m=ctx.material({color:BONE,segment:SEGMENT});disposables.push(m);
			withPose(m,pose,`bone-${key}`,sh=>{
				sh.uniforms.uLine=uLine;crackVertex(sh);
				sh.fragmentShader='uniform float uLine; varying float vCut;\n'+sh.fragmentShader.replace('#include <color_fragment>',()=>'#include <color_fragment>\nfloat crack = uLine * (1.0 - smoothstep(0.0005, 0.005, vCut));\ncrack *= crack * (3.0 - 2.0 * crack);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.045, 0.014, 0.01), crack * 0.90);');
			});
			return m;
		};
		const fragment=(s:number,pose:{value:T.Matrix4},key:string)=>{
			const map=new Map<number,number>(),pos:number[]=[],nrm:number[]=[],cut:number[]=[],index:number[]=[];
			const vert=(r:number)=>{let i=map.get(r);if(i===undefined){i=pos.length/3;map.set(r,i);pos.push(rp[r*3],rp[r*3+1],rp[r*3+2]);nrm.push(rn[r*3],rn[r*3+1],rn[r*3+2]);cut.push(cutDist(r));}return i;};
			for(let t=0;t<triCount;t++)if(side[t]===s)index.push(vert(tr[t*3]),vert(tr[t*3+1]),vert(tr[t*3+2]));
			const g=geo(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nrm,3));g.setAttribute('cutDist',new T.Float32BufferAttribute(cut,1));g.setIndex(index);g.computeBoundingSphere();
			return solid(add(new T.Mesh(g,boneMat(pose,key))));
		};
		fragment(0,poseHead,'head');fragment(1,poseShaft,'shaft');

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
		const cap=(dir:number,pose:{value:T.Matrix4},key:string)=>{
			const p=capPos.slice(),v0=new T.Vector3(),v1=new T.Vector3(),v2=new T.Vector3();
			// Wind each triangle to face out of its fragment: +u from the head, -u from the shaft.
			for(let i=0;i<p.length;i+=9){v0.fromArray(p,i);v1.fromArray(p,i+3);v2.fromArray(p,i+6);if(v1.sub(v0).cross(v2.sub(v0)).dot(u)*dir<0)for(let k=0;k<3;k++){const x=p[i+3+k];p[i+3+k]=p[i+6+k];p[i+6+k]=x;}}
			const g=geo(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(capCol,3));g.computeVertexNormals();g.computeBoundingSphere();
			const m=ctx.material({color:'#ffffff',segment:SEGMENT});m.vertexColors=true;m.metalness=0;m.roughness=.86;disposables.push(m);withPose(m,pose,`cap-${key}`);
			solid(add(new T.Mesh(g,m)));
		};
		cap(1,poseHead,'head');cap(-1,poseShaft,'shaft');

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
		const callusGeo=geo(new T.BufferGeometry()),callusPos=new Float32Array(cBase.length);callusGeo.setAttribute('position',new T.BufferAttribute(callusPos,3));callusGeo.setAttribute('normal',new T.BufferAttribute(new Float32Array(cBase.length),3));callusGeo.setAttribute('fade',new T.Float32BufferAttribute(cFade,1));callusGeo.setAttribute('cutDist',new T.Float32BufferAttribute(cCut,1));callusGeo.setIndex(cIndex);
		const uCallus={fadeMix:{value:0}};
		const callusMat=ctx.material({color:CARTILAGE,segment:SEGMENT,transparent:true,depthWrite:false});disposables.push(callusMat);
		// FrontSide, metalness and roughness as the /anyhealth/test build (ctx.material defaults to the atlas's DoubleSide bone finish).
		callusMat.side=T.FrontSide;callusMat.metalness=.02;callusMat.roughness=.62;callusMat.polygonOffset=true;callusMat.polygonOffsetFactor=-1;callusMat.polygonOffsetUnits=-4;
		chain(callusMat,'fracture-callus',sh=>{
			sh.uniforms.uLine=uLine;sh.uniforms.fadeMix=uCallus.fadeMix;sh.uniforms.boneColor={value:new T.Color(BONE)};
			sh.vertexShader=sh.vertexShader.replace('#include <common>',()=>'#include <common>\nattribute float fade; attribute float cutDist; varying float vFade; varying float vCut;').replace('#include <begin_vertex>',()=>'#include <begin_vertex>\nvFade = fade; vCut = cutDist;');
			sh.fragmentShader='uniform float uLine; uniform float fadeMix; uniform vec3 boneColor; varying float vFade; varying float vCut;\n'+sh.fragmentShader.replace('#include <color_fragment>',()=>'#include <color_fragment>\ndiffuseColor.rgb = mix(boneColor, diffuseColor.rgb, mix(1.0, vFade, fadeMix));\ndiffuseColor.a *= mix(vFade, 1.0, fadeMix);\ndiffuseColor.rgb *= 1.0 - 0.45 * uLine * (1.0 - smoothstep(0.0006, 0.0035, vCut));').replace('#include <opaque_fragment>',()=>'float rim = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));\ndiffuseColor.a = mix(min(1.0, diffuseColor.a * (0.7 + 0.8 * rim)), diffuseColor.a, fadeMix);\n#include <opaque_fragment>');
		});
		const callus=add(new T.Mesh(callusGeo,callusMat),2);

		// Hematoma: two soft, lumpy ellipsoids around the break, most opaque where they face the camera. Baked in rest space
		// (oriented along the shaft, centred on the break) and moved with the fragments' midpoint by poseClot.
		const qShaft=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),u);
		const clot=(rx:number,ry:number,color:string,seed:number,opacity:number)=>{
			const g=geo(new T.SphereGeometry(1,64,40)),p=g.getAttribute('position') as T.BufferAttribute,pole=new Float32Array(p.count),r2=random(seed),ph=Array.from({length:6},()=>r2()*6.28),v=new T.Vector3();
			for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+.035*Math.sin(3*x+ph[0])*Math.sin(2*y+ph[1])+.025*Math.sin(4*z+ph[2]);pole[i]=y;v.set(x*rx*k,y*ry*k,z*rx*k*(x<0?1.12:1)).applyQuaternion(qShaft).add(B);p.setXYZ(i,v.x,v.y,v.z);}
			g.setAttribute('pole',new T.BufferAttribute(pole,1));g.computeVertexNormals();
			const m=ctx.material({color,segment:SEGMENT,transparent:true,depthWrite:false});m.side=T.FrontSide;disposables.push(m);
			const uOpacity={value:0};
			withPose(m,poseClot,`clot-${seed}`,sh=>{
				sh.uniforms.uColor={value:new T.Color(color)};sh.uniforms.uOpacity=uOpacity;
				sh.vertexShader=sh.vertexShader.replace('#include <common>',()=>'#include <common>\nattribute float pole; varying float vPole;').replace('#include <begin_vertex>',()=>'#include <begin_vertex>\nvPole = pole;');
				// Unlit, as the original ShaderMaterial: the colour itself, faded by a facing term and towards the poles.
				sh.fragmentShader='uniform vec3 uColor; uniform float uOpacity; varying float vPole;\n'+sh.fragmentShader.replace('#include <opaque_fragment>',()=>'float facing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);\noutgoingLight = uColor;\ndiffuseColor.a = uOpacity * facing * facing * (1.0 - smoothstep(0.35, 0.8, abs(vPole)));\n#include <opaque_fragment>');
			});
			const mesh=add(new T.Mesh(g,m),1);return {mesh,uOpacity,opacity};
		};
		const clots=[clot(.021,.03,'#b3262e',7,.42),clot(.0175,.022,'#7e151d',11,.5)];

		// The whole left upper arm, for the camera.
		// Ghost twins now that every shader hook is chained (Engine.prewarm compiles them).
		solids.forEach(s=>disposables.push(ghostTwin(s.own)));

		layerBox=new T.Box3(new T.Vector3().fromArray(atlas.parts[part].bounds[0]),new T.Vector3().fromArray(atlas.parts[part].bounds[1])).expandByScalar(.012);

		// Fragment poses. The head tilts about the shoulder and the shaft about the elbow, so both joints stay seated;
		// the tilts are split so the broken ends meet, then the shaft end is shifted laterally and the gap opened.
		const S=B.clone().addScaledVector(u,-lenA),E=B.clone().addScaledVector(u,lenB),hinge=new T.Vector3().crossVectors(u,lateral).normalize();
		const Mp=poseHead.value,Md=poseShaft.value,tmp=new T.Matrix4(),back=new T.Matrix4();
		const about=(out:T.Matrix4,pivot:T.Vector3,angle:number,offset:number)=>out.makeTranslation(pivot.x+u.x*offset,pivot.y+u.y*offset,pivot.z+u.z*offset).multiply(tmp.makeRotationAxis(hinge,angle)).multiply(back.makeTranslation(-pivot.x,-pivot.y,-pivot.z));
		const p1v=new T.Vector3(),p2v=new T.Vector3();
		const place=(gap:number,shift:number,angle:number)=>{
			const alpha=angle*lenB/(lenA+lenB),beta=angle*lenA/(lenA+lenB)+shift/lenB;
			about(Mp,S,alpha,-gap/2);about(Md,E,-beta,gap/2);
			// The clot rides the midpoint of the two broken ends.
			p1v.copy(B).applyMatrix4(Mp).add(p2v.copy(B).applyMatrix4(Md)).multiplyScalar(.5).sub(B);poseClot.value.makeTranslation(p1v.x,p1v.y,p1v.z);
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

		// The callus's own (unfaded) look and the hematoma amount, from the state; the ghost fade is applied on top of them.
		let lastKey='',lastDay:number|null=null,snapAt:number|null=null,lastFade=-1,hematoma=0;const callusOwn={opacity:1,transparent:true,depthWrite:false};
		apply=(day,frame)=>{
			let changed=false;const state=fractureAt(FRACTURE_DATE,day),now=frame.now,see=frame.systemVisible('skeletal');
			if(day!==lastDay){
				if(day<0)snapAt=null;
				else if(lastDay!==null&&lastDay<0&&state&&frame.direction===1){if(see&&layerBox)ctx.requestFly(layerBox);snapAt=now+(see?SNAP_DELAY:0);}
				lastDay=day;
			}
			const pending=snapAt!==null&&now<snapAt,kick=snapAt===null?1:pending?0:breakKick(now-snapAt),animating=snapAt!==null&&now-snapAt<BREAK_MS;
			if(snapAt!==null&&!animating)snapAt=null;
			const show=!!state&&see;if(group.visible!==show){group.visible=show;changed=true;}
			if(state){
				const key=`${day}|${kick}`,fade=ghostOpacity(frame.ghost),restyle=key!==lastKey;
				if(restyle){
					lastKey=key;changed=true;place(state.gap*kick,state.shift*kick,state.angle*kick);
					// No crack while the snap is pending: the bone is still drawn intact.
					uLine.value=pending?0:state.line;
					const soft=1-state.mineral;callus.visible=state.callus>.004;uCallus.fadeMix.value=state.mineral**2;
					callusOwn.opacity=(.72*soft+state.mineral)*Math.min(1,state.callus*3);callusOwn.depthWrite=state.mineral>.6;
					if(callus.visible)pose(state.callus,smooth(50,200,state.day));
					// Cartilage, then woven bone (a touch darker and matte so the cuff reads), remodelled to plain bone.
					callusMat.color.set(CARTILAGE).lerp(col.set(WOVEN),state.mineral).lerp(col.set(BONE),smooth(50,300,state.day));callusMat.roughness=.62+.1*state.mineral*(1-smooth(50,300,state.day))-.09*state.mineral;
					hematoma=state.hematoma;clots.forEach(k=>{k.mesh.visible=hematoma>.005;});
				}
				if(restyle||fade!==lastFade){
					lastFade=fade;changed=true;solids.forEach(s=>fadeMesh(s.mesh,s.own,frame.ghost));fadeMaterial(callusMat,callusOwn,frame.ghost);
					clots.forEach(k=>{k.uOpacity.value=k.opacity*hematoma*fade;(k.mesh.material as T.Material).depthWrite=fade<1;});// faded: a frontmost surface for the ghost pass (issues/layer-fade.ts)
				}
			}else lastKey='';
			return {changed,animating};
		};
		return true;
	};

	return {
		init,
		update:(day,frame)=>apply?apply(day,frame):{changed:false,animating:false},
		box:()=>layerBox,
		dispose(){if(root&&ctxRef)ctxRef.scene.remove(root);root=null;disposables.forEach(d=>d.dispose());disposables.length=0;},
	};
}
