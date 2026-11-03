import { RUNG, TUBE, mulberry32, turn, type Figure, type Vec3 } from "./sweep";

/**
 * A brain in the helix's hand: the left hemisphere from the side, turned so the
 * frontal lobe comes forward and tipped a little to show the top. Two closed
 * rims in the helix's strand tube give it its silhouette, the dome of the
 * frontal, parietal and occipital lobes and, in front of it, the temporal lobe,
 * with the lateral sulcus between them. Inside, fewer, thick winding gyri: a
 * ring following the dome a gap inside its rim, broken for the pre- and
 * postcentral gyri either side of the central sulcus, a middle gyrus branching
 * off it into each half, and one along the temporal lobe. Below, the
 * cerebellum's folia in the paler rung tube inside an oval rim, and the
 * brainstem. Every part is its own group, so where one passes in front of
 * another (the temporal lobe over the dome, the cerebellum and the brainstem)
 * the halo cuts a gap.
 */

type P2 = [number, number];

const YAW = -0.4; // brings the frontal lobe towards the viewer
const PITCH = 0.16; // tips the top towards the viewer
const AMP = 80; // about half the depth after turning (z runs -57 to 102)
const SCALE = 0.71; // model units to box units
const OFFSET: P2 = [12, 22]; // model point that lands mid-frame

/* model units; radii shrink by SCALE on the page */
const RIM = { R: 16.5, halo: 9, wander: 2.5 };
const GYRUS = { R: 15, halo: 7, wander: 7.5 };
const CLEAR = 38; // how far a gyrus keeps from a rim's centre line
const FOLIUM = { R: 5.8, halo: 4, gap: 16 };
const STEM = { R: 21, tip: 15, halo: 9 }; // the pons swells at the top
const SEED = 0xb4a1;

/* the hemisphere's bulge: an ellipsoid over the side view */
const DOME = { cx: 0, cy: 0, a: 220, b: 180, depth: 100 };

const spin = turn(YAW, PITCH);
const place = ([x, y, z]: Vec3): Vec3 => spin([(x - OFFSET[0]) * SCALE, (y - OFFSET[1]) * SCALE, z * SCALE]);

/* ---- the outline, in side-view model units (x towards the back, y down) --- */
/** Frontal, parietal and occipital lobes, clockwise from the frontal pole; the bottom edge runs forward along the lateral sulcus. */
const DOME_RIM: P2[] = [
  [-198, -10], [-188, -72], [-152, -122], [-95, -154], [-25, -166], [45, -160], [110, -136],
  [162, -94], [192, -42], [200, 4], [186, 36], [148, 50], [98, 42], [54, 22], [14, 4],
  [-32, 14], [-82, 34], [-124, 50], [-164, 48], [-190, 26],
];
const TEMPORAL_RIM: P2[] = [
  [-128, 92], [-96, 72], [-48, 58], [2, 50], [50, 58], [88, 74], [104, 98], [90, 124],
  [44, 142], [-20, 148], [-84, 138], [-122, 118],
];
const TEMPORAL_LIFT = 22; // the temporal lobe stands in front, so its rim cuts the dome's

/** The frontal, parietal and occipital gyri: a ring inside the dome's rim, broken either side of the central sulcus. */
const RING = 44;
/** Middle gyri branching off that ring into each half, so the frontal lobe reads as its three gyri. */
const MIDDLE: P2[][] = [
  [[-152, -64], [-112, -62], [-66, -70]],
  [[154, -30], [120, -42], [84, -50]],
];
/* the precentral and postcentral gyri, either side of the central sulcus */
const CENTRAL: P2[][] = [
  [[-4, -132], [-16, -72], [-36, -6]],
  [[42, -128], [30, -70], [12, -12]],
];
/** The central sulcus, between those two; rings keep CENTRAL_BAND from it. */
const CENTRAL_SULCUS: [P2, P2] = [[19, -130], [-12, -9]];
const CENTRAL_BAND = 68;
/* the temporal lobe's one inner gyrus, along its middle */
const TEMPORAL_MID: P2[] = [[-96, 102], [-30, 98], [30, 98], [70, 104]];

const CEREBELLUM = { cx: 160, cy: 118, ax: 74, ay: 50, sag: 12, depth: 22, lift: -10, R: 10 };
const BRAINSTEM: P2[] = [[34, 90], [44, 160], [60, 222]];

/** A Catmull-Rom curve through `pts` (closed if asked), resampled by arc length: t in [0, 1] to a point. */
function curve(pts: P2[], closed = false): (t: number) => P2 {
  const m = pts.length;
  const at = (i: number) => (closed ? pts[((i % m) + m) % m] : pts[Math.min(m - 1, Math.max(0, i))]);
  const dense: P2[] = [];
  for (let i = 0; i < (closed ? m : m - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < 16; k++) {
      const t = k / 16, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(closed ? pts[0] : pts[m - 1]);
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = len[len.length - 1];
  return (t) => {
    const s = Math.min(1, Math.max(0, t)) * total;
    let i = 1;
    while (i < len.length - 1 && len[i] < s) i++;
    const f = (s - len[i - 1]) / (len[i] - len[i - 1] || 1);
    return [dense[i - 1][0] + (dense[i][0] - dense[i - 1][0]) * f, dense[i - 1][1] + (dense[i][1] - dense[i - 1][1]) * f];
  };
}

/** n + 1 points along a curve. */
const sample = (c: (t: number) => P2, n: number): P2[] => Array.from({ length: n + 1 }, (_, i) => c(i / n));

/** Is p inside the closed polygon? */
function within(poly: P2[], [x, y]: P2): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function domeZ(x: number, y: number): number {
  const q = ((x - DOME.cx) / DOME.a) ** 2 + ((y - DOME.cy) / DOME.b) ** 2;
  return DOME.depth * Math.sqrt(Math.max(0, 1 - q));
}

export const brain: Figure = {
  name: "brain",
  amp: AMP,
  draw(pen) {
    const rnd = mulberry32(SEED);
    let group = 1;
    const domeLine = sample(curve(DOME_RIM, true), 400);
    const temporalLine = sample(curve(TEMPORAL_RIM, true), 300);

    /** A tube along a 2D centre line, wandering sideways a little, laid on the dome. */
    function tube(line: P2[], R: number, halo: number, wander: number, lift = 0): void {
      const ph1 = rnd() * 6.28, ph2 = rnd() * 6.28;
      let s = 0;
      const pts: Vec3[] = line.map((p, i) => {
        const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
        if (i > 0) s += Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]);
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        const w = wander * Math.sin(s / 9 + ph1) * (0.75 + 0.25 * Math.sin(s / 23 + ph2));
        const q: P2 = [p[0] - (dy / l) * w, p[1] + (dx / l) * w];
        return place([q[0], q[1], domeZ(q[0], q[1]) + lift]);
      });
      pen.path(pts, R * SCALE, halo, TUBE, group++);
    }

    /** A gyrus inside a rim: cut wherever it comes within CLEAR of the rim, short stubs dropped. */
    function gyrus(line: P2[], rim: P2[], lift = 0): void {
      const ok = (p: P2) => within(rim, p) && rim.every((r) => Math.hypot(r[0] - p[0], r[1] - p[1]) >= CLEAR);
      let run: P2[] = [];
      for (const p of [...line, null]) {
        if (p && ok(p)) run.push(p);
        else {
          let len = 0;
          for (let i = 1; i < run.length; i++) len += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]);
          if (len > 30) tube(run, GYRUS.R, GYRUS.halo, GYRUS.wander, lift);
          run = [];
        }
      }
    }

    /* the dome's rim, then its gyri */
    tube(domeLine, RIM.R, RIM.halo, RIM.wander);

    /* rings inside the rim: each point stepped inwards along the rim's normal, kept where it is that far from all of the rim */
    const [c0, c1] = CENTRAL_SULCUS;
    const cl = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    const offSulcus = ([x, y]: P2) => Math.abs((c1[0] - c0[0]) * (y - c0[1]) - (c1[1] - c0[1]) * (x - c0[0])) / cl >= CENTRAL_BAND;
    const d = RING;
    const ring = domeLine.slice(0, -1).map((p, i, a): P2 | null => {
      const b = a[(i + 1) % a.length], c = a[(i - 1 + a.length) % a.length];
      const tx = b[0] - c[0], ty = b[1] - c[1], l = Math.hypot(tx, ty);
      let q: P2 = [p[0] - (ty / l) * d, p[1] + (tx / l) * d];
      if (!within(domeLine, q)) q = [p[0] + (ty / l) * d, p[1] - (tx / l) * d];
      const clear = domeLine.every((r) => Math.hypot(r[0] - q[0], r[1] - q[1]) >= d - 3);
      return clear && offSulcus(q) ? q : null;
    });
    const start = ring.indexOf(null);
    let run: P2[] = [];
    for (let k = 0; k <= ring.length; k++) {
      const q = start < 0 ? ring[k % ring.length] : ring[(start + k) % ring.length];
      if (q) run.push(q);
      else if (run.length) {
        gyrus(run, domeLine);
        run = [];
      }
    }
    if (run.length) gyrus(start < 0 ? [...run, run[0]] : run, domeLine);

    for (const c of [...CENTRAL, ...MIDDLE]) gyrus(sample(curve(c), 80), domeLine);

    /* the temporal lobe, in front */
    tube(temporalLine, RIM.R, RIM.halo, RIM.wander, TEMPORAL_LIFT);
    gyrus(sample(curve(TEMPORAL_MID), 120), temporalLine, TEMPORAL_LIFT);

    /* the cerebellum: an oval rim tucked under the occipital lobe, folia across it, each sagging a little */
    const cb = CEREBELLUM;
    for (let y0 = cb.cy - cb.ay + FOLIUM.gap / 2; y0 < cb.cy + cb.ay; y0 += FOLIUM.gap) {
      const half = cb.ax * Math.sqrt(Math.max(0, 1 - ((y0 - cb.cy) / cb.ay) ** 2)) - FOLIUM.R;
      if (half < 12) continue;
      const pts: Vec3[] = [];
      for (let i = 0; i <= 40; i++) {
        const u = -1 + (2 * i) / 40;
        const x = cb.cx + half * u, y = y0 + cb.sag * (1 - u * u);
        const z = cb.depth * Math.sqrt(Math.max(0, 1 - ((x - cb.cx) / cb.ax) ** 2 - ((y - cb.cy) / cb.ay) ** 2)) + cb.lift;
        pts.push(place([x, y, z]));
      }
      pen.path(pts, FOLIUM.R * SCALE, FOLIUM.halo, RUNG, group++);
    }
    const oval = Array.from({ length: 90 }, (_, i): Vec3 => {
      const a = (i / 90) * 2 * Math.PI;
      return place([cb.cx + cb.ax * Math.cos(a), cb.cy + cb.ay * Math.sin(a), cb.lift]);
    });
    pen.path(oval, cb.R * SCALE, RIM.halo, TUBE, group++, true);

    /* the brainstem, behind the temporal lobe */
    const bs = curve(BRAINSTEM);
    for (let i = 0; i <= 160; i++) {
      const t = i / 160;
      pen.sphere(place([...bs(t), -10] as Vec3), (STEM.R + (STEM.tip - STEM.R) * t) * SCALE, STEM.halo, TUBE, group);
    }
  },
};
