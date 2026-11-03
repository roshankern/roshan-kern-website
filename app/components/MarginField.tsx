"use client";

import { useEffect, useRef } from "react";
import { FIELD_GLSL, FIELD_N, fieldHandoff, fieldParams, fieldUniforms } from "./field";

/**
 * The margin field (./field.ts), drawn in WebGL on a fixed canvas behind the
 * page. Its vertex shader is AnyHealth's helix-hero shader with the break-up
 * taken out: every dot is already settled in the field.
 */

const VERT = `
attribute vec4 aFld;
uniform vec2 uVp;
uniform float uTime;
uniform vec2 uBand;
uniform vec4 uVeil;
uniform float uHand;
varying float vA;
varying float vG;
${FIELD_GLSL}
void main(){
  vec2 px;
  float a, s, g;
  fieldDot(aFld, uTime, uVp, uBand, uVeil, px, a, s, g);
  /* a dot that has gone over to the closing scene is drawn there, not here */
  a *= 1.0 - step(0.0001, fieldHanded(aFld.w, uHand));
  /* dots keep travelling behind the text, they just cannot be seen under it */
  a *= fieldVeil(px.x, uVp, uVeil);
  /* sub-pixel points: hold a 2px floor and pay for it in coverage */
  float sz = max(s, 2.0);
  a *= clamp((s * s) / (sz * sz), 0.0, 1.0);
  gl_PointSize = sz;
  vA = a;
  vG = g;
  vec2 c = (px / uVp) * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying float vA;
varying float vG;
void main(){
  float r = length(gl_PointCoord - 0.5);
  /* a solid disc, antialiased over its last few percent */
  float a = vA * (1.0 - smoothstep(0.43, 0.5, r));
  if (a <= 0.004) discard;
  gl_FragColor = vec4(vec3(vG), a);
}
`;

export function MarginField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = cv.getContext("webgl", { alpha: false, antialias: false });
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
      /* no dots on this machine: the page is still the page */
      return;
    }
    g.useProgram(prog);
    g.enable(g.BLEND);
    g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
    const u = (name: string) => g.getUniformLocation(prog, name);

    const buf = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, fieldParams(), g.STATIC_DRAW);
    const loc = g.getAttribLocation(prog, "aFld");
    g.enableVertexAttribArray(loc);
    g.vertexAttribPointer(loc, 4, g.FLOAT, false, 0, 0);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const view = { vw: 0, vh: 0, dpr: 1 };
    let raf = 0;

    function layout(): void {
      view.vw = window.innerWidth;
      view.vh = window.innerHeight;
      view.dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv!.width = Math.round(view.vw * view.dpr);
      cv!.height = Math.round(view.vh * view.dpr);
      g.viewport(0, 0, cv!.width, cv!.height);
    }

    function draw(): void {
      const { vw, vh, dpr } = view;
      const { band, veil } = fieldUniforms(vw, dpr);
      g.clearColor(1, 1, 1, 1);
      g.clear(g.COLOR_BUFFER_BIT);
      g.uniform2f(u("uVp"), vw * dpr, vh * dpr);
      /* reduced motion holds the field still */
      g.uniform1f(u("uTime"), reduced ? 0 : performance.now() / 1000);
      g.uniform2f(u("uBand"), band[0], band[1]);
      g.uniform4f(u("uVeil"), veil[0], veil[1], veil[2], veil[3]);
      g.uniform1f(u("uHand"), fieldHandoff.p);
      g.drawArrays(g.POINTS, 0, FIELD_N);
    }

    function loop(): void {
      raf = requestAnimationFrame(loop);
      draw();
    }

    function onResize(): void {
      layout();
      if (reduced) draw();
    }

    layout();
    if (reduced) draw();
    else loop();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      g.deleteBuffer(buf);
      g.deleteProgram(prog);
      /* the context itself is left alive: Strict Mode re-runs this effect on the
         same canvas, and a context lost here stays lost for the second run */
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
      <p className="sr-only">Small grey dots drift slowly up the margins on either side of the page.</p>
    </>
  );
}
