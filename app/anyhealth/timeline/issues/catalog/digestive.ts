/** Issue scripts, area `digestive`. Stub from Task 3: each issue's anchor part (health/anchors.ts), the record's dates (resolve = endDate, else onset + 30 days) and no effects. Task 12 replaces this file. */
import type {IssueScript} from '../../types';

export const SCRIPTS:IssueScript[]=[
	{id:'encopresis-constipation-childhood',parts:['Rectum'],onset:'2010-01-19',resolve:'2012-06-22',fxAt:()=>[]},
	{id:'silent-reflux-lpr-omeprazole',parts:['Esophagus'],onset:'2026-01-03',resolve:'2026-02-02',fxAt:()=>[]},
	{id:'gerd-diagnosis-pantoprazole-famotidine-2026',parts:['Stomach'],onset:'2026-08-11',resolve:'2026-08-28',fxAt:()=>[]},
	{id:'famotidine-nightly-rx-2026',parts:['Stomach'],onset:'2026-09-02',resolve:'2026-10-02',fxAt:()=>[]},
];
