"use client";

import { DAY_TICKS, END_DAY, START_DAY } from "../writing/anyderm/lesion";

/**
 * The scrubber under the skin viewport: play/pause, the day readout, the
 * range input and the day ticks. It moves the animation and says which day
 * is on screen; nothing more is read into the frame.
 *
 * Presentational only — the day and the playback timer live in the parent,
 * so that scrubbing (which stops playback) and a playback tick (which must
 * not) stay distinguishable. Same division of labour as TimelineSlider.
 */

// ------------------------------------------------------------------ geometry

/**
 * The range input's thumb is 18 px wide, so its centre travels from 9 px to
 * (width − 9) px rather than edge to edge. The tick row is padded by that
 * 9 px and each label is placed on the thumb's own travel, so a day's label
 * sits directly under the thumb when the day is that day.
 */
const THUMB_PAD = "px-[9px]";

/** Fraction of the track a day sits at. */
const fracOf = (day: number) => (day - START_DAY) / (END_DAY - START_DAY);

// ------------------------------------------------------------------ component

export default function LesionTimeline({
  day,
  onChange,
  playing,
  onPlayToggle,
}: {
  day: number;
  onChange: (day: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
}) {
  const progress = fracOf(day);
  // Whole days on the readout: the arc is keyed by day, and a fractional
  // day mid-animation is not a number the reader needs to see tick over.
  const dayLabel = Math.floor(day);

  return (
    <div>
      <style>{`
        .lt-range {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          width: 100%;
          height: 28px;
          cursor: pointer;
        }
        .lt-range::-webkit-slider-runnable-track {
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(
            to right,
            rgba(255,255,255,0.75) var(--lt-progress),
            rgba(255,255,255,0.18) var(--lt-progress)
          );
        }
        .lt-range::-moz-range-track {
          height: 3px;
          border-radius: 999px;
          background: rgba(255,255,255,0.18);
        }
        .lt-range::-moz-range-progress {
          height: 3px;
          border-radius: 999px;
          background: rgba(255,255,255,0.75);
        }
        .lt-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          margin-top: -7.5px;
          border-radius: 999px;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(255,255,255,0.9);
          box-shadow: 0 0 14px rgba(255,255,255,0.45);
          transition: box-shadow 200ms ease;
        }
        .lt-range::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(255,255,255,0.9);
          box-shadow: 0 0 14px rgba(255,255,255,0.45);
        }
        .lt-range:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 0 4px rgba(255,255,255,0.25);
        }
      `}</style>

      {/* Play control and day read as one unit above the track. */}
      <div className="flex items-center gap-4 mb-2">
        <button
          type="button"
          onClick={onPlayToggle}
          aria-label={playing ? "Pause the lesion timeline" : "Play the lesion timeline"}
          className="shrink-0 w-9 h-9 rounded-full border border-white/20 bg-white/5 hover:bg-white/20 hover:border-white/40 text-white/80 hover:text-white transition-all duration-200 flex items-center justify-center"
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

        <span className="text-2xl font-semibold text-white tabular-nums">
          Day {dayLabel}
        </span>
      </div>

      <input
        type="range"
        min={START_DAY}
        max={END_DAY}
        step={0.05}
        value={day}
        onChange={(e) => onChange(Number(e.target.value))}
        className="lt-range"
        style={{ ["--lt-progress" as string]: `${progress * 100}%` }}
        aria-label="Day"
        aria-valuetext={`Day ${dayLabel}`}
      />

      {/* Tick labels double as jump targets. Each is centred on its day's x
          rather than spread with justify-between, so the "9" sits under the
          thumb when the day is 9. The thumb's centre is at
          9 px + frac × (width − 18 px), which is what the calc() spells out. */}
      <div className={`relative h-4 ${THUMB_PAD}`}>
        {DAY_TICKS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`absolute -translate-x-1/2 text-[11px] tabular-nums leading-none transition-colors duration-200 ${
              d === dayLabel ? "text-white" : "text-white/35 hover:text-white/70"
            }`}
            style={{ left: `calc(9px + ${fracOf(d) * 100}% - ${18 * fracOf(d)}px)` }}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
