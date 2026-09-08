import * as THREE from "three";
import { ROOM, FIXTURE, HEAD, type Built, type Materials } from "./contracts";
import { headSurface, thetaAtDepth } from "./headShape";

/**
 * The head rest, and a hint of the person in it.
 *
 * The arrangement this builds: someone is sitting behind the table with their
 * head up at scanning height, held by a clinical head rest that stands on the
 * floor behind them — a weighted base, a telescoping column with its clamp
 * collars, a yoke at ear height carrying the two pads that press the mastoid,
 * and a U-bracket at chin height carrying the cup under the menton. The table
 * stops short of the head (see ROOM below); the arm stands on the table and
 * reaches across the gap to the face.
 *
 * The one hard rule is clearance. The arm works the front of the face from +Z,
 * so every structural part — base, column, collars, yokes, fasteners — stays
 * behind the occiput, and the only things forward of the ears are the chin
 * bracket's two side rails, which run at the very bottom of the jaw where the
 * head is barely 50 mm wide, and the cup itself.
 *
 * Nothing here is a literal millimetre of the subject's position. HEAD moves —
 * it is being re-solved so the arm can reach it — so every contact point comes
 * from headSurface() and every structural part is placed relative to what that
 * returns. The only absolutes are ROOM's, which are the room, not the person.
 *
 * Turned parts are lathes rather than plain cylinders: a column with a collar
 * and a chamfered foot reads as lab hardware, a bare cylinder reads as a
 * placeholder.
 */


/**
 * Where on the skull the pads press, as fractions of the head's own semi-axes.
 *
 * They have to land on the mastoid, not the pinna: the ear stands ~20 mm off
 * the skull and its back edge is about 17 mm behind the canal, so the contact
 * plane sits a little over half a semi-axis behind the head's centre, which
 * reaches forward to the edge of the ear and no further, and a hair below the
 * centre's height.
 *
 * Deliberately NOT HEAD.ear.y/z: those are world millimetres from the old seat
 * (146, −12) and did not move when HEAD.centre was re-solved to (0, 190, −190),
 * so −12 is now 178 mm in FRONT of the head. Ratios cannot go stale that way.
 */
const PAD_BEHIND_CENTRE = 0.55;
const PAD_BELOW_CENTRE = 0.035;

/** Clear air between the back of the skull and the column standing behind it. */
const COLUMN_CLEARANCE = 34;

export function buildFixture(materials: Materials): Built {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const own = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };

  const metal = materials.fixtureMetal;
  const pad = materials.fixturePad;

  // A unit cylinder, scaled and aimed per instance. Every strut in the rig is
  // "connect these two points", and one geometry serving all of them is both
  // cheaper and less error-prone than a rotation per bar worked out by hand.
  const unitBar = own(new THREE.CylinderGeometry(1, 1, 1, 16));
  const UP = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3();
  const strut = (a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(unitBar, metal);
    axis.copy(b).sub(a);
    mesh.scale.set(radius, Math.max(axis.length(), 1e-3), radius);
    mesh.quaternion.setFromUnitVectors(UP, axis.normalize());
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    group.add(mesh);
    return mesh;
  };

  // ---------------------------------------------------- the contact points

  // Elevation of the contact as an angle, not a height, so the pads keep
  // meeting the same anatomy wherever the head is seated.
  const padPhi = -Math.asin(PAD_BELOW_CENTRE);
  const padContactZ = HEAD.centre.z - PAD_BEHIND_CENTRE * HEAD.radii.z;

  /** How far out along the normal the pad's stub ends, i.e. where a bar can grab it. */
  const PAD_STACK = FIXTURE.earPad.thickness + 18;

  type Contact = {
    /** Skin point the foam presses on. */
    skin: THREE.Vector3;
    outward: THREE.Vector3;
    /** Origin of the pad group: see the note on which end of the lathe touches. */
    origin: THREE.Vector3;
    /** Back of the stub, where the yoke's arm lands. */
    mount: THREE.Vector3;
  };
  const pads: Contact[] = [1, -1].map((side) => {
    const theta = thetaAtDepth(padPhi, padContactZ, side);
    const sample = headSurface(theta, padPhi);
    const outward = new THREE.Vector3(sample.normal.x, sample.normal.y, sample.normal.z);
    const skin = new THREE.Vector3(sample.skin.x, sample.skin.y, sample.skin.z);
    // The pad lathe runs base-first from its local origin and the ROUNDED end
    // is the one that touches, so the group's origin stands a whole thickness
    // out along the normal. Half of one, and the foam sits inside the skull.
    const origin = skin.clone().addScaledVector(outward, FIXTURE.earPad.thickness);
    const mount = skin.clone().addScaledVector(outward, PAD_STACK);
    return { skin, outward, origin, mount };
  });

  // The menton, found rather than assumed. HEAD.chinY names its height, but the
  // cup also needs its depth, and only the sculpt knows where the chin actually
  // sticks out to — so sweep the midline under the jaw and take the low point.
  let menton = headSurface(0, -Math.PI / 2);
  for (let i = 1; i <= 48; i++) {
    const sample = headSurface(0, -Math.PI / 2 + (i / 48) * 0.95);
    if (sample.skin.y < menton.skin.y) menton = sample;
  }
  const chinY = menton.skin.y;
  const chinZ = menton.skin.z;

  // The cup hangs off a U-bracket rather than a boom from the column, because
  // the neck is in the way of anything straight. Its two rails run at the very
  // bottom of the jaw, where the head is barely 50 mm wide, and outboard of the
  // cup by a comfortable margin, so they pass the face and the throat clear.
  const railX = FIXTURE.chinCup.radius + FIXTURE.chinCup.wall + 46;
  const railY = chinY - FIXTURE.chinCup.depth - FIXTURE.chinCup.wall - 4;

  // ---------------------------------------------------- the column

  // Behind the occiput, on the midline. Everything structural hangs off this,
  // which is what keeps the whole rig out of the arm's half of the scene.
  const columnZ = HEAD.centre.z - HEAD.radii.z - COLUMN_CLEARANCE;
  const padY = pads[0].skin.y;
  const columnTop = padY + 46;
  // The telescope joint sits below the table top, so the adjustment reads from
  // the viewer's side of the scene rather than hiding behind the subject.
  const jointY = -120;

  const lowerR = 26;
  const upperR = 18;

  // Base: a weighted disc with a chamfered top edge, so it catches the key
  // light as a ring the way a cast base does. Wide enough not to look tippy
  // under a 900 mm column.
  const baseR = 150;
  const baseGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(baseR, 0),
        new THREE.Vector2(baseR, 10),
        new THREE.Vector2(baseR - 8, 18),
        new THREE.Vector2(lowerR + 22, 18),
        // A shallow boss where the column enters, as a casting would have.
        new THREE.Vector2(lowerR + 16, 30),
        new THREE.Vector2(0, 30),
      ],
      44,
    ),
  );
  const base = new THREE.Mesh(baseGeo, metal);
  base.position.set(0, ROOM.floorY, columnZ);
  group.add(base);

  // Lower tube: from the base up to the telescope clamp.
  const lowerGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(lowerR + 4, 0),
        new THREE.Vector2(lowerR + 4, 8),
        new THREE.Vector2(lowerR, 14),
        new THREE.Vector2(lowerR, jointY - ROOM.floorY - 24),
        new THREE.Vector2(0, jointY - ROOM.floorY - 24),
      ],
      32,
    ),
  );
  const lower = new THREE.Mesh(lowerGeo, metal);
  lower.position.set(0, ROOM.floorY + 24, columnZ);
  group.add(lower);

  // Upper tube: slides inside the lower one, so it starts below the clamp.
  const upperGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(upperR, 0),
        new THREE.Vector2(upperR, columnTop - jointY + 30),
        new THREE.Vector2(upperR - 4, columnTop - jointY + 34),
        new THREE.Vector2(0, columnTop - jointY + 34),
      ],
      28,
    ),
  );
  const upper = new THREE.Mesh(upperGeo, metal);
  upper.position.set(0, jointY - 30, columnZ);
  group.add(upper);

  // ---------------------------------------------------- collars and knobs

  // One collar profile, three uses. A split clamp: a barrel with a raised band
  // at each end, which is what a slit collar looks like once it is machined.
  const collarGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, -16),
        new THREE.Vector2(lowerR + 12, -16),
        new THREE.Vector2(lowerR + 12, -11),
        new THREE.Vector2(lowerR + 7, -8),
        new THREE.Vector2(lowerR + 7, 8),
        new THREE.Vector2(lowerR + 12, 11),
        new THREE.Vector2(lowerR + 12, 16),
        new THREE.Vector2(0, 16),
      ],
      32,
    ),
  );
  // A thumb screw: a shaft, then a knurled head with a rounded edge. Built
  // along +Y and aimed per instance, like the struts.
  const knobGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(4, 0),
        new THREE.Vector2(4, 12),
        new THREE.Vector2(11, 13),
        new THREE.Vector2(11, 21),
        new THREE.Vector2(8, 24),
        new THREE.Vector2(0, 24),
      ],
      18,
    ),
  );

  /** A clamp collar on the column at height `y`, with its screw facing `dir`. */
  const collar = (y: number, dir: THREE.Vector3, screwOut: number) => {
    const ring = new THREE.Mesh(collarGeo, metal);
    ring.position.set(0, y, columnZ);
    group.add(ring);
    const knob = new THREE.Mesh(knobGeo, metal);
    knob.quaternion.setFromUnitVectors(UP, dir);
    knob.position.set(0, y, columnZ).addScaledVector(dir, screwOut);
    group.add(knob);
  };

  const right = new THREE.Vector3(1, 0, 0);
  const back = new THREE.Vector3(0, 0, -1);
  collar(jointY, right, lowerR + 4);
  collar(padY, back, lowerR + 4);
  collar(railY, right, lowerR + 4);

  // ---------------------------------------------------- the ear-pad yoke

  // A cross bar behind the head, and an arm from each end forward to a pad.
  // The bar can be any width it likes: at columnZ there is no head in the way.
  const yokeHalfX = Math.abs(pads[0].mount.x) + 12;
  strut(
    new THREE.Vector3(-yokeHalfX, padY, columnZ),
    new THREE.Vector3(yokeHalfX, padY, columnZ),
    FIXTURE.armRadius,
  );

  // Pad parts, shared by both sides. A foam cushion domed on the face that
  // touches the skull, on a metal backing plate, on a short stub.
  const padGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(FIXTURE.earPad.radius - 3, 0),
        new THREE.Vector2(FIXTURE.earPad.radius, 2),
        new THREE.Vector2(FIXTURE.earPad.radius, FIXTURE.earPad.thickness - 3),
        // Softly rounded rim, so it reads as closed-cell foam rather than a puck.
        new THREE.Vector2(FIXTURE.earPad.radius - 3, FIXTURE.earPad.thickness),
        new THREE.Vector2(0, FIXTURE.earPad.thickness),
      ],
      32,
    ),
  );
  const backingGeo = own(
    new THREE.CylinderGeometry(FIXTURE.earPad.radius, FIXTURE.earPad.radius - 1, 4, 32),
  );
  const stubGeo = own(new THREE.CylinderGeometry(6, 6, 16, 16));
  const boltHead = own(new THREE.CylinderGeometry(3.6, 3.6, 3.2, 6));

  for (const contact of pads) {
    const side = Math.sign(contact.skin.x) || 1;
    const corner = new THREE.Vector3(side * yokeHalfX, padY, columnZ);

    // The arm runs straight from the yoke's corner to the back of the pad.
    // Aimed rather than axis-aligned, so it stays connected wherever the pad
    // lands when the head moves.
    strut(corner, contact.mount, FIXTURE.armRadius);

    // The knuckle at the corner, with the pinch bolt that sets the pad's width.
    const knuckle = new THREE.Mesh(stubGeo, metal);
    knuckle.rotation.z = Math.PI / 2;
    knuckle.position.copy(corner);
    group.add(knuckle);
    const bolt = new THREE.Mesh(boltHead, metal);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.copy(corner).x += side * 10;
    group.add(bolt);

    // Pad group: local +Y is the lathe's axis, so point it back along the
    // outward normal — the pad presses inward, toward the skull.
    const padGroup = new THREE.Group();
    padGroup.position.copy(contact.origin);
    padGroup.quaternion.setFromUnitVectors(UP, contact.outward.clone().negate());
    padGroup.add(new THREE.Mesh(padGeo, pad));
    const plate = new THREE.Mesh(backingGeo, metal);
    plate.position.y = -2;
    padGroup.add(plate);
    const stub = new THREE.Mesh(stubGeo, metal);
    stub.position.y = -10;
    padGroup.add(stub);
    group.add(padGroup);
  }

  // ---------------------------------------------------- the chin cup

  // A shallow dish whose rim is at the menton, so the chin rests in it and the
  // head hangs off the cup and the two pads. Metal shell, foam liner, soft
  // rolled rim: this is the only part that touches the face from the front, and
  // a hard edge there would look like a clamp, not a rest.
  const cupR = FIXTURE.chinCup.radius;
  const cupDepth = FIXTURE.chinCup.depth;
  const wall = FIXTURE.chinCup.wall;
  const cupBottom = chinY - cupDepth;
  const shellGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, cupBottom),
        new THREE.Vector2(cupR - 6, cupBottom),
        // A dish, not a cylinder: the chin sits in a spherical hollow.
        new THREE.Vector2(cupR - 2, cupBottom + 4),
        new THREE.Vector2(cupR, chinY - 2),
        new THREE.Vector2(cupR + wall / 2, chinY),
        new THREE.Vector2(cupR + wall, chinY - 3),
        new THREE.Vector2(cupR + wall, cupBottom + 2),
        new THREE.Vector2(cupR + wall - 4, cupBottom - wall),
        new THREE.Vector2(0, cupBottom - wall),
      ],
      44,
    ),
  );
  const cup = new THREE.Mesh(shellGeo, metal);
  cup.position.z = chinZ;
  group.add(cup);

  const linerGeo = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, cupBottom + 3),
        new THREE.Vector2(cupR - 8, cupBottom + 3),
        new THREE.Vector2(cupR - 3.5, cupBottom + 6),
        new THREE.Vector2(cupR - 2.5, chinY - 1),
        new THREE.Vector2(cupR - 5, chinY - 1.5),
        new THREE.Vector2(cupR - 6, cupBottom + 5.5),
        new THREE.Vector2(0, cupBottom + 5.5),
      ],
      44,
    ),
  );
  const liner = new THREE.Mesh(linerGeo, pad);
  liner.position.z = chinZ;
  group.add(liner);

  // ---------------------------------------------------- the chin bracket

  // A cross bar behind the head, two rails forward along the sides, and a short
  // spar in to the cup on each side; railX and railY are set above, with the
  // rest of what the head's own position decides.
  strut(
    new THREE.Vector3(-railX, railY, columnZ),
    new THREE.Vector3(railX, railY, columnZ),
    FIXTURE.armRadius,
  );
  for (const side of [1, -1] as const) {
    const front = new THREE.Vector3(side * railX, railY, chinZ);
    strut(new THREE.Vector3(side * railX, railY, columnZ), front, FIXTURE.armRadius);
    strut(front, new THREE.Vector3(side * (cupR + wall - 3), railY, chinZ), FIXTURE.armRadius - 1);
    const bolt = new THREE.Mesh(boltHead, metal);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(side * railX, railY, chinZ + 8);
    group.add(bolt);
  }

  // ---------------------------------------------------- the subject

  // A neck and a suggestion of shoulders, which is all it takes to read as a
  // person sitting there rather than a head on a spike. Both are kept behind
  // the table's far edge: the arm never goes there, and neither does the table.
  const torsoHalfDepth = 118;
  const torsoZ = Math.min(HEAD.centre.z - 24, ROOM.table.farZ - 24 - torsoHalfDepth);
  // Menton to acromion is about 200 mm on a seated adult, so the shoulder line
  // lands here whatever height the head is set to.
  const shoulderY = chinY - 200;

  const torsoGeo = own(new THREE.CapsuleGeometry(106, 240, 6, 22));
  const torso = new THREE.Mesh(torsoGeo, materials.skin);
  // The capsule is built along +Y; turning it a quarter turn about Z lays it
  // along X, which maps its local X to world Y and leaves local Z alone — so
  // the scale below flattens the shoulders vertically and deepens the chest.
  torso.rotation.z = Math.PI / 2;
  torso.scale.set(0.9, 1, 1.06);
  torso.position.set(HEAD.centre.x, shoulderY - 106 * 0.9, torsoZ);
  group.add(torso);

  // The neck is aimed from under the jaw to the top of the chest, so however
  // far back the torso has to sit to clear the table, it still connects. Its
  // top is set behind the chin cup rather than under the head's centre: the
  // cup fills the space under the menton, and the throat has to be behind it.
  const neckTopR = 46;
  const neckTop = new THREE.Vector3(
    HEAD.centre.x,
    chinY + 20,
    Math.min(HEAD.centre.z - 24, chinZ - (cupR + wall) - neckTopR),
  );
  const neckBottom = new THREE.Vector3(HEAD.centre.x, shoulderY - 30, torsoZ + 16);
  // Radii are swapped because the aiming below points local +Y downward: the
  // wide end is the one that meets the chest.
  const neckGeo = own(new THREE.CylinderGeometry(64, neckTopR, 1, 22, 1, true));
  const neck = new THREE.Mesh(neckGeo, materials.skin);
  axis.copy(neckBottom).sub(neckTop);
  neck.scale.y = axis.length();
  neck.quaternion.setFromUnitVectors(UP, axis.normalize());
  neck.position.copy(neckTop).add(neckBottom).multiplyScalar(0.5);
  group.add(neck);

  return {
    object: group,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      geometries.length = 0;
    },
  };
}
