/**
 * Renders closing-scene figures to a PNG in the helix's dot grain, for looking
 * at a figure without a browser. The dots follow the helix shader
 * (anyhealth 3700504^, helix-hero.tsx) term for term, at the desktop scale
 * (1.25) and a device pixel ratio of 2.
 *
 *   node --no-warnings --import ./scripts/ts-resolve.mjs scripts/closing-png.ts out.png helix laptop brain
 *
 * Each named figure is drawn side by side; add `--ink` to also show the raw
 * ink map under each, which is handy for checking shapes.
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { CELL, H, W, mulberry32, render, type Figure } from "../app/components/closing/sweep";
import { FIGURES } from "../app/components/closing/figures";

const SCALE = 1.25;
const DPR = 2;
const K = SCALE * DPR; // device px per box unit

const args = process.argv.slice(2);
const out = args[0];
const showInk = args.includes("--ink");
const names = args.slice(1).filter((a) => !a.startsWith("--"));
if (!out || !names.length) throw new Error("usage: closing-png.ts out.png <figure...> [--ink]");
const figs: Figure[] = names.map((n) => {
  const f = FIGURES.find((x) => x.name === n);
  if (!f) throw new Error(`no figure "${n}"; have ${FIGURES.map((x) => x.name).join(", ")}`);
  return f;
});

const fw = Math.round(W * K);
const fh = Math.round(H * K);
const pw = fw * figs.length;
const ph = fh * (showInk ? 2 : 1);
const px = new Float32Array(pw * ph).fill(1); // grey, white ground

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const fract = (x: number) => x - Math.floor(x);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** A solid disc of diameter d at (cx, cy), antialiased over its last few percent, as the helix's fragment shader. */
function disc(ox: number, cx: number, cy: number, d: number, a: number, g: number): void {
  const r = d / 2;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if (y < 0 || y >= ph) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < ox || x >= ox + fw) continue;
      const q = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / d;
      const al = a * (1 - ss(0.43, 0.5, q));
      if (al <= 0.004) continue;
      const i = y * pw + x;
      px[i] = px[i] * (1 - al) + g * al;
    }
  }
}

figs.forEach((fig, f) => {
  const t0 = performance.now();
  const still = render(fig);
  const { cols: COLS, rows: ROWS } = still;
  const ms = Math.round(performance.now() - t0);
  const ox = f * fw;
  /* the lattice: one nudge and one seed per cell, drawn in the same order as ClosingScene.tsx */
  const rnd = mulberry32(0x0f1e1d);
  const total = COLS * ROWS;
  const nx = Float32Array.from({ length: total }, () => (rnd() * 2 - 1) * 0.45);
  const ny = Float32Array.from({ length: total }, () => (rnd() * 2 - 1) * 0.45);
  const seeds = Float32Array.from({ length: total }, () => rnd() * 6.2832);
  let dots = 0;
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const k = j * COLS + i;
      const jx = nx[k];
      const jy = ny[k];
      const seed = seeds[k];
      const v = still.ink[k] / 255;
      if (showInk) {
        const g = 1 - v;
        for (let y = 0; y < CELL * K; y++)
          for (let x = 0; x < CELL * K; x++) {
            const yy = fh + Math.floor(j * CELL * K + y), xx = ox + Math.floor(i * CELL * K + x);
            if (yy < ph && xx < ox + fw) px[yy * pw + xx] = g;
          }
      }
      if (v === 0) continue;
      dots++;
      const near = still.near[k] / 255;
      const jit = mix(0.58, 1.18, fract(seed * 7.31));
      const fleck = (fract(seed * 13.7) >= 0.982 ? 1 : 0) * ss(0.6, 0.95, v);
      const ink = ss(0.035, 0.2, v) * (0.35 + 0.65 * ss(0.03, 0.7, v)) * mix(0.75, 1, near);
      const s = CELL * K * (0.2 + 0.45 * v) * jit * mix(0.8, 1.15, near) * (1 + 0.6 * fleck);
      const g = mix(0.3, 0.02, ss(0.05, 0.6, v)) * (1 - 0.6 * fleck);
      const sz = Math.max(s, 2);
      disc(ox, ox + (i + 0.5 + jx) * CELL * K, (j + 0.5 + jy) * CELL * K, sz, ink * clamp01((s * s) / (sz * sz)), g);
    }
  }
  console.log(`${fig.name}: ${dots} dots, rendered in ${ms}ms`);
});

/* ---- PNG (8-bit greyscale) ---- */
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
const raw = Buffer.alloc((pw + 1) * ph);
for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) raw[y * (pw + 1) + 1 + x] = Math.round(clamp01(px[y * pw + x]) * 255);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(pw, 0);
ihdr.writeUInt32BE(ph, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 0; // greyscale
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log(`wrote ${out} (${pw}x${ph})`);
