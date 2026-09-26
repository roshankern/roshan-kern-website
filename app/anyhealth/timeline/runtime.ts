/** Everything timeline mode needs at runtime, in one module that only the timeline page's client entry (timeline-app.tsx) imports and hands to AtlasApp as `kit`, so the default /anyhealth bundle never carries the engine, the issue catalog or the rig. */
export {createEngine} from './engine';
export {pacing} from './issues/pacing';
export {default as IssueTracker} from './tracker/issue-tracker';
import type {Rig} from './types';
import rigJson from './growth/rig.json';
/** The body rig (growth/rig.json). */
export const RIG=rigJson as Rig;
export {useDirector} from './director/use-director';
export {buildSchedule} from './director/schedule';
