/** Issue scripts, area `systemic`. Stub from Task 3: each issue's anchor part (health/anchors.ts), the record's dates (resolve = endDate, else onset + 30 days) and no effects. Task 13 replaces this file. */
import type {IssueScript} from '../../types';

export const SCRIPTS:IssueScript[]=[
	{id:'peanut-tree-nut-food-allergy',parts:['Tongue'],onset:'2003-12-22',resolve:'2004-01-21',fxAt:()=>[]},
	{id:'allergy-workup-tree-nuts-egg-2004',parts:['Tongue'],onset:'2004-07-01',resolve:'2004-07-31',fxAt:()=>[]},
	{id:'egg-anaphylaxis-daycare',parts:['Tongue'],onset:'2005-05-02',resolve:'2005-06-01',fxAt:()=>[]},
	{id:'allergic-rhinitis-oral-allergy-syndrome-2016',parts:['Right lateral nasal cartilage'],onset:'2016-07-11',resolve:'2016-08-10',fxAt:()=>[]},
	{id:'allergy-ige-panel-2016',parts:['Right lateral nasal cartilage'],onset:'2016-12-21',resolve:'2017-01-20',fxAt:()=>[]},
	{id:'allergic-rhinitis-immunotherapy-eval',parts:['Right lateral nasal cartilage'],onset:'2022-08-01',resolve:'2022-08-31',fxAt:()=>[]},
	{id:'walnut-accidental-exposure-2026',parts:['Tongue'],onset:'2026-03-01',resolve:'2026-03-31',fxAt:()=>[]},
	{id:'microcytosis-suspected-thalassemia-2004',parts:['Wall of ventricle'],onset:'2004-07-01',resolve:'2004-07-31',fxAt:()=>[]},
	{id:'first-abnormal-cbc-2023',parts:['Wall of ventricle'],onset:'2023-12-29',resolve:'2024-01-28',fxAt:()=>[]},
	{id:'hematology-eval-2024',parts:['Wall of ventricle'],onset:'2024-04-25',resolve:'2024-05-25',fxAt:()=>[]},
	{id:'beta-thalassemia-minor-confirmed-2024',parts:['Wall of ventricle'],onset:'2024-05-20',resolve:'2024-06-19',fxAt:()=>[]},
	{id:'function-health-cbc-thalassemia-signature-2026',parts:['Wall of ventricle'],onset:'2026-06-18',resolve:'2026-07-18',fxAt:()=>[]},
	{id:'function-health-out-of-range-2026',parts:['Wall of ventricle'],onset:'2026-06-18',resolve:'2026-07-18',fxAt:()=>[]},
];
