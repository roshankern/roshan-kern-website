import type {Check} from './harness';
export const checks:Check[]=[
	{name:'atlas decodes with the documented rest stature',async run(c){const g=await c.geometry();let top=-Infinity,bottom=Infinity;g.parts.forEach(p=>{for(let i=1;i<p.position.length;i+=3){top=Math.max(top,p.position[i]);bottom=Math.min(bottom,p.position[i]);}});c.near(bottom,0,0.002,'floor');c.near(top,1.7297,0.002,'vertex');}},
];
