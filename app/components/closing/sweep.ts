/**
 * The closing scene's figures, drawn exactly the way AnyHealth's helix was
 * (anyhealth 3700504^, website/src/app/helix.ts): every figure is a sweep of
 * spheres into a small depth-buffered ink map, lit as dark tubes with a
 * highlight, its far side fading back, and a white gap wherever one part passes
 * in front of another. The ink map is then averaged down to one dot per cell of
 * a fine lattice, and ./ClosingScene.tsx turns each cell's ink and nearness into
 * a dot in the helix's grain.
 *
 * Nothing here touches the DOM, so the same code runs in the page and in
 * scripts/closing-png.ts.
 */

/* ---- the dot grain, as the helix ------------------------------------------- */
export const CELL = 3; // box units per lattice cell on a desktop screen
const SS = 3; // ink samples per cell edge
const MIN_INK = 0.035; // the lightest dot kept

/** Every figure shares one frame, in box units (CSS px at scale 1). */
export const W = 600;
export const H = 480;

export type Vec3 = [number, number, number];

/** Materials, as the helix: a lit tube with a highlight, and a flatter, paler connector. */
export const TUBE = 1;
export const RUNG = 2;
export type Material = typeof TUBE | typeof RUNG;

/** What a figure draws with. Coordinates are box units: x right, y down, z towards the viewer. */
export type Pen = {
  /** One sphere of radius R; `halo` is how far past it the gap it cuts in other groups reaches. */
  sphere(p: Vec3, R: number, halo: number, mat: Material, group: number): void;
  /** A sphere swept from a to c, one sample per ink-map px: a straight tube. */
  sweep(a: Vec3, c: Vec3, R: number, halo: number, mat: Material, group: number): void;
  /** A sphere swept through each point in turn: a bent tube. `closed` joins the last point to the first. */
  path(points: Vec3[], R: number, halo: number, mat: Material, group: number, closed?: boolean): void;
};

export type Figure = {
  name: string;
  /**
   * Half the figure's depth, box units: shading fades from full at z = +amp to
   * half at z = -amp, as the helix's AMP. Nearness for the dots runs over
   * amp plus the thickest radius drawn.
   */
  amp: number;
  /** How far in front a halo must be before it clears a surface, box units (the helix used 12). */
  margin?: number;
  draw(pen: Pen): void;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

const LIGHT = norm([-0.42, -0.58, 0.7]);
const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);

/** The helix's lighting, unchanged: dark material, a highlight along each tube, the far side fading back. */
function shade(mat: number, ndl: number, ndh: number, depth: number): number {
  const far = 0.5 + 0.5 * depth * depth * (3 - 2 * depth);
  if (mat === RUNG) return (0.92 - 0.5 * ndl) * far;
  return (0.98 - 0.66 * Math.pow(ndl, 1.5) - 0.3 * Math.pow(ndh, 36)) * far;
}

/**
 * A rotation about the frame's centre: `yaw` turns about the vertical axis
 * (positive brings the right side towards the viewer), then `pitch` tips about
 * the horizontal (positive brings the top towards the viewer). Model points are
 * given about their own origin; the result is in frame coordinates.
 */
export function turn(yaw: number, pitch: number, centre: Vec3 = [W / 2, H / 2, 0]): (p: Vec3) => Vec3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return ([x, y, z]) => {
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return [centre[0] + x1, centre[1] + y2, centre[2] + z2];
  };
}

export type Still = {
  /** The lattice: cells across and down, and a cell's size in box units. */
  cols: number;
  rows: number;
  cell: number;
  /** Ink per cell, 0 (no dot) to 255, cols x rows in reading order. */
  ink: Uint8Array;
  /** How near the figure is in each cell, 0 far to 255 near; 128 where there is nothing. */
  near: Uint8Array;
};

/**
 * Renders a figure to one still on a lattice `cols` cells across. The default is
 * the desktop lattice; a narrow screen asks for fewer, larger cells, so its dots
 * keep the same on-screen pitch while the figure shrinks to fit.
 */
export function render(fig: Figure, cols = W / CELL): Still {
  const cell = W / cols;
  const rows = Math.round(H / cell);
  const MW = cols * SS;
  const MH = rows * SS; // ink map
  const PX = cell / SS; // box units per ink-map px
  const z = new Float32Array(MW * MH).fill(-1e9);
  const nx = new Float32Array(MW * MH);
  const ny = new Float32Array(MW * MH);
  const mat = new Uint8Array(MW * MH);
  const grp = new Uint8Array(MW * MH);
  const hz = new Float32Array(MW * MH).fill(-1e9);
  const hgrp = new Uint8Array(MW * MH);
  const ink = new Float32Array(MW * MH);
  let maxR = 0;

  function sphere(p: Vec3, R: number, halo: number, m: Material, g: number): void {
    maxR = Math.max(maxR, R);
    const cx = p[0] / PX;
    const cy = p[1] / PX;
    const zc = p[2] / PX;
    const r = R / PX;
    const rh = (R + halo) / PX;
    const r2 = r * r;
    const rh2 = rh * rh;
    const x0 = Math.max(0, Math.floor(cx - rh));
    const x1 = Math.min(MW - 1, Math.ceil(cx + rh));
    const y0 = Math.max(0, Math.floor(cy - rh));
    const y1 = Math.min(MH - 1, Math.ceil(cy + rh));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 > rh2) continue;
        const i = y * MW + x;
        if (zc > hz[i]) {
          hz[i] = zc;
          hgrp[i] = g;
        }
        if (d2 > r2) continue;
        const zs = zc + Math.sqrt(r2 - d2);
        if (zs > z[i]) {
          z[i] = zs;
          nx[i] = dx / r;
          ny[i] = dy / r;
          mat[i] = m;
          grp[i] = g;
        }
      }
    }
  }

  function sweep(a: Vec3, c: Vec3, R: number, halo: number, m: Material, g: number): void {
    const n = Math.max(1, Math.ceil(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]) / PX));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      sphere([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t], R, halo, m, g);
    }
  }

  function path(points: Vec3[], R: number, halo: number, m: Material, g: number, closed = false): void {
    for (let k = 1; k < points.length; k++) sweep(points[k - 1], points[k], R, halo, m, g);
    if (closed && points.length > 2) sweep(points[points.length - 1], points[0], R, halo, m, g);
  }

  fig.draw({ sphere, sweep, path });

  /* resolve the buffers to an ink map, 0 (white) to 1 (black) */
  const amp = fig.amp;
  const margin = (fig.margin ?? 12) / PX;
  for (let i = 0; i < ink.length; i++) {
    if (z[i] < -1e8 || (hgrp[i] !== grp[i] && hz[i] > z[i] + margin)) {
      ink[i] = 0;
      continue;
    }
    const nz = Math.sqrt(Math.max(0, 1 - nx[i] * nx[i] - ny[i] * ny[i]));
    const ndl = Math.max(0, nx[i] * LIGHT[0] + ny[i] * LIGHT[1] + nz * LIGHT[2]);
    const ndh = Math.max(0, nx[i] * HALF[0] + ny[i] * HALF[1] + nz * HALF[2]);
    const depth = clamp01((z[i] * PX + amp) / (2 * amp)); // 0 far, 1 near
    ink[i] = clamp01(shade(mat[i], ndl, ndh, depth));
  }

  /* ink map to dots: mean ink over the cell, and its ink-weighted depth */
  const reach = amp + maxR;
  const out: Still = { cols, rows, cell, ink: new Uint8Array(cols * rows), near: new Uint8Array(cols * rows) };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let a = 0;
      let d = 0;
      for (let y = 0; y < SS; y++) {
        const row = (j * SS + y) * MW + i * SS;
        for (let x = 0; x < SS; x++) {
          a += ink[row + x];
          d += ink[row + x] * z[row + x];
        }
      }
      const k = j * cols + i;
      const near = a > 0 ? clamp01(((d / a) * PX + reach) / (2 * reach)) : 0.5;
      a /= SS * SS;
      out.ink[k] = a < MIN_INK ? 0 : Math.round(a * 255);
      out.near[k] = Math.round(near * 255);
    }
  }
  return out;
}

/** Seeded PRNG, so every reload lays the lattice out the same way (the helix's). */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
