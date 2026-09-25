import type {Check} from './harness';
import rig from '../growth/rig.json';
import {SEGMENTS,type Rig} from '../types';
const R=rig as Rig;
export const checks:Check[]=[
	{name:'rig has all 15 segments with parents first',run(c){c.assert(R.segments.length===15,'count');R.segments.forEach((s,i)=>{c.assert(s.id===SEGMENTS[i],`order ${s.id}`);if(s.parent)c.assert(SEGMENTS.indexOf(s.parent)<i,`parent before ${s.id}`);});}},
	{name:'rig is left/right symmetric within 1.5 cm',run(c){for(const [l,r] of [['lUpperArm','rUpperArm'],['lForearm','rForearm'],['lThigh','rThigh'],['lShank','rShank'],['lHand','rHand'],['lFoot','rFoot']] as const){const a=R.segments.find(s=>s.id===l)!,b=R.segments.find(s=>s.id===r)!;c.near(a.joint[0],-b.joint[0],0.015,`${l} x`);c.near(a.joint[1],b.joint[1],0.015,`${l} y`);c.near(a.length,b.length,0.015,`${l} length`);}}},
	{name:'adult segment lengths are anatomically plausible',run(c){const L=(id:string)=>R.segments.find(s=>s.id===id)!.length;c.near(L('lUpperArm'),0.30,0.04,'humerus');c.near(L('lThigh'),0.44,0.05,'femur');c.near(L('lShank'),0.39,0.05,'tibia');c.near(R.stature,1.7297,0.003,'stature');}},
	{name:'segments.bin covers every vertex',async run(c){const g=await c.geometry();const fs=await import('node:fs');const n=fs.statSync('public/anyhealth/models/segments.bin').size;c.assert(n===g.parts.reduce((s,p)=>s+p.position.length/3,0)*2,'size');}},
];
