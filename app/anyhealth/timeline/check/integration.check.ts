/** Task 14 integration checks: the real engine in node (check/engine-node.ts) with every area's scripts, growth and the warp merged. */
import type {Check} from './harness';
import {DEFAULT_VISIBLE} from '../../atlas/anatomy';
import {nodeEngine} from './engine-node';
import {SCRIPTS} from '../issues';
import {bodyAt} from '../growth/proportions';
import {toDays,fromDays} from '../../health/dates';
import {mergeFx} from '../fx/part-fx';
import {LEAD_DAYS as boneLead} from '../issues/catalog/bones';
import {LEAD_DAYS as airwayLead} from '../issues/catalog/airway';
import {LEAD_DAYS as digestiveLead} from '../issues/catalog/digestive';
import {LEAD_DAYS as skinLead} from '../issues/catalog/skin';

const LEAD:Record<string,number>={...boneLead,...airwayLead,...digestiveLead,...skinLead},TODAY='2026-09-25';
const frame=(date:string,now=0,isolate:string|null=null)=>({date,visible:DEFAULT_VISIBLE,isolate,now});

export const checks:Check[]=[
	{name:'eruptionFx is wired: a permanent first molar is hidden at 2 y and shown at 17 y (final fx visibility)',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),i=g.indicesOf('Left upper first secondary molar tooth')[0];c.assert(i!==undefined,'tooth part');
		engine.update(frame('2005-06-22'));c.assert(engine.partVisible(i)===0,`age 2: visible ${engine.partVisible(i)}`);
		engine.update(frame('2020-06-22'));c.assert(engine.partVisible(i)===1,`age 17: visible ${engine.partVisible(i)}`);
	}},
	{name:'partVisible is the final row-0 visibility: switches, Isolate and PartFx visible all apply',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),heart=g.indicesOf('Heart')[0]??g.atlas.parts.findIndex(p=>p.system==='cardiac'),hum=g.indicesOf('Left humerus').find(i=>g.atlas.parts[i].system==='skeletal')!;
		engine.update(frame('2012-01-01'));c.assert(engine.partVisible(heart)===1&&engine.partVisible(hum)===1,'all on');
		engine.update({...frame('2012-01-01'),visible:['skeletal']});c.assert(engine.partVisible(heart)===0,'cardiac switched off');
		engine.update(frame('2009-09-10'));c.assert(engine.partVisible(hum)===0,'fracture hides the atlas humerus (its layer draws the fragments)');
	}},
	{name:'default pivots (restCenter) come from the decoded vertices: every part\'s lies inside its decoded bounds',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),bad:string[]=[];
		g.parts.forEach((d,i)=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let k=0;k<d.position.length;k+=3)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],d.position[k+j]);hi[j]=Math.max(hi[j],d.position[k+j]);}
			const r=engine.restCenter(i);if(!r.every((v,j)=>v>=lo[j]-1e-6&&v<=hi[j]+1e-6))bad.push(g.atlas.parts[i].name);});
		c.assert(!bad.length,`${bad.length} rest centres outside their decoded bounds: ${bad.slice(0,6).join(', ')}`);
		for(const name of ['Right cornea','Right sclera','Suspensory ligament of right lens']){const i=g.indicesOf(name)[0],d=g.parts[i],ctr=[0,1,2].map(j=>{let lo=Infinity,hi=-Infinity;for(let k=j;k<d.position.length;k+=3){lo=Math.min(lo,d.position[k]);hi=Math.max(hi,d.position[k]);}return (lo+hi)/2;});
			engine.restCenter(i).forEach((v,j)=>c.near(v,ctr[j],1e-6,`${name} centre axis ${j}`));}
	}},
	{name:'a layer whose init fails drops its script\'s visible:0 fx (the humerus stays when the fracture layer cannot build)',async run(c){
		const g=await c.geometry(),hum=g.indicesOf('Left humerus').find(i=>g.atlas.parts[i].system==='skeletal')!;
		const {engine}=nodeEngine(g,{skip:['Left humerus']});engine.update(frame('2009-09-10'));c.assert(engine.partVisible(hum)===1,`humerus visible ${engine.partVisible(hum)} with no fracture layer`);
	}},
	{name:'swellBand overlaps: scripts carrying different bands on one part on the same date are listed, and the merge keeps the union',async run(c){
		// Every script sampled every 6 h from its lead to 30 days past resolve (today when chronic); bands grouped by sample time and part.
		const STEP=0.25,at=new Map<number,{id:string;part:string;band:[number,number]}[]>(),bodies=new Map<string,ReturnType<typeof bodyAt>>();
		for(const s of SCRIPTS){const o=toDays(s.onset),a=o-(LEAD[s.id]??0)-2,b=toDays(s.chronic||!s.resolve?TODAY:s.resolve)+30;
			for(let t=Math.floor(a/STEP)*STEP;t<=b;t+=STEP){const date=fromDays(Math.floor(t));let body=bodies.get(date);if(!body){body=bodyAt(date);bodies.set(date,body);}
				for(const f of s.fxAt(t-o,{body,date}))if(f.swellBand){const l=at.get(t)??[];l.push({id:s.id,part:f.part,band:f.swellBand});at.set(t,l);}}}
		const pairs=new Map<string,{from:number;to:number;merged:[number,number]}>();
		for(const [t,l] of at)for(let i=0;i<l.length;i++)for(let j=i+1;j<l.length;j++){const x=l[i],y=l[j];if(x.id===y.id||x.part!==y.part||(x.band[0]===y.band[0]&&x.band[1]===y.band[1]))continue;
			const warn=console.warn;console.warn=()=>{};let m;try{m=mergeFx([{part:x.part,swell:1e-3,swellBand:x.band},{part:y.part,swell:1e-3,swellBand:y.band}],()=>[0],()=>[0,0,0]).get(0)!.swellBand!;}finally{console.warn=warn;}
			c.assert(m[0]===Math.min(x.band[0],y.band[0])&&m[1]===Math.max(x.band[1],y.band[1]),`${x.id} + ${y.id}: merged band ${m} is not the union`);
			const k=`${x.id} + ${y.id} on ${x.part}`,p=pairs.get(k);pairs.set(k,{from:Math.min(p?.from??t,t),to:Math.max(p?.to??t,t),merged:m});}
		console.log(`     scripts carrying a swellBand: ${[...new Set([...at.values()].flat().map(e=>`${e.id} [${e.band.map(v=>v.toFixed(4))}]`))].join("; ")}`);console.log(`     swellBand overlapping pairs: ${pairs.size?'':'none'}`);
		for(const [k,p] of pairs)console.log(`       ${k}: ${fromDays(Math.floor(p.from))} .. ${fromDays(Math.floor(p.to))}, merged band [${p.merged.map(v=>v.toFixed(4)).join(', ')}]`);
	}},
	{name:'isolateBox settles first when the date changed since the last settle',async run(c){
		const g=await c.geometry(),A=nodeEngine(g).engine,B=nodeEngine(g).engine,id='left-humerus-fracture-2009';
		A.update(frame('2020-01-01'));A.settle();A.update(frame('2009-09-10'));const a=A.isolateBox(id)!;
		B.update(frame('2009-09-10'));B.settle();const b=B.isolateBox(id)!;
		for(const k of ['min','max'] as const)for(const ax of ['x','y','z'] as const)c.near(a[k][ax],b[k][ax],1e-9,`${k}.${ax}`);
	}},
	{name:'settle re-warps only parts whose fx or warp changed, with the same result as a full settle',async run(c){
		const g=await c.geometry(),A=nodeEngine(g),B=nodeEngine(g),n=g.atlas.parts.length;
		A.engine.update(frame('2026-03-01'));c.assert(A.engine.settle()===n,'first settle re-warps every part');c.assert(A.engine.settle()===0,'nothing changed: none');
		A.engine.update(frame('2026-03-02'));const k=A.engine.settle();c.assert(k<n*0.05,`adult body held, walnut reaction fading: ${k} of ${n}`);
		B.engine.update(frame('2026-03-02'));B.engine.settle();
		A.bounds.forEach((b,i)=>{for(const key of ['min','max'] as const)for(const ax of ['x','y','z'] as const)c.near(b[key][ax],B.bounds[i][key][ax],1e-9,`${g.atlas.parts[i].name} ${key}.${ax}`);});
		A.engine.update(frame('2012-01-01'));c.assert(A.engine.settle()>n*0.9,'a child date re-warps nearly everything');
	}},
	{name:'seg attribute is 3 bytes per vertex (segA, segB, weightA·255, not normalized); layers still get a float seg (weightA 0..1)',async run(c){
		const g=await c.geometry(),{engine}=nodeEngine(g),fs=await import('node:fs'),bin=fs.readFileSync('public/anyhealth/models/segments.bin');let off=0,bytes=0;
		g.atlas.parts.forEach((p,i)=>{const a=engine.segAttribute(i);bytes+=a.array.byteLength;c.assert(a.array instanceof Uint8Array&&a.itemSize===3&&!a.normalized,`${p.name}: ${a.array.constructor.name}×${a.itemSize}`);
			if(i%97===0)for(let v=0;v<p.vertexCount;v+=13){c.assert(a.array[v*3]===(bin[off+v*2]&15)&&a.array[v*3+1]===bin[off+v*2]>>4&&a.array[v*3+2]===bin[off+v*2+1],`${p.name} vertex ${v}`);}off+=p.vertexCount*2;});
		c.assert(bytes===off/2*3,`seg bytes ${bytes}`);
		// The skin marks layers copy the nearest Skin vertex's seg from ctx.restGeometry(skin): it must still be float with weightA in 0..1.
		const {scene}=nodeEngine(g);let marks=0;scene.traverse(o=>{const a=(o as import('three').Mesh).geometry?.getAttribute?.('seg');if(!a)return;marks++;c.assert(a.array instanceof Float32Array,'layer seg is float');let w=0;for(let v=2;v<a.array.length;v+=3)w=Math.max(w,a.array[v]);c.assert(w>0&&w<=1,`layer weights 0..1 (max ${w})`);});
		c.assert(marks>0,'some layer carries a per-vertex seg');
	}},
];
