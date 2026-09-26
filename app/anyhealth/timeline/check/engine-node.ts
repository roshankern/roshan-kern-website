/** A real timeline engine in node for integration checks: the decoded atlas as picker meshes (position copy, normalized Int8 normals, index, the engine's `seg` attribute) and segments.bin, as scene.tsx builds them. No renderer unless one is passed. */
import fs from 'node:fs';
import * as T from 'three';
import {createEngine,type Engine} from '../engine';
import rigJson from '../growth/rig.json';
import type {Rig} from '../types';
import type {NodeAtlas} from './node-atlas';

let segBuf:ArrayBuffer|null=null;
const segments=()=>{if(!segBuf){const b=fs.readFileSync('public/anyhealth/models/segments.bin');segBuf=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;}return segBuf;};

/** Build the engine and call ready() (unless `deferReady`: then `ready()` calls it, as scene.tsx does once every chunk is decoded). `skip` leaves those part names without a picker (so a layer that needs them fails to init). */
export function nodeEngine(g:NodeAtlas,o:{skip?:string[];renderer?:Parameters<typeof createEngine>[0]['renderer'];deferReady?:boolean}={}):{engine:Engine;scene:T.Scene;bounds:T.Box3[];pickers:(T.Mesh|undefined)[];ready:()=>void}{
	const {atlas}=g,scene=new T.Scene(),skip=new Set(o.skip??[]);
	const bounds=atlas.parts.map(p=>new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1])));
	const engine=createEngine({atlas,scene,bounds,rig:rigJson as Rig,segments:segments(),renderer:o.renderer});
	const pickers:(T.Mesh|undefined)[]=atlas.parts.map((p,i)=>{
		if(skip.has(p.name))return undefined;const d=g.parts[i],geo=new T.BufferGeometry();
		geo.setAttribute('position',new T.BufferAttribute(d.position.slice(),3));geo.setAttribute('normal',new T.BufferAttribute(d.normal,3,true));geo.setIndex(new T.BufferAttribute(d.index,1));
		geo.setAttribute('seg',engine.segAttribute(i));geo.boundingBox=bounds[i].clone();const m=new T.Mesh(geo);m.matrixAutoUpdate=false;return m;
	});
	const ready=()=>engine.ready(pickers);if(!o.deferReady)ready();return {engine,scene,bounds,pickers,ready};
}
