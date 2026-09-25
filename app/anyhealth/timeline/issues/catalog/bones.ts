/** Issue scripts, area `bones`. Stub from Task 3: each issue's anchor part (health/anchors.ts), the record's dates (resolve = endDate, else onset + 30 days) and no effects. Task 8 replaces this file. */
import type {IssueScript} from '../../types';

export const SCRIPTS:IssueScript[]=[
	{id:'left-humerus-fracture-2009',parts:['Left humerus'],onset:'2009-09-02',resolve:'2009-10-15',fxAt:()=>[]},
	{id:'healing-humerus-callus-2009',parts:['Left humerus'],onset:'2009-09-25',resolve:'2009-10-25',fxAt:()=>[]},
	{id:'scoliosis-upper-thoracic-2025',parts:['Third thoracic vertebra'],onset:'2025-07-08',resolve:'2025-08-07',fxAt:()=>[]},
];
