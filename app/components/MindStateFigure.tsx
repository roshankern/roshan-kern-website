"use client";

import { useEffect, useState } from "react";
import MindStateMatrix from "./MindStateMatrix";
import TimelineSlider from "./TimelineSlider";
import { BASE_YEAR, END_YEAR } from "../writing/pp/timeline";

/**
 * The matrix and the timeline that drives it, as one self-contained unit — so
 * the figure can be dropped into prose without the surrounding page owning any
 * of its state.
 */
export default function MindStateFigure({
  startYear = BASE_YEAR,
}: {
  startYear?: number;
}) {
  const [year, setYear] = useState(startYear);
  const [playing, setPlaying] = useState(false);

  // Playback walks to the last year and stops there rather than looping back,
  // so the view settles on the end state instead of snapping to the present.
  useEffect(() => {
    if (!playing) return;
    if (year >= END_YEAR) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setYear((y) => y + 1), 900);
    return () => clearTimeout(id);
  }, [playing, year]);

  // mb-5 matches the margin the preceding paragraph puts above the figure, so
  // it sits with equal air on both sides.
  return (
    <div className="w-full max-w-5xl mb-5">
      {/* One pane: the matrix and the timeline that drives it are one figure. */}
      <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-6 sm:p-8">
        <MindStateMatrix year={year} />
        <TimelineSlider
          year={year}
          onChange={(y) => {
            setYear(y);
            setPlaying(false);
          }}
          playing={playing}
          onPlayToggle={() => setPlaying((p) => !p)}
        />
      </div>
    </div>
  );
}
