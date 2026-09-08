import { DataTexture, FloatType, NearestFilter, RGBAFormat } from "three";
import { PATCH_MM } from "./lesion";

/**
 * Follicular openings on the patch, generated once on the CPU and shared by
 * everything that needs to agree about where a pore is: the skin bake draws
 * the pits, and the hair module grows a vellus hair out of some of them.
 *
 * Layout: a GRID×GRID lattice of CELL_MM cells over the 20 mm patch; each cell
 * holds at most one follicle, jittered inside the middle 70 % of its cell so a
 * shader looking up "the pore near p" only ever has to read the one cell p is
 * in. 75 % occupancy of 0.8 mm cells is ~1.2 visible pores/mm² at 0.7–1.3 mm
 * spacing, which is what the dermoscopic cheek frames show (reference-notes.md
 * §c: 12–25 pores in a 4.5 mm field). Flament's 200–300/cm² counts every
 * ostium down to 40 µm; the ones a DL1 resolves are the larger, sparser set.
 */

export const GRID = 25;
export const CELL_MM = PATCH_MM / GRID; // 0.8 mm

export const PORE_KIND = {
  /** Nothing in this cell. */
  empty: 0,
  /** An open follicle: a pit with a slightly darker floor. */
  plain: 1,
  /** A sebaceous filament: a grey-yellow dot filling the ostium. */
  filament: 2,
  /** A keratin plug: a small dark-brown dot, the open-comedo look at pore scale. */
  plug: 3,
} as const;
export type PoreKind = (typeof PORE_KIND)[keyof typeof PORE_KIND];

export type Pore = {
  /** Patch coordinates, mm, lesion at the origin. `x` is world X, `z` is world Z. */
  x: number;
  z: number;
  /** Ostium radius, mm (30–75 µm, i.e. 60–150 µm across). */
  radius: number;
  kind: PoreKind;
  /** True if the pore is ringed by a brown annulus of follicular pigment (25–40 % of cheek pores). */
  ring: boolean;
  /** True if a vellus hair emerges from this follicle. */
  hair: boolean;
  /**
   * Direction, radians in the XZ plane (atan2(z, x)), in which the hair leaves the
   * pore. It exits at the pore's EDGE on this side, tangentially, not from the centre.
   */
  hairAngle: number;
  /** Per-pore stable random in [0,1), for anything that wants variation keyed to the pore. */
  seed: number;
};

export type PoreField = {
  grid: number;
  cellMm: number;
  /**
   * GRID×GRID RGBA float texture, one texel per cell: (x, z, radius, flags)
   * where flags = kind + 10·ring, so a shader reads `kind = mod(f, 10.0)` and
   * `ring = step(10.0, f)`; kind 0 means the cell is empty.
   * Texel (i, j) is the cell whose x range is [-10 + i·cell, -10 + (i+1)·cell)
   * and z range likewise with j, so a shader finds its cell with
   * `ivec2 c = ivec2(floor((p + 10.0) / cellMm))` and `texelFetch(uPores, c, 0)`.
   * NearestFilter, no mipmaps, no flipY.
   */
  texture: DataTexture;
  pores: Pore[];
};

/** Mulberry32: tiny, deterministic, good enough for placing pores. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Radius from the origin inside which no follicle is placed — the lesion has its own. */
const LESION_CLEAR_MM = 0.5;
/**
 * Fraction of follicles that carry a visible vellus hair. With ~18 pores in the
 * home field this gives 6–12 rooted there, plus the ones that reach in from
 * outside: the 6–15 the references show. Hairs are allowed anywhere, including
 * right next to the lesion — in the photographs they cross straight over it.
 */
const HAIR_FRACTION = 0.5;
/** Fraction of pores with a brown pigment ring. */
const RING_FRACTION = 0.32;
/**
 * Dominant hair growth direction on the patch (radians in XZ) and the scatter
 * around it: cheek vellus hair lies mostly one way, within about ±30°.
 */
const HAIR_DIRECTION = -1.1;
const HAIR_SCATTER = 0.55;

export function generatePores(seed = 7): PoreField {
  const rand = rng(seed);
  const data = new Float32Array(GRID * GRID * 4);
  const pores: Pore[] = [];
  const half = PATCH_MM / 2;

  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const idx = (j * GRID + i) * 4;
      // Draw every random the cell might need, in a fixed order, so the
      // layout is stable regardless of which branch is taken.
      const rOcc = rand();
      const rx = rand();
      const rz = rand();
      const rRad = rand();
      const rKind = rand();
      const rHair = rand();
      const rRing = rand();
      const rAng = rand();
      const rSeed = rand();

      const x = -half + (i + 0.15 + 0.7 * rx) * CELL_MM;
      const z = -half + (j + 0.15 + 0.7 * rz) * CELL_MM;
      const dist = Math.hypot(x, z);
      const present = rOcc < 0.75 && dist > LESION_CLEAR_MM;
      if (!present) {
        data[idx + 3] = PORE_KIND.empty;
        continue;
      }
      // 60–150 µm openings; the plugged ones are the large end (an open comedo is 200–400 µm).
      const kind: PoreKind =
        rKind < 0.72 ? PORE_KIND.plain : rKind < 0.94 ? PORE_KIND.filament : PORE_KIND.plug;
      const radius = kind === PORE_KIND.plug ? 0.10 + 0.08 * rRad : 0.03 + 0.045 * rRad;
      const ring = rRing < RING_FRACTION;
      const hair = rHair < HAIR_FRACTION && kind !== PORE_KIND.plug;
      const hairAngle = HAIR_DIRECTION + (rAng - 0.5) * 2 * HAIR_SCATTER;

      data[idx] = x;
      data[idx + 1] = z;
      data[idx + 2] = radius;
      data[idx + 3] = kind + (ring ? 10 : 0);
      pores.push({ x, z, radius, kind, ring, hair, hairAngle, seed: rSeed });
    }
  }

  const texture = new DataTexture(data, GRID, GRID, RGBAFormat, FloatType);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;

  return { grid: GRID, cellMm: CELL_MM, texture, pores };
}
