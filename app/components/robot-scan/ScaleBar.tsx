import { SCALE_STEPS_MM } from "./contracts";

/**
 * The scale bar in the corner of the robot viewport, the acne figure's bar
 * with a millimetre step table: a solid white rule with end ticks and a
 * length label, so the reader can put a number on the arm, phone, and head.
 *
 * Pure: the parent positions it absolutely and feeds it the live px/mm from
 * the renderer. Nothing here knows about the camera.
 */

/**
 * The bar is snapped to the longest step that fits under this width, so it
 * stays roughly a fifth of the canvas as the viewer zooms rather than
 * growing to fill it. 60 px is the floor at which the end ticks still read.
 */
const MAX_BAR_PX = 160;

/** Plain millimetres throughout: one unit, no cm/mm boundary to read past. */
const fmtLength = (mm: number) => `${mm} mm`;

export default function ScaleBar({
  cssPxPerMm,
}: {
  /** CSS pixels per millimetre at the orbit target, from the renderer. */
  cssPxPerMm: number;
}) {
  // The renderer reports its first pose one frame after mount; before that
  // there is nothing honest to draw, and a bar of length NaN would throw.
  if (!Number.isFinite(cssPxPerMm) || cssPxPerMm <= 0) return null;

  const stepMm =
    SCALE_STEPS_MM.find((mm) => mm * cssPxPerMm <= MAX_BAR_PX) ??
    SCALE_STEPS_MM[SCALE_STEPS_MM.length - 1];
  const barPx = stepMm * cssPxPerMm;

  // A dark halo rather than a backing plate: the bar sits over whatever the
  // orbit puts in the corner, and a plate would hide part of the rig.
  const shadow = { textShadow: "0 0 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.7)" };

  return (
    <div className="flex items-end gap-2 text-[11px] tabular-nums leading-none select-none">
      <span className="text-white" style={shadow}>{fmtLength(stepMm)}</span>
      {/* End ticks are drawn as borders on a box the width of the bar, so the
          bar itself is a single element whose width is the measurement. */}
      <span
        aria-hidden
        className="block h-[7px] border-x-2 border-b-2 border-white"
        style={{
          // Measured tick-centre to tick-centre: the box is one border
          // width wider than the length so the 2 px ticks straddle the ends.
          width: `${barPx + 2}px`,
          boxSizing: "border-box",
          filter: "drop-shadow(0 0 2px rgba(0,0,0,0.9))",
        }}
      />
    </div>
  );
}
