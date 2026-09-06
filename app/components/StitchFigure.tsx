import { Head } from "./ApproachesFigure";

/**
 * How a scan becomes something you can compare to last week's scan. Three
 * steps: sweep the face, unwrap every tile onto one canonical map, then
 * re-open the same high-magnification regions session after session.
 *
 * Static, so no "use client" — the whole figure is markup.
 */

const SVG = "w-full h-auto";
const LINE = { stroke: "white", strokeOpacity: 0.3, strokeWidth: 1, fill: "none" };
const DASH = { ...LINE, strokeDasharray: "4 4", strokeOpacity: 0.22 };
const MAP = { fill: "white", fillOpacity: 0.06, stroke: "white", strokeOpacity: 0.3, strokeWidth: 1.2 };
const CAPTION = { textAnchor: "middle" as const, fill: "white", fillOpacity: 0.35, fontSize: 11, letterSpacing: 1.5 };

/** The unwrapped face map, drawn at whatever size a panel needs. */
function CanonMap({ x, y, w, h, cells }: { x: number; y: number; w: number; h: number; cells: number[] }) {
  const cw = w / 4;
  const ch = h / 3;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" {...MAP} />
      {cells.map((i) => (
        <rect
          key={i}
          x={x + (i % 4) * cw}
          y={y + Math.floor(i / 4) * ch}
          width={cw}
          height={ch}
          fill="white"
          fillOpacity="0.16"
          stroke="white"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
      ))}
      <g {...LINE} strokeOpacity="0.15">
        {[1, 2, 3].map((i) => (
          <path key={`v${i}`} d={`M${x + i * cw} ${y} V${y + h}`} />
        ))}
        {[1, 2].map((i) => (
          <path key={`h${i}`} d={`M${x} ${y + i * ch} H${x + w}`} />
        ))}
      </g>
    </g>
  );
}

/** Step 1 — a serpentine sweep lays overlapping tiles across the whole face. */
function Sweep() {
  return (
    <svg viewBox="0 0 400 300" className={SVG} role="img"
      aria-label="A serpentine path sweeps across a face, laying down overlapping image tiles.">
      <g transform="scale(1.7)">
        <Head x={118} y={72} />
      </g>
      {/* The raster the arm actually drives. */}
      <g {...DASH} strokeOpacity="0.35">
        <path d="M146 70 H254 M254 70 V96 M254 96 H146 M146 96 V122 M146 122 H254 M254 122 V148 M254 148 H146 M146 148 V174 M146 174 H254" />
      </g>
      {/* A few tiles, drawn overlapping, because the overlap is the point. */}
      {[[160, 96], [196, 96], [232, 96], [178, 132], [214, 132]].map(([tx, ty], i) => (
        <rect key={i} x={tx} y={ty} width="44" height="36" rx="2"
          fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.35" strokeWidth="1" />
      ))}
      <text x="200" y="278" {...CAPTION}>SWEEP</text>
    </svg>
  );
}

/** Step 2 — tiles project onto a fitted surface, then unwrap to fixed coordinates. */
function Unwrap() {
  return (
    <svg viewBox="0 0 400 300" className={SVG} role="img"
      aria-label="Image tiles project onto a curved face surface, which unwraps into a flat map with fixed coordinates.">
      {/* A smooth scaffold, not a reconstruction — enough to unwrap onto. */}
      <g {...LINE}>
        <path d="M130 34 c40 -14 100 -14 140 0 c14 44 14 88 0 132 c-40 16 -100 16 -140 0 c-14 -44 -14 -88 0 -132" strokeOpacity="0.4" />
        <path d="M166 27 c-10 46 -10 92 0 145" strokeOpacity="0.2" />
        <path d="M200 24 c-4 47 -4 94 0 151" strokeOpacity="0.2" />
        <path d="M234 27 c10 46 10 92 0 145" strokeOpacity="0.2" />
        <path d="M126 72 c50 12 98 12 148 0" strokeOpacity="0.2" />
        <path d="M126 122 c50 12 98 12 148 0" strokeOpacity="0.2" />
      </g>
      <g {...DASH}>
        <path d="M200 178 V206" />
        <path d="M193 199 L200 208 L207 199" strokeDasharray="none" strokeOpacity="0.35" />
      </g>
      <CanonMap x={112} y={214} w={176} h={54} cells={[1, 2, 5]} />
      <text x="200" y="290" {...CAPTION}>UNWRAP</text>
    </svg>
  );
}

/** Positions of the follicles in the magnified inset, in inset-local coordinates. */
const FOLLICLES: [number, number][] = [
  [-28, -22], [-6, -30], [16, -26], [32, -8], [-32, 2], [-14, -6], [6, -10],
  [26, 6], [-24, 20], [-2, 14], [18, 22], [36, 14], [-10, 32], [10, 34],
];

/** A magnified region. `plugged` names which follicles read as occluded. */
function Tile({ cx, cy, label, plugged }: { cx: number; cy: number; label: string; plugged: number[] }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="45" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.35" strokeWidth="1.2" />
      {FOLLICLES.map(([dx, dy], i) => {
        const on = plugged.includes(i);
        return (
          <circle key={i} cx={cx + dx} cy={cy + dy} r={on ? 5 : 3.2}
            fill="white" fillOpacity={on ? 0.4 : 0.12}
            stroke="white" strokeOpacity={on ? 0.55 : 0.3} strokeWidth="0.8" />
        );
      })}
      <text x={cx} y={cy + 66} {...CAPTION} fontSize="10">{label}</text>
    </g>
  );
}

/** Step 3 — the same regions reopen at the same map coordinates every session. */
function Regions() {
  return (
    <svg viewBox="0 0 400 300" className={SVG} role="img"
      aria-label="Regions of the face map are reopened weeks apart, showing the same follicles with fewer plugged.">
      <CanonMap x={22} y={90} w={124} h={102} cells={[1, 2, 6, 9]} />
      <g {...DASH}>
        <path d="M146 118 L200 132" />
        <path d="M146 164 L200 172" />
      </g>
      <Tile cx={245} cy={150} label="WEEK 0" plugged={[0, 2, 4, 6, 7, 9, 11, 13]} />
      <Tile cx={350} cy={150} label="WEEK 3" plugged={[0, 4, 7, 11]} />
      <text x="200" y="278" {...CAPTION}>RE-OPEN</text>
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "One coarse pass",
    body: "The arm drives a serpentine raster across the whole face, holding roughly constant standoff and staying near normal to the local curvature. Adjacent tiles overlap heavily, which is what later lets them be matched to each other rather than trusted from the encoders.",
    viz: <Sweep />,
  },
  {
    n: "02",
    title: "Unwrapped to one map",
    body: "Every tile projects onto a smooth fitted face surface and unwraps into a single canonical map. The surface does not need to be an accurate instantaneous reconstruction. It needs to be the same surface next week, so the same skin lands on the same coordinate.",
    viz: <Unwrap />,
  },
  {
    n: "03",
    title: "Regions re-opened",
    body: "The regions worth following closely get revisited at high magnification every session, at map coordinates that do not move between sessions. The scan is not compared as a picture. It is compared follicle by follicle.",
    viz: <Regions />,
  },
];

export default function StitchFigure() {
  return (
    <div className="w-full max-w-5xl mb-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {STEPS.map((s) => (
          <div key={s.n} className="flex flex-col rounded-2xl border border-white/20 bg-white/[0.07] backdrop-blur-md p-5">
            <div className="rounded-xl border border-white/10 bg-black/20 p-2 mb-4">{s.viz}</div>
            <div className="text-[11px] tracking-widest text-white/40 mb-1">STEP {s.n}</div>
            <h4 className="text-white font-semibold leading-snug mb-2">{s.title}</h4>
            <p className="text-sm text-white/60 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
