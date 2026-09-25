import type {Check} from './harness';
import type {Quat,Vec3} from '../types';
import {mergeFx,applyFxPoint,identityFx,createFxTexture,writeFx,FX_ROWS} from '../fx/part-fx';
const near3=(c:Parameters<Check['run']>[0],a:Vec3,b:Vec3,tol:number,msg:string)=>{c.near(a[0],b[0],tol,`${msg} x`);c.near(a[1],b[1],tol,`${msg} y`);c.near(a[2],b[2],tol,`${msg} z`);};
export const checks:Check[]=[
	{name:'mergeFx combines by the documented rules',run(c){
		const idx=(n:string)=>n==='A'?[0]:[];const m=mergeFx([{part:'A',visible:0.5,swell:0.001,scale:[2,1,1],tint:[1,0,0,0.3]},{part:'A',visible:0.5,swell:0.002,scale:[1.5,1,1],tint:[0,0,1,0.6],translate:[0,0.01,0]}],idx,()=>[0,0,0]).get(0)!;
		c.near(m.visible,0.25,1e-9,'visible');c.near(m.swell,0.003,1e-9,'swell');c.near(m.scale[0],3,1e-9,'scale');c.near(m.tint[2],1,1e-9,'tint winner');c.near(m.translate[1],0.01,1e-9,'translate');
		// pivot: first specified, else the rest centre; swellBand: first specified; rotate: quaternion product in list order (90° about z, then 90° about x).
		const s=Math.SQRT1_2,qz:Quat=[0,0,s,s],qx:Quat=[s,0,0,s];
		const m2=mergeFx([{part:'A',swell:0.001},{part:'A',pivot:[1,2,3],swellBand:[0.1,0.2],rotate:qz},{part:'A',pivot:[9,9,9],swellBand:[0.5,0.6],rotate:qx}],idx,()=>[7,7,7]).get(0)!;
		near3(c,m2.pivot,[1,2,3],1e-12,'pivot');c.assert(m2.swellBand?.[0]===0.1&&m2.swellBand[1]===0.2,'swellBand first');
		const r=applyFxPoint({...identityFx([0,0,0]),rotate:m2.rotate},[1,0,0],[0,0,1],[0,0,0]);near3(c,r,[0,0,1],1e-9,'qx·qz: qz first (listed first), then qx');
		c.near(mergeFx([{part:'A',swell:0.001}],idx,()=>[7,7,7]).get(0)!.pivot[0],7,1e-12,'pivot default = rest centre');c.assert(mergeFx([{part:'B',swell:1}],idx,()=>[0,0,0]).size===0,'unknown part ignored');
	}},
	{name:'identity fx leaves points unchanged; scale about pivot keeps the pivot fixed',run(c){
		const out:Vec3=[0,0,0];for(const p of [[0,1,0],[0.2,1.3,-0.1],[1,1,1]] as Vec3[]){applyFxPoint(identityFx([0.5,0.5,0.5]),p,[0,1,0],out);near3(c,out,p,1e-12,'identity');}
		const f={...identityFx(),pivot:[1,1,1] as Vec3,scale:[2,2,2] as Vec3};
		near3(c,applyFxPoint(f,[1,1,1],[1,0,0],out),[1,1,1],1e-12,'pivot fixed');near3(c,applyFxPoint(f,[2,1,1],[1,0,0],out),[3,1,1],1e-12,'scaled away from pivot');
		const p:Vec3=[2,1,1];applyFxPoint({...f,translate:[0,0.01,0]},p,[1,0,0],p);near3(c,p,[3,1.01,1],1e-12,'out may alias p, translate added');
	}},
	{name:'swellBand only swells inside the band',run(c){
		const f={...identityFx(),swell:0.004,swellBand:[1.0,1.1] as [number,number]},n:Vec3=[0,0,1],out:Vec3=[0,0,0];
		near3(c,applyFxPoint(f,[0,1.05,0],n,out),[0,1.05,0.004],1e-12,'inside the band moves by swell along n');
		near3(c,applyFxPoint(f,[0,1.12,0],n,out),[0,1.12,0],1e-12,'2 cm above the band does not move');near3(c,applyFxPoint(f,[0,0.98,0],n,out),[0,0.98,0],1e-12,'2 cm below the band does not move');
		near3(c,applyFxPoint({...f,swellBand:null},[0,0.5,0],n,out),[0,0.5,0.004],1e-12,'no band swells everywhere');
		const e=applyFxPoint(f,[0,1.1025,0],n,out)[2];c.assert(e>0&&e<0.004,`smooth edge (half-way into the 5 mm edge: ${e})`);
	}},
	{name:'the fx texture packs rows as documented, identity for absent parts',run(c){
		const t=createFxTexture(3);c.assert(t.width===4&&t.data.length===4*FX_ROWS*4,'size');
		const fx={...identityFx([1,2,3]),visible:0.5,swell:0.01,swellBand:[0.1,0.2] as [number,number],tint:[1,0,0,0.5] as [number,number,number,number],rotate:[0,0,1,0] as Quat,scale:[2,3,4] as Vec3,translate:[5,6,7] as Vec3};
		c.assert(writeFx(t,new Map([[1,fx]])),'changed');c.assert(!writeFx(t,new Map([[1,fx]])),'unchanged on rewrite');
		const at=(row:number,col:number)=>[...t.data.slice((row*t.width+col)*4,(row*t.width+col)*4+4)];
		c.assert(JSON.stringify([0,1,2,3,4,5].map(r=>at(r,1)))===JSON.stringify([[0.5,0.01,0.1,0.2].map(Math.fround),[1,0,0,0.5],[1,2,3,0],[0,0,1,0],[2,3,4,0],[5,6,7,0]]),`column 1: ${JSON.stringify([0,1,2,3,4,5].map(r=>at(r,1)))}`);
		c.assert(JSON.stringify([0,1,3,4,5].map(r=>at(r,2)))===JSON.stringify([[1,0,0,0],[0,0,0,0],[0,0,0,1],[1,1,1,0],[0,0,0,0]]),'column 2 identity');
	}},
];
