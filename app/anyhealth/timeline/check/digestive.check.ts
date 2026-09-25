import type {Check} from './harness';
import type {PartFx,Vec3} from '../types';
import {SCRIPTS as AREA,LEAD_DAYS} from '../issues/catalog/digestive';
import {bodyAt} from '../growth/proportions';
import {toDays,fromDays} from '../../health/dates';
import {mergeFx,applyFxPoint} from '../fx/part-fx';

const script=(id:string)=>AREA.find(s=>s.id===id)!;
/** Effects of `id` on the calendar date `date`. */
const onDate=(id:string,date:string)=>{const s=script(id);return s.fxAt(toDays(date)-toDays(s.onset),{body:bodyAt(date),date});};
const at=(id:string,d:number)=>{const s=script(id),date=fromDays(toDays(s.onset)+Math.floor(d));return s.fxAt(d,{body:bodyAt(date),date});};
const partFx=(l:PartFx[],part:string)=>l.filter(f=>f.part===part);
const scaleOf=(l:PartFx[],part:string):Vec3=>partFx(l,part).reduce<Vec3>((a,f)=>f.scale?[a[0]*f.scale[0],a[1]*f.scale[1],a[2]*f.scale[2]]:a,[1,1,1]);
const tintOf=(l:PartFx[],part:string)=>Math.max(0,...partFx(l,part).map(f=>f.tint?.[3]??0));
const isIdentity=(f:PartFx)=>(f.swell??0)===0&&(f.tint?.[3]??0)===0&&(f.scale??[1,1,1]).every(v=>v===1)&&(f.visible??1)===1&&!f.translate&&!f.rotate;
const ENC='encopresis-constipation-childhood',LPR='silent-reflux-lpr-omeprazole',GERD='gerd-diagnosis-pantoprazole-famotidine-2026',FAM='famotidine-nightly-rx-2026';
/** Cited rectal-diameter ratio range, constipated ÷ control: Hamdy 2023 case IQR 3.2–4.0 cm over the control median 2.3 cm. basis: digestive#rectal-diameter-ratio */
const RECTUM_RANGE:[number,number]=[1.39,1.74];
/** Rest-space bounds of a part (union over every mesh with that name) from the decoded atlas. */
const partBox=(g:import('./node-atlas').NodeAtlas,name:string)=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const i of g.indicesOf(name)){const P=g.parts[i].position;for(let v=0;v<P.length;v+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],P[v+k]);hi[k]=Math.max(hi[k],P[v+k]);}}return {lo,hi};};

export const checks:Check[]=[
	// ---- shared area checks ----
	{name:'digestive: no effect before onset',run(c){AREA.forEach(s=>{const d=-((LEAD_DAYS[s.id]??0)+1),date=fromDays(toDays(s.onset)+d);c.assert(s.fxAt(d,{body:bodyAt(date),date}).every(isIdentity),`${s.id} before onset (day ${d})`);});}},
	{name:'digestive: resolved non-chronic issues return to baseline',run(c){AREA.filter(s=>!s.chronic&&!s.layer).forEach(s=>{const d=toDays(s.resolve!)-toDays(s.onset)+60;c.assert(s.fxAt(d,{body:bodyAt(s.resolve!),date:s.resolve!}).every(f=>(f.swell??0)===0&&(f.tint?.[3]??0)===0),`${s.id} after resolve`);});}},
	{name:'digestive: effects ramp (no step > 25% of peak between adjacent hours in the first 3 days)',run(c){
		type M={swell:number;tint:number;scale:number};
		const measure=(l:PartFx[])=>{const m=new Map<string,M>();for(const f of l){const o=m.get(f.part)??{swell:0,tint:0,scale:0};o.swell+=f.swell??0;o.tint=Math.max(o.tint,f.tint?.[3]??0);o.scale=Math.max(o.scale,...(f.scale??[1,1,1]).map(v=>Math.abs(v-1)));m.set(f.part,o);}return m;};
		for(const s of AREA){
			// Peak of each quantity per part over the script's whole life (daily from the lead start through resolve + 60, or a year when chronic), plus the hourly window itself.
			const end=s.resolve?toDays(s.resolve)-toDays(s.onset)+60:365,peak=new Map<string,M>();
			const hourly=Array.from({length:3*24+1},(_,h)=>measure(at(s.id,h/24)));
			const all=[...hourly];for(let d=-(LEAD_DAYS[s.id]??0);d<=end;d++)all.push(measure(at(s.id,d)));
			for(const m of all)for(const [p,o] of m){const q=peak.get(p)??{swell:0,tint:0,scale:0};q.swell=Math.max(q.swell,Math.abs(o.swell));q.tint=Math.max(q.tint,o.tint);q.scale=Math.max(q.scale,o.scale);peak.set(p,q);}
			for(let h=1;h<hourly.length;h++)for(const [p,q] of peak){
				const a=hourly[h-1].get(p)??{swell:0,tint:0,scale:0},b=hourly[h].get(p)??{swell:0,tint:0,scale:0};
				for(const k of ['swell','tint','scale'] as const)if(q[k]>0)c.assert(Math.abs(b[k]-a[k])<=0.25*q[k],`${s.id} ${p} ${k} steps ${(Math.abs(b[k]-a[k])/q[k]*100).toFixed(0)}% of peak at hour ${h}`);
			}
		}
	}},
	// ---- area checks ----
	{name:'digestive: (a) rectum scale peak is within the cited dilation range',run(c){
		const s=script(ENC);let peak=1;for(let d=-LEAD_DAYS[ENC];d<=toDays(s.resolve!)-toDays(s.onset);d++){const sc=scaleOf(at(ENC,d),'Rectum');peak=Math.max(peak,sc[0],sc[2]);}
		c.assert(peak>=RECTUM_RANGE[0]&&peak<=RECTUM_RANGE[1],`rectum radial scale peak ${peak.toFixed(3)} outside [${RECTUM_RANGE}]`);
		c.near(scaleOf(at(ENC,0),'Rectum')[0],peak,1e-9,'the peak is at diagnosis');
	}},
	{name:'digestive: (b) at 2012-12-22 the rectum scale is 1',run(c){const l=onDate(ENC,'2012-12-22');scaleOf(l,'Rectum').forEach((v,k)=>c.near(v,1,1e-12,`rectum scale[${k}]`));c.assert(l.every(isIdentity),'no encopresis effect left');}},
	{name:'digestive: (c) the LPR swell band does not touch the distal 10 cm of the esophagus (applyFxPoint)',async run(c){
		const g=await c.geometry(),{lo,hi}=partBox(g,'Esophagus'),distalTop=lo[1]+0.10;
		const fx=at(LPR,0),band=fx.find(f=>f.part==='Esophagus'&&f.swellBand)?.swellBand;
		c.assert(!!band&&fx.some(f=>f.part==='Esophagus'&&(f.swell??0)>0),'LPR swells a band at diagnosis');
		c.near(band![1],hi[1],0.001,'band top = esophagus rest top');c.near(band![1]-band![0],0.05,1e-6,'band is the top 5 cm');
		c.assert(band![0]-0.005>distalTop,`band (with its 5 mm edge) starts at ${(band![0]-0.005).toFixed(4)}, distal 10 cm ends at ${distalTop.toFixed(4)}`);
		const idx=g.indicesOf('Esophagus'),merged=mergeFx(fx,n=>n==='Esophagus'?idx:[],i=>{const P=g.parts[i].position,l=[Infinity,Infinity,Infinity],h=[-Infinity,-Infinity,-Infinity];for(let v=0;v<P.length;v+=3)for(let k=0;k<3;k++){l[k]=Math.min(l[k],P[v+k]);h[k]=Math.max(h[k],P[v+k]);}return [0,1,2].map(k=>(l[k]+h[k])/2) as Vec3;});
		let n=0;for(const i of idx){const P=g.parts[i].position,N=g.parts[i].normal,r=merged.get(i)!;for(let v=0;v<P.length;v+=3){if(P[v+1]>distalTop)continue;n++;const p:Vec3=[P[v],P[v+1],P[v+2]],o:Vec3=[0,0,0];applyFxPoint(r,p,[N[v]/127,N[v+1]/127,N[v+2]/127],o);c.near(Math.hypot(o[0]-p[0],o[1]-p[1],o[2]-p[2]),0,1e-9,`distal vertex moved (y ${p[1].toFixed(3)})`);}}
		c.assert(n>0,'found distal esophagus vertices');
	}},
	{name:'digestive: rectum pivot and esophagus constants match the atlas rest bounds',async run(c){
		const g=await c.geometry(),r=partBox(g,'Rectum'),piv=partFx(at(ENC,0),'Rectum').find(f=>f.pivot)?.pivot;
		c.assert(!!piv,'rectum fx sets a pivot');c.near(piv![0],(r.lo[0]+r.hi[0])/2,0.001,'pivot x = centre');c.near(piv![1],r.lo[1],0.001,'pivot y = anorectal end');c.near(piv![2],r.lo[2],0.001,'pivot z = posterior wall');
	}},
	{name:'digestive: dilated rectum does not push back into the sacrum or down through the pelvic floor',async run(c){
		const g=await c.geometry(),[i]=g.indicesOf('Rectum'),P=g.parts[i].position,f=partFx(at(ENC,0),'Rectum'),sc=scaleOf(f,'Rectum'),pv=f.find(x=>x.pivot)!.pivot!;
		let z0=Infinity,z1=Infinity,y0=Infinity,y1=Infinity;for(let v=0;v<P.length;v+=3){z0=Math.min(z0,P[v+2]);y0=Math.min(y0,P[v+1]);z1=Math.min(z1,pv[2]+sc[2]*(P[v+2]-pv[2]));y1=Math.min(y1,pv[1]+sc[1]*(P[v+1]-pv[1]));}
		c.assert(z1>=z0-0.0005,`posterior wall moved back ${((z0-z1)*1000).toFixed(1)} mm`);c.assert(y1>=y0-0.0005,`anorectal end moved down ${((y0-y1)*1000).toFixed(1)} mm`);
	}},
	{name:'digestive: encopresis develops over the 6-month lead and recovers through the relapse',run(c){
		c.assert(LEAD_DAYS[ENC]===182,'lead = 6 months');
		const r=(d:number)=>scaleOf(at(ENC,d),'Rectum')[0]-1,pk=r(0);
		c.assert(r(-91)>0&&r(-91)<pk,'half-way through the lead it is partly dilated');
		c.assert(r(90)<0.3*pk&&r(90)>0.2*pk,'about a quarter of the excess is left after 3 months of treatment (Hamdy 2023)');
		const relapse=r(toDays('2010-12-15')-toDays('2010-01-19'));c.assert(relapse>0.25*pk&&relapse<0.5*pk,'relapse re-dilates by the clean-out');
		c.assert(tintOf(onDate(ENC,'2010-12-25'),'Rectum')<0.5*tintOf(onDate(ENC,'2010-12-15'),'Rectum'),'clean-out empties the rectum within days');
		c.assert(r(toDays('2012-06-01')-toDays('2010-01-19'))>0,'still a little dilated at the 9-year visit');
		c.assert(partFx(at(ENC,0),'Descending colon').some(f=>(f.swell??0)>0),'descending colon dilates too');
	}},
	{name:'digestive: LPR tint ≤ 0.35, develops over the year before and fades by 12 weeks',run(c){
		let mx=0;for(let d=-LEAD_DAYS[LPR];d<=120;d++)mx=Math.max(mx,tintOf(at(LPR,d),'Esophagus'));c.assert(mx>0&&mx<=0.35,`LPR tint peak ${mx}`);
		c.assert(tintOf(at(LPR,-180),'Esophagus')>0,'worsening in the year before');c.assert(tintOf(at(LPR,56),'Esophagus')>0,'still visible at 8 weeks');c.assert(tintOf(at(LPR,84),'Esophagus')===0,'gone at 12 weeks');
	}},
	{name:'digestive: GERD fades over the course and hands a very low residual to nightly famotidine',run(c){
		const e=(date:string)=>Math.max(tintOf(onDate(GERD,date),'Esophagus'),tintOf(onDate(FAM,date),'Esophagus'));
		c.assert(tintOf(onDate(GERD,'2026-08-13'),'Stomach')>0,'stomach tinted');c.assert(e('2026-08-28')<0.5*e('2026-08-13'),'fades over the course');
		c.near(e('2026-09-01'),e('2026-09-02'),1e-9,'continuous handoff to famotidine');
		c.assert(script(FAM).chronic===true,'famotidine is chronic');const res=e('2027-06-01');c.assert(res>0&&res<=0.05,`famotidine residual ${res}`);
	}},
];
