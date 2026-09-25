import type {Check} from './harness';
import {SCRIPTS} from '../issues';
import {bodyAt} from '../growth/proportions';
import {visibilityFor} from '../engine';
import {parseDateParam} from '../url-date';
import issues from '../../health/issues.json';
import atlas from '../../../../public/anyhealth/models/atlas.json';
export const checks:Check[]=[
	{name:'every issue has exactly one script',run(c){const ids=(issues as {id:string}[]).map(i=>i.id);ids.forEach(id=>c.assert(SCRIPTS.filter(s=>s.id===id).length===1,`script count for ${id}`));c.assert(SCRIPTS.length===ids.length,'no extra scripts');}},
	{name:'every script part exists in the atlas',run(c){const names=new Set((atlas as {parts:{name:string}[]}).parts.map(p=>p.name));SCRIPTS.forEach(s=>{c.assert(s.parts.length>0,`${s.id} parts`);s.parts.forEach(p=>c.assert(names.has(p),`${s.id}: no part "${p}"`));});}},
	{name:'every script has a resolve date or is chronic',run(c){SCRIPTS.forEach(s=>c.assert(s.chronic||!!s.resolve,`${s.id} window`));}},
	{name:'fxAt is pure: same inputs give the same output, and scrubbing backwards restores state',run(c){const ctx={body:bodyAt('2010-01-01'),date:'2010-01-01'};for(const s of SCRIPTS){const at=(d:number)=>JSON.stringify(s.fxAt(d,ctx));for(const d of [-1,0,0.5,3,30,400])c.assert(at(d)===at(d),`${s.id} impure at ${d}`);const before=at(-1);at(30);c.assert(at(-1)===before,`${s.id} not reversible`);}}},
	{name:'isolate overrides the system switches; switches apply otherwise',run(c){const parts=[{name:'Left humerus',system:'skeletal' as const},{name:'Heart',system:'cardiac' as const}];const iso=visibilityFor(parts,['cardiac'],new Set(['Left humerus']));c.assert(iso[0]===1&&iso[1]===0,'isolate shows humerus with skeleton off, hides heart');const off=visibilityFor(parts,['cardiac'],null);c.assert(off[0]===0&&off[1]===1,'switches');}},
	{name:'?date= clamps and falls back',run(c){const t='2026-09-25';c.assert(parseDateParam(null,t)==='2003-06-22','none');c.assert(parseDateParam('1999-01-01',t)==='2003-06-22','before birth');c.assert(parseDateParam('2030-01-01',t)===t,'future');c.assert(parseDateParam('2009-02-30',t)==='2003-06-22','invalid day');c.assert(parseDateParam('2009-09-02',t)==='2009-09-02','valid');}},
];
