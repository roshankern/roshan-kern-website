/**
 * Where AnyDerm sits among the systems that already image facial skin. Three
 * approaches, each with the trade it makes: how long a scan takes, how much
 * detail it resolves, and what it costs.
 *
 * Static, so no "use client" — the whole figure is markup.
 *
 * Adapted from the equivalent figure on openderm.github.io, which compares
 * whole-body systems. Faces change the cast: the wide-field tier is VISIA and
 * Aura rather than total-body booths, and the smartphone tier now has a
 * purpose-built consumer device in it.
 */

/** One head, reused across all three drawings so the scale reads consistently. */
function Head({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} stroke="white" strokeOpacity="0.45" fill="none" strokeWidth="1.4">
      <ellipse cx="0" cy="0" rx="30" ry="38" />
      <path d="M-8 34 v10 M8 34 v10" />
      <path d="M-44 84 c0 -22 18 -34 44 -34 c26 0 44 12 44 34" />
      {/* Features kept to three marks: enough to read as a face, not a portrait. */}
      <path d="M-14 -6 h8 M6 -6 h8" strokeOpacity="0.3" />
      <path d="M0 -2 v10 l4 3" strokeOpacity="0.25" />
    </g>
  );
}

/** A camera body pointed left or right along the rails of a wide-field booth. */
function Cam({ x, y, dir }: { x: number; y: number; dir: 1 | -1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${dir},1)`}>
      <rect x="0" y="-8" width="22" height="16" rx="3" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.4" strokeWidth="1.2" />
      <circle cx="22" cy="0" r="5.5" fill="white" fillOpacity="0.08" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" />
    </g>
  );
}

const SVG = "w-full h-auto";
const SIGHT = { stroke: "white", strokeOpacity: 0.18, strokeWidth: 1, strokeDasharray: "4 4" };
const RAIL = { fill: "white", fillOpacity: 0.1, stroke: "white", strokeOpacity: 0.3, strokeWidth: 1.2 };

function WideField() {
  return (
    <svg viewBox="0 0 400 300" className={SVG} role="img"
      aria-label="A face inside a booth lined with fixed cameras that photograph the whole face at once.">
      <rect x="40" y="34" width="320" height="10" rx="2" {...RAIL} />
      <rect x="40" y="34" width="11" height="210" rx="2" {...RAIL} />
      <rect x="349" y="34" width="11" height="210" rx="2" {...RAIL} />
      <Head x={200} y={120} />
      <g {...SIGHT}>
        <path d="M84 82 L176 108" /><path d="M84 140 L170 138" /><path d="M84 198 L176 166" />
        <path d="M338 82 L224 108" /><path d="M338 140 L230 138" /><path d="M338 198 L224 166" />
      </g>
      <Cam x={62} y={82} dir={1} /><Cam x={62} y={140} dir={1} /><Cam x={62} y={198} dir={1} />
      <Cam x={338} y={82} dir={-1} /><Cam x={338} y={140} dir={-1} /><Cam x={338} y={198} dir={-1} />
      <text x="200" y="272" textAnchor="middle" fill="white" fillOpacity="0.35" fontSize="11" letterSpacing="1.5">
        WHOLE FACE, ONE EXPOSURE
      </text>
    </svg>
  );
}

function Robotic() {
  return (
    <svg viewBox="0 0 400 300" className={SVG} role="img"
      aria-label="A robot arm holds a camera a few centimetres from a cheek; an inset shows the individual follicles it resolves.">
      <Head x={286} y={104} />
      {/* Base and arm. The linkage is drawn once and stroked once — the arm is
          context here, not the subject. */}
      <rect x="26" y="228" width="58" height="22" rx="3" {...RAIL} />
      <rect x="42" y="192" width="24" height="40" rx="2" {...RAIL} />
      <path d="M54 192 L118 126 L196 112 L242 138" fill="none" stroke="white" strokeOpacity="0.4" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {[[54, 192], [118, 126], [196, 112]].map(([cx, cy]) => (
        <circle key={`${cx}`} cx={cx} cy={cy} r="5" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" />
      ))}
      <g transform="rotate(28 248 142)">
        <rect x="232" y="128" width="30" height="26" rx="5" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.45" strokeWidth="1.3" />
      </g>
      <circle cx="256" cy="152" r="6" fill="white" fillOpacity="0.1" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" />
      <g stroke="white" strokeOpacity="0.25" strokeWidth="1">
        <path d="M251 158 L268 168" /><path d="M262 156 L268 168" />
      </g>
      <path d="M254 176 H272" stroke="white" strokeOpacity="0.3" strokeWidth="1" />
      <text x="238" y="192" fill="white" fillOpacity="0.4" fontSize="10">≈ 50 mm</text>
      {/* Magnified inset: what the standoff buys you. */}
      <g {...SIGHT}><path d="M270 172 L318 214" /><path d="M276 168 L352 208" /></g>
      <clipPath id="afMag"><circle cx="334" cy="238" r="34" /></clipPath>
      <circle cx="334" cy="238" r="34" fill="white" fillOpacity="0.07" stroke="white" strokeOpacity="0.35" strokeWidth="1.2" />
      <g clipPath="url(#afMag)" stroke="white" strokeOpacity="0.3" fill="none">
        {[[318, 224], [344, 220], [330, 240], [352, 246], [316, 252], [340, 260]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 4.5 : 3} fill="white" fillOpacity={i % 3 === 0 ? 0.3 : 0.14} strokeWidth="0.8" />
        ))}
      </g>
      <text x="334" y="290" textAnchor="middle" fill="white" fillOpacity="0.35" fontSize="11" letterSpacing="1.5">
        FOLLICLE DETAIL
      </text>
    </svg>
  );
}

function Smartphone() {
  return (
    <svg viewBox="0 0 400 300" className={SVG} role="img"
      aria-label="A hand-held phone photographs a face; arrows show that distance, angle and lighting drift between sessions.">
      <Head x={116} y={112} />
      <rect x="88" y="84" width="56" height="60" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="1.2" strokeDasharray="4 3" />
      <g {...SIGHT}><path d="M262 118 L152 96" /><path d="M262 176 L152 152" /></g>
      <g transform="rotate(-8 300 150)">
        <rect x="266" y="66" width="76" height="152" rx="14" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.4" strokeWidth="1.4" />
        <rect x="274" y="78" width="60" height="128" rx="7" fill="white" fillOpacity="0.06" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
        <ellipse cx="304" cy="132" rx="20" ry="26" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="1.1" />
        <circle cx="298" cy="126" r="3" fill="white" fillOpacity="0.35" />
        <circle cx="311" cy="142" r="2.2" fill="white" fillOpacity="0.25" />
      </g>
      {/* The variance is the point of this panel, so it gets drawn explicitly. */}
      <g stroke="white" strokeOpacity="0.35" strokeWidth="1.2" fill="none">
        <path d="M232 244 h44" strokeDasharray="3 3" />
        <path d="M232 244 l6 -4 M232 244 l6 4 M276 244 l-6 -4 M276 244 l-6 4" />
      </g>
      <text x="254" y="266" textAnchor="middle" fill="white" fillOpacity="0.35" fontSize="11" letterSpacing="1.5">
        POSE VARIES
      </text>
    </svg>
  );
}

type Approach = {
  n: string;
  title: string;
  body: string;
  traits: string[];
  examples: React.ReactNode;
  viz: React.ReactNode;
  /** The tier AnyDerm competes in, drawn a step brighter than the others. */
  mine?: boolean;
};

const APPROACHES: Approach[] = [
  {
    n: "Approach 01",
    title: "Wide-field face scanners",
    body:
      "A fixed multi-camera booth, or one camera repositioned between views, photographs the whole face at once from a distance. The record is standardized and fast, but resolution is spread across the entire face, so individual follicles are never resolved.",
    traits: ["Seconds", "Wide-field detail", "$$$"],
    examples: "Canfield VISIA · VISIA 3D · Aura 3D",
    viz: <WideField />,
  },
  {
    n: "Approach 02",
    title: "Close-range robotic scanners",
    body:
      "A camera on an arm or gantry moves close to the skin and works across it systematically, holding distance and viewing angle constant. Imaging region by region resolves far finer detail than a distant system. The trade is time: the face is covered sequentially rather than all at once.",
    traits: ["Minutes", "Follicle-level detail", "$$"],
    examples: (
      <>
        SquareMind · iToBoS · OpenDerm ·{" "}
        <strong className="text-white font-semibold">AnyDerm</strong>
      </>
    ),
    viz: <Robotic />,
    mine: true,
  },
  {
    n: "Approach 03",
    title: "Guided smartphone imaging",
    body:
      "An app, sometimes with a clip-on lens, walks the user through a set of photographs. It needs almost no hardware and goes anywhere. Lighting, distance, pose and focus all drift between sessions, which is exactly what makes subtle longitudinal change hard to measure.",
    traits: ["Manual", "Variable detail", "$"],
    examples: "Lumeria Lumoscope · SkinIO · Miiskin",
    viz: <Smartphone />,
  },
];

export default function ApproachesFigure() {
  return (
    // mb-5 matches the margin the preceding paragraph sets, so the figure sits
    // with equal air above and below.
    <div className="w-full max-w-5xl mb-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {APPROACHES.map((a) => (
          <div
            key={a.n}
            className={`flex flex-col rounded-2xl border backdrop-blur-md p-5 ${
              a.mine
                ? "border-white/35 bg-white/[0.14]"
                : "border-white/20 bg-white/[0.07]"
            }`}
          >
            <div className="rounded-xl border border-white/10 bg-black/20 p-2 mb-4">
              {a.viz}
            </div>

            <div className="text-[11px] tracking-widest text-white/40 mb-1">
              {a.n.toUpperCase()}
            </div>
            <h4 className="text-white font-semibold leading-snug mb-2">
              {a.title}
            </h4>
            <p className="text-sm text-white/60 leading-relaxed mb-4">
              {a.body}
            </p>

            <div className="mt-auto">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {a.traits.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] text-white/55"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="text-[11px] text-white/40 leading-relaxed border-t border-white/10 pt-3">
                {a.examples}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
