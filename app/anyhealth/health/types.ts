/** Shared shapes for the health layer. Written by scripts/sync-anyhealth-health.mjs. */

/** Display category, from the record's primary body system. */
export type Category = 'skin' | 'vision' | 'dental' | 'respiratory' | 'allergy' | 'blood' | 'bones' | 'digestive';

export const CATEGORY_LABEL: Record<Category, string> = {
	skin: 'Skin',
	vision: 'Vision',
	dental: 'Dental',
	respiratory: 'Respiratory',
	allergy: 'Allergy',
	blood: 'Blood',
	bones: 'Bones',
	digestive: 'Digestive',
};

export interface Lab {
	name: string;
	value: string | number;
	unit?: string | null;
	refText?: string | null;
	flag?: 'high' | 'low' | 'abnormal' | 'normal' | null;
}

export interface AllergyChart {
	title: string;
	unit?: string;
	note?: string | null;
	items: { label: string; value: number; class: number; display: string }[];
}

export interface Issue {
	id: string;
	/** ISO YYYY-MM-DD. */
	date: string;
	endDate?: string | null;
	title: string;
	/** Clinician and prescriber names removed. */
	summary: string;
	category: Category;
	/** Practice name ("Village Pediatrics") or "Self-reported". Shown as "Source: X Records". */
	source: string;
	selfReported?: boolean;
	/** Public URL, e.g. /anyhealth/figures/<id>.jpg. */
	figure?: string | null;
	labs?: Lab[] | null;
	chart?: AllergyChart | null;
}

export interface GrowthPoint {
	date: string;
	heightCm?: number | null;
	weightKg?: number | null;
}

export const BIRTH_DATE = '2003-06-22';
