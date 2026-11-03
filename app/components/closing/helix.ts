import { H, RUNG, TUBE, W, type Figure, type Vec3 } from "./sweep";

/**
 * The double helix, copied from AnyHealth's (anyhealth 3700504^,
 * website/src/app/helix.ts) with every constant unchanged, held at one turn
 * and centred in the shared frame. Right-handed, like B-DNA: on the near side
 * a strand climbs from lower left to upper right.
 */
const LEAN = (40 * Math.PI) / 180; // axis tilt from vertical, top to the right
const AX = Math.sin(LEAN);
const AY = -Math.cos(LEAN);
const UX = Math.cos(LEAN);
const UY = Math.sin(LEAN);
const LEN = 460;
const PITCH = 230;
const AMP = 58;
const TAU = Math.PI * 2;

const V = { R: 12.5, halo: 9, rungR: 4.75, rungHalo: 5, rungs: 8, offset: Math.PI };

/** The turn the still is held at: the strands cross near the middle, where it reads best. */
const PHASE = 0.6;

/** PX of the shared renderer, so strands are sampled as densely as the helix's were. */
const STEP = 1;

function at(s: number, theta: number): Vec3 {
  const c = Math.cos(theta);
  return [W / 2 + AX * s + UX * AMP * c, H / 2 + AY * s + UY * AMP * c, -AMP * Math.sin(theta)];
}

export const helix: Figure = {
  name: "helix",
  amp: AMP,
  draw(pen) {
    const theta = (s: number) => (TAU * s) / PITCH + PHASE;
    for (let strand = 0; strand < 2; strand++) {
      const off = strand * V.offset;
      const n = Math.ceil((LEN * Math.hypot(1, (TAU * AMP) / PITCH)) / STEP);
      for (let j = 0; j <= n; j++) {
        const s = -LEN / 2 + (LEN * j) / n;
        pen.sphere(at(s, theta(s) + off), V.R, V.halo, TUBE, strand + 1);
      }
    }
    const gap = PITCH / V.rungs;
    const count = Math.floor(LEN / gap);
    for (let j = 0; j < count; j++) {
      const s = -((count - 1) * gap) / 2 + j * gap;
      pen.sweep(at(s, theta(s)), at(s, theta(s) + V.offset), V.rungR, V.rungHalo, RUNG, 3);
    }
  },
};
