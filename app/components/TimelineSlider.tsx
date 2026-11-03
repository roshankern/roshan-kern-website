"use client";

import { BASE_YEAR, END_YEAR, YEARS } from "../writing/pp/timeline";

/**
 * Presentational only — the year and the playback timer live in the parent, so
 * that scrubbing (which stops playback) and a playback tick (which must not)
 * stay distinguishable.
 */
export default function TimelineSlider({
  year,
  onChange,
  playing,
  onPlayToggle,
}: {
  year: number;
  onChange: (year: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
}) {
  const progress = (year - BASE_YEAR) / (END_YEAR - BASE_YEAR);

  return (
    <div className="mt-8 border-t border-black/10 pt-6">
      <style>{`
        .ms-range {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          width: 100%;
          height: 28px;
          cursor: pointer;
        }
        .ms-range::-webkit-slider-runnable-track {
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(
            to right,
            rgba(0,0,0,0.75) var(--ms-progress),
            rgba(0,0,0,0.18) var(--ms-progress)
          );
        }
        .ms-range::-moz-range-track {
          height: 3px;
          border-radius: 999px;
          background: rgba(0,0,0,0.18);
        }
        .ms-range::-moz-range-progress {
          height: 3px;
          border-radius: 999px;
          background: rgba(0,0,0,0.75);
        }
        .ms-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          margin-top: -7.5px;
          border-radius: 999px;
          background: rgba(0,0,0,0.92);
          border: 1px solid rgba(0,0,0,0.9);
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          transition: box-shadow 200ms ease;
        }
        .ms-range::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: rgba(0,0,0,0.92);
          border: 1px solid rgba(0,0,0,0.9);
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
        }
        .ms-range:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px rgba(0,0,0,0.25);
        }
      `}</style>

      <div>
        {/* Play control and year read as one centred unit above the track. */}
        <div className="flex items-center justify-center gap-4 mb-1">
          <button
            onClick={onPlayToggle}
            aria-label={playing ? "Pause the timeline" : "Play the timeline"}
            className="shrink-0 w-9 h-9 rounded-full border border-black/10 bg-black/[0.02] hover:bg-black/[0.06] hover:border-black/25 text-black/80 hover:text-black transition-all duration-200 flex items-center justify-center"
          >
            {playing ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            )}
          </button>

          <span className="text-2xl font-semibold text-black tabular-nums">
            {year}
          </span>
        </div>

        <input
          type="range"
          min={BASE_YEAR}
          max={END_YEAR}
          step={1}
          value={year}
          onChange={(e) => onChange(Number(e.target.value))}
          className="ms-range"
          style={{ ["--ms-progress" as string]: `${progress * 100}%` }}
          aria-label="Year"
          aria-valuetext={`${year}`}
        />

        {/* Tick labels double as jump targets, so a specific year is one click away. */}
        <div className="flex justify-between mt-1">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => onChange(y)}
              className={`text-[11px] tabular-nums transition-colors duration-200 ${
                y === year ? "text-black" : "text-black/35 hover:text-black/70"
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        <p className="text-xs text-black/40 mt-4 leading-relaxed">
          Data from{" "}
          {/* The source markdown is itself a route, so the reader can open the
              exact scoring rationale behind every year. */}
          <a
            href="/writing/pp/timeline-research.md"
            className="text-black/60 underline decoration-black/25 underline-offset-2 transition-colors hover:text-black hover:decoration-black/60"
          >
            timeline-research.md
          </a>
        </p>
      </div>
    </div>
  );
}
