// Lengthens the penis in the AnyHealth atlas. Applied by
// scripts/encode-anyhealth-atlas.mjs to the upstream float positions before
// they are quantized, so the served model, its bounds, and picking all agree.
//
// Upstream, the flaccid penis runs about 7.9 cm from the pubic skin to the tip
// of the glans. Here that is 17 cm, with 20% more girth, and the same bend.
//
// The deformation follows the shaft's curved centreline. Each vertex is taken
// as a point s along the centreline plus an offset d across it. The new
// centreline retraces the old one's direction at every point, with its length
// stretched by LENGTH along the shaft and by GIRTH along the glans, so the bend
// keeps its shape and the glans only grows by the girth factor. Offsets grow by
// GIRTH. Above the root (inside the body) nothing moves, and the crura and bulb
// behind z 0.015 m stay where they are. Coordinates are model space in metres:
// y up, +x the body's left, +z front.
//
// The body surface (Skin) is left as is.

/** Stretch of the shaft between the root and the glans; set so the pubic-skin-to-tip length is 17 cm. */
const LENGTH = 3.15;
/** Growth across the shaft, and of the glans in every direction. */
const GIRTH = 1.2;

const PENIS = /^(Corpus cavernosum of penis|Corpus spongiosum of penis|Glans penis|Urethra|.*dorsal (artery|vein) of penis)$/;

export const isPenis = (part) => PENIS.test(part.name);

const smoothstep = (a, b, t) => {
	const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
	return k * k * (3 - 2 * k);
};

/** Centreline in the midline (x 0), [y, z], from inside the body down past the tip, measured from slices of the shaft. */
const CONTROL = [[0.872, 0.058], [0.858, 0.066], [0.842, 0.075], [0.83, 0.0815], [0.818, 0.085], [0.806, 0.086], [0.794, 0.086], [0.78, 0.086]];
/** Where the shaft leaves the pubic skin, and where the glans begins (its crown). */
const ROOT_Y = 0.858, GLANS_Y = 0.818;

/** Dense centreline: Catmull-Rom through CONTROL, with arc length s (0 at the root, positive toward the tip) and the stretched copy. */
const curve = (() => {
	const pts = [];
	for (let i = 0; i < CONTROL.length - 1; i++) {
		const p0 = CONTROL[Math.max(0, i - 1)], p1 = CONTROL[i], p2 = CONTROL[i + 1], p3 = CONTROL[Math.min(CONTROL.length - 1, i + 2)];
		for (let k = 0; k < 60; k++) {
			const t = k / 60, t2 = t * t, t3 = t2 * t;
			const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
			pts.push([0, f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
		}
	}
	const last = CONTROL[CONTROL.length - 1];
	pts.push([0, last[0], last[1]]);
	const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
	const s = [0];
	for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + dist(pts[i], pts[i - 1]));
	const sAtY = (y) => { let i = 0; while (i < pts.length - 1 && pts[i + 1][1] > y) i++; return s[i]; };
	const s0 = sAtY(ROOT_Y), sGlans = sAtY(GLANS_Y) - s0;
	for (let i = 0; i < s.length; i++) s[i] -= s0;
	// Length stretch along the centreline: 1 in the body, LENGTH along the shaft, GIRTH along the glans.
	const stretch = (u) => {
		const shaft = 1 + (LENGTH - 1) * smoothstep(0, 0.008, u);
		return shaft + (GIRTH - shaft) * smoothstep(sGlans - 0.004, sGlans + 0.002, u);
	};
	const moved = pts.map((p) => [...p]), root = s.findIndex((v) => v >= 0);
	for (let i = root + 1; i < pts.length; i++) {
		const k = stretch((s[i] + s[i - 1]) / 2);
		for (let d = 0; d < 3; d++) moved[i][d] = moved[i - 1][d] + k * (pts[i][d] - pts[i - 1][d]);
	}
	return {pts, moved, s};
})();

/** Girth growth at arc length u: 1 in the body, ramping to GIRTH just past the root. */
const girth = (u) => 1 + (GIRTH - 1) * smoothstep(0, 0.008, u);

/** Nearest centreline point to v: segment i, fraction t, arc length s. */
function project(v) {
	const {pts, s} = curve;
	let best = {d: Infinity, i: 0, t: 0};
	for (let i = 0; i < pts.length - 1; i++) {
		const a = pts[i], b = pts[i + 1], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
		const t = Math.min(1, Math.max(0, ((v[0] - a[0]) * ab[0] + (v[1] - a[1]) * ab[1] + (v[2] - a[2]) * ab[2]) / len2));
		const d = Math.hypot(v[0] - a[0] - t * ab[0], v[1] - a[1] - t * ab[1], v[2] - a[2] - t * ab[2]);
		if (d < best.d) best = {d, i, t};
	}
	return {...best, s: s[best.i] + best.t * (s[best.i + 1] - s[best.i])};
}

/**
 * Deforms one part in place. `positions` is a Float32Array (xyz), `normals` an
 * Int16Array (xyz, /32767). A normal's component along the centreline shrinks
 * by the length stretch and the rest by the girth growth, as a stretch does.
 */
export function deformPart(positions, normals) {
	const {pts, moved} = curve;
	for (let i = 0; i < positions.length; i += 3) {
		const v = [positions[i], positions[i + 1], positions[i + 2]];
		const w = smoothstep(0.015, 0.035, v[2]);
		if (w <= 0) continue;
		const {i: k, t, s} = project(v);
		if (s <= 0) continue;
		const a = pts[k], b = pts[k + 1], A = moved[k], B = moved[k + 1];
		const c = [0, 1, 2].map((d) => a[d] + t * (b[d] - a[d])), c2 = [0, 1, 2].map((d) => A[d] + t * (B[d] - A[d]));
		const g = girth(s);
		for (let d = 0; d < 3; d++) positions[i + d] = v[d] + w * (c2[d] + g * (v[d] - c[d]) - v[d]);

		const seg = [0, 1, 2].map((d) => b[d] - a[d]), segLen = Math.hypot(...seg), tangent = seg.map((x) => x / segLen);
		const along = Math.hypot(...[0, 1, 2].map((d) => B[d] - A[d])) / segLen;
		const n = [normals[i], normals[i + 1], normals[i + 2]].map((x) => x / 32767);
		const nt = n[0] * tangent[0] + n[1] * tangent[1] + n[2] * tangent[2];
		const lambda = 1 + w * (along - 1), gw = 1 + w * (g - 1);
		const out = [0, 1, 2].map((d) => (nt * tangent[d]) / lambda + (n[d] - nt * tangent[d]) / gw);
		const len = Math.hypot(...out) || 1;
		for (let d = 0; d < 3; d++) normals[i + d] = Math.round((out[d] / len) * 32767);
	}
}

/** Bounds of a Float32Array of xyz positions. */
export function boundsOf(positions) {
	const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
	for (let i = 0; i < positions.length; i += 3)
		for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], positions[i + d]); hi[d] = Math.max(hi[d], positions[i + d]); }
	return [lo, hi];
}
