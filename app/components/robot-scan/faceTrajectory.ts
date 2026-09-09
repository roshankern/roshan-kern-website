import * as THREE from "three";
import { precomputeTrajectory } from "./armTrajectory";
import { scanSampleAt } from "./scanPath";
import { lensPose } from "./kinematics";
import type { ArmJoints, ScanSample } from "./contracts";

// Small yaw bearing in the custom carrier, independent of the SO-101 joints.
export const carrierYaw = (q: ArmJoints) => .34 * Math.tanh(-q.pan * 7);

/** Measure the loaded triangles once, then solve, smooth and clearance-check
 * complete loops. No raycasts or inverse kinematics run in the render loop. */
export function fitFaceTrajectory(face: THREE.Object3D) {
  face.updateWorldMatrix(true, true);
  const meshes: THREE.Mesh[] = [];
  const vertices: THREE.Vector3[] = [];
  const seen = new Set<string>();
  face.traverse(o => {
    if (!(o instanceof THREE.Mesh) || !o.geometry.getAttribute("position")) return;
    // Ignore the floor-standing rest, if the caller supplied the whole subject.
    if (o.geometry.getAttribute("position").count < 3000) return;
    meshes.push(o);
    const p=o.geometry.getAttribute("position");
    for(let i=0;i<p.count;i++) {
      const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
      if(v.y<74 || v.z < -200)continue;
      const key=`${Math.round(v.x)},${Math.round(v.y)},${Math.round(v.z)}`;
      if(!seen.has(key)){seen.add(key);vertices.push(v);}
    }
  });
  if(!meshes.length || !vertices.length)throw new Error("Face scan geometry is not ready");
  const ray=new THREE.Raycaster();
  const grid=Array.from({length:27},()=>new Float64Array(23));
  let hits=0;
  for(let j=0;j<27;j++)for(let i=0;i<23;i++) {
    ray.set(new THREE.Vector3(-55+i*5,120+j*5,150),new THREE.Vector3(0,0,-1));
    const hit=ray.intersectObjects(meshes,false)[0];
    grid[j][i]=hit?.point.z ?? -100;
    if(hit)hits++;
  }
  // Spatial smoothing across a 15 mm neighbourhood removes nostril/eyelid
  // normal spikes while preserving the nose, brow and cheeks as actual depths.
  for(let pass=0;pass<3;pass++) {
    const source=grid.map(r=>r.slice());
    for(let j=1;j<26;j++)for(let i=1;i<22;i++)
      grid[j][i]=(source[j][i]*4+source[j-1][i]+source[j+1][i]+source[j][i-1]+source[j][i+1])/8;
  }
  const depth=(x:number,y:number)=>{
    const u=THREE.MathUtils.clamp((x+55)/5,0,21.999),v=THREE.MathUtils.clamp((y-120)/5,0,25.999);
    const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(grid[j][i],grid[j][i+1],a),THREE.MathUtils.lerp(grid[j+1][i],grid[j+1][i+1],a),b);
  };
  const sampler=(t:number):ScanSample=>{
    const original=scanSampleAt(t);
    const x=original.skin.x*1.2,y=original.skin.y;
    const dy=(depth(x,y+7)-depth(x,y-7))/14;
    // Pitch follows measured topography gently; the carrier supplies inward yaw.
    const n=new THREE.Vector3(0,THREE.MathUtils.clamp(-dy*.45,-.32,.32),1).normalize();
    return {skin:{x,y,z:depth(x,y)},normal:{x:n.x,y:n.y,z:n.z}};
  };
  const rotation=new THREE.Matrix4(),temp=new THREE.Matrix4(),inverse=new THREE.Matrix4();
  const point=new THREE.Vector3();
  function clearance(at:(t:number)=>ArmJoints) {
    let min=Infinity;
    // 1,440 poses cover the resampled spline, including intersample points.
    for(let i=0;i<1440;i++) {
      const q=at(i/1440),pose=lensPose(q);
      rotation.makeRotationY(q.pan).multiply(temp.makeRotationX(q.lift+q.elbow+q.flex)).multiply(temp.makeRotationZ(q.roll)).multiply(temp.makeRotationY(carrierYaw(q)));
      rotation.setPosition(pose.lens.x,pose.lens.y,pose.lens.z);inverse.copy(rotation).invert();
      for(const v of vertices) {
        point.copy(v).applyMatrix4(inverse);
        // Conservative solid envelope for phone, clamps and complete shroud.
        const bx=Math.max(Math.abs(point.x)-76,0),by=Math.max(Math.abs(point.y)-41,0),bz=Math.max(Math.abs(point.z)-8,0);
        const body=Math.hypot(bx,by,bz);
        const radial=Math.max(Math.hypot(point.x,point.y)-27,0);
        const axial=Math.max(-39.5-point.z,point.z+4,0);
        min=Math.min(min,body,Math.hypot(radial,axial));
      }
    }
    return min;
  }
  let offset=12;
  let trajectory=precomputeTrajectory(sampler,offset),minimumGap=clearance(trajectory.at);
  for(let attempt=0;minimumGap<20 && attempt<6;attempt++) {
    offset+=Math.max(5,23-minimumGap);
    trajectory=precomputeTrajectory(sampler,offset);minimumGap=clearance(trajectory.at);
  }
  if(minimumGap<15)throw new Error(`Face path could not establish clearance (${minimumGap.toFixed(1)} mm)`);
  return {...trajectory,minimumGap,forwardOffset:offset,surfaceSamples:hits,checkedVertices:vertices.length};
}
