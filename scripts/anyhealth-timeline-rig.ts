// Builds the AnyHealth timeline rig and per-vertex segment weights from the rest-pose atlas: npx tsx scripts/anyhealth-timeline-rig.ts
// Writes app/anyhealth/timeline/growth/rig.json (a Rig) and public/anyhealth/models/segments.bin
// (per atlas part in order, vertexCount × 3 bytes: byte0 = segA | segB<<4, byte1 = round(weightA*255), byte2 = round(dBone / 0.5 mm), the rest distance to the nearest bone point, capped at 255).
// Weights (Task 14a): parent/child blends are centred on their joint plane (smoothstep over ±PLANE_B along the child axis), fading to the nearest-bone weight where one bone clearly owns the tissue (dB − dA from FADE[0] to FADE[1]).
import fs from 'node:fs';
import {loadAtlasNode} from '../app/anyhealth/timeline/check/node-atlas';
import {boneSegment} from '../app/anyhealth/timeline/growth/segment-map';
import {SEGMENTS,type Rig,type SegmentId,type Vec3} from '../app/anyhealth/timeline/types';

const RIG_OUT='app/anyhealth/timeline/growth/rig.json',BIN_OUT='public/anyhealth/models/segments.bin';
/** Contact radius for joints, widened step by step if two bones never come that close. */
const CONTACT=[0.006,0.008,0.010,0.012];
/** Weights (Task 14a). GRID: voxel size of the per-segment distance fields. Per joint, the child-side indicator is smoothstep(−ANG, ANG, cos of the angle from the child axis at the joint) (the joint plane, scale-free),
 * faded (FADE on |r|) into smoothstep(−RQ, RQ, r), r = (d_parent − d_child subtree)/(sum), the nearest-bone ratio; SQ gates siblings apart. Overridable for sweeps via ANYHEALTH_<NAME> (FADE as "lo,hi"). */
const env=(k:string,d:number)=>Number(process.env[`ANYHEALTH_${k}`]??d);
const GRID=env('GRID',0.005),ANG=env('ANG',0.5),RQ=env('RQ',0.5),SQ=env('SQ',0.3),FADE=(process.env.ANYHEALTH_FADE??'0.3,0.6').split(',').map(Number);
/** dBone byte unit (metres); matches D_UNIT in growth/warp.ts. */
const D_UNIT=0.0005;
const NS=SEGMENTS.length,SEG=(id:SegmentId)=>SEGMENTS.indexOf(id);
const r5=(v:number)=>Math.round(v*1e5)/1e5;
const smoothstep=(a:number,b:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

async function main(){
	const t0=Date.now(),A=await loadAtlasNode(),{atlas,parts}=A;
	console.log(`atlas: ${parts.length} parts, ${parts.reduce((s,p)=>s+p.position.length/3,0)} vertices (${Date.now()-t0} ms)`);

	// Skeletal parts that intentionally stay unmapped (tendons, muscles filed under skeletal, nose cartilage).
	const unmapped=[...new Set(atlas.parts.filter(p=>p.system==='skeletal'&&!boneSegment(p.name)).map(p=>p.name))];
	console.log(`skeletal parts with no bone segment (weighted by proximity): ${unmapped.length}\n  ${unmapped.join('\n  ')}`);

	/** Every vertex of every part with this exact name, flattened. */
	const verts=(name:string)=>{const ix=A.indicesOf(name);if(!ix.length)throw new Error(`no atlas part named "${name}"`);const n=ix.reduce((s,i)=>s+parts[i].position.length,0),out=new Float32Array(n);let o=0;for(const i of ix){out.set(parts[i].position,o);o+=parts[i].position.length;}return out;};
	/** Centroid of the vertices of `a` within `r` of any vertex of `b` (sparse hash on b with cell r). */
	const contactAt=(a:Float32Array,b:Float32Array,r:number):Vec3|null=>{
		const h=new Map<string,number[]>(),k=(x:number,y:number,z:number)=>`${x},${y},${z}`;
		for(let i=0;i<b.length;i+=3){const key=k(Math.floor(b[i]/r),Math.floor(b[i+1]/r),Math.floor(b[i+2]/r));let l=h.get(key);if(!l)h.set(key,l=[]);l.push(i);}
		let sx=0,sy=0,sz=0,n=0;const r2=r*r;
		for(let i=0;i<a.length;i+=3){
			const x=a[i],y=a[i+1],z=a[i+2],cx=Math.floor(x/r),cy=Math.floor(y/r),cz=Math.floor(z/r);let hit=false;
			for(let dx=-1;dx<=1&&!hit;dx++)for(let dy=-1;dy<=1&&!hit;dy++)for(let dz=-1;dz<=1&&!hit;dz++){const l=h.get(k(cx+dx,cy+dy,cz+dz));if(l)for(const j of l){const ex=b[j]-x,ey=b[j+1]-y,ez=b[j+2]-z;if(ex*ex+ey*ey+ez*ez<=r2){hit=true;break;}}}
			if(hit){sx+=x;sy+=y;sz+=z;n++;}
		}
		return n?[sx/n,sy/n,sz/n]:null;
	};
	const contact=(label:string,a:string,b:string):Vec3=>{
		const va=verts(a),vb=verts(b);
		for(const r of CONTACT){const c=contactAt(va,vb,r);if(c){if(r!==CONTACT[0])console.warn(`WARNING: joint ${label} (${a} ↔ ${b}) had no contact within ${CONTACT[0]*1000} mm; widened to ${r*1000} mm`);return c;}}
		throw new Error(`joint ${label}: ${a} and ${b} never come within ${CONTACT[CONTACT.length-1]*1000} mm`);
	};
	/** The vertex of a part (or parts) that maximises f. */
	const extreme=(v:Float32Array,f:(x:number,y:number,z:number)=>number):Vec3=>{let best=-Infinity,p:Vec3=[0,0,0];for(let i=0;i<v.length;i+=3){const s=f(v[i],v[i+1],v[i+2]);if(s>best){best=s;p=[v[i],v[i+1],v[i+2]];}}return p;};

	// Joints from where bones touch.
	const J:Record<string,Vec3>={};
	for(const [s,S] of [['l','Left'],['r','Right']] as const){
		J[`${s}Hip`]=contact(`${s}Hip`,`${S} femur`,`${S} hip bone`);
		J[`${s}Knee`]=contact(`${s}Knee`,`${S} femur`,`${S} tibia`);
		J[`${s}Ankle`]=contact(`${s}Ankle`,`${S} tibia`,`${S} talus`);
		J[`${s}Shoulder`]=contact(`${s}Shoulder`,`${S} humerus`,`${S} scapula`);
		J[`${s}Elbow`]=contact(`${s}Elbow`,`${S} humerus`,`${S} ulna`);
		J[`${s}Wrist`]=contact(`${s}Wrist`,`${S} radius`,`${S} scaphoid`);
		J[`${s}Fingertip`]=extreme(verts(`Distal phalanx of ${S.toLowerCase()} middle finger`),(x,y)=>-y);
		J[`${s}ToeTip`]=extreme(verts(`Distal phalanx of ${S.toLowerCase()} big toe`),(x,y,z)=>z);
	}
	J.neckBase=contact('neckBase','Seventh cervical vertebra','First thoracic vertebra');
	J.head=contact('head','Atlas','Occipital bone');
	{let best=-Infinity,p:Vec3=[0,0,0];parts.forEach((g,i)=>{if(boneSegment(atlas.parts[i].name)!=='head')return;const q=extreme(g.position,(x,y)=>y);if(q[1]>best){best=q[1];p=q;}});J.headTop=p;}
	J.root=J.lHip.map((v,i)=>(v+J.rHip[i])/2) as Vec3;

	// Segments, parents first (SEGMENTS order): [id, parent, proximal, distal].
	const spec:Record<SegmentId,[SegmentId|null,string,string]>={
		trunk:[null,'root','neckBase'],neck:['trunk','neckBase','head'],head:['neck','head','headTop'],
		lUpperArm:['trunk','lShoulder','lElbow'],lForearm:['lUpperArm','lElbow','lWrist'],lHand:['lForearm','lWrist','lFingertip'],
		rUpperArm:['trunk','rShoulder','rElbow'],rForearm:['rUpperArm','rElbow','rWrist'],rHand:['rForearm','rWrist','rFingertip'],
		lThigh:['trunk','lHip','lKnee'],lShank:['lThigh','lKnee','lAnkle'],lFoot:['lShank','lAnkle','lToeTip'],
		rThigh:['trunk','rHip','rKnee'],rShank:['rThigh','rKnee','rAnkle'],rFoot:['rShank','rAnkle','rToeTip'],
	};
	const segments:Segment[]=SEGMENTS.map(id=>{
		const [parent,a,b]=spec[id],p=J[a],q=J[b],d=q.map((v,i)=>v-p[i]),len=Math.hypot(d[0],d[1],d[2]);
		return {id,parent,joint:p.map(r5) as Vec3,axis:d.map(v=>r5(v/len)) as Vec3,length:r5(len)};
	});
	let yMin=Infinity,yMax=-Infinity;for(const g of parts){const v=g.position;for(let i=1;i<v.length;i+=3){if(v[i]<yMin)yMin=v[i];if(v[i]>yMax)yMax=v[i];}}
	const rig:Rig={segments,stature:r5(yMax-yMin)};
	fs.writeFileSync(RIG_OUT,JSON.stringify(rig,null,'\t')+'\n');
	console.log('\njoints (model metres, +x = body left):');for(const [k,v] of Object.entries(J))console.log(`  ${k.padEnd(11)} [${v.map(x=>x.toFixed(4)).join(', ')}]`);
	console.log('\nsegments:');for(const s of segments)console.log(`  ${s.id.padEnd(10)} length ${s.length.toFixed(4)}  axis [${s.axis.map(x=>x.toFixed(3)).join(', ')}]  parent ${s.parent??'-'}`);
	console.log(`\nstature ${rig.stature} (y ${yMin.toFixed(4)} → ${yMax.toFixed(4)})  (${Date.now()-t0} ms)`);

	// Per-segment distance fields: squared EDT (Felzenszwalb) on a GRID voxel grid seeded by every bone vertex, read back trilinearly (smooth, no point-sample noise).
	const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
	for(const g of parts){const v=g.position;for(let i=0;i<v.length;i+=3)for(let a=0;a<3;a++){if(v[i+a]<lo[a])lo[a]=v[i+a];if(v[i+a]>hi[a])hi[a]=v[i+a];}}
	for(let a=0;a<3;a++){lo[a]-=2*GRID;hi[a]+=2*GRID;}
	const dim=lo.map((l,a)=>Math.ceil((hi[a]-l)/GRID)+1),[nx,ny,nz]=dim,nc=nx*ny*nz,INF=1e20;
	const field:Float32Array[]=[];
	{
		const f=new Float64Array(Math.max(nx,ny,nz)),d=new Float64Array(f.length),vv=new Int32Array(f.length),zz=new Float64Array(f.length+1);
		/** 1-D squared distance transform of f[0..n) into d (Felzenszwalb & Huttenlocher). */
		const dt1=(n:number)=>{let k=0;vv[0]=0;zz[0]=-INF;zz[1]=INF;for(let q=1;q<n;q++){let s=((f[q]+q*q)-(f[vv[k]]+vv[k]*vv[k]))/(2*q-2*vv[k]);while(s<=zz[k]){k--;s=((f[q]+q*q)-(f[vv[k]]+vv[k]*vv[k]))/(2*q-2*vv[k]);}k++;vv[k]=q;zz[k]=s;zz[k+1]=INF;}k=0;for(let q=0;q<n;q++){while(zz[k+1]<q)k++;d[q]=(q-vv[k])*(q-vv[k])+f[vv[k]];}};
		for(let s=0;s<NS;s++){
			const g2=new Float64Array(nc).fill(INF);
			parts.forEach((g,i)=>{if(boneSegment(atlas.parts[i].name)!==SEGMENTS[s])return;const v=g.position;for(let j=0;j<v.length;j+=3){const c=Math.round((v[j]-lo[0])/GRID)+nx*(Math.round((v[j+1]-lo[1])/GRID)+ny*Math.round((v[j+2]-lo[2])/GRID));g2[c]=0;}});
			for(let z=0;z<nz;z++)for(let y=0;y<ny;y++){const o=nx*(y+ny*z);for(let x=0;x<nx;x++)f[x]=g2[o+x];dt1(nx);for(let x=0;x<nx;x++)g2[o+x]=d[x];}
			for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){for(let y=0;y<ny;y++)f[y]=g2[x+nx*(y+ny*z)];dt1(ny);for(let y=0;y<ny;y++)g2[x+nx*(y+ny*z)]=d[y];}
			for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){for(let z=0;z<nz;z++)f[z]=g2[x+nx*(y+ny*z)];dt1(nz);for(let z=0;z<nz;z++)g2[x+nx*(y+ny*z)]=d[z];}
			const out=new Float32Array(nc);for(let c=0;c<nc;c++)out[c]=Math.sqrt(g2[c])*GRID;field.push(out);
		}
	}
	console.log(`\ndistance fields: ${NS} segments on ${nx}×${ny}×${nz} @ ${GRID*1000} mm (${Date.now()-t0} ms)`);
	/** Trilinear samples of every segment's field at (x,y,z) into D. */
	const sample=(x:number,y:number,z:number,D:Float64Array)=>{
		const fx=Math.min(nx-1.001,Math.max(0,(x-lo[0])/GRID)),fy=Math.min(ny-1.001,Math.max(0,(y-lo[1])/GRID)),fz=Math.min(nz-1.001,Math.max(0,(z-lo[2])/GRID));
		const ix=Math.floor(fx),iy=Math.floor(fy),iz=Math.floor(fz),tx=fx-ix,ty=fy-iy,tz=fz-iz,c=ix+nx*(iy+ny*iz),X=1,Y=nx,Z=nx*ny;
		for(let s=0;s<NS;s++){const F=field[s];D[s]=((F[c]*(1-tx)+F[c+X]*tx)*(1-ty)+(F[c+Y]*(1-tx)+F[c+Y+X]*tx)*ty)*(1-tz)+((F[c+Z]*(1-tx)+F[c+Z+X]*tx)*(1-ty)+(F[c+Z+Y]*(1-tx)+F[c+Z+Y+X]*tx)*ty)*tz;}
	};
	/** Rig neighbours of each segment (parent and children). segB is only ever chosen from these, so no blend spans segments the warp scales independently (thigh↔thigh, hand↔thigh, forearm↔trunk). */
	const ADJ=SEGMENTS.map((id,i)=>SEGMENTS.map((_,j)=>j).filter(j=>segments[i].parent===SEGMENTS[j]||segments[j].parent===id));
	const PAR=segments.map(s=>s.parent?SEG(s.parent):-1),KIDS=SEGMENTS.map((_,i)=>PAR.map((p,j)=>p===i?j:-1).filter(j=>j>=0));
	/** Each segment's subtree (itself and every descendant). */
	const SUBTREE=SEGMENTS.map((_,i)=>{const out=[i];for(let k=0;k<out.length;k++)out.push(...KIDS[out[k]]);return out;});
	const D=new Float64Array(NS),DS=new Float64Array(NS),c=new Float64Array(NS),W=new Float64Array(NS),EPS=1e-4;
	const out=new Uint8Array(parts.reduce((s,p)=>s+p.position.length/3,0)*3);let o=0,mixed=0,dropped=0,maxDrop=0;
	const dbgF=process.env.ANYHEALTH_FLOAT_OUT?new Float32Array(out.length/3*2):null;
	parts.forEach((g,pi)=>{
		const fixed=boneSegment(atlas.parts[pi].name),v=g.position,nv=v.length/3;
		if(fixed){const s=SEG(fixed);for(let i=0;i<nv;i++){if(dbgF){dbgF[o/3*2]=1;dbgF[o/3*2+1]=0;}out[o++]=s|s<<4;out[o++]=255;out[o++]=0;}return;}
		for(let i=0;i<nv;i++){
			const x=v[3*i],y=v[3*i+1],z=v[3*i+2];sample(x,y,z,D);
			for(let s=0;s<NS;s++){let m=Infinity;for(const t of SUBTREE[s])m=Math.min(m,D[t]);DS[s]=m;}
			// Child-side indicator per joint: the joint plane (scale-free: the cosine of the angle from the child axis at the joint), faded into the nearest-bone ratio where one side clearly owns the tissue.
			c[0]=1;
			for(let s=1;s<NS;s++){
				const P=PAR[s],r=(D[P]-DS[s])/(D[P]+DS[s]+EPS),J=segments[s].joint,a=segments[s].axis,dx=x-J[0],dy=y-J[1],dz=z-J[2],dl=Math.hypot(dx,dy,dz)+EPS;
				const sa=smoothstep(-ANG,ANG,(dx*a[0]+dy*a[1]+dz*a[2])/dl),sr=smoothstep(-RQ,RQ,r),f=smoothstep(FADE[0],FADE[1],Math.abs(r));
				let cs=sa+(sr-sa)*f;
				// Siblings never overlap: the side nearer another sibling's subtree fades this one out (they meet at the crotch midline, the shoulders / neck).
				for(const m of KIDS[P])if(m!==s)cs*=smoothstep(0,SQ,(DS[m]-DS[s])/(DS[m]+DS[s]+EPS));
				c[s]=cs;
			}
			// Tree partition of unity: w_s = (Π of c along the path to s) × (1 − Σ c over s's children).
			let sum=0;
			for(let s=0;s<NS;s++){let path=1;for(let t=s;t>=0;t=PAR[t])path*=c[t];let ch=0;for(const k of KIDS[s])ch+=c[k];W[s]=path*Math.max(0,1-ch);sum+=W[s];}
			// Keep the heaviest segment and its heaviest rig neighbour.
			let sA=0;for(let s=1;s<NS;s++)if(W[s]>W[sA])sA=s;let sB=-1;for(const s of ADJ[sA])if(sB<0||W[s]>W[sB])sB=s;
			const kept=W[sA]+(sB<0?0:W[sB]),drop=sum>0?1-kept/sum:0;if(drop>1e-3)dropped++;if(drop>maxDrop)maxDrop=drop;
			let w=sB<0||kept<=0?1:W[sA]/kept;
			if(Math.round(w*255)>=255){w=1;sB=sA;}else mixed++;
			let dBone=Infinity;for(let s=0;s<NS;s++)dBone=Math.min(dBone,D[s]);
			if(dbgF){dbgF[o/3*2]=w;dbgF[o/3*2+1]=dBone;}out[o++]=sA|sB<<4;out[o++]=Math.round(w*255);out[o++]=Math.min(255,Math.round(dBone/D_UNIT));
		}
	});
	if(dbgF)fs.writeFileSync(process.env.ANYHEALTH_FLOAT_OUT!,Buffer.from(dbgF.buffer));
	if(o!==out.length)throw new Error(`wrote ${o} of ${out.length} bytes`);
	fs.writeFileSync(BIN_OUT,out);
	console.log(`blended vertices: ${mixed}; vertices with > 0.1% weight on a third segment (dropped): ${dropped}, max dropped ${maxDrop.toFixed(3)}`);
	console.log(`\nwrote ${RIG_OUT} (${fs.statSync(RIG_OUT).size} B), ${BIN_OUT} (${(fs.statSync(BIN_OUT).size/1e6).toFixed(2)} MB) in ${((Date.now()-t0)/1000).toFixed(1)} s`);
}
main().catch(e=>{console.error(e);process.exit(1);});
