import type {Check} from './harness';
import {SCRIPTS} from '../issues';
import {bodyAt} from '../growth/proportions';
import {visibilityFor,frameFocus} from '../engine';
import {parseDateParam} from '../url-date';
import issues from '../../health/issues.json';
import atlas from '../../../../public/anyhealth/models/atlas.json';
export const checks:Check[]=[
	{name:'every issue has exactly one script',run(c){const ids=(issues as {id:string}[]).map(i=>i.id);ids.forEach(id=>c.assert(SCRIPTS.filter(s=>s.id===id).length===1,`script count for ${id}`));c.assert(SCRIPTS.length===ids.length,'no extra scripts');}},
	{name:'every script part exists in the atlas',run(c){const names=new Set((atlas as {parts:{name:string}[]}).parts.map(p=>p.name));SCRIPTS.forEach(s=>{c.assert(s.parts.length>0,`${s.id} parts`);s.parts.forEach(p=>c.assert(names.has(p),`${s.id}: no part "${p}"`));});}},
	{name:'every script has a resolve date or is chronic',run(c){SCRIPTS.forEach(s=>c.assert(s.chronic||!!s.resolve,`${s.id} window`));}},
	{name:'fxAt is pure: same inputs give the same output, and scrubbing backwards restores state',run(c){const ctx={body:bodyAt('2010-01-01'),date:'2010-01-01'};for(const s of SCRIPTS){const at=(d:number)=>JSON.stringify(s.fxAt(d,ctx));for(const d of [-1,0,0.5,3,30,400])c.assert(at(d)===at(d),`${s.id} impure at ${d}`);const before=at(-1);at(30);c.assert(at(-1)===before,`${s.id} not reversible`);}}},
	{name:'focus overrides the system switches for its parts; everything else follows the switches (ghosted, not hidden)',run(c){const parts=[{name:'Left humerus',system:'skeletal' as const},{name:'Heart',system:'cardiac' as const}];const iso=visibilityFor(parts,['cardiac'],new Set(['Left humerus']));c.assert(iso[0]===1&&iso[1]===1,'focus shows humerus with skeleton off; the heart stays by its switch (the ghost fades it)');const both=visibilityFor(parts,['skeletal'],new Set(['Left humerus']));c.assert(both[0]===1&&both[1]===0,'a switched-off system stays hidden under a focus');const off=visibilityFor(parts,['cardiac'],null);c.assert(off[0]===0&&off[1]===1,'switches');}},
	{name:'frame focus: `focus` wins, null = none, absent = the manual isolate at ghost 1; ghost clamped; unknown ids focus nothing',run(c){const id='left-humerus-fracture-2009',f=(o:Parameters<typeof frameFocus>[0])=>JSON.stringify(frameFocus(o));c.assert(f({isolate:id})===JSON.stringify({id,ghost:1}),'isolate → ghost 1');c.assert(f({isolate:id,focus:null})==='null','null focus');c.assert(f({isolate:null,focus:{id,ghost:.4}})===JSON.stringify({id,ghost:.4}),'focus');c.assert(f({isolate:id,focus:{id,ghost:2}})===JSON.stringify({id,ghost:1}),'clamped');c.assert(f({isolate:'nope'})==='null'&&f({isolate:null,focus:{id:'nope',ghost:1}})==='null','unknown id');c.assert(f({isolate:null})==='null','nothing');}},
	{name:'?date= clamps and falls back',run(c){const t='2026-09-25';c.assert(parseDateParam(null,t)==='2003-06-22','none');c.assert(parseDateParam('1999-01-01',t)==='2003-06-22','before birth');c.assert(parseDateParam('2030-01-01',t)===t,'future');c.assert(parseDateParam('2009-02-30',t)==='2003-06-22','invalid day');c.assert(parseDateParam('2009-09-02',t)==='2009-09-02','valid');}},
];
