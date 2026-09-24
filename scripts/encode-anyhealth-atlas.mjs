// Re-encodes the Human Atlas geometry (github.com/ashemag/human-atlas) into the
// compact form app/anyhealth serves from public/anyhealth/models.
//
//   node scripts/encode-anyhealth-atlas.mjs [path/to/human-atlas]
//
// The upstream chunks store float32 positions, int16 normals, and uint32
// indices, gzipped: about 33 MB. Here each part is reordered for locality,
// positions are quantized to 16 bits within the part's own bounds (well under a
// tenth of a millimetre on the largest part), normals to 8 bits, and both
// streams go through meshoptimizer's vertex and index codecs. That comes to
// about 17 MB, decoded in the browser by the meshopt decoder that ships with
// three. See app/anyhealth/atlas/scene.tsx for the reader.
import fs from "node:fs";
import path from "node:path";
import { MeshoptEncoder } from "meshoptimizer";

const source = path.resolve(process.argv[2] ?? "../human-atlas", "public/models");
const target = path.resolve("public/anyhealth/models");
/** Bytes per encoded vertex: uint16 x,y,z + pad, then int8 nx,ny,nz + pad. */
const STRIDE = 12;

await MeshoptEncoder.ready;
const atlas = JSON.parse(fs.readFileSync(path.join(source, "atlas.json"), "utf8"));
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

let total = 0;
const chunks = atlas.chunks.map((chunk, ci) => {
	const raw = fs.readFileSync(path.join(source, path.basename(chunk.url)));
	const pieces = [];
	let offset = 0;
	for (const part of atlas.parts) {
		if (part.chunk !== ci) continue;
		const at = (byte) => raw.byteOffset + byte;
		const positions = new Float32Array(raw.buffer, at(part.positions), part.vertexCount * 3);
		const normals = new Int16Array(raw.buffer, at(part.normals), part.vertexCount * 3);
		// Copied, because reorderMesh rewrites the index buffer in place.
		const indices = new Uint32Array(raw.buffer.slice(at(part.indices), at(part.indices) + part.indexCount * 4));
		const [remap, vertexCount] = MeshoptEncoder.reorderMesh(indices, true, true);

		const [lo, hi] = part.bounds;
		const vertices = new ArrayBuffer(vertexCount * STRIDE);
		const q = new Uint16Array(vertices);
		const n = new Int8Array(vertices);
		for (let i = 0; i < part.vertexCount; i++) {
			const r = remap[i];
			if (r === 0xffffffff) continue; // unused by any triangle
			for (let k = 0; k < 3; k++) {
				q[r * 6 + k] = Math.round(((positions[i * 3 + k] - lo[k]) / (hi[k] - lo[k] || 1)) * 65535);
				n[r * STRIDE + 8 + k] = Math.round((normals[i * 3 + k] / 32767) * 127);
			}
		}
		const encodedVertices = MeshoptEncoder.encodeVertexBuffer(new Uint8Array(vertices), vertexCount, STRIDE);
		const encodedIndices = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(indices.buffer), part.indexCount, 4);

		// Replace the upstream byte offsets with this file's layout.
		delete part.positions;
		delete part.normals;
		delete part.indices;
		Object.assign(part, {
			vertexCount,
			vertices: offset,
			vertexBytes: encodedVertices.byteLength,
			indices: offset + encodedVertices.byteLength,
			indexBytes: encodedIndices.byteLength,
		});
		pieces.push(encodedVertices, encodedIndices);
		offset += encodedVertices.byteLength + encodedIndices.byteLength;
	}
	const file = `body-${ci}.bin`;
	fs.writeFileSync(path.join(target, file), Buffer.concat(pieces.map((p) => Buffer.from(p))));
	total += offset;
	return { url: `/anyhealth/models/${file}`, bytes: offset };
});

atlas.chunks = chunks;
atlas.encoding = { codec: "meshopt", stride: STRIDE, position: "uint16 within part bounds", normal: "int8" };
fs.writeFileSync(path.join(target, "atlas.json"), JSON.stringify(atlas));
console.log(`${chunks.length} chunks, ${(total / 1e6).toFixed(1)} MB of geometry → ${path.relative(process.cwd(), target)}`);
