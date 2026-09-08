import type * as THREE from "three";

/**
 * Shared contract for the robot-scan figure. Every module in this folder
 * builds against these numbers and types and nothing else, so the head sculpt,
 * the arm build, the tool build, the IK and the scene can be written
 * independently and still fit together.
 *
 * Coordinate conventions (every module obeys these):
 * - World units are **millimetres**. +Y is up. The table top is the plane Y = 0.
 * - The face looks toward **+Z**. The arm stands in front of the face, at +Z.
 * - +X is the head's own left, i.e. screen-right when looking at the face.
 *
 * Only contracts.ts declares numbers that more than one module needs. If two
 * modules would otherwise each hard-code the same millimetre, it belongs here.
 */

export type Vec3 = { x: number; y: number; z: number };

// ============================================================== the head

/**
 * A 50th-percentile adult head, from standard anthropometry (ANSUR II /
 * Farkas). The base shape is an ellipsoid with these semi-axes; headShape.ts
 * warps it into an actual head and adds the face. Nothing outside headShape.ts
 * may assume the head is an ellipsoid — ask headSurface() instead.
 *
 *   head breadth (bitragion, max width)     152 mm  → x semi-axis 76
 *   head length  (glabella → occiput)       197 mm  → z semi-axis 98
 *   head height  (menton → vertex)          232 mm  → y semi-axis 116
 */
export const HEAD = {
  radii: { x: 76, y: 116, z: 98 },
  /**
   * Ellipsoid centre. The person sits behind the table, leaning into a chin
   * rest the way you would at a slit lamp, so the head is well back in -Z
   * and raised clear of the tabletop. Both numbers come out of a search over
   * where the arm can actually reach with its base on the table: this is the
   * seat that keeps the whole scan inside the workspace.
   */
  centre: { x: 0, y: 190, z: -190 } as Vec3,
  /** Height of the lowest point of the chin above the table plane. */
  chinY: 74,
  /**
   * Ear placement. The ear canal (tragion) sits a little behind and below the
   * head's centre; the pinna is about 62 mm tall, 33 mm wide, and stands
   * ~20 mm off the skull.
   *
   * y and z are offsets **from HEAD.centre**, not world coordinates. They
   * used to be world millimetres, and when the person was reseated they
   * silently pointed at a spot in front of the face — so anything anchored to
   * the head is expressed relative to the head from here on.
   */
  ear: {
    y: -4,
    z: -12,
    height: 62,
    width: 33,
    protrusion: 20,
  },
  /** Interpupillary distance 63 mm, eyes at this height, this deep in the socket. */
  eye: { halfSpacing: 31.5, y: 168, radius: 12 },
} as const;

/**
 * headShape.ts is the single source of truth for the skin surface. It exports:
 *
 *   headSurface(theta, phi): ScanSample
 *     theta swings about +Y: 0 faces +Z, positive toward +X (the head's own
 *     left), ±π at the back. phi is elevation: 0 at HEAD.centre's height,
 *     +π/2 at the vertex, −π/2 under the chin. Returns the world-space skin
 *     point and its outward unit normal.
 *
 *   headField(theta, phi): number
 *     the raw radial multiplier, for the mesh builder's own use.
 *
 * Both are pure and cheap enough to call a few thousand times a frame.
 */

/**
 * The head fixture: a chin cup and two pads that press behind the ears, on a
 * column standing on the floor behind the person. Only the sizes live here —
 * where each part goes is derived from the head itself in buildFixture, so
 * that reseating the person can never leave the rest pointing at thin air,
 * which is exactly what happened when these were world coordinates.
 */
export const FIXTURE = {
  /** Chin cup: a shallow dish under the menton. */
  chinCup: { radius: 32, depth: 12, wall: 4 },
  /** Pads that touch the skull just behind each ear. */
  earPad: { radius: 22, thickness: 8 },
  /** The horizontal arm from each post reaches in to the pad at this height. */
  armRadius: 7,
} as const;

/**
 * The room the figure sits in. The table's top is the y = 0 plane that
 * everything else is measured from, the floor is 700 mm below it, and the
 * table's far edge stops short of the head so the person can sit behind it.
 *
 * These are the only absolute positions in the contract that are not the
 * robot's or the person's: they are the furniture.
 */
export const ROOM = {
  /** Floor plane. The table is 700 mm tall and its top is y = 0. */
  floorY: -700,
  table: {
    width: 1100,
    /** Far edge. The head is behind this; the arm reaches across it. */
    farZ: -60,
    /** Near edge, toward the viewer. */
    nearZ: 420,
    topThickness: 26,
    /** The apron under the top, inset by `reveal`, which is what gives the
     *  edge a profile instead of one flat 66 mm slab face. */
    apronHeight: 40,
    reveal: 14,
    legSize: 64,
    /** Legs are held this far in from the apron's own edge. */
    legInset: 20,
  },
} as const;

// =============================================================== the arm

/**
 * SO-101 follower arm (TheRobotStudio SO-ARM101, the arm LeRobot ships).
 * Five revolute joints; the stock gripper is replaced by the camera bracket,
 * so all five are driven and nothing grasps.
 *
 * The exact numbers live in hardware-reference.md beside this file, with
 * sources. Everything here is in millimetres and radians.
 *
 * Chain, in three.js terms, so every module agrees:
 *
 *   base       at world (0, 0, ARM.baseZ), sitting on the table
 *   panGroup   rotation.y = pan                                   child of base
 *   lift       position (0, shoulderY, 0), rotation.x = lift      child of panGroup
 *   elbow      position (0, 0, -L1),       rotation.x = elbow     child of lift
 *   flex       position (0, 0, -L2),       rotation.x = flex      child of elbow
 *   roll       position (0, 0, -L3),       rotation.z = roll      child of flex
 *   toolMount  position (0, 0, -L4)                               child of roll
 *
 * Each link extends along its parent frame's local **-Z**. With
 * rotation.y = pan, local -Z maps to world (-sin pan, 0, -cos pan): pan 0
 * points the arm at the face, positive pan swings toward -X. With
 * rotation.x = a, local -Z maps to (0, sin a, -cos a): positive lifts.
 * So the link direction after the pitch chain is
 *
 *   d = cos(alpha) * f + sin(alpha) * (0,1,0),   alpha = lift + elbow + flex
 *   f = (-sin pan, 0, -cos pan)
 *
 * and d is the wrist ROLL axis. See MOUNT for why that matters.
 */
export const ARM = {
  /** Where the arm's base plate sits, in front of the face. */
  baseZ: 195,
  /**
   * Base assembly footprint and height, from the bounding box of
   * base_so101_v2.stl plus the motor holder and the Waveshare controller
   * plate. The 111 mm is the "111" of the arm's published 532 x 173 x 111
   * envelope. The pan axis stands 64.8 mm above the table inside this.
   */
  base: { width: 111, depth: 96, height: 72 },
  /**
   * Height of the shoulder-lift axis above the table, from the URDF. The arm
   * sits directly on the table: an earlier version put it on a riser to lift
   * the shoulder to face height, but that reads as a rigid leg from the
   * tabletop to the first joint, which is not what this arm looks like. The
   * person is raised to meet the arm instead — see HEAD.centre.
   */
  shoulderY: 119,
  /**
   * Link lengths, joint origin to joint origin, straight off the URDF:
   *   L1  shoulder_lift → elbow_flex   (the upper arm)
   *   L2  elbow_flex    → wrist_flex   (the forearm)
   *   L3  wrist_flex    → wrist_roll
   * The stock follower's gripper would add a further 98.5 mm past the roll
   * axis. We do not use it: a scanner does not grasp anything, so the camera
   * bracket bolts straight to the wrist-roll output flange, which is what a
   * purpose-built end effector would do. That also keeps the phone close to
   * the roll axis, and the length of that lever is what decides whether the
   * arm can reach the face at all.
   */
  L1: 116.0,
  L2: 135.0,
  L3: 63.7,
  /** Roll axis to the tool mounting flange. The gripper is removed, so this
   * is just the thickness of the flange the bracket bolts to. */
  L4: 6,
  /**
   * Feetech STS3215 body, from sts3215_03a_v1.stl. The output shaft runs
   * along the **height** axis: the two horn faces are the 45.4 x 24.8 faces,
   * 35.0 mm apart, and the remaining 4.6 mm of the 39.6 is the output boss
   * standing proud of the case. Every joint of this arm is one of these
   * boxes with its shaft on the joint axis, so a link's printed cheeks
   * straddle the 35.0 mm case rather than the 24.8 mm width.
   */
  servo: { length: 45.4, width: 24.8, height: 39.6 },
  /** Printed shells are this thick; links are two plates this far apart. */
  shellThickness: 4,
  /**
   * Joint limits, radians, in OUR convention — which is not the URDF's.
   *
   * The URDF's joint zeros are the arm's assembly pose, not a straight arm:
   * at its zero the upper arm points up and the forearm points forward, so
   * `elbow_flex = 0` is already about an 80 degree bend, while our chain
   * calls elbow 0 straight. Applying the URDF's +/-96.8 degrees to our angle
   * would forbid the arm from folding at all, which is not what the hardware
   * does. So each range below is the joint's true travel, re-centred on our
   * zero: pan 220 degrees, lift 200, elbow 193.7, flex 190, roll 320.
   */
  limits: {
    pan: [-1.91986, 1.91986] as const,
    lift: [-0.42, 3.07] as const,
    elbow: [-3.086, 0.293] as const,
    flex: [-1.65806, 1.65806] as const,
    roll: [-2.74385, 2.84121] as const,
  },
} as const;

export type ArmJoints = {
  pan: number;
  lift: number;
  elbow: number;
  flex: number;
  roll: number;
  /** False when the pose had to be clamped: out of reach, or a limit stopped a joint. */
  reachable: boolean;
};

// ============================================================== the tool

/**
 * The iPhone 17, to Apple's published body size, with the rear camera island
 * on its back. Phone-local axes, used only inside buildTool:
 *   +X the long axis (149.6), +Y the short axis (71.5), +Z out of the SCREEN.
 * So the camera looks along phone-local -Z.
 */
export const PHONE = {
  body: { x: 149.6, y: 71.5, z: 7.95 },
  cornerRadius: 11,
  /** Screen bezel, mm, inset from the body edge on all four sides. */
  bezel: 3.2,
  /** Rear camera island: a rounded plateau on the back, offset from a corner. */
  island: { x: 44, y: 44, z: 3.6, cornerRadius: 14 },
  /**
   * Island centre in phone-local XY, from the phone's centre.
   *
   * On a real iPhone this sits up in a corner, about (-46, 8.5). Here the
   * optical head is moved to the middle of the phone's back instead, so that
   * the scanning lens lands on the phone's centre and therefore on the arm's
   * own axis. That is the difference between the shroud sweeping the face and
   * the shroud riding 58 mm to one side of it while the phone covers the
   * face, which is what a corner camera on a centre-held phone does.
   *
   * This is the one place the figure departs from the real phone, and it is
   * the right departure: the rig is a purpose-built head, and putting its
   * optical axis on its mechanical axis is what an engineer would do. The
   * x = 12 offsets the island so the scanning lens, not the island's middle,
   * lands on centre.
   */
  islandCentre: { x: 12, y: 0 },
  /** The two rear lenses, centre-to-centre, on the island's diagonal. */
  lens: { radius: 10.5, glassRadius: 7.2, spacing: 24 },
  /** Which lens is the one we scan with: the first, at the island's -X side. */
} as const;

/**
 * How the phone is mounted, and the shroud that rings its lens.
 *
 * The key decision: **the camera axis is held across the wrist-roll axis**,
 * at MOUNT.axisTilt to it rather than along it. A printed bracket bolts to the gripper's mounting face, reaches
 * sideways, and clamps the phone's long edge, so the phone's plane contains
 * the roll axis and the lens looks out sideways from the arm. That is what a
 * real phone clamp on this arm looks like, and it is also what makes the pose
 * exactly solvable: five joints, five constraints (see rig.ts).
 *
 * In the wrist-roll frame (origin W, local -Z along the link away from the
 * base, rotation.z = roll):
 *   camera axis  a = local -Y, rotated by roll
 *   link axis    d = local -Z, unaffected by roll
 *   lens centre  = W + lensFromAxis * a + lensAlongLink * d
 *
 * so the angle between a and d is always axisTilt, whatever the roll.
 *
 * That fixes the phone's orientation in the roll frame, and buildTool must
 * honour it exactly, because rig.ts inverts it:
 *
 *   - the scanning lens's glass centre sits at local (0, -lensFromAxis,
 *     -lensAlongLink). Local x = 0 is not optional: the camera axis is the
 *     local -Y line through the origin, so the lens has to be on it.
 *   - the phone's LONG axis (149.6) runs along local X, its SHORT axis
 *     (71.5) along local Z, and its thickness along local Y with the screen
 *     facing +Y, toward the arm. The phone therefore stays landscape and,
 *     because the solve usually leaves the last link close to vertical, it
 *     stays roughly level — which is what keeps it off the table when the
 *     arm works the chin.
 *   - the gripper's mounting face is at local (0, 0, -ARM.L4), so the
 *     bracket is a short stalk from there out along -Y to the phone's edge.
 */
export const MOUNT = {
  /** Lens-to-skin working distance, mm — the 5 cm the close-up lens needs. */
  standoff: 50,
  /**
   * The angle between the camera axis and the wrist-roll axis. Zero: the
   * camera looks straight down the last link, like a probe on the end of the
   * arm.
   *
   * It was 90 degrees, and then 70, on the reasoning that a camera across the
   * link makes the pose exactly solvable — five joints against five
   * constraints, with the roll joint doing real work in the aim. That is true
   * and it does not survive contact with the hardware. Chasing the aim makes
   * the roll wind through about 350 degrees over one scan loop against 320
   * degrees of travel, so it jams on its stop and the phone rotates away from
   * the face.
   *
   * Putting the camera on the link axis gives the roll nothing to chase. The
   * aim is then the arm's own reaching direction, which points at the face by
   * construction and cannot wind. The price is that the camera only matches
   * the surface normal's component in the plane the arm works in, so it is a
   * few tens of degrees off at the outer stations. That is the trade the
   * figure wants: it is an illustration of how the system works, not a
   * calibration.
   */
  axisTilt: 0,
  /** Roll axis to the phone's BACK face, along the link. */
  phoneBackFromAxis: 48,
  /**
   * Offset of the tracked point from the wrist-roll axis. Zero, because the
   * phone is now held in the middle of its back and its centre sits on the
   * arm's own axis — which is what it looks like when a bracket holds a phone
   * properly, and it stops the sweep reading as laterally offset from the
   * head. The camera island is still off-centre on the phone's back, where it
   * really is; the shroud goes there, and the few centimetres between it and
   * the tracked point do not show.
   */
  lensFromAxis: 0,
  /**
   * Roll axis origin to the lens, along the link direction.
   *
   * This is the single most load-bearing number in the figure. The wrist
   * pivots sit this far plus L3 back from the lens along the link, and the
   * camera axis is perpendicular to that link, so a long lever throws the
   * wrist far off the face and out of the arm's reach. At 126 mm, with the
   * phone held in the gripper, only 6% of the face could be reached. Bolting
   * the bracket to the wrist flange instead brings it to 30 and the whole
   * scan region comes inside the workspace with about 22 degrees of margin
   * on the tightest joint.
   */
  lensAlongLink: 44,
  /**
   * The bracket is clocked half a turn about the wrist-roll axis.
   *
   * Without it the roll servo is asked to sit near 180 degrees for the whole
   * scan — the phone has to face the head, and the head is behind the wrist —
   * which is just outside its 320 degree travel, so the midline of the face
   * comes out unreachable and the roll wraps sign every time the phone
   * crosses it. Turning the printed bracket over moves the same poses to
   * near zero, in the middle of the servo's range. It costs nothing to build
   * and it is the difference between the scan working and not.
   *
   * buildTool applies it as a rotation of its whole group; rig.ts subtracts
   * it from the roll it solves for.
   */
  bracketRoll: 0,
  /** Bracket: a printed arm from the wrist flange out to the phone's edge. */
  bracket: { thickness: 8, width: 26 },
  /** Clamp jaws that grip the phone's long edges. */
  clamp: { depth: 9, thickness: 5, length: 46 },
  /** Shroud: a truncated cone from the island out toward the skin. */
  shroud: {
    /** Starts flush with the island's outer face. */
    length: 34,
    baseRadius: 27,
    mouthRadius: 20,
    wall: 2,
  },
  /** LED ring inside the shroud, just outside the lens. */
  led: { ringRadius: 21, tubeRadius: 2.4, count: 12, diodeRadius: 1.8 },
} as const;

/** Skin point the lens is aimed at, and the outward unit normal there. */
export type ScanSample = { skin: Vec3; normal: Vec3 };

/**
 * Where the wrist-roll origin has to be for the lens to sit at its working
 * distance off this sample. Depends on the link direction d, which rig.ts
 * solves for; this is the geometric definition the solver inverts.
 */
export function rollOriginFor(sample: ScanSample, linkDir: Vec3): Vec3 {
  // Where the wrist-roll origin has to be for the tracked point to sit at its
  // working distance off this sample, given the direction the last link points.
  //
  // The tracked point sits lensAlongLink out along the link and lensFromAxis
  // across it, on the camera side. With the camera on the link axis
  // (MOUNT.axisTilt = 0) the second term is zero and this is just "back off
  // along the link", which is the whole reason that mount is easy to solve.
  const target = {
    x: sample.skin.x + sample.normal.x * MOUNT.standoff,
    y: sample.skin.y + sample.normal.y * MOUNT.standoff,
    z: sample.skin.z + sample.normal.z * MOUNT.standoff,
  };

  let ex = 0;
  let ey = 0;
  let ez = 0;
  if (MOUNT.lensFromAxis !== 0) {
    // The camera axis is -normal; its component across the link, normalised,
    // is the direction lensFromAxis is measured along.
    const ax = -sample.normal.x;
    const ay = -sample.normal.y;
    const az = -sample.normal.z;
    const along = ax * linkDir.x + ay * linkDir.y + az * linkDir.z;
    ex = ax - along * linkDir.x;
    ey = ay - along * linkDir.y;
    ez = az - along * linkDir.z;
    const len = Math.hypot(ex, ey, ez);
    if (len > 1e-9) {
      ex /= len;
      ey /= len;
      ez /= len;
    } else {
      ex = 0;
      ey = 0;
      ez = 0;
    }
  }

  return {
    x: target.x - linkDir.x * MOUNT.lensAlongLink - ex * MOUNT.lensFromAxis,
    y: target.y - linkDir.y * MOUNT.lensAlongLink - ey * MOUNT.lensFromAxis,
    z: target.z - linkDir.z * MOUNT.lensAlongLink - ez * MOUNT.lensFromAxis,
  };
}

// ============================================================== the scan

/**
 * One full loop of the coarse pass, seconds. Slow: the trajectory is
 * resampled to a constant joint-space speed, so this sets that speed
 * directly, and a scan that hurries reads as a toy rather than an instrument.
 */
export const LOOP_SECONDS = 20;

/**
 * scanPath.ts exports:
 *   scanSampleAt(t: number): ScanSample   — t in [0, 1), periodic and C1
 *   SCAN_STATIONS: ScanSample[]           — the keyframes
 * rig.ts exports:
 *   solveArm(sample: ScanSample): ArmJoints
 *   lensPose(joints: ArmJoints): { lens: Vec3; axis: Vec3 }  — for checking
 */

// ========================================================= the renderer

/**
 * The shared material set. materials.ts builds these once against the
 * renderer (it needs a PMREM environment for the metals to reflect
 * anything) and every builder pulls from it, so nothing creates a material
 * of its own and dispose() has one list to walk.
 */
export type Materials = {
  /** Matte dark table top. */
  table: THREE.Material;
  /** 3D-printed PLA: matte, with fine horizontal layer lines in the normal map. */
  printedDark: THREE.Material;
  printedLight: THREE.Material;
  printedAccent: THREE.Material;
  /** Injection-moulded servo case: slightly glossier than a print. */
  servoCase: THREE.Material;
  servoHorn: THREE.Material;
  /** Steel fasteners and the gripper's jaw plates. */
  hardware: THREE.Material;
  /** Phone: anodised aluminium rail, glass back, dark glass island, screen. */
  phoneRail: THREE.Material;
  phoneBack: THREE.Material;
  phoneIsland: THREE.Material;
  phoneScreen: THREE.Material;
  lensRing: THREE.Material;
  lensGlass: THREE.Material;
  /** Shroud: matte black inside so it does not bounce the ring light. */
  shroudOuter: THREE.Material;
  shroudInner: THREE.Material;
  led: THREE.Material;
  /** Face. */
  skin: THREE.Material;
  lips: THREE.Material;
  brow: THREE.Material;
  hair: THREE.Material;
  eyeWhite: THREE.Material;
  iris: THREE.Material;
  /** Fixture: anodised posts and soft contact pads. */
  fixtureMetal: THREE.Material;
  fixturePad: THREE.Material;
  dispose(): void;
};

/** Everything a builder hands back: one object to add, and its own teardown. */
export type Built = {
  object: THREE.Object3D;
  dispose(): void;
};

/** buildArm(materials): the arm, posable by joint angles. */
export type ArmRig = Built & {
  setJoints(joints: ArmJoints): void;
  /** The gripper's mounting face. The tool group is parented here. */
  toolMount: THREE.Object3D;
};

/** buildTool(materials): phone, bracket, shroud, ring light. */
export type ToolRig = Built & {
  /** A point light at the ring, so the skin under the shroud picks up its glow. */
  light: THREE.Light;
};

/** Reported whenever the camera settles on a new pose, as in the acne figure. */
export type ViewState = {
  /** CSS pixels per millimetre at CAMERA.target, for the scale bar. */
  cssPxPerMm: number;
  /** True at (or damped to within a hair of) the home pose. */
  atHome: boolean;
};

export type RobotSceneHandle = {
  resetView(): void;
  /** Multiply the orbit distance by f: 1/1.5 zooms in, 1.5 zooms out. */
  zoomBy(f: number): void;
};

export type RobotSceneProps = {
  className?: string;
  /** Advance the scan clock. The scene owns its own phase. */
  playing: boolean;
  /** Render at all. False when off-screen or the tab is hidden. */
  active: boolean;
  onView: (view: ViewState) => void;
};

/**
 * Camera home. The orbit target sits between the face and the arm base, and
 * the home distance frames the whole rig in the 4:3 card: at 38° FOV, 820 mm
 * shows about 565 mm of height, against a rig about 400 mm tall and 560 mm
 * deep. The angle matches the acne figure's feel — a raised three-quarter
 * view, about 20° above the table, from the head's left.
 */
export const CAMERA = {
  target: { x: 0, y: 200, z: -30 } as Vec3,
  homeDistance: 820,
  minDistance: 140,
  maxDistance: 1800,
  fovDeg: 38,
  /** Home azimuth (OrbitControls: about +Y, 0 = camera on +Z) and polar (from +Y), radians. */
  homeAzimuth: 0.78,
  homePolar: 1.24,
} as const;

/** Scale-bar candidate lengths, mm, longest first: a 1-2-5 series for this scene. */
export const SCALE_STEPS_MM = [500, 200, 100, 50, 20, 10, 5] as const;

/**
 * The palette. The arm is the reference SO-101 look: black printed shells
 * with an orange accent and black servo cases. The phone is a light
 * "lavender" iPhone 17 so it reads against the arm.
 */
export const COLORS = {
  table: 0x14161a,
  printedDark: 0x23262b,
  printedLight: 0xb9bdc4,
  printedAccent: 0xe0631a,
  servoCase: 0x101216,
  servoHorn: 0x2f3238,
  hardware: 0x8d9199,
  phoneRail: 0xcfd3dd,
  phoneBack: 0xdfe2ea,
  phoneIsland: 0x1b1d22,
  phoneScreen: 0x0b0d10,
  lensRing: 0x9aa0aa,
  lensGlass: 0x05070c,
  shroudOuter: 0x1a1c20,
  shroudInner: 0x050506,
  led: 0xfff4e2,
  skin: 0xc9977a,
  lips: 0xa86558,
  brow: 0x2b2119,
  hair: 0x2e251c,
  eyeWhite: 0xe8e6e2,
  iris: 0x4a3b2a,
  fixtureMetal: 0x3d4149,
  fixturePad: 0x191b1e,
} as const;
