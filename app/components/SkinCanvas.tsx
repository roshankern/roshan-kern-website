"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OPTICS, lesionAt } from "../writing/anyderm/lesion";
import { SKIN_FRAGMENT, SKIN_VERTEX, applyLesion, makeSkinUniforms } from "./skinShaders";

/** Where the viewer is looking, reported whenever the camera settles on a new pose. */
export type ViewState = {
  /** CSS pixels per millimetre at the centre of the skin, for the scale bar. */
  cssPxPerMm: number;
  /** Field width across the canvas, mm. */
  fieldMm: number;
  /** Camera tilt from straight down, degrees. */
  polarDeg: number;
  /** True at (or damped to within a hair of) the canonical capture pose. */
  atHome: boolean;
};

export type SkinCanvasHandle = {
  /** Animate back to straight-down at the home field width. */
  resetView(): void;
  /** Multiply the field width by `factor` (<1 zooms in), clamped to OPTICS bounds. */
  zoomBy(factor: number): void;
};

export type SkinCanvasProps = {
  /** Fractional day, 0–21. */
  day: number;
  /** False when off-screen or the tab is hidden: the render loop must idle. */
  active: boolean;
  onView: (view: ViewState) => void;
  className?: string;
};

/**
 * The three.js side of the acne-progression figure: a 20 mm patch of cheek
 * skin in the XZ plane, +Y up, seen from above through a dermatoscope, with
 * one lesion at the origin driven by lesionAt(day). All of the surface and
 * colour lives in skinShaders.ts; this file owns the camera, the controls,
 * the render-on-demand loop and the React lifecycle.
 *
 * Everything imperative is created once in a mount effect and torn down on
 * unmount. Prop changes reach it through refs so a scrub of the timeline
 * never rebuilds a 200k-triangle scene.
 */

/** Plane subdivisions per side: 320 over 20 mm is ~62 µm spacing, enough for the mesh to carry the dome and undulation. */
const SEGMENTS = 320;
/** OrbitControls' polar 0 is the +Y axis; a hair off it keeps the camera basis well defined. */
const HOME_POLAR = 0.001;
const HOME_AZIMUTH = 0;
/** Within this of the home pose the view counts as home (and the reset button can dim). */
const HOME_TOL_DEG = 0.5;
const HOME_TOL_DIST = 0.01;

type Pose = { polar: number; azimuth: number; dist: number };
type Tween = { from: Pose; to: Pose; start: number; ms: number; ease: (t: number) => number };

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type World = {
  setDay(day: number): void;
  kick(): void;
  resetView(): void;
  zoomBy(factor: number): void;
  dispose(): void;
};

function createWorld(
  container: HTMLElement,
  hooks: { isActive: () => boolean; onView: (v: ViewState) => void; initialDay: number },
): World {
  const fovRad = (OPTICS.cameraFovDeg * Math.PI) / 180;
  const maxPolar = (OPTICS.maxPolarDeg * Math.PI) / 180;

  // Fixed pixel ratio, decided once. Adapting it to frame times reads a
  // vsync hitch as GPU load and never recovers; the shader is the cost here
  // and it is the same cost every frame.
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 1);
  // The fragment shader ends with three's own chunks, so these two settings
  // are what turn its linear radiance into ACES-filmic sRGB.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const canvas = renderer.domElement;
  canvas.className = "skin-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "Dermatoscope view of one acne lesion. Drag to tilt, scroll or pinch to zoom.");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.cursor = "grab";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(OPTICS.cameraFovDeg, 1, 0.2, 100);
  const target = new THREE.Vector3(0, 0, 0);

  // PlaneGeometry is built in XY; rotating it into XZ here (baked into the
  // attributes) means the shaders can read position.xz as the patch coordinate.
  const geometry = new THREE.PlaneGeometry(OPTICS.patchMm, OPTICS.patchMm, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const uniforms = makeSkinUniforms();
  applyLesion(uniforms, lesionAt(hooks.initialDay));
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SKIN_VERTEX,
    fragmentShader: SKIN_FRAGMENT,
    // Default, but load-bearing: without it three drops the TONE_MAPPING define.
    toneMapped: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // The plane is far larger than any view and never leaves the frustum.
  mesh.frustumCulled = false;
  scene.add(mesh);

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
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = maxPolar;
  controls.rotateSpeed = 0.6;
  // OrbitControls sets touch-action: none, which on a phone would turn the
  // whole 4:3 canvas into a scroll trap. pan-y hands vertical swipes back to
  // the page; a horizontal drag still orbits and two fingers still pinch.
  // Tilt is a mouse or keyboard gesture on touch devices, and that is the
  // right trade: an article you cannot scroll past is worse than a tilt
  // you have to reach for.
  canvas.style.touchAction = "pan-y";

  // ---- field <-> distance. The horizontal field at the target plane is
  // 2·d·tan(fov/2)·aspect, so a given field width is a distance that depends
  // on the aspect; it is recomputed on resize so the home view is always
  // OPTICS.homeFieldMm wide whatever the column width.
  const distForField = (field: number) => field / (2 * camera.aspect * Math.tan(fovRad / 2));
  const fieldForDist = (dist: number) => 2 * dist * Math.tan(fovRad / 2) * camera.aspect;
  let homeDist = 0;

  const applyPose = (pose: Pose) => {
    camera.position
      .setFromSphericalCoords(pose.dist, Math.max(pose.polar, HOME_POLAR), pose.azimuth)
      .add(target);
    camera.lookAt(target);
  };
  const currentPose = (): Pose => ({
    polar: controls.getPolarAngle(),
    azimuth: controls.getAzimuthalAngle(),
    dist: controls.getDistance(),
  });

  // ---- render on demand
  let frame = 0;
  let running = false;
  let dirty = true;
  let busyUntil = 0;
  let interacting = false;
  let tween: Tween | null = null;
  let disposed = false;
  let lastView: ViewState | null = null;

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

  const report = () => {
    camera.updateMatrixWorld();
    const dist = camera.position.distanceTo(target);
    const polar = controls.getPolarAngle();
    const w = Math.max(canvas.clientWidth, 1);
    const h = Math.max(canvas.clientHeight, 1);
    // One millimetre along the world direction of screen-x at the plane: the
    // camera's right vector, which OrbitControls keeps horizontal (camera.up
    // is +Y), projected to NDC and then to CSS pixels.
    const origin = new THREE.Vector3(0, 0, 0).project(camera);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    right.y = 0;
    if (right.lengthSq() < 1e-12) right.set(1, 0, 0);
    right.normalize().project(camera);
    const dx = (right.x - origin.x) * 0.5 * w;
    const dy = (right.y - origin.y) * 0.5 * h;
    const view: ViewState = {
      cssPxPerMm: Math.hypot(dx, dy),
      fieldMm: fieldForDist(dist),
      polarDeg: (polar * 180) / Math.PI,
      atHome:
        (polar * 180) / Math.PI < HOME_TOL_DEG && Math.abs(dist / homeDist - 1) < HOME_TOL_DIST,
    };
    const changed =
      !lastView ||
      Math.abs(view.cssPxPerMm - lastView.cssPxPerMm) > 0.01 ||
      Math.abs(view.fieldMm - lastView.fieldMm) > 1e-3 ||
      Math.abs(view.polarDeg - lastView.polarDeg) > 0.01 ||
      view.atHome !== lastView.atHome;
    if (!changed) return;
    lastView = view;
    hooks.onView(view);
  };

  const tick = (now: number) => {
    running = false;
    if (disposed) return;
    if (!hooks.isActive() || document.hidden) return;

    let moved = false;
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
      // Feature widths in the shader are expressed in mm per device pixel.
      uniforms.uMmPerPx.value = fieldForDist(camera.position.distanceTo(target)) / Math.max(canvas.width, 1);
      renderer.render(scene, camera);
      dirty = false;
      report();
    }
    if (moved || tween || interacting || now < busyUntil) schedule();
  };

  // ---- sizing
  const resize = () => {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    const prevHome = homeDist;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    homeDist = distForField(OPTICS.homeFieldMm);
    controls.minDistance = distForField(OPTICS.minFieldMm);
    controls.maxDistance = distForField(OPTICS.maxFieldMm);
    if (prevHome > 0) {
      // Keep the field width, not the distance: a narrower column must not
      // silently zoom the reader in.
      const k = homeDist / prevHome;
      camera.position.sub(target).multiplyScalar(k).add(target);
      if (tween) {
        tween.from.dist *= k;
        tween.to.dist *= k;
      }
    }
    busy(32);
    kick();
  };
  resize();
  applyPose({ polar: HOME_POLAR, azimuth: HOME_AZIMUTH, dist: homeDist });
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
        startTween({ polar: Math.max(cur.polar - step, HOME_POLAR) }, 250, easeOut);
        break;
      case "ArrowDown":
        startTween({ polar: Math.min(cur.polar + step, maxPolar) }, 250, easeOut);
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
    const base = tween ? tween.to : currentPose();
    const dist = THREE.MathUtils.clamp(base.dist * factor, controls.minDistance, controls.maxDistance);
    startTween({ dist }, 350, easeOut);
  }

  return {
    setDay(day) {
      applyLesion(uniforms, lesionAt(day));
      kick();
    },
    kick,
    resetView() {
      // getAzimuthalAngle is in (-π, π], so 0 is already the short way round.
      startTween({ polar: HOME_POLAR, azimuth: HOME_AZIMUTH, dist: homeDist }, 600, easeInOut);
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
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      // Release the GL context now rather than when the GC gets to it; React
      // strict mode mounts twice and browsers cap live contexts.
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

const SkinCanvas = forwardRef<SkinCanvasHandle, SkinCanvasProps>(function SkinCanvas(
  { day, active, onView, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  // Latest props for the imperative world, so the mount effect never re-runs.
  const activeRef = useRef(active);
  const onViewRef = useRef(onView);
  const dayRef = useRef(day);
  activeRef.current = active;
  onViewRef.current = onView;
  dayRef.current = day;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const world = createWorld(container, {
      isActive: () => activeRef.current,
      onView: (v) => onViewRef.current(v),
      initialDay: dayRef.current,
    });
    worldRef.current = world;
    return () => {
      worldRef.current = null;
      world.dispose();
    };
  }, []);

  useEffect(() => {
    worldRef.current?.setDay(day);
  }, [day]);

  useEffect(() => {
    if (active) worldRef.current?.kick();
  }, [active]);

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
        .skin-canvas:focus { outline: none; }
        .skin-canvas:focus-visible { outline: 2px solid rgba(255,255,255,0.5); outline-offset: -2px; }
      `}</style>
    </div>
  );
});

export default SkinCanvas;
