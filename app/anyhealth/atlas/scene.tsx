'use client';
import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {PointerTap} from './pointer-tap';
import {SYSTEMS,type Atlas,type SceneState} from './anatomy';
interface Props {atlas:Atlas;state:SceneState;onSelect:(id:string)=>void;onProgress:(n:number)=>void;onError:(s:string)=>void}
export default function AnatomyScene({atlas,state,onSelect,onProgress,onError}:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(state),select=useRef(onSelect);
 latest.current=state;select.current=onSelect;
 useEffect(()=>{
  const el=host.current!;let disposed=false,frame=0,dirty=true,ready=false,lastIsolate='';
  let lastState:SceneState|null=null;
  const abort=new AbortController();
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{onError('This browser could not start the 3D viewer. Please try a browser with WebGL enabled.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<768?1.5:2));renderer.setClearColor('#f2f3f3');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive human anatomy. Drag to orbit, shift-drag or two fingers to pan, scroll or pinch to zoom toward the pointer, tap a structure to inspect it, and double-click to focus.');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.005,100),controls=new OrbitControls(camera,renderer.domElement);
  camera.position.set(1.4,1.05,3.6);controls.target.set(0,.85,0);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=.02;controls.maxDistance=15;controls.screenSpacePanning=true;controls.mouseButtons={LEFT:T.MOUSE.ROTATE,MIDDLE:null,RIGHT:null};controls.touches={ONE:T.TOUCH.ROTATE,TWO:T.TOUCH.DOLLY_PAN};controls.maxPolarAngle=Math.PI*.96;controls.addEventListener('change',()=>{dirty=true;});
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xffffff,0xa7acb2,1.05));
  const key=new T.DirectionalLight(0xfffaf4,2.3);key.position.set(-2,4,3);scene.add(key);
  const rim=new T.DirectionalLight(0xe9f0ff,1.8);rim.position.set(2,2,-3);scene.add(rim);
  const ground=new T.Mesh(new T.CircleGeometry(30,96),new T.MeshStandardMaterial({color:0xd5d9dc,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.019;scene.add(ground);
  const platform=new T.Mesh(new T.CylinderGeometry(.68,.7,.028,100),new T.MeshStandardMaterial({color:0xeeeeec,metalness:.12,roughness:.67}));platform.position.y=-.016;scene.add(platform);
  const ring=new T.Mesh(new T.RingGeometry(.63,.632,128),new T.MeshBasicMaterial({color:0x8c969f,transparent:true,opacity:.4,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.001;scene.add(ring);
  const innerRing=new T.Mesh(new T.RingGeometry(.55,.551,128),new T.MeshBasicMaterial({color:0xa4aeb8,transparent:true,opacity:.16,side:T.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.001;scene.add(innerRing);
  const width=T.MathUtils.ceilPowerOfTwo(atlas.parts.length),data=new Float32Array(width*4),partTexture=new T.DataTexture(data,width,1,T.RGBAFormat,T.FloatType);partTexture.needsUpdate=true;
  const selectedData=new Uint8Array(width*4),selectionTexture=new T.DataTexture(selectedData,width,1);selectionTexture.needsUpdate=true;
  const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[],pickers:(T.Mesh|undefined)[]=[];
  const bounds=atlas.parts.map(p=>new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1])));
  const materialFor=(system:string)=>{
   const m=new T.MeshStandardMaterial({color:SYSTEMS.find(s=>s.id===system)?.color??'#aebbb8',metalness:.08,roughness:.53,side:T.DoubleSide,transparent:system==='integumentary',opacity:system==='integumentary'?.1:1,depthWrite:system!=='integumentary'});
   m.onBeforeCompile=shader=>{
    shader.uniforms.partState={value:partTexture};shader.uniforms.selectionState={value:selectionTexture};shader.uniforms.stateWidth={value:width};
    shader.vertexShader='attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); partVisible = state.w; partSelected = texture2D(selectionState, stateUv).r;');
    shader.fragmentShader='varying float partVisible; varying float partSelected;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.85, 0.78), partSelected * 0.75);');
   };materials.push(m);return m;
  };
  const mats=new Map(SYSTEMS.map(s=>[s.id,materialFor(s.id)]));
  let loaded=0;
  const loadChunk=async(ci:number)=>{
   const chunk=atlas.chunks[ci];const response=await fetch(chunk.url,{signal:abort.signal});if(!response.ok)throw new Error('An anatomy file could not be loaded.');const buffer=await response.arrayBuffer();if(buffer.byteLength!==chunk.bytes)throw new Error('An anatomy file was incomplete. Please reload the viewer.');await MeshoptDecoder.ready;if(disposed)return;
   const groups=new Map<string,T.BufferGeometry[]>();
   atlas.parts.forEach((p,i)=>{
    if(p.chunk!==ci)return;
    // Meshopt-encoded: 12-byte vertices (uint16 position within the part's bounds, int8 normal). See scripts/encode-anyhealth-atlas.mjs.
    const packed=new Uint8Array(p.vertexCount*12),index=new Uint32Array(p.indexCount);
    MeshoptDecoder.decodeVertexBuffer(packed,p.vertexCount,12,new Uint8Array(buffer,p.vertices,p.vertexBytes));
    MeshoptDecoder.decodeIndexBuffer(new Uint8Array(index.buffer),p.indexCount,4,new Uint8Array(buffer,p.indices,p.indexBytes));
    const q=new Uint16Array(packed.buffer),n=new Int8Array(packed.buffer),position=new Float32Array(p.vertexCount*3),normal=new Int8Array(p.vertexCount*3),[lo,hi]=p.bounds;
    for(let v=0;v<p.vertexCount;v++)for(let k=0;k<3;k++){position[v*3+k]=lo[k]+q[v*6+k]/65535*(hi[k]-lo[k]);normal[v*3+k]=n[v*12+8+k];}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(position,3));
    // GPU normalized signed-byte normals keep the complete atlas compact in memory.
    g.setAttribute('normal',new T.BufferAttribute(normal,3,true));g.setIndex(new T.BufferAttribute(index,1));
    g.boundingBox=bounds[i].clone();g.computeBoundingSphere();const pick=new T.Mesh(g);pick.matrixAutoUpdate=false;pickers[i]=pick;geometries.push(g);
    g.setAttribute('partIndex',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i),1));
    const list=groups.get(p.system)??[];list.push(g);groups.set(p.system,list);
   });
   groups.forEach((gs,system)=>{const geometry=mergeGeometries(gs,false);if(!geometry)throw new Error('Could not assemble anatomy geometry.');geometries.push(geometry);const mesh=new T.Mesh(geometry,mats.get(system as never));mesh.frustumCulled=false;scene.add(mesh);});
   lastState=null;loaded++;onProgress(Math.round(loaded/atlas.chunks.length*100));dirty=true;
  };
  (async()=>{try{let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<atlas.chunks.length){const i=cursor++;await loadChunk(i);}}));if(!disposed){ready=true;dirty=true;}}catch(e){if(!disposed)onError(e instanceof Error?e.message:'Could not load the anatomy.');}})();
  // Screen area left for the anatomy, measured from the overlaid UI: below the title, above the footer (and mobile Systems button), right of the desktop Systems panel.
  const openArea=()=>{
   const w=el.clientWidth,h=el.clientHeight,mobile=w<768,hostRect=el.getBoundingClientRect(),rect=(q:string)=>{const r=document.querySelector(q)?.getBoundingClientRect();return r&&r.width>0&&r.height>0?r:null;};
   const header=rect('.identity'),footer=rect('.studio-footer'),fab=rect('.systems-fab'),panel=mobile?null:rect('.layers-panel:not(.mobile-open)');
   const top=header?header.bottom-hostRect.top+16:16,bottom=Math.min(footer?footer.top-hostRect.top-12:h-16,fab?fab.top-hostRect.top-12:h),left=panel?panel.right-hostRect.left+24:16,right=w-(mobile?16:24);
   return {w,h,left,right:Math.max(left+150,right),top,bottom:Math.max(top+40,bottom)};
  };
  const bodyBox=new T.Box3();bounds.forEach(b=>bodyBox.union(b));
  const fitPoints=[...Array.from({length:8},(_,k)=>new T.Vector3(k&1?bodyBox.max.x:bodyBox.min.x,k&2?bodyBox.max.y:bodyBox.min.y,k&4?bodyBox.max.z:bodyBox.min.z)),...Array.from({length:32},(_,k)=>new T.Vector3(Math.cos(k/32*Math.PI*2)*.7,-.03,Math.sin(k/32*Math.PI*2)*.7))];
  const fitCenter=new T.Box3().setFromPoints(fitPoints).getCenter(new T.Vector3());
  const fitDirection=new T.Vector3(.35,.06,1).normalize(),fitProjected=new T.Vector3(),probe=new T.PerspectiveCamera();
  type Pose={target:T.Vector3;position:T.Vector3;ox:number;oy:number};let flight:{t0:number;from:Pose;to:Pose}|null=null;
  const setOffset=(ox:number,oy:number)=>{const w=el.clientWidth,h=el.clientHeight;camera.setViewOffset(w,h,ox,oy,w,h);};
  const currentPose=():Pose=>({target:controls.target.clone(),position:camera.position.clone(),ox:camera.view?.enabled?camera.view.offsetX:0,oy:camera.view?.enabled?camera.view.offsetY:0});
  const applyPose=(p:Pose)=>{flight=null;controls.target.copy(p.target);camera.position.copy(p.position);setOffset(p.ox,p.oy);controls.update();dirty=true;};
  const flyTo=(to:Pose)=>{flight={t0:performance.now(),from:currentPose(),to};dirty=true;};
  const defaultPose=():Pose=>{
   // Default three-quarter view: scale the distance until the body (width) and body + platform (height) fill the open area, then use the view offset to center their projection in it.
   const {w,h,left,right,top,bottom}=openArea();probe.copy(camera);probe.clearViewOffset();
   let distance=4,x0=0,x1=0,y0=0,y1=0;
   for(let k=0;k<7;k++){
    probe.position.copy(fitCenter).addScaledVector(fitDirection,distance);probe.lookAt(fitCenter);probe.updateMatrixWorld();x0=y0=Infinity;x1=y1=-Infinity;
    fitPoints.forEach((p,n)=>{fitProjected.copy(p).project(probe);const sx=(fitProjected.x+1)*w/2,sy=(1-fitProjected.y)*h/2;if(n<8){x0=Math.min(x0,sx);x1=Math.max(x1,sx);}y0=Math.min(y0,sy);y1=Math.max(y1,sy);});
    if(k<6)distance*=Math.max((x1-x0)/(right-left),(y1-y0)/(bottom-top))/.98;
   }
   return {target:fitCenter.clone(),position:probe.position.clone(),ox:(x0+x1)/2-(left+right)/2,oy:(y0+y1)/2-(top+bottom)/2};
  };
  const fit=()=>applyPose(defaultPose());
  const resize=()=>{renderer.setPixelRatio(Math.min(devicePixelRatio,el.clientWidth<768||el.clientHeight<600?1.5:2));camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);fit();};const observer=new ResizeObserver(resize);observer.observe(el);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),tap=new PointerTap(),hitPoint=new T.Vector3(),plane=new T.Plane(),forward=new T.Vector3();
  // Nearest visible part under a screen point (the translucent body surface only counts when nothing solid is showing). setFromCamera uses the camera's view offset, matching the rendered image.
  const pick=(clientX:number,clientY:number):{index:number;point:T.Vector3|null}=>{
   const rect=renderer.domElement.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
   let nearest=Infinity,found=-1,point:T.Vector3|null=null;const hasSolid=atlas.parts.some((p,i)=>p.system!=='integumentary'&&data[i*4+3]>.5);
   pickers.forEach((mesh,i)=>{if(!mesh||data[i*4+3]<.5||(hasSolid&&atlas.parts[i].system==='integumentary'))return;if(!raycaster.ray.intersectBox(bounds[i],hitPoint))return;const hits=raycaster.intersectObject(mesh,false);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;found=i;point=hits[0].point.clone();}});
   return {index:found,point};
  };
  // Re-center orbit and zoom on a world point without moving the camera: aim at it, then shift the principal point so it stays at the same pixel.
  const pivotAt=(clientX:number,clientY:number,fallback:boolean)=>{
   flight=null;let {point}=pick(clientX,clientY);
   if(!point&&fallback){camera.getWorldDirection(forward);plane.setFromNormalAndCoplanarPoint(forward,controls.target);point=raycaster.ray.intersectPlane(plane,new T.Vector3());}
   if(!point)return;const rect=el.getBoundingClientRect(),w=el.clientWidth,h=el.clientHeight;
   controls.target.copy(point);camera.lookAt(point);setOffset(w/2-(clientX-rect.left),h/2-(clientY-rect.top));controls.update();dirty=true;
  };
  // Double-click / double-tap: fly to frame the part under the pointer, or back to the default view on empty space.
  const focusPart=(index:number)=>{
   const box=bounds[index],center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),area=openArea(),sheet=document.querySelector('.detail-sheet')?.getBoundingClientRect();let {w,h,left,right,top,bottom}=area;
   if(sheet&&sheet.width>0){if(w<768)bottom=Math.min(bottom,sheet.top-16);else right=Math.min(right,sheet.left-20);}
   const availableWidth=Math.max(150,right-left),availableHeight=Math.max(40,bottom-top),distance=Math.max(controls.minDistance*2,Math.max(size.y*h/availableHeight,size.x*w/availableWidth/camera.aspect,size.z)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*2.4);
   const direction=camera.position.clone().sub(controls.target).normalize();
   flyTo({target:center,position:center.clone().addScaledVector(direction,distance),ox:w/2-(left+right)/2,oy:h/2-(top+bottom)/2});
  };
  const touches=new Map<number,{x:number;y:number}>();let lastTap:{t:number;x:number;y:number}|null=null;
  const down=(e:PointerEvent)=>{
   tap.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?12:5);flight=null;
   if(e.pointerType==='touch'){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});const pts=[...touches.values()];if(pts.length===1)pivotAt(e.clientX,e.clientY,false);else if(pts.length===2)pivotAt((pts[0].x+pts[1].x)/2,(pts[0].y+pts[1].y)/2,true);}
   else if(e.button===0&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)pivotAt(e.clientX,e.clientY,false);
  };
  const move=(e:PointerEvent)=>{tap.move(e.pointerId,e.clientX,e.clientY);if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});};
  const cancel=(e:PointerEvent)=>{tap.cancel(e.pointerId);touches.delete(e.pointerId);};
  const up=(e:PointerEvent)=>{
   touches.delete(e.pointerId);const validTap=tap.up(e.pointerId,e.clientX,e.clientY);if(!validTap||!ready)return;
   const {index}=pick(e.clientX,e.clientY),now=performance.now(),double=!!lastTap&&now-lastTap.t<350&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<(e.pointerType==='touch'?30:8);
   lastTap=double?null:{t:now,x:e.clientX,y:e.clientY};
   if(index>=0)select.current(atlas.parts[index].id);
   if(double){if(index>=0)focusPart(index);else flyTo(defaultPose());}
  };
  const wheel=(e:WheelEvent)=>{if(controls.enabled)pivotAt(e.clientX,e.clientY,true);};
  // Capture phase on the host so the pivot moves before OrbitControls applies the zoom or starts the orbit.
  el.addEventListener('pointerdown',down,{capture:true});el.addEventListener('wheel',wheel,{capture:true,passive:true});
  renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);
  const animate=()=>{
   if(disposed)return;frame=requestAnimationFrame(animate);const s=latest.current;
   if(flight){const {from,to}=flight,k=Math.min(1,(performance.now()-flight.t0)/420),e=1-Math.pow(1-k,3);controls.target.lerpVectors(from.target,to.target,e);camera.position.lerpVectors(from.position,to.position,e);setOffset(T.MathUtils.lerp(from.ox,to.ox,e),T.MathUtils.lerp(from.oy,to.oy,e));if(k>=1)flight=null;dirty=true;}
   if(lastState?.visible!==s.visible||lastState?.selected!==s.selected||lastState?.isolate!==s.isolate){
    const visible=new Set(s.visible),selection=new Set(s.selected);
    atlas.parts.forEach((p,i)=>{const selected=selection.has(p.id);data[i*4+3]=(s.isolate?selected:visible.has(p.system)||selected)?1:0;selectedData[i*4]=selected?255:0;});
    partTexture.needsUpdate=true;selectionTexture.needsUpdate=true;lastState=s;dirty=true;
   }
   const isolateKey=s.isolate?s.selected.join(',')+':'+s.inspectorOpen+':'+camera.aspect:'';
   if(isolateKey!==lastIsolate){
    if(s.isolate){const box=new T.Box3();atlas.parts.forEach((p,i)=>{if(s.selected.includes(p.id))box.union(bounds[i]);});
     if(!box.isEmpty()){const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const area=openArea(),w=area.w,h=area.h,mobile=w<768,landscape=w>h&&h<=600;let {left,right,top,bottom}=area;if(s.inspectorOpen){const sheet=document.querySelector('.detail-sheet')?.getBoundingClientRect();if(landscape)right=w-335;else if(mobile)bottom=(sheet?.top??h*.58-139)-16;else right=(sheet&&sheet.width>0?sheet.left:w-350)-20;}const availableWidth=Math.max(150,right-left),availableHeight=Math.max(40,bottom-top);camera.setViewOffset(w,h,w/2-(left+right)/2,h/2-(top+bottom)/2,w,h);const distance=Math.max(.07,Math.max(size.y*h/availableHeight,size.x*w/availableWidth/camera.aspect,size.z)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*1.35);flight=null;controls.maxDistance=Math.max(15,distance*2);controls.target.copy(center);camera.position.copy(center).add(new T.Vector3(.2,.1,1).normalize().multiplyScalar(distance));controls.update();dirty=true;}
    }else if(lastIsolate)fit();
    lastIsolate=isolateKey;
   }
   ground.visible=platform.visible=ring.visible=innerRing.visible=!s.isolate;controls.update();
   if(dirty){renderer.render(scene,camera);dirty=false;}
  };fit();animate();
  const contextLost=(e:Event)=>{e.preventDefault();onError('The 3D session was paused by your device. Reload to continue.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  return()=>{disposed=true;abort.abort();cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener('pointerdown',down,{capture:true});el.removeEventListener('wheel',wheel,{capture:true});controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.traverse(o=>{if(o instanceof T.Mesh&&!geometries.includes(o.geometry)){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});env.dispose();partTexture.dispose();selectionTexture.dispose();renderer.dispose();renderer.domElement.remove();};
 },[atlas]);
 return <div className="scene" ref={host}/>;
}
