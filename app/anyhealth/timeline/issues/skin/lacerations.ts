/** Lacerations: a tapered red cut with suture ticks for the recorded counts, an inflamed halo for the first week, then a pink scar that pales to a permanent faint line. Chin 2010, forehead 2011, right shin 2014. */
import type {Vec3} from '../../types';
import {anchorFor} from '../../../health/anchors';
import {bodyAt} from '../../growth/proportions';
import {hashSeed,mixHex,smooth,type MarkDef,type MarkState} from './marks';
import type {MarksSpec} from './marks-layer';

interface Cut {
	id:string;onset:string;
	/** Physical length, metres. */
	length:number;
	/** Direction in the skin's tangent plane, radians from the body's up. */
	angle:number;
	/** Surface (removable) sutures: count, colour, day removed, physical length across the cut. */
	surface:{n:number;color:number;removeDay:number;across:number};
	/** Buried absorbable sutures (deep layer), drawn under the translucent skin. */
	buried?:{n:number;color:number};
}

const NYLON=0x1c1f24,PROLENE=0x2f55b8,CHROMIC=0xa98452;
const CUTS:Cut[]=[
	// Chin: count and length not recorded; a typical ≤2 cm facial cut at ~5 mm spacing (4 sutures), out on the cited facial day.
	{id:'chin-laceration-er-2010',onset:'2010-04-12',length:.02,angle:Math.PI/2,surface:{n:4,color:NYLON,removeDay:5,across:.004}}, // basis: skin#facial-laceration-length, skin#suture-spacing, skin#suture-removal-face
	// Forehead: three 5-0 nylon sutures, out 3/17/11 (day 4); length from the count at ~5 mm spacing.
	{id:'forehead-laceration-2011',onset:'2011-03-13',length:.015,angle:Math.PI/2,surface:{n:3,color:NYLON,removeDay:4,across:.004}}, // basis: skin#forehead-sutures, skin#suture-spacing
	// Right shin: 8 cm, along the tibia; 7 × 6-0 prolene out 1/31/14 (day 7) + 4 × 4-0 chromic gut in the deep layer.
	{id:'right-shin-laceration-2014',onset:'2014-01-24',length:.08,angle:0,surface:{n:7,color:PROLENE,removeDay:7,across:.005},buried:{n:4,color:CHROMIC}}, // basis: skin#shin-laceration
];

// Healing course (days since onset).
const INFLAMED=7; // basis: skin#inflamed-days
const PINK_FROM=21,PINK_UNTIL=90,PALE_AT=120,PALE_ALPHA=.25; // basis: skin#scar-course
const GUT_STRENGTH=21,GUT_ABSORBED=90; // basis: skin#chromic-gut-absorption
const WOUND=0x9e1b22,HALO=0xe0736b,PINK=0xd98a8f,PALE=0xeadbd3;

function marksFor(c:Cut):MarkDef[]{
	const at=anchorFor({id:c.id,category:'skin'}).hint as Vec3,k=1/bodyAt(c.onset).scale,cos=Math.cos(c.angle),sin=Math.sin(c.angle),seed=hashSeed(c.id),L=c.length;
	const along=(a:number,off=0):[number,number]=>[a*k*cos-off*k*sin,a*k*sin+off*k*cos];
	const base={at,scaleDate:c.onset,angle:c.angle};
	const out:MarkDef[]=[
		{...base,shape:'line',size:[L*1.15,.005,0],depth:.0002,color:HALO,seed,tag:'halo'},
		{...base,shape:'line',size:[L,.0012,.00005],color:WOUND,seed:seed+1,tag:'cut'},
	];
	const s=c.surface;
	for(let i=0;i<s.n;i++){const a=((i+.5)/s.n-.5)*L;out.push({...base,uv:along(a),angle:c.angle+Math.PI/2,shape:'bar',size:[s.across,.0003,.00015],depth:.00045,color:s.color,seed:seed+10+i,tag:'suture'});}
	for(let i=0;i<s.n;i++){const a=((i+.5)/s.n-.5)*L;out.push({...base,uv:along(a,s.across/2),shape:'dome',size:[.0009,.0009,.0005],depth:.00045,color:s.color,seed:seed+30+i,tag:'knot'});}
	for(let i=0;i<(c.buried?.n??0);i++){const a=((i+.5)/c.buried!.n-.5)*L*.9;out.push({...base,uv:along(a),angle:c.angle+Math.PI/2,shape:'bar',size:[.006,.0005,0],depth:-.0015,color:c.buried!.color,seed:seed+50+i,tag:'buried'});}
	return out;
}

function stateFor(c:Cut,marks:MarkDef[]):(d:number)=>MarkState[]{
	return d=>marks.map(m=>{
		if(d<0)return {alpha:0};
		switch(m.tag){
			case 'halo':return {alpha:.55*(1-smooth(INFLAMED-4,INFLAMED,d))};
			case 'cut':{const col=d<INFLAMED?WOUND:d<PINK_UNTIL?mixHex(WOUND,PINK,smooth(INFLAMED,PINK_FROM,d)):mixHex(PINK,PALE,smooth(PINK_UNTIL,PALE_AT,d));return {alpha:1-(1-PALE_ALPHA)*smooth(PINK_UNTIL,PALE_AT,d),color:col};}
			case 'suture':case 'knot':return {alpha:d<c.surface.removeDay?1:0};
			case 'buried':return {alpha:d<GUT_ABSORBED?1-smooth(GUT_STRENGTH,GUT_ABSORBED,d):0};
			default:return {alpha:0};
		}
	});
}

/** Marks spec per laceration id. */
export const LACERATION_MARKS:Record<string,MarksSpec>=Object.fromEntries(CUTS.map(c=>{const marks=marksFor(c);return [c.id,{marks,state:stateFor(c,marks)}];}));

/** Sutures showing (surface ticks plus buried absorbable ones) on day `d` of a laceration. */
export function sutureCount(id:string,d:number){const m=LACERATION_MARKS[id];if(!m)return 0;const st=m.state(d);return m.marks.filter((x,i)=>(x.tag==='suture'||x.tag==='buried')&&st[i].alpha>0).length;}

/** Tracker status line for a laceration. */
export function lacerationStatus(id:string,d:number):string|null{
	const c=CUTS.find(x=>x.id===id);if(!c||d<0)return null;const n=sutureCount(id,d);
	return d<c.surface.removeDay?`Sutured (${n}) · day ${Math.floor(d)}`:d<PINK_FROM?'Sutures out · healing':d<PINK_UNTIL?'Pink scar':'Pale scar';
}
