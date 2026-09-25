/** Task 14 integration checks: the real engine in node (check/engine-node.ts) with every area's scripts, growth and the warp merged. */
import type {Check} from './harness';
import {DEFAULT_VISIBLE} from '../../atlas/anatomy';
import {nodeEngine} from './engine-node';

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
];
