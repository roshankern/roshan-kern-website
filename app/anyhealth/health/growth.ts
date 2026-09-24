/** Height and weight at a date: linear interpolation between measurements, clamped at the ends. */
import {toDays} from './dates';
import type {GrowthPoint} from './types';

type Series = {days: number; v: number}[];

function series(points: GrowthPoint[], key: 'heightCm' | 'weightKg'): Series {
	return points
		.filter(p => p[key] != null)
		.map(p => ({days: toDays(p.date), v: p[key] as number}))
		.sort((a, b) => a.days - b.days);
}

function interp(s: Series, days: number): number | null {
	if (!s.length) return null;
	if (days <= s[0].days) return s[0].v;
	for (let i = 1; i < s.length; i++) {
		if (days <= s[i].days) {
			const a = s[i - 1], b = s[i];
			return a.v + ((days - a.days) / (b.days - a.days || 1)) * (b.v - a.v);
		}
	}
	return s[s.length - 1].v;
}

export function makeGrowth(points: GrowthPoint[]) {
	const h = series(points, 'heightCm'), w = series(points, 'weightKg');
	return {
		heightAt: (iso: string) => interp(h, toDays(iso)),
		weightAt: (iso: string) => interp(w, toDays(iso)),
	};
}

export function formatHeight(cm: number | null): string {
	if (cm == null) return '—';
	const total = cm / 2.54;
	let ft = Math.floor(total / 12), inches = Math.round(total - ft * 12);
	if (inches === 12) { ft += 1; inches = 0; }
	return `${ft}′ ${inches}″`;
}

export function formatWeight(kg: number | null): string {
	return kg == null ? '—' : `${(kg * 2.2046226).toFixed(1)} lb`;
}
