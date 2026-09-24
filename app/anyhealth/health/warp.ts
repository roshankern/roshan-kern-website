/** Piecewise-linear map between timeline days and track fraction t∈[0,1]. Each density range
 *  gets `k` times its natural width; everything else stays linear. Without ranges it is the plain
 *  (days-min)/span map, so an unwarped timeline behaves exactly as before. */
import {toDays} from './dates';

export interface Density {from: string; to: string; k: number}
export interface Warp {toT: (days: number) => number; fromT: (t: number) => number}

export function makeWarp(min: number, max: number, density?: Density[]): Warp {
	const span = max - min;
	if (!density?.length) return {toT: d => (d - min) / span, fromT: t => min + t * span};
	// Breakpoints (day, cumulative weight) with k=1 between the density ranges; ranges are clipped to [min,max].
	const days = [min], acc = [0];
	const push = (d: number, k: number) => {const last = days[days.length - 1]; if (d <= last) return; acc.push(acc[acc.length - 1] + (d - last) * k); days.push(d);};
	for (const r of [...density].sort((a, b) => a.from.localeCompare(b.from))) {
		const a = Math.max(min, Math.min(max, toDays(r.from))), b = Math.max(min, Math.min(max, toDays(r.to)));
		push(a, 1); push(b, r.k);
	}
	push(max, 1);
	const total = acc[acc.length - 1], n = days.length;
	const toT = (d: number) => {
		if (d <= min) return 0;
		if (d >= max) return 1;
		let i = 1; while (i < n - 1 && d > days[i]) i++;
		return (acc[i - 1] + (d - days[i - 1]) / (days[i] - days[i - 1]) * (acc[i] - acc[i - 1])) / total;
	};
	const fromT = (t: number) => {
		const w = Math.max(0, Math.min(1, t)) * total;
		let i = 1; while (i < n - 1 && w > acc[i]) i++;
		return days[i - 1] + (w - acc[i - 1]) / (acc[i] - acc[i - 1]) * (days[i] - days[i - 1]);
	};
	return {toT, fromT};
}
