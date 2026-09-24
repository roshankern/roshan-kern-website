/** ISO 'YYYY-MM-DD' date helpers. Days-since-epoch keeps the timeline math timezone-safe. */
import {BIRTH_DATE} from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toDays(iso: string): number {
	const [y, m, d] = iso.split('-').map(Number);
	return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function fromDays(days: number): string {
	const dt = new Date(Math.round(days) * 86400000);
	return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Today in the viewer's local time zone. */
export function todayISO(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function formatRange(date: string, endDate?: string | null): string {
	return endDate && endDate !== date ? `${formatDate(date)} – ${formatDate(endDate)}` : formatDate(date);
}

/** Age at a date: whole months under 2 years, whole years after. */
export function ageAt(iso: string): {value: string; unit: string} {
	const years = Math.max(0, (toDays(iso) - toDays(BIRTH_DATE)) / 365.25);
	return years < 2 ? {value: String(Math.round(years * 12)), unit: 'mo'} : {value: String(Math.floor(years)), unit: 'yr'};
}

