'use client';
import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {decodePart} from './decode';
import {PointerTap} from './pointer-tap';
import {SYSTEMS,type Atlas,type SceneState} from './anatomy';
import IssueDots,{type DotsHandle} from '../health/issue-dots';
import type {Anchor} from '../health/anchors';
import type {Issue} from '../health/types';
import {createFracture,type FractureHandle} from '../fracture/fracture-scene';
import type {createEngine as CreateEngine} from '../timeline/engine';
import type {Rig,Vec3} from '../timeline/types';
import type {CameraCue} from '../timeline/director/types';
import type {Pose as TPose,Focus as TFocus,CueKey} from '../timeline/camera/pose';
import {todayISO} from '../health/dates';
interface Props {atlas:Atlas;state:SceneState;onProgress:(n:number)=>void;onError:(s:string)=>void;issues:Issue[];selectedIssue:string|null;onSelectIssue:(id:string|null)=>void;date?:string;fracture?:boolean;timeline?:{date:string;isolate:string|null;/** v2 director (Task 4 consumes): the camera/ghost cue for this frame. */cue?:CameraCue;/** v2: manual camera input while guided. */onManualCamera?:()=>void};/** Timeline mode: segments.bin, still downloading (the chunks load alongside; decoding waits for it, and it counts as one more unit of progress). */segments?:Promise<ArrayBuffer>;rig?:Rig;/** Timeline mode: the engine factory, passed in so the default page never bundles the engine (atlas-app.tsx imports it dynamically). */createEngine?:typeof CreateEngine}
/** `date` + `fracture` (the /anyhealth/test page) draw the 2009 humerus fracture as of the timeline date; off by default.
 *  `timeline` + `rig` + `segments` + `createEngine` (the /anyhealth/timeline page, read at mount) hand the body to the timeline engine (app/anyhealth/timeline/engine.ts): growth warp, issue effects, Isolate. Visibility then goes through the engine only. Off by default. */
export default function AnatomyScene({atlas,state,onProgress,onError,issues,selectedIssue,onSelectIssue,date,fracture=false,timeline,segments,rig,createEngine}:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(state),dots=useRef<DotsHandle|null>(null);
 latest.current=state;
 const latestDate=useRef({date,fracture});latestDate.current={date,fracture};
 const latestTimeline=useRef({timeline});latestTimeline.current={timeline};
 useEffect(()=>{
  const el=host.current!;let disposed=false,frame=0,dirty=true,ready=false;
  let lastState:SceneState|null=null,fx:FractureHandle|null=null,fxTried=false;
  // Timeline camera (v2): the last pose this scene set (null once anything else moved the camera), and whether a controls change is our own.
  let lastPose:TPose|null=null,selfPose=false;
  const abort=new AbortController();
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{onError('This browser could not start the 3D viewer. Please try a browser with WebGL enabled.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<768?1.5:2));renderer.setClearColor('#f2f3f3');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive human anatomy. Drag to orbit, shift-drag or two fingers to pan, scroll or pinch to zoom toward the pointer, and double-click to focus.');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.005,100),controls=new OrbitControls(camera,renderer.domElement);
  camera.position.set(1.4,1.05,3.6);controls.target.set(0,.85,0);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=.02;controls.maxDistance=15;controls.screenSpacePanning=true;controls.mouseButtons={LEFT:T.MOUSE.ROTATE,MIDDLE:null,RIGHT:null};controls.touches={ONE:T.TOUCH.ROTATE,TWO:T.TOUCH.DOLLY_PAN};controls.maxPolarAngle=Math.PI*.96;controls.addEventListener('change',()=>{dirty=true;if(!selfPose)lastPose=null;});
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xffffff,0xa7acb2,1.05));
  const key=new T.DirectionalLight(0xfffaf4,2.3);key.position.set(-2,4,3);scene.add(key);
  const rim=new T.DirectionalLight(0xe9f0ff,1.8);rim.position.set(2,2,-3);scene.add(rim);
  const ground=new T.Mesh(new T.CircleGeometry(30,96),new T.MeshStandardMaterial({color:0xd5d9dc,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.019;scene.add(ground);
  const platform=new T.Mesh(new T.CylinderGeometry(.68,.7,.028,100),new T.MeshStandardMaterial({color:0xeeeeec,metalness:.12,roughness:.67}));platform.position.y=-.016;scene.add(platform);
  const ring=new T.Mesh(new T.RingGeometry(.63,.632,128),new T.MeshBasicMaterial({color:0x8c969f,transparent:true,opacity:.4,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.001;scene.add(ring);
  const innerRing=new T.Mesh(new T.RingGeometry(.55,.551,128),new T.MeshBasicMaterial({color:0xa4aeb8,transparent:true,opacity:.16,side:T.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.001;scene.add(innerRing);
  const width=T.MathUtils.ceilPowerOfTwo(atlas.parts.length),data=new Float32Array(width*4),partTexture=new T.DataTexture(data,width,1,T.RGBAFormat,T.FloatType);partTexture.needsUpdate=true;
  const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[],pickers:(T.Mesh|undefined)[]=[];
  const bounds=atlas.parts.map(p=>new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1])));
  // Timeline mode: the engine is created once segments.bin arrives (chunks download meanwhile, and decode after it); materials made before then are patched on creation.
  const timelineOn=!!(timeline&&rig&&segments&&createEngine),units=atlas.chunks.length+(timelineOn?1:0);let loaded=0;const report=()=>onProgress(Math.round(loaded/units*100));
  let engine=null as ReturnType<typeof CreateEngine>|null;const engineReady=timelineOn?segments!.then(buf=>{if(disposed)return;engine=createEngine!({atlas,scene,bounds,rig:rig!,segments:buf,renderer});mats.forEach((m,system)=>engine!.patchMaterial(m,{partFx:true,soft:['muscular','integumentary','connective'].includes(system)}));loaded++;report();}):null;engineReady?.catch(()=>{/* reported by the chunk loader, which awaits it */});
  // Timeline mode: picking treats a part as visible by the engine's final fx visibility (switches, Isolate and issue effects such as a hidden fractured bone or an unerupted tooth).
  let lastIsolate:string|null=null,seenDate='',dateAt=0,settled=true,prefetched=false;const shown=(i:number)=>(engine?engine.partVisible(i):data[i*4+3])>.5;
  const materialFor=(system:string)=>{
   const m=new T.MeshStandardMaterial({color:SYSTEMS.find(s=>s.id===system)?.mesh??'#aebbb8',metalness:.08,roughness:.53,side:T.DoubleSide,transparent:system==='integumentary',opacity:system==='integumentary'?.1:1,depthWrite:system!=='integumentary'});
   m.onBeforeCompile=shader=>{
    shader.uniforms.partState={value:partTexture};shader.uniforms.stateWidth={value:width};
    shader.vertexShader='attribute float partIndex; uniform sampler2D partState; uniform float stateWidth; varying float partVisible;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); partVisible = state.w;');
    shader.fragmentShader='varying float partVisible;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;');
   };materials.push(m);return m;
  };
  const mats=new Map(SYSTEMS.map(s=>[s.id,materialFor(s.id)]));
  const loadChunk=async(ci:number)=>{
   const chunk=atlas.chunks[ci];const response=await fetch(chunk.url,{signal:abort.signal});if(!response.ok)throw new Error('An anatomy file could not be loaded.');const buffer=await response.arrayBuffer();if(buffer.byteLength!==chunk.bytes)throw new Error('An anatomy file was incomplete. Please reload the viewer.');await MeshoptDecoder.ready;if(engineReady)await engineReady;if(disposed)return;
   const groups=new Map<string,T.BufferGeometry[]>();
   atlas.parts.forEach((p,i)=>{
    if(p.chunk!==ci)return;
    const {position,normal,index}=decodePart(buffer,p,MeshoptDecoder);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(position,3));
    // GPU normalized signed-byte normals keep the complete atlas compact in memory.
    g.setAttribute('normal',new T.BufferAttribute(normal,3,true));g.setIndex(new T.BufferAttribute(index,1));
    g.boundingBox=bounds[i].clone();g.computeBoundingSphere();const pick=new T.Mesh(g);pick.matrixAutoUpdate=false;pickers[i]=pick;geometries.push(g);
    g.setAttribute('partIndex',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i),1));
    if(engine)g.setAttribute('seg',engine.segAttribute(i));
    const list=groups.get(p.system)??[];list.push(g);groups.set(p.system,list);
   });
   groups.forEach((gs,system)=>{const geometry=mergeGeometries(gs,false);if(!geometry)throw new Error('Could not assemble anatomy geometry.');geometries.push(geometry);const mesh=new T.Mesh(geometry,mats.get(system as never));mesh.frustumCulled=false;scene.add(mesh);});
   lastState=null;loaded++;report();dirty=true;
  };
  (async()=>{try{let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<atlas.chunks.length){const i=cursor++;await loadChunk(i);}}));if(!disposed){ready=true;dirty=true;if(engine){engine.ready(pickers);/* ghost-pass twins compile now, not on the first approach */engine.prewarm(renderer,scene,camera).catch(e=>console.warn('AnyHealth: ghost prewarm',e));settled=false;}}}catch(e){if(!disposed)onError(e instanceof Error?e.message:'Could not load the anatomy.');}})();
  // Width of the issue panel's right footprint (--issue-panel-w + --panel-inset on .studio), resolved through a probe so calc()/min()/vw values work. 0 when the properties are unset.
  const issueFootprint=()=>{
   const studio=document.querySelector('.studio');if(!(studio instanceof HTMLElement))return 0;const cs=getComputedStyle(studio);
   if(!cs.getPropertyValue('--issue-panel-w').trim())return 0;const probe=document.createElement('div');
   probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;height:0;width:calc(var(--issue-panel-w) + var(--panel-inset, 0px))';
   studio.appendChild(probe);const px=probe.getBoundingClientRect().width;probe.remove();return px;
  };
  // Screen area left for the anatomy, measured from the overlaid UI: below the title, above the footer, timeline and body stats (and mobile Systems button), between the desktop Systems panel and the issue panel's footprint.
  // `sheet` (timeline focus poses on phones): also clear the tracker bottom sheet at its expanded height (tracker.css: 60dvh, opened at a hold).
  const openArea=(sheet=false)=>{
   const w=el.clientWidth,h=el.clientHeight,mobile=w<768,hostRect=el.getBoundingClientRect(),rect=(q:string)=>{const r=document.querySelector(q)?.getBoundingClientRect();return r&&r.width>0&&r.height>0?r:null;};
   const header=rect('.identity'),footer=rect('.studio-footer'),fab=rect('.systems-fab'),panel=mobile?null:rect('.layers-panel:not(.mobile-open)'),timeline=rect('.timeline-panel'),stats=rect('.body-stats');
   const top=header?header.bottom-hostRect.top+16:16;let bottom=Math.min(footer?footer.top-hostRect.top-12:h-16,fab?fab.top-hostRect.top-12:h,timeline?timeline.top-hostRect.top-12:h,stats?stats.top-hostRect.top-8:h);const left=panel?panel.right-hostRect.left+24:16;
   // Desktop: reserve the issue panel's footprint on the right, open or not, so the body sits centred between the panels and never jumps. Fallbacks: the rendered panel, then a mirror of the Systems panel.
   let right=w-(mobile?16:24);const tracker=sheet&&mobile?rect('.studio.timeline .issue-tracker'):null;if(tracker)bottom=Math.min(bottom,tracker.bottom-hostRect.top-innerHeight*.6-12);
   if(!mobile){const foot=issueFootprint(),issue=foot>0?null:rect('.issue-panel');right=foot>0?w-foot-24:issue?issue.left-hostRect.left-24:panel?w-(panel.right-hostRect.left)-24:right;}
   return {w,h,left,right:Math.max(left+150,right),top,bottom:Math.max(top+40,bottom)};
  };
  const bodyBox=new T.Box3();bounds.forEach(b=>bodyBox.union(b));
  // Issue dots: each anchor resolves once (after every chunk is decoded) to the vertex of its part nearest the hint, or the part's bounds centre. Meshes sit untransformed in the scene, so these model-space vertices are world positions.
  const partsByName=new Map<string,number[]>();atlas.parts.forEach((p,i)=>{const l=partsByName.get(p.name)??[];l.push(i);partsByName.set(p.name,l);});
  const anchorPoints=new Map<string,T.Vector3|null>(),dotPoint=new T.Vector3();let cssW=el.clientWidth||1,cssH=el.clientHeight||1,dotRefDistance=3;
  const resolveAnchor=(key:string,a:Anchor)=>{
   if(!ready)return null;if(anchorPoints.has(key))return anchorPoints.get(key)!;const ids=partsByName.get(a.part)??[],box=new T.Box3();ids.forEach(i=>box.union(bounds[i]));
   const target=a.hint?new T.Vector3().fromArray(a.hint):box.getCenter(new T.Vector3());let best:T.Vector3|null=null,bd=Infinity;
   ids.forEach(i=>{const pos=pickers[i]?.geometry.getAttribute('position');if(!pos)return;const arr=pos.array as Float32Array;for(let v=0;v<arr.length;v+=3){const dx=arr[v]-target.x,dy=arr[v+1]-target.y,dz=arr[v+2]-target.z,d=dx*dx+dy*dy+dz*dz;if(d<bd){bd=d;best=(best??new T.Vector3()).set(arr[v],arr[v+1],arr[v+2]);}}});
   if(!best&&!ids.length)console.warn('AnyHealth: no part named',a.part);anchorPoints.set(key,best);return best;
  };
  // CSS pixel position in the canvas: project() uses the projection matrix, which includes the view offset. Points behind the camera, and dots whose system is switched off, are hidden.
  // `scale` is the anchor's on-screen size relative to the body centre in the default view (camera depth ratio), so dots grow and shrink with the scene.
  const projectDot=(key:string,a:Anchor)=>{if(!latest.current.visible.includes(a.system))return null;const p=resolveAnchor(key,a);if(!p)return null;const depth=-dotPoint.copy(p).applyMatrix4(camera.matrixWorldInverse).z;if(depth<=0)return null;dotPoint.copy(p).project(camera);return {x:(dotPoint.x+1)/2*cssW,y:(1-dotPoint.y)/2*cssH,scale:dotRefDistance/depth};};
  const fitPoints=[...Array.from({length:8},(_,k)=>new T.Vector3(k&1?bodyBox.max.x:bodyBox.min.x,k&2?bodyBox.max.y:bodyBox.min.y,k&4?bodyBox.max.z:bodyBox.min.z)),...Array.from({length:32},(_,k)=>new T.Vector3(Math.cos(k/32*Math.PI*2)*.7,-.03,Math.sin(k/32*Math.PI*2)*.7))];
  const fitCenter=new T.Box3().setFromPoints(fitPoints).getCenter(new T.Vector3());
  // fitDirection and the /.98 fill below are mirrored by DEFAULT_DIRECTION / DEFAULT_FILL in timeline/camera/pose.ts (the timeline's growth framing): keep them in step.
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
   dotRefDistance=distance;
   return {target:fitCenter.clone(),position:probe.position.clone(),ox:(x0+x1)/2-(left+right)/2,oy:(y0+y1)/2-(top+bottom)/2};
  };
  const fit=()=>applyPose(defaultPose());
  const resize=()=>{cssW=el.clientWidth;cssH=el.clientHeight;renderer.setPixelRatio(engine?.stats().lowRes?1:Math.min(devicePixelRatio,el.clientWidth<768||el.clientHeight<600?1.5:2));camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);
   // Timeline camera: refit the adult and focus poses next frame; a camera the user placed keeps its place (its view offset re-set for the new size).
   if(P){adult=null;stop.pose=null;isoPose=null;lastPose=null;if(userMoved&&!tflight){const c=currentPose();setOffset(c.ox,c.oy);}dirty=true;}else fit();};const observer=new ResizeObserver(resize);observer.observe(el);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),tap=new PointerTap(),hitPoint=new T.Vector3(),plane=new T.Plane(),forward=new T.Vector3();
  // Nearest visible part under a screen point (the translucent body surface only counts when nothing solid is showing). setFromCamera uses the camera's view offset, matching the rendered image.
  const pick=(clientX:number,clientY:number):{index:number;point:T.Vector3|null}=>{
   const rect=renderer.domElement.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
   engine?.finishSettle();let nearest=Infinity,found=-1,point:T.Vector3|null=null;const hasSolid=atlas.parts.some((p,i)=>p.system!=='integumentary'&&shown(i));
   pickers.forEach((mesh,i)=>{if(!mesh||!shown(i)||(hasSolid&&atlas.parts[i].system==='integumentary'))return;if(!raycaster.ray.intersectBox(bounds[i],hitPoint))return;const hits=raycaster.intersectObject(mesh,false);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;found=i;point=hits[0].point.clone();}});
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
  const focusPart=(index:number)=>focusBox(bounds[index]);
  const focusBox=(box:T.Box3,margin=2.4)=>{
   const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),area=openArea();const {w,h,left,right,top,bottom}=area;
   const availableWidth=Math.max(150,right-left),availableHeight=Math.max(40,bottom-top),distance=Math.max(controls.minDistance*2,Math.max(size.y*h/availableHeight,size.x*w/availableWidth/camera.aspect,size.z)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*margin);
   const direction=camera.position.clone().sub(controls.target).normalize();
   flyTo({target:center,position:center.clone().addScaledVector(direction,distance),ox:w/2-(left+right)/2,oy:h/2-(top+bottom)/2});
  };
  // Timeline camera (spec 2026-09-26 §4; timeline mode only, once the pose math has loaded with the engine chunk, so /anyhealth never bundles it). One pure pose per frame, no springs:
  // scripted = the posed path from defaultPoseFor(day) (growth framing) to the stop's focus pose by cue.zoom (0 in free mode: the default pose); a timed rejoin blends from the actual camera after manual input, a guided/free switch or a guided seek (cue.seq, pose.ts needsRejoin);
  // a flight (manual Isolate, Show all, double-click) runs the posed path over ISOLATE_FLY_MS. Manual input (a drag past the tap slop, pinch, wheel, double-click on a part) hands the camera to the user.
  // The rendered focus (id + ghost for the engine) never steps: a seek, a guided/free switch or any jump in the wanted focus hands over from the last rendered one over the rejoin window (pose.ts blendFocus).
  // prefers-reduced-motion (read at mount and on change): flights and rejoins last REDUCED_MOTION_MS; the director's schedule already cuts its zoom.
  const STILL_MS=150,FOCUS_JUMP=.25;let P:typeof import('../timeline/camera/pose')|null=null,viewOf:(id:string)=>Vec3|null=()=>null,boxDay:(id:string,cueDay:number)=>number=(_,d)=>d;
  const motion=timelineOn&&typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;let reduced=!!motion?.matches;const onMotion=()=>{reduced=!!motion?.matches;};motion?.addEventListener?.('change',onMotion);
  const flyMs=()=>reduced?P!.REDUCED_MOTION_MS:P!.ISOLATE_FLY_MS,rejoinMs=()=>reduced?P!.REDUCED_MOTION_MS:P!.REJOIN_MS;
  if(timelineOn)Promise.all([import('../timeline/camera/pose'),import('../timeline/issues')]).then(([m,issues])=>{if(disposed)return;P=m;viewOf=id=>issues.scriptFor(id)?.view??null;const end=m.dayOfDate(todayISO());boxDay=(id,d)=>m.stopBoxDay(id,d,issues.scriptFor,end);lastPose=null;dirty=true;
   // Blend from the v1 fit() pose the scene started with instead of snapping.
   if(!userMoved)rejoin={t0:performance.now(),from:nowPose()};}).catch(()=>{/* keep the v1 camera */});
  const restBody={min:bodyBox.min.toArray() as Vec3,max:bodyBox.max.toArray() as Vec3},boxOf=(b:T.Box3)=>({min:b.min.toArray() as Vec3,max:b.max.toArray() as Vec3});
  let todayDay=0,cueSig='',stillSince=0,adult:TPose|null=null,scripted:TPose|null=null,userMoved=false,armed=false,lastKey:CueKey|null=null,rejoin:{t0:number;from:TPose}|null=null,tflight:{t0:number;ms:number;from:TPose;to:()=>TPose;end?:()=>void}|null=null;
  // The stop being approached / held / released: its focus box frozen at the first frame with that stop (at that frame's day), its pose refitted on resize.
  let stop:{id:string|null;day:number;box:T.Box3|null;pose:TPose|null}={id:null,day:0,box:null,pose:null};
  // Manual Isolate: ghost fades from → to over ISOLATE_FADE_MS; the camera flies once the engine has the box.
  let iso:{id:string|null;from:number;to:number;t0:number}={id:null,from:0,to:0,t0:0},isoSeen:string|null=null,isoFly=false,isoBox:T.Box3|null=null,isoPose:TPose|null=null,lastFocus:TFocus|null=null;
  // Focus handover: the wanted focus last frame, and the blend from the rendered focus at its start.
  let lastWant:TFocus|null=null,fblend:{t0:number;from:TFocus|null}|null=null;
  let press:{id:number;x:number;y:number;th:number}|null=null,pending:{x:number;y:number;fallback:boolean}|null=null;
  const nowPose=():TPose=>{const c=currentPose();return {target:c.target.toArray() as Vec3,position:c.position.toArray() as Vec3,ox:c.ox,oy:c.oy};};
  const samePose=(a:TPose,b:TPose)=>a.ox===b.ox&&a.oy===b.oy&&a.target.every((v,i)=>v===b.target[i])&&a.position.every((v,i)=>v===b.position[i]);
  // Set the camera without OrbitControls smearing it: flush any leftover input deltas with damping off, then set the pose exactly.
  const setPose=(p:TPose)=>{if(lastPose&&samePose(lastPose,p))return;flight=null;selfPose=true;controls.enableDamping=false;controls.update();controls.target.fromArray(p.target);camera.position.fromArray(p.position);setOffset(p.ox,p.oy);controls.update();selfPose=false;lastPose=p;dirty=true;};
  /** The camera follows a script (guided or free, or a flight is running): pointer-down pivots wait until the input is really manual. */
  const driven=()=>!!P&&!!latestTimeline.current.timeline&&(!userMoved||!!tflight);
  const manual=()=>{
   if(!driven())return;userMoved=true;armed=false;rejoin=null;tflight=null;controls.enableDamping=true;const tl=latestTimeline.current.timeline;if(tl?.cue?.guided)tl.onManualCamera?.();
   if(pending){const p=pending;pending=null;pivotAt(p.x,p.y,p.fallback);}
  };
  // Show all / double-click empty: fly to the scripted pose as it is at the start (a snapshot, so a scrub mid-flight never retargets it), then rejoin the live script from there.
  const backTo=(now:number)=>{const to=scripted!;return {t0:now,ms:flyMs(),from:nowPose(),to:()=>to,end:()=>{if(!userMoved)rejoin={t0:performance.now(),from:nowPose()};}};};
  const flyStep=(now:number)=>{const f=tflight!,k=(now-f.t0)/f.ms,to=f.to();if(k>=1){tflight=null;setPose(to);f.end?.();}else setPose(P!.lerpPose(f.from,to,P!.smootherstep(0,1,k)));};
  /** The focus to render this frame: `want`, unless a handover is running (started by `restart` or by a jump in `want`), then the blend from the focus rendered when it began. */
  const focusOut=(want:TFocus|null,now:number,restart:boolean):TFocus|null=>{
   const M=P!;if(restart||M.focusGap(lastWant,want)>FOCUS_JUMP)fblend={t0:now,from:lastFocus};lastWant=want;
   if(fblend){const k=(now-fblend.t0)/rejoinMs();if(k<1)return M.blendFocus(fblend.from,want,k);fblend=null;}
   return want;
  };
  /** One timeline camera frame: poses the camera and returns the focus (id + ghost) for the engine. */
  const tlFrame=(tl:NonNullable<Props['timeline']>,now:number):TFocus|null=>{
   const M=P!,cue=tl.cue,guided=!!cue?.guided,day=cue?cue.day:M.dayOfDate(tl.date);
   if(!adult){todayDay=M.dayOfDate(todayISO());adult=M.adultPose(restBody,todayDay,camera.fov,openArea());}
   // The focus box is frozen at the first frame of the stop (its approach start), taken at the stop's climax day, where it holds. Free mode (a scrub) has no stop: no box work while dragging.
   const id=guided?cue?.stop?.id??null:null,fresh=id!==stop.id;if(fresh)stop={id,day:id?boxDay(id,day):day,box:null,pose:null};
   if(id&&!stop.box){const b=engine?.focusBox(id,stop.day)??null;stop.box=b&&!b.isEmpty()?b:null;
    // The box arrived late (engine not ready at approach start) with the zoom already under way: rejoin rather than jump.
    if(stop.box&&!fresh&&cue!.zoom>0&&!userMoved&&!tflight)rejoin={t0:now,from:nowPose()};}
   if(stop.box&&!stop.pose)stop.pose=M.focusPose(boxOf(stop.box),cue!.stop!.view,camera.fov,openArea(true),controls.minDistance*2);
   const def=M.defaultPoseFor(adult,day,todayDay);scripted=stop.pose&&cue!.zoom>0?M.lerpPose(def,stop.pose,cue!.zoom):def;
   // Guided ↔ free (a scrub or reset), or a seek while guided (a stop tick from a hold), with the camera still scripted: blend from where it is (the new shot would otherwise cut, zoom 1 → 0 at another day). The rendered focus hands over too, camera scripted or not.
   const key={seq:cue?.seq??0,guided},seek=M.needsRejoin(lastKey,key);lastKey=key;if(seek&&!userMoved&&!tflight)rejoin={t0:now,from:nowPose()};
   // After manual input, guided posing resumes (Play / Continue / a stop tick) when the sample moves again after the director has been still (paused from play, or holding: guided stays true, the sample frozen) for STILL_MS,
   // or after free mode (scrub): rejoin from the actual camera. The stillness wait keeps the frame or two before the director's pause lands from counting as a resume.
   const sig=cue?`${cue.day}|${cue.zoom}|${cue.ghost}|${cue.phase}|${id}`:'',moved=sig!==cueSig;if(moved){cueSig=sig;stillSince=now;}
   if(userMoved&&(!guided||now-stillSince>=STILL_MS))armed=true;
   if(guided&&userMoved&&armed&&moved){userMoved=armed=false;tflight=null;rejoin={t0:now,from:nowPose()};}
   // Manual Isolate (the tracker button; the director is paused or free): a ghost fade and a posed flight in, the camera then the user's; Show all flies back to the script.
   if(tl.isolate!==isoSeen){
    isoSeen=tl.isolate;iso={id:tl.isolate??lastFocus?.id??null,from:lastFocus?.ghost??0,to:tl.isolate?1:0,t0:now};isoFly=!!tl.isolate;
    if(!tl.isolate){userMoved=false;rejoin=null;tflight=backTo(now);}
   }
   if(isoFly&&tl.isolate){const b=engine?.focusBox(tl.isolate,day)??null;if(b&&!b.isEmpty()){const view=viewOf(tl.isolate);isoFly=false;isoBox=b;isoPose=null;rejoin=null;tflight={t0:now,ms:flyMs(),from:nowPose(),to:()=>isoPose??=M.focusPose(boxOf(isoBox!),view,camera.fov,openArea(true),controls.minDistance*2),end:()=>{userMoved=true;}};}}
   if(tflight)flyStep(now);
   else if(!userMoved){let p=scripted;if(rejoin){const k=(now-rejoin.t0)/rejoinMs();if(k>=1)rejoin=null;else p=M.lerpPose(rejoin.from,p,M.smootherstep(0,1,k));}setPose(p);}
   controls.enableDamping=userMoved&&!tflight;
   // Show all while a stop is focused (at a hold, say) hands back to the cue's focus instead of fading everything solid first (focusOut blends the id change).
   if(iso.id&&iso.to===0&&id&&cue!.ghost>0)iso.id=null;
   let want:TFocus|null=id&&cue!.ghost>0?{id,ghost:cue!.ghost}:null;
   if(iso.id){const ghost=iso.from+(iso.to-iso.from)*M.smootherstep(0,M.ISOLATE_FADE_MS,now-iso.t0);if(ghost>0||iso.to>0)want={id:iso.id,ghost};else iso.id=null;}
   return focusOut(want,now,seek);
  };
  const touches=new Map<number,{x:number;y:number}>();let lastTap:{t:number;x:number;y:number}|null=null;
  const down=(e:PointerEvent)=>{
   tap.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?12:5);flight=null;
   // Timeline, camera scripted: a press is not yet manual (a tap must not pause the director); the pivot waits for the drag to pass the tap slop. A pinch is manual at once.
   const pivot=(x:number,y:number,fallback:boolean)=>{if(driven())pending={x,y,fallback};else pivotAt(x,y,fallback);};
   if(e.pointerType==='touch'||e.button===0)press=driven()?{id:e.pointerId,x:e.clientX,y:e.clientY,th:e.pointerType==='touch'?12:5}:null;
   if(e.pointerType==='touch'){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});const pts=[...touches.values()];if(pts.length===1)pivot(e.clientX,e.clientY,false);else if(pts.length===2){pending=null;manual();pivotAt((pts[0].x+pts[1].x)/2,(pts[0].y+pts[1].y)/2,true);}}
   else if(e.button===0&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)pivot(e.clientX,e.clientY,false);
  };
  const move=(e:PointerEvent)=>{tap.move(e.pointerId,e.clientX,e.clientY);if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(press&&press.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>press.th){press=null;manual();}};
  const release=(id:number)=>{if(press?.id===id){press=null;pending=null;}};
  const cancel=(e:PointerEvent)=>{tap.cancel(e.pointerId);touches.delete(e.pointerId);release(e.pointerId);};
  const up=(e:PointerEvent)=>{
   touches.delete(e.pointerId);release(e.pointerId);const validTap=tap.up(e.pointerId,e.clientX,e.clientY);if(!validTap||!ready)return;
   const {index}=pick(e.clientX,e.clientY),now=performance.now(),double=!!lastTap&&now-lastTap.t<350&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<(e.pointerType==='touch'?30:8);
   lastTap=double?null:{t:now,x:e.clientX,y:e.clientY};
   if(double&&P){
    // Timeline: a part flies there on the posed path (manual: pauses the director); empty space returns to the script (guided: a rejoin; free: a flight to the scripted pose, which it then follows).
    const M=P,tl=latestTimeline.current.timeline;
    if(index>=0){manual();userMoved=true;rejoin=null;const box=boxOf(bounds[index]),dir=camera.position.clone().sub(controls.target).normalize().toArray() as Vec3;let to:TPose|null=null;tflight={t0:now,ms:flyMs(),from:nowPose(),to:()=>to??=M.fitPose(box,dir,camera.fov,openArea(),1/2.4,controls.minDistance*2)};}
    else if(tl?.cue?.guided){if(userMoved){userMoved=armed=false;tflight=null;rejoin={t0:now,from:nowPose()};}}
    else if(scripted){userMoved=false;rejoin=null;tflight=backTo(now);}
   }
   else if(double){if(index>=0)focusPart(index);else flyTo(defaultPose());}
  };
  const wheel=(e:WheelEvent)=>{if(controls.enabled){pending=null;manual();pivotAt(e.clientX,e.clientY,true);}};
  // Capture phase on the host so the pivot moves before OrbitControls applies the zoom or starts the orbit.
  el.addEventListener('pointerdown',down,{capture:true});el.addEventListener('wheel',wheel,{capture:true,passive:true});
  renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);
  const animate=()=>{
   if(disposed)return;frame=requestAnimationFrame(animate);const s=latest.current;
   if(flight){const {from,to}=flight,k=Math.min(1,(performance.now()-flight.t0)/420),e=1-Math.pow(1-k,3);controls.target.lerpVectors(from.target,to.target,e);camera.position.lerpVectors(from.position,to.position,e);setOffset(T.MathUtils.lerp(from.ox,to.ox,e),T.MathUtils.lerp(from.oy,to.oy,e));if(k>=1)flight=null;dirty=true;}
   const tl=latestTimeline.current.timeline;
   if(lastState?.visible!==s.visible||(engine&&tl&&tl.isolate!==lastIsolate)){
    const visible=new Set(s.visible);
    // Timeline mode: partState never discards; the engine writes visibility into its fx texture.
    atlas.parts.forEach((p,i)=>{data[i*4+3]=engine||visible.has(p.system)?1:0;});
    if(engine&&tl)lastIsolate=tl.isolate;
    partTexture.needsUpdate=true;lastState=s;dirty=true;
   }
   // Timeline camera and focus (v2): posed here once the pose math has loaded; the engine gets the story day and the focus (guided cue or manual Isolate fade).
   const focus=tl&&P?tlFrame(tl,performance.now()):null;if(focus?.id!==lastFocus?.id||focus?.ghost!==lastFocus?.ghost)dirty=true;lastFocus=focus;
   if(engine&&tl){
    const now=performance.now();if(tl.date!==seenDate){seenDate=tl.date;dateAt=now;settled=false;}
    const r=engine.update({date:tl.date,day:tl.cue?.day,visible:s.visible,isolate:tl.isolate,now,focus});if(r.changed||r.animating)dirty=true;if(r.fly&&!P)focusBox(r.fly,1.35);
    // Re-warp the picking geometry and bounds once the date has rested for 150 ms, about 4 ms per frame (a pick completes the rest first); after ready() it also runs the focus-box prefetch, so it keeps being called until both are done.
    if(ready&&!settled&&now-dateAt>=150)settled=engine.settleSlice(4);
    // The focus-box prefetch (stop order) also runs 1.5 ms every frame until done, playing or not, so the first approaches never compute a box synchronously.
    if(ready&&!prefetched)prefetched=engine.prefetchSlice(1.5);
   }
   const fd=latestDate.current;if(ready&&fd.fracture&&!fxTried){fxTried=true;fx=createFracture({scene,atlas,pickers,data,partTexture});}
   if(fx){const r=fx.update(fd.fracture?fd.date??'':'',s.visible.includes('skeletal'),performance.now());if(r.changed||r.animating)dirty=true;if(r.fly)focusBox(fx.box,1.35);}
   controls.update();
   if(dirty){renderer.render(scene,camera);if(engine&&focus&&focus.ghost>0)engine.renderGhostPass(renderer,scene,camera);dirty=false;dots.current?.place(projectDot);}else if(dots.current?.stale)dots.current.place(projectDot);
  };fit();animate();
  const contextLost=(e:Event)=>{e.preventDefault();onError('The 3D session was paused by your device. Reload to continue.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  return()=>{disposed=true;motion?.removeEventListener?.('change',onMotion);fx?.dispose();engine?.dispose();abort.abort();cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener('pointerdown',down,{capture:true});el.removeEventListener('wheel',wheel,{capture:true});controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.traverse(o=>{if(o instanceof T.Mesh&&!geometries.includes(o.geometry)){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});env.dispose();partTexture.dispose();renderer.dispose();renderer.domElement.remove();};
 },[atlas]);
 return <><div className="scene" ref={host}/>{!timeline&&<IssueDots issues={issues} selectedIssue={selectedIssue} onSelectIssue={onSelectIssue} handle={dots}/>}</>;
}
