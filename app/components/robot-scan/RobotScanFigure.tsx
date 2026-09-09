"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildRig } from "./buildRig";
import { buildSubject } from "./buildSubject";

type Handle = { reset: () => void; zoom: (factor: number) => void; toggle: () => void };
const button = "flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white/80 backdrop-blur-md transition hover:bg-white/20 hover:text-white disabled:pointer-events-none disabled:opacity-30";
function Icon({ path }: { path: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

/** All scene coordinates are millimetres. The ruler measures the camera target plane. */
export default function RobotScanFigure() {
  const mount = useRef<HTMLDivElement>(null);
  const handle = useRef<Handle | null>(null);
  const [playing, setPlaying] = useState(false);
  const [home, setHome] = useState(true);
  const [hint, setHint] = useState(true);
  const [scale, setScale] = useState({ px: 80, mm: 100 });
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = mount.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.domElement.setAttribute("aria-label", "Orbitable, millimetre-scale model of the AnyDerm robot scanning a person's face");
    renderer.domElement.setAttribute("role", "img");
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#171c22");
    scene.fog = new THREE.Fog("#171c22", 1600, 3000);
    const camera = new THREE.PerspectiveCamera(36, 1, 2, 5000);
    const initialPosition = new THREE.Vector3(870, 380, 500);
    const initialTarget = new THREE.Vector3(0, 145, -15);
    camera.position.copy(initialPosition);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(initialTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 360;
    controls.maxDistance = 1800;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = 0.18;
    controls.update();
    controls.saveState();
    renderer.domElement.style.touchAction = "pan-y";
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.65;
    room.dispose();
    const ambient = new THREE.HemisphereLight(0xdcecff, 0x4d3a29, 0.45);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffecd9, 2.0);
    key.position.set(-380, 750, 450);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -600, right: 600, top: 600, bottom: -600, near: 10, far: 1900 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.9;
    key.shadow.radius = 5;
    key.shadow.blurSamples = 8;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc4dcff, 1.6);
    rim.position.set(300, 370, -500);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(600, 120, 450);
    scene.add(fill);

    const tableGeometry = new THREE.BoxGeometry(760, 28, 500);
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x363e46, roughness: 0.72, metalness: 0.15 });
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.set(0, -14, 190);
    table.receiveShadow = true;
    table.castShadow = true;
    scene.add(table);
    const legGeometry = new THREE.BoxGeometry(28, 672, 28);
    for (const x of [-335, 335]) for (const z of [-15, 395]) {
      const leg = new THREE.Mesh(legGeometry, tableMaterial);
      leg.position.set(x, -364, z);
      leg.castShadow = true;
      scene.add(leg);
    }
    const floorGeometry = new THREE.PlaneGeometry(8000, 8000);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x171c22, roughness: 0.93 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -700;
    floor.receiveShadow = true;
    scene.add(floor);
    const rig = buildRig();
    const subject = buildSubject(() => {
      const face = subject.group.getObjectByName('Original scanned anatomy · uniformly scaled');
      if (face) {
        rig.fitToFace(face);
        rig.update(phase);
      }
      invalidate();
    });
    scene.add(rig.group, subject.group);
    scene.traverse(object => {
      if (object instanceof THREE.Mesh && object !== floor) { object.castShadow = true; object.receiveShadow = true; }
    });
    // A frozen first pose also serves reduced-motion readers.
    let phase = 0.16;
    rig.update(phase);
    let inside = false;
    let wanted = false;
    let autoplayed = false;
    let disposed = false;
    let frame = 0;
    let previous = 0;
    let wheelArmed = false;
    let lastUi = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isActive = () => inside && !document.hidden;
    const syncPlaying = () => setPlaying(isActive() && wanted);
    function updateView() {
      const atHome = camera.position.distanceTo(initialPosition) < 0.6 && controls.target.distanceTo(initialTarget) < 0.6;
      setHome(atHome);
      if (!atHome) setHint(false);
      // Project a physical horizontal segment through the orbit target.
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const a = controls.target.clone().project(camera);
      const b = controls.target.clone().addScaledVector(right, 100).project(camera);
      const pxPerMm = Math.abs(b.x - a.x) * container!.clientWidth / 200;
      const mm = [10, 20, 50, 100, 200, 500].find(n => n * pxPerMm >= 65) ?? 500;
      setScale({ px: mm * pxPerMm, mm });
    }
    function draw(now: number) {
      frame = 0;
      if (disposed) return;
      const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      if (isActive() && wanted) {
        phase = (phase + delta / 28) % 1;
        rig.update(phase);
      }
      controls.update();
      renderer.render(scene, camera);
      if (now - lastUi > 150) { updateView(); lastUi = now; }
      if (isActive() && wanted && !frame) frame = requestAnimationFrame(draw);
    }
    function invalidate() { if (!frame && !disposed) frame = requestAnimationFrame(draw); }
    const observer = new IntersectionObserver(([entry]) => {
      inside = entry.isIntersecting && entry.intersectionRatio >= 0.15;
      if (inside && !autoplayed) { autoplayed = true; wanted = !reduced.matches; }
      previous = 0;
      syncPlaying();
      invalidate();
    }, { threshold: 0.15 });
    observer.observe(container);
    const visibility = () => { previous = 0; syncPlaying(); invalidate(); };
    document.addEventListener("visibilitychange", visibility);
    const motionChange = () => { if (reduced.matches) wanted = false; syncPlaying(); invalidate(); };
    reduced.addEventListener("change", motionChange);
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      updateView();
      invalidate();
    });
    resize.observe(container);
    // Capture before OrbitControls receives the event; page scrolling stays native
    // until the reader deliberately presses this particular canvas.
    const wheel = (event: WheelEvent) => { if (!wheelArmed) event.stopImmediatePropagation(); };
    const pointer = () => { wheelArmed = true; invalidate(); };
    const leave = () => { wheelArmed = false; };
    renderer.domElement.addEventListener("wheel", wheel, { capture: true, passive: true });
    renderer.domElement.addEventListener("pointerdown", pointer);
    renderer.domElement.addEventListener("pointerleave", leave);
    controls.addEventListener("change", invalidate);
    handle.current = {
      reset: () => { controls.reset(); updateView(); invalidate(); },
      zoom: factor => {
        const offset = camera.position.clone().sub(controls.target);
        offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
        camera.position.copy(controls.target).add(offset);
        controls.update(); updateView(); invalidate();
      },
      toggle: () => { wanted = !wanted; syncPlaying(); invalidate(); },
    };
    setReady(true);
    invalidate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect(); resize.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", motionChange);
      renderer.domElement.removeEventListener("wheel", wheel, true);
      renderer.domElement.removeEventListener("pointerdown", pointer);
      renderer.domElement.removeEventListener("pointerleave", leave);
      controls.removeEventListener("change", invalidate);
      controls.dispose(); rig.dispose(); subject.dispose();
      tableGeometry.dispose(); legGeometry.dispose(); tableMaterial.dispose(); floorGeometry.dispose(); floorMaterial.dispose();
      environment.dispose(); pmrem.dispose(); renderer.dispose();
      renderer.domElement.remove();
      handle.current = null;
    };
  }, []);

  return <figure className="!my-8 w-full">
    <div className="relative isolate aspect-square overflow-hidden rounded-2xl border border-white/15 bg-[#171c22] shadow-2xl sm:aspect-[4/3]">
      <div ref={mount} className="absolute inset-0" />
      {(!ready || error) && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">{error ? "This 3D figure needs a browser with WebGL support." : "Preparing the capture rig…"}</div>}
      <div className="pointer-events-none absolute left-5 top-5 hidden text-white sm:block">
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">AnyDerm / capture system</div>
        <div className="mt-1 text-sm font-medium tracking-wide">SO-101 + optical head</div>
      </div>
      <div className="absolute right-4 top-4 flex gap-2">
        <button type="button" className={button} aria-label={playing ? "Pause scan" : "Play scan"} onClick={() => handle.current?.toggle()}><Icon path={playing ? "M8 5v14M16 5v14" : "M8 5l11 7-11 7z"} /></button>
        <button type="button" className={button} disabled={home} aria-label="Reset view" onClick={() => handle.current?.reset()}><Icon path="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></button>
        <button type="button" className={button} aria-label="Zoom in" onClick={() => handle.current?.zoom(0.8)}><Icon path="M5 12h14M12 5v14" /></button>
        <button type="button" className={button} aria-label="Zoom out" onClick={() => handle.current?.zoom(1.25)}><Icon path="M5 12h14" /></button>
      </div>
      <div className="pointer-events-none absolute bottom-5 left-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-white/60"><span className={`h-1.5 w-1.5 rounded-full ${playing ? "bg-emerald-300" : "bg-white/40"}`} />{playing ? "Capture pass" : "Scan paused"}</div>
      <div className="pointer-events-none absolute bottom-5 right-5 text-center text-[10px] tabular-nums text-white/70" title="Physical distance at the centre of the orbit"><div>{scale.mm} mm</div><div style={{ width: scale.px, height: 6 }} className="mt-1 border-x border-b border-white/60" /></div>
      <div className={`pointer-events-none absolute bottom-14 left-0 right-0 text-center text-[11px] text-white/45 transition-opacity duration-700 ${hint ? "opacity-100" : "opacity-0"}`}>Drag to orbit · pinch or + / − to zoom</div>
    </div>
    <figcaption className="!mt-3 flex flex-wrap justify-between gap-2 text-xs text-white/40"><span>Robot, optics, and subject at physical scale.</span><span>Scale measured at the orbit centre.</span></figcaption>
    <p className="mt-2 text-[11px] text-white/35">Head scan: <a href="https://www.triplegangers.com/" className="underline">Infinite, by Lee Perry-Smith</a> · <a href="https://creativecommons.org/licenses/by/3.0/" className="underline">CC BY 3.0</a> · via <a href="https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/LeePerrySmith" className="underline">Three.js</a>.</p>
  </figure>;
}
