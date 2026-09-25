/** The skin marks CustomLayer, shared by every skin script: small opaque meshes (cuts, sutures, scars, papules, vesicles, warts, patches) laid on the Skin part.
 *
 * - Placement (init, rest space): each mark's hint is projected to the closest point on the Skin mesh; the mark's (rest-space) offset is taken in that point's tangent frame (t1 = the body's up, projected; t2 = normal × t1) and projected again, and every mark vertex is projected too, so a mark hugs the surface. Vertices sit MARK_LIFT (0.3 mm) out along the local normal, or `depth` when a mark is buried under the translucent skin.
 * - Segments: every mark vertex carries the `seg` (segA, segB, weightA) of the Skin vertex nearest it (segOfVertex, read from ctx.restGeometry(skin).getAttribute('seg'), i.e. segments.bin), and the material leaves `segment` unset, so marks follow the blended body warp exactly like the skin under them.
 * - Look (update): the script's pure `state(day)` gives each mark an alpha and colour; the layer rewrites its RGBA vertex colours only when that changes. The Skin part is drawn at opacity 0.1, so marks use their own material (vertex colours, alphaTest) and draw after it.
 * - Size: a mark's physical size is divided by the local warp scale at its segment on `scaleDate` (localScale), so it is life-size on that date.
 * - One mesh per layer, frustumCulled off (the warp moves it far from its rest bounds). Depth test is strict (LessDepth): where two layers draw the same mark (acne and isotretinoin), the second copy is rejected instead of blending twice. */
import * as T from 'three';
import {SEGMENTS,type Body,type CustomLayer,type LayerContext,type LayerFrame,type Rig,type Vec3} from '../../types';
import {bodyAt} from '../../growth/proportions';
import rigJson from '../../growth/rig.json';
import {skinSurface,type SkinSurface,type SurfaceHit} from './surface';
import {MARK_LIFT,rng,type MarkDef,type MarkState} from './marks';

/** What a skin script hands the layer: its marks and their look as a pure function of days since onset. */
export interface MarksSpec {marks:MarkDef[];state(day:number):MarkState[]}
/** Where a mark landed (rest space), for checks and Isolate. */
export interface PlacedMark {def:MarkDef;/** The hint projected onto the Skin. */anchor:Vec3;center:Vec3;normal:Vec3;/** Vertex range in the layer mesh. */start:number;count:number}
export interface MarksLayer extends CustomLayer {
	/** Every placed mark (empty before init). */
	placed():PlacedMark[];
	/** The mesh's rest-space vertex positions (empty before init). */
	positions():Float32Array;
}

const add=(a:Vec3,b:Vec3,s=1):Vec3=>[a[0]+b[0]*s,a[1]+b[1]*s,a[2]+b[2]*s];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:Vec3):Vec3=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
/** Tangent frame at a normal: t1 = +y projected onto the tangent plane (+z where the normal is near vertical), t2 = n × t1. */
function frame(n:Vec3):[Vec3,Vec3]{
	const up:Vec3=Math.abs(n[1])>.9?[0,0,1]:[0,1,0],d=up[0]*n[0]+up[1]*n[1]+up[2]*n[2],t1=norm([up[0]-n[0]*d,up[1]-n[1]*d,up[2]-n[2]*d]);
	return [t1,cross(n,t1)];
}

const AXES=SEGMENTS.map(id=>(rigJson as Rig).segments.find(s=>s.id===id)?.axis??[0,1,0] as Vec3);
/** Local life/rest size ratio at a Skin point on a body, in direction `dir` (unit): body scale × the segment's length factor along its axis and soft-girth factor across it, blended over the point's two segments like the warp. Divide a physical size by it to get the rest size. */
export function localScale(body:Body,seg:Vec3,dir:Vec3):number{
	const f=(i:number)=>{const id=SEGMENTS[i]??'trunk',a=AXES[i]??[0,1,0],c=Math.min(1,Math.abs(dir[0]*a[0]+dir[1]*a[1]+dir[2]*a[2]));return Math.hypot(body.length[id]*c,body.softGirth[id]*Math.sqrt(1-c*c));};
	return body.scale*(seg[2]*f(seg[0])+(1-seg[2])*f(seg[1]));
}

/** Local mark outline: [a (along), b (across), h (height fraction 0..1)] points and triangles, in units of the half-length / half-width. */
function outline(def:MarkDef):{pts:[number,number,number][];tris:number[]}{
	const r=rng(def.seed),pts:[number,number,number][]=[],tris:number[]=[];
	if(def.shape==='line'||def.shape==='bar'){
		const n=Math.max(6,Math.ceil(def.size[0]/.002));
		for(let i=0;i<=n;i++){const t=i/n,w=def.shape==='line'?Math.max(.15,Math.sin(Math.PI*t))**.6:1;pts.push([t*2-1,-w,1],[t*2-1,w,1]);if(i<n){const k=i*2;tris.push(k,k+2,k+1,k+1,k+2,k+3);}}
		return {pts,tris};
	}
	// Radial shapes: centre + rings. Domes rise; discs stay flat (height = size[2] everywhere).
	const seg=def.shape==='rough'?12:10,rings:[number,number][]=def.shape==='disc'?[[.5,1],[1,1]]:[[.35,.93],[.7,.65],[1,0]];
	pts.push([0,0,1]);
	rings.forEach(([rad,h],ri)=>{for(let s=0;s<seg;s++){const a=s/seg*Math.PI*2,j=def.shape==='rough'?.75+r()*.5:def.shape==='disc'&&ri===rings.length-1?.85+r()*.3:1;pts.push([Math.cos(a)*rad*j,Math.sin(a)*rad*j,def.shape==='rough'?h*(.7+r()*.6):h]);}});
	for(let s=0;s<seg;s++)tris.push(0,1+s,1+(s+1)%seg);
	for(let ri=1;ri<rings.length;ri++){const o0=1+(ri-1)*seg,o1=1+ri*seg;for(let s=0;s<seg;s++){const s1=(s+1)%seg;tris.push(o0+s,o1+s,o1+s1,o0+s,o1+s1,o0+s1);}}
	return {pts,tris};
}

/** Builds the mesh data for a list of marks on a Skin surface. Exported for the node checks. */
export function buildMarks(surface:SkinSurface,marks:MarkDef[]):{position:Float32Array;seg:Float32Array;index:number[];placed:PlacedMark[]}{
	const pos:number[]=[],seg:number[]=[],index:number[]=[],placed:PlacedMark[]=[],anchors=new Map<string,SurfaceHit>(),bodies=new Map<string,Body>();
	for(const def of marks){
		let body=bodies.get(def.scaleDate);if(!body){body=bodyAt(def.scaleDate);bodies.set(def.scaleDate,body);}
		const key=def.at.join(',');let ah=anchors.get(key);if(!ah){ah=surface.closest(def.at);anchors.set(key,ah);}
		const [a1,a2]=frame(ah.normal),[u,v]=def.uv??[0,0];let off=add(a1.map(x=>x*u) as Vec3,a2,v);
		if(def.uvPhysical){const l=Math.hypot(...off);if(l>0)off=off.map(x=>x/localScale(body!,surface.segOfVertex(ah!.vertex),norm(off))) as Vec3;}
		const hit=surface.closest(add(ah.point,off)),n=hit.normal,[t1,t2]=frame(n),sg=surface.segOfVertex(hit.vertex);
		const ang=def.angle??0,dir=norm(add(t1.map(x=>x*Math.cos(ang)) as Vec3,t2,Math.sin(ang))),perp=cross(n,dir);
		const hl=def.size[0]/localScale(body,sg,dir)/2,hw=def.size[1]/localScale(body,sg,perp)/2,hh=def.size[2]/localScale(body,sg,n),lift=def.depth??MARK_LIFT,{pts,tris}=outline(def),start=pos.length/3;
		// Project each vertex for anything wider than ~3 mm in rest space; small marks sit flat on the centre's tangent plane.
		const project=Math.max(hl,hw)>.0015;
		for(const [a,b,h] of pts){
			const p=add(add(hit.point,dir,a*hl),perp,b*hw),s=project?surface.closest(p):hit,q=add(project?s.point:p,project?s.normal:n,lift+h*hh);
			pos.push(...q);seg.push(...surface.segOfVertex(s.vertex));
		}
		tris.forEach(t=>index.push(start+t));
		placed.push({def,anchor:ah.point,center:hit.point,normal:n,start,count:pts.length});
	}
	return {position:new Float32Array(pos),seg:new Float32Array(seg),index,placed};
}

// One surface grid per rest Skin geometry, shared by every skin layer.
const surfaces=new WeakMap<T.BufferGeometry,SkinSurface>();
function surfaceOf(rg:T.BufferGeometry):SkinSurface{
	let s=surfaces.get(rg);if(s)return s;const p=rg.getAttribute('position'),nm=rg.getAttribute('normal'),sg=rg.getAttribute('seg');
	s=skinSurface(p.array as ArrayLike<number>,v=>[nm.getX(v),nm.getY(v),nm.getZ(v)],rg.getIndex()!.array as ArrayLike<number>,sg?.array as ArrayLike<number>|undefined);surfaces.set(rg,s);return s;
}

/** A skin marks layer for one script. */
export function marksLayer(spec:MarksSpec):MarksLayer{
	let mesh:T.Mesh|null=null,placed:PlacedMark[]=[],colors:T.BufferAttribute|null=null,lastKey='',lastIn='',scene:T.Scene|null=null;
	const tmp=new T.Color();
	return {
		init(ctx:LayerContext){
			const i=ctx.indicesOf('Skin')[0],rg=i===undefined?undefined:ctx.restGeometry(i);if(!rg||!rg.getIndex())return false;
			const b=buildMarks(surfaceOf(rg),spec.marks);placed=b.placed;
			const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(b.position,3));g.setAttribute('seg',new T.BufferAttribute(b.seg,3));
			colors=new T.BufferAttribute(new Float32Array(b.position.length/3*4),4);g.setAttribute('color',colors);g.setIndex(b.index);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
			const mat=ctx.material({color:0xffffff,soft:true,transparent:true,depthWrite:true});mat.vertexColors=true;mat.alphaTest=.01;mat.roughness=.75;mat.depthFunc=T.LessDepth;mat.needsUpdate=true;
			mesh=new T.Mesh(g,mat);mesh.frustumCulled=false;mesh.renderOrder=2;mesh.visible=false;mesh.matrixAutoUpdate=false;scene=ctx.scene;scene.add(mesh);
			return true;
		},
		update(day:number,f:LayerFrame){
			if(!mesh||!colors)return {changed:false,animating:false};
			// Called every frame: the state is a pure function of the day, so skip it unless the day or visibility moved.
			const on=f.systemVisible('integumentary')&&!f.hiddenByIsolate,input=on?String(day):'off';if(input===lastIn)return {changed:false,animating:false};lastIn=input;
			const states=on?spec.state(day):[];
			const key=on?states.map(s=>`${s.alpha.toFixed(3)}:${s.color??''}`).join('|'):'off';
			if(key===lastKey)return {changed:false,animating:false};lastKey=key;
			const arr=colors.array as Float32Array;let any=false;
			placed.forEach((m,j)=>{const s=states[j]??{alpha:0};tmp.setHex(s.color??m.def.color);if(s.alpha>0)any=true;for(let v=m.start;v<m.start+m.count;v++){arr[v*4]=tmp.r;arr[v*4+1]=tmp.g;arr[v*4+2]=tmp.b;arr[v*4+3]=s.alpha;}});
			colors.needsUpdate=true;mesh.visible=any;
			return {changed:true,animating:false};
		},
		box(){return mesh?.geometry.boundingBox?.clone()??null;},
		dispose(){if(mesh){scene?.remove(mesh);mesh.geometry.dispose();}mesh=null;colors=null;placed=[];lastKey=lastIn='';},
		placed:()=>placed,
		positions:()=>(mesh?.geometry.getAttribute('position').array as Float32Array|undefined)??new Float32Array(0),
	};
}
