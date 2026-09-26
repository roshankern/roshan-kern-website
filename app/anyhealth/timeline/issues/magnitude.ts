/** How much a set of part effects changes the body, as one number: check/climax.check.ts's peak test (each climax sits at, or is a listed exception to, this measure's peak). */
import type {PartFx} from '../types';

/** Σ over effects of |swell|·100 + |translate|·100 (metres) + rotation angle (rad) + tint amount + (1 − visible) + max|scale − 1|·10. The scale term lets scale-only findings (myopia's axial elongation) register; ·10 puts a 10% scale on a par with a 1 mm swell. */
export const fxMagnitude=(fx:PartFx[])=>fx.reduce((m,f)=>m+Math.abs(f.swell??0)*100+(f.translate?Math.hypot(...f.translate):0)*100+(f.rotate?2*Math.acos(Math.min(1,Math.abs(f.rotate[3]))):0)+(f.tint?.[3]??0)+(1-(f.visible??1))+(f.scale?Math.max(...f.scale.map(v=>Math.abs(v-1))):0)*10,0);
