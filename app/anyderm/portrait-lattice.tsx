"use client";

import { useEffect, useRef, type JSX } from "react";

/**
 * The closing figure — the opening break-up, run backwards.
 *
 * At the top of the page the rig comes apart one dot at a time and about 1.2%
 * of the dots survive into a field that drifts in the margins for the rest of
 * the article (see ./lattice.tsx). This is the other end of that sentence: as
 * the reader comes down the last screens of the page, dots gather in from
 * beyond the edges of the viewport, shrink from a loose grey cloud down to the
 * portrait's true grain, and settle into a face.
 *
 * The face is Roshan's, and it is the closing composition rather than a
 * full-bleed figure: the contact block sits above it and his own account of why
 * AnyDerm exists sits below, so the reader is looking at the person the section
 * is telling them to text while they read him. That is what sets
 * the layout numbers below. The figure is fitted to half the viewport height
 * and hangs off the foot of the article rather than off the viewport, so it
 * climbs into view out of the last section's wake and can never be on top of
 * the copy. The runway is only as tall as the space the portrait needs under
 * that copy; the convergence borrows the screen and a bit of scroll above it
 * rather than demanding page height of its own, which is the price of having
 * the contact block and the face share the closing frame.
 *
 * Everything the opening does forwards, this does in reverse. The delay rule is
 * flipped — the opening releases the frame outside-in, so this one arrives
 * inside-out, the core landing first and the outermost dots still travelling
 * when the image is nearly whole. The survivors are flipped too: there a fixed
 * FIELD_N escape the dissolve into the drifting field, here the same FIELD_N
 * leave that field for the face. Not the same species of dot — the same dots.
 * Both figures generate the field from the same count and the same seed, so dot
 * j sits in the same place, at the same size, on the same clock in both, and the
 * moment this one starts flying it in is the moment the other lets it go. The
 * page never gains a dot; it only spends the ones the rig came apart into.
 *
 * 29,730 points is past what canvas 2D will draw in a frame, so every dot is
 * one vertex and the whole convergence lives in the vertex shader; scroll only
 * moves uniforms. Nothing here assumes that count or the box it is packed in —
 * both come out of the data file, which has been rebaked once already.
 *
 * The dot geometry at rest is the reference still's, unchanged: area
 * proportional to ink, `r = 0.5642 * cell * sqrt(ink)`, drawn at `fill = 2.6`.
 * That fill is deliberately fatter than the animation's 2.12 — the portrait
 * wants its discs to overlap so the lattice closes into continuous tone rather
 * than leaving the page white between dots.
 *
 * Ported from the standalone still in `anyderm-lattice-export/portrait/app.js`,
 * which had no motion at all; the choreography below is new and is modelled on
 * `./lattice.tsx` line for line.
 */

/* ---- layout, in viewport heights ----------------------------------------- */
/**
 * Fraction of viewport height the 1493x2048 box fits into. Half a screen leaves
 * the other half for the contact block above it, which runs 350-400px at
 * 1440x900 — the two together are the closing frame. The data file is baked to
 * this number: the generator solves the cell so a dot lands just over the two
 * device pixels a point can be drawn at, and refitting without rebaking is what
 * put a moiré in the hair the first time round.
 */
const FIT = 0.5;
/**
 * CSS px the contact block needs above the figure, and the floor the figure
 * gives way to on a short screen rather than pushing the heading off the top.
 * The copy is a fixed height whatever the viewport is: about 275px of type plus
 * the 80px of section padding above it, all of which the browser is happy to
 * scroll off — except that it must not, because the heading is the first thing
 * the closing frame says. When this bound binds it is literally where the foot
 * of the article lands, so it is measured in the same units as the copy.
 */
const RESERVE = 360;
/**
 * Where the figure sits, as fractions of viewport height: the top of the box
 * against the foot of the article, and the base of the box against the foot of
 * the document. They are separate constants because they answer to different
 * things — and the pair of them is also the page height the figure claims, so
 * the runway follows either.
 *
 * The top one is negative on purpose. The runway begins at the section's border
 * box, which carries 80px of its own empty bottom padding under the last
 * contact line, and the picture belongs to that copy: tucking up into the
 * padding is what makes the block and the face read as one thing rather than
 * two. Note that only the bottom gap moves the figure on screen — the top one
 * shortens the page instead, which is what brings the copy down to meet it.
 */
const GAP_TOP = -0.058;
const GAP_BOTTOM = 0.03;
/** Scroll above the runway the convergence borrows, in viewport heights. */
const LEADIN = 1.2;

/* ---- choreography, in scroll-progress units ------------------------------ */
/**
 * Scroll range the convergence plays over, inside the measured window. It ends
 * at 1, which `layout` places at the offset that leaves the face centred on the
 * screen — the figure rides up out of the article's wake, so arriving and coming
 * into view are the same movement, and it comes to rest with the quote below it
 * just entering from the bottom edge. It starts late so the reader has the
 * better part of a screen of the closing section before the margins begin
 * emptying themselves into the face.
 */
const GATHER: [number, number] = [0.4, 1];
/** How much of that window the figure fades in over as it enters the page. */
const LEAD = 0.03;
/**
 * The margin field, declared identically in `lattice.tsx`. An exact count and a
 * seed, and from those both files generate the same list of dots with no shared
 * code: field dot j is the same dot in both — same place in the band, same size,
 * same drift, same instant it changes hands. Change either half and you must
 * change the other; the handover is invisible only because they agree exactly.
 *
 * The long docblock over there is the canonical one, as is ./anyderm-lattice.md.
 */
const FIELD_N = 1401;
const FIELD_SEED = 0x0f1e1d;

/**
 * Seconds the gathering takes to close most of its distance to where the scroll
 * says it should be — exactly what the opening does, for the same reason. Scroll
 * sets a target and the frame eases towards it, so a flick plays the convergence
 * through at its own pace instead of assembling a third of the face in one
 * frame, and a slow scroll still tracks within a pixel or two. The same
 * animation either way, which is the whole point of having it.
 */
const SCRUB = 0.15;
/** How far a unit scatter offset reaches, as a fraction of the viewport. */
const SPREAD = 0.72;
/**
 * Extra dot radius while a dot is still travelling, as a multiple of its own.
 * Lower than it was: the lattice is baked at this figure's fitted size now, so
 * a resting dot is already two and a half CSS px and the old multiplier turned
 * the incoming cloud into blobs rather than dots.
 */
const GROW = 1.8;

/**
 * The article measure the drifting dots clear, in CSS px — the same 42rem
 * column the opening figure veils, so both fields respect the same gutter.
 */
const MEASURE = 672;

const DATA_URL = "/anyderm/portrait/portrait.json";

/** Fallbacks; the shipped file carries both, and the generator solved for them. */
const GREY = 0.055;
const FILL = 2.6;

type Portrait = {
	/** Virtual box the lattice coordinates are scaled into. */
	vw: number;
	vh: number;
	cell: number;
	fill?: number;
	grey?: number;
	/** One set, not three — this figure has no rig and no halo. */
	set: { b64: string; n: number };
};

/** A linked program with its uniform and attribute locations resolved once. */
type Prog = WebGLProgram & {
	u: Record<string, WebGLUniformLocation | null>;
	a: Record<string, number>;
};

/* ---- shaders ------------------------------------------------------------- */

const VERT = `
attribute vec2 aPos;
attribute float aR;
attribute vec4 aDis;
attribute vec4 aFld;
uniform vec2 uVp;
uniform vec2 uOrigin;
uniform vec2 uHalf;
uniform float uK;
uniform float uDot;
uniform float uGrey;
uniform float uGat;
uniform float uTime;
uniform vec2 uSpread;
uniform vec2 uBand;
uniform vec3 uVeil;
uniform float uCut;
uniform float uDpr;
uniform float uIn;
varying float vA;
varying float vG;
void main(){
  vec2 px = uOrigin + (aPos - uHalf) * uK;

  /* inside-out, the exact flip of the opening's outside-in release: the delay
     grows with distance from the centre of the frame, so the core of the face
     is already resolved while the edges are still on their way in */
  float t = clamp((uGat - aDis.x * 0.52) / 0.48, 0.0, 1.0);
  float away = 1.0 - t;
  float e = away * away;

  float sp = 0.4 + 0.4 * fract(aFld.w);
  float rise = 6.0 + 12.0 * fract(aFld.w * 3.1);
  vec2 wob = vec2(sin(uTime * sp + aFld.w),
                  cos(uTime * sp * 0.73 + aFld.w)) * aFld.z;

  /* the scatter is held as a fraction of the viewport rather than in box units,
     because the dots have to start outside the frame no matter how small the
     portrait is fitted; independent horizontal and vertical travel, then the
     field's own wobble on top, both strongest while the dot is furthest out */
  px += vec2(aDis.y, aDis.z) * uSpread * e;
  px += wob * smoothstep(0.0, 0.45, away);

  /* most dots are simply not there until they arrive — 92k loose dots at any
     real opacity is fog, not a gathering, so the ink appears with the image */
  float a = pow(t, 1.3);
  /* large and loose, shrinking to the portrait's own grain as it lands */
  float s = aR * uDot * uK * (1.0 + ${GROW.toFixed(1)} * away);
  float g = mix(0.5, uGrey, t);

  /* The field dots. These are not this figure's dots at all until it comes for
     them: the opening figure has been drawing them beside the article all page,
     from the same list, at the same place, and hands each one over on the frame
     it starts to move. So they leave the margins for their lattice position
     rather than arriving from outside the frame, and no dot is ever added. */
  float fieldish = 0.0;
  if (aDis.w > 0.5) {
    float u = abs(aFld.x);
    float ft = uTime * 0.33;
    float sway = (70.0 + 150.0 * fract(aFld.z * 0.61)) * uDpr;
    float fx = uOrigin.x + sign(aFld.x) * mix(uBand.x, uBand.y, u)
             + sin(ft * sp * 0.42 + aFld.w) * sway;
    float span = uVp.y + 40.0;
    float fy = aFld.y * uVp.y
             + cos(ft * sp * 0.73 + aFld.w) * aFld.z - ft * rise;
    fy = mod(fy + 20.0, span) - 20.0;
    float m = smoothstep(0.0, 1.0, t);
    /* Handed over at the instant it starts to move. Until then the opening
       figure is drawing this dot, at this exact place and this exact size, and
       it releases it on the same threshold — so the two are complementary
       halves of one dot rather than a crossfade between two of them. */
    float here = smoothstep(0.0, 0.02, t);
    fieldish = 1.0 - smoothstep(0.0, 0.25, t);
    px = mix(vec2(fx, fy), px, m);
    a = mix((0.5 + 0.35 * fract(aFld.z)) * here, 1.0, m);
    /* sized in device pixels, so this has to carry the ratio itself */
    s = mix((2.0 + 4.0 * fract(aFld.z * 0.37)) * uDpr, s, m);
    g = mix(0.55, uGrey, m);
  }

  /* Two masks, because the face lands inside the measure and the article slides
     down through the band it lands in. First the same white gutter the opening
     keeps over the column, so the drifting dots never cross the copy. Second a
     cut just above the figure: inside the column, ink only shows below the last
     line of copy, and uCut is placed so the ramp closes before the top of the
     box — the face is never cut, only the loose dots that stray over the text.
     Outside the column either one is enough, hence the max, so the margin field
     reads the whole way down while the face is uncovered by the article leaving
     rather than painted over the top of it. */
  float dx = abs(px.x - uOrigin.x);
  float veil = smoothstep(uVeil.x, uVeil.y, dx)
             * (1.0 - smoothstep(uVeil.z, uVeil.z + 60.0, dx));
  float clear = smoothstep(uCut - 30.0 * uDpr, uCut, px.y);
  /* A dot still sitting in the band is the opening figure's dot, and that figure
     masks with the veil alone. Letting the cut open for it here would light it
     inside the column at the one moment the two have to agree exactly, so it is
     held shut until the dot has left, and is back long before it lands. */
  a *= max(veil, clear * (1.0 - fieldish)) * uIn;

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

/* premultiplied out: this canvas is transparent so the opening figure's own
   canvas (and the drifting dots on it) still show through underneath */
const FRAG = `
precision mediump float;
varying float vA;
varying float vG;
void main(){
  float r = length(gl_PointCoord - 0.5);
  float a = vA * (1.0 - smoothstep(0.43, 0.5, r));
  if (a <= 0.004) discard;
  gl_FragColor = vec4(vec3(vG) * a, a);
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
 * dot: when this figure comes to collect it, then the four that place it in the
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
 * Scroll-driven point cloud that closes the page. Renders its own transparent
 * fixed canvas and the runway the convergence plays out over; the canvas sits
 * over the opening figure's opaque one, so both fields of dots are visible at
 * once and the article text still paints above them both.
 */
export function PortraitLattice(): JSX.Element {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const sceneRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const cv = canvasRef.current;
		const scene = sceneRef.current;
		if (!cv || !scene) return;

		let gl: WebGLRenderingContext | null = null;
		try {
			gl = cv.getContext("webgl", { alpha: true, antialias: false });
		} catch {
			gl = null;
		}
		if (!gl) return;
		const g = gl;

		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		let dead = false;
		let D: Portrait | null = null;
		let total = 0;
		let solo = false;
		let soloStyle: HTMLStyleElement | null = null;

		const buf: Record<string, WebGLBuffer | null> = {};
		let raf = 0;
		let running = false;
		/**
		 * `want` is where the scroll says the gathering should be and `t` is where it
		 * has actually got to; `gat` and `fade` are read off `t`. `edge` is the one
		 * exception and has to stay one: it is where the foot of the article is, and
		 * the figure is registered to the document the way the wordmark at the top of
		 * the page is registered to its heading. Easing a position is what makes two
		 * things that should read as one block bounce against each other.
		 */
		const state = { t: 0, want: 0, gat: 0, fade: 0, edge: 0 };
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
		/* premultiplied source, because the frame buffer starts transparent and
		   is composited over the opening figure's canvas rather than over white */
		g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
		const prog = link(VERT, FRAG);

		/* ---- point cloud ----------------------------------------------------- */

		function build(d: Portrait): void {
			const pts = decode(d.set.b64);
			total = pts.length;

			const pos = new Float32Array(total * 2);
			const rad = new Float32Array(total);
			const dis = new Float32Array(total * 4);
			const fld = new Float32Array(total * 4);

			const rmax = d.cell * 0.5642;
			const cx = d.vw / 2;
			const cy = d.vh / 2;
			const maxR = Math.sqrt(cx * cx + cy * cy);
			const rnd = mulberry32(0xc105e);

			for (let i = 0; i < total; i++) {
				const p = pts[i] as number;
				const x = p & 2047;
				const y = (p >>> 11) & 2047;
				pos[i * 2] = x;
				pos[i * 2 + 1] = y;
				rad[i] = rmax * Math.sqrt(((p >>> 22) & 255) / 255);

				/* inside-out: distance from the centre of the frame sets the delay,
				   the one sign flip that turns the opening's break-up into this */
				const dx = x - cx;
				const dy = y - cy;
				const far = clamp01((Math.sqrt(dx * dx + dy * dy) / maxR) * 1.25);
				dis[i * 4] = clamp01(0.45 * far + 0.55 * rnd());
				/* horizontal travel mostly follows which side of the frame it is on,
				   so each half of the face is gathered in from its own edge */
				let side = dx < 0 ? -1 : 1;
				if (rnd() < 0.22) side = -side;
				dis[i * 4 + 1] = side * (0.55 + rnd() * 1.05);
				dis[i * 4 + 2] = (rnd() - 0.5) * 2 * (0.35 + rnd() * 1.1);
				dis[i * 4 + 3] = 0;

				fld[i * 4] = (rnd() < 0.5 ? -1 : 1) * Math.pow(rnd(), 0.55);
				fld[i * 4 + 1] = rnd();
				fld[i * 4 + 2] = 4 + rnd() * 18;
				fld[i * 4 + 3] = rnd() * 6.2832;
			}

			/* The field, generated exactly as the opening figure generates it — same
			   count, same seed, same order — so dot j here is dot j drifting up there.
			   Which dots carry it is an even stride through the portrait, so the ones
			   that arrive first are spread over the whole face; their departure delay
			   comes from the shared list instead of the radial rule, because that delay
			   is the handover signal and is the one thing the other file also has to
			   know. Five per cent of the face gives up its inside-out order for it,
			   which does not read against the other ninety-five that keep it. */
			const field = fieldDots();
			for (let j = 0; j < FIELD_N; j++) {
				const i = Math.floor(((j + 0.5) * total) / FIELD_N);
				const d0 = field[j * 5] as number;
				dis[i * 4] = d0;
				dis[i * 4 + 3] = 1 + d0;
				fld[i * 4] = field[j * 5 + 1] as number;
				fld[i * 4 + 1] = field[j * 5 + 2] as number;
				fld[i * 4 + 2] = field[j * 5 + 3] as number;
				fld[i * 4 + 3] = field[j * 5 + 4] as number;
			}

			buf.pos = vbo(pos);
			buf.rad = vbo(rad);
			buf.dis = vbo(dis);
			buf.fld = vbo(fld);
		}

		function bind(loc: number | undefined, b: WebGLBuffer | null, n: number): void {
			if (loc === undefined || loc < 0 || !b) return;
			g.bindBuffer(g.ARRAY_BUFFER, b);
			g.enableVertexAttribArray(loc);
			g.vertexAttribPointer(loc, n, g.FLOAT, false, 0, 0);
		}

		/* ---- frame ----------------------------------------------------------- */

		const view = {
			vw: 0,
			vh: 0,
			dpr: 1,
			k: 0,
			/** Height of the fitted box on screen, in CSS px. */
			boxH: 0,
			/** Page height the figure claims under the article, in CSS px. */
			runway: 0,
			/** Scroll the gathering plays over, in CSS px — see `layout`. */
			span: 0,
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

			/* Three ways the box can be bound, and the tightest wins: the width of a
			   narrow phone, the half-screen the piece is composed at, and whatever is
			   left once the contact block has taken the CSS px it needs. On a short
			   window the third one is what stops the copy being pushed off the top. */
			const room = Math.max(vh * 0.25, vh * (1 - GAP_TOP - GAP_BOTTOM) - RESERVE);
			const kCss = Math.min((vw * 0.94) / D.vw, (vh * FIT) / D.vh, room / D.vh);
			view.k = kCss * dpr;

			/* The runway is exactly the page height the figure takes — the box plus a
			   gap at each end — so the contact block lands above it and the quote
			   below it, and neither can ever be under the face. Derived and not a
			   constant: change the fit and the page height follows. */
			view.boxH = D.vh * kCss;
			view.runway = view.boxH + vh * (GAP_TOP + GAP_BOTTOM);
			scene!.style.height = `${Math.round(view.runway)}px`;

			/* Where the gathering ends: with the face centred on the screen, not with
			   the document at its foot. There is a quote under the portrait now, and
			   the last dot should land while the reader still has the whole face in
			   front of them and the first line of that quote is coming up from the
			   bottom edge. So the run is measured from LEADIN viewports before the
			   runway enters to the scroll offset that centres the box, and the page
			   keeps scrolling normally from there. */
			view.span = (1 + LEADIN) * vh - (vh * (0.5 - GAP_TOP) - view.boxH / 2);

			const half = (MEASURE + 56) / 2;
			view.band = [half * 0.88, Math.max(half * 1.0, vw / 2 - 30)];
			view.veil = [half * 0.95, half * 1.5, vw / 2 - 30];
		}

		function draw(): void {
			if (!D) return;
			sample();
			const { vw, vh, dpr } = view;

			/* opaque only in solo capture mode, where the point is to judge the
			   figure with nothing of the page or the opening canvas behind it */
			g.clearColor(solo ? 1 : 0, solo ? 1 : 0, solo ? 1 : 0, solo ? 1 : 0);
			g.clear(g.COLOR_BUFFER_BIT);
			if (state.fade <= 0.001) return;

			/* wall clock rather than a mount-relative one: the opening figure runs the
			   same field maths on the same numbers, and the two only sit on top of each
			   other if they agree on t */
			const t = performance.now() / 1000;
			const vpx = [vw * dpr, vh * dpr];
			/* The figure hangs off the foot of the article rather than off the
			   viewport, so it can never be on top of the copy: it climbs into view
			   from below as the last section clears, and comes to rest exactly when
			   the document does. Both this and the mask read the same edge. */
			const boxTop = state.edge + vh * GAP_TOP;
			const originY = boxTop + view.boxH / 2;

			g.useProgram(prog);
			bind(prog.a.aPos, buf.pos ?? null, 2);
			bind(prog.a.aR, buf.rad ?? null, 1);
			bind(prog.a.aDis, buf.dis ?? null, 4);
			bind(prog.a.aFld, buf.fld ?? null, 4);

			g.uniform2fv(prog.u.uVp ?? null, vpx);
			g.uniform2f(prog.u.uOrigin ?? null, vpx[0]! / 2, originY * dpr);
			g.uniform2f(prog.u.uHalf ?? null, D.vw / 2, D.vh / 2);
			g.uniform1f(prog.u.uK ?? null, view.k);
			g.uniform1f(prog.u.uDot ?? null, D.fill ?? FILL);
			g.uniform1f(prog.u.uGrey ?? null, D.grey ?? GREY);
			g.uniform1f(prog.u.uGat ?? null, state.gat);
			g.uniform1f(prog.u.uTime ?? null, t);
			g.uniform2f(prog.u.uSpread ?? null, vpx[0]! * SPREAD, vpx[1]! * SPREAD);
			g.uniform2f(prog.u.uBand ?? null, view.band[0] * dpr, view.band[1] * dpr);
			g.uniform3f(prog.u.uVeil ?? null, view.veil[0] * dpr, view.veil[1] * dpr, view.veil[2] * dpr);
			/* the ramp has to finish before the box starts, or the mask would eat the
			   top of the hair along with the strays it is there to catch */
			g.uniform1f(prog.u.uCut ?? null, (boxTop - 8) * dpr);
			g.uniform1f(prog.u.uDpr ?? null, dpr);
			g.uniform1f(prog.u.uIn ?? null, state.fade);

			g.drawArrays(g.POINTS, 0, total);
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
		 * How far down the convergence the reader is, and where the foot of the
		 * article sits while they are there.
		 *
		 * The runway is short — it is the space the portrait occupies, not the room
		 * the motion needs — so progress is measured off the runway's top edge over
		 * a window that starts LEADIN viewports before it comes into view and ends
		 * where `view.span` says: the offset that leaves the face centred. A forced
		 * progress runs the same geometry backwards, so a screenshot puts the
		 * article edge where scrolling would.
		 */
		function measure(): { p: number; edge: number } {
			const vh = view.vh || window.innerHeight;
			const from = (1 + LEADIN) * vh;
			const span = view.span;
			/* A forced frame has no scroll position to read, so it runs the geometry
			   backwards and synthesises the edge the given progress implies. */
			if (forced !== null) return { p: forced, edge: from - forced * span };
			/* Everything else reads the edge straight off the element. It must not be
			   derived from `p`, which is clamped: the gathering finishes with the face
			   centred and the reader then scrolls on through the quote, and a derived
			   edge would freeze the figure on screen and let that quote run over it. */
			const top = scene!.getBoundingClientRect().top;
			return { p: clamp01((from - top) / span), edge: top };
		}

		/**
		 * Everything the next paint needs from the scroll position, taken at the top
		 * of the frame that paints rather than in the scroll handler — the canvas is
		 * fixed and the article is not, so a box measured a frame ago is a frame of
		 * drift between the figure and the copy it is composed with.
		 *
		 * The gathering is the one thing eased: scroll sets a target and the frame
		 * walks towards it. Framerate-independent, so 60 and 120 Hz play the same,
		 * and because e^-(a+b) = e^-a · e^-b it does not matter that some frames call
		 * this twice. `edge` is read raw, every frame, and never eased.
		 */
		function sample(): void {
			const { p, edge } = measure();
			state.edge = edge;
			const now = performance.now();
			const dt = Math.min((now - beat) / 1000, 0.25);
			beat = now;
			state.want = p;
			if (primed && !reduced && forced === null) {
				state.t += (state.want - state.t) * (1 - Math.exp(-dt / SCRUB));
			} else state.t = state.want;
			primed = true;
			state.gat = ss(GATHER[0], GATHER[1], state.t);
			/* a forced frame is a screenshot, not a scroll position — do not make it
			   fade itself out on the way in */
			state.fade = forced !== null ? 1 : ss(0, LEAD, state.t);

			/* Published for the opening figure, which reads it off the DOM: the two
			   pieces are one gesture over one population of dots, and this is the whole
			   of the contract between them. It is the eased value rather than the raw
			   scroll, because that is the clock the dots are actually travelling on —
			   the opening has to release a dot on the frame this one picks it up, not
			   on the frame the scroll asked for it. Written on every update, including
			   when the loop is idle, so a parked scroll position still carries a
			   current value: nothing animates once the face has landed. */
			scene!.dataset.q = state.gat.toFixed(4);
		}

		/** Anything still to animate — the scroll wants motion, or damping owes it. */
		function live(): boolean {
			if (Math.abs(state.want - state.t) > 0.0002) return true;
			return state.fade > 0.001 && state.gat < 0.999;
		}

		function update(): void {
			pending = false;
			if (!D) return;
			sample();

			/* Capture only: a forced frame draws the figure where the given progress
			   puts it, but the article is still sitting wherever the document left
			   it, so the two do not line up and the spacing cannot be judged. Slide
			   the page so the section's foot lands on the same edge the figure is
			   hanging off — negative when the copy is taller than the space, which is
			   exactly what the browser does at the foot of a real scroll. */
			if (solo) {
				const host = scene!.parentElement;
				/* the last section on the page is the contact block — the only one the
				   solo stylesheet leaves standing */
				const block = host?.querySelector("section:last-of-type");
				if (host && block) {
					host.style.marginTop = `${Math.round(state.edge - block.getBoundingClientRect().height)}px`;
				}
			}

			/* the dots travel and the damping settles, but a resolved face is a still
			   image and the whole thing is off screen above — neither needs a loop */
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

		void fetch(DATA_URL)
			.then((r) => r.json() as Promise<Portrait>)
			.then((data) => {
				if (dead) return;
				D = data;

				build(D);
				layout();

				/* Capture hooks, deliberately spelled so they cannot collide with the
				   opening figure's #flat / #fp= / #p= on the same hash: #pf= pins a
				   progress value (a headless screenshot does not respect scroll),
				   #pflat drops this runway, and #psolo strips the page back to the
				   contact block and the figure over an opaque ground — which is the
				   closing composition, and the only way to see it without scrolling. */
				if (/[#&]psolo/.test(location.hash)) {
					solo = true;
					soloStyle = document.createElement("style");
					/* !important because the sections carry Tailwind's own `display` */
					soloStyle.textContent =
						`main>section:not(#contact-the-team),` + `main>div[aria-hidden="true"]{display:none!important}`;
					document.head.appendChild(soloStyle);
				}
				if (solo || /[#&]pflat/.test(location.hash)) scene!.style.display = "none";
				const f = /[#&]pf=([\d.]+)/.exec(location.hash);
				if (f?.[1]) forced = clamp01(+f[1]);
				update();
			})
			.catch(() => {
				/* the article still reads without the figure; leave the page alone */
			});

		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onResize);

		return () => {
			dead = true;
			cancelAnimationFrame(raf);
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onResize);
			soloStyle?.remove();
			if (solo && scene.parentElement) scene.parentElement.style.marginTop = "";
			Object.values(buf).forEach((b) => b && g.deleteBuffer(b));
			g.deleteProgram(prog);
			g.getExtension("WEBGL_lose_context")?.loseContext();
		};
	}, []);

	return (
		<>
			{/* transparent, and later in the DOM than the opening figure's canvas, so
			    it composites over that one instead of erasing the dots drifting on it */}
			<canvas
				ref={canvasRef}
				aria-hidden="true"
				className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
			/>
			<p className="sr-only">
				Dots drift in from the edges of the page, shrink, and gather into a portrait of a woman&rsquo;s face
				&mdash; the image that came apart at the top of the page, putting itself back together.
			</p>

			{/* The page height the portrait occupies under the contact block. `layout`
			    replaces this with the figure's measured height as soon as the data is
			    in; the class is what the page is worth before then, and if the fetch
			    never lands. The convergence itself plays out over the scroll above.

			    This element is also the seam between the two figures: `data-q` carries
			    this one's progress, 0 to 1, and the opening figure reads it by id to
			    know how much of its drifting field to give up. It is a DOM attribute
			    rather than shared state on purpose — neither file imports the other,
			    and the figure still works alone if nothing is listening. The 0 here is
			    what the attribute reads before the data lands. */}
			<div ref={sceneRef} id="anyderm-portrait-runway" data-q="0" aria-hidden="true" className="h-[56vh]" />
		</>
	);
}
