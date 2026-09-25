/** The two eyeballs of the atlas: the parts that make up each globe and its rest-space centre and axial length (model geometry, measured from the decoded vertices; eyes-teeth.check.ts re-measures them). */
import type {Vec3} from '../../types';

/** One globe: its atlas parts (outer coat to inner structures), rest centre and front-to-back length, metres. */
export interface Globe {parts:string[];centre:Vec3;axialLength:number}

const partsOf=(side:'left'|'right')=>{const S=side==='left'?'Left':'Right';return [`${S} sclera`,`${S} cornea`,`${S} lens`,`${S} iris`,`${S} choroid`,`${S} vitreous body`,`Optic part of ${side} retina`,`Anterior chamber of ${side} eyeball`,`${S} corona ciliaris`,`Suspensory ligament of ${side} lens`];};

/** Centre x/y = the sclera's vertex bounds centre; z = midway between the back of the sclera (0.0388) and the front of the cornea (0.0660). Not the atlas `bounds`: the right cornea and one right choroid carry a stray vertex near x = +0.031. */
export const GLOBE:{left:Globe;right:Globe}={
	left:{parts:partsOf('left'),centre:[0.02915,1.5962,0.0524],axialLength:0.0272},
	right:{parts:partsOf('right'),centre:[-0.03045,1.5962,0.0524],axialLength:0.0272},
};

/** Quaternion for a yaw of `rad` about +y (positive turns the front, +z, toward +x). */
export const yaw=(rad:number):[number,number,number,number]=>[0,Math.sin(rad/2),0,Math.cos(rad/2)];
