# AnyDerm capture figure

`RobotScanFigure` renders at both figure marks in the AnyDerm article.

- `buildRig.ts`: SO-101, custom pivoting phone carrier, phone and illuminated shroud.
- `buildSubject.ts`: original Lee Perry-Smith head, neck and shoulders, with a modeled continuation below the table and a seated lower body.
- `faceTrajectory.ts`: measures the loaded face, smooths the surface, fits a serpentine pass and checks scanner clearance, including inward carrier yaw.
- `armTrajectory.ts`, `kinematics.ts`, `scanPath.ts`: precomputed, smoothed and resampled joint motion; the oval is the raster template and loading fallback.
- `contracts.ts`: shared millimetre dimensions and joint limits.

The scene includes orbit/zoom/reset, a projection-based ruler, visibility-aware playback and reduced-motion support. Face fitting runs once after the model loads, not per animation frame.

Assets and the CC BY 3.0 license are in `public/anyderm/robot-scan/`; visible attribution appears under each figure. The centered optics and pivoting carrier are illustrative custom hardware. Clearance checks are for the visualization, not hardware collision certification.

`hardware-reference.md` preserves the source measurements and URDF references.
