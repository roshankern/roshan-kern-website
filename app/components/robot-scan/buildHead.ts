import * as THREE from "three";
import { HEAD, type Built, type Materials, type Vec3 } from "./contracts";
import { LANDMARKS, headSurface, thetaAtDepth } from "./headShape";

/**
 * The head, as meshes. Everything is already in world coordinates — the caller
 * adds the returned object to the scene and applies no transform of its own.
 *
 * The skin is a hand-tessellated parametric surface over headShape's
 * headSurface(), which also gives the exact analytic normals, so the shading is
 * the sculpt's own curvature rather than an average of triangle normals. The
 * ears, eyes, brows, lips and the buzz cut are separate meshes seated on that
 * same surface, at the (θ, φ) landmarks headShape publishes, so a feature never
 * drifts off the hollow or the ridge that was sculpted for it.
 *
 * No material is created here: every one comes from the argument, and dispose()
 * releases geometry only.
 */

const HALF_PI = Math.PI / 2;

/** C2 smootherstep, used everywhere a shape has to fade in without a crease. */
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// ------------------------------------------------------- parametric surface

type SurfaceOptions = {
  thetaSegments: number;
  phiSegments: number;
  phiFrom: number;
  phiTo: number;
  /** Millimetres out along the analytic normal — 0 for the skin itself. */
  offset?: (theta: number, phi: number) => number;
  /** False drops the quad, which is how the hair shell gets its hairline. */
  keep?: (theta: number, phi: number) => boolean;
};

/**
 * Tessellate headSurface over a (θ, φ) rectangle.
 *
 * 200 × 152 over the whole head is a 2.4 mm quad at the face, which is what the
 * finest sculpted feature — the crease of the mouth, σ = 0.033 rad — needs to
 * survive. UVs are u across θ and v along φ, wrapping exactly once each way,
 * which is the assumption materials.ts already builds the pore and stubble
 * repeats from. The θ = ±π seam carries duplicated vertices so u can run 0 → 1
 * without the last column snapping back to the first.
 */
function surfaceGeometry(o: SurfaceOptions): THREE.BufferGeometry {
  const { thetaSegments: ns, phiSegments: np, phiFrom, phiTo } = o;
  const count = (ns + 1) * (np + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);

  for (let j = 0; j <= np; j++) {
    const phi = phiFrom + ((phiTo - phiFrom) * j) / np;
    for (let i = 0; i <= ns; i++) {
      const theta = -Math.PI + (2 * Math.PI * i) / ns;
      const s = headSurface(theta, phi);
      const d = o.offset ? o.offset(theta, phi) : 0;
      const k = j * (ns + 1) + i;
      positions[k * 3] = s.skin.x + s.normal.x * d;
      positions[k * 3 + 1] = s.skin.y + s.normal.y * d;
      positions[k * 3 + 2] = s.skin.z + s.normal.z * d;
      normals[k * 3] = s.normal.x;
      normals[k * 3 + 1] = s.normal.y;
      normals[k * 3 + 2] = s.normal.z;
      uvs[k * 2] = (theta + Math.PI) / (2 * Math.PI);
      uvs[k * 2 + 1] = (phi + HALF_PI) / Math.PI;
    }
  }

  const indices: number[] = [];
  const atPole = (phi: number) => Math.abs(Math.abs(phi) - HALF_PI) < 1e-9;
  for (let j = 0; j < np; j++) {
    const phi0 = phiFrom + ((phiTo - phiFrom) * j) / np;
    const phi1 = phiFrom + ((phiTo - phiFrom) * (j + 1)) / np;
    for (let i = 0; i < ns; i++) {
      const th0 = -Math.PI + (2 * Math.PI * i) / ns;
      const th1 = -Math.PI + (2 * Math.PI * (i + 1)) / ns;
      if (o.keep && !o.keep((th0 + th1) / 2, (phi0 + phi1) / 2)) continue;
      const a = j * (ns + 1) + i;
      const b = a + 1;
      const c = b + ns + 1;
      const d = a + ns + 1;
      // ∂p/∂θ × ∂p/∂φ points outward, so (a, b, d) is already front-facing.
      // At a pole the whole row is one point and one of the two triangles is
      // degenerate; emitting it would only feed NaN normals to the renderer.
      if (!atPole(phi0)) indices.push(a, b, d);
      if (!atPole(phi1)) indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

// --------------------------------------------------------------- placement

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Seat an object on the skin: origin at `at`, local +Z along `outward`, local
 * +Y as close to world up as the surface allows. The basis is built
 * right-handed (ex = ey × ez), so nothing is mirrored and no winding flips.
 */
function seat(object: THREE.Object3D, at: Vec3, outward: Vec3): void {
  const ez = new THREE.Vector3(outward.x, outward.y, outward.z).normalize();
  const ey = UP.clone().addScaledVector(ez, -UP.dot(ez));
  if (ey.lengthSq() < 1e-6) ey.set(0, 0, 1).addScaledVector(ez, -ez.z);
  ey.normalize();
  const ex = new THREE.Vector3().crossVectors(ey, ez);
  object.position.set(at.x, at.y, at.z);
  object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
}

/**
 * The mirror image of a geometry across its local YZ plane, winding included.
 * A pair of ears is chiral: the same geometry dropped into the two seat frames
 * would put one helix at the back of the head and the other at the front.
 */
function mirroredX(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.clone();
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
  for (let i = 0; i < position.count; i++) position.setX(i, -position.getX(i));
  position.needsUpdate = true;
  if (normal) {
    for (let i = 0; i < normal.count; i++) normal.setX(i, -normal.getX(i));
    normal.needsUpdate = true;
  }
  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
    index.needsUpdate = true;
  }
  return geometry;
}

// -------------------------------------------------------------- the buzz cut

/**
 * The hairline, as φ against θ, written as a cosine series so it is exactly
 * 2π-periodic and C∞. Fitted to four points: 0.60 at the midline of the
 * forehead (y = 216), 0.72 at the temples — the temporal recession, which is
 * what stops a buzz cut reading as a swimming cap — 0.35 at the sideburn, and
 * −0.05 at the nape, level with the ear canal.
 */
function hairline(theta: number): number {
  return (
    0.3125 +
    0.45409 * Math.cos(theta) -
    0.0375 * Math.cos(2 * theta) -
    0.12909 * Math.cos(3 * theta)
  );
}

// ------------------------------------------------------------------- the ear

/**
 * One pinna, in a frame with the origin at the skull, +Z standing out from it,
 * +Y up and +X toward the back of the head.
 *
 * A pinna is a flattened ovoid shell: HEAD.ear gives 62 tall, 33 wide, standing
 * 20 off the skull. The ovoid carries a Gaussian dimple for the concha, a helix
 * rim round the outer edge and an antihelix ridge inside it, and it rakes back
 * about 10° at the top, which is the angle that makes an ear look attached
 * rather than stuck on.
 */
function pinnaGeometry(): THREE.BufferGeometry {
  const halfW = HEAD.ear.width / 2;
  const halfH = HEAD.ear.height / 2;
  const geometry = new THREE.SphereGeometry(1, 30, 22);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const ux = position.getX(i);
    const uy = position.getY(i);
    const uz = position.getZ(i);
    // Narrow toward the lobe, widest just above the canal.
    const taper = 0.66 + 0.34 * smoothstep(-1, 0.15, uy);
    const y = uy * halfH;
    // Rake: the top of the ear sits further back than the lobe.
    const x = ux * halfW * taper + y * 0.17;
    // The ovoid straddles the skull, so its outline sits down on the skin and
    // only the outer half is ever seen.
    let z = 2 + uz * (HEAD.ear.protrusion * 0.62);
    // Concha: a bowl pressed into the outer face, in front of and below centre.
    const dx = (x + 3) / 9;
    const dy = (y + 3) / 11;
    const bowl = 7.5 * Math.exp(-dx * dx - dy * dy) * smoothstep(-0.1, 0.6, uz);
    z -= bowl;
    position.setXYZ(i, x, y, z);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** The helix rim: a partial torus round the outer edge, flattened to the ear. */
function helixGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.TorusGeometry(1, 0.115, 10, 44, Math.PI * 1.5);
  geometry.scale(HEAD.ear.width * 0.52, HEAD.ear.height * 0.46, HEAD.ear.width * 0.3);
  // The gap in the arc goes to the bottom front, where the lobe and the tragus
  // take over from the rim.
  geometry.rotateZ(-Math.PI * 0.42);
  geometry.translate(1.5, 2, HEAD.ear.protrusion * 0.42);
  return geometry;
}

/** The antihelix: the Y-shaped ridge inside the rim, standing in as one arc. */
function antihelixGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.TorusGeometry(1, 0.12, 8, 28, Math.PI * 1.05);
  geometry.scale(HEAD.ear.width * 0.3, HEAD.ear.height * 0.3, HEAD.ear.width * 0.2);
  geometry.rotateZ(-Math.PI * 0.3);
  geometry.translate(2.5, 3, HEAD.ear.protrusion * 0.45);
  return geometry;
}

// ---------------------------------------------------------------- the build

export function buildHead(materials: Materials): Built {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const own = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    return mesh;
  };

  // ---- skin. The φ range runs pole to pole, so the surface closes under the
  // jaw on its own: the head has no neck and a hole there would be visible from
  // the camera's raised three-quarter view.
  add(
    own(
      surfaceGeometry({
        thetaSegments: 200,
        phiSegments: 152,
        phiFrom: -HALF_PI,
        phiTo: HALF_PI,
      }),
    ),
    materials.skin,
  );

  // ---- buzz cut. The same surface pushed out along its own normal, so it can
  // never clip through the skin however the sculpt changes. 4 mm of clipper
  // stubble in the middle, tapering to 0.6 mm at the hairline — a shell that
  // met the skin exactly would z-fight, and one with a square edge would read
  // as a helmet.
  add(
    own(
      surfaceGeometry({
        thetaSegments: 176,
        phiSegments: 96,
        phiFrom: -0.25,
        phiTo: HALF_PI,
        offset: (theta, phi) => 0.6 + 3.4 * smoothstep(0, 0.3, phi - hairline(theta)),
        keep: (theta, phi) => phi > hairline(theta),
      }),
    ),
    materials.hair,
  );

  // ---- ears. Seated by solving the surface for the θ that puts them at
  // HEAD.ear.z behind the head's centre, so they sit where the fixture's pads
  // expect them whatever the sculpt does, and wherever the head is sitting.
  // The far ear is a true mirror, winding included.
  const earPhi = Math.asin(HEAD.ear.y / HEAD.radii.y);
  const pinnaLeft = own(pinnaGeometry());
  const helixLeft = own(helixGeometry());
  const antihelixLeft = own(antihelixGeometry());
  const tragus = own(new THREE.SphereGeometry(1, 12, 10));
  const canal = own(new THREE.SphereGeometry(3.4, 12, 10));
  const parts: Array<[THREE.BufferGeometry, THREE.Material]> = [];
  for (const side of [1, -1] as const) {
    const theta = thetaAtDepth(earPhi, HEAD.centre.z + HEAD.ear.z, side);
    const sample = headSurface(theta, earPhi);
    const ear = new THREE.Group();
    seat(ear, sample.skin, sample.normal);
    // The seat frames are both right-handed, which means local +X runs toward
    // the back of the head on one side and toward the face on the other: the
    // geometry itself has to be mirrored to keep the pair chiral.
    const pinna = side > 0 ? pinnaLeft : own(mirroredX(pinnaLeft));
    const helix = side > 0 ? helixLeft : own(mirroredX(helixLeft));
    const antihelix = side > 0 ? antihelixLeft : own(mirroredX(antihelixLeft));
    ear.add(new THREE.Mesh(pinna, materials.skin));
    ear.add(new THREE.Mesh(helix, materials.skin));
    ear.add(new THREE.Mesh(antihelix, materials.skin));
    // Tragus: the flap over the canal, on the face side of the concha.
    const flap = new THREE.Mesh(tragus, materials.skin);
    flap.scale.set(3.6, 5.4, 4.5);
    flap.position.set(-side * 8.5, -2, 7);
    ear.add(flap);
    // The canal itself, dark, sunk behind the tragus.
    const hole = new THREE.Mesh(canal, materials.brow);
    hole.scale.set(1, 1.2, 0.7);
    hole.position.set(-side * 3.5, -3.5, 4.5);
    ear.add(hole);
    group.add(ear);
  }

  // ---- eyes. The eyeball is set into the socket the sculpt already hollowed,
  // proud of it by 2.5 mm so the lids have something to sit on. The gaze is
  // blended toward +Z rather than following the socket normal: real eyes look
  // ahead, and a pair that splayed 30° apart would read as a doll's.
  const eyeball = own(new THREE.SphereGeometry(HEAD.eye.radius, 28, 20));
  const irisCap = own(
    new THREE.SphereGeometry(HEAD.eye.radius * 1.004, 28, 12, 0, Math.PI * 2, 0, 0.5),
  );
  const pupilCap = own(
    new THREE.SphereGeometry(HEAD.eye.radius * 1.012, 20, 8, 0, Math.PI * 2, 0, 0.22),
  );
  // Lids: spherical caps 1 mm clear of the ball, on axes tilted up-and-back and
  // down-and-back. The half-angles put the upper edge 14° above the gaze — just
  // over the top of the iris — and the lower 25° below, an 8 mm fissure.
  const upperLid = own(
    new THREE.SphereGeometry(HEAD.eye.radius + 1, 30, 16, 0, Math.PI * 2, 0, 1.938),
  );
  const lowerLid = own(
    new THREE.SphereGeometry(HEAD.eye.radius + 1, 30, 16, 0, Math.PI * 2, 0, 1.745),
  );
  for (const side of [1, -1] as const) {
    const sample = headSurface(side * LANDMARKS.eye.theta, LANDMARKS.eye.phi);
    const gaze = new THREE.Vector3(sample.normal.x, sample.normal.y, sample.normal.z)
      .multiplyScalar(0.4)
      .addScaledVector(new THREE.Vector3(0, 0, 1), 0.6)
      .normalize();
    const centre = new THREE.Vector3(sample.skin.x, sample.skin.y, sample.skin.z)
      .addScaledVector(new THREE.Vector3(sample.normal.x, sample.normal.y, sample.normal.z), -9.5);
    const eye = new THREE.Group();
    seat(eye, centre, gaze);
    eye.add(new THREE.Mesh(eyeball, materials.eyeWhite));
    // The caps are built around +Y; rotating them onto +Z aims them at the gaze.
    const iris = new THREE.Mesh(irisCap, materials.iris);
    iris.rotation.x = HALF_PI;
    eye.add(iris);
    const pupil = new THREE.Mesh(pupilCap, materials.brow);
    pupil.rotation.x = HALF_PI;
    eye.add(pupil);
    for (const [cap, tilt] of [
      [upperLid, -0.611],
      [lowerLid, -2.531],
    ] as const) {
      const lid = new THREE.Mesh(cap, materials.skin);
      lid.rotation.x = tilt;
      // Widened across the face: a fissure limited to the ball's own silhouette
      // would be 21 mm; a real one is 30.
      lid.scale.x = 1.14;
      eye.add(lid);
    }
    group.add(eye);
  }

  // ---- eyebrows. A ribbon laid on the brow ridge, following the surface and
  // its normal, 1 mm proud so it never sinks into the skin. It arches: inner
  // head low, peak two thirds out, tail falling away.
  const brow = LANDMARKS.brow;
  for (const side of [1, -1] as const) {
    const steps = 26;
    const positions = new Float32Array((steps + 1) * 2 * 3);
    const normals = new Float32Array((steps + 1) * 2 * 3);
    const uvs = new Float32Array((steps + 1) * 2 * 2);
    const indices: number[] = [];
    const at = (t: number) => {
      const theta = side * (brow.thetaInner + (brow.thetaOuter - brow.thetaInner) * t);
      const phi =
        brow.phiInner * (1 - t) + brow.phiOuter * t + 0.055 * Math.sin(Math.PI * t);
      return headSurface(theta, phi);
    };
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const here = at(t);
      const ahead = at(Math.min(1, t + 0.02));
      const behind = at(Math.max(0, t - 0.02));
      const tangent = new THREE.Vector3(
        ahead.skin.x - behind.skin.x,
        ahead.skin.y - behind.skin.y,
        ahead.skin.z - behind.skin.z,
      ).normalize();
      const normal = new THREE.Vector3(here.normal.x, here.normal.y, here.normal.z);
      const across = new THREE.Vector3().crossVectors(normal, tangent).normalize();
      // Thick at the head, tapering to the tail, and closed off at both ends.
      const width = 4.3 * (1 - 0.45 * t) * (1 - 0.8 * Math.pow(2 * t - 1, 6));
      const base = new THREE.Vector3(here.skin.x, here.skin.y, here.skin.z).addScaledVector(
        normal,
        1.0,
      );
      for (const [lane, sign] of [
        [0, 1],
        [1, -1],
      ] as const) {
        const k = (i * 2 + lane) * 3;
        positions[k] = base.x + across.x * width * sign;
        positions[k + 1] = base.y + across.y * width * sign;
        positions[k + 2] = base.z + across.z * width * sign;
        normals[k] = normal.x;
        normals[k + 1] = normal.y;
        normals[k + 2] = normal.z;
        uvs[(i * 2 + lane) * 2] = t;
        uvs[(i * 2 + lane) * 2 + 1] = lane;
      }
      if (i > 0) {
        const a = (i - 1) * 2;
        // Wound so (v0, v1, next v0) faces along the surface normal.
        if (side > 0) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        else indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    add(own(geometry), materials.brow);
  }

  // ---- lips. The relief is already sculpted into the skin; this is the colour
  // of it — a lens-shaped patch of the same surface, 0.35 mm proud, spanning
  // both vermilions with the crease of the mouth across its waist.
  const mouth = LANDMARKS.mouth;
  {
    const rows = 26;
    const cols = 36;
    const positions = new Float32Array((rows + 1) * (cols + 1) * 3);
    const normals = new Float32Array((rows + 1) * (cols + 1) * 3);
    const uvs = new Float32Array((rows + 1) * (cols + 1) * 2);
    const indices: number[] = [];
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      const phi = mouth.phi - mouth.halfPhi + 2 * mouth.halfPhi * v;
      // Elliptical outline, so the patch tapers to the corners of the mouth.
      const half = mouth.halfTheta * Math.sqrt(Math.max(0, 1 - (2 * v - 1) ** 2));
      for (let i = 0; i <= cols; i++) {
        const theta = -half + (2 * half * i) / cols;
        const s = headSurface(theta, phi);
        const k = (j * (cols + 1) + i) * 3;
        positions[k] = s.skin.x + s.normal.x * 0.35;
        positions[k + 1] = s.skin.y + s.normal.y * 0.35;
        positions[k + 2] = s.skin.z + s.normal.z * 0.35;
        normals[k] = s.normal.x;
        normals[k + 1] = s.normal.y;
        normals[k + 2] = s.normal.z;
        uvs[(j * (cols + 1) + i) * 2] = i / cols;
        uvs[(j * (cols + 1) + i) * 2 + 1] = v;
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        const b = a + 1;
        const c = b + cols + 1;
        const d = a + cols + 1;
        indices.push(a, b, d, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    add(own(geometry), materials.lips);
  }

  // ---- nostrils. The sculpt dimples them, but a radial height field cannot
  // undercut, so the dark of the opening has to be a mesh: a small squashed
  // ellipsoid sunk into each dimple.
  const nostril = own(new THREE.SphereGeometry(1, 14, 10));
  for (const side of [1, -1] as const) {
    const sample = headSurface(side * LANDMARKS.nostril.theta, LANDMARKS.nostril.phi);
    const mesh = new THREE.Mesh(nostril, materials.brow);
    seat(mesh, sample.skin, sample.normal);
    mesh.scale.set(2.6, 4.0, 2.6);
    mesh.translateZ(-2.2);
    group.add(mesh);
  }

  return {
    object: group,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      geometries.length = 0;
    },
  };
}
