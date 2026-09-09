import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { jointsAt } from "./armTrajectory";
import { ARM } from "./contracts";
import { carrierYaw, fitFaceTrajectory } from "./faceTrajectory";

/** Fresh geometry; millimetres, URDF-derived pivot spacing. Only the validated,
 * precomputed joint-space trajectory is shared with the article figure. */
export function buildRig() {
  const group = new THREE.Group();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const material = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial(p); materials.add(m); return m;
  };
  const print = material({ color: "#d9ded5", roughness: 0.68 });
  print.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vPrint;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvPrint = position;");
    shader.fragmentShader = "varying vec3 vPrint;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\nfloat layer = sin(vPrint.y * 31.415926); float fade = 1.0 - smoothstep(0.05, 0.5, fwidth(vPrint.y)); diffuseColor.rgb *= 1.0 - 0.045 * fade * (0.5 + 0.5 * layer);");
  };
  const black = material({ color: "#242a29", roughness: 0.43 });
  const rubber = material({ color: "#111615", roughness: 0.88 });
  const metal = material({ color: "#9ca7a5", roughness: 0.24, metalness: 0.92 });
  const darkMetal = material({ color: "#343d3c", roughness: 0.27, metalness: 0.8 });
  const green = material({ color: "#17615d", roughness: 0.48 });
  const gold = material({ color: "#cda960", metalness: 0.8, roughness: 0.3 });
  const light = material({ color: "#f2fff9", emissive: "#d9fff0", emissiveIntensity: 2.5 });
  function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x=0,y=0,z=0) {
    geometries.add(geo); const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(parent: THREE.Object3D,w:number,h:number,d:number,mat:THREE.Material,x=0,y=0,z=0,r=1) {
    return mesh(parent,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),mat,x,y,z);
  }
  function cylinder(parent:THREE.Object3D,r:number,h:number,mat:THREE.Material,x=0,y=0,z=0,axis="y") {
    const m=mesh(parent,new THREE.CylinderGeometry(r,r,h,32),mat,x,y,z);
    if(axis==="x")m.rotation.z=Math.PI/2; if(axis==="z")m.rotation.x=Math.PI/2; return m;
  }
  function screw(parent:THREE.Object3D,x:number,y:number,z:number,axis="x") {
    cylinder(parent,2.65,1.6,metal,x,y,z,axis);
    const m=mesh(parent,new THREE.CylinderGeometry(1.15,1.15,1.7,6),rubber,x,y,z);
    if(axis==="x")m.rotation.z=Math.PI/2; if(axis==="z")m.rotation.x=Math.PI/2;
  }
  function cable(parent:THREE.Object3D,points:number[][],mat=black,r=1.3) {
    mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p as [number,number,number]))),32,r,6,false),mat);
  }
  function label(parent:THREE.Object3D,text:string,w:number,h:number,x:number,y:number,z:number) {
    const canvas=document.createElement("canvas"); canvas.width=512;canvas.height=128;
    const c=canvas.getContext("2d")!;c.fillStyle="#242b29";c.fillRect(0,0,512,128);c.fillStyle="#dae3db";c.font="500 37px monospace";c.fillText(text,22,77);
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;textures.add(t);
    return mesh(parent,new THREE.PlaneGeometry(w,h),material({map:t,roughness:0.65}),x,y,z);
  }
  function servo(parent:THREE.Object3D,axis="x") {
    const g=new THREE.Group();parent.add(g);
    if(axis==="y")g.rotation.z=Math.PI/2;
    if(axis==="z")g.rotation.y=Math.PI/2;
    box(g,35,24.8,45.4,black,0,0,12.5,1.5);
    for(const x of [-18,18]) {
      box(g,1.1,24.5,44.4,darkMetal,x,0,12.5,0.3);
      cylinder(g,10.5,4,metal,x,0,0,"x");cylinder(g,6,4.4,black,x*1.16,0,0,"x");
      for(let j=0;j<4;j++) { const a=j*Math.PI/2+Math.PI/4;screw(g,x*1.2,7.2*Math.cos(a),7.2*Math.sin(a)); }
      for(const y of [-9,9])for(const z of [-7,31])screw(g,x,y,z);
    }
    box(g,8,5,3,rubber,0,-7,36);box(g,8,5,3,rubber,0,7,36);
    label(g,"FEETECH / STS3215",29,6,0,0,35.4);
    return g;
  }
  // A pierced extrusion, not black shapes painted on solid links.
  function plate(parent:THREE.Object3D,length:number,x:number) {
    const s=new THREE.Shape();s.moveTo(-15,4);s.lineTo(-17,-length+4);s.quadraticCurveTo(-17,-length-16,0,-length-16);s.quadraticCurveTo(17,-length-16,17,-length+4);s.lineTo(15,4);s.quadraticCurveTo(15,18,0,18);s.quadraticCurveTo(-15,18,-15,4);
    if(length>70)for(let j=0;j<2;j++) {
      const a=-28-j*(length-48)/2,b=a-(length-58)/2;
      const h=new THREE.Path();h.moveTo(-7,a);h.lineTo(7,a-3);h.lineTo(7,b);h.lineTo(-7,b+3);h.closePath();s.holes.push(h);
    }
    const geo=new THREE.ExtrudeGeometry(s,{depth:7,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:0.75,bevelThickness:0.75,curveSegments:12});
    // Shape x -> local y, shape y -> local z, extrusion z -> local x.
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0)));
    mesh(parent,geo,print,x,0,0);
    for(const z of [0,-length])for(let j=0;j<4;j++) {const a=Math.PI/4+j*Math.PI/2;screw(parent,x+(x>0?8:-1),9*Math.cos(a),z+9*Math.sin(a));}
  }
  function link(parent:THREE.Object3D,length:number) {
    plate(parent,length,-27);plate(parent,length,20);
    for(const z of [-23,-length+23])box(parent,44,8,9,print,0,10,z,1);
    for(let i=0;i<3;i++)cable(parent,[[29+i*1.4,-7,12],[32+i*1.4,-18,-12],[30+i*1.4,-20,-length/2],[30+i*1.4,-8,-length+5]],i===1?material({color:"#8d463d",roughness:0.65}):black,0.8);
    box(parent,5,5,10,rubber,30,-19,-length/2,0.7);
  }
  const base=new THREE.Group();base.position.z=ARM.baseZ;group.add(base);
  box(base,111,8,96,print,0,4,0,3);
  for(const x of [-45,45])for(const z of [-37,37]) {cylinder(base,6,3,rubber,x,1,z);screw(base,x,8,z,"y");}
  box(base,51,52,45,print,13,35,0,2);
  const panServo=servo(base,"y");panServo.position.set(13,64.8,0);
  box(base,8,51,42,print,-43,34,0);
  box(base,2,43,34,green,-48,34,0);
  for(const y of [19,49])for(const z of [-12,12])screw(base,-50,y,z);
  box(base,4,15,14,black,-51,33,0,0.2);
  for(let i=0;i<8;i++)box(base,4,1.5,2,gold,-51,20+i*3,-11,0.1);
  box(base,8,9,11,metal,-53,20,11);box(base,8,10,10,black,-53,46,10);
  cylinder(base,1.3,2,light,-54,47,-11,"x");
  cable(base,[[-48,44,13],[-39,65,25],[-15,69,30],[13,56,24]]);
  const pan=new THREE.Group();base.add(pan);
  box(pan,44,39,34,print,0,88,0,2);
  const lift=new THREE.Group();lift.position.y=ARM.shoulderY;pan.add(lift);servo(lift);link(lift,ARM.L1);
  const elbow=new THREE.Group();elbow.position.z=-ARM.L1;lift.add(elbow);servo(elbow);link(elbow,ARM.L2);
  const flex=new THREE.Group();flex.position.z=-ARM.L2;elbow.add(flex);servo(flex);link(flex,ARM.L3);
  const roll=new THREE.Group();roll.position.z=-ARM.L3;flex.add(roll);servo(roll,"z");
  cylinder(roll,16,6,darkMetal,0,0,-6,"z");
  for(let i=0;i<4;i++){const a=i*Math.PI/2;screw(roll,11*Math.cos(a),11*Math.sin(a),-9,"z");}
  // Four short posts bolt the landscape carrier to the roll output. There is no gripper.
  for(const x of [-13,13])box(roll,7,9,26,print,x,0,-23);
  box(roll,43,65,6,print,0,0,-36,2);
  const phone=new THREE.Group();phone.position.z=-44;roll.add(phone);
  box(phone,149.6,71.5,7.95,metal,0,0,0,3.8);
  box(phone,147.5,69.5,0.9,material({color:"#d1dfd6",roughness:0.13,metalness:0.25}),0,0,-4,0.4);
  box(phone,146,68,0.9,black,0,0,4,0.4);
  const screen=document.createElement("canvas");screen.width=1024;screen.height=480;
  const c=screen.getContext("2d")!;c.fillStyle="#102522";c.fillRect(0,0,1024,480);
  c.strokeStyle="#47756a";c.lineWidth=2;
  for(let i=0;i<10;i++){c.beginPath();c.moveTo(320+i*42,60);c.lineTo(320+i*42,420);c.stroke();}
  for(let i=0;i<9;i++){c.beginPath();c.moveTo(290,70+i*42);c.lineTo(735,70+i*42);c.stroke();}
  c.fillStyle="#254b41";c.beginPath();c.ellipse(515,244,119,160,0,0,Math.PI*2);c.fill();
  c.strokeStyle="#93d7b7";c.lineWidth=3;c.strokeRect(378,71,273,338);
  c.fillStyle="#eff9f1";c.font="500 29px sans-serif";c.fillText("AnyDerm",32,51);
  c.fillStyle="#91b7a6";c.font="19px monospace";c.fillText("CAPTURE",32,95);c.fillText("RGB",810,430);
  c.fillStyle="#8ae4b1";c.fillRect(32,388,150,5);c.fillText("SCANNING",32,434);
  c.beginPath();c.arc(892,236,33,0,Math.PI*2);c.fill();
  const texture=new THREE.CanvasTexture(screen);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);
  mesh(phone,new THREE.PlaneGeometry(142,64),material({map:texture,emissiveMap:texture,emissive:0xffffff,emissiveIntensity:0.45,roughness:0.2}),0,0,4.6);
  for(const y of [-37,37]) {box(phone,46,6,14,print,0,y,0,1.5);box(phone,42,2,9,rubber,0,y*0.91,0,0.5);}
  box(phone,3,15,2,metal,-75,9,0,0.6);
  box(phone,44,44,3.6,metal,12,0,-6,1.7);
  for(const x of [0,24]) {
    cylinder(phone,10.5,3,darkMetal,x,0,-9,"z");cylinder(phone,7.2,3.4,material({color:"#142a35",metalness:0.6,roughness:0.08}),x,0,-9,"z");
    cylinder(phone,3.5,3.6,black,x,0,-9,"z");
  }
  cylinder(phone,2.5,1,light,23,16,-8,"z");
  // Hollow shroud profile, dark interior, physically open at the face.
  const profile=[new THREE.Vector2(27,0),new THREE.Vector2(20,30),new THREE.Vector2(18,30),new THREE.Vector2(25,0),new THREE.Vector2(27,0)];
  const shroud=mesh(phone,new THREE.LatheGeometry(profile,64),black,0,0,-9);shroud.rotation.x=-Math.PI/2;
  const ring=mesh(phone,new THREE.TorusGeometry(18.8,1.1,10,64),light,0,0,-38);
  ring.castShadow=false;
  for(let i=0;i<16;i++){const a=i*Math.PI/8;box(phone,1.8,1.8,0.8,light,18.8*Math.cos(a),18.8*Math.sin(a),-39,0.2);}
  // The new sculpt's nose projects beyond the original tracking oval, and the
  // shroud extends 39 mm past the phone centre. Move the entire smooth oval
  // 40 mm toward the robot before solving; keep the tool rigidly on the wrist.
  let fitted: ReturnType<typeof fitFaceTrajectory> | undefined;
  // A short ball/yaw bearing joins the rigid flange to the custom phone carrier.
  cylinder(roll,10,9,darkMetal,0,0,-38,"y");
  const update=(phase:number)=>{const q=fitted?fitted.at(phase):jointsAt(phase,40);pan.rotation.y=q.pan;lift.rotation.x=q.lift;elbow.rotation.x=q.elbow;flex.rotation.x=q.flex;roll.rotation.z=q.roll;phone.rotation.y=fitted?carrierYaw(q):0;};
  const fitToFace=(face:THREE.Object3D)=>{fitted=fitFaceTrajectory(face);return {minimumGap:fitted.minimumGap,forwardOffset:fitted.forwardOffset,surfaceSamples:fitted.surfaceSamples,checkedVertices:fitted.checkedVertices,reachedFraction:fitted.reachedFraction};};
  update(0); // Generates the complete smooth loop once, before animation starts.
  return {group,update,fitToFace,dispose:()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
