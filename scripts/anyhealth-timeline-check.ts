// Runs the AnyHealth timeline checks: npx tsx scripts/anyhealth-timeline-check.ts [group-or-name-filter]
import {ALL} from '../app/anyhealth/timeline/check/index';
import {CheckFailure,type CheckContext} from '../app/anyhealth/timeline/check/harness';
import {loadAtlasNode} from '../app/anyhealth/timeline/check/node-atlas';
// See docs/anyhealth/timeline-checks.md for the environment variables (ANYHEALTH_PLAYWRIGHT, ANYHEALTH_SKIP_GPU, ...).
const filter=process.argv[2]??'';let failed=0,ran=0,gpuRan=false;
const ctx:CheckContext={
	assert(c,msg){if(!c)throw new CheckFailure(msg);},
	near(a,b,tol,msg){if(!(Math.abs(a-b)<=tol))throw new CheckFailure(`${msg}: ${a} vs ${b} (tol ${tol})`);},
	geometry:loadAtlasNode,
};
// tsx transpiles this script to CommonJS, which cannot have top-level await: run the loop from an async main instead.
async function main(){
	for(const [group,checks] of Object.entries(ALL))for(const c of checks){
		if(filter&&!group.includes(filter)&&!c.name.includes(filter))continue;ran++;if(/^(GLSL\/TS parity|GPU )/.test(c.name))gpuRan=true;
		try{await c.run(ctx);console.log(`ok   ${group} · ${c.name}`);}catch(e){failed++;console.log(`FAIL ${group} · ${c.name}\n     ${e instanceof Error?e.message:e}`);}
	}
	console.log(`\n${ran-failed}/${ran} passed`);
	if(gpuRan&&!process.env.ANYHEALTH_PLAYWRIGHT)console.log(`hint: the GPU checks (GLSL parity, ghost passes) were ${process.env.ANYHEALTH_SKIP_GPU==='1'?'skipped (ANYHEALTH_SKIP_GPU=1)':'not run'}; set ANYHEALTH_PLAYWRIGHT=<dir with playwright-core> to run them (docs/anyhealth/timeline-checks.md)`);
	process.exit(failed?1:0);
}
main();
