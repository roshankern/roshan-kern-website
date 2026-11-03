"use client";

import { useEffect, useRef } from "react";
import { FIELD_GLSL, FIELD_N, fieldHandoff, fieldParams, fieldUniforms } from "../field";
import { FIGURES } from "./figures";
import { CELL, H, W, mulberry32, render, type Still } from "./sweep";

/**
 * The closing scene: the helix, the laptop and the brain, each a still in the
 * helix's dot grain, played the way AnyHealth's closing scene plays its ages
 * (anyhealth 3700504^, website/src/app/ages.tsx). Each still holds for HOLD
 * seconds, then every dot glides to a random dot of the next one.
 *
 * How much of it is there follows the scroll: as the frame comes up the page,
 * the margin field (../field.ts) is handed over dot by dot, each leaving the
 * edge of the page for its place in the scene, while the scene's other dots
 * materialise in place. Scroll back up and it runs in reverse.
 *
 * Every dot is a fixed slot that keeps its identity through every change of
 * still, so a half-arrived dot never jumps when the next move starts. The first
 * FIELD_N slots are the field's dots. The canvas is fixed and covers the page,
 * like the field's, so the dots can come from its edges; <ClosingFrame> marks
 * where the scene sits in the layout.
 */

const FRAME_ID = "closing-frame";
/** Seconds each still holds, and the glide between stills (the ages' timings). */
const HOLD = 2;
const MOVE = 2.4;
/** Seconds the handoff takes to close most of its distance to the scroll, as the helix's SCRUB. */
const SCRUB = 0.15;
/** The mouse tilt, as the helix's: radians each way, seconds to catch up, camera distance in frame heights. */
const TILT = 0.12;
const TILT_EASE = 0.27;
const CAMERA = 2.6;
/** How far the nearest dots sit in front of the frame, box units: the helix's DEPTH. */
const DEPTH = 70.5;

/**
 * The helix's scale for a viewport vw x vh (anyhealth helix.ts helixScale):
 * the lattice pitch on screen is CELL times this, so these dots have the
 * helix's size and spacing at every screen size.
 */
function helixScale(vw: number, vh: number): number {
  return Math.min(1.25, (vw * 0.94) / 430, (vh * 0.7) / 500);
}

const VERT = `
attribute vec4 aA;  // this still: x, y (box units from the frame's corner), ink, seed
attribute vec4 aB;  // the next still, the same
attribute vec4 aF;  // a field dot's parameters; otherwise (0, 0, 0, key)
attribute vec2 aN;  // nearness in this still and the next
uniform float uT;
uniform float uHand;
uniform float uTime;
uniform vec2 uVp;
uniform vec2 uOrigin;
uniform float uK;
uniform float uPitch;
uniform vec2 uTilt;
uniform float uReduce;
uniform float uDepth;
uniform float uCam;
uniform vec2 uBand;
uniform vec4 uVeil;
varying float vA;
varying float vG;
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float ease(float x) { x = clamp(x, 0.0, 1.0); return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
${FIELD_GLSL}
/* the helix's grain, term for term (helix-hero.tsx): size, opacity and grey
   follow the ink, nearer dots are a little bigger and stronger, and the seed
   fixes a dot's size and fleck */
void look(float v, float near, float seed, out float s, out float a, out float g) {
  float jit = mix(0.58, 1.18, fract(seed * 7.31));
  float fleck = step(0.982, fract(seed * 13.7)) * smoothstep(0.6, 0.95, v);
  s = uPitch * (0.2 + 0.45 * v) * jit * mix(0.8, 1.15, near) * (1.0 + 0.6 * fleck);
  a = smoothstep(0.035, 0.2, v) * (0.35 + 0.65 * smoothstep(0.03, 0.7, v)) * mix(0.75, 1.0, near);
  g = mix(0.3, 0.02, smoothstep(0.05, 0.6, v)) * (1.0 - 0.6 * fleck);
}
void main() {
  /* each dot leaves at its own moment and glides straight to its place in the
     next still; its look blends from the dot it was to the dot it becomes */
  float e = ease((uT - 0.4 * hash(aA.w * 41.3)) / 0.55);
  vec2 xy = mix(aA.xy, aB.xy, e);
  float sA, aA2, gA, sB, aB2, gB;
  look(aA.z, aN.x, aA.w, sA, aA2, gA);
  look(aB.z, aN.y, aB.w, sB, aB2, gB);
  float s = mix(sA, sB, e);
  float a = mix(aA2, aB2, e);
  float g = mix(gA, gB, e);

  /* turn towards the mouse about the frame's centre, then perspective */
  vec2 centre = uOrigin + vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * 0.5 * uK;
  vec3 p = vec3(uOrigin + xy * uK - centre, (mix(aN.x, aN.y, e) * 2.0 - 1.0) * uDepth);
  float cy = cos(uTilt.x), sy = sin(uTilt.x);
  p = vec3(p.x * cy + p.z * sy, p.y, p.z * cy - p.x * sy);
  float cx = cos(uTilt.y), sx = sin(uTilt.y);
  p = vec3(p.x, p.y * cx + p.z * sx, p.z * cx - p.y * sx);
  vec2 px = centre + p.xy * (uCam / (uCam - p.z));

  /* at rest every dot wanders a little about its place: AnyDerm's wobble scaled
     down to a third of a lattice cell, with a speed and phase that belong to the slot */
  float k1 = hash(aF.w * 3.17), k2 = hash(aF.w * 5.91);
  float sp = 0.5 + 0.7 * k1;
  vec2 wob = vec2(sin(uTime * sp + k2 * 6.2832) + 0.6 * sin(uTime * sp * 1.71 + k1 * 6.2832),
                  cos(uTime * sp * 0.83 + k1 * 6.2832) + 0.6 * cos(uTime * sp * 1.37 + k2 * 6.2832));
  px += wob * (0.33 / 1.6) * uPitch * (1.0 - uReduce);

  if (aF.z > 1.0) {
    /* a margin-field dot: from its place beside the article to its place here,
       as far as the scroll says; until it leaves, MarginField draws it */
    float h = fieldHanded(aF.w, uHand);
    vec2 fp;
    float fa, fs, fg;
    fieldDot(aF, uTime, uVp, uBand, uVeil, fp, fa, fs, fg);
    fa *= fieldVeil(fp.x, uVp, uVeil);
    float k = ease(h);
    px = mix(fp, px, k);
    s = mix(fs, s, k);
    a = mix(fa, a, k) * step(0.0001, h);
    g = mix(fg, g, k);
  } else {
    /* everything else materialises in place */
    float h = ease(fieldHanded(aF.w, uHand));
    a *= h;
    s *= mix(0.5, 1.0, h);
  }

  /* sub-pixel points: hold a 2px floor and pay for it in coverage */
  float sz = max(s, 2.0);
  vA = a * clamp((s * s) / (sz * sz), 0.0, 1.0);
  vG = g;
  gl_PointSize = sz;
  vec2 c = (px / uVp) * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying float vA;
varying float vG;
void main() {
  float r = length(gl_PointCoord - 0.5);
  /* a solid disc, antialiased over its last few percent */
  float a = vA * (1.0 - smoothstep(0.43, 0.5, r));
  if (a <= 0.004) discard;
  /* premultiplied, so the transparent canvas blends over the page cleanly */
  gl_FragColor = vec4(vec3(vG) * a, a);
}
`;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Where the scene sits in the layout. The dots are drawn by <ClosingCanvas>. */
export function ClosingFrame() {
  return (
    <div
      id={FRAME_ID}
      role="img"
      aria-label="A DNA double helix, an open laptop and a brain in fine dots, each flowing into the next."
      // phones: edge to edge; wider: the helix's largest scale, and no taller than about 64vh.
      className="-mx-6 aspect-[600/480] w-[calc(100%+3rem)] sm:mx-auto sm:w-[min(100%,750px,80vh)]"
    />
  );
}

export function ClosingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const frame = document.getElementById(FRAME_ID);
    if (!cv || !frame) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = cv.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: true });
    } catch {
      gl = null;
    }
    if (!gl) return;
    const g = gl;

    function compile(src: string, type: number): WebGLShader {
      const s = g.createShader(type);
      if (!s) throw new Error("could not create shader");
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) ?? "shader compile failed");
      return s;
    }
    const prog = g.createProgram();
    try {
      g.attachShader(prog, compile(VERT, g.VERTEX_SHADER));
      g.attachShader(prog, compile(FRAG, g.FRAGMENT_SHADER));
      g.linkProgram(prog);
      if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog) ?? "program link failed");
    } catch {
      /* no dots on this machine: the frame stays a blank space, and the field keeps its dots */
      return;
    }
    g.useProgram(prog);
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    const u = (name: string) => g.getUniformLocation(prog, name);
    const buffer = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buffer);
    const STRIDE = 14; // floats per slot: aA, aB, aF, aN
    (["aA", "aB", "aF", "aN"] as const).forEach((name, i) => {
      const loc = g.getAttribLocation(prog, name);
      g.enableVertexAttribArray(loc);
      g.vertexAttribPointer(loc, name === "aN" ? 2 : 4, g.FLOAT, false, STRIDE * 4, i * 16);
    });

    /* the lattice, rebuilt whenever the pitch changes: one nudge and one seed per cell, as the helix's */
    let lx = new Float32Array(0);
    let ly = new Float32Array(0);
    let seed = new Float32Array(0);
    let stills: Still[] = [];
    let lit: Int32Array[] = [];
    const lattice = { cols: 0 };
    const field = fieldParams();
    const shuffle = mulberry32(0x5eed);

    /** Slots: one per dot, as many as the busiest still needs; each still is a slot -> cell assignment. */
    let n = 0;
    let slotKey = new Float32Array(0);
    type Assignment = { cell: Int32Array; real: Uint8Array };
    let current: Assignment | null = null;
    let next: Assignment | null = null;

    /**
     * A random slot -> cell assignment for one still. Its lit cells fill the
     * first slots in random order (so the field's slots always land on a real
     * dot); spare slots wait unseen on a lit cell.
     */
    function assign(still: number): Assignment {
      const cells = Int32Array.from(lit[still]);
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(shuffle() * (i + 1));
        const t = cells[i];
        cells[i] = cells[j];
        cells[j] = t;
      }
      const cell = new Int32Array(n);
      const real = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        real[i] = i < cells.length ? 1 : 0;
        cell[i] = real[i] ? cells[i] : cells[Math.floor(shuffle() * cells.length)];
      }
      return { cell, real };
    }

    /* ---- timeline ---- */
    /** `still` is on screen (or being left), `t` runs 0 to 1 through a move, `wait` counts the hold. */
    const state = { moving: false, still: 0, t: 0, wait: 0 };

    /** Uploads the move from `current` to `next`. */
    function upload(): void {
      if (!current || !next) return;
      const a = stills[state.still];
      const b = stills[(state.still + 1) % stills.length];
      const data = new Float32Array(n * STRIDE);
      for (let i = 0; i < n; i++) {
        const ca = current.cell[i];
        const cb = next.cell[i];
        const o = i * STRIDE;
        data.set([lx[ca], ly[ca], current.real[i] ? a.ink[ca] / 255 : 0, seed[ca], lx[cb], ly[cb], next.real[i] ? b.ink[cb] / 255 : 0, seed[cb]], o);
        if (i < FIELD_N) data.set(field.subarray(i * 4, i * 4 + 4), o + 8);
        else data[o + 11] = slotKey[i];
        data[o + 12] = a.near[ca] / 255;
        data[o + 13] = b.near[cb] / 255;
      }
      g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW);
    }

    /** The handoff: `want` is where the scroll says it should be, `p` where it has got to. */
    const hand = { want: 0, p: 0 };
    const view = { vw: 0, vh: 0, dpr: 1 };
    const aim = { x: 0, y: 0 };
    const tilt = { x: 0, y: 0 };
    let raf = 0;
    let beat = 0;
    let ready = false;
    let near = false;

    function layout(): void {
      view.vw = window.innerWidth;
      view.vh = window.innerHeight;
      view.dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv!.width = Math.round(view.vw * view.dpr);
      cv!.height = Math.round(view.vh * view.dpr);
      g.viewport(0, 0, cv!.width, cv!.height);
    }

    /**
     * The handoff as one number from the scroll: 0 while the frame is below the
     * screen, 1 once it sits in the middle of it (or as far as the page lets it
     * go). Derived from where the frame is in the document, so it comes out the
     * same at any scroll position.
     */
    function scrollProgress(): number {
      const r = frame!.getBoundingClientRect();
      const y = window.scrollY || 0;
      const top = y + r.top;
      const start = top - view.vh;
      const most = document.documentElement.scrollHeight - view.vh;
      const end = Math.min(top + r.height / 2 - view.vh / 2, most);
      return end > start ? clamp01((y - start) / (end - start)) : 1;
    }

    function draw(now: number): void {
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      if (!ready || hand.p <= 0.0005) return;
      const r = frame!.getBoundingClientRect();
      const { dpr } = view;
      const k = (r.width / W) * dpr;
      const { band, veil } = fieldUniforms(view.vw, dpr);
      g.uniform2f(u("uVp"), view.vw * dpr, view.vh * dpr);
      g.uniform2f(u("uOrigin"), r.left * dpr, r.top * dpr);
      g.uniform1f(u("uK"), k);
      g.uniform1f(u("uPitch"), stills[0].cell * k);
      g.uniform2f(u("uTilt"), tilt.x, tilt.y);
      g.uniform1f(u("uDepth"), DEPTH * k);
      g.uniform1f(u("uCam"), CAMERA * H * k);
      g.uniform2f(u("uBand"), band[0], band[1]);
      g.uniform4f(u("uVeil"), veil[0], veil[1], veil[2], veil[3]);
      /* the field's own clock, so a dot leaves exactly where MarginField last drew it */
      g.uniform1f(u("uTime"), reduced ? 0 : now / 1000);
      g.uniform1f(u("uHand"), hand.p);
      g.uniform1f(u("uReduce"), reduced ? 1 : 0);
      g.uniform1f(u("uT"), state.moving ? state.t : 0);
      g.drawArrays(g.POINTS, 0, n);
    }

    function step(dt: number): void {
      /* scroll sets a target, the handoff walks towards it */
      hand.want = scrollProgress();
      hand.p = reduced ? hand.want : hand.p + (hand.want - hand.p) * (1 - Math.exp(-dt / SCRUB));
      if (Math.abs(hand.want - hand.p) < 0.0005) hand.p = hand.want;
      fieldHandoff.p = ready ? hand.p : 0;

      const f = 1 - Math.exp(-dt / TILT_EASE);
      tilt.x += (aim.x * TILT - tilt.x) * f;
      tilt.y += (aim.y * TILT - tilt.y) * f;

      if (!ready || reduced) return;
      if (hand.p <= 0.0005) {
        /* gone back to the field entirely: next time, start again from the helix */
        if (state.still !== 0 || state.moving) {
          state.still = 0;
          state.moving = false;
          current = assign(0);
          next = assign(1);
          upload();
        }
        state.wait = 0;
        return;
      }
      if (state.moving) {
        state.t = Math.min(1, state.t + dt / MOVE);
        if (state.t < 1) return;
        state.moving = false;
        state.wait = 0;
        state.still = (state.still + 1) % stills.length;
        current = next;
        next = assign((state.still + 1) % stills.length);
        upload();
      } else {
        state.wait += dt;
        if (state.wait >= HOLD) {
          state.moving = true;
          state.t = 0;
        }
      }
    }

    /* the loop runs while the frame is on screen or the handoff is still on its way back */
    let onScreen = false;
    function loop(now: number): void {
      raf = 0;
      if (document.hidden) return;
      step(Math.min((now - beat) / 1000, 0.05));
      beat = now;
      draw(now);
      if (onScreen || hand.p > 0) raf = requestAnimationFrame(loop);
    }
    function wake(): void {
      if (raf || document.hidden) return;
      beat = performance.now();
      raf = requestAnimationFrame(loop);
    }

    /**
     * Lays the lattice over the frame at the helix's pitch for this screen,
     * renders the stills onto it, and starts the slots again from the helix.
     * Only when the lattice actually changes.
     */
    function rebuild(): void {
      if (!near) return;
      const pitch = CELL * helixScale(view.vw, view.vh); // CSS px, as the helix
      const width = frame!.getBoundingClientRect().width;
      /* a window or frame with no size yet (a hidden tab): wait for the next resize */
      if (!(pitch > 0) || !(width > 0)) return;
      const cols = Math.max(60, Math.round(width / pitch));
      if (cols === lattice.cols) return;
      lattice.cols = cols;

      stills = FIGURES.map((f) => render(f, cols));
      const { rows, cell } = stills[0];
      const total = cols * rows;
      const rnd = mulberry32(0x0f1e1d);
      const jx = Float32Array.from({ length: total }, () => (rnd() * 2 - 1) * 0.45);
      const jy = Float32Array.from({ length: total }, () => (rnd() * 2 - 1) * 0.45);
      seed = Float32Array.from({ length: total }, () => rnd() * 6.2832);
      lx = new Float32Array(total);
      ly = new Float32Array(total);
      for (let k = 0; k < total; k++) {
        lx[k] = ((k % cols) + 0.5 + jx[k]) * cell;
        ly[k] = (Math.floor(k / cols) + 0.5 + jy[k]) * cell;
      }
      lit = stills.map((s) => {
        const idx: number[] = [];
        for (let k = 0; k < total; k++) if (s.ink[k] > 0) idx.push(k);
        return Int32Array.from(idx);
      });
      n = Math.max(FIELD_N, ...lit.map((l) => l.length));
      const r = mulberry32(0x6a7e);
      slotKey = Float32Array.from({ length: n }, () => r() * 100);
      state.still = 0;
      state.moving = false;
      state.wait = 0;
      current = assign(0);
      next = assign(1);
      upload();
      ready = true;
    }

    layout();
    /* render the stills well before the frame arrives */
    const nearby = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || near) return;
        near = true;
        rebuild();
        wake();
      },
      { rootMargin: "800px 0px" },
    );
    const inView = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      wake();
    });
    nearby.observe(frame);
    inView.observe(frame);
    const onResize = () => {
      layout();
      rebuild();
      wake();
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      aim.x = (e.clientX / view.vw) * 2 - 1;
      aim.y = (e.clientY / view.vh) * 2 - 1;
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", wake, { passive: true });
    /* reduced motion keeps the scene square on */
    if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      fieldHandoff.p = 0;
      nearby.disconnect();
      inView.disconnect();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("pointermove", onPointer);
      g.deleteBuffer(buffer);
      g.deleteProgram(prog);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
