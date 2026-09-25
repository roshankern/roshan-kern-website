'use client';
/** The /anyhealth/timeline page's client entry: hands the timeline runtime (engine, catalog, pacing, tracker, rig) to AtlasApp as a prop, so only this route bundles it and the default /anyhealth page never references it. */
import AtlasApp from '../atlas/atlas-app';
import * as kit from './runtime';

export default function TimelineApp(){
	return <AtlasApp mode="timeline" kit={kit}/>;
}
