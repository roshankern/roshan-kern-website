import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { COLORS, HEAD, type Materials } from "./contracts";

/**
 * The shared material set for the robot-scan figure.
 *
 * Everything here exists because the figure is made of primitives: boxes and
 * cylinders at true millimetre sizes, with no modelled detail at all. The only
 * thing that can make a box read as a 3D-printed shell rather than as a box is
 * its surface, so this file carries the whole illusion — an image-based
 * environment for the metals and glass to reflect, and a handful of procedural
 * maps that put print layers, moulding noise, pores and stubble on surfaces
 * that are geometrically perfectly flat.
 *
 * Two rules the rest of the folder depends on:
 *   - no builder creates a material of its own; it pulls one from here,
 *   - every material and every texture is owned by this file, so dispose()
 *     is one list to walk and nothing else in the app has to remember.
 *
 * Canvas work happens inside createMaterials(), never at module scope: the
 * module is only ever reached through an `ssr: false` import, but a top-level
 * `document` would still break any tooling that so much as evaluates it.
 */

// ------------------------------------------------------------- real sizes
// Procedural detail is only convincing if its scale is right, so every repeat
// below is derived from the millimetre size of the thing it lands on rather
// than dialled in by eye.

/** FDM layer height on a 0.4 mm nozzle. The whole SO-101 is printed at this. */
const LAYER_MM = 0.2;
/** Pixel rows per layer in the normal map: enough to carry a rounded bead. */
const LAYER_PX = 8;
/** Layers in one tile. 32 × 0.2 mm = a 6.4 mm tile, which repeats invisibly. */
const LAYERS_PER_TILE = 32;
const LAYER_TILE_MM = LAYER_MM * LAYERS_PER_TILE;
/**
 * Representative printed part, mm. The arm's links run 30–140 mm and box UVs
 * are per-face 0–1 regardless of size, so one repeat has to serve them all;
 * 90 mm is the middle of the range and puts the error under a factor of two
 * either way, which for a 0.2 mm feature nobody can see.
 */
const PRINTED_PART_MM = 90;

/**
 * Skin and hair maps land on a head-shaped mesh whose UVs wrap once around and
 * once top-to-bottom, so their repeats come from the head's real girth and
 * height: Ramanujan-ish mean radius of the 76 × 98 ellipse, and menton-to-vertex.
 */
const HEAD_GIRTH_MM = 2 * Math.PI * Math.sqrt((HEAD.radii.x ** 2 + HEAD.radii.z ** 2) / 2);
const HEAD_HEIGHT_MM = 2 * HEAD.radii.y;
/** Pore tile. 512 px over 25 mm with 24-px noise cells puts a pore at ~1 mm. */
const PORE_TILE_MM = 25;
/** Stubble tile. Shorter, because a buzz cut is a ~1 mm follicle grid. */
const STUBBLE_TILE_MM = 16;

// ------------------------------------------------------------ noise plumbing

/** mulberry32: small, fast, and seeded, so a reload builds the same surface. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Value noise on a `cells × cells` lattice, sampled into a `size × size` field.
 * The lattice wraps, so the field tiles seamlessly — which matters, because
 * every one of these textures is set to RepeatWrapping over a whole limb.
 */
function latticeNoise(size: number, cells: number, seed: number): Float32Array {
  const rand = mulberry32(seed);
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = rand();

  const out = new Float32Array(size * size);
  const scale = cells / size;
  for (let y = 0; y < size; y += 1) {
    const fy = y * scale;
    const y0 = Math.floor(fy) % cells;
    const y1 = (y0 + 1) % cells;
    const ty = smoothstep(fy - Math.floor(fy));
    for (let x = 0; x < size; x += 1) {
      const fx = x * scale;
      const x0 = Math.floor(fx) % cells;
      const x1 = (x0 + 1) % cells;
      const tx = smoothstep(fx - Math.floor(fx));
      const a = lattice[y0 * cells + x0] + (lattice[y0 * cells + x1] - lattice[y0 * cells + x0]) * tx;
      const b = lattice[y1 * cells + x0] + (lattice[y1 * cells + x1] - lattice[y1 * cells + x0]) * tx;
      out[y * size + x] = a + (b - a) * ty;
    }
  }
  return out;
}

/** Octaves of latticeNoise, normalised to 0–1. Detail without a visible grid. */
function fbm(size: number, cells: number, octaves: number, seed: number): Float32Array {
  const out = new Float32Array(size * size);
  let amplitude = 1;
  let total = 0;
  for (let o = 0; o < octaves; o += 1) {
    const layer = latticeNoise(size, cells * 2 ** o, seed + o * 101);
    for (let i = 0; i < out.length; i += 1) out[i] += layer[i] * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  for (let i = 0; i < out.length; i += 1) out[i] /= total;
  return out;
}

/**
 * Height field → tangent-space normal map, by central differences with wrap.
 * `strength` is the height in units of one texel, so it scales with `size`;
 * the caller tunes visible depth with normalScale instead of with this.
 */
function heightToNormal(
  height: Float32Array,
  size: number,
  strength: number,
  ctx: CanvasRenderingContext2D,
): void {
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      // The surface tangent's cross product, normalised: (-dx, -dy, 1).
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * size + x) * 4;
      data[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function canvas2d(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  // Only null when the browser refuses a 2D context outright; there is no
  // sensible fallback for a figure whose entire look is these canvases.
  if (!ctx) throw new Error("robot-scan/materials: no 2D canvas context");
  return { canvas, ctx };
}

const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;

/** ctx.roundRect is still not in every lib.dom we build against. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ------------------------------------------------------------ the textures

/**
 * Print layer lines. Each layer is a rounded extrusion bead: the height is a
 * cosine that bottoms out at the seam, so the steepest tilt — the part the eye
 * actually reads — sits on the flanks, not at the seam. A per-layer amplitude
 * jitter and a low-harmonic wobble along the bead keep it from looking like a
 * ruled grating; both are periodic in x so the tile still wraps.
 */
function makeLayerLinesTexture(): THREE.CanvasTexture {
  const width = 64;
  const height = LAYER_PX * LAYERS_PER_TILE;
  const { canvas, ctx } = canvas2d(width, height);
  const image = ctx.createImageData(width, height);
  const data = image.data;
  const rand = mulberry32(4021);
  const jitter = new Float32Array(LAYERS_PER_TILE);
  for (let i = 0; i < LAYERS_PER_TILE; i += 1) jitter[i] = 0.8 + rand() * 0.45;

  for (let y = 0; y < height; y += 1) {
    const layer = Math.floor(y / LAYER_PX);
    const frac = ((y % LAYER_PX) + 0.5) / LAYER_PX;
    // dh/dv of h = -cos(2π·frac); the normal tilts against the slope.
    const slope = -Math.sin(2 * Math.PI * frac) * 0.55 * jitter[layer];
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const wobble =
        0.11 * Math.sin(2 * Math.PI * (3 * u + layer * 0.37)) +
        0.06 * Math.sin(2 * Math.PI * (7 * u - layer * 0.19));
      const ny = Math.max(-0.92, Math.min(0.92, slope + wobble * 0.25));
      const nx = wobble * 0.4;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const i = (y * width + x) * 4;
      data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  const repeat = PRINTED_PART_MM / LAYER_TILE_MM;
  texture.repeat.set(repeat, repeat);
  return texture;
}

/**
 * Faint mottle for roughness maps. Kept in the 0.82–1.0 range because a
 * roughness map multiplies the material's own roughness: this only breaks up
 * a perfectly uniform highlight, it does not set the gloss level.
 */
function makeSpeckleTexture(): THREE.CanvasTexture {
  const size = 256;
  const { canvas, ctx } = canvas2d(size, size);
  const field = fbm(size, 12, 4, 917);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let i = 0; i < field.length; i += 1) {
    const v = Math.round((0.82 + field[i] * 0.18) * 255);
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

/**
 * Skin: fine, dense, shallow. Two octaves off a 24-px lattice give roughly
 * 1 mm cells at the tile scale below, which is what a pore field measures.
 * The amplitude is deliberately tiny — visible relief on skin reads as damage.
 */
function makePoreTexture(): THREE.CanvasTexture {
  const size = 512;
  const { canvas, ctx } = canvas2d(size, size);
  heightToNormal(fbm(size, 24, 3, 3313), size, 6, ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    Math.round(HEAD_GIRTH_MM / PORE_TILE_MM),
    Math.round(HEAD_HEIGHT_MM / PORE_TILE_MM),
  );
  return texture;
}

/**
 * Buzz cut: the same machinery at a higher lattice frequency and several times
 * the height, so it grabs the light as a field of cut ends rather than as skin.
 */
function makeStubbleTexture(): THREE.CanvasTexture {
  const size = 512;
  const { canvas, ctx } = canvas2d(size, size);
  heightToNormal(fbm(size, 48, 2, 7717), size, 26, ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    Math.round(HEAD_GIRTH_MM / STUBBLE_TILE_MM),
    Math.round(HEAD_HEIGHT_MM / STUBBLE_TILE_MM),
  );
  return texture;
}

/**
 * The phone is running the capture app, so the screen has to be lit and has to
 * read as a dermatology viewfinder in the half second anyone looks at it: a
 * big live-preview panel warmed by the ring light, a focus reticle, three
 * marked lesions, a control strip, a progress bar. No lettering — at the size
 * this occupies on screen any glyph turns to mush, and mush reads as a bug.
 *
 * 1024 × 512 over a 149.6 × 71.5 mm phone is about 7 px/mm, which is finer
 * than the figure ever resolves.
 */
function makeScreenTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const { canvas, ctx } = canvas2d(w, h);
  const accent = css(COLORS.printedAccent);

  ctx.fillStyle = css(COLORS.phoneScreen);
  ctx.fillRect(0, 0, w, h);

  // Live preview: skin under the shroud's ring light, so a warm field with a
  // bright centre and falloff to the corners.
  const px = 34;
  const py = 30;
  const pw = w - px * 2;
  const ph = h - py - 96;
  ctx.save();
  roundedRect(ctx, px, py, pw, ph, 26);
  ctx.clip();
  const glow = ctx.createRadialGradient(w / 2, py + ph * 0.44, 40, w / 2, py + ph * 0.44, pw * 0.62);
  glow.addColorStop(0, "#8a5c48");
  glow.addColorStop(0.55, "#5a3a2d");
  glow.addColorStop(1, "#241a16");
  ctx.fillStyle = glow;
  ctx.fillRect(px, py, pw, ph);
  // A few soft blobs so the preview is not a clean gradient.
  const rand = mulberry32(51);
  for (let i = 0; i < 26; i += 1) {
    const bx = px + rand() * pw;
    const by = py + rand() * ph;
    const br = 12 + rand() * 46;
    const blob = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    blob.addColorStop(0, `rgba(${rand() > 0.5 ? "255,214,186" : "96,54,44"},0.16)`);
    blob.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = blob;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  ctx.restore();

  // Focus box: corner ticks only, the way a capture app draws one.
  const fw = 250;
  const fh = 200;
  const fx = (w - fw) / 2;
  const fy = py + (ph - fh) / 2;
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  const tick = 42;
  for (const [cx, cy, sx, sy] of [
    [fx, fy, 1, 1],
    [fx + fw, fy, -1, 1],
    [fx, fy + fh, 1, -1],
    [fx + fw, fy + fh, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * tick, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * tick);
    ctx.stroke();
  }

  // Three flagged lesions, ringed in the accent.
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  for (const [lx, ly, lr] of [
    [fx + 62, fy + 74, 17],
    [fx + 172, fy + 128, 11],
    [fx + 214, fy + 46, 8],
  ]) {
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Control strip along the bottom edge: shutter, flanked by mode pills.
  const strip = h - 46;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.beginPath();
  ctx.arc(w / 2, strip, 27, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w / 2, strip, 35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.26)";
  for (const [offset, pillWidth] of [
    [-210, 74],
    [-120, 52],
    [120, 52],
    [210, 74],
  ]) {
    roundedRect(ctx, w / 2 + offset - pillWidth / 2, strip - 11, pillWidth, 22, 11);
    ctx.fill();
  }

  // Scan progress: the coarse pass, part way round.
  const bx = px;
  const bw = pw;
  const by = h - 12;
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  roundedRect(ctx, bx, by, bw, 6, 3);
  ctx.fill();
  ctx.fillStyle = accent;
  roundedRect(ctx, bx, by, bw * 0.62, 6, 3);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  // Authored as sRGB pixels; without this the whole UI renders washed out.
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// -------------------------------------------------------------- the export

export function createMaterials(renderer: THREE.WebGLRenderer, scene: THREE.Scene): Materials {
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const own = <T extends THREE.Material>(material: T): T => {
    materials.push(material);
    return material;
  };
  const ownTexture = <T extends THREE.Texture>(texture: T): T => {
    // Layer lines and pores are both seen at grazing angles across a whole
    // limb, which is exactly where isotropic mipmapping smears them to grey.
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textures.push(texture);
    return texture;
  };

  // ---- environment. The scene background stays black, but the metals, the
  // glass back and the lens need something to reflect or they render as flat
  // paint: a PMREM of the standard room gives them a lit interior to mirror.
  // sigma 0.03 knocks the hard edges off the room's boxes so a rough metal
  // does not pick up recognisable rectangles.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.03).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = environment;
  // The scene also carries its own key and ring lights; at 1.0 the room would
  // lift the black prints off black and flatten the whole contrast range.
  scene.environmentIntensity = 0.8;

  // ---- shared maps. Each canvas is generated once and handed to every
  // material that wants it, so the print family is three materials over one
  // texture rather than three copies of the same megabyte.
  const layerLines = ownTexture(makeLayerLinesTexture());
  const speckle = ownTexture(makeSpeckleTexture());
  const pores = ownTexture(makePoreTexture());
  const stubble = ownTexture(makeStubbleTexture());
  const screen = ownTexture(makeScreenTexture());

  /** PLA off a hobby printer: dead matte, and layered. */
  const printed = (color: number) =>
    own(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.75,
        metalness: 0,
        normalMap: layerLines,
        // Strong enough to notice on a zoom, weak enough not to read as corduroy.
        normalScale: new THREE.Vector2(0.35, 0.35),
      }),
    );

  const table = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.table,
      roughness: 0.92,
      metalness: 0,
      roughnessMap: speckle,
    }),
  );

  const printedDark = printed(COLORS.printedDark);
  const printedLight = printed(COLORS.printedLight);
  const printedAccent = printed(COLORS.printedAccent);

  // Injection-moulded ABS: a mould's texture is far finer than a print's, so
  // no layer lines at all — just a gloss a step up from the prints, broken up
  // so the servo's flat sides do not all catch the key light identically.
  const servoCase = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.servoCase,
      roughness: 0.5,
      metalness: 0,
      roughnessMap: speckle,
    }),
  );

  const servoHorn = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.servoHorn,
      roughness: 0.3,
      metalness: 1,
    }),
  );

  const hardware = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.hardware,
      roughness: 0.35,
      metalness: 1,
    }),
  );

  // Bead-blasted then polished anodised aluminium — the phone's band is the
  // shiniest metal in the figure and the one that sells the environment map.
  const phoneRail = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.phoneRail,
      roughness: 0.18,
      metalness: 1,
    }),
  );

  // Glass over a coloured back plate, so: a dielectric base with a clearcoat.
  // Without the clearcoat the low roughness alone just reads as fresh paint.
  const phoneBack = own(
    new THREE.MeshPhysicalMaterial({
      color: COLORS.phoneBack,
      roughness: 0.12,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
  );

  const phoneIsland = own(
    new THREE.MeshPhysicalMaterial({
      color: COLORS.phoneIsland,
      roughness: 0.07,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.3,
    }),
  );

  // The screen is a light source in the picture, not a lit surface: the same
  // canvas drives colour and emission so the UI glows in its own colours.
  const phoneScreen = own(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: screen,
      emissive: 0xffffff,
      emissiveMap: screen,
      // Enough to read as "on" without blowing out under the tone mapper.
      emissiveIntensity: 0.9,
      roughness: 0.22,
      metalness: 0,
    }),
  );

  const lensRing = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.lensRing,
      roughness: 0.22,
      metalness: 1,
    }),
  );

  // A real lens element is a near-black well with one hard specular on it, so:
  // almost no roughness, a coated clearcoat, and an over-unity envMapIntensity
  // to guarantee it catches a highlight from whatever angle the camera orbits to.
  const lensGlass = own(
    new THREE.MeshPhysicalMaterial({
      color: COLORS.lensGlass,
      roughness: 0.03,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      ior: 1.75,
      envMapIntensity: 1.8,
    }),
  );

  const shroudOuter = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.shroudOuter,
      roughness: 0.85,
      metalness: 0,
      normalMap: layerLines,
      normalScale: new THREE.Vector2(0.3, 0.3),
    }),
  );

  // A light trap: maximum roughness and, more importantly, the environment
  // turned almost off, so the inside of the cone stays black even when the
  // room map would otherwise fill it and kill the ring light's contribution.
  const shroudInner = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.shroudInner,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.05,
    }),
  );

  // Above 1 so the ring reads as a source and the composer's bloom, if the
  // scene runs one, has something over threshold to catch.
  const led = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.led,
      emissive: COLORS.led,
      emissiveIntensity: 3,
      roughness: 0.4,
      metalness: 0,
    }),
  );

  /**
   * Skin. Three things separate skin from painted plastic, and none of them is
   * subsurface scattering — transmission here would cost a lot and land on
   * "wax" nine times out of ten. Instead: a broad rough diffuse, a weak and
   * very blurred clearcoat for the oil film, and a warm sheen for the peach
   * fuzz that lights the silhouette. The pore normal map does the rest.
   */
  const skin = own(
    new THREE.MeshPhysicalMaterial({
      color: COLORS.skin,
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.15,
      clearcoatRoughness: 0.6,
      sheen: 0.4,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color(0xd8a184),
      normalMap: pores,
      normalScale: new THREE.Vector2(0.28, 0.28),
    }),
  );

  // Lips are wet: darker, a real gloss, and almost no fuzz to catch the rim.
  const lips = own(
    new THREE.MeshPhysicalMaterial({
      color: COLORS.lips,
      roughness: 0.34,
      metalness: 0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.22,
      sheen: 0.12,
      sheenColor: new THREE.Color(0xc08a7a),
      normalMap: pores,
      normalScale: new THREE.Vector2(0.18, 0.18),
    }),
  );

  const brow = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.brow,
      roughness: 0.88,
      metalness: 0,
      normalMap: stubble,
      normalScale: new THREE.Vector2(0.7, 0.7),
    }),
  );

  // A buzz cut is a rough dark surface, not strands: no anisotropy to fake,
  // just maximum roughness and enough normal relief to break the silhouette.
  const hair = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.hair,
      roughness: 0.9,
      metalness: 0,
      normalMap: stubble,
      normalScale: new THREE.Vector2(0.9, 0.9),
    }),
  );

  // A wet eye's specular is the strongest highlight on a face; the sclera has
  // to be glossy or the head reads as a mannequin.
  const eyeWhite = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.eyeWhite,
      roughness: 0.14,
      metalness: 0,
      envMapIntensity: 1.2,
    }),
  );

  const iris = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.iris,
      roughness: 0.35,
      metalness: 0,
      envMapIntensity: 1.2,
    }),
  );

  const fixtureMetal = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.fixtureMetal,
      roughness: 0.4,
      metalness: 1,
    }),
  );

  // Closed-cell foam against the skin: no gloss anywhere on it.
  const fixturePad = own(
    new THREE.MeshStandardMaterial({
      color: COLORS.fixturePad,
      roughness: 0.95,
      metalness: 0,
      roughnessMap: speckle,
    }),
  );

  return {
    table,
    printedDark,
    printedLight,
    printedAccent,
    servoCase,
    servoHorn,
    hardware,
    phoneRail,
    phoneBack,
    phoneIsland,
    phoneScreen,
    lensRing,
    lensGlass,
    shroudOuter,
    shroudInner,
    led,
    skin,
    lips,
    brow,
    hair,
    eyeWhite,
    iris,
    fixtureMetal,
    fixturePad,
    dispose() {
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      materials.length = 0;
      textures.length = 0;
      // The PMREM target is ours too, and nothing else in the app holds it.
      environment.dispose();
      if (scene.environment === environment) scene.environment = null;
    },
  };
}
