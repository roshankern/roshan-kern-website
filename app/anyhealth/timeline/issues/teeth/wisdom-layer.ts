/** The four third molars (wisdom teeth), which the atlas lacks: each is a clone of the same-side second molar's rest geometry, scaled 0.9 about its centre and set distal to it along the dental arch (the first → second molar direction) by the second molar's mesiodistal width + 1 mm. They erupt over the ADA third-molar window (#1, the upper right, stays partly impacted, per the record) and are gone from the extraction date on. */
import * as T from 'three';
import type {CustomLayer,LayerContext,LayerFrame} from '../../types';
import {SYSTEMS} from '../../../atlas/anatomy';
import {toDays} from '../../../health/dates';
import {BIRTH_DATE} from '../../../health/types';
import {ERUPT_TRAVEL,ERUPT_SCALE0,progress} from './eruption';

/** Third-molar eruption window, years. */
export const WISDOM_ERUPT:[number,number]=[17,21]; // basis: eyes-teeth#erupt-third-molar
/** Clone scale relative to the second molar. */
export const WISDOM_SCALE=0.9; // basis: eyes-teeth#wisdom-scale
/** Gap between the second molar's distal face and the clone, metres. */
export const WISDOM_GAP=0.001; // basis: eyes-teeth#wisdom-offset
/** Final eruption progress of a partly impacted tooth (#1). */
export const IMPACTED_PROGRESS=0.6; // basis: eyes-teeth#wisdom-impacted

/** Each wisdom tooth: Universal number, arch, the second molar it copies and the first molar that sets the arch direction. */
export const WISDOM=[
	{tooth:1,arch:'upper',second:'Right upper second secondary molar tooth',first:'Right upper first secondary molar tooth',impacted:true},
	{tooth:16,arch:'upper',second:'Left upper second secondary molar tooth',first:'Left upper first secondary molar tooth',impacted:false},
	{tooth:32,arch:'lower',second:'Right lower second secondary molar tooth',first:'Right lower first secondary molar tooth',impacted:false},
	{tooth:17,arch:'lower',second:'Left lower second secondary molar tooth',first:'Left lower first secondary molar tooth',impacted:false},
] as const;

const TOOTH_COLOR=SYSTEMS.find(s=>s.id==='skeletal')!.mesh;
const centreOf=(a:ArrayLike<number>)=>{const c=new T.Vector3();for(let i=0;i<a.length;i+=3)c.set(c.x+a[i],c.y+a[i+1],c.z+a[i+2]);return c.multiplyScalar(3/a.length);};

/** Whether the third molars are drawn `day` days after the extraction date `onset`: from gingival emergence (the start of the ADA window) until the extraction (day 0). Switches and Isolate aside. */
export const wisdomShown=(onset:string,day:number)=>day<0&&(toDays(onset)+day-toDays(BIRTH_DATE))/365.25>=WISDOM_ERUPT[0];

/** A layer for the extraction script with onset `onset` (layer days count from it). */
export function wisdomLayer(onset:string):CustomLayer{
	const teeth:{mesh:T.Mesh;rest:Float32Array;centre:T.Vector3;up:number;cap:number}[]=[];let ctxRef:LayerContext|null=null,last='';
	const place=(t:typeof teeth[number],p:number)=>{
		const k=ERUPT_SCALE0+(1-ERUPT_SCALE0)*p,dy=t.up*ERUPT_TRAVEL*WISDOM_SCALE*(1-p),pos=t.mesh.geometry.getAttribute('position') as T.BufferAttribute,a=pos.array as Float32Array,{x,y,z}=t.centre;
		for(let i=0;i<a.length;i+=3){a[i]=x+(t.rest[i]-x)*k;a[i+1]=y+(t.rest[i+1]-y)*k+dy;a[i+2]=z+(t.rest[i+2]-z)*k;}
		pos.needsUpdate=true;t.mesh.geometry.computeBoundingSphere();
	};
	return {
		init(ctx){
			ctxRef=ctx;const mat=ctx.material({color:TOOTH_COLOR,segment:'head'});
			for(const w of WISDOM){
				const si=ctx.indicesOf(w.second)[0],fi=ctx.indicesOf(w.first)[0],sg=si===undefined?undefined:ctx.restGeometry(si),fg=fi===undefined?undefined:ctx.restGeometry(fi);if(!sg||!fg)return false;
				const src=sg.getAttribute('position').array as Float32Array,c2=centreOf(src),c1=centreOf(fg.getAttribute('position').array as Float32Array);
				const dir=c2.clone().sub(c1).setY(0).normalize();let lo=Infinity,hi=-Infinity;
				for(let i=0;i<src.length;i+=3){const d=(src[i]-c2.x)*dir.x+(src[i+2]-c2.z)*dir.z;lo=Math.min(lo,d);hi=Math.max(hi,d);}
				const centre=c2.clone().addScaledVector(dir,hi-lo+WISDOM_GAP),rest=new Float32Array(src.length);
				for(let i=0;i<src.length;i+=3){rest[i]=centre.x+(src[i]-c2.x)*WISDOM_SCALE;rest[i+1]=centre.y+(src[i+1]-c2.y)*WISDOM_SCALE;rest[i+2]=centre.z+(src[i+2]-c2.z)*WISDOM_SCALE;}
				const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(rest.slice(),3));geo.setAttribute('normal',sg.getAttribute('normal').clone());const idx=sg.getIndex();if(idx)geo.setIndex(idx.clone());geo.computeBoundingSphere();
				const mesh=new T.Mesh(geo,mat);mesh.name=`Third molar #${w.tooth}`;mesh.visible=false;mesh.frustumCulled=false;ctx.scene.add(mesh);
				teeth.push({mesh,rest,centre,up:w.arch==='upper'?1:-1,cap:w.impacted?IMPACTED_PROGRESS:1});
			}
			return true;
		},
		update(day:number,frame:LayerFrame){
			const age=(toDays(onset)+day-toDays(BIRTH_DATE))/365.25,show=wisdomShown(onset,day)&&!frame.hiddenByIsolate&&frame.systemVisible('skeletal');
			const ps=teeth.map(t=>Math.min(t.cap,progress(age,WISDOM_ERUPT))),key=`${show}|${ps.map(p=>p.toFixed(4)).join(',')}`;if(key===last)return {changed:false,animating:false};last=key;
			teeth.forEach((t,i)=>{t.mesh.visible=show;if(show)place(t,ps[i]);});
			return {changed:true,animating:false};
		},
		box(){const b=new T.Box3();teeth.forEach(t=>b.union(new T.Box3().setFromArray(t.rest)));return b.isEmpty()?null:b;},
		dispose(){teeth.forEach(t=>{ctxRef?.scene.remove(t.mesh);t.mesh.geometry.dispose();});teeth.length=0;last='';}, // the material is the engine's (ctx.material) and disposed there
	};
}
