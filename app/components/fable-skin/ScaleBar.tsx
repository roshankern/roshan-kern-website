/**
 * The scale bar in the corner of the skin viewport, in the style of the bars
 * burned into OpenDerm's dermoscopy images: a solid white rule with end
 * ticks and a length label.
 *
 * Pure: the parent positions it absolutely and feeds it the live px/mm from
 * the renderer. Nothing here knows about the camera.
 */

/**
 * Candidate bar lengths, µm, longest first. A 1-2-5 series so the label is
 * always a round number a reader recognises from a ruler.
 */
const STEPS_UM = [5000, 2000, 1000, 500, 200, 100, 50];

/**
 * The bar is snapped to the longest step that fits under this width, so it
 * stays roughly a fifth of the canvas as the viewer zooms rather than
 * growing to fill it. 60 px is the floor at which the end ticks still read.
 */
const MAX_BAR_PX = 160;

const fmtLength = (um: number) =>
  um >= 1000 ? `${um / 1000} mm` : `${um} µm`;

export default function ScaleBar({
  cssPxPerMm,
}: {
  /** CSS pixels per millimetre at the centre of the skin, from the renderer. */
  cssPxPerMm: number;
}) {
  // The renderer reports its first pose one frame after mount; before that
  // there is nothing honest to draw, and a bar of length NaN would throw.
  if (!Number.isFinite(cssPxPerMm) || cssPxPerMm <= 0) return null;

  const stepUm =
    STEPS_UM.find((um) => (um / 1000) * cssPxPerMm <= MAX_BAR_PX) ??
    STEPS_UM[STEPS_UM.length - 1];
  const barPx = (stepUm / 1000) * cssPxPerMm;

  // A dark halo rather than a backing plate: the bar sits over skin that runs
  // from near-white highlight to deep red, and a plate would hide the lesion
  // it is measuring.
  const shadow = { textShadow: "0 0 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.7)" };

  return (
    <div className="flex items-end gap-2 text-[11px] tabular-nums leading-none select-none">
      <span className="text-white" style={shadow}>{fmtLength(stepUm)}</span>
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
