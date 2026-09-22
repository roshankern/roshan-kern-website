"use client";

import { useEffect, useRef, type JSX } from "react";

/**
 * The AnyDerm approach piece — one point cloud, drawn in WebGL.
 *
 * At the top of the page the rig rests its lens on her cheek, framed close.
 * Scrolling withdraws it, pulls the camera back, and then takes the image apart
 * one dot at a time: the dots nearest the edges of the frame go first, each
 * scatters horizontally and vertically on its own velocity, and almost all of
 * them fade out while still travelling rather than in place. Exactly 1,401
 * survive, migrate into the margins of the article, and drift there for the rest
 * of the page — until the portrait at the foot of it comes and collects them.
 *
 * A few thousand of them do not fade either: they keep going into the lattice of
 * the "AnyDerm" wordmark and stop there, so the heading has finished building
 * itself out of the rig by the moment the last of the rig is gone. It lands on
 * the real `<h1>`, measured from the DOM and rigidly registered to it, so the
 * dots and the line of copy under them travel as one typeset block. The real
 * glyphs are only made invisible once the dots can actually draw them.
 *
 * All of it — the withdrawal, the break-up, the assembly — runs off one number,
 * one pass of scroll from the top of the page to the offset that leaves the
 * heading centred, eased towards rather than snapped to. See PULL, BREAK and
 * SCRUB below, and `master()`.
 *
 * All of that has to happen per dot, which rules out canvas 2D at 124k points.
 * Every point is one vertex; the dissolve lives in the vertex shader, and all
 * scroll does is move a handful of uniforms.
 *
 * Ported from the standalone page in `anyderm-lattice-export/page/app.js`. The
 * shaders, the choreography constants and the baked `anim.json` are unchanged,
 * so the grain and the motion are identical to the reference. What was dropped:
 * the debug panel (its live values are inlined below), and the boot-time
 * `scrollRestoration = "manual"` + `scrollTo(0, 0)`, which are global side
 * effects a Next route should not impose. Progress is read from `scrollY`, so a
 * reload part-way down still resolves to the right frame.
 *
 * See ./anyderm-lattice.md before regenerating the data.
 */

/* ---- choreography, as fractions of the opening --------------------------- */
/**
 * The whole opening is one run of scroll: `master()` maps everything from the
 * top of the page to the offset that leaves the heading centred onto 0 to 1,
 * and the two phases are laid end to end across it.
 *
 * They overlap by design. The withdrawal has to decelerate into its final
 * framing, so if the break-up waited for it to finish there would be a beat
 * with the rig and the head parked at the edges doing nothing — which is
 * exactly what it used to do, and the thing that read worst. Starting the
 * break-up while the last of the withdrawal is still settling hands one motion
 * straight to the next: they reach the edges and are already going.
 */
const PULL: [number, number] = [0, 0.44]; // together, then apart to the edges
const BREAK: [number, number] = [0.38, 1]; // the image comes apart, the wordmark comes together

/**
 * Seconds the animation takes to close most of its distance to where the scroll
 * says it should be. Scroll sets a target; the frame eases towards it. A flick
 * then plays through at its own pace instead of jumping a third of the piece in
 * one frame, and a slow scroll still tracks within a pixel or two — the same
 * animation either way, which is the point.
 */
const SCRUB = 0.15;

const FOCUS: [number, number] = [1305, 569]; // what the close framing centres on, box units
const ZOOM = 1.1;
const HALO_W = 0.45; // baked halo width, fraction of the baked band
const PAD = 96; // headroom below the box so the base never clips

/**
 * The article measure the settled dots clear, in CSS px. The page sets its copy
 * in `max-w-2xl` (42rem); the reference page used a 680px column.
 */
const MEASURE = 672;

const DATA_URL = "/anyderm/lattice/anim.json";
const MASK_URL = "/anyderm/lattice/rig-silhouette.png";
const WORD_URL = "/anyderm/lattice/wordmark.json";

/** The heading in `page.tsx` the wordmark assembles onto. */
const HEAD_ID = "anyderm-wordmark";

const PORTRAIT_ID = "anyderm-portrait-runway";

/**
 * The margin field: the dots that come out of the break-up, drift beside the
 * article for the length of it, and are taken one at a time by the portrait at
 * the foot of the page.
 *
 * It is declared here and, identically, in `portrait-lattice.tsx`. An exact
 * count and a seed are the whole of it — given those, both files generate the
 * same list of dots without sharing a line of code, and field dot j is the same
 * dot in both: same place in the band, same size, same drift, same instant it
 * changes hands. That is the only reason the handover can be invisible. Nothing
 * pairs them up at runtime; they simply agree, so changing either half of this
 * means changing the other.
 *
 * The closing figure says when. It publishes its own progress as `data-q` on
 * PORTRAIT_ID, 0 to 1, and that is the entire contract between the two — this
 * file does nothing differently if the element is not there, and the field then
 * simply drifts for ever.
 *
 * 1401 is what 1.2% of the eligible cloud came to while the share was a
 * probability, so the field is exactly as dense as it has always been.
 */
const FIELD_N = 1401;
const FIELD_SEED = 0x0f1e1d;

type Pack = { b64: string; n: number };

type Anim = {
	/** Virtual box the lattice coordinates are scaled into. */
	vw: number;
	vh: number;
	cell: number;
	/** How far the rig reaches in from its parked position, box units. */
	reach: [number, number];
	sets: { face: Pack; robot: Pack; halo: Pack };
};

/**
 * The wordmark, baked by the same generator against the same lattice: one dot
 * per cell, `r = 0.5642 * cell * sqrt(ink)`, packed the same way. It carries its
 * own `fill` and `grey` because the generator solved the ink transfer against
 * those exact numbers.
 *
 * `fill` stays at the animation's 2.12, which is the whole point of the piece: a
 * full-ink dot is 1.196 cells across, so dots meet side to side but four of them
 * can never close the 1.414-cell corner between them. That gap is the white the
 * black is drawn on, and it is why the portrait's overlap correction — which
 * would fill those corners in — is deliberately absent here.
 */
type Word = {
	/** Virtual box the wordmark's lattice coordinates are scaled into. */
	vw: number;
	vh: number;
	cell: number;
	fill: number;
	grey: number;
	set: Pack;
};

/** A linked program with its uniform and attribute locations resolved once. */
type Prog = WebGLProgram & {
	u: Record<string, WebGLUniformLocation | null>;
	a: Record<string, number>;
};

/* ---- shaders ------------------------------------------------------------- */

const VERT = `
attribute vec2 aPos;
attribute vec2 aSize;
attribute vec2 aTone;
attribute vec4 aDis;
attribute vec4 aFld;
attribute vec4 aWm;
uniform vec2 uVp;
uniform vec2 uOrigin;
uniform vec2 uFocus;
uniform float uK;
uniform vec2 uRig;
uniform float uDis;
uniform float uTime;
uniform vec2 uBand;
uniform vec4 uVeil;
uniform float uGat;
uniform vec2 uWmO;
uniform float uWmK;
uniform float uWmDot;
uniform float uWmGrey;
varying float vA;
varying float vG;
void main(){
  vec2 p = aPos + uRig * aSize.y;
  vec2 px = uOrigin + (p - uFocus) * uK;

  /* dots near the edge of the frame let go first */
  float d = clamp((uDis - aDis.x * 0.52) / 0.48, 0.0, 1.0);
  float e = d * d;

  float sp = 0.4 + 0.4 * fract(aFld.w);
  float rise = 6.0 + 12.0 * fract(aFld.w * 3.1);
  vec2 wob = vec2(sin(uTime * sp + aFld.w),
                  cos(uTime * sp * 0.73 + aFld.w)) * aFld.z;

  /* scatter: independent horizontal and vertical travel, the way the Astra
     field moves — not a radial burst — then the field's own drift on top */
  px += vec2(aDis.y, aDis.z) * e * uK;
  px += wob * smoothstep(0.0, 0.45, d);

  float a = aTone.y * pow(1.0 - d, 1.6);
  float s = aSize.x * 2.12 * uK * (1.0 - 0.30 * d);
  float g = aTone.x;

  /* the few that survive settle into the margin field instead of fading */
  float keep = step(0.5, aDis.w);
  if (keep > 0.5) {
    float t = abs(aFld.x);
    /* the settled field runs on its own clock, a third of the break-up's, so
       everything below keeps its per-dot variation at a third of the speed */
    float ft = uTime * 0.33;
    /* a slow wide sway carries each one under the text and back out */
    float sway = (70.0 + 150.0 * fract(aFld.z * 0.61)) * uVeil.w;
    float fx = uVp.x * 0.5 + sign(aFld.x) * mix(uBand.x, uBand.y, t)
             + sin(ft * sp * 0.42 + aFld.w) * sway;
    float span = uVp.y + 40.0;
    float fy = aFld.y * uVp.y
             + cos(ft * sp * 0.73 + aFld.w) * aFld.z - ft * rise;
    fy = mod(fy + 20.0, span) - 20.0;
    float m = smoothstep(0.0, 1.0, d);
    px = mix(px, vec2(fx, fy), m);
    /* One field, handed over a dot at a time. aDis.w holds 1 + this dot's place
       in the closing figure's departure queue and uGat is how far that figure
       has got, so this dot lets go at the exact moment the portrait starts
       flying it into the face. Same seed, same position, same size, same grey:
       nothing winks out and nothing appears, the dot only changes canvas. */
    float tj = clamp((uGat - (aDis.w - 1.0) * 0.52) / 0.48, 0.0, 1.0);
    float left = 1.0 - smoothstep(0.0, 0.02, tj);
    a = mix(aTone.y, (0.5 + 0.35 * fract(aFld.z)) * left, m);
    /* sized in device pixels, so this has to carry the ratio itself */
    s = mix(s, (2.0 + 4.0 * fract(aFld.z * 0.37)) * uVeil.w, m);
    g = mix(aTone.x, 0.55, m);
  }

  /* and the wordmark's share carry on past the scatter into their places in the
     "AnyDerm" lattice, on the same terms as everything else: no lerp of their
     own, just the break-up's stagger and wobble, run out to a destination */
  float mark = step(0.5, aWm.w);
  if (mark > 0.5) {
    /* each one on its own approach speed, so they arrive over a spread rather
       than together. aDis.x still says when it lets go, this says how hard it
       runs once it has, and either way it is home at d = 1 — which is the end
       of the dissolve, so the heading is finished when the rig is */
    float m = smoothstep(0.0, 1.0, min(d * (1.0 + 0.85 * fract(aFld.z * 0.41)), 1.0));
    px = mix(px, uWmO + aWm.xy * uWmK, m);
    a = mix(aTone.y, 1.0, m);
    s = mix(s, aWm.z * uWmDot * uWmK, m);
    g = mix(aTone.x, uWmGrey, m);
  }

  /* a white gradient over the measure: dots keep travelling behind the text,
     they just cannot be seen while they are under it. The wordmark is the one
     thing that is meant to sit in the middle of the column, so it is exempt */
  float dx = abs(px.x - uOrigin.x);
  float veil = smoothstep(uVeil.x, uVeil.y, dx)
             * (1.0 - smoothstep(uVeil.z, uVeil.z + 60.0, dx));
  a *= mix(1.0, veil, smoothstep(0.20, 0.85, d) * (1.0 - mark));

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
  float a = vA * (1.0 - smoothstep(0.43, 0.5, r));
  if (a <= 0.004) discard;
  gl_FragColor = vec4(vec3(vG), a);
}
`;

/* the opaque rig silhouette, so her face never reads through the dots */
const QVERT = `
attribute vec2 aXY;
uniform vec2 uVp;
uniform vec2 uOrigin;
uniform vec2 uFocus;
uniform float uK;
uniform vec2 uRig;
uniform vec2 uBox;
varying vec2 vUv;
void main(){
  vUv = aXY;
  vec2 p = aXY * uBox + uRig;
  vec2 px = uOrigin + (p - uFocus) * uK;
  vec2 c = (px / uVp) * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}
`;

const QFRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform float uAlpha;
varying vec2 vUv;
void main(){
  float a = texture2D(uTex, vUv).a * uAlpha;
  if (a <= 0.004) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, a);
}
`;

/* ---- helpers ------------------------------------------------------------- */

function clamp01(x: number): number {
	return x < 0 ? 0 : x > 1 ? 1 : x;
}

function ss(a: number, b: number, x: number): number {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** Seeded PRNG, so every reload lays the scatter out the same way. */
function mulberry32(seed: number): () => number {
	let a = seed;
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Four bytes per dot: x(11) | y(11) | ink(8), base64'd. */
function decode(b64: string): Uint32Array {
	const bin = atob(b64);
	const b = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
	return new Uint32Array(b.buffer);
}

/**
 * The margin field, generated the same way in both figures. Five numbers per
 * dot: when the portrait comes to collect it, then the four that place it in the
 * band and set its drift. The order of the draws is itself part of the contract
 — see FIELD_N above and ./anyderm-lattice.md before touching it.
 */
function fieldDots(): Float32Array {
	const fr = mulberry32(FIELD_SEED);
	const a = new Float32Array(FIELD_N * 5);
	for (let j = 0; j < FIELD_N; j++) {
		a[j * 5] = clamp01(0.45 * fr() + 0.55 * fr());
		a[j * 5 + 1] = (fr() < 0.5 ? -1 : 1) * Math.pow(fr(), 0.55);
		a[j * 5 + 2] = fr();
		a[j * 5 + 3] = 4 + fr() * 18;
		a[j * 5 + 4] = fr() * 6.2832;
	}
	return a;
}

/**
 * Scroll-driven point cloud. Renders the fixed canvas it draws into, the runway
 * the approach plays out over, and the scroll cue. Everything after the runway
 * is ordinary page content drawn over the top of it.
 */
export function LatticeHero(): JSX.Element {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const sceneRef = useRef<HTMLDivElement>(null);
	const cueRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const cv = canvasRef.current;
		const scene = sceneRef.current;
		const cue = cueRef.current;
		if (!cv || !scene || !cue) return;

		let gl: WebGLRenderingContext | null = null;
		try {
			gl = cv.getContext("webgl", { alpha: false, antialias: false });
		} catch {
			gl = null;
		}
		if (!gl) return;
		const g = gl;

		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		let dead = false;
		let D: Anim | null = null;
		let CH = 0;
		let reach: [number, number] = [0, 0];
		let tex: WebGLTexture | null = null;
		let total = 0;

		/* the wordmark, and the two things it needs to be handed out: the dots that
		   are free to carry it, left to right, and the buffer their destinations go
		   into. Until that buffer is filled every aWm.w is zero, so a failed fetch
		   simply means no dot has anywhere to go and the heading keeps its glyphs */
		let W: Word | null = null;
		let wpts: Uint32Array | null = null;
		let free: Int32Array | null = null;
		let dest: Float32Array | null = null;
		let assigned = false;

		const buf: Record<string, WebGLBuffer | null> = {};
		const count = { face: 0, halo: 0, rig: 0 };
		let raf = 0;
		let running = false;
		/**
		 * Everything the frame animates on. `want` is where the scroll says the
		 * opening should be and `t` is where it has actually got to; `pull` and
		 * `dis` are the two phases read off `t`. `pgat` is the closing portrait's
		 * own progress, read off the DOM — how far it has got in coming for the
		 * field.
		 */
		const state = { t: 0, want: 0, dis: 0, pull: 0, pgat: 0 };
		/** Clock for the damping, and whether it has a frame to measure against. */
		let beat = performance.now();
		let primed = false;

		function compile(src: string, type: number): WebGLShader {
			const s = g.createShader(type);
			if (!s) throw new Error("could not create shader");
			g.shaderSource(s, src);
			g.compileShader(s);
			if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
				throw new Error(g.getShaderInfoLog(s) ?? "shader compile failed");
			}
			return s;
		}

		function link(vs: string, fs: string): Prog {
			const p = g.createProgram() as Prog | null;
			if (!p) throw new Error("could not create program");
			g.attachShader(p, compile(vs, g.VERTEX_SHADER));
			g.attachShader(p, compile(fs, g.FRAGMENT_SHADER));
			g.linkProgram(p);
			if (!g.getProgramParameter(p, g.LINK_STATUS)) {
				throw new Error(g.getProgramInfoLog(p) ?? "program link failed");
			}
			p.u = {};
			p.a = {};
			const nu = g.getProgramParameter(p, g.ACTIVE_UNIFORMS) as number;
			for (let i = 0; i < nu; i++) {
				const info = g.getActiveUniform(p, i);
				if (info) p.u[info.name] = g.getUniformLocation(p, info.name);
			}
			const na = g.getProgramParameter(p, g.ACTIVE_ATTRIBUTES) as number;
			for (let i = 0; i < na; i++) {
				const info = g.getActiveAttrib(p, i);
				if (info) p.a[info.name] = g.getAttribLocation(p, info.name);
			}
			return p;
		}

		function vbo(arr: Float32Array): WebGLBuffer | null {
			const b = g.createBuffer();
			g.bindBuffer(g.ARRAY_BUFFER, b);
			g.bufferData(g.ARRAY_BUFFER, arr, g.STATIC_DRAW);
			return b;
		}

		g.enable(g.BLEND);
		g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
		const prog = link(VERT, FRAG);
		const quad = link(QVERT, QFRAG);
		buf.quad = vbo(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]));

		/* ---- point cloud ----------------------------------------------------- */

		function build(d: Anim): void {
			const face = decode(d.sets.face.b64);
			const halo = decode(d.sets.halo.b64);
			const rig = decode(d.sets.robot.b64);
			const rmax = d.cell * 0.5642;

			/* the halo is baked at one width — changing it means rebuilding here */
			const kept: number[] = [];
			for (let i = 0; i < halo.length; i++) {
				const v = halo[i] as number;
				if (((v >>> 22) & 255) / 255 / HALO_W <= 1) kept.push(v);
			}

			count.face = face.length;
			count.halo = kept.length;
			count.rig = rig.length;
			total = count.face + count.halo + count.rig;

			const pos = new Float32Array(total * 2);
			const size = new Float32Array(total * 2);
			const tone = new Float32Array(total * 2);
			const dis = new Float32Array(total * 4);
			const fld = new Float32Array(total * 4);
			const wm = new Float32Array(total * 4);

			const cx = d.vw / 2;
			const cy = CH / 2;
			const maxR = Math.sqrt(cx * cx + cy * cy);
			const rnd = mulberry32(0xa11ce);
			let k = 0;

			function push(p: number, isHalo: boolean, isRig: boolean): void {
				const x = p & 2047;
				const y = (p >>> 11) & 2047;
				const v = ((p >>> 22) & 255) / 255;
				let r: number;
				let grey: number;
				if (isHalo) {
					const t = v / HALO_W;
					r = rmax * Math.sqrt(1 - 0.55 * t * t);
					grey = 1.0;
				} else {
					r = rmax * Math.sqrt(v);
					grey = 0.055;
				}
				pos[k * 2] = x;
				pos[k * 2 + 1] = y;
				size[k * 2] = r;
				size[k * 2 + 1] = isRig ? 1 : 0;
				tone[k * 2] = grey;
				tone[k * 2 + 1] = 1;

				/* outside-in: distance from the centre of the frame sets the delay */
				const dx = x - cx;
				const dy = y - cy;
				const far = clamp01((Math.sqrt(dx * dx + dy * dy) / maxR) * 1.25);
				dis[k * 4] = clamp01(0.45 * (1 - far) + 0.55 * rnd());
				/* horizontal travel mostly follows which side of the frame it is on */
				let side = dx < 0 ? -1 : 1;
				if (rnd() < 0.22) side = -side;
				dis[k * 4 + 1] = side * (110 + rnd() * 390);
				dis[k * 4 + 2] = (rnd() - 0.5) * 2 * (30 + rnd() * 140);
				/* eligibility, not selection: the draw stays so the scatter stream below
				   is bit-identical to the reference, but which dots actually survive is
				   settled once the whole cloud exists — the closing figure has to match
				   the field exactly, and a per-dot probability cannot give it a count */
				dis[k * 4 + 3] = isHalo ? -1 : rnd();

				fld[k * 4] = (rnd() < 0.5 ? -1 : 1) * Math.pow(rnd(), 0.55);
				fld[k * 4 + 1] = rnd();
				fld[k * 4 + 2] = 4 + rnd() * 18;
				fld[k * 4 + 3] = rnd() * 6.2832;
				k++;
			}

			for (let i = 0; i < face.length; i++) push(face[i] as number, false, false);
			for (let i = 0; i < kept.length; i++) push(kept[i] as number, true, true);
			for (let i = 0; i < rig.length; i++) push(rig[i] as number, false, true);

			/* The field, in the one form both figures can agree on. Exactly FIELD_N
			   dots at an even stride through everything eligible, so it is drawn from
			   the whole frame rather than clumping, and each takes its drift and its
			   place in the queue from the shared list. aDis.w holds 1 + the departure
			   delay: still comfortably over the 0.5 that marks a survivor, and the
			   delay is what tells the shader when the portrait comes for this dot. */
			const field = fieldDots();
			const elig: number[] = [];
			for (let i = 0; i < total; i++) if ((dis[i * 4 + 3] as number) >= 0) elig.push(i);
			for (let i = 0; i < total; i++) dis[i * 4 + 3] = 0;
			for (let j = 0; j < FIELD_N; j++) {
				const i = elig[Math.floor(((j + 0.5) * elig.length) / FIELD_N)] as number;
				dis[i * 4 + 3] = 1 + (field[j * 5] as number);
				fld[i * 4] = field[j * 5 + 1] as number;
				fld[i * 4 + 1] = field[j * 5 + 2] as number;
				fld[i * 4 + 2] = field[j * 5 + 3] as number;
				fld[i * 4 + 3] = field[j * 5 + 4] as number;
			}

			/* the halo sits between the face and the rig in the buffer. It is white,
			   so it can never carry ink, and a margin survivor is already spoken for
			   — a dot does one job or the other, never both */
			function spare(i: number): boolean {
				const halo = i >= count.face && i < count.face + count.halo;
				return !halo && dis[i * 4 + 3] < 0.5;
			}

			/* who is free to carry the wordmark, in left-to-right order. Counting
			   sort over the 2048 columns of the box, because a comparator over 120k
			   dots is real time at boot; the order is what lets the destinations be
			   handed out left to right too, so the swarm folds inwards rather than
			   crossing over itself on the way in */
			const bins = new Int32Array(2050);
			let n = 0;
			for (let i = 0; i < total; i++) {
				if (!spare(i)) continue;
				bins[(pos[i * 2] | 0) + 1]++;
				n++;
			}
			for (let i = 1; i < bins.length; i++) bins[i] += bins[i - 1];
			const pool = new Int32Array(n);
			for (let i = 0; i < total; i++) {
				if (!spare(i)) continue;
				pool[bins[pos[i * 2] | 0]++] = i;
			}

			free = pool;
			dest = wm;
			buf.pos = vbo(pos);
			buf.size = vbo(size);
			buf.tone = vbo(tone);
			buf.dis = vbo(dis);
			buf.fld = vbo(fld);
			buf.wm = vbo(wm);
		}

		/**
		 * Hand every dot in the wordmark to one of the dots that is free to carry
		 * it, and hide the glyphs it replaces. Runs once, as soon as the cloud, the
		 * wordmark and a measurable heading are all there.
		 */
		function assign(): void {
			if (assigned || !W || !wpts || !free || !dest || !head) return;
			const n = wpts.length;
			if (free.length < n || !metrics()) return;

			/* both lists in the same order, so the dots on the left of the frame make
			   the A and the ones on the right make the m. Counting sort again */
			const bins = new Int32Array(2050);
			for (let i = 0; i < n; i++) bins[(wpts[i] & 2047) + 1]++;
			for (let i = 1; i < bins.length; i++) bins[i] += bins[i - 1];
			const order = new Int32Array(n);
			for (let i = 0; i < n; i++) order[bins[wpts[i] & 2047]++] = i;

			/* the free dots outnumber the wordmark's four to one, so take an even
			   stride through them: every column of the frame gives up the same share
			   of itself, rather than one region of her face going bald */
			const rmax = W.cell * 0.5642;
			const step = free.length / n;
			for (let i = 0; i < n; i++) {
				const k = free[Math.floor(i * step)];
				const p = wpts[order[i]];
				dest[k * 4] = p & 2047;
				dest[k * 4 + 1] = (p >>> 11) & 2047;
				dest[k * 4 + 2] = rmax * Math.sqrt(((p >>> 22) & 255) / 255);
				dest[k * 4 + 3] = 1;
			}
			g.bindBuffer(g.ARRAY_BUFFER, buf.wm ?? null);
			g.bufferData(g.ARRAY_BUFFER, dest, g.STATIC_DRAW);
			assigned = true;

			/* only now, with the dots able to draw it, does the real heading go
			   invisible. It keeps its box and stays the heading a screen reader
			   sees — with no JS, or a fetch that failed, the type simply stays */
			ink0 = head.style.color;
			head.style.color = "transparent";
			place();
			update();
		}

		function bind(loc: number | undefined, b: WebGLBuffer | null, n: number): void {
			if (loc === undefined || loc < 0 || !b) return;
			g.bindBuffer(g.ARRAY_BUFFER, b);
			g.enableVertexAttribArray(loc);
			g.vertexAttribPointer(loc, n, g.FLOAT, false, 0, 0);
		}

		function attach(p: Prog): void {
			bind(p.a.aPos, buf.pos ?? null, 2);
			bind(p.a.aSize, buf.size ?? null, 2);
			bind(p.a.aTone, buf.tone ?? null, 2);
			bind(p.a.aDis, buf.dis ?? null, 4);
			bind(p.a.aFld, buf.fld ?? null, 4);
			bind(p.a.aWm, buf.wm ?? null, 4);
		}

		/* ---- the heading the wordmark lands on -------------------------------- */

		/**
		 * The dots have to sit exactly where the glyphs would, at whatever size the
		 * responsive type scale is giving them, so the box is measured rather than
		 * guessed. What is measured is the *ink* box — the bounding box of the
		 * letters, which is what the lattice was baked from. It is neither the
		 * element's border box nor its line box: at line-height 1 the line box
		 * starts below the cap line and stops above the descender.
		 */
		const head = document.getElementById(HEAD_ID);
		/* looked up lazily: the portrait is a sibling that may not exist at all */
		let portrait: HTMLElement | null = null;
		const meter = document.createElement("canvas").getContext("2d");
		/** Ink box as an offset inside the heading's border box, CSS px. */
		const ink = { x: 0, y: 0, w: 0, h: 0 };
		/** The same box in the viewport — it moves with every scroll. */
		const slot = { x: 0, y: 0, w: 0, h: 0 };
		/** Whatever inline colour the heading had before the dots took over. */
		let ink0 = "";

		function metrics(): boolean {
			if (!head || !meter) return false;
			const text = (head.textContent ?? "").trim();
			const r = head.getBoundingClientRect();
			if (!text || r.width <= 0) return false;
			const cs = getComputedStyle(head);
			meter.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
			const m = meter.measureText(text);
			/* canvas does not apply letter-spacing and the heading is tracked in, so
			   it goes back by hand: CSS adds a spacing after every character, which
			   is why the line box is n of them wider than the advance while the last
			   glyph has only n - 1 of them in front of it */
			const sp = (parseFloat(cs.letterSpacing) || 0) * (text.length - 1);
			/* CSS centres the font's own ascent + descent in the line box, and the
			   ink box is measured off the baseline that leaves */
			const base = (r.height - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
			ink.x = -m.actualBoundingBoxLeft;
			ink.w = m.actualBoundingBoxRight + sp - ink.x;
			ink.y = base + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent;
			ink.h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
			return ink.w > 0 && ink.h > 0;
		}

		function place(): void {
			if (!head || ink.w <= 0) return;
			const r = head.getBoundingClientRect();
			slot.x = r.left + ink.x;
			slot.y = r.top + ink.y;
			slot.w = ink.w;
			slot.h = ink.h;
		}

		/* ---- frame ----------------------------------------------------------- */

		const view = {
			vw: 0,
			vh: 0,
			dpr: 1,
			stageW: 0,
			band: [0, 0] as [number, number],
			veil: [0, 0, 0] as [number, number, number],
		};

		function layout(): void {
			if (!D) return;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			cv!.width = Math.round(vw * dpr);
			cv!.height = Math.round(vh * dpr);
			g.viewport(0, 0, cv!.width, cv!.height);
			view.vw = vw;
			view.vh = vh;
			view.dpr = dpr;

			const ar = D.vw / CH;
			view.stageW = Math.min(vw * 0.94, vh * 0.84 * ar);

			const half = (MEASURE + 56) / 2;
			view.band = [half * 0.88, Math.max(half * 1.0, vw / 2 - 30)];
			view.veil = [half * 0.95, half * 1.5, vw / 2 - 30];

			/* the heading is responsive, so its ink box is re-measured with the rest
			   of the layout; where that box currently is gets read per frame */
			metrics();
			place();
		}

		function draw(): void {
			if (!D) return;
			sample();
			const { vw, vh, dpr } = view;
			/* wall clock rather than a mount-relative one: the closing figure runs the
			   same field maths on the same numbers, and the two fields only sit on top
			   of each other if they agree on t */
			const t = performance.now() / 1000;

			g.clearColor(1, 1, 1, 1);
			g.clear(g.COLOR_BUFFER_BIT);

			const pull = state.pull;
			const dis = state.dis;
			const s = lerp(ZOOM, 1, pull);
			const k = (view.stageW / D.vw) * s * dpr;
			const fx = lerp(FOCUS[0], D.vw / 2, pull);
			const fy = lerp(FOCUS[1], CH / 2, pull);
			const rig = [reach[0] * (1 - pull), reach[1] * (1 - pull)];
			const vpx = [vw * dpr, vh * dpr];
			const origin = [(vw * dpr) / 2, (vh * dpr) / 2];
			const qAlpha = 1 - clamp01(dis / 0.12);

			/* the wordmark's box, mapped onto the heading's ink box */
			let wk = 0;
			let wox = 0;
			let woy = 0;
			if (W && slot.w > 0) {
				wk = (slot.w / W.vw) * dpr;
				/* rigidly registered to the heading's ink box — no hold, no easing, no
				   damping. The wordmark and the line under it have to read as one
				   block of type, which they only do if the dots travel at exactly the
				   speed of the scroll, the same as the copy they are set against */
				wox = (slot.x + slot.w / 2) * dpr - W.vw * 0.5 * wk;
				woy = (slot.y + slot.h / 2) * dpr - W.vh * 0.5 * wk;
			}

			g.useProgram(prog);
			attach(prog);
			g.uniform2fv(prog.u.uVp ?? null, vpx);
			g.uniform2fv(prog.u.uOrigin ?? null, origin);
			g.uniform2f(prog.u.uFocus ?? null, fx, fy);
			g.uniform1f(prog.u.uK ?? null, k);
			g.uniform2fv(prog.u.uRig ?? null, rig);
			g.uniform1f(prog.u.uDis ?? null, dis);
			g.uniform1f(prog.u.uTime ?? null, t);
			g.uniform2f(prog.u.uBand ?? null, view.band[0] * dpr, view.band[1] * dpr);
			g.uniform4f(prog.u.uVeil ?? null, view.veil[0] * dpr, view.veil[1] * dpr, view.veil[2] * dpr, dpr);
			g.uniform1f(prog.u.uGat ?? null, state.pgat);
			g.uniform2f(prog.u.uWmO ?? null, wox, woy);
			g.uniform1f(prog.u.uWmK ?? null, wk);
			g.uniform1f(prog.u.uWmDot ?? null, W?.fill ?? 0);
			g.uniform1f(prog.u.uWmGrey ?? null, W?.grey ?? 0);

			g.drawArrays(g.POINTS, 0, count.face);
			g.drawArrays(g.POINTS, count.face, count.halo);

			if (qAlpha > 0.004 && tex) {
				g.useProgram(quad);
				g.bindBuffer(g.ARRAY_BUFFER, buf.quad ?? null);
				g.enableVertexAttribArray(quad.a.aXY as number);
				g.vertexAttribPointer(quad.a.aXY as number, 2, g.FLOAT, false, 0, 0);
				g.uniform2fv(quad.u.uVp ?? null, vpx);
				g.uniform2fv(quad.u.uOrigin ?? null, origin);
				g.uniform2f(quad.u.uFocus ?? null, fx, fy);
				g.uniform1f(quad.u.uK ?? null, k);
				g.uniform2fv(quad.u.uRig ?? null, rig);
				g.uniform2f(quad.u.uBox ?? null, D.vw, D.vh);
				g.uniform1f(quad.u.uAlpha ?? null, qAlpha);
				g.activeTexture(g.TEXTURE0);
				g.bindTexture(g.TEXTURE_2D, tex);
				g.uniform1i(quad.u.uTex ?? null, 0);
				g.drawArrays(g.TRIANGLE_STRIP, 0, 4);

				g.useProgram(prog);
				attach(prog);
			}

			g.drawArrays(g.POINTS, count.face + count.halo, count.rig);
		}

		function loop(): void {
			raf = requestAnimationFrame(loop);
			draw();
			/* the damping needs frames of its own to finish catching up, so the loop
			   outlives the scroll that started it and stops once everything is home */
			if (!live()) setRunning(false);
		}

		function setRunning(want: boolean): void {
			if (want === running) return;
			running = want;
			if (want && !reduced) loop();
			else {
				cancelAnimationFrame(raf);
				raf = 0;
			}
		}

		/* ---- scroll ---------------------------------------------------------- */

		let forced: number | null = null;
		let pending = false;

		/**
		 * The opening as one number: 0 at the top of the page, 1 at the scroll
		 * offset that leaves the heading's ink centre in the middle of the screen,
		 * which is where the piece is finished and ordinary scrolling takes over.
		 *
		 * The far end is derived from where that ink box actually is rather than
		 * from the runway, and in document space, so it comes out the same at any
		 * scroll position — and it re-derives itself when the geometry moves under
		 * it. That matters on a phone: `min-h-dvh` and a collapsing URL bar change
		 * the height of everything below the runway mid-scroll, and both ends of
		 * the run move together instead of the timeline jumping. What is left of a
		 * jump the damping absorbs.
		 */
		function master(): number {
			if (forced !== null) return forced;
			const y = window.scrollY || 0;
			if (slot.w > 0) {
				const end = y + slot.y + slot.h / 2 - view.vh / 2;
				return end > 1 ? clamp01(y / end) : 1;
			}
			/* nothing to land on: run the same phases off the runway instead */
			const run = scene!.offsetHeight - window.innerHeight;
			return run > 0 ? clamp01(y / run) : 0;
		}

		/** Anything still to animate — the scroll wants motion, or damping owes it. */
		function live(): boolean {
			return state.want > 0.001 || state.t > 0.001;
		}

		/**
		 * Everything the next paint needs from the scroll position. It is called at
		 * the top of `draw`, in the frame that is about to be composited, and that
		 * placement is the point: the canvas is fixed and the heading is not, so a
		 * box measured in a scroll handler is already a frame old by the time it
		 * reaches the screen. At reading speed that goes unnoticed; on a fast flick
		 * it is a frame of lag between the wordmark and the line under it, which
		 * reads as the two bouncing against each other. Measured per frame, and with
		 * no easing anywhere on the position, they move as one block.
		 *
		 * The animation's own progress is the one thing that is eased, and it is
		 * kept well away from the placement above: scroll sets a target, the frame
		 * walks towards it. Framerate-independent, so 60 and 120 Hz play the same,
		 * and because e^-(a+b) = e^-a · e^-b it does not matter that some frames
		 * call this twice.
		 */
		function sample(): void {
			place();
			const now = performance.now();
			const dt = Math.min((now - beat) / 1000, 0.25);
			beat = now;
			state.want = master();
			if (primed && !reduced) state.t += (state.want - state.t) * (1 - Math.exp(-dt / SCRUB));
			else state.t = state.want;
			primed = true;
			state.pull = ss(PULL[0], PULL[1], state.t);
			/* half straight line, half smoothstep. A pure smoothstep is the wrong
			   shape for a phase this long: its flat head puts a pause between the
			   withdrawal and the break-up, and its flat tail leaves the wordmark
			   finished a sixth of a screen before the heading is centred. Halving
			   the flatness at both ends keeps the rate close to even without the
			   corner a straight line would put at either end */
			const u = clamp01((state.t - BREAK[0]) / (BREAK[1] - BREAK[0]));
			state.dis = 0.5 * (u + ss(0, 1, u));
			/* the portrait at the foot of the page is made out of the margin field and
			   publishes how far its gathering has got; the shader turns that into a
			   per-dot release, so nothing up here has to track which dots have gone */
			if (!portrait) portrait = document.getElementById(PORTRAIT_ID);
			state.pgat = portrait ? Number(portrait.dataset.q) || 0 : 0;
		}

		function update(): void {
			pending = false;
			if (!D) return;
			sample();

			cue!.style.opacity = (1 - ss(0, 0.05, state.want)).toFixed(3);

			/* nothing moves while the page is still at the top of the opening */
			setRunning(live());
			/* reduced motion never gets a loop, so every scroll draws its own frame */
			if (!running || reduced) draw();
		}

		function onScroll(): void {
			if (pending) return;
			pending = true;
			requestAnimationFrame(update);
		}

		function onResize(): void {
			if (!D) return;
			layout();
			update();
		}

		/* ---- boot ------------------------------------------------------------ */

		const img = new Image();
		img.onload = function () {
			if (dead) return;
			tex = g.createTexture();
			g.bindTexture(g.TEXTURE_2D, tex);
			g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
			g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
			g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
			g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
			g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
			draw();
		};
		img.src = MASK_URL;

		void fetch(DATA_URL)
			.then((r) => r.json() as Promise<Anim>)
			.then((data) => {
				if (dead) return;
				D = data;
				CH = D.vh + PAD;
				reach = [D.reach[0], D.reach[1]];

				build(D);
				layout();

				/* capture hooks: #flat drops the runway, #fp= pins a progress value
				   (a headless screenshot does not respect sticky scroll), #p= scrolls
				   to that fraction instead. #fp= pins the opening's own 0-to-1, so a
				   still can be asked for any stage of it, and it pins the damping
				   with it — the frame is drawn exactly there, not eased towards it. */
				if (/[#&]flat/.test(location.hash)) scene!.style.display = "none";
				const f = /[#&]fp=([\d.]+)/.exec(location.hash);
				if (f?.[1]) forced = clamp01(+f[1]);
				const m = /[#&]p=([\d.]+)/.exec(location.hash);
				if (m?.[1]) window.scrollTo(0, (scene!.offsetHeight - window.innerHeight) * +m[1]);
				update();
				assign();
			})
			.catch(() => {
				/* the article still reads without the figure; leave the page alone */
			});

		void fetch(WORD_URL)
			.then((r) => r.json() as Promise<Word>)
			.then((data) => {
				if (dead) return;
				W = data;
				wpts = decode(data.set.b64);
				assign();
			})
			.catch(() => {
				/* no wordmark: nothing is given a destination, every dot fades the way
				   it always did, and the heading keeps its own glyphs */
			});

		/* the heading's box depends on a webfont, so measure it again once the real
		   face is in — the first measurement can be the fallback's */
		void document.fonts.ready.then(() => {
			if (dead) return;
			layout();
			update();
		});

		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onResize);

		return () => {
			dead = true;
			cancelAnimationFrame(raf);
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onResize);
			img.onload = null;
			/* the glyphs are only ever hidden while there are dots drawing them */
			if (assigned && head) head.style.color = ink0;
			Object.values(buf).forEach((b) => b && g.deleteBuffer(b));
			if (tex) g.deleteTexture(tex);
			g.deleteProgram(prog);
			g.deleteProgram(quad);
			g.getExtension("WEBGL_lose_context")?.loseContext();
		};
	}, []);

	return (
		<>
			{/* every dot on the page lives in here: the figure, its break-up, and the
			    field the surviving dots drift in afterwards */}
			<canvas
				ref={canvasRef}
				aria-hidden="true"
				className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
			/>
			<p className="sr-only">
				A robot arm holding a phone rests its lens against a woman&rsquo;s cheek. As the page scrolls the arm
				withdraws and the whole image comes apart into its individual dots. Most fade out; some travel on and
				settle into the letters of the AnyDerm heading below, and the few left over drift into the margins.
			</p>

			{/* runway the approach plays out over; the figure itself is on the canvas */}
			{/* Runway the approach plays out over. It is not the timeline — that runs
			    to wherever the heading is — but it is what sets the pace, because it
			    is most of the scroll the opening has to spend. It was 260vh when the
			    break-up was crammed into the last stretch; at 150vh the heading's box
			    is on screen for the last third of the run, so the wordmark can be
			    watched assembling instead of arriving already made. */}
			<div ref={sceneRef} aria-hidden="true" className="h-[150vh]" />

			<div
				ref={cueRef}
				aria-hidden="true"
				className="pointer-events-none fixed bottom-[34px] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3.5 text-[20px] text-black/45 motion-reduce:hidden"
			>
				<span>Scroll</span>
				<i className="block h-[68px] w-px bg-gradient-to-b from-black/45 to-transparent" />
			</div>
		</>
	);
}
