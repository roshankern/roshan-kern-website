/** Checks for the v2 director's per-script stop fields (Task 2): `climax`, `approachDays`, `view` on every issue script. Reasons per issue: the "climax-*" rows in docs/anyhealth/timeline-medical-basis/*.md. */
import type {Check} from './harness';
import type {IssueScript,PartFx} from '../types';
import {SCRIPTS,activeWindow,leadDays,scriptFor} from '../issues';
import {fxMagnitude} from '../issues/magnitude';
import {SKIN_MARKS} from '../issues/catalog/skin';
import {ECZEMA_ID} from '../issues/skin/eczema';
import {wisdomShown} from '../issues/teeth/wisdom-layer';
import {FRACTURE_DATE,fractureAt} from '../../fracture/model';
import {bodyAt} from '../growth/proportions';
import {toDays,fromDays} from '../../health/dates';

/** The earliest `today` the timeline can show (chronic windows end there). */
const TODAY='2026-09-26';
const lead=(s:IssueScript)=>leadDays(s.id);
/** Days since onset of the window's end: resolve, or TODAY when chronic. */
const end=(s:IssueScript)=>toDays(activeWindow(s,TODAY).to)-toDays(s.onset);
const at=(s:IssueScript,d:number)=>{const date=fromDays(toDays(s.onset)+Math.floor(d));return s.fxAt(d,{body:bodyAt(date),date});};
/** Σ mark alpha of a skin script's marks layer on day `d` (eczema: the infant patches only, the finding; the palm vesicles are the later dyshidrotic phase). 0 for other scripts. */
const marksAlpha=(id:string,d:number)=>{const m=SKIN_MARKS[id];if(!m)return 0;return m.state(d).reduce((a,x,i)=>a+(id!==ECZEMA_ID||m.marks[i].tag==='patch'?x.alpha:0),0);};
/** The peak measure: fx magnitude (issues/magnitude.ts) plus, for the skin marks layers, Σ mark alpha. */
const measure=(s:IssueScript,d:number)=>fxMagnitude(at(s,d))+marksAlpha(s.id,d);
const shows=(fx:PartFx[])=>fxMagnitude(fx)>0;
/** Samples over the window [−lead, end]: every day, plus every 0.01 day over the first week and within 2 days of the climax (the acute rises are fractions of a day). */
function samples(s:IssueScript){
	const lo=-lead(s),hi=end(s),out:number[]=[];for(let d=Math.ceil(lo);d<=hi;d++)out.push(d);
	const fine=(a:number,b:number)=>{for(let i=Math.ceil(Math.max(a,lo)*100);i<=Math.floor(Math.min(b,hi)*100);i++)out.push(i/100);};
	fine(-1,7);if(s.climax!==undefined)fine(s.climax-2,s.climax+2);return out;
}

/** Scripts whose medically defined climax deliberately sits below 90% of the fx magnitude peak, with the reason. */
export const CLIMAX_NOT_PEAK:Record<string,string>={
	'microcytosis-suspected-thalassemia-2004':'the trait is congenital and constant; the tint steps up at the 2024 confirmation for diagnostic certainty, while this first CBC (the lowest absolute MCV, 55.5) is the first detection of the trait',
	'wisdom-teeth-extraction':'the finding is the layer\'s erupted / impacted third molars, drawn only before the extraction; the fx only tints the healing sockets after it',
	'verruca-vulgaris-2018':'the finding is the three warts on the treatment day; the cantharidin blister that doubles the marks from day 1 is the treatment\'s effect, not the disease',
	'isotretinoin-accutane-course':'a treatment is held where its effect shows (92% of lesions cleared, full cheilitis); the untreated day 0 has the most marks but shows no isotretinoin effect',
};
/** Scripts drawn by a custom layer: whether the layer shows anything on day `d` (days since the script's onset). */
const LAYER_SHOWS:Record<string,(d:number)=>boolean>={
	'left-humerus-fracture-2009':d=>fractureAt(FRACTURE_DATE,d)!==null,
	// No layer or fx of its own: the fracture script's layer draws the callus this record marks (bones.check: 'callus window, no fx').
	'healing-humerus-callus-2009':d=>fractureAt(FRACTURE_DATE,d+toDays('2009-09-25')-toDays(FRACTURE_DATE))!==null,
	'wisdom-teeth-extraction':d=>wisdomShown(scriptFor('wisdom-teeth-extraction')!.onset,d),
	...Object.fromEntries(Object.entries(SKIN_MARKS).map(([id,m])=>[id,(d:number)=>m.state(d).some(x=>x.alpha>0)])),
};
const dateOf=(s:IssueScript)=>fromDays(toDays(s.onset)+Math.floor(s.climax!));

export const checks:Check[]=[
	{name:'every script has a climax',run(c){SCRIPTS.forEach(s=>c.assert(typeof s.climax==='number'&&Number.isFinite(s.climax),`${s.id}: climax ${s.climax}`));}},
	{name:'climax inside the active window (onset − lead … resolve, or … today when chronic)',run(c){
		SCRIPTS.forEach(s=>c.assert(s.climax!>=-lead(s)&&s.climax!<=end(s),`${s.id}: climax ${s.climax} (${dateOf(s)}) outside [${-lead(s)}, ${end(s)}]`));
	}},
	{name:'fx at the climax is non-empty, or the script\'s layer shows there',run(c){
		SCRIPTS.forEach(s=>{
			c.assert(!s.layer||LAYER_SHOWS[s.id],`${s.id}: has a layer but no LAYER_SHOWS entry`);
			c.assert(shows(at(s,s.climax!))||LAYER_SHOWS[s.id]?.(s.climax!),`${s.id}: nothing visible at climax ${s.climax} (${dateOf(s)})`);
		});
	}},
	{name:'climax is at (≥ 90% of) the peak magnitude over the window (fx, + Σ mark alpha for skin layers), or listed in CLIMAX_NOT_PEAK',run(c){
		for(const s of SCRIPTS){
			let peak=0,pd=0;for(const d of samples(s)){const m=measure(s,d);if(m>peak){peak=m;pd=d;}}
			const m=measure(s,s.climax!),ok=m>=0.9*peak-1e-9;
			if(s.id in CLIMAX_NOT_PEAK)c.assert(!ok,`${s.id}: listed in CLIMAX_NOT_PEAK but its climax is at the peak (${m} vs ${peak}); remove it from the list`);
			else c.assert(ok,`${s.id}: magnitude ${m.toFixed(4)} at climax ${s.climax} < 90% of the peak ${peak.toFixed(4)} at day ${pd}`);
		}
		Object.keys(CLIMAX_NOT_PEAK).forEach(id=>c.assert(SCRIPTS.some(s=>s.id===id),`CLIMAX_NOT_PEAK: unknown id ${id}`));
	}},
	{name:'view is a unit vector',run(c){SCRIPTS.forEach(s=>{if(s.view)c.near(Math.hypot(...s.view),1,1e-9,`${s.id} view length`);});}},
	{name:'approachDays > 0 (and ≤ 365), explicit or by the default min(30, climax + lead)',run(c){
		SCRIPTS.forEach(s=>{const a=s.approachDays??Math.min(30,s.climax!+lead(s));c.assert(a>0&&a<=365,`${s.id}: approachDays ${a}`);});
	}},
	{name:'every cited climax basis key has a row in its basis doc',async run(c){
		const fs=await import('node:fs'),cited=new Set<string>();
		for(const area of ['airway','bones','digestive','eyes-teeth','skin','systemic'])for(const m of fs.readFileSync(`app/anyhealth/timeline/issues/catalog/${area}.ts`,'utf8').matchAll(/\b(airway|bones|digestive|eyes-teeth|skin|systemic)#(climax-[a-z0-9-]+)/g))cited.add(`${m[1]}#${m[2]}`);
		c.assert(cited.size>=20,`only ${cited.size} climax keys cited`);
		for(const k of cited){const [area,key]=k.split('#');c.assert(fs.readFileSync(`docs/anyhealth/timeline-medical-basis/${area}.md`,'utf8').includes(`| \`${key}\` |`),`${k}: no row in docs/anyhealth/timeline-medical-basis/${area}.md`);}
	}},
];
