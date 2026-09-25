/** Issue scripts, area `airway`. Stub from Task 3: each issue's anchor part (health/anchors.ts), the record's dates (resolve = endDate, else onset + 30 days) and no effects. Task 9 replaces this file. */
import type {IssueScript} from '../../types';

export const SCRIPTS:IssueScript[]=[
	{id:'infant-laryngomalacia-2003',parts:['Epiglottis'],onset:'2003-08-18',resolve:'2003-09-17',fxAt:()=>[]},
	{id:'infant-croup-neck-xray-2003',parts:['Trachea'],onset:'2003-09-08',resolve:'2003-10-08',fxAt:()=>[]},
	{id:'recurrent-croup-childhood',parts:['Trachea'],onset:'2004-01-15',resolve:'2016-12-15',fxAt:()=>[]},
	{id:'sky-ridge-er-airway-2016',parts:['Trachea'],onset:'2016-11-02',resolve:'2016-12-02',fxAt:()=>[]},
	{id:'chco-picu-subglottitis-2016',parts:['Trachea'],onset:'2016-11-02',resolve:'2016-11-04',fxAt:()=>[]},
	{id:'microlaryngoscopy-bronchoscopy-2016',parts:['Epiglottis'],onset:'2016-12-15',resolve:'2017-01-14',fxAt:()=>[]},
	{id:'asthma-diagnosis-chronic',parts:['Left main bronchus'],onset:'2016-12-22',resolve:'2017-01-21',fxAt:()=>[]},
	{id:'spirometry-asthma-confirmed-2022',parts:['Left main bronchus'],onset:'2022-08-01',resolve:'2022-08-31',fxAt:()=>[]},
	{id:'pulmonary-reeval-2024',parts:['Right main bronchus proper'],onset:'2024-12-05',resolve:'2025-01-04',fxAt:()=>[]},
	{id:'budesonide-formoterol-rx-2026',parts:['Right main bronchus proper'],onset:'2026-09-02',resolve:'2026-09-15',fxAt:()=>[]},
	{id:'covid-19-infection-2020',parts:['Right main bronchus proper'],onset:'2020-08-28',resolve:'2020-09-27',fxAt:()=>[]},
];
