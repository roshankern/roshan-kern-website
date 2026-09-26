/** v2 director stop views (IssueScript.view): unit directions from the focus target to the camera, model axes (+x = the body's left, +y up, +z = the body's front). Only for findings the default three-quarter front-left view (≈ normalize(0.35,0.06,1)) hides or shows edge-on. */
import type {Vec3} from '../types';

const unit=(x:number,y:number,z:number):Vec3=>{const l=Math.hypot(x,y,z);return [x/l,y/l,z/l];};
/** Straight on, a touch above: faces, eyes, lips. */
export const FRONT=unit(0,0.05,1);
/** Front and above: face plus the crown of the scalp. */
export const FRONT_HIGH=unit(0.2,0.5,1);
/** From the body's right front: right-side teeth, the right shin. */
export const RIGHT_FRONT=unit(-0.55,0.05,1);
/** Right profile: the right-side third molars (#1 impacted, #32). */
export const RIGHT_SIDE=unit(-1,0.05,0.35);
/** Left profile: sagittal-plane findings (epiglottis tilt, globe length, the airway column, the nasal conchae). */
export const LEFT_SIDE=unit(1,0.08,0.3);
/** From behind, a little above: the spine. */
export const BACK=unit(0,0.15,-1);
