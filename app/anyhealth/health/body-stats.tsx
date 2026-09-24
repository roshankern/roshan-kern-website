import {useMemo} from 'react';
import type {GrowthPoint} from './types';
import {ageAt} from './dates';
import {formatHeight,formatWeight,makeGrowth} from './growth';

/** Age, height and weight at the timeline date, as plain text under the body. */
export default function BodyStats({date,growth}:{date:string;growth:GrowthPoint[]}){
	const g=useMemo(()=>makeGrowth(growth),[growth]),age=ageAt(date);
	const stats=[`${age.value} ${age.unit}`,formatHeight(g.heightAt(date)),formatWeight(g.weightAt(date))];
	return <div className="body-stats" aria-live="off">{stats.map((v,i)=><span key={i}>{i>0&&<b>·</b>}{v}</span>)}</div>;
}
