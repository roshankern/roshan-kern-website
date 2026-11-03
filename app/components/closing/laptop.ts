import { H, RUNG, TUBE, W, turn, type Figure, type Vec3 } from "./sweep";

/**
 * An open laptop in a 3/4 view, built from the helix's vocabulary: the base and
 * the screen are rounded-rectangle frames of the helix's strand tube, the screen
 * standing just inside the deck's back edge so its sides cut gaps across it, as
 * one strand crosses the other. Two rows of keys and the trackpad are drawn in
 * the paler rung tube; the lines of code on the screen in a thin strand tube, so
 * the screen reads boldest. Modelled flat about its own origin (x right, y down,
 * z towards the viewer), then turned into the shared frame.
 */
const YAW = 0.4; // brings the right side forward
const PITCH = -0.4; // tips the top away, just enough to see the deck
/**
 * Where the model origin lands. Pushed forward in z so the screen, the part
 * that says "laptop", sits in the near, dark half and only its far side fades.
 */
const CENTRE: Vec3 = [W / 2, H / 2 + 22, 110];
const AMP = 75; // shorter than half the depth, so only the far top-left of the screen fades

const BASE_W = 280; // base, x extent
const BASE_D = 230; // base, z extent (foreshortened, so deeper than a real one)
const BASE_Y = 70; // the deck's height (y down)
const SCREEN_W = 240; // a little narrower than the base, so the base's back edge shows past it
const SCREEN_H = 190; // screen, from hinge to top edge
const INSET = 24; // how far inside the deck's back edge the screen stands
const LEAN = (12 * Math.PI) / 180; // screen tilt back from vertical
const CORNER = 26; // corner radius of both frames

const V = { R: 12.5, halo: 9, rungR: 4.75, rungHalo: 5, codeR: 6, keyR: 4 };

/** Keys: two staggered rows of short dashes, a calm texture rather than every key. */
const KEY_COLS = 8;
const KEY_LEN = 14;
const KEY_PITCH = 26; // dash to dash, across
const KEY_ROWS_Z = [-50, -20];
const PAD = { w: 90, h: 44, z: 45 }; // trackpad

/**
 * The groups, so the screen cuts a gap in the base's back edge where it passes in
 * front. The keys go with the screen: foreshortened, they sit right against its
 * bottom edge, and in the base's group their halos would eat it.
 */
const G = { base: 1, screen: 2 };

/** A rounded rectangle in the uv plane, as a closed loop of points mapped through `at`. */
function roundRect(w: number, h: number, r: number, at: (u: number, v: number) => Vec3): Vec3[] {
  const pts: Vec3[] = [];
  const corners: [number, number, number][] = [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
    [w / 2 - r, -h / 2 + r, (3 * Math.PI) / 2],
  ];
  for (const [cu, cv, a0] of corners)
    for (let k = 0; k <= 8; k++) {
      const a = a0 + (k / 8) * (Math.PI / 2);
      pts.push(at(cu + r * Math.cos(a), cv + r * Math.sin(a)));
    }
  return pts;
}

export const laptop: Figure = {
  name: "laptop",
  amp: AMP,
  draw(pen) {
    const T = turn(YAW, PITCH, CENTRE);

    /* the base: u along x, v along z, on the deck plane */
    const deck = (u: number, v: number): Vec3 => T([u, BASE_Y, v]);
    pen.path(roundRect(BASE_W, BASE_D, CORNER, deck), V.R, V.halo, TUBE, G.base, true);

    /* the screen: u along x, v up its face from the hinge, leaning back */
    const hingeZ = -BASE_D / 2 + INSET;
    const face = (u: number, v: number): Vec3 =>
      T([u, BASE_Y - (v + SCREEN_H / 2) * Math.cos(LEAN), hingeZ - (v + SCREEN_H / 2) * Math.sin(LEAN)]);
    pen.path(roundRect(SCREEN_W, SCREEN_H, CORNER, face), V.R, V.halo, TUBE, G.screen, true);

    /* lines of code on the screen: indent, length, from the top down */
    const code: [number, number][] = [
      [0, 100], [1, 130], [2, 70], [2, 110], [1, 50], [0, 30], [0, 90],
    ];
    const left = -SCREEN_W / 2 + 34;
    code.forEach(([indent, len], k) => {
      const v = SCREEN_H / 2 - 36 - k * 20;
      const u0 = left + indent * 20;
      pen.sweep(face(u0, v), face(u0 + len, v), V.codeR, V.rungHalo, TUBE, G.screen);
    });

    /* the keyboard: staggered rows of short dashes */
    KEY_ROWS_Z.forEach((z, r) => {
      for (let c = 0; c < KEY_COLS - r; c++) {
        const x = (c - (KEY_COLS - r - 1) / 2) * KEY_PITCH;
        pen.sweep(deck(x - KEY_LEN / 2, z), deck(x + KEY_LEN / 2, z), V.keyR, V.rungHalo, RUNG, G.screen);
      }
    });

    /* the trackpad */
    pen.path(roundRect(PAD.w, PAD.h, 10, (u, v) => deck(u, PAD.z + v)), V.rungR, V.rungHalo, RUNG, G.base, true);
  },
};
