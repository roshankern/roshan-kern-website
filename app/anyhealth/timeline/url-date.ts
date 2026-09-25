/** The `?date=YYYY-MM-DD` page parameter. */
import {BIRTH_DATE} from '../health/types';
import {fromDays,toDays} from '../health/dates';

/** A valid ISO date clamped to [birth, today]; birth when missing or invalid (including impossible days like 2009-02-30). */
export function parseDateParam(q:string|null,today:string):string{
	const ok=!!q&&/^\d{4}-\d{2}-\d{2}$/.test(q)&&fromDays(toDays(q))===q;
	return ok?(q<BIRTH_DATE?BIRTH_DATE:q>today?today:q):BIRTH_DATE;
}
