'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,ArrowUpRight,Layers3,X} from 'lucide-react';
import {Button} from './ui/button';
import {Switch} from './ui/switch';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from './ui/sheet';
import AnatomyScene from './scene';
import './atlas.css';
import {DEFAULT_VISIBLE,SYSTEMS,type Atlas,type SceneState,type SystemId} from './anatomy';
import issuesData from '../health/issues.json';
import growthData from '../health/growth.json';
import {BIRTH_DATE,type GrowthPoint,type Issue} from '../health/types';
import TimelineBar from '../health/timeline-bar';
import BodyStats from '../health/body-stats';
import IssuePanel from '../health/issue-panel';
import {toDays,todayISO,fromDays} from '../health/dates';
import {FRACTURE_PART,TIMELINE_DENSITY,fractureAt} from '../fracture/model';
const initial:SceneState={visible:DEFAULT_VISIBLE};
const ISSUES=[...(issuesData as Issue[])].sort((a,b)=>a.date.localeCompare(b.date)),GROWTH=growthData as GrowthPoint[];
/** `fracture` (the /anyhealth/test page): draws the 2009 humerus fracture, warps the timeline around it and reads ?date=YYYY-MM-DD. */
export default function AtlasApp({fracture=false}:{fracture?:boolean}){
 const [atlas,setAtlas]=useState<Atlas|null>(null),[state,setState]=useState(initial),[progress,setProgress]=useState(0),[error,setError]=useState(''),[panel,setPanel]=useState<'layers'|null>(null),[about,setAbout]=useState(false),[date,setDate]=useState(''),[selectedIssue,setSelectedIssue]=useState<string|null>(null);
 // Starts at birth; set after mount so the timeline (which reads today's date) renders client-only.
 useEffect(()=>{
  const q=fracture?new URLSearchParams(location.search).get('date'):null,ok=q&&/^\d{4}-\d{2}-\d{2}$/.test(q)&&fromDays(toDays(q))===q;
  setDate(ok?(q<BIRTH_DATE?BIRTH_DATE:q>todayISO()?todayISO():q):BIRTH_DATE);
 },[fracture]);
 const issue=ISSUES.find(i=>i.id===selectedIssue)??null,closeIssue=useCallback(()=>setSelectedIssue(null),[]);
 
 useEffect(()=>{const abort=new AbortController();setProgress(0);setError('');setAtlas(null);setState({...initial,visible:DEFAULT_VISIBLE});fetch('/anyhealth/models/atlas.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('The anatomy catalogue could not be loaded.');return r.json();}).then(data=>setAtlas(data as Atlas)).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>abort.abort();},[]);
 const healing=fracture&&date?fractureAt(date):null;
 const activeSystems=useMemo(()=>SYSTEMS.filter(s=>atlas?.parts.some(p=>p.system===s.id)),[atlas]);
 const toggle=(id:SystemId)=>{setState(s=>({...s,visible:s.visible.includes(id)?s.visible.filter(x=>x!==id):[...s.visible,id]}));};
 const openPanel=(next:'layers')=>{setPanel(p=>p===next?null:next);};
 return <main className="studio">
  {atlas&&<AnatomyScene atlas={atlas} state={state} {...fracture?{date,fracture}:{}} issues={ISSUES} selectedIssue={selectedIssue} onSelectIssue={setSelectedIssue} onProgress={n=>{setProgress(n);if(n===100)setError('');}} onError={setError}/>}
  <div className="vignette"/>
  <header className="identity"><h1>AnyHealth</h1><div className="identity-meta">Roshan Kern</div></header>
  <section className={`layers-panel glass ${panel==='layers'?'mobile-open':''}`} aria-label="Anatomical layers">
   <div className="panel-heading"><span>Systems</span><Button variant="ghost" className="mobile-only icon-button" onClick={()=>setPanel(null)} aria-label="Close systems"><X size={18}/></Button></div>
   <div className="layer-presets"><Button variant="ghost" aria-pressed={activeSystems.every(x=>state.visible.includes(x.id))} onClick={()=>setState(s=>({...s,visible:activeSystems.map(x=>x.id)}))}>All</Button><Button variant="ghost" aria-pressed={state.visible.length===1&&state.visible[0]==='skeletal'} onClick={()=>setState(s=>({...s,visible:['skeletal']}))}>Skeleton</Button><Button variant="ghost" aria-pressed={state.visible.length===6&&['cardiac','respiratory','digestive','urinary','endocrine','reproductive'].every(id=>state.visible.includes(id as SystemId))} onClick={()=>setState(s=>({...s,visible:['cardiac','respiratory','digestive','urinary','endocrine','reproductive']}))}>Organs</Button></div>
   <div className="system-list">{activeSystems.map(s=><div className={`system-row ${state.visible.includes(s.id)?'enabled':''}`} key={s.id}><Button variant="ghost" className="system-name" title={`Show only ${s.name.toLowerCase()}`} onClick={()=>setState(v=>({...v,visible:[s.id]}))}><span className="system-dot" style={{background:s.color}}/>{s.name}</Button><Switch checked={state.visible.includes(s.id)} onCheckedChange={()=>toggle(s.id)} aria-label={`Show ${s.name.toLowerCase()}`} /></div>)}</div>
   <div className="panel-foot"><Button variant="ghost" disabled={activeSystems.every(x=>state.visible.includes(x.id))} onClick={()=>setState(s=>({...s,visible:activeSystems.map(x=>x.id)}))}>Show all</Button><Button variant="ghost" disabled={state.visible.length===0} onClick={()=>setState(s=>({...s,visible:[]}))}>Hide all</Button></div>
  </section>
  <Button variant="ghost" className="mobile-only systems-fab glass" onClick={()=>openPanel('layers')} aria-label="Open system layers"><Layers3 size={18}/><span>Systems</span></Button>
  <footer className="studio-footer"><span className="hints hint-fine"><span>Drag to orbit</span><b>·</b><span>Shift+drag to pan</span><b>·</b><span>Scroll to zoom</span><b>·</b><span>Double-click to focus</span><b>·</b></span><span className="hints hint-coarse"><span>Drag to orbit</span><b>·</b><span>Pinch to zoom</span><b>·</b><span>Two fingers to pan</span><b>·</b><span>Double-tap to focus</span><b>·</b></span><button type="button" className="credits-link" onClick={()=>{setPanel(null);setAbout(true);}}>Source & credits</button></footer>
  {progress<100&&!error&&<div className="loading glass" role="status"><Activity size={18}/><div><strong>Preparing the anatomy</strong><span>{progress}% · Loading {atlas?.parts.length.toLocaleString()??'2,234'} pieces</span><div className="loading-track"><i style={{width:`${progress}%`}}/></div></div></div>}
  {error&&<div className="loading glass error" role="alert"><p>{error}</p><Button variant="ghost" onClick={()=>location.reload()}>Reload viewer</Button></div>}
  {/* Before BodyStats and sharing its class, so the scene's openArea() frames the body above this line too. */}
  {date&&fracture&&<div className="body-stats fracture-status" aria-live="off">{healing?`${FRACTURE_PART} · ${healing.phase} · day ${Math.floor(healing.day)}`:'\u00a0'}</div>}
  {date&&<><BodyStats date={date} growth={GROWTH}/><TimelineBar issues={ISSUES} date={date} onDate={setDate} selected={selectedIssue} onSelect={setSelectedIssue} warp={fracture?TIMELINE_DENSITY:undefined}/></>}
  <IssuePanel issue={issue} onClose={closeIssue}/>
  <Sheet open={about} onOpenChange={setAbout}><SheetContent className="about-sheet glass"><div className="eyebrow">SOURCE & SCOPE</div><SheetTitle className="structure-title">A body, revealed.</SheetTitle><SheetDescription>Explore the adult male reference anatomy from BodyParts3D.</SheetDescription><div className="about-copy"><p><strong>Male · BodyParts3D</strong><br/>2,234 individual meshes and 3,432 named concepts from an adult male reference anatomy.</p><p>This reference does not contain every human structure or variation. Named concepts can contain multiple pieces; each source mesh is rendered once.</p><p>Colors and system groupings are designed for exploration. The geometry is simplified for the web, and short explanations provide general educational context. This is an anatomical reference, not a diagnostic or surgical tool.</p><h3>Source</h3><p>BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.</p><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">Dataset license <ArrowUpRight size={14}/></a><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer">Original geometry & metadata <ArrowUpRight size={14}/></a><a href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752" target="_blank" rel="noreferrer">Read the source publication <ArrowUpRight size={14}/></a></div></SheetContent></Sheet>
 </main>;
}
