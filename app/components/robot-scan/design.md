# The robot-scan figure

A to-scale, orbitable 3D view of the AnyDerm capture rig: an SO-101 follower
arm holding an iPhone 17 in a printed bracket, with a light shroud and ring
light around the phone's rear camera, sweeping the phone across the face of a
person whose head sits in a chin-and-ear rest. It runs in the AnyDerm
whitepaper at both `<RobotScanFigure />` marks — the Overview and the System
Overview — and its job is to answer "what does this thing actually look like,
and how big is it" in one glance.

Everything in it is a real dimension. That is the point of the figure, so the
scale bar in the corner is not decoration: the arm really is that size next to
that head, and the phone really is that size in the arm.

## Interaction

Deliberately identical to the acne-progression figure
(`../fable-skin/FableAcneProgression.tsx`), because the two sit in the same
article and a reader should not have to learn two sets of controls: drag to
orbit, pinch or the ＋/－ buttons to zoom, a reset button that is disabled at
the home view, a live scale bar bottom-right, a hint that fades once the camera
first moves, autoplay on first scroll into view, pause when off-screen or when
the tab is hidden, and a still frame instead of motion under
`prefers-reduced-motion`. The only difference is the play/pause control, which
sits over the canvas here because there is no timeline strip beneath it.

Page scrolling is protected the same way too: a capture-phase wheel listener
swallows wheel events until the reader has actually pressed on or focused the
canvas, and `touch-action: pan-y` keeps a vertical swipe scrolling the page on
a phone.

## Coordinates

- Units are **millimetres**. `+Y` is up. The table top is the plane `Y = 0`.
- The face looks toward **`+Z`**. The arm stands in front of it, at `+Z`.
- `+X` is the head's own left, which is screen-right when you look at the face.

## Modules

Everything numeric that more than one module needs lives in `contracts.ts`, and
only there. If two files would otherwise hard-code the same millimetre, it goes
in the contract instead.

**`contracts.ts`** — the shared contract. Head and fixture dimensions, the arm's
link lengths and joint limits with the exact three.js chain the solver and the
builder both have to honour, the phone and its mount, the camera home pose, the
palette, and the `Materials` / `Built` / `ArmRig` / `ToolRig` interfaces the
builders implement. No logic.

**`hardware-reference.md`** — the sourced dimensions behind the `ARM` and
`PHONE` blocks: the SO-101's joint offsets and limits, the Feetech STS3215
servo body, and the iPhone 17's camera island, each with a citation. Read this
before changing a number in the contract.

**`scanPath.ts`** — where the phone goes. It tracks a **smooth oval** fitted
around the head, not the sculpted face: an ellipsoid a few millimetres proud
of the skin whose front clears the tip of the nose. Following the real surface
made the arm whip through the brow and the nose and tear where the poses left
the workspace; a convex oval's normal turns slowly everywhere, so the arm
glides. The lens is then not exactly its working distance off every point, and
at this scale that is invisible.

**`armTrajectory.ts`** — the motion. The whole loop is solved once, the
unreachable stretches are bridged, the corners are smoothed off and the result
is resampled to a constant joint-space speed. Solving per frame is exact and
looks terrible: the solver is discontinuous, so it snapped the wrist through
large angles wherever the path left the workspace. This took the worst jump
between frames from 320 degrees to about 2.

**`headShape.ts`** — the analytic skin surface, `headSurface(theta, phi)`. A
warped ellipsoid: cross-sections that taper to the jaw and bulge at the
occiput, a section centre that shifts forward as it descends so the chin sits
ahead of the head's centre, and smooth local displacements for the brow, eye
sockets, nose, lips, cheekbones, chin and temples. Normals come from central
differences of the surface itself, not from the direction to the centre, which
would only be right on a sphere. Both the mesh and the scan path read this, so
the phone traces the same skin the reader sees.

**`buildHead.ts`** — the head mesh tessellated from that surface, plus the parts
that are not a displacement of it: ears, eyeballs with lids and irises,
eyebrows, nostrils, and a buzz-cut shell offset a few millimetres outside the
scalp.

**`buildFixture.ts`** — the head rest and a hint of the person in it. The
subject sits behind the table, so the rest is a floor-standing column with a
padded chin cup and two pads pressing the skull behind the ears. Every part of
it is derived from the head itself rather than written as a world coordinate,
because the first version used absolutes and pointed at thin air the moment
the person was reseated. Everything structural stays behind the head, since
the arm works the face from `+Z`.

**`buildArm.ts`** — the SO-101, built the way the real one is: a Feetech
STS3215 at every joint in printed cradles, links made of parallel printed
plates with lightening cut-outs, a daisy-chained servo cable running along the
links. There is no gripper: a scanner does not grasp anything, so the arm ends
at a mounting flange on the wrist-roll output and the camera head bolts
straight to it. `setJoints` writes the five rotations and nothing else.

**`buildTool.ts`** — the phone and its head: a rounded iPhone 17 body with a
separate anodised rail, glass back and lit screen, the rear camera island with
its lens assemblies, the printed bracket that bolts it to the wrist flange,
the shroud, and the ring of LEDs inside the shroud with the point light that goes
with them. Its layout is fixed by the contract, because the solver inverts it.

**`rig.ts`** — the inverse kinematics. Given a point on the tracked oval and
its normal, it places the scanning lens `MOUNT.standoff` off that point, aimed
down the normal. Five joints against five constraints, solved in closed form
in four branches; see below. `armTrajectory.ts` is what the renderer actually
calls, and it is the layer that makes the result watchable.

**`materials.ts`** — every material in the figure, built once against the
renderer. It installs a `RoomEnvironment` through a PMREM generator as
`scene.environment`, because metal and glass with nothing to reflect look like
painted plastic. Procedural canvas textures give the printed parts their
0.2 mm layer lines, the skin its pores, the buzz cut its stubble, and the
phone screen its capture-app UI.

**`RobotScene.tsx`** — composition and lifecycle only. Renderer, lights,
shadows, the four builders, the animation clock, OrbitControls, the
render-on-demand loop, and disposal. It builds no geometry except the table.

**`ScaleBar.tsx`**, **`RobotScanFigure.tsx`** — the acne figure's scale bar with
a millimetre step table, and the client shell that owns playback state,
visibility and the camera readout.

## Why the phone is mounted across the wrist, and canted

The camera axis is held **across** the wrist-roll axis, at `MOUNT.axisTilt` to
it. That is what makes the pose solvable at all. Aiming a camera at a point is
five constraints — three for where the lens is, two for which way it points —
against five joints. If the camera looked straight down the last link, the roll
joint would spin about the camera axis and contribute nothing to the aim,
leaving four useful joints for five constraints and no exact solution. Mounting
the camera across the roll axis gives the roll something to do.

The tilt is the part that was learned the hard way. At a dead right angle the
last link has to stand vertical whenever the camera looks level at a face,
which pins the wrist flex at about 90 degrees — right on its 95 degree stop —
and leaves only about half the scan reachable from an arm standing on the
table. Canting the bracket back to 70 degrees frees the wrist and roughly
doubles that, which is what lets the arm sit on the tabletop instead of on a
riser. An earlier version used a riser and it read as a rigid leg from the
table to the first joint, which is not what this arm looks like.

Two smaller things fall out of the same geometry. The bracket is **clocked half
a turn** (`MOUNT.bracketRoll`): without it the roll servo is asked to sit near
180 degrees for the whole scan, just outside its 320 degree travel. And the
scan is a **raster, not a ring** — a loop encircling the face winds the roll
through a full turn, which the servo cannot do, while a raster encloses nothing.

## Verifying a change

The figure has no visual test, so the checks are numerical and structural:

- `npx tsc --noEmit -p .` clean.
- The IK round-trip: `lensPose(solveArm(sample))` must return the lens at
  `sample.skin + sample.normal * MOUNT.standoff` and the axis at
  `-sample.normal`, to floating-point tolerance.
- The **built** lens must sit where the solver aims. These are two different
  claims and only the second catches a bracket drawn inconsistently with the
  contract — which is exactly what an 18 mm error turned out to be. Walk the
  real scene graph and compare against `lensPose`.
- The finished trajectory inside every joint limit, with no step between
  adjacent frames larger than a couple of degrees.
- No geometry below the table, in particular the phone's lower edge when the
  arm is at the chin.
- The page compiles and serves: `npm run dev`, then load `/writing/anyderm`.

After that, look at it. Sizes are the thing this figure is for, and a number
that is right in the contract but wrong on screen will be obvious immediately.
