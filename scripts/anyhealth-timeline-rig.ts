// Builds the AnyHealth timeline rig and per-vertex segment weights from the rest-pose atlas: npx tsx scripts/anyhealth-timeline-rig.ts
// Writes app/anyhealth/timeline/growth/rig.json (a Rig) and public/anyhealth/models/segments.bin
// (per atlas part in order, vertexCount × 2 bytes: byte0 = segA | segB<<4, byte1 = round(weightA*255)).
import fs from 'node:fs';
import {loadAtlasNode} from '../app/anyhealth/timeline/check/node-atlas';
import {boneSegment} from '../app/anyhealth/timeline/growth/segment-map';
import {SEGMENTS,type Rig,type Segment,type SegmentId,type Vec3} from '../app/anyhealth/timeline/types';

const RIG_OUT='app/anyhealth/timeline/growth/rig.json',BIN_OUT='public/anyhealth/models/segments.bin';
/** Contact radius for joints, widened step by step if two bones never come that close. */
const CONTACT=[0.006,0.008,0.010,0.012];
/** Proximity grid: cell size, bone-point subsampling, search radius, and the dB−dA blend width. */
const CELL=0.01,SUB=4,REACH=0.12,BLEND=0.02;
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

	// Bone points per segment (every SUB-th vertex) in a dense CSR grid.
	const bx:number[]=[],bs:number[]=[];
	parts.forEach((g,i)=>{const s=boneSegment(atlas.parts[i].name);if(!s)return;const si=SEG(s),v=g.position;for(let j=0;j<v.length;j+=3*SUB){bx.push(v[j],v[j+1],v[j+2]);bs.push(si);}});
	const np=bs.length,lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
	for(const g of parts){const v=g.position;for(let i=0;i<v.length;i+=3)for(let a=0;a<3;a++){if(v[i+a]<lo[a])lo[a]=v[i+a];if(v[i+a]>hi[a])hi[a]=v[i+a];}}
	const dim=lo.map((l,a)=>Math.floor((hi[a]-l)/CELL)+1),[nx,ny,nz]=dim,cellOf=(x:number,a:number)=>Math.min(dim[a]-1,Math.max(0,Math.floor((x-lo[a])/CELL)));
	const start=new Int32Array(nx*ny*nz+1),pc=new Int32Array(np);
	for(let p=0;p<np;p++){pc[p]=cellOf(bx[3*p],0)+nx*(cellOf(bx[3*p+1],1)+ny*cellOf(bx[3*p+2],2));start[pc[p]+1]++;}
	for(let c=0;c<nx*ny*nz;c++)start[c+1]+=start[c];
	const fill=start.slice(0,-1),pts=new Float32Array(np*3),pseg=new Uint8Array(np);
	for(let p=0;p<np;p++){const o=fill[pc[p]]++;pts.set([bx[3*p],bx[3*p+1],bx[3*p+2]],3*o);pseg[o]=bs[p];}
	console.log(`\nbone points: ${np} (every ${SUB}th vertex), grid ${nx}×${ny}×${nz} @ ${CELL*100} cm`);

	// Fallback when no bone is within REACH: distance to each segment's joint→distal line.
	const lineD=(x:number,y:number,z:number,s:Segment)=>{const [jx,jy,jz]=s.joint,[ax,ay,az]=s.axis,t=Math.min(s.length,Math.max(0,(x-jx)*ax+(y-jy)*ay+(z-jz)*az));return Math.hypot(x-jx-ax*t,y-jy-ay*t,z-jz-az*t);};
	/** Rig neighbours of each segment (parent and children). segB is only ever chosen from these, so no blend spans segments the warp scales independently (thigh↔thigh, hand↔thigh, forearm↔trunk). */
	const ADJ=SEGMENTS.map((id,i)=>SEGMENTS.map((_,j)=>j).filter(j=>segments[i].parent===SEGMENTS[j]||segments[j].parent===id));
	/** sA = nearest segment overall, sB = nearest rig neighbour of sA (−1 if none is finite). */
	const pick=(d:ArrayLike<number>)=>{let sA=-1,sB=-1;for(let s=0;s<NS;s++)if(d[s]<(sA<0?Infinity:d[sA]))sA=s;if(sA>=0)for(const s of ADJ[sA])if(d[s]<(sB<0?Infinity:d[sB]))sB=s;return [sA,sB];};
	const best=new Float64Array(NS),line=new Float64Array(NS),maxRing=Math.ceil(REACH/CELL),hands=[SEG('lHand'),SEG('rHand')],thighs=[SEG('lThigh'),SEG('rThigh')];
	const out=new Uint8Array(parts.reduce((s,p)=>s+p.position.length/3,0)*2);let o=0,far=0,mixed=0,skinHandOnThigh=0;
	parts.forEach((g,pi)=>{
		const fixed=boneSegment(atlas.parts[pi].name),v=g.position,nv=v.length/3,skin=atlas.parts[pi].name==='Skin';
		if(fixed){const s=SEG(fixed);for(let i=0;i<nv;i++){out[o++]=s|s<<4;out[o++]=255;}return;}
		for(let i=0;i<nv;i++){
			const x=v[3*i],y=v[3*i+1],z=v[3*i+2],cx=cellOf(x,0),cy=cellOf(y,1),cz=cellOf(z,2);best.fill(Infinity);
			let dA=Infinity,dB=Infinity,sA=-1,sB=-1;
			// Scan cubic shells of cells. After ring r every bone point closer than r*CELL has been seen.
			for(let r=0;r<=maxRing;r++){
				for(let k=cz-r;k<=cz+r;k++){if(k<0||k>=nz)continue;const ek=k===cz-r||k===cz+r;
					for(let j=cy-r;j<=cy+r;j++){if(j<0||j>=ny)continue;const ej=ek||j===cy-r||j===cy+r;
						for(let h=cx-r;h<=cx+r;h+=ej||h===cx+r?1:2*r){if(h<0||h>=nx)continue;const c=h+nx*(j+ny*k);
							for(let p=start[c];p<start[c+1];p++){const ex=pts[3*p]-x,ey=pts[3*p+1]-y,ez=pts[3*p+2]-z,d=ex*ex+ey*ey+ez*ez,s=pseg[p];if(d<best[s])best[s]=d;}
						}
					}
				}
				[sA,sB]=pick(best);dA=sA<0?Infinity:Math.sqrt(best[sA]);dB=sB<0?Infinity:Math.sqrt(best[sB]);
				// Done once A is exact and B is either exact or at least BLEND farther (weight saturates).
				const seen=r*CELL;
				if(sA>=0&&seen>=dA&&(seen>=dB||seen>=dA+BLEND)||seen>=REACH)break;
			}
			if(sA<0||dA>REACH){far++;segments.forEach((s,si)=>{line[si]=lineD(x,y,z,s);});[sA,sB]=pick(line);dA=line[sA];dB=sB<0?Infinity:line[sB];}
			// No neighbour within the blend window: fully A.
			const w=sB<0?1:0.5+0.5*smoothstep(0,BLEND,dB-dA);
			if(w>=1)sB=sA;else mixed++;
			if(skin&&hands.includes(sA)&&Math.min(...thighs.map(t=>lineD(x,y,z,segments[t])))<lineD(x,y,z,segments[sA]))skinHandOnThigh++;
			out[o++]=sA|sB<<4;out[o++]=Math.round(w*255);
		}
	});
	if(o!==out.length)throw new Error(`wrote ${o} of ${out.length} bytes`);
	fs.writeFileSync(BIN_OUT,out);
	console.log(`vertices with no bone within ${REACH*100} cm (joint-line fallback): ${far}; blended vertices: ${mixed}`);
	console.log(`residual mislabel: Skin vertices with segA = l/rHand but closer to a thigh axis than to that hand axis: ${skinHandOnThigh}`);
	console.log(`\nwrote ${RIG_OUT} (${fs.statSync(RIG_OUT).size} B), ${BIN_OUT} (${(fs.statSync(BIN_OUT).size/1e6).toFixed(2)} MB) in ${((Date.now()-t0)/1000).toFixed(1)} s`);
}
main().catch(e=>{console.error(e);process.exit(1);});
