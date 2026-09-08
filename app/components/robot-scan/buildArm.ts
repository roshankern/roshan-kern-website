import * as THREE from "three";
import { ARM, type ArmJoints, type ArmRig, type Materials } from "./contracts";

/**
 * The SO-101 follower arm (TheRobotStudio SO-ARM101), to scale in millimetres.
 *
 * Built the way the real one is built, because that is the only thing that
 * makes it recognisable: a Feetech STS3215 per joint, each a black moulded box
 * with its output shaft ON that joint's axis, held in printed cradles; links
 * that are two parallel printed cheeks straddling a servo with lightening
 * cut-outs between the pivots; a wide printed base with the controller board
 * hanging off the back; and the 3-pin daisy-chain cable running along the
 * outside of every link. Sizes and construction come from hardware-reference.md
 * beside this file — section numbers are cited inline.
 *
 * Five servos, not the follower's six: the gripper and its servo are not built
 * at all. A scanner does not grasp anything, so the claw comes off and the
 * wrist-roll output carries a mounting flange that buildTool bolts the phone
 * holder to. Everything past that flange belongs to buildTool.
 *
 * The kinematic chain is exactly the one in the ARM comment of contracts.ts,
 * and nothing here deviates from it: every joint origin sits where the contract
 * says, each link runs down its parent frame's local -Z, and setJoints() writes
 * five rotations and nothing else. rig.ts solves for this chain in closed form,
 * so a "small improvement" to a joint origin here silently breaks the figure.
 *
 *   base(0, 0, ARM.baseZ) → panGroup(rot.y) → lift(0, shoulderY, 0; rot.x)
 *     → elbow(0, 0, -L1; rot.x) → flex(0, 0, -L2; rot.x)
 *     → roll(0, 0, -L3; rot.z) → toolMount(0, 0, -L4)
 *
 * The real arm's URDF has a small lateral jog at each joint (28.0 mm at the
 * elbow, 5.2 at the wrist flex, 18.1 at the roll — reference §1.1); ours is the
 * idealised planar version, so those jogs live only in where the shells and the
 * servo bodies are drawn, never in a joint origin.
 *
 * One deliberate departure from the contract's prose: the ARM.servo comment
 * says the output shaft runs along the servo's *width*, but the hardware
 * reference is explicit that the horn faces are the two 45.4 × 24.8 mm faces
 * 35.0 mm apart (§3.2) and that ARM.servo.height's 39.6 is 35.0 of case plus a
 * 4.6 mm output boss (§3.1). The shaft therefore runs along ARM.servo.height
 * here, and a link's cheeks stand SERVO_CASE apart rather than one servo width.
 * No number in ARM is contradicted — only the comment's axis naming.
 */

// ------------------------------------------------------ sizes not in ARM
// Everything below is either read out of hardware-reference.md (cited) or a
// print/fit allowance that no other module can care about. Anything another
// module ends up needing belongs in contracts.ts instead.

/** Pan axis height above the table: URDF z 62.40 plus the 2.40 mm the base plate sits proud (ref §2.2). */
const PAN_AXIS_Y = 64.8;
/** Output boss standing proud of the case, mesh z 15.60 → 20.20 (ref §3.2). */
const SERVO_BOSS = 4.6;
/** Case alone, along the shaft: the Feetech spec's 35.0 mm (ref §3.1). */
const SERVO_CASE = ARM.servo.height - SERVO_BOSS;
/** The shaft sits 10.2 mm from the near end of the 45.4 mm case, i.e. 12.5 off centre (ref §3.2). */
const SERVO_AXIS_OFFSET = ARM.servo.length / 2 - 10.2;
/** Moulded top plate of the case, the step the ears hang off. */
const SERVO_CAP = 6;
/** The case narrows below that plate; this is the step per side. */
const SERVO_STEP = 1.2;
/** 25 T spline, OD 5.9 mm (ref §3.2). */
const SPLINE_RADIUS = 2.95;
/** The horn disc bolted to the spline; the cheeks take 4 M3×6 into it (ref §4). */
const HORN_RADIUS = 9;
const HORN_THICKNESS = 2.4;
/** Free-running bearing boss on the face opposite the output (ref §3.2: both faces carry a horn on the real arm; the idler reads as a boss at this scale). */
const BOSS_RADIUS = 6.5;
/** Print fit between a servo case and the printed cheek beside it. */
const FIT = 0.3;
/** A link's cheeks straddle the case: STL slices show a 33.7–36.4 mm channel (ref §4). */
const LINK_GAP = SERVO_CASE + 2 * FIT;
const LINK_HALF = LINK_GAP / 2;
/** Cheek half-width, so the rounded end round a pivot has this radius. upper_arm_so101_v1 measures 24.50 across (ref §2.4), within 0.3 mm of the servo's width. */
const CHEEK_R = ARM.servo.width / 2;
/** M3 socket head: 5.5 mm across, standing ~1.8 proud (ref §4 fasteners). */
const BOLT_RADIUS = 2.75;
const BOLT_HEIGHT = 1.8;
/** The four horn screws sit on this circle, just inside the horn's rim. */
const BOLT_CIRCLE = 6.2;
/** 3-pin TTL daisy-chain lead, ~4 × 2 mm ribbon; drawn as a round tube (ref §3.3, §4). */
const CABLE_RADIUS = 2.1;
/** Printed fillet. Everything on this arm is chamfered about this much. */
const FILLET = 4;

/** Base plate proper: base_so101_v2 is 110.92 × 72.00 × 87.00 (ref §2.4); ARM.base.depth's 96 adds the controller plate on the back. */
const BASE_PLATE_DEPTH = 87;
/** Pan axis to the FRONT edge of the base assembly: world x 38.84 → 64.6 (ref §2.1). The rest of the footprint is behind the axis, under the controller board, which is what keeps it from tipping when the arm reaches out. */
const BASE_FRONT = 25.8;
const BASE_BACK = BASE_PLATE_DEPTH - BASE_FRONT;
/** Flanged foot at the bottom of the printed base box. */
const BASE_FOOT_H = 12;
/** Waveshare bus-servo driver plate, 51 × 42 × 7.6 (ref §2.1), bolted to the back face. */
const WAVESHARE = { width: 51, height: 42, thickness: 7.6 };

/** The pan servo's case reaches 10.2 mm forward of its shaft and 35.2 mm behind it (ref §3.2), which is what decides where the base's front edge can be. */
const SERVO_NOSE = 10.2;
const SERVO_TAIL = ARM.servo.length - SERVO_NOSE;
/** Top of the printed base shell, level with the pan servo's horn: z 69.6 above the table (ref §2.1). */
const BASE_SHELL_TOP = PAN_AXIS_Y + SERVO_BOSS;
/**
 * The base is a printed SHELL, not a block: two side walls at the edge of the
 * footprint tied by a front rail and a rear block. Burying the pan servo inside
 * a solid box is what made the bottom of this arm read as a rigid post — you
 * have to be able to see the servo turning under the shoulder.
 */
const BASE_WALL = 5;
const BASE_INSET = 4;
/** base_motor_holder_so101_v1 is 31.40 across (ref §2.4): the U that grips the pan servo's two ends and carries its load into the base plate. */
const PAN_HOLDER_HALF = 15.7;

/** Shoulder bracket = rotation_pitch_so101_v1, 59.8 deep × 46.0 across (ref §2.4). Everything from here up turns with the pan servo. */
const BRACKET_HALF = 23;
const BRACKET_DEPTH = 59.8;
/**
 * The lift servo's holder, motor_holder_so101_base_v1: 28.00 across × 38.10
 * deep × 55.08 tall (ref §2.4). It grips the servo's ±Z faces and never its
 * ±X horn faces — those belong to the upper arm's fork, which bolts straight
 * to the horns — so 28 mm across is not a style choice: it is what keeps the
 * holder inside LINK_HALF and lets the fork sweep past it.
 */
const CRADLE_HALF = 14;
const HOLDER_WALL = (38.1 - ARM.servo.width) / 2;
const HOLDER_HEIGHT = 55.08;
/** The holder stands this far proud of the lift axis. More and the upper arm's spine clips it when the shoulder folds all the way back. */
const HOLDER_RISE = 12;
/** Shoulder yoke: plate bolted to the pan horn, under the holder. */
const SHOULDER_PLATE_H = 6;

/**
 * Tool flange, half-width. The gripper is gone, so the wrist-roll output ends
 * in a plate the tool bolts to; big enough to cover the horn's bolt circle with
 * a printable margin and no bigger, because everything past the roll axis is
 * lever arm on the wrist.
 */
const FLANGE_HALF = 14;

// ------------------------------------------------------------- 2D helpers

/**
 * Outline of a capsule from (a0, 0) to (a1, 0) with end radii r0 and r1, wound
 * counter-clockwise. This is the shape of every printed part on this arm: a
 * rounded end centred on each pivot, joined by the straight external tangent,
 * which is what a fork printed round two bolt circles actually looks like.
 * phi is the tangent's tilt, zero when the two ends are the same size.
 */
function capsuleOutline(path: THREE.Path, a0: number, r0: number, a1: number, r1: number): void {
  const d = a1 - a0;
  const phi = Math.asin(Math.max(-1, Math.min(1, (r0 - r1) / d)));
  path.absarc(a1, 0, r1, phi - Math.PI / 2, Math.PI / 2 - phi, false);
  path.absarc(a0, 0, r0, Math.PI / 2 - phi, 1.5 * Math.PI + phi, false);
  path.closePath();
}

/** Counter-clockwise rounded rectangle between two corners. */
function roundedRect(path: THREE.Path, x0: number, y0: number, x1: number, y1: number, r: number): void {
  const rr = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  path.moveTo(x0 + rr, y0);
  path.lineTo(x1 - rr, y0);
  path.absarc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(x1, y1 - rr);
  path.absarc(x1 - rr, y1 - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(x0 + rr, y1);
  path.absarc(x0 + rr, y1 - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(x0, y0 + rr);
  path.absarc(x0 + rr, y0 + rr, rr, Math.PI, 1.5 * Math.PI, false);
  path.closePath();
}

function rectShape(x0: number, y0: number, x1: number, y1: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  roundedRect(shape, x0, y0, x1, y1, r);
  return shape;
}

/**
 * A link cheek: the capsule above, with `cuts` lightening slots down its
 * middle. The cut-outs are not decoration — a solid plate reads as a milled
 * part, and slots are most of what makes this read as printed.
 */
function cheekShape(length: number, r0: number, r1: number, cuts: number): THREE.Shape {
  const shape = new THREE.Shape();
  capsuleOutline(shape, 0, r0, length, r1);
  const margin = Math.max(r0, r1) + 8;
  const rib = 9;
  const slot = (length - 2 * margin - rib * (cuts - 1)) / cuts;
  const hole = Math.min(r0, r1) * 0.46;
  if (cuts > 0 && slot > 2 * hole + 4) {
    for (let i = 0; i < cuts; i += 1) {
      const a0 = margin + i * (slot + rib);
      const path = new THREE.Path();
      capsuleOutline(path, a0 + hole, hole, a0 + slot - hole, hole);
      shape.holes.push(path);
    }
  }
  return shape;
}

// ------------------------------------------------------------- 3D helpers

/**
 * Shape (a, b) → link frame: a runs down the link (world -Z, away from the
 * base), b is the frame's +Y, and the extrusion depth runs along +X, across the
 * fork. Right-handed, so extruded faces keep their outward normals.
 */
const LINK_BASIS = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(1, 0, 0),
);

/** Shape (x, d) → a horizontal slab: d becomes world -Z, the extrusion rises in +Y from 0 to depth. */
const SLAB_BASIS = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

/** Shape (x, y) → the frame's own XY plane, extruded along +Z. Three.js's native layout. */
const FACE_BASIS = new THREE.Matrix4();

type ExtrudeOptions = { depth: number; basis: THREE.Matrix4; segments?: number; bevel?: number };

function extrude(shape: THREE.Shape, options: ExtrudeOptions): THREE.BufferGeometry {
  const bevel = options.bevel ?? 0;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: options.depth,
    curveSegments: options.segments ?? 8,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelOffset: 0,
    bevelSegments: 1,
  });
  geometry.applyMatrix4(options.basis);
  return geometry;
}

/**
 * Point an object so its local +Y lands on `axis` and its local +X on `along`.
 * Every servo is placed with this: local +Y is the output shaft, so "the shaft
 * is on the joint axis" becomes one call rather than an Euler puzzle.
 */
function orient(object: THREE.Object3D, along: THREE.Vector3, axis: THREE.Vector3): void {
  const third = new THREE.Vector3().crossVectors(along, axis);
  object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along, axis, third));
}

/** Any vector perpendicular to `axis`, for laying bolts out around it. */
function perpendicular(axis: THREE.Vector3): THREE.Vector3 {
  const seed = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3().crossVectors(axis, seed).normalize();
}

// ------------------------------------------------------------ the builder

export function buildArm(materials: Materials): ArmRig {
  const geometries: THREE.BufferGeometry[] = [];
  const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  // ---- geometry shared by every servo and every bolt in the figure. Six
  // servos and forty-odd screws off one set of buffers: the arm is one of four
  // builders in a scene that has to stay interactive.
  const servoGeo = {
    cap: track(new THREE.BoxGeometry(ARM.servo.length, SERVO_CAP, ARM.servo.width)),
    case: track(
      new THREE.BoxGeometry(ARM.servo.length, SERVO_CASE - SERVO_CAP, ARM.servo.width - 2 * SERVO_STEP),
    ),
    ear: track(new THREE.BoxGeometry(ARM.servo.length * 0.52, 2.4, 3)),
    horn: track(new THREE.CylinderGeometry(HORN_RADIUS, HORN_RADIUS, HORN_THICKNESS, 16)),
    spline: track(new THREE.CylinderGeometry(SPLINE_RADIUS, SPLINE_RADIUS, SERVO_BOSS, 10)),
    boss: track(new THREE.CylinderGeometry(BOSS_RADIUS, BOSS_RADIUS, 1.8, 12)),
  };
  const boltGeo = track(new THREE.CylinderGeometry(BOLT_RADIUS, BOLT_RADIUS, BOLT_HEIGHT, 8));

  /**
   * One STS3215. Local frame: +Y is the output shaft, the origin sits on the
   * horn face (so the case hangs in -Y and the boss stands in +Y), +X runs down
   * the 45.4 mm case with the shaft 10.2 mm from the +X end (ref §3.2).
   * Callers place it with orient() and one offset along the axis.
   */
  function makeServo(): THREE.Group {
    const group = new THREE.Group();
    const x = -SERVO_AXIS_OFFSET;

    const cap = new THREE.Mesh(servoGeo.cap, materials.servoCase);
    cap.position.set(x, -SERVO_CAP / 2, 0);
    const body = new THREE.Mesh(servoGeo.case, materials.servoCase);
    body.position.set(x, -SERVO_CAP - (SERVO_CASE - SERVO_CAP) / 2, 0);
    group.add(cap, body);

    for (const side of [1, -1]) {
      const ear = new THREE.Mesh(servoGeo.ear, materials.servoCase);
      ear.position.set(x, -SERVO_CAP - 1.2, side * (ARM.servo.width / 2 + 1.5));
      group.add(ear);
    }

    const spline = new THREE.Mesh(servoGeo.spline, materials.servoHorn);
    spline.position.y = SERVO_BOSS / 2;
    const horn = new THREE.Mesh(servoGeo.horn, materials.servoHorn);
    horn.position.y = 1 + HORN_THICKNESS / 2;
    const boss = new THREE.Mesh(servoGeo.boss, materials.servoCase);
    boss.position.y = -SERVO_CASE - 0.9;
    group.add(spline, horn, boss);

    return group;
  }

  /**
   * A servo on a joint axis. `axis` is the joint's rotation axis in `parent`'s
   * frame and `along` the direction the case body runs; `offset` slides the
   * servo along its own axis, and is SERVO_CASE / 2 wherever a fork straddles
   * it symmetrically and 0 where the horn face IS the joint plane.
   */
  function placeServo(
    parent: THREE.Object3D,
    at: THREE.Vector3,
    axis: THREE.Vector3,
    along: THREE.Vector3,
    offset: number,
  ): THREE.Group {
    const servo = makeServo();
    orient(servo, along, axis);
    servo.position.copy(at).addScaledVector(axis, offset);
    parent.add(servo);
    return servo;
  }

  /** Four M3 heads on a horn's bolt circle: the pattern the eye reads as "printed part screwed to a servo". */
  function boltRing(parent: THREE.Object3D, at: THREE.Vector3, axis: THREE.Vector3, phase = 0): void {
    const u = perpendicular(axis);
    const v = new THREE.Vector3().crossVectors(axis, u);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    for (let i = 0; i < 4; i += 1) {
      const angle = phase + (i * Math.PI) / 2;
      const bolt = new THREE.Mesh(boltGeo, materials.hardware);
      bolt.quaternion.copy(quaternion);
      bolt.position
        .copy(at)
        .addScaledVector(u, BOLT_CIRCLE * Math.cos(angle))
        .addScaledVector(v, BOLT_CIRCLE * Math.sin(angle));
      parent.add(bolt);
    }
  }

  /**
   * The two cheeks of a link, from one extruded profile. They sit either side
   * of the servo channel, so the same buffer is drawn twice at ±LINK_HALF.
   */
  function addCheeks(parent: THREE.Object3D, shape: THREE.Shape, material: THREE.Material): void {
    const geometry = track(
      extrude(shape, { depth: ARM.shellThickness, basis: LINK_BASIS, segments: 8, bevel: 0.4 }),
    );
    const right = new THREE.Mesh(geometry, material);
    right.position.x = LINK_HALF;
    const left = new THREE.Mesh(geometry, material);
    left.position.x = -LINK_HALF - ARM.shellThickness;
    parent.add(right, left);
  }

  /** The spine that bridges the two cheeks, down the back of the fork. */
  function addSpine(parent: THREE.Object3D, a0: number, a1: number, b: number): void {
    const geometry = track(
      new THREE.BoxGeometry(LINK_GAP + 2 * ARM.shellThickness, ARM.shellThickness, a1 - a0),
    );
    const spine = new THREE.Mesh(geometry, materials.printedDark);
    spine.position.set(0, b, -(a0 + a1) / 2);
    parent.add(spine);
  }

  /**
   * The daisy-chain lead down a link, in that link's own frame so it poses with
   * the arm. Static: the real cable is cable-tied to the shell and does not
   * flap. Two accent clips hold it, which is exactly what the printed parts do.
   */
  function addCable(parent: THREE.Object3D, points: THREE.Vector3[], clips: number[] = []): void {
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = track(new THREE.TubeGeometry(curve, 22, CABLE_RADIUS, 6, false));
    parent.add(new THREE.Mesh(geometry, materials.servoCase));
    for (const t of clips) {
      const at = curve.getPoint(t);
      const clip = new THREE.Mesh(
        track(new THREE.BoxGeometry(3, CABLE_RADIUS * 3.4, CABLE_RADIUS * 3.4)),
        materials.printedAccent,
      );
      clip.position.copy(at);
      parent.add(clip);
    }
  }

  // =================================================================== base
  // World (0, 0, ARM.baseZ), sitting straight on the table — the real arm bolts
  // to whatever surface it works on and starts bending 119 mm up, so there is
  // nothing between the tabletop and the pan servo but the base plate.
  //
  // Bottom to top: flanged foot plate, printed shell (two side walls, a front
  // rail, a rear block), the base motor holder gripping the pan servo's two
  // ends, and the pan servo itself lying horizontal with its shaft up. The
  // controller board hangs off the back, away from the reach direction, which
  // is where the real one puts it (ref §2.1, §4).

  const base = new THREE.Group();
  base.position.set(0, 0, ARM.baseZ);

  {
    // Foot flange: the full 111 × 87 footprint, with four bolt slots.
    const foot = rectShape(
      -ARM.base.width / 2,
      -BASE_PLATE_DEPTH / 2,
      ARM.base.width / 2,
      BASE_PLATE_DEPTH / 2,
      8,
    );
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const cx = sx * (ARM.base.width / 2 - 12);
        const cy = sy * (BASE_PLATE_DEPTH / 2 - 11);
        // A slotted bolt hole rather than a round one, the way the printed
        // base gives itself a few millimetres of adjustment on the table.
        const path = new THREE.Path();
        path.absarc(cx + 5, cy, 3.2, -Math.PI / 2, Math.PI / 2, false);
        path.absarc(cx - 5, cy, 3.2, Math.PI / 2, 1.5 * Math.PI, false);
        path.closePath();
        foot.holes.push(path);
      }
    }
    const footMesh = new THREE.Mesh(
      track(extrude(foot, { depth: BASE_FOOT_H, basis: SLAB_BASIS, segments: 6 })),
      materials.printedDark,
    );
    // SLAB_BASIS sends the shape's second axis to world -Z; the footprint is
    // symmetric about it, so only the plate's centre has to be placed: the
    // assembly runs from BASE_FRONT ahead of the pan axis to BASE_BACK behind.
    footMesh.position.z = BASE_PLATE_DEPTH / 2 - BASE_FRONT;
    base.add(footMesh);

    // Side walls, drawn as a profile in the ZY plane so the lightening window
    // lands on the wide ±X faces the camera sees. Two thin walls rather than one
    // solid block: a window in a 99 mm block is a tunnel, and from the figure's
    // three-quarter view you would see the tunnel and not the servo.
    const side = rectShape(
      -BASE_BACK + BASE_INSET,
      BASE_FOOT_H - 1,
      BASE_FRONT - BASE_INSET,
      BASE_SHELL_TOP,
      FILLET,
    );
    const cutout = new THREE.Path();
    // The shape's first axis runs to world -Z, so the window is framed on the
    // servo: its case spans SERVO_TAIL behind the axis and SERVO_NOSE in front.
    roundedRect(cutout, -SERVO_TAIL + 2, BASE_FOOT_H + 8, SERVO_NOSE + 6, BASE_SHELL_TOP - 10, 6);
    side.holes.push(cutout);
    const wallGeo = track(
      extrude(side, { depth: BASE_WALL, basis: LINK_BASIS, segments: 6, bevel: 0.4 }),
    );
    const wallX = ARM.base.width / 2 - BASE_INSET;
    for (const x of [wallX - BASE_WALL, -wallX]) {
      const mesh = new THREE.Mesh(wallGeo, materials.printedDark);
      mesh.position.x = x;
      base.add(mesh);
    }

    // Front rail and top brace tying the two walls together, clear of the servo.
    const span = 2 * wallX;
    const railZ = -(BASE_FRONT - BASE_INSET - 4);
    const railGeo = track(new THREE.BoxGeometry(span, 14, 8));
    const rail = new THREE.Mesh(railGeo, materials.printedDark);
    rail.position.set(0, BASE_FOOT_H + 6, railZ);
    const brace = new THREE.Mesh(track(new THREE.BoxGeometry(span, 6, 8)), materials.printedDark);
    brace.position.set(0, BASE_SHELL_TOP - 5, railZ);
    base.add(rail, brace);

    // Accent strip across the front, the one bright line on the base.
    const strip = new THREE.Mesh(track(new THREE.BoxGeometry(span - 16, 5, 2)), materials.printedAccent);
    strip.position.set(0, BASE_FOOT_H + 6, -(BASE_FRONT - BASE_INSET) - 1);
    base.add(strip);

    // Rear block: the shell's closed end, and what the controller board bolts to.
    const rearDepth = 17;
    const rear = new THREE.Mesh(
      track(new THREE.BoxGeometry(span, BASE_SHELL_TOP - BASE_FOOT_H + 1, rearDepth)),
      materials.printedDark,
    );
    rear.position.set(0, (BASE_FOOT_H - 1 + BASE_SHELL_TOP) / 2, BASE_BACK - rearDepth / 2);
    base.add(rear);

    // base_motor_holder_so101_v1 (ref §2.4, §4): a U that takes the pan servo by
    // its two ends and leaves both 45.4 × 35.0 faces open to the camera. This is
    // the printed part directly under the pan joint, and seeing it stand still
    // while the bracket above it swings is what makes the pan legible.
    const holderGeo = track(new THREE.BoxGeometry(2 * PAN_HOLDER_HALF, BASE_SHELL_TOP - BASE_FOOT_H + 1, 4));
    for (const z of [-(SERVO_NOSE + FIT + 2), SERVO_TAIL + FIT + 2]) {
      const mesh = new THREE.Mesh(holderGeo, materials.printedDark);
      mesh.position.set(0, (BASE_FOOT_H - 1 + BASE_SHELL_TOP) / 2, z);
      base.add(mesh);
    }
    const cradle = new THREE.Mesh(
      track(new THREE.BoxGeometry(2 * PAN_HOLDER_HALF, 4, ARM.servo.length + 2 * FIT)),
      materials.printedDark,
    );
    cradle.position.set(0, PAN_AXIS_Y - SERVO_CASE - 2, (SERVO_TAIL - SERVO_NOSE) / 2);
    base.add(cradle);

    // Pan servo: horizontal in the holder, shaft up on the pan axis, case
    // running BACK from it — the shaft sits 10.2 mm from the case's front end
    // (ref §3.2), which is why the base only needs 25.8 mm of footprint ahead
    // of the axis and the rest hangs behind, under the board.
    placeServo(
      base,
      new THREE.Vector3(0, PAN_AXIS_Y, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, -1),
      0,
    );

    // Waveshare driver plate and board on the rear block's back face.
    const plate = new THREE.Mesh(
      track(
        extrude(rectShape(-WAVESHARE.width / 2, 0, WAVESHARE.width / 2, WAVESHARE.height, FILLET), {
          depth: WAVESHARE.thickness,
          basis: FACE_BASIS,
          segments: 6,
        }),
      ),
      materials.printedDark,
    );
    // Set 2 mm into the rear block, so plate, board and header together land
    // inside ARM.base.depth rather than hanging past it.
    const plateZ = BASE_BACK - 2;
    plate.position.set(0, BASE_FOOT_H + 2, plateZ);
    base.add(plate);

    const board = new THREE.Mesh(
      track(new THREE.BoxGeometry(WAVESHARE.width - 8, WAVESHARE.height - 8, 1.6)),
      materials.servoCase,
    );
    board.position.set(0, BASE_FOOT_H + 2 + WAVESHARE.height / 2, plateZ + WAVESHARE.thickness + 0.8);
    const header = new THREE.Mesh(
      track(new THREE.BoxGeometry(WAVESHARE.width - 22, 5, 4)),
      materials.hardware,
    );
    header.position.set(0, BASE_FOOT_H + 8, plateZ + WAVESHARE.thickness + 2.6);
    base.add(board, header);
  }

  // ================================================================ pan
  const panGroup = new THREE.Group();
  base.add(panGroup);

  {
    // The shoulder, in two printed parts and one servo, exactly as the real arm
    // stacks them: rotation_pitch_so101_v1 bolted to the pan horn, then
    // motor_holder_so101_base_v1 standing on it, then the lift servo lying in
    // that holder with its shaft horizontal at ARM.shoulderY (ref §2.4, §4).
    // Because shoulderY is the URDF's 119 mm, that whole stack is only about
    // 50 mm tall, which is what the base of this arm actually looks like.
    const hornFace = PAN_AXIS_Y + SERVO_BOSS;
    const plateTop = hornFace + SHOULDER_PLATE_H;
    const holderTop = ARM.shoulderY + HOLDER_RISE;
    const holderBottom = holderTop - HOLDER_HEIGHT;

    // Bracket plate on the pan horn. Its 46 × 59.8 footprint overhangs the
    // holder above it on every side, so the pan angle is readable from the
    // plate's own corners rather than only from where the arm is pointing.
    const plate = new THREE.Mesh(
      track(
        extrude(rectShape(-BRACKET_HALF, -BRACKET_DEPTH / 2, BRACKET_HALF, BRACKET_DEPTH / 2, FILLET), {
          depth: SHOULDER_PLATE_H,
          basis: SLAB_BASIS,
          segments: 6,
        }),
      ),
      materials.printedDark,
    );
    plate.position.y = hornFace;
    panGroup.add(plate);
    boltRing(panGroup, new THREE.Vector3(0, plateTop - 0.4, 0), new THREE.Vector3(0, 1, 0), Math.PI / 4);

    // The bracket's two cheeks, 46 mm outside to outside. They rise only BEHIND
    // the shoulder axis: forward of it the upper arm's fork sweeps the same ±X
    // band, because the fork bolts straight onto the lift servo's horns and so
    // owns that band outright.
    const earTop = plateTop + Math.min(25, Math.max(8, ARM.shoulderY - 19 - plateTop));
    const ear = new THREE.Shape();
    ear.moveTo(-BRACKET_DEPTH / 2, plateTop);
    ear.lineTo(0, plateTop);
    ear.lineTo(-8, earTop);
    ear.lineTo(-BRACKET_DEPTH / 2, earTop);
    ear.closePath();
    const earGeo = track(
      extrude(ear, { depth: ARM.shellThickness, basis: LINK_BASIS, segments: 4, bevel: 0.4 }),
    );
    for (const x of [BRACKET_HALF - ARM.shellThickness, -BRACKET_HALF]) {
      const mesh = new THREE.Mesh(earGeo, materials.printedDark);
      mesh.position.x = x;
      panGroup.add(mesh);
    }

    // A shoulder at the URDF's 119 mm lands the holder straight on the bracket
    // plate. This column only exists if something raises the shoulder above it.
    if (holderBottom > plateTop + 2) {
      const column = new THREE.Mesh(
        track(new THREE.BoxGeometry(2 * CRADLE_HALF, holderBottom - plateTop + 2, BRACKET_DEPTH * 0.6)),
        materials.printedDark,
      );
      column.position.y = (plateTop + holderBottom) / 2;
      panGroup.add(column);
    }

    // The holder: two walls on the lift servo's ±Z faces, closed underneath.
    // They stay inside CRADLE_HALF in X so the upper arm's cheeks sweep past
    // them, and leave ±X clear for the horns — which is the whole point.
    const wallGeo = track(new THREE.BoxGeometry(2 * CRADLE_HALF, holderTop - holderBottom, HOLDER_WALL));
    for (const sign of [1, -1]) {
      const mesh = new THREE.Mesh(wallGeo, materials.printedDark);
      mesh.position.set(0, (holderBottom + holderTop) / 2, sign * (ARM.servo.width / 2 + FIT + HOLDER_WALL / 2));
      panGroup.add(mesh);
    }
    const floor = new THREE.Mesh(
      track(
        new THREE.BoxGeometry(
          2 * CRADLE_HALF,
          ARM.shellThickness,
          ARM.servo.width + 2 * (FIT + HOLDER_WALL),
        ),
      ),
      materials.printedDark,
    );
    floor.position.set(0, holderBottom + ARM.shellThickness / 2, 0);
    panGroup.add(floor);

    // Lift servo: shaft on the lift axis (+X), case hanging DOWN from it into
    // the holder — the shaft sits 10.2 mm from the case's top end, so the body
    // occupies the 35.2 mm below ARM.shoulderY and leaves the space above it to
    // the upper arm. Centred on the axis, because the fork straddles it.
    placeServo(
      panGroup,
      new THREE.Vector3(0, ARM.shoulderY, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      SERVO_CASE / 2,
    );

    // Base → shoulder lead. It crosses the pan joint, so it is drawn in the pan
    // frame; it runs outside BRACKET_HALF, clear of the fork's ±X band, and
    // stops short of ARM.shoulderY — the fork sweeps to within CHEEK_R of the
    // lift axis, so anything within that radius gets clipped when the shoulder
    // folds all the way back.
    addCable(
      panGroup,
      [
        new THREE.Vector3(8, PAN_AXIS_Y + 4, 20),
        new THREE.Vector3(BRACKET_HALF + 3, plateTop + 6, 26),
        new THREE.Vector3(BRACKET_HALF + 3, ARM.shoulderY - 24, 25),
        new THREE.Vector3(15, ARM.shoulderY - CHEEK_R - 4, 23),
      ],
      [0.55],
    );
  }

  // ================================================================ lift
  // The upper arm. Cheeks from the lift pivot to the elbow pivot; with a
  // rounded end of CHEEK_R at each, the printed part measures L1 + 2·CHEEK_R =
  // 140.8 mm, against upper_arm_so101_v1's 142.17 (ref §2.4).
  const lift = new THREE.Group();
  lift.position.set(0, ARM.shoulderY, 0);
  panGroup.add(lift);

  {
    addCheeks(lift, cheekShape(ARM.L1, CHEEK_R, CHEEK_R, 2), materials.printedDark);
    addSpine(lift, 20, ARM.L1 - 18, -(CHEEK_R - ARM.shellThickness / 2));
    boltRing(lift, new THREE.Vector3(LINK_HALF + ARM.shellThickness, 0, 0), new THREE.Vector3(1, 0, 0));
    boltRing(lift, new THREE.Vector3(-LINK_HALF - ARM.shellThickness, 0, 0), new THREE.Vector3(-1, 0, 0));

    // Elbow servo: shaft on the elbow axis, case running back up the arm so it
    // lies inside the fork.
    placeServo(
      lift,
      new THREE.Vector3(0, 0, -ARM.L1),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      SERVO_CASE / 2,
    );

    addCable(
      lift,
      [
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - 1, -6, -6),
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - CABLE_RADIUS, -CHEEK_R - 1, -ARM.L1 * 0.4),
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - CABLE_RADIUS, -CHEEK_R - 1, -ARM.L1 * 0.72),
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - 1, -8, -ARM.L1 + 4),
      ],
      [0.35, 0.7],
    );
  }

  // =============================================================== elbow
  // The forearm. L2 + 2·CHEEK_R = 159.8 mm printed length, against the
  // lower_arm_link's 157.1 mm bounding box (ref §2.3).
  const elbow = new THREE.Group();
  elbow.position.set(0, 0, -ARM.L1);
  lift.add(elbow);

  {
    addCheeks(elbow, cheekShape(ARM.L2, CHEEK_R, CHEEK_R, 2), materials.printedDark);
    addSpine(elbow, 22, ARM.L2 - 20, -(CHEEK_R - ARM.shellThickness / 2));
    boltRing(elbow, new THREE.Vector3(LINK_HALF + ARM.shellThickness, 0, 0), new THREE.Vector3(1, 0, 0));
    boltRing(elbow, new THREE.Vector3(-LINK_HALF - ARM.shellThickness, 0, 0), new THREE.Vector3(-1, 0, 0));

    // Wrist-flex servo, in its holder at the far end of the forearm.
    placeServo(
      elbow,
      new THREE.Vector3(0, 0, -ARM.L2),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      SERVO_CASE / 2,
    );

    addCable(
      elbow,
      [
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - 1, -6, -6),
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - CABLE_RADIUS, -CHEEK_R - 1, -ARM.L2 * 0.38),
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - CABLE_RADIUS, -CHEEK_R - 1, -ARM.L2 * 0.74),
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - 1, -8, -ARM.L2 + 4),
      ],
      [0.34, 0.68],
    );
  }

  // ================================================================ flex
  // The wrist: wrist_roll_pitch_so101_v2, 62.3 × 35.7 × 77.8 (ref §2.4). Short
  // cheeks off the flex pivot, then a housing that wraps the roll servo — which
  // has to hang perpendicular to the roll axis, because its own case is 45.4 mm
  // long and the roll axis runs straight down the link.
  const flex = new THREE.Group();
  flex.position.set(0, 0, -ARM.L2);
  elbow.add(flex);

  {
    addCheeks(flex, cheekShape(ARM.L3, CHEEK_R, CHEEK_R * 1.35, 1), materials.printedDark);
    boltRing(flex, new THREE.Vector3(LINK_HALF + ARM.shellThickness, 0, 0), new THREE.Vector3(1, 0, 0));
    boltRing(flex, new THREE.Vector3(-LINK_HALF - ARM.shellThickness, 0, 0), new THREE.Vector3(-1, 0, 0));

    // Housing plates either side of the roll servo, continuing the cheeks down
    // over it, plus a floor closing the U.
    const housing = rectShape(ARM.L3 - 30, -(ARM.servo.length - 10.2 + 4), ARM.L3 + 13, 12, FILLET);
    const housingGeo = track(
      extrude(housing, { depth: ARM.shellThickness, basis: LINK_BASIS, segments: 6, bevel: 0.4 }),
    );
    for (const x of [LINK_HALF, -LINK_HALF - ARM.shellThickness]) {
      const mesh = new THREE.Mesh(housingGeo, materials.printedDark);
      mesh.position.x = x;
      flex.add(mesh);
    }
    const floor = new THREE.Mesh(
      track(new THREE.BoxGeometry(LINK_GAP + 2 * ARM.shellThickness, ARM.shellThickness, 40)),
      materials.printedDark,
    );
    floor.position.set(0, -(ARM.servo.length - 10.2 + 4) + ARM.shellThickness / 2, -(ARM.L3 - 8));
    flex.add(floor);
    // Accent collar round the roll axis, the arm's one orange landmark near the tool.
    const collar = new THREE.Mesh(
      track(new THREE.TorusGeometry(HORN_RADIUS + 4, 1.8, 6, 20)),
      materials.printedAccent,
    );
    collar.position.z = -ARM.L3 + 1;
    flex.add(collar);

    // Roll servo: shaft ON the roll axis, pointing down the link so its horn
    // face IS the roll joint plane and the tool flange bolts straight to it.
    placeServo(
      flex,
      new THREE.Vector3(0, 0, -ARM.L3),
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, -1, 0),
      0,
    );

    addCable(
      flex,
      [
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - 1, -6, -4),
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - CABLE_RADIUS, -18, -ARM.L3 * 0.6),
        new THREE.Vector3(-LINK_HALF - ARM.shellThickness - 1, -26, -ARM.L3 + 2),
      ],
      [0.5],
    );
  }

  // ================================================================ roll
  // The end of the arm. There is no gripper: a scanner does not grasp anything,
  // so the stock claw and its servo come off and the wrist-roll output carries a
  // plain mounting flange instead. That is why ARM.L4 is 6 mm of flange rather
  // than the follower's 98.5 mm of jaw — see the ARM.L4 comment in contracts.ts.
  // buildTool bolts the phone holder, shroud and ring light straight to this.
  const roll = new THREE.Group();
  roll.position.set(0, 0, -ARM.L3);
  flex.add(roll);

  {
    // The flange: one printed plate, the full ARM.L4 from the joint plane out to
    // the mounting face. It is that thick because the roll servo's output boss
    // and horn stand 4.6 mm proud of the joint plane (ref §3.2) and the plate
    // counterbores over them — which is why ARM.L4 is 6 and not 3.
    const flange = new THREE.Mesh(
      track(
        extrude(rectShape(-FLANGE_HALF, -FLANGE_HALF, FLANGE_HALF, FLANGE_HALF, FLANGE_HALF * 0.45), {
          depth: ARM.L4,
          basis: FACE_BASIS,
          segments: 10,
        }),
      ),
      materials.printedDark,
    );
    flange.position.z = -ARM.L4;
    roll.add(flange);

    // The four M3s into the roll horn, flush in the mounting face so buildTool's
    // bracket can sit flat on it.
    boltRing(roll, new THREE.Vector3(0, 0, -ARM.L4 + BOLT_HEIGHT / 2), new THREE.Vector3(0, 0, -1), Math.PI / 4);

    // No cable past here: the roll servo is the last one on the bus, and the
    // lead into it is drawn in the flex frame with the servo it feeds. The whole
    // -Y side of this frame belongs to buildTool's bracket (see MOUNT), so
    // nothing of the arm's may be drawn into it.
  }

  /**
   * The tool mounting face. No rotation of its own, ever: buildTool expresses
   * the phone's whole layout directly in the roll frame's axes and rig.ts
   * inverts that expression, so a tidy-looking rotation here would silently aim
   * the camera somewhere else.
   */
  const toolMount = new THREE.Object3D();
  toolMount.position.set(0, 0, -ARM.L4);
  roll.add(toolMount);

  return {
    object: base,
    toolMount,
    setJoints(joints: ArmJoints) {
      panGroup.rotation.y = joints.pan;
      lift.rotation.x = joints.lift;
      elbow.rotation.x = joints.elbow;
      flex.rotation.x = joints.flex;
      roll.rotation.z = joints.roll;
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      geometries.length = 0;
    },
  };
}
