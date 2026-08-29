"use client";

import { DIMENSIONS, GROUPS, TECHNOLOGIES, techColor } from "../writing/pp/data";
import { BASE_YEAR, END_YEAR, scoreAt } from "../writing/pp/timeline";

/**
 * One triangle per method: three axes at 120 degrees, each running 0-10 from the
 * centre. A bigger triangle is a better method, and a pinched corner is the
 * family it trades away — both readable without consulting a number.
 *
 * Small multiples rather than ten overlaid triangles, which would be unreadable
 * at this count. Cells are sorted by 2036 area so the ranking is the layout.
 */

const FAMS = GROUPS.map((g) => g.key);

/**
 * Lucide's arrow geometry inlined: three glyphs are not worth a dependency, and
 * matching its 24-grid and 2px round stroke keeps them consistent with the icons
 * used elsewhere on the site.
 */
const Arrow = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden
    className="h-3.5 w-3.5 shrink-0">
    {d.split("|").map((p) => <path key={p} d={p} />)}
  </svg>
);

const AXIS_KEY = [
  { d: "m5 12 7-7 7 7|M12 19V5", label: "Efficacy" },
  { d: "M17 7 7 17|M17 17H7V7", label: "Deployability" },
  { d: "m7 7 10 10|M17 7v10H7", label: "Tolerability" },
];

// -90 puts efficacy at the top; the other two fall to the lower corners.
const ANGLE = [-90, 150, 30].map((d) => (d * Math.PI) / 180);
const CX = 50;
const CY = 50;
const MAX_R = 38;

const point = (score: number, i: number): [number, number] => {
  const r = (score / 10) * MAX_R;
  return [CX + r * Math.cos(ANGLE[i]), CY + r * Math.sin(ANGLE[i])];
};

const path = (scores: number[]) =>
  scores.map((s, i) => point(s, i).join(",")).join(" ");

/** Family averages on the raw 1-10 scale, in GROUPS order. */
const familyScores = (techId: string, year: number) =>
  FAMS.map((f) => {
    const dims = DIMENSIONS.filter((d) => d.group === f);
    return dims.reduce((a, d) => a + scoreAt(techId, d.key, year), 0) / dims.length;
  });

/** Literal area of the drawn triangle — the thing the eye is already comparing. */
const area = ([a, b, c]: number[]) => a * b + b * c + c * a;

export default function ProfilePlot() {
  const cells = TECHNOLOGIES.map((tech, i) => ({
    tech,
    color: techColor(i),
    now: familyScores(tech.id, BASE_YEAR),
    then: familyScores(tech.id, END_YEAR),
  })).sort((a, b) => area(b.then) - area(a.then));

  return (
    <div className="w-full max-w-5xl mb-5">
      <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-white/60 mb-2">
          {AXIS_KEY.map(({ d, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Arrow d={d} />
              {label}
            </span>
          ))}
        </div>

        <div className="mb-6 flex items-center justify-center gap-6 text-sm text-white/60">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-6 rounded-sm bg-black" />
            {BASE_YEAR}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-6 rounded-sm bg-black/30" />
            {END_YEAR}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-6">
          {cells.map(({ tech, color, now, then }) => (
            <div key={tech.id}>
              <svg viewBox="0 0 100 100" className="w-full h-auto">
                <title>
                  {`${tech.shortName} — ${FAMS.map(
                    (f, i) => `${f} ${now[i].toFixed(1)} to ${then[i].toFixed(1)}`
                  ).join(", ")}`}
                </title>

                {/* The 10 frame is the only reference mark. No midline and no
                    spokes to the centre: extra interior lines read as a cube
                    corner rather than a flat chart. */}
                <polygon points={path([10, 10, 10])} fill="none"
                  stroke="rgba(255,255,255,0.28)" strokeWidth={0.8} />

                {/* 2036 first, so the opaque present sits on top of the
                    projected envelope. Every family average grows, so the outer
                    shape always contains the inner one and the visible band
                    between them is exactly the decade's gain. */}
                <polygon points={path(then)} fill={color} fillOpacity={0.2} />
                <polygon points={path(now)} fill={color} />
              </svg>
              <p className="mt-1 text-center text-xs text-white/70 leading-tight">
                {tech.shortName}
              </p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
