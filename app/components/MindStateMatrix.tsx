"use client";

import { useMemo, useState } from "react";
import {
  DIMENSIONS,
  GROUPS,
  TECH_ORDER,
  TECHNOLOGIES,
  techColor,
} from "../writing/pp/data";
import {
  BASE_YEAR,
  driverFor,
  scoreAt,
  scoresAt,
} from "../writing/pp/timeline";

// Matrix geometry, in viewBox units.
const PAD_L = 172;  // Wide enough for the longest row label plus a left gutter.
const PAD_R = 14;
const PAD_T = 104;
const PAD_B = 8;
const CELL_W = 46;
const CELL_H = 34;
const GAP = 4;
const GROUP_GAP = 20;

let cursor = PAD_L;
const columns = DIMENSIONS.map((dim, i) => {
  if (i > 0)
    cursor += CELL_W + (DIMENSIONS[i - 1].group !== dim.group ? GROUP_GAP : GAP);
  return { dim, x: cursor };
});

const rows = TECH_ORDER.map((techIndex, i) => ({
  techIndex,
  y: PAD_T + i * (CELL_H + GAP),
}));

const VB_W = cursor + CELL_W + PAD_R;
const VB_H = PAD_T + rows.length * (CELL_H + GAP) - GAP + PAD_B;

const groupSpans = GROUPS.map((group) => {
  const members = columns.filter((c) => c.dim.group === group.key);
  const x1 = members[0].x;
  const x2 = members[members.length - 1].x + CELL_W;
  return { group, x1, x2, mid: (x1 + x2) / 2 };
});

/**
 * Diverging ramp: 1 is red, 10 is blue, and the midpoint is a desaturated gray
 * rather than a third hue. Anchors are authored in HSL so they stay tunable, but
 * blended in RGB — sliding hue from red to blue would swing through yellow and
 * green on the way.
 */
const RAMP = ([
  [6, 72, 56],
  [220, 10, 52],
  [208, 75, 58],
] as [number, number, number][]).map(([h, s, l]) => {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(
      (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255
    );
  };
  return [channel(0), channel(8), channel(4)];
});

const CELL_ALPHA = 0.82;

const rampColor = (value: number, alpha = 1) => {
  const t = Math.min(1, Math.max(0, (value - 1) / 9));
  const half = t < 0.5 ? 0 : 1;
  const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const [from, to] = [RAMP[half], RAMP[half + 1]];
  const mix = (i: number) => Math.round(from[i] + (to[i] - from[i]) * u);
  return `rgba(${mix(0)}, ${mix(1)}, ${mix(2)}, ${alpha})`;
};

type Cell = { techId: string; dimKey: string };

export default function MindStateMatrix({ year }: { year: number }) {
  const [hoveredCell, setHoveredCell] = useState<Cell | null>(null);
  const [pinnedCell, setPinnedCell] = useState<Cell | null>(null);
  const [hoveredTech, setHoveredTech] = useState<string | null>(null);
  const [hoveredDim, setHoveredDim] = useState<string | null>(null);

  // Pinning keeps the readout reachable on touch, where there is no hover.
  const active = hoveredCell ?? pinnedCell;

  const litTech = hoveredTech ?? active?.techId ?? null;
  const litDim = hoveredDim ?? active?.dimKey ?? null;
  const anyLit = litTech !== null || litDim !== null;

  const grid = useMemo(
    () =>
      rows.map(({ techIndex, y }) => {
        const tech = TECHNOLOGIES[techIndex];
        return { tech, techIndex, y, scores: scoresAt(tech, year) };
      }),
    [year]
  );

  const activeTech = active
    ? TECHNOLOGIES.find((t) => t.id === active.techId) ?? null
    : null;
  const activeDim = active
    ? DIMENSIONS.find((d) => d.key === active.dimKey) ?? null
    : null;
  const activeValue =
    active ? scoreAt(active.techId, active.dimKey, year) : null;

  return (
    <>
      {/* The matrix scrolls inside this container so the page itself never does */}
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full min-w-[780px] h-auto"
          role="img"
          aria-label={`Heatmap of ten technologies scored 1 to 10 across twelve dimensions in ${year}.`}
        >
          {/* Family brackets */}
          {groupSpans.map(({ group, x1, x2, mid }) => (
            <g key={group.key}>
              <text
                x={mid}
                y={20}
                textAnchor="middle"
                fill="rgba(255,255,255,0.55)"
                fontSize={11}
                letterSpacing={1.4}
              >
                {group.label.toUpperCase()}
              </text>
              <line
                x1={x1}
                x2={x2}
                y1={30}
                y2={30}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={1.5}
              />
            </g>
          ))}

          {/* Dimension labels, doubling as column highlight targets */}
          {columns.map(({ dim, x }) => (
            <g key={dim.key}>
              <text
                transform={`translate(${x + CELL_W / 2 - 4}, ${PAD_T - 10}) rotate(-40)`}
                textAnchor="start"
                fill={
                  litDim === dim.key
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.55)"
                }
                fontSize={12}
                style={{ pointerEvents: "none" }}
              >
                {dim.label}
              </text>
              <rect
                x={x - GAP / 2}
                y={36}
                width={CELL_W + GAP}
                height={PAD_T - 40}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredDim(dim.key)}
                onMouseLeave={() => setHoveredDim(null)}
              />
            </g>
          ))}

          {/* Technology labels, doubling as row highlight targets */}
          {grid.map(({ tech, techIndex, y }) => (
            <g key={tech.id}>
              <circle
                cx={10}
                cy={y + CELL_H / 2}
                r={4}
                fill={techColor(techIndex)}
                fillOpacity={litTech === tech.id ? 0.95 : 0.6}
                style={{ pointerEvents: "none" }}
              />
              <text
                x={PAD_L - 12}
                y={y + CELL_H / 2 + 4}
                textAnchor="end"
                fill={
                  litTech === tech.id
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.6)"
                }
                fontSize={12}
                style={{ pointerEvents: "none" }}
              >
                {tech.shortName}
              </text>
              <rect
                x={0}
                y={y}
                width={PAD_L - 6}
                height={CELL_H}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredTech(tech.id)}
                onMouseLeave={() => setHoveredTech(null)}
              />
            </g>
          ))}

          {/* Cells */}
          {grid.map(({ tech, y, scores }) =>
            columns.map(({ dim, x }) => {
              const value = scores[dim.key].value;
              const inLit = litTech === tech.id || litDim === dim.key;
              const isActive =
                active?.techId === tech.id && active?.dimKey === dim.key;
              return (
                <g key={`${tech.id}-${dim.key}`}>
                  <rect
                    x={x}
                    y={y}
                    width={CELL_W}
                    height={CELL_H}
                    rx={6}
                    fill={rampColor(value)}
                    fillOpacity={
                      inLit ? 0.95 : anyLit ? 0.42 : CELL_ALPHA
                    }
                    stroke={isActive ? "rgba(255,255,255,0.85)" : "none"}
                    strokeWidth={1.5}
                    style={{
                      transition:
                        "fill 450ms cubic-bezier(0.4, 0, 0.2, 1), fill-opacity 180ms ease",
                    }}
                  />
                  <text
                    x={x + CELL_W / 2}
                    y={y + CELL_H / 2 + 5}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.96)"
                    fontSize={14}
                    fontWeight={600}
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      // The mid-ramp gray is the least contrasty ground the
                      // numerals sit on, so they carry their own shadow.
                      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                      pointerEvents: "none",
                    }}
                  >
                    {value}
                  </text>
                </g>
              );
            })
          )}

          {/* Hit targets (a little wider than the cells) */}
          {grid.map(({ tech, y, scores }) =>
            columns.map(({ dim, x }) => (
              <rect
                key={`hit-${tech.id}-${dim.key}`}
                x={x - GAP / 2}
                y={y - GAP / 2}
                width={CELL_W + GAP}
                height={CELL_H + GAP}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${tech.name}, ${dim.label}, ${year}: ${scores[dim.key].value} out of 10.`}
                style={{ cursor: "pointer", outline: "none" }}
                onMouseEnter={() =>
                  setHoveredCell({ techId: tech.id, dimKey: dim.key })
                }
                onMouseLeave={() => setHoveredCell(null)}
                onFocus={() =>
                  setHoveredCell({ techId: tech.id, dimKey: dim.key })
                }
                onBlur={() => setHoveredCell(null)}
                onClick={() => {
                  const dismiss =
                    pinnedCell?.techId === tech.id &&
                    pinnedCell?.dimKey === dim.key;
                  setPinnedCell(
                    dismiss ? null : { techId: tech.id, dimKey: dim.key }
                  );
                  if (dismiss) setHoveredCell(null);
                }}
              />
            ))
          )}
        </svg>
      </div>

      {/* Legend — centred, with the ramp's meaning captioned beneath it */}
      <div className="flex flex-col items-center mt-5">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/40 tabular-nums">1</span>
          <div
            className="h-2 w-[220px] rounded-full"
            style={{
              background: `linear-gradient(90deg, ${rampColor(1, CELL_ALPHA)}, ${rampColor(5.5, CELL_ALPHA)}, ${rampColor(10, CELL_ALPHA)})`,
            }}
          />
          <span className="text-xs text-white/40 tabular-nums">10</span>
        </div>
        <span className="text-xs text-white/40 mt-2">
          red is weak, blue is strong
        </span>
      </div>

      {/* Detail readout — replaces a floating tooltip so the layout never jumps.
          Every row is a fixed number of 24px lines (one, one, two) and the block
          is a fixed 104px tall, so hovering never changes the figure's height.
          Overlong text clips rather than reflowing. */}
      <div className="mt-5 border-t border-white/15 pt-5">
        {activeTech && activeDim && activeValue !== null ? (
          <div className="flex flex-col gap-1 h-[104px] text-sm leading-6">
            <div className="flex items-baseline gap-x-3 h-6">
              <span className="text-white font-semibold whitespace-nowrap">
                {activeDim.label}
              </span>
              <span className="text-white/40">·</span>
              <span className="text-white/90 truncate">
                {activeDim.definition}
              </span>
            </div>

            <div className="flex items-baseline gap-x-3 h-6">
              <span className="text-white font-semibold whitespace-nowrap">
                {activeTech.name}
              </span>
              <span className="text-white/40">·</span>
              <span className="text-white/90 tabular-nums whitespace-nowrap">
                {activeValue}/10
              </span>
            </div>

            <div className="flex items-baseline gap-x-3 h-12">
              <span className="text-white font-semibold whitespace-nowrap">
                Reasoning
              </span>
              <span className="text-white/40">·</span>
              {/* In 2026 the source document's own rationale is the better
                  answer; only past it does the forecast driver apply. */}
              <span className="text-white/90 line-clamp-2">
                {year === BASE_YEAR
                  ? activeTech.scores[activeDim.key].note
                  : driverFor(activeTech.id, activeDim.key)}
              </span>
            </div>
          </div>
        ) : (
          <div className="h-[104px] text-sm leading-6">
            <p className="text-white/40 line-clamp-2">
              Tap or hover a cell for what drives that score over the decade.
              Hover a row or column label to isolate one technology or one
              dimension.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
