"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SkinCanvasHandle, ViewState } from "./SkinCanvas";
import LesionTimeline from "./LesionTimeline";
import ScaleBar from "./ScaleBar";
import { END_DAY, START_DAY } from "../writing/anyderm/lesion";

/**
 * The acne-progression figure: a patch of cheek skin under a dermatoscope
 * with one lesion running its 21-day course, orbitable and zoomable, scrubbed
 * by the day timeline beneath it.
 *
 * This component owns every piece of shared state — the day, whether the
 * clock is running, the latest camera pose, and whether the figure is worth
 * rendering at all — and hands each child only what it needs. The renderer
 * never sees the timeline and the timeline never sees the camera.
 *
 * SkinCanvas imports three at module top, so it is loaded client-only and
 * lazily: three stays out of the server bundle and out of the page's first
 * paint, and the black placeholder holds the 4:3 box until it arrives. The
 * type-only import above costs nothing at runtime.
 */
const SkinCanvas = dynamic(() => import("./SkinCanvas"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

/** 0 → 21 in about fourteen seconds: slow enough to watch, quick enough to loop. */
const DAYS_PER_SECOND = (END_DAY - START_DAY) / 14;
/** Pause on the last frame before wrapping, ms, so the mark registers before the skin clears. */
const END_HOLD_MS = 600;
/** The peak pustule — the frame that says the most if only one is ever seen. */
const STILL_DAY = 11;

/**
 * Lucide glyphs inlined, as in ProfilePlot: three icons are not worth a
 * dependency, and the 24-grid with a 2 px round stroke matches the site.
 */
const Glyph = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4">
    {d.split("|").map((p) => <path key={p} d={p} />)}
  </svg>
);

const ICON = {
  reset: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8|M3 3v5h5",
  zoomIn: "M5 12h14|M12 5v14",
  zoomOut: "M5 12h14",
};

const VIEW_BUTTON =
  "w-9 h-9 rounded-full border border-white/20 bg-white/5 hover:bg-white/20 hover:border-white/40 text-white/80 hover:text-white transition-all duration-200 flex items-center justify-center";

export default function AcneProgression() {
  const [day, setDay] = useState(START_DAY);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<ViewState | null>(null);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  // Set the first time the camera leaves home; the hint never comes back.
  const [hintGone, setHintGone] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SkinCanvasHandle>(null);
  // The rAF loop reads and writes this, and only mirrors it into state for
  // the render: a closure over `day` would go stale between frames.
  const dayRef = useRef(day);
  // What the user asked for, independent of whether we are able to honour it
  // right now: playback pauses off-screen and resumes on return only if it
  // was wanted, so a figure scrolled past and back does not start on its own.
  const wantedRef = useRef(false);
  const autoplayed = useRef(false);

  const active = inView && visible;

  // ------------------------------------------------------------ visibility

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    // 0.4 rather than 0: a sliver at the bottom of the viewport should not
    // start the clock, or the reader arrives to a lesion already halfway on.
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Autoplay on first sight, unless the reader has asked for less motion —
  // then open on the peak pustule and leave the clock to them.
  useEffect(() => {
    if (!inView || autoplayed.current) return;
    autoplayed.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dayRef.current = STILL_DAY;
      setDay(STILL_DAY);
      return;
    }
    wantedRef.current = true;
    setPlaying(true);
  }, [inView]);

  // Pause while not active, resume on return if playback was wanted.
  useEffect(() => {
    setPlaying(active && wantedRef.current);
  }, [active]);

  // ------------------------------------------------------------ playback

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last: number | null = null;
    // Timestamp until which the last frame is held before wrapping; 0 = not holding.
    let holdUntil = 0;

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (last === null) {
        last = t;
        return;
      }
      // Clamp the step: a throttled tab can hand back a multi-second gap and
      // the lesion should not leap a week when the reader comes back.
      const dt = Math.min(t - last, 100) / 1000;
      last = t;

      if (holdUntil) {
        if (t < holdUntil) return;
        holdUntil = 0;
        dayRef.current = START_DAY;
        setDay(START_DAY);
        return;
      }
      let d = dayRef.current + dt * DAYS_PER_SECOND;
      if (d >= END_DAY) {
        d = END_DAY;
        holdUntil = t + END_HOLD_MS;
      }
      dayRef.current = d;
      setDay(d);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const scrub = useCallback((d: number) => {
    dayRef.current = d;
    setDay(d);
    wantedRef.current = false;
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      wantedRef.current = false;
      setPlaying(false);
      return;
    }
    // Play from the end means play again.
    if (dayRef.current >= END_DAY) {
      dayRef.current = START_DAY;
      setDay(START_DAY);
    }
    wantedRef.current = true;
    setPlaying(true);
  }, [playing]);

  // ------------------------------------------------------------ camera

  // Stable identity, so the renderer does not re-subscribe on every frame.
  const onView = useCallback((v: ViewState) => {
    setView(v);
    if (!v.atHome) setHintGone(true);
  }, []);

  return (
    <div className="w-full max-w-5xl mb-5">
      <div
        ref={cardRef}
        className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md overflow-hidden"
      >
        <div className="relative aspect-[4/3] bg-black">
          <SkinCanvas
            ref={canvasRef}
            className="absolute inset-0"
            day={day}
            active={active}
            onView={onView}
          />

          {/* Overlays. Only the buttons take pointer events: everything else
              lets a drag that starts on it fall through to the orbit. */}
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={() => canvasRef.current?.resetView()}
              aria-label="Reset the view"
              disabled={view?.atHome ?? true}
              className={`${VIEW_BUTTON} disabled:opacity-40 disabled:pointer-events-none`}
            >
              <Glyph d={ICON.reset} />
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.zoomBy(1 / 1.5)}
              aria-label="Zoom in"
              className={VIEW_BUTTON}
            >
              <Glyph d={ICON.zoomIn} />
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.zoomBy(1.5)}
              aria-label="Zoom out"
              className={VIEW_BUTTON}
            >
              <Glyph d={ICON.zoomOut} />
            </button>
          </div>

          <div className="absolute bottom-3 right-3 pointer-events-none">
            <ScaleBar cssPxPerMm={view?.cssPxPerMm ?? 0} />
          </div>

          <p
            aria-hidden
            className={`absolute bottom-3 left-3 text-[11px] text-white/40 pointer-events-none transition-opacity duration-700 ${
              hintGone ? "opacity-0" : "opacity-100"
            }`}
          >
            drag to orbit · pinch or ＋/－ to zoom
          </p>
        </div>

        <div className="p-6 sm:p-8 pt-4 sm:pt-4">
          <LesionTimeline
            day={day}
            onChange={scrub}
            playing={playing}
            onPlayToggle={togglePlay}
          />
        </div>
      </div>
    </div>
  );
}
