import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Extend only the scan below tabletop height, retaining its skin UVs. */
function extendChest(source:THREE.BufferGeometry){
  const p=source.getAttribute('position'),originalNormals=source.getAttribute('normal').clone();
  const unchanged:boolean[]=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    unchanged[i]=y>=-2.72;
    if(unchanged[i])continue;
    const t=THREE.MathUtils.clamp((-2.72-y)/1.253,0,1),blend=t*t*(3-2*t);
    p.setXYZ(i,x*(1-.22*blend),y-6.5*blend,z-.45*blend);
  }
  source.computeVertexNormals();
  const normals=source.getAttribute('normal');
  for(let i=0;i<p.count;i++)if(unchanged[i])normals.setXYZ(i,originalNormals.getX(i),originalNormals.getY(i),originalNormals.getZ(i));
  return source;
}

/** Original Infinite / Lee Perry-Smith scan, CC BY 3.0; see public/anyderm/robot-scan/LICENSE.txt. */
export function buildSubject(onReady?: () => void): {
  group: THREE.Group; ready: Promise<void>; dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'Patient · original Lee Perry-Smith head scan';
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let disposed = false;
  const metal = new THREE.MeshStandardMaterial({ color: '#9caaa9', metalness: .85, roughness: .3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#283532', roughness: .88 });
  materials.add(metal); materials.add(dark);
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
  };
  const oval = (x:number,y:number,z:number,sx:number,sy:number,sz:number,material:THREE.Material) => {
    const m=mesh(new THREE.SphereGeometry(1,32,24),material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;
  };
  const rod=(a:THREE.Vector3,b:THREE.Vector3,r:number)=>{
    const m=mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),20),metal);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;
  };
  // All load-bearing structure stays behind the subject and below the scan region.
  rod(new THREE.Vector3(0,-660,-325),new THREE.Vector3(0,210,-325),12);
  oval(0,-657,-325,115,8,90,dark);
  // Route the chin support around the cropped scan, then underneath its jaw.
  for(const side of [-1,1]) {
    rod(new THREE.Vector3(0,69,-325),new THREE.Vector3(side*55,76,-325),5);
    rod(new THREE.Vector3(side*55,76,-325),new THREE.Vector3(side*55,76,-126),5);
    rod(new THREE.Vector3(side*55,76,-126),new THREE.Vector3(0,76,-126),5);
  }
  oval(0,82,-126,25,7,21,dark);
  for(const s of [-1,1]){
    rod(new THREE.Vector3(0,190,-325),new THREE.Vector3(s*72,190,-235),5);
    oval(s*72,190,-223,11,20,8,dark);
  }
  // A seated body behind the table. The original scan supplies the neck and
  // shoulders; clothing continues below it, with knees beneath the tabletop.
  const trousers = new THREE.MeshStandardMaterial({color:'#282e36',roughness:.95});
  const shoes = new THREE.MeshStandardMaterial({color:'#181d22',roughness:.8});
  materials.add(trousers);materials.add(shoes);
  const limb=(a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material)=>{
    const geometry=new THREE.CapsuleGeometry(r,Math.max(1,a.distanceTo(b)-2*r),8,24);
    const part=mesh(geometry,material);
    part.position.copy(a).add(b).multiplyScalar(.5);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
    return part;
  };
  for(const side of [-1,1]){
    limb(new THREE.Vector3(side*78,-328,-220),new THREE.Vector3(side*89,-389,35),65,trousers);
    limb(new THREE.Vector3(side*89,-389,35),new THREE.Vector3(side*89,-642,65),45,trousers);
    oval(side*89,-665,98,49,31,87,shoes);
  }
  // Seat and back make the seated posture legible when the reader orbits down.
  oval(0,-371,-222,166,21,135,dark);
  const back=oval(0,-216,-367,156,172,23,dark);
  back.rotation.x=-.08;
  for(const x of [-122,122])for(const z of [-315,-130]){
    rod(new THREE.Vector3(x,-378,z),new THREE.Vector3(x,-690,z),9);
  }
  const loader = new THREE.TextureLoader();
  const ready = Promise.all([
    new GLTFLoader().loadAsync('/anyderm/robot-scan/head.glb'),
    loader.loadAsync('/anyderm/robot-scan/head-color.jpg'),
    loader.loadAsync('/anyderm/robot-scan/head-normal.jpg'),
  ]).then(([gltf, color, normal]) => {
    if(disposed){ color.dispose();normal.dispose();gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});return; }
    color.colorSpace = THREE.SRGBColorSpace;
    // Original external texture orientation, as in the Three.js example.
    color.flipY = normal.flipY = true;
    color.anisotropy = normal.anisotropy = 8;
    textures.add(color);textures.add(normal);
    const skin=new THREE.MeshPhysicalMaterial({map:color,normalMap:normal,
      normalScale:new THREE.Vector2(.85,.85),roughness:.62,metalness:0,
      specularIntensity:.3, sheen:.035, sheenRoughness:.8});
    materials.add(skin);
    const head = new THREE.Group();
    head.name='Original scanned anatomy · uniformly scaled';
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      const original=o.geometry.clone().applyMatrix4(o.matrixWorld);
      const geometry=extendChest(original);
      const m=new THREE.Mesh(geometry,skin);m.castShadow=true;m.receiveShadow=true;
      head.add(m);
      o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());
    });
    // Restore the scan's original neck/shoulders without moving the face.
    // The head retains its validated scale and scanner clearance.
    const scale=232/(3.9725468+1.1);
    head.scale.setScalar(scale);
    head.position.set(0,74+1.1*scale,-190);
    head.userData.scanBounds={cutY:-1.1,scale};
    group.add(head);group.updateMatrixWorld(true);onReady?.();
  });
  return {group,ready,dispose:()=>{
    disposed=true;
    group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
    materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  }};
}
