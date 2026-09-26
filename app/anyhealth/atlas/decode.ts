/** Decodes one part from an atlas chunk: meshopt-encoded 12-byte vertices (uint16 position within the part's bounds, int8 normal) and a meshopt index buffer. See scripts/encode-anyhealth-atlas.mjs. Shared by the viewer and the node check scripts. */
import type {Part} from './anatomy';

export interface MeshoptDecoderLike {decodeVertexBuffer(target:Uint8Array,count:number,size:number,source:Uint8Array):void;decodeIndexBuffer(target:Uint8Array,count:number,size:number,source:Uint8Array):void}

export function decodePart(buffer:ArrayBuffer,p:Part,decoder:MeshoptDecoderLike){
	const packed=new Uint8Array(p.vertexCount*12),index=new Uint32Array(p.indexCount);
	decoder.decodeVertexBuffer(packed,p.vertexCount,12,new Uint8Array(buffer,p.vertices,p.vertexBytes));
	decoder.decodeIndexBuffer(new Uint8Array(index.buffer),p.indexCount,4,new Uint8Array(buffer,p.indices,p.indexBytes));
	const q=new Uint16Array(packed.buffer),n=new Int8Array(packed.buffer),position=new Float32Array(p.vertexCount*3),normal=new Int8Array(p.vertexCount*3),[lo,hi]=p.bounds;
	for(let v=0;v<p.vertexCount;v++)for(let k=0;k<3;k++){position[v*3+k]=lo[k]+q[v*6+k]/65535*(hi[k]-lo[k]);normal[v*3+k]=n[v*12+8+k];}
	return {position,normal,index};
}
