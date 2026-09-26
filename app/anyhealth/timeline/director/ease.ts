/** Easing helpers for the director (pure). */
/** C² ramp 0→1 over [e0,e1]. */
export const smootherstep=(e0:number,e1:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*t*(t*(t*6-15)+10);};
/** Cubic Hermite on [x0,x1] with values y0,y1 and slopes m0,m1 (per unit x). */
export function hermite(x:number,x0:number,x1:number,y0:number,y1:number,m0:number,m1:number){const h=x1-x0;if(h<=0)return y1;const t=(x-x0)/h,t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*y0+(t3-2*t2+t)*h*m0+(-2*t3+3*t2)*y1+(t3-t2)*h*m1;}
