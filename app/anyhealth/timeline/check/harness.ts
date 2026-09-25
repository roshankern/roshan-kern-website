/** A tiny check runner for node (npx tsx scripts/anyhealth-timeline-check.ts [filter]). No test framework in this repo. */
export interface CheckContext {
	assert(cond:unknown,msg:string):void;
	/** |a-b| <= tol. */
	near(a:number,b:number,tol:number,msg:string):void;
	/** Lazily decoded atlas geometry (all parts, rest pose). */
	geometry():Promise<import('./node-atlas').NodeAtlas>;
}
export interface Check {name:string;run(ctx:CheckContext):void|Promise<void>}
export class CheckFailure extends Error {}
