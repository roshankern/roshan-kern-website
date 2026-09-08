"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CAMERA, LOOP_SECONDS, ROOM } from "./contracts";
import type { RobotSceneHandle, RobotSceneProps, ViewState } from "./contracts";
import { createMaterials } from "./materials";
import { buildArm } from "./buildArm";
import { buildTool } from "./buildTool";
import { buildHead } from "./buildHead";
import { buildFixture } from "./buildFixture";
import { jointsAt } from "./armTrajectory";

/**
 * The three.js side of the robot-scan figure: a to-scale SO-101 arm holding an
 * iPhone against a head in a chin rest, sweeping the phone across the skin, all
 * in millimetres with +Y up and the face looking toward +Z (see contracts.ts).
 *
 * This file is composition and lifecycle only. It owns the renderer, the
 * studio lighting, the camera, the controls and the scan clock; every piece of
 * geometry comes from a builder (materials.ts, buildArm, buildTool, buildHead,
 * buildFixture) and every material from the shared set, so there is exactly one
 * place to change the look of a thing and one list to dispose. The table is the
 * single exception: it is a box, and a box does not deserve a module.
 *
 * The tool is parented to the arm's gripper mount rather than placed each frame
 * from the scan normal. That makes the picture honest — if the IK is off, the
 * phone visibly misses the skin instead of quietly sliding into place — and it
 * reduces the frame loop to one line: read the joints for this phase, set them.
 *
 * Camera, controls, render-on-demand loop and React lifecycle follow the acne
 * figure (../fable-skin/SkinScene.tsx): everything imperative is created once
 * in a mount effect and torn down on unmount; `playing` and `active` reach it
 * through refs so a play/pause never rebuilds the scene. While playing, the
 * loop runs every frame and advances the scan phase; otherwise it renders only
 * when the camera moves.
 */

/** Keep the camera above the table: OrbitControls' polar 0 is +Y, π/2 is the table plane. */
const MIN_POLAR = 0.05;
const MAX_POLAR = Math.PI / 2 - 0.02;
const HOME_TOL_DEG = 0.5;
const HOME_TOL_DIST = 0.01;
/** Largest step the scan clock takes in one frame, s, so a stall never teleports the arm. */
const MAX_DT = 0.1;


/**
 * The volume the key light's shadow camera has to cover: the head, the fixture,
 * the whole arm envelope and the table under them. Kept explicit because an
 * orthographic shadow frustum sized by hand is the difference between crisp
 * contact shadows and a blurry smear.
 */
const SHADOW_BOUNDS = { x: 350, yMin: 0, yMax: 420, zMin: -200, zMax: 420 };

type Pose = { polar: number; azimuth: number; dist: number };
type Tween = { from: Pose; to: Pose; start: number; ms: number; ease: (t: number) => number };

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type World = {
  kick(): void;
  resetView(): void;
  zoomBy(factor: number): void;
  dispose(): void;
};

function createWorld(
  container: HTMLElement,
  hooks: { isActive: () => boolean; isPlaying: () => boolean; onView: (v: ViewState) => void },
): World {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 1);
  // ACES rather than Neutral, because materials.ts is authored for it: the LED
  // sits at emissiveIntensity 3 and the lens glass at envMapIntensity 1.8, both
  // well above 1.0, and Neutral clips them to flat white discs. ACES rolls
  // those highlights off and its crushed toe keeps the background black on the
  // dark card; the mid-tone loss is bought back with a little exposure.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Enabled before anything compiles a shader, so no material has to be rebuilt.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const canvas = renderer.domElement;
  canvas.className = "robot-scan-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "Robot arm scanning a face with a phone camera. Drag to orbit, scroll or pinch to zoom.",
  );
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.cursor = "grab";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, 1, 5, 5000);
  const target = new THREE.Vector3(CAMERA.target.x, CAMERA.target.y, CAMERA.target.z);

  // ---- materials. One set for the whole figure. It needs the renderer (for
  // the PMREM environment and the max anisotropy), it owns scene.environment
  // and scene.environmentIntensity outright — the scene never touches either —
  // and its dispose() releases every material, texture and the environment, so
  // nothing below keeps a second list. scene.background is left unset: the
  // figure renders on the black clear colour, and the rim light is what
  // separates the head from it.
  const materials = createMaterials(renderer, scene);

  // ---- lights. Post-r155 physical units: a DirectionalLight of 1 is about
  // 1/π of the pre-r155 look, so a studio key lands in the low single digits.
  // Three directionals and a whisper of hemisphere, tuned against ACES.
  const boundsCentre = new THREE.Vector3(
    0,
    (SHADOW_BOUNDS.yMin + SHADOW_BOUNDS.yMax) / 2,
    (SHADOW_BOUNDS.zMin + SHADOW_BOUNDS.zMax) / 2,
  );
  const boundsRadius = Math.hypot(
    SHADOW_BOUNDS.x,
    (SHADOW_BOUNDS.yMax - SHADOW_BOUNDS.yMin) / 2,
    (SHADOW_BOUNDS.zMax - SHADOW_BOUNDS.zMin) / 2,
  );
  // All three directionals aim at the same point, so moving one never drags the
  // others' direction with it.
  const lightTarget = new THREE.Object3D();
  lightTarget.position.copy(boundsCentre);
  scene.add(lightTarget);

  // Key: high, in front of the face and off to the head's right (screen-left),
  // so it rakes across the cheek the phone is scanning rather than flattening it.
  const key = new THREE.DirectionalLight(0xfff4e8, 3.2);
  key.position.set(-380, 620, 470);
  key.target = lightTarget;
  key.castShadow = true;
  // A frustum sized to the rig instead of the default ±5 units, which at
  // millimetre scale would cover a grain of rice. Sizing it by the bounding
  // sphere of SHADOW_BOUNDS rather than hand-fitting an oriented box means
  // moving the key light cannot clip a shadow off the edge of the map.
  const keyDistance = key.position.distanceTo(boundsCentre);
  const shadowCam = key.shadow.camera;
  shadowCam.left = -boundsRadius;
  shadowCam.right = boundsRadius;
  shadowCam.top = boundsRadius;
  shadowCam.bottom = -boundsRadius;
  shadowCam.near = Math.max(10, keyDistance - boundsRadius);
  shadowCam.far = keyDistance + boundsRadius;
  shadowCam.updateProjectionMatrix();
  key.shadow.mapSize.set(2048, 2048);
  // bias is in normalised depth over the ~1 m frustum, so it is worth about
  // half a millimetre. normalBias, in world millimetres, does the real work:
  // the shells, the bracket and the phone are thin slabs a 0.5 mm-per-texel
  // map would otherwise stripe with self-shadow along every edge.
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.8;

  // Fill: cool, from the camera's own side, no shadow — it only lifts the
  // black printed shells off the black background.
  const fill = new THREE.DirectionalLight(0xd8e4ff, 1.1);
  fill.position.set(430, 250, 180);
  fill.target = lightTarget;

  // Rim: behind and above the head (the face looks toward +Z, so behind is -Z),
  // drawing a bright edge along the skull and the arm's upper links.
  const rim = new THREE.DirectionalLight(0xeaf1ff, 2.4);
  rim.position.set(160, 430, -520);
  rim.target = lightTarget;

  // Ambient floor, so a surface facing away from all three is dark, not void.
  const hemi = new THREE.HemisphereLight(0x8fa2b8, 0x0d0f12, 0.35);

  scene.add(key, fill, rim, hemi);

  // ---- table: the only geometry built here. Top at Y = 0, and its far edge
  // stops at ROOM.table.farZ, short of the subject — they are sitting behind
  // it with the head rest on the floor, and the arm reaches across the gap.
  // A slab alone reads as a floating plane, so it is a top, an inset apron and
  // four legs down to the floor; still four boxes, which is why it stays here.
  const T = ROOM.table;
  const tableDepth = T.nearZ - T.farZ;
  const tableCentreZ = (T.nearZ + T.farZ) / 2;
  const apronBottom = -T.topThickness - T.apronHeight;
  const tableGeometries: THREE.BufferGeometry[] = [];
  const tableGroup = new THREE.Group();
  const addTablePart = (
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
  ) => {
    tableGeometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, materials.table);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    tableGroup.add(mesh);
  };

  addTablePart(
    new THREE.BoxGeometry(T.width, T.topThickness, tableDepth),
    0,
    -T.topThickness / 2,
    tableCentreZ,
  );
  // The apron is inset on every side, so the edge shows a top slab with a
  // shadowed reveal under it rather than one 66 mm cliff.
  addTablePart(
    new THREE.BoxGeometry(T.width - 2 * T.reveal, T.apronHeight, tableDepth - 2 * T.reveal),
    0,
    -T.topThickness - T.apronHeight / 2,
    tableCentreZ,
  );
  // Four legs down to the floor, one geometry between them. They are mostly
  // below the frame, but the near pair is what stops the top reading as a slab
  // hanging in the dark.
  const legGeo = new THREE.BoxGeometry(T.legSize, apronBottom - ROOM.floorY, T.legSize);
  tableGeometries.push(legGeo);
  const legY = (apronBottom + ROOM.floorY) / 2;
  const legX = T.width / 2 - T.reveal - T.legInset - T.legSize / 2;
  const legInsetZ = T.reveal + T.legInset + T.legSize / 2;
  for (const x of [legX, -legX]) {
    for (const z of [T.farZ + legInsetZ, T.nearZ - legInsetZ]) {
      const leg = new THREE.Mesh(legGeo, materials.table);
      leg.position.set(x, legY, z);
      leg.receiveShadow = true;
      tableGroup.add(leg);
    }
  }
  scene.add(tableGroup);

  // ---- the built figure. The tool hangs off the gripper mount, not the scene,
  // so the arm's joints are the only thing that places it.
  const arm = buildArm(materials);
  const tool = buildTool(materials);
  const head = buildHead(materials);
  const fixture = buildFixture(materials);
  scene.add(arm.object, head.object, fixture.object);
  arm.toolMount.add(tool.object);
  // The ring light rides with the phone. Only parent it if buildTool has not
  // already placed it somewhere inside its own group.
  if (!tool.light.parent) tool.object.add(tool.light);

  /** Everything solid both casts and receives; the shells self-shadow and it reads. */
  const markShadows = (root: THREE.Object3D) => {
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  };
  markShadows(arm.object);
  markShadows(tool.object);
  markShadows(head.object);
  markShadows(fixture.object);

  // ---- the scan clock. The tool is bolted to the gripper, so posing the arm
  // is the whole animation: read the joints for this phase and set them.
  // armTrajectory solves and smooths the entire loop on its first call, so the
  // still-frame pose below is what pays for it, off the animation path.
  let phase = 0;
  const pose = (t: number) => {
    arm.setJoints(jointsAt(t));
  };
  // A still frame (what reduced-motion readers see) shows the start of the loop.
  pose(phase);

  // ---- wheel hygiene. The canvas sits inside an article, and OrbitControls
  // captures every wheel event on its element. Until the reader has engaged
  // the canvas (pressed on it or focused it) a trackpad scroll must keep
  // scrolling the page, so a capture-phase listener registered BEFORE the
  // controls stops the event from ever reaching OrbitControls' handler.
  // Leaving enableZoom on (rather than toggling it) keeps touch pinch alive.
  let engaged = false;
  const onWheelCapture = (event: WheelEvent) => {
    if (!engaged) event.stopImmediatePropagation();
  };
  canvas.addEventListener("wheel", onWheelCapture, { capture: true, passive: true });

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = CAMERA.minDistance;
  controls.maxDistance = CAMERA.maxDistance;
  controls.minPolarAngle = MIN_POLAR;
  controls.maxPolarAngle = MAX_POLAR;
  controls.rotateSpeed = 0.6;
  // OrbitControls sets touch-action: none, which on a phone would turn the
  // whole 4:3 canvas into a scroll trap. pan-y hands vertical swipes back to
  // the page; a horizontal drag still orbits and two fingers still pinch.
  canvas.style.touchAction = "pan-y";

  const HOME: Pose = { polar: CAMERA.homePolar, azimuth: CAMERA.homeAzimuth, dist: CAMERA.homeDistance };
  const applyPose = (p: Pose) => {
    camera.position
      .setFromSphericalCoords(p.dist, THREE.MathUtils.clamp(p.polar, MIN_POLAR, MAX_POLAR), p.azimuth)
      .add(target);
    camera.lookAt(target);
  };
  const currentPose = (): Pose => ({
    polar: controls.getPolarAngle(),
    azimuth: controls.getAzimuthalAngle(),
    dist: controls.getDistance(),
  });

  // ---- render on demand, plus a running loop while playing
  let frame = 0;
  let running = false;
  let dirty = true;
  let busyUntil = 0;
  let interacting = false;
  let tween: Tween | null = null;
  let disposed = false;
  let lastView: ViewState | null = null;
  let lastNow = 0;

  const busy = (ms: number) => {
    busyUntil = Math.max(busyUntil, performance.now() + ms);
  };
  const schedule = () => {
    if (running || disposed) return;
    running = true;
    frame = requestAnimationFrame(tick);
  };
  const kick = () => {
    dirty = true;
    schedule();
  };

  const startTween = (to: Partial<Pose>, ms: number, ease: (t: number) => number) => {
    // Chain from where a running tween is heading so repeated zoom presses add up.
    const from = tween ? { ...tween.to } : currentPose();
    tween = { from, to: { ...from, ...to }, start: performance.now(), ms, ease };
    busy(ms + 50);
    kick();
  };

  const originNdc = new THREE.Vector3();
  const rightNdc = new THREE.Vector3();
  const report = () => {
    camera.updateMatrixWorld();
    const dist = camera.position.distanceTo(target);
    const polar = controls.getPolarAngle();
    const w = Math.max(canvas.clientWidth, 1);
    const h = Math.max(canvas.clientHeight, 1);
    // One millimetre along the world direction of screen-x at the orbit
    // target: the camera's right vector, which OrbitControls keeps horizontal
    // (camera.up is +Y), projected to NDC and then to CSS pixels.
    originNdc.copy(target).project(camera);
    rightNdc.setFromMatrixColumn(camera.matrixWorld, 0);
    rightNdc.y = 0;
    if (rightNdc.lengthSq() < 1e-12) rightNdc.set(1, 0, 0);
    rightNdc.normalize().add(target).project(camera);
    const dx = (rightNdc.x - originNdc.x) * 0.5 * w;
    const dy = (rightNdc.y - originNdc.y) * 0.5 * h;
    const view: ViewState = {
      cssPxPerMm: Math.hypot(dx, dy),
      atHome:
        Math.abs(polar - HOME.polar) * (180 / Math.PI) < HOME_TOL_DEG &&
        Math.abs(controls.getAzimuthalAngle() - HOME.azimuth) * (180 / Math.PI) < HOME_TOL_DEG &&
        Math.abs(dist / HOME.dist - 1) < HOME_TOL_DIST,
    };
    const changed =
      !lastView || Math.abs(view.cssPxPerMm - lastView.cssPxPerMm) > 0.01 || view.atHome !== lastView.atHome;
    if (!changed) return;
    lastView = view;
    hooks.onView(view);
  };

  const render = () => {
    renderer.render(scene, camera);
  };

  const tick = (now: number) => {
    running = false;
    if (disposed) return;
    if (!hooks.isActive() || document.hidden) {
      lastNow = 0;
      return;
    }

    let moved = false;
    if (hooks.isPlaying()) {
      // The first frame after a pause advances nothing, so the arm carries on
      // from where it stopped rather than jumping by the time away.
      const dt = lastNow ? Math.min((now - lastNow) / 1000, MAX_DT) : 0;
      lastNow = now;
      phase = (phase + dt / LOOP_SECONDS) % 1;
      pose(phase);
      moved = true;
    } else {
      lastNow = 0;
    }
    if (tween) {
      const t = Math.min((now - tween.start) / tween.ms, 1);
      const k = tween.ease(t);
      const { from, to } = tween;
      applyPose({
        polar: from.polar + (to.polar - from.polar) * k,
        azimuth: from.azimuth + (to.azimuth - from.azimuth) * k,
        dist: from.dist + (to.dist - from.dist) * k,
      });
      moved = true;
      if (t >= 1) tween = null;
    }
    // Applies drag deltas and damping; true while the camera is still settling.
    if (controls.update()) moved = true;

    if (moved || dirty) {
      render();
      dirty = false;
      report();
    }
    if (moved || tween || interacting || now < busyUntil) schedule();
  };

  // ---- sizing. Distances are real millimetres, so a narrower column simply
  // shows the same view smaller; nothing to rescale.
  const resize = () => {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    busy(32);
    kick();
  };
  resize();
  applyPose(HOME);
  controls.update();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  // ---- input
  const onControlStart = () => {
    // Cancel a tween the moment the reader takes over, or the two fight.
    tween = null;
    interacting = true;
    kick();
  };
  const onControlEnd = () => {
    interacting = false;
    kick();
  };
  const onControlChange = () => kick();
  controls.addEventListener("start", onControlStart);
  controls.addEventListener("end", onControlEnd);
  controls.addEventListener("change", onControlChange);

  const onPointerDown = () => {
    engaged = true;
    canvas.style.cursor = "grabbing";
  };
  const onPointerUp = () => {
    canvas.style.cursor = "grab";
  };
  const onPointerLeave = () => {
    engaged = false;
    canvas.style.cursor = "grab";
  };
  const onFocus = () => {
    engaged = true;
  };
  const onBlur = () => {
    engaged = false;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const cur = tween ? tween.to : currentPose();
    const step = (8 * Math.PI) / 180;
    switch (event.key) {
      case "ArrowUp":
        startTween({ polar: Math.max(cur.polar - step, MIN_POLAR) }, 250, easeOut);
        break;
      case "ArrowDown":
        startTween({ polar: Math.min(cur.polar + step, MAX_POLAR) }, 250, easeOut);
        break;
      case "ArrowLeft":
        startTween({ azimuth: cur.azimuth - step * 1.5 }, 250, easeOut);
        break;
      case "ArrowRight":
        startTween({ azimuth: cur.azimuth + step * 1.5 }, 250, easeOut);
        break;
      case "+":
      case "=":
        zoomBy(1 / 1.25);
        break;
      case "-":
      case "_":
        zoomBy(1.25);
        break;
      default:
        return;
    }
    event.preventDefault();
  };
  const onVisibility = () => {
    if (!document.hidden) kick();
  };
  const onContextLost = (event: Event) => event.preventDefault();
  // Nothing here is baked into render targets, so a restore only needs a frame.
  const onContextRestored = () => kick();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("focus", onFocus);
  canvas.addEventListener("blur", onBlur);
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  document.addEventListener("visibilitychange", onVisibility);

  // ---- public
  function zoomBy(factor: number) {
    const from = tween ? tween.to : currentPose();
    const dist = THREE.MathUtils.clamp(from.dist * factor, controls.minDistance, controls.maxDistance);
    startTween({ dist }, 350, easeOut);
  }

  return {
    kick,
    resetView() {
      // getAzimuthalAngle is in (-π, π]; take the short way round to home.
      const cur = tween ? tween.to : currentPose();
      let azimuth = HOME.azimuth;
      if (azimuth - cur.azimuth > Math.PI) azimuth -= 2 * Math.PI;
      if (azimuth - cur.azimuth < -Math.PI) azimuth += 2 * Math.PI;
      startTween({ polar: HOME.polar, azimuth, dist: HOME.dist }, 600, easeInOut);
    },
    zoomBy,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      controls.removeEventListener("start", onControlStart);
      controls.removeEventListener("end", onControlEnd);
      controls.removeEventListener("change", onControlChange);
      controls.dispose();
      canvas.removeEventListener("wheel", onWheelCapture, { capture: true });
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("focus", onFocus);
      canvas.removeEventListener("blur", onBlur);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      // Builders first (they own their geometries and the ring light), then the
      // shared materials, then the lights and geometry built here.
      arm.dispose();
      tool.dispose();
      head.dispose();
      fixture.dispose();
      materials.dispose();
      key.dispose();
      fill.dispose();
      rim.dispose();
      hemi.dispose();
      for (const geometry of tableGeometries) geometry.dispose();
      renderer.dispose();
      // Release the GL context now rather than when the GC gets to it; React
      // strict mode mounts twice and browsers cap live contexts.
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

const RobotScene = forwardRef<RobotSceneHandle, RobotSceneProps>(function RobotScene(
  { playing, active, onView, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  // Latest props for the imperative world, so the mount effect never re-runs.
  const playingRef = useRef(playing);
  const activeRef = useRef(active);
  const onViewRef = useRef(onView);
  playingRef.current = playing;
  activeRef.current = active;
  onViewRef.current = onView;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const world = createWorld(container, {
      isActive: () => activeRef.current,
      isPlaying: () => playingRef.current,
      onView: (v) => onViewRef.current(v),
    });
    worldRef.current = world;
    return () => {
      worldRef.current = null;
      world.dispose();
    };
  }, []);

  // The loop idles itself when inactive or paused; it needs a nudge to restart.
  useEffect(() => {
    if (active) worldRef.current?.kick();
  }, [active, playing]);

  useImperativeHandle(
    ref,
    () => ({
      resetView: () => worldRef.current?.resetView(),
      zoomBy: (factor: number) => worldRef.current?.zoomBy(factor),
    }),
    [],
  );

  return (
    // Positioned by the caller's className (e.g. absolute inset-0); an inline
    // position here would override it and collapse the container to zero height.
    <div ref={containerRef} className={className} style={{ overflow: "hidden" }}>
      {/* Keyboard users get a ring; a mouse click on the canvas does not. */}
      <style>{`
        .robot-scan-canvas:focus { outline: none; }
        .robot-scan-canvas:focus-visible { outline: 2px solid rgba(255,255,255,0.5); outline-offset: -2px; }
      `}</style>
    </div>
  );
});

export default RobotScene;
