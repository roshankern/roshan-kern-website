/** Loads public/anyhealth/models/atlas.json and every chunk from disk and decodes every part (rest pose). */
import fs from 'node:fs';import path from 'node:path';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {decodePart} from '../../atlas/decode';
import type {Atlas} from '../../atlas/anatomy';
export interface NodeAtlas {atlas:Atlas;parts:{position:Float32Array;normal:Int8Array;index:Uint32Array}[];indicesOf(name:string):number[]}
let cached:Promise<NodeAtlas>|null=null;
export function loadAtlasNode():Promise<NodeAtlas>{
	return cached??=(async()=>{
		const root=path.resolve('public'),atlas=JSON.parse(fs.readFileSync(path.join(root,'anyhealth/models/atlas.json'),'utf8')) as Atlas;
		await MeshoptDecoder.ready;
		const bufs=atlas.chunks.map(c=>{const b=fs.readFileSync(path.join(root,c.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;});
		const parts=atlas.parts.map(p=>decodePart(bufs[p.chunk],p,MeshoptDecoder));
		const byName=new Map<string,number[]>();atlas.parts.forEach((p,i)=>{const l=byName.get(p.name)??[];l.push(i);byName.set(p.name,l);});
		return {atlas,parts,indicesOf:n=>byName.get(n)??[]};
	})();
}
