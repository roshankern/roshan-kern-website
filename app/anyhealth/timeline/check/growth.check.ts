import type {Check} from './harness';
import {SEGMENTS,type Rig} from '../types';
import {bodyAt,LAST_MEASURED,BMI_REF} from '../growth/proportions';
import {growthFx,GLOBE_CENTRE} from '../growth/organs';
import {toDays,fromDays} from '../../health/dates';
import growth from '../../health/growth.json';
import rigJson from '../growth/rig.json';
import {warpState,warpPoint} from '../growth/warp';
import {SOFT_SYSTEMS} from '../engine';
import type {Vec3} from '../types';

const R=rigJson as Rig,seg=(id:string)=>R.segments.find(s=>s.id===id)!;
const thighRest=seg('lThigh').length,shankRest=seg('lShank').length;
/** The model's rest head height, vertex to menton (the rig's head segment runs from the atlanto-occipital joint, so it is not the head height). */
async function headRestOf(c:Parameters<Check['run']>[0]):Promise<number>{const g=await c.geometry();let lo=Infinity;for(const i of g.indicesOf('Mandible')){const p=g.parts[i].position;for(let k=1;k<p.length;k+=3)lo=Math.min(lo,p[k]);}return R.stature-lo;}
const fxOf=(d:string,part:string)=>growthFx(bodyAt(d)).find(x=>x.part===part)?.scale?.[0]??1;

export const checks:Check[]=[
	{name:'atlas decodes with the documented rest stature',async run(c){const g=await c.geometry();let top=-Infinity,bottom=Infinity;g.parts.forEach(p=>{for(let i=1;i<p.position.length;i+=3){top=Math.max(top,p.position[i]);bottom=Math.min(bottom,p.position[i]);}});c.near(bottom,0,0.002,'floor');c.near(top,1.7297,0.002,'vertex');}},
	{name:'bodyAt reproduces every measurement within 0.5%',run(c){for(const g of growth as {date:string;heightCm?:number;weightKg?:number}[]){const b=bodyAt(g.date);if(g.heightCm)c.near(b.statureM*100,g.heightCm,g.heightCm*0.005,`height ${g.date}`);if(g.weightKg)c.near(b.weightKg,g.weightKg,g.weightKg*0.005,`weight ${g.date}`);}}},
	{name:'warped stature (highest warped vertex, floor = the warp ground) matches every measured height within 0.02%',async run(c){
		// Task 14: stricter than the 0.1% asked for; renormalise solves on the real warp (warpState / warpPoint), so only a change of which vertex is highest can leave an error.
		const g=await c.geometry(),fs=await import('node:fs'),bin=fs.readFileSync('public/anyhealth/models/segments.bin'),top:{p:Vec3;a:number;b:number;w:number;soft:boolean}[]=[];let off=0;
		g.parts.forEach((part,i)=>{const n=part.position.length/3,soft=SOFT_SYSTEMS.includes(g.atlas.parts[i].system);for(let v=0;v<n;v++)if(part.position[v*3+1]>1.70)top.push({p:[part.position[v*3],part.position[v*3+1],part.position[v*3+2]],a:bin[off+v*2]&15,b:bin[off+v*2]>>4,w:bin[off+v*2+1]/255,soft});off+=n*2;});
		let worst=0,at='';const q:Vec3=[0,0,0];
		for(const m of growth as {date:string;heightCm?:number}[]){if(!m.heightCm)continue;const b=bodyAt(m.date),ws=warpState(R,b);let hi=-Infinity;for(const t of top){warpPoint(ws,t.p,t.a,t.b,t.w,t.soft,q);hi=Math.max(hi,q[1]);}
			const e=Math.abs(hi/(m.heightCm/100)-1);if(e>worst){worst=e;at=m.date;}}
		c.assert(worst<=0.0002,`worst warped stature error ${(worst*100).toFixed(4)}% at ${at}`);
	}},
	{name:'bodyAt clamps before birth and after the last measurement',run(c){c.near(bodyAt('2000-01-01').statureM,bodyAt('2003-06-22').statureM,1e-9,'before birth');c.near(bodyAt('2030-01-01').statureM,bodyAt('2026-01-02').statureM,1e-9,'future');c.assert(LAST_MEASURED==='2026-01-02','last measurement date');c.near(bodyAt('2030-01-01').length.head,bodyAt('2026-01-02').length.head,1e-12,'future proportions');}},
	{name:'head ratio: ~1/4 of stature at birth, ~1/8 adult',async run(c){const headRest=await headRestOf(c);c.near(headRest,0.23,0.01,'model head height');const head=(d:string)=>{const b=bodyAt(d);return b.length.head*b.scale*headRest/b.statureM;};c.near(head('2003-06-22'),0.25,0.02,'birth');c.near(head('2026-01-02'),headRest/1.7297,0.005,'adult = model');}},
	{name:'leg ratio grows from ~0.32 at birth to adult',run(c){const leg=(d:string)=>{const b=bodyAt(d);return (b.length.lThigh*thighRest+b.length.lShank*shankRest)*b.scale/b.statureM;};c.near(leg('2003-06-22'),0.32,0.03,'birth');c.near(leg('2026-01-02'),(thighRest+shankRest)/R.stature,0.01,'adult = model');c.assert(leg('2003-06-22')<leg('2008-06-22')&&leg('2008-06-22')<leg('2014-06-22'),'legs lengthen relative to stature');}},
	{name:'adult body reproduces the model exactly',run(c){const b=bodyAt('2026-01-02');c.near(b.scale,1.803/R.stature,1e-6,'scale');for(const s of SEGMENTS){c.near(b.length[s],1,1e-9,`length ${s}`);c.near(b.boneGirth[s],1,1e-9,`bone ${s}`);c.near(b.softGirth[s],1,1e-9,`soft ${s}`);}}},
	// Soft girth is anchored to the adult model (1 on the last date, BMI 22.3 vs reference 23.0), so the test is relative: a leaner-than-reference date has thinner soft tissue than the bone girth and than a date near the reference.
	{name:'soft girth follows measured BMI against the reference',run(c){const sb=(d:string)=>{const b=bodyAt(d);return b.softGirth.lThigh/b.boneGirth.lThigh;};const dev=(d:string,cm:number,kg:number)=>{const bmi=kg/(cm/100)**2,r=BMI_REF(bodyAt(d).ageYears);return (bmi-r)/r;};
		c.assert(dev('2015-06-24',144.1,29.9)<-0.15&&sb('2015-06-24')<0.95,`lean at 12 y (BMI 14.4 vs ref ~17.8): soft < bone, got ${sb('2015-06-24')}`);
		c.assert(Math.abs(dev('2024-05-24',180.3,73.5))<0.03&&sb('2024-05-24')>1,`near reference at 21 y (BMI 22.6): soft > bone, got ${sb('2024-05-24')}`);
		c.assert(sb('2003-07-21')<sb('2003-12-22'),'newborn lean dip (BMI 12.1) thinner than at 6 mo (BMI 16.4)');
		c.assert(sb('2021-06-22')<sb('2022-06-23'),'weight gain 18→19 y (BMI 18.2→21.6) thickens soft tissue');}},
	{name:'segment factors are continuous day to day (no jump > 0.5%)',run(c){let prev=bodyAt('2003-06-22');for(let d=1;d<8500;d+=1){const b=bodyAt(fromDays(toDays('2003-06-22')+d));for(const s of SEGMENTS){c.assert(Math.abs(b.length[s]-prev.length[s])<0.005,`${s} jump at ${b.date}`);}prev=b;}}},
	{name:'thymus peaks in childhood, eyes reach adult size, testes grow in puberty',run(c){
		c.assert(fxOf('2013-01-01','Left lobe of thymus')>fxOf('2026-01-01','Left lobe of thymus'),'thymus involutes');
		c.near(fxOf('2026-01-01','Left sclera'),1,0.02,'adult eye');
		// A newborn eye is ~71% of adult axial length while the warped newborn head is ~55-60% of adult size, so relative to the warp the infant eye is LARGER (fx > 1); the absolute size is what must be small.
		const b0=bodyAt('2003-06-22'),bA=bodyAt('2026-01-02'),loc=(b:typeof b0)=>b.scale*Math.cbrt(b.length.head*b.boneGirth.head**2);
		const abs0=fxOf('2003-06-22','Left sclera')*loc(b0)/loc(bA);c.assert(abs0<0.8,`infant eye smaller in absolute size: ${abs0}`);c.near(abs0,16.8/23.82,0.01,'infant eye = axial length ratio');
		c.assert(fxOf('2012-01-01','Left testis')<fxOf('2020-01-01','Left testis'),'puberty');
		c.assert(fxOf('2008-01-01','Glans penis')<fxOf('2020-01-01','Glans penis'),'penis grows in puberty');
	}},
	{name:'growthFx names exist in the atlas and eye parts pivot on the globe centre',async run(c){const g=await c.geometry();const fx=growthFx(bodyAt('2008-01-01'));for(const f of fx)c.assert(g.indicesOf(f.part).length>0,`no atlas part ${f.part}`);
		for(const side of ['Left','Right'] as const){let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const i of g.indicesOf(`${side} sclera`)){const p=g.parts[i].position;for(let k=0;k<p.length;k+=3)for(let j=0;j<3;j++){lo[j]=Math.min(lo[j],p[k+j]);hi[j]=Math.max(hi[j],p[k+j]);}}
			const ctr=[0,1,2].map(j=>(lo[j]+hi[j])/2),gc=GLOBE_CENTRE[side];for(let j=0;j<3;j++)c.near(gc[j],ctr[j],0.001,`${side} globe centre axis ${j}`);
			for(const f of fx.filter(f=>f.part.includes(side.toLowerCase()+' ')||f.part.startsWith(side+' '))){if(!/sclera|cornea|lens|iris|choroid|vitreous|retina|chamber|ciliaris/.test(f.part))continue;c.assert(f.pivot&&f.pivot.every((v,j)=>v===gc[j]),`${f.part} pivots on the globe`);}
		}
	}},
];
