/** GPU run of the engine's ghosting (the two render passes) under headless Chromium with SwiftShader: ghost-gpu-page.ts, bundled with esbuild (tsx's own dependency, so present wherever the checks run) and evaluated in the page.
 * Needs playwright-core and a cached Chromium as the clipping group's GPU parity (clip-gpu.ts: ANYHEALTH_PLAYWRIGHT, ANYHEALTH_CHROME); returns null when they are missing. One run is shared by the checks that read it. */
import path from 'node:path';
import {loadPlaywright,findChrome} from './clip-gpu';
import type {GhostGpuIn,GhostGpuOut} from './ghost-gpu-page';

let cached:Promise<GhostGpuOut|null>|null=null;
export function ghostGpu(a:GhostGpuIn):Promise<GhostGpuOut|null>{
	return cached??=(async()=>{
		const pw=loadPlaywright(),exe=findChrome();if(!pw||!exe)return null;
		const {build}=await import('esbuild');
		const out=await build({entryPoints:[path.resolve('app/anyhealth/timeline/check/ghost-gpu-page.ts')],bundle:true,write:false,format:'iife',globalName:'__ghostGpu',platform:'browser',target:'es2022',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
		const browser=await pw.chromium.launch({executablePath:exe,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
		try{
			const page=await browser.newPage();await page.evaluate(`${out.outputFiles[0].text};globalThis.__ghostGpu=__ghostGpu;`);
			return await page.evaluate((arg:GhostGpuIn)=>(globalThis as unknown as {__ghostGpu:{run(a:GhostGpuIn):GhostGpuOut}}).__ghostGpu.run(arg),a);
		}finally{await browser.close();}
	})();
}
