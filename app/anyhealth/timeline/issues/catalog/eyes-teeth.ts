/** Issue scripts, area `eyes-teeth`. Stub from Task 3: each issue's anchor part (health/anchors.ts), the record's dates (resolve = endDate, else onset + 30 days) and no effects. Task 10 replaces this file. */
import type {IssueScript} from '../../types';

export const SCRIPTS:IssueScript[]=[
	{id:'infant-left-exotropia',parts:['Left sclera'],onset:'2003-07-07',resolve:'2004-03-22',fxAt:()=>[]},
	{id:'bilateral-myopia',parts:['Right sclera'],onset:'2018-12-15',resolve:'2019-01-14',fxAt:()=>[]},
	{id:'first-cavity-filling-tooth-3',parts:['Right upper first secondary molar tooth'],onset:'2016-06-21',resolve:'2016-07-21',fxAt:()=>[]},
	{id:'fillings-teeth-30-31-composite',parts:['Right lower first secondary molar tooth'],onset:'2019-06-28',resolve:'2019-07-28',fxAt:()=>[]},
	{id:'city-creek-fillings-30-31',parts:['Right lower second secondary molar tooth'],onset:'2024-07-30',resolve:'2024-08-29',fxAt:()=>[]},
	{id:'wisdom-teeth-extraction',parts:['Left lower second secondary molar tooth'],onset:'2023-12-26',resolve:'2024-01-25',fxAt:()=>[]},
];
