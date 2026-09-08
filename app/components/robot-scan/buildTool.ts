import * as THREE from "three";
import { ARM, MOUNT, PHONE, type Materials, type ToolRig } from "./contracts";

/**
 * The imaging head: an iPhone 17 in a printed bracket, with a light shroud and
 * a ring light around its rear camera.
 *
 * Everything here is laid out in the **wrist-roll frame** and nothing outside
 * transforms it — RobotScene parents this group to the gripper's mounting face
 * and leaves it alone — so the millimetres below are the ones rig.ts inverts.
 * The single hard constraint is MOUNT's: the scanning lens's glass centre sits
 * at (0, -MOUNT.lensFromAxis, -MOUNT.lensAlongLink), on the local -Y line
 * through the origin, because that line *is* the camera axis.
 *
 * Two frames are in play and it is worth keeping them apart:
 *   - the **phone frame**, PHONE's own (+X the 149.6 long axis, +Y the 71.5
 *     short axis, +Z out of the screen). Every phone part is authored here,
 *     because that is the frame PHONE's numbers are quoted in.
 *   - the **tool frame**, the wrist-roll frame everything is finally measured
 *     in. PHONE_BASIS below is the one place the two meet.
 */

// ---------------------------------------------------------------- the chain
//
// Two frames are in play and they meet here.
//
// The **holder frame** is the phone's own seat: its origin is the phone's
// geometric CENTRE, its -Z is where the camera looks, and the phone lies
// landscape across it. Everything that is rigid with the phone — the body, the
// island, the shroud, the clamp jaws — is authored in this frame.
//
// The **tool frame** is the wrist-roll frame, the one MOUNT and rig.ts speak
// in: -Z runs down the last link away from the arm, and the gripper's mounting
// face is at (0, 0, -ARM.L4).
//
// The holder sits in the tool frame at (0, -lensFromAxis, -lensAlongLink),
// canted back by axisTilt about its own origin. Two things follow, and both are
// the point of the arrangement:
//
//   - with lensFromAxis at zero the phone's centre lands ON the roll axis, so
//     the bracket holds the phone in the middle of its back and the roll servo
//     turns the camera without translating it at all. rig.ts tracks that centre.
//   - the cant is about the phone's CENTRE, not about the roll origin, so
//     canting it further moves where the camera looks without moving where the
//     phone is. Rotating the whole layout about the roll origin — which is what
//     this file used to do — swings the tracked point out with the axis, and
//     left rig.ts aiming at a point 18 mm from the one that is built.
//
// PHONE_BASIS maps phone -> holder: +X long -> -X, +Y short -> -Y, +Z (out of
// the screen) -> +Z. The last column is what matters: the screen faces the arm
// and the camera on the back faces the skin, straight down -Z. The first is a
// free choice of which way round the phone is clamped, and this one puts the
// camera island on the holder's +X side.
//
// The scanning lens is therefore NOT on the axis, and is not meant to be: it
// lands at holder (58, -8.5, -7.575), which is the island in the corner of a
// phone held in the middle. The shroud and the ring light go there, not on the
// axis. See rig.ts for what that costs.

/**
 * Phone -> holder, spelled as a basis rather than as Euler angles: the three
 * columns are literally "where each phone axis points in the holder frame",
 * which is the only form of this rotation anybody can check by eye.
 */
const PHONE_BASIS = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(-1, 0, 0), // phone +X (long)   -> holder -X
  new THREE.Vector3(0, -1, 0), // phone +Y (short)  -> holder -Y
  new THREE.Vector3(0, 0, 1), // phone +Z (screen) -> holder +Z
);

const HALF = { x: PHONE.body.x / 2, y: PHONE.body.y / 2, z: PHONE.body.z / 2 };

/** Phone-local Z of the back face and of the island's outer (lens) face. */
const BACK_PZ = -HALF.z;
const ISLAND_FACE_PZ = BACK_PZ - PHONE.island.z;

const LENS_PX = PHONE.islandCentre.x - PHONE.lens.spacing / 2;
const SECOND_LENS_PX = PHONE.islandCentre.x + PHONE.lens.spacing / 2;
/**
 * Both lenses sit on the island's short-axis centreline rather than on its
 * diagonal, so the pair runs along the phone's long axis.
 */
const LENS_PY = PHONE.islandCentre.y;

/** The scanning lens glass, in the holder frame: PHONE_BASIS applied to it. */
const LENS_HOLDER = new THREE.Vector3(-LENS_PX, -LENS_PY, ISLAND_FACE_PZ);

/**
 * The ring's outer rim runs right out to the island's edge — 44/2 - 24/2 = 10 —
 * so it is clamped there rather than allowed to float half a millimetre past it.
 */
const LENS_RING_RADIUS = Math.min(
  PHONE.lens.radius,
  PHONE.island.x / 2 - PHONE.lens.spacing / 2,
);
/** How far the machined rim stands over the glass, which sits in the island's face. */
const LENS_RIM_HEIGHT = 1.9;

/**
 * The clamp, in the holder frame. Two C-channel jaws swallow the phone's LONG
 * edges — the 149.6 mm ones, at holder y = +/- HALF.y — in the middle of their
 * run, so the phone is gripped about its centre rather than hung off one end.
 * The screen-side pad reaches MOUNT.clamp.depth in, which it can afford because
 * the bracket is on the screen side now; the pad on the camera side is only as
 * deep as the bezel, so it lands on the phone's edge chamfer and stays well
 * clear of the island.
 */
const JAW_Y = HALF.y;
const JAW_PAD_IN = JAW_Y - MOUNT.clamp.depth;
const JAW_LIP_IN = JAW_Y - PHONE.bezel;
const JAW_OUT = JAW_Y + MOUNT.clamp.thickness;
const JAW_FRONT_Z = HALF.z + MOUNT.clamp.thickness; // outside the screen side
const JAW_BACK_Z = -HALF.z - MOUNT.clamp.thickness; // outside the camera side

/**
 * The mounting pad's half-height, along the phone's short axis. It runs out to
 * meet the jaws' inner ends with a hair of overlap, so the printed part reads as
 * one piece from the flange to both clamps rather than as three glued together.
 */
const PAD_HALF = JAW_PAD_IN + 1;

/** Curve resolution for the rounded rectangles. Six per quadrant is plenty at 11 mm. */
const CORNER_SEGMENTS = 6;

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw, hh);
  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hh - r);
  shape.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-hw + r, hh);
  shape.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hh + r);
  shape.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

/**
 * ExtrudeGeometry's UV generator writes millimetres, not 0–1. materials.ts sets
 * every printed material's normalMap repeat for a ~90 mm part with box UVs, so
 * an unremapped extrusion would tile the layer lines a dozen times per
 * millimetre and turn to aliased grey. Rescaling each axis to 0–1 puts an
 * extruded printed part on the same footing as a boxed one.
 */
function fitUv(geometry: THREE.BufferGeometry): void {
  const uv = geometry.getAttribute("uv");
  if (!uv) return;
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < uv.count; i += 1) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  const du = maxU - minU || 1;
  const dv = maxV - minV || 1;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, (uv.getX(i) - minU) / du, (uv.getY(i) - minV) / dv);
  }
  uv.needsUpdate = true;
}

/**
 * A straight planar unwrap in the geometry's own XY, so the screen's landscape
 * canvas lands on the screen the way it was drawn: u along the phone's long
 * axis, v along its short one. The 0.6 mm side walls pick up the texture's
 * border, which is the UI's black surround, so they read as the panel's edge.
 */
function planarUv(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return;
  const position = geometry.getAttribute("position");
  const w = box.max.x - box.min.x || 1;
  const h = box.max.y - box.min.y || 1;
  const uvs = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    uvs[i * 2] = (position.getX(i) - box.min.x) / w;
    uvs[i * 2 + 1] = (position.getY(i) - box.min.y) / h;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
}

export function buildTool(materials: Materials): ToolRig {
  const geometries: THREE.BufferGeometry[] = [];
  const own = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  const group = new THREE.Group();
  group.name = "tool";
  // The tool frame's ONLY rotation is the bracket's clocking about the roll
  // axis. Everything else is a placement, not a turn of the whole assembly —
  // see the chain comment: the cant lives on the holder, about the phone's own
  // centre, so that canting the phone changes where the camera looks without
  // changing where the phone is. rig.ts subtracts this same clocking from the
  // roll it solves for, so the two stay in step; see MOUNT.bracketRoll for why
  // the angle it is set to decides whether the roll servo can reach the sweep
  // at all.
  group.rotation.z = MOUNT.bracketRoll;

  // ============================================================== the holder
  //
  // The phone's seat. Its origin is the phone's centre — the point rig.ts
  // positions against the face — and the cant is about that origin, so the
  // origin stays on the roll axis whatever axisTilt is set to.
  const holder = new THREE.Group();
  holder.name = "holder";
  holder.position.set(0, -MOUNT.lensFromAxis, -MOUNT.lensAlongLink);
  // rotation.x = -tilt sends holder -Z, the camera's direction, to
  // (0, -sin tilt, -cos tilt): leaning off the link toward the arm's underside
  // by exactly the angle rig.ts inverts. The sign is forced — the other way
  // leans the camera up over the top of the wrist, away from a seated face.
  holder.rotation.x = -MOUNT.axisTilt;
  group.add(holder);

  // ============================================================== the phone
  const phone = new THREE.Group();
  phone.name = "phone";
  phone.quaternion.setFromRotationMatrix(PHONE_BASIS);
  holder.add(phone);

  // ---- body. The 0.5 mm bevel is the rail's chamfer: an iPhone's band is flat
  // with a broken edge, and a bevelled extrusion gives that for free while also
  // keeping the front and back faces clear of the plates that cover them.
  // ExtrudeGeometry grows the bevel *outward* from the shape and *beyond* the
  // depth, so the shape is inset by the bevel on all three axes to land the
  // finished body on PHONE.body exactly.
  const BEVEL = 0.5;
  const bodyGeo = own(
    new THREE.ExtrudeGeometry(
      roundedRectShape(
        PHONE.body.x - 2 * BEVEL,
        PHONE.body.y - 2 * BEVEL,
        PHONE.cornerRadius - BEVEL,
      ),
      {
        depth: PHONE.body.z - 2 * BEVEL,
        bevelEnabled: true,
        bevelThickness: BEVEL,
        bevelSize: BEVEL,
        bevelSegments: 2,
        curveSegments: CORNER_SEGMENTS,
      },
    ),
  );
  bodyGeo.translate(0, 0, BACK_PZ + BEVEL);
  phone.add(new THREE.Mesh(bodyGeo, materials.phoneRail));

  // ---- back glass. Inset 0.8 on each side so a hairline of rail shows around
  // it, and sunk into the body so no seam can crack open at a grazing angle.
  const backGeo = own(
    new THREE.ExtrudeGeometry(
      roundedRectShape(PHONE.body.x - 1.6, PHONE.body.y - 1.6, PHONE.cornerRadius - 0.8),
      { depth: 0.6, bevelEnabled: false, curveSegments: CORNER_SEGMENTS },
    ),
  );
  backGeo.translate(0, 0, BACK_PZ - 0.125);
  phone.add(new THREE.Mesh(backGeo, materials.phoneBack));

  // ---- screen. Its own plate, inset by the bezel and standing 0.325 mm proud,
  // so it takes the light at a different angle from the body and the capture-app
  // UI never z-fights the front face.
  const screenGeo = own(
    new THREE.ExtrudeGeometry(
      roundedRectShape(
        PHONE.body.x - 2 * PHONE.bezel,
        PHONE.body.y - 2 * PHONE.bezel,
        PHONE.cornerRadius - PHONE.bezel,
      ),
      { depth: 0.6, bevelEnabled: false, curveSegments: CORNER_SEGMENTS },
    ),
  );
  planarUv(screenGeo);
  screenGeo.translate(0, 0, HALF.z - 0.275);
  phone.add(new THREE.Mesh(screenGeo, materials.phoneScreen));

  // ---- camera island. Built 0.6 mm deeper than PHONE.island.z so its base
  // passes through the back glass instead of sitting on a coplanar seam; the
  // 3.6 mm that matter — back face to lens face — are unchanged.
  const ISLAND_BEVEL = 0.35;
  const ISLAND_DEPTH = PHONE.island.z + 0.6 - 2 * ISLAND_BEVEL;
  const islandGeo = own(
    new THREE.ExtrudeGeometry(
      roundedRectShape(
        PHONE.island.x - 2 * ISLAND_BEVEL,
        PHONE.island.y - 2 * ISLAND_BEVEL,
        PHONE.island.cornerRadius - ISLAND_BEVEL,
      ),
      {
        depth: ISLAND_DEPTH,
        bevelEnabled: true,
        bevelThickness: ISLAND_BEVEL,
        bevelSize: ISLAND_BEVEL,
        bevelSegments: 2,
        curveSegments: CORNER_SEGMENTS,
      },
    ),
  );
  // Extrudes toward +Z from 0; flip the run so its far face becomes the lens
  // face, then drop that face onto ISLAND_FACE_PZ. The shape is a centred
  // rounded square, so the flip's mirror in X changes nothing.
  islandGeo.rotateY(Math.PI);
  islandGeo.translate(
    PHONE.islandCentre.x,
    PHONE.islandCentre.y,
    ISLAND_FACE_PZ + ISLAND_DEPTH + ISLAND_BEVEL,
  );
  phone.add(new THREE.Mesh(islandGeo, materials.phoneIsland));

  // ---- the two lens assemblies. One ring geometry and one glass geometry,
  // shared: the second lens is the same part, moved.
  //
  // The ring is a lathe rather than a cylinder because the profile is where the
  // read is — an outer wall, a chamfer up to a narrow rim, then a drop back to
  // the glass seat, which is what puts a bright line around a dark well.
  const lensRingGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(LENS_RING_RADIUS, 0),
        new THREE.Vector2(LENS_RING_RADIUS, LENS_RIM_HEIGHT - 0.5),
        new THREE.Vector2(LENS_RING_RADIUS - 1.0, LENS_RIM_HEIGHT),
        new THREE.Vector2(PHONE.lens.glassRadius + 0.4, LENS_RIM_HEIGHT),
        new THREE.Vector2(PHONE.lens.glassRadius, 0),
      ],
      32,
    ),
  );
  // The glass sits in the island's face — MOUNT.lensFromAxis is measured to
  // exactly that plane — so its rim is coplanar with the island. A 0.15 mm dome
  // keeps the two from sharing an area (they now meet along a circle only) and
  // is what a real element looks like anyway. The mesh origin stays at the
  // plane, so the mesh's position *is* the lens centre MOUNT specifies.
  const DOME = 0.15;
  const domeProfile: THREE.Vector2[] = [];
  for (let i = 0; i <= 4; i += 1) {
    const t = 1 - i / 4;
    domeProfile.push(new THREE.Vector2(PHONE.lens.glassRadius * t, DOME * (1 - t * t)));
  }
  const lensGlassGeo = own(new THREE.LatheGeometry(domeProfile, 32));

  for (const px of [LENS_PX, SECOND_LENS_PX]) {
    const lens = new THREE.Group();
    lens.position.set(px, LENS_PY, ISLAND_FACE_PZ);
    // The lathe's +Y becomes the island's outward normal, phone -Z.
    lens.rotation.x = -Math.PI / 2;
    lens.add(new THREE.Mesh(lensRingGeo, materials.lensRing));
    const glass = new THREE.Mesh(lensGlassGeo, materials.lensGlass);
    glass.name = px === LENS_PX ? "scanningLensGlass" : "lensGlass";
    lens.add(glass);
    phone.add(lens);
  }

  // ---- flash and the ambient sensor, so the island is not two lenses on a
  // blank plate. Both clear the lens rings and both sit under the shroud.
  const dotGeo = own(new THREE.CylinderGeometry(2.9, 2.9, 0.8, 16));
  const dotLensGeo = own(new THREE.CylinderGeometry(2.0, 2.0, 1.0, 16));
  for (const [dx, dy, dr] of [
    [PHONE.islandCentre.x, PHONE.islandCentre.y + 16.5, 1],
    [PHONE.islandCentre.x, PHONE.islandCentre.y - 15.5, 0.62],
  ] as const) {
    const seat = new THREE.Mesh(dotGeo, materials.lensRing);
    seat.position.set(dx, dy, ISLAND_FACE_PZ - 0.4);
    seat.rotation.x = Math.PI / 2;
    seat.scale.set(dr, 1, dr);
    phone.add(seat);
    const cover = new THREE.Mesh(dotLensGeo, materials.lensGlass);
    cover.position.set(dx, dy, ISLAND_FACE_PZ - 0.5);
    cover.rotation.x = Math.PI / 2;
    cover.scale.set(dr, 1, dr);
    phone.add(cover);
  }

  // ============================================================ the bracket
  //
  // One printed part in two pieces of drawing: a canted post from the gripper
  // flange out to the middle of the phone's screen side, and two clamp jaws
  // that swallow the phone's long edges. Both are side views — profiles in a
  // plane, extruded across — because that is where the shape is.
  //
  // The post is drawn in the TOOL frame and the jaws in the HOLDER frame, which
  // is not an inconsistency: the post has to meet a flange that does not cant
  // with the phone, and the jaws have to grip a phone that does. The two meet
  // flush at the screen plane because the post's far edge IS that plane, taken
  // from the holder's own transform rather than written out again.
  const profileMesh = (
    points: [number, number][],
    length: number,
    material: THREE.Material,
  ): THREE.Mesh => {
    const shape = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
    const geometry = own(
      new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 1 }),
    );
    fitUv(geometry);
    // rotateY(-90 deg) sends shape-X to +Z and the extrusion run to -X, the only
    // assignment of the three axes that stays right-handed; then centre the run.
    geometry.rotateY(-Math.PI / 2);
    geometry.translate(length / 2, 0, 0);
    return new THREE.Mesh(geometry, material);
  };

  // ---- the post. Profile in the tool frame's (z, y): from the flange face at
  // z = -ARM.L4, out to the pad lying flat on the canted screen plane.
  //
  // Both pad corners come from the holder's own transform, so the post follows
  // the phone wherever axisTilt puts it and the joint can never open up: the
  // pad's midpoint is the holder origin pushed out along holder +Z by half the
  // phone's thickness, and the pad runs from there along holder +/-Y.
  // holder -> tool by hand rather than localToWorld, which would drag in the
  // group's own clocking and land the post half a turn out from the phone.
  const toTool = (v: THREE.Vector3) => v.applyEuler(holder.rotation).add(holder.position);
  const padEndA = toTool(new THREE.Vector3(0, PAD_HALF, HALF.z));
  const padEndB = toTool(new THREE.Vector3(0, -PAD_HALF, HALF.z));
  const FLANGE_Z = -ARM.L4;
  const POST_HALF = MOUNT.bracket.width / 2;
  group.add(
    profileMesh(
      [
        [FLANGE_Z, POST_HALF],
        [padEndA.z, padEndA.y],
        [padEndB.z, padEndB.y],
        [FLANGE_Z, -POST_HALF],
      ],
      MOUNT.bracket.width,
      materials.printedDark,
    ),
  );

  // ---- the jaws. Profile in the holder frame's (y, z), one C-channel per long
  // edge, mirrored. Traced from the inner end of the screen-side pad, out over
  // the pad's own face, round the outside of the phone's edge, back in along the
  // camera side to the shallow lip, and home along the phone's faces.
  const jawProfile: [number, number][] = [
    [JAW_PAD_IN, HALF.z],
    [JAW_PAD_IN, JAW_FRONT_Z],
    [JAW_OUT, JAW_FRONT_Z],
    [JAW_OUT, JAW_BACK_Z],
    [JAW_LIP_IN, JAW_BACK_Z],
    [JAW_LIP_IN, -HALF.z],
    [JAW_Y, -HALF.z],
    [JAW_Y, HALF.z],
  ];
  for (const sign of [1, -1]) {
    const jaw = profileMesh(
      jawProfile.map(([y, z]) => [y * sign, z] as [number, number]),
      MOUNT.clamp.length,
      materials.printedDark,
    );
    // profileMesh lays its shape out in (+Z, +Y) and runs the extrusion on X;
    // here the shape's two axes are the holder's Y and Z the other way round,
    // so turn it a quarter about X and it lands where the profile was drawn.
    jaw.rotation.x = Math.PI / 2;
    holder.add(jaw);
  }

  // Accent inlay down each jaw's outer wall: the same orange stripe the arm's
  // shells carry, so the tool reads as part of the same printed family rather
  // than as a bought-in mount.
  const stripeGeo = own(new THREE.BoxGeometry(MOUNT.clamp.length - 12, 0.8, 2.6));
  for (const sign of [1, -1]) {
    const stripe = new THREE.Mesh(stripeGeo, materials.printedAccent);
    stripe.position.set(0, sign * (JAW_OUT + 0.4), 0);
    holder.add(stripe);
  }

  // Four M3 socket heads where the post bolts through to the gripper flange.
  const boltGeo = own(new THREE.CylinderGeometry(2.6, 2.6, 2, 12));
  for (const bx of [-7, 7]) {
    for (const by of [-7, 7]) {
      const bolt = new THREE.Mesh(boltGeo, materials.hardware);
      bolt.position.set(bx, by, FLANGE_Z - 1);
      bolt.rotation.x = Math.PI / 2;
      group.add(bolt);
    }
  }

  // ============================================================= the shroud
  //
  // Its own frame, standing on the ACTUAL camera island — off in the corner of
  // the phone's back, not on the roll axis, because that is where the lens is.
  // Local +Y runs from the island out toward the skin, so every number below is
  // "distance from the lens". It hangs off the holder, so it cants with the
  // phone and the roll servo carries it round without moving it off the glass.
  const optics = new THREE.Group();
  optics.name = "optics";
  optics.position.copy(LENS_HOLDER);
  // Send the shroud's local +Y to holder -Z, the direction the camera looks.
  optics.rotation.x = -Math.PI / 2;
  holder.add(optics);

  const { length: SHROUD_LEN, baseRadius: R0, mouthRadius: R1, wall: WALL } = MOUNT.shroud;
  // The cone starts at the island's face, but the island is only 3.6 mm tall
  // and 44 mm across while the cone's base is 54 mm, so a bare cone would float
  // over the phone's back everywhere outside the island. A short collar takes
  // the wall down those 3.6 mm to the back glass, which is where a printed
  // shroud would actually bond.
  const COLLAR = -PHONE.island.z;
  const shroudOuterGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(R0, COLLAR),
        new THREE.Vector2(R0, 0),
        new THREE.Vector2(R1, SHROUD_LEN),
        new THREE.Vector2(R1 - WALL, SHROUD_LEN),
      ],
      48,
    ),
  );
  optics.add(new THREE.Mesh(shroudOuterGeo, materials.shroudOuter));

  const shroudInnerGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(R1 - WALL, SHROUD_LEN),
        new THREE.Vector2(R0 - WALL, 0),
        new THREE.Vector2(R0 - WALL, COLLAR),
      ],
      48,
    ),
  );
  optics.add(new THREE.Mesh(shroudInnerGeo, materials.shroudInner));

  // Soft rim at the mouth. MOUNT.standoff is lens-glass to skin and the shroud
  // is 16 mm shorter than that, so this never touches a patient — but a contact
  // shroud carries one regardless, and it is what stops the mouth reading as a
  // cut edge.
  const rimGeo = own(new THREE.TorusGeometry((R1 - WALL / 2), 1.5, 6, 32));
  const rim = new THREE.Mesh(rimGeo, materials.fixturePad);
  rim.position.y = SHROUD_LEN;
  rim.rotation.x = Math.PI / 2;
  optics.add(rim);

  // ========================================================== the ring light
  //
  // Twelve diodes on a printed carrier, not a glowing torus: at any zoom the
  // figure supports, individual emitters are the thing that says "ring light".
  // The carrier clears the lens rims (1.9 mm) and still fits inside the cone,
  // whose inner radius has only fallen to 23.9 mm at this height.
  const CARRIER_Y = 5.5;
  const carrierGeo = own(
    new THREE.TorusGeometry(MOUNT.led.ringRadius, MOUNT.led.tubeRadius, 6, 28),
  );
  const carrier = new THREE.Mesh(carrierGeo, materials.printedDark);
  carrier.position.y = CARRIER_Y;
  carrier.rotation.x = Math.PI / 2;
  optics.add(carrier);

  const diodeGeo = own(new THREE.SphereGeometry(MOUNT.led.diodeRadius, 8, 6));
  for (let i = 0; i < MOUNT.led.count; i += 1) {
    const a = (i / MOUNT.led.count) * Math.PI * 2;
    const diode = new THREE.Mesh(diodeGeo, materials.led);
    diode.position.set(
      Math.cos(a) * MOUNT.led.ringRadius,
      CARRIER_Y + MOUNT.led.tubeRadius * 0.9,
      Math.sin(a) * MOUNT.led.ringRadius,
    );
    optics.add(diode);
  }

  // The light the ring actually casts. Intensity is candela and distances are
  // millimetres, so the skin at MOUNT.standoff picks up 2600/50² ≈ 1.0 — the
  // same order as the scene's 3.2 key, which reads as a pool under the mouth
  // rather than as a blown-out patch. The 220 mm cutoff keeps it off the rest
  // of the face. It lives in this group so it travels with the tool, which also
  // makes RobotScene's `if (!tool.light.parent)` guard a no-op.
  const light = new THREE.PointLight(0xfff2e0, 2600, 220, 2);
  light.position.y = CARRIER_Y - 1.5;
  optics.add(light);

  return {
    object: group,
    light,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      geometries.length = 0;
      light.dispose();
    },
  };
}
