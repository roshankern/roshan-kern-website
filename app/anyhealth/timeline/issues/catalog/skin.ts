/** Issue scripts, area `skin`. Stub from Task 3: each issue's anchor part (health/anchors.ts), the record's dates (resolve = endDate, else onset + 30 days) and no effects. Task 11 replaces this file. */
import type {IssueScript} from '../../types';

export const SCRIPTS:IssueScript[]=[
	{id:'neonatal-acne-cradle-cap',parts:['Skin'],onset:'2003-07-21',resolve:'2003-08-20',fxAt:()=>[]},
	{id:'childhood-atopic-dyshidrotic-eczema',parts:['Skin'],onset:'2003-10-23',resolve:'2003-11-22',fxAt:()=>[]},
	{id:'chin-laceration-er-2010',parts:['Skin'],onset:'2010-04-12',resolve:'2010-05-12',fxAt:()=>[]},
	{id:'forehead-laceration-2011',parts:['Skin'],onset:'2011-03-13',resolve:'2011-04-12',fxAt:()=>[]},
	{id:'right-shin-laceration-2014',parts:['Skin'],onset:'2014-01-24',resolve:'2014-02-23',fxAt:()=>[]},
	{id:'verruca-vulgaris-2018',parts:['Skin'],onset:'2018-08-24',resolve:'2018-09-23',fxAt:()=>[]},
	{id:'acne-diagnosis-topical-treatment',parts:['Skin'],onset:'2021-08-25',resolve:'2021-09-24',fxAt:()=>[]},
	{id:'isotretinoin-accutane-course',parts:['Skin'],onset:'2022-01-03',resolve:'2022-06-28',fxAt:()=>[]},
];
