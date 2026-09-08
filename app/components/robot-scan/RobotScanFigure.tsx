"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RobotSceneHandle, ViewState } from "./contracts";
import ScaleBar from "./ScaleBar";

/**
 * The robot-scan figure: the SO-101 arm carrying a phone in its shroud,
 * sweeping the coarse pass over a head in a chin rest, orbitable and
 * zoomable, at true millimetre scale. This is the figure used at both
 * robot placeholders in the whitepaper.
 *
 * This component owns the shared state — whether the clock is running, the
 * latest camera pose, and whether the figure is worth rendering at all — and
 * hands the renderer only `playing` and `active`. Unlike the acne figure
 * there is no timeline: the scene keeps its own scan phase, so the shell
 * never sees a clock value, only whether it should advance.
 *
 * RobotScene imports three at module top, so it is loaded client-only and
 * lazily: three stays out of the server bundle and out of the page's first
 * paint, and the black placeholder holds the 4:3 box until it arrives. The
 * types come from contracts, so the type-only import never touches the
 * scene module.
 */
const RobotScene = dynamic(() => import("./RobotScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />,
});

/**
 * Lucide glyphs inlined, as in the acne figure: five icons are not worth a
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
  play: "M6 3l14 9-14 9V3z",
  pause: "M6 4h4v16H6z|M14 4h4v16h-4z",
};

const VIEW_BUTTON =
  "w-9 h-9 rounded-full border border-white/20 bg-white/5 hover:bg-white/20 hover:border-white/40 text-white/80 hover:text-white transition-all duration-200 flex items-center justify-center";

export default function RobotScanFigure() {
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<ViewState | null>(null);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  // Set the first time the camera leaves home; the hint never comes back.
  const [hintGone, setHintGone] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RobotSceneHandle>(null);
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
    // start the arm, or the reader arrives to a sweep already halfway round.
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
  // then the scene's still frame stands and the clock is left to them.
  useEffect(() => {
    if (!inView || autoplayed.current) return;
    autoplayed.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    wantedRef.current = true;
    setPlaying(true);
  }, [inView]);

  // Pause while not active, resume on return if playback was wanted.
  useEffect(() => {
    setPlaying(active && wantedRef.current);
  }, [active]);

  // ------------------------------------------------------------ playback

  // The scan loops on its own, so there is no end to restart from: toggling
  // only records the wish and lets the active-gate above apply it.
  const togglePlay = useCallback(() => {
    wantedRef.current = !playing;
    setPlaying(!playing);
  }, [playing]);

  // ------------------------------------------------------------ camera

  // Stable identity, so the renderer does not re-subscribe on every frame.
  const onView = useCallback((v: ViewState) => {
    setView(v);
    if (!v.atHome) setHintGone(true);
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto mb-5">
      <div
        ref={cardRef}
        className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md overflow-hidden"
      >
        <div className="relative aspect-[4/3] bg-black">
          <RobotScene
            ref={sceneRef}
            className="absolute inset-0"
            playing={playing}
            active={active}
            onView={onView}
          />

          {/* Overlays. Only the buttons take pointer events: everything else
              lets a drag that starts on it fall through to the orbit. */}
          <div className="absolute top-3 left-3">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause the scan" : "Play the scan"}
              className={VIEW_BUTTON}
            >
              <Glyph d={playing ? ICON.pause : ICON.play} />
            </button>
          </div>

          <div className="absolute top-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={() => sceneRef.current?.resetView()}
              aria-label="Reset the view"
              disabled={view?.atHome ?? true}
              className={`${VIEW_BUTTON} disabled:opacity-40 disabled:pointer-events-none`}
            >
              <Glyph d={ICON.reset} />
            </button>
            <button
              type="button"
              onClick={() => sceneRef.current?.zoomBy(1 / 1.5)}
              aria-label="Zoom in"
              className={VIEW_BUTTON}
            >
              <Glyph d={ICON.zoomIn} />
            </button>
            <button
              type="button"
              onClick={() => sceneRef.current?.zoomBy(1.5)}
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
      </div>
    </div>
  );
}
