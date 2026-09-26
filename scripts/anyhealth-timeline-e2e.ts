// Headless end-to-end check of the v2 guided timeline: npx tsx scripts/anyhealth-timeline-e2e.ts (after `npm run build`).
// Starts `next start` (or uses ANYHEALTH_E2E_URL), opens /anyhealth/timeline in headless Chromium (SwiftShader WebGL), presses Play, waits for the
// tracker's data-phase="hold" at the first stop, checks the focused card and its Continue button, presses Continue, and checks the phase leaves the
// hold and playback resumes. Fails on any page error or console error. Asserts DOM state and numbers only; not a screenshot check.
// Needs ANYHEALTH_PLAYWRIGHT (playwright-core kept outside the repo, see docs/anyhealth/timeline-checks.md) and a cached Chromium (or ANYHEALTH_CHROME).
import {spawn,type ChildProcess} from 'node:child_process';
import {loadPlaywright,findChrome} from '../app/anyhealth/timeline/check/clip-gpu';

interface Page {goto(url:string,o?:{waitUntil?:string;timeout?:number}):Promise<unknown>;waitForSelector(sel:string,o?:{timeout?:number;state?:string}):Promise<unknown>;click(sel:string):Promise<void>;getAttribute(sel:string,name:string):Promise<string|null>;evaluate<R>(fn:string|(()=>R)):Promise<R>;on(ev:'console'|'pageerror',fn:(m:{type?:()=>string;text?:()=>string;message?:string})=>void):void}
const PORT=3417,URL=process.env.ANYHEALTH_E2E_URL??`http://localhost:${PORT}`,HOLD_TIMEOUT=90_000;
const fail=(msg:string):never=>{throw new Error(msg);};

async function serve():Promise<ChildProcess|null>{
	if(process.env.ANYHEALTH_E2E_URL)return null;
	const p=spawn('npx',['next','start','-p',String(PORT)],{stdio:['ignore','pipe','pipe']});
	await new Promise<void>((ok,bad)=>{const t=setTimeout(()=>bad(new Error('next start did not come up in 30 s')),30_000);
		p.stdout!.on('data',(b:Buffer)=>{if(/ready|started|Local:/i.test(String(b))){clearTimeout(t);ok();}});p.on('exit',c=>bad(new Error(`next start exited (${c}); run npm run build first`)));});
	return p;
}

async function main(){
	const pw=loadPlaywright(),exe=findChrome();
	if(!pw||!exe){console.error(`skipped: ${!pw?'ANYHEALTH_PLAYWRIGHT (playwright-core) not found':'no cached Chromium (set ANYHEALTH_CHROME)'}`);process.exit(2);}
	const server=await serve();
	const browser=await pw.chromium.launch({executablePath:exe,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
	const errors:string[]=[];
	try{
		const page=await browser.newPage() as unknown as Page;
		page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
		page.on('console',m=>{if(m.type?.()==='error')errors.push(`console: ${m.text?.()}`);});
		await page.goto(`${URL}/anyhealth/timeline`,{waitUntil:'load',timeout:60_000});
		await page.waitForSelector('canvas',{timeout:60_000});
		await page.waitForSelector('.issue-tracker[data-phase]',{timeout:60_000});
		// WebGL came up (the scene's renderer is a WebGL2 context on the canvas).
		const gl=await page.evaluate<boolean>(`!!document.querySelector('canvas')&&!document.querySelector('.load-error')`);if(!gl)fail('no canvas / load error');
		// Wait for the anatomy to finish loading (the progress overlay leaves), then play.
		await page.waitForSelector('button[aria-label="Play timeline"]',{timeout:60_000});
		await page.click('button[aria-label="Play timeline"]');
		const t0=Date.now();await page.waitForSelector('.issue-tracker[data-phase="hold"]',{timeout:HOLD_TIMEOUT});
		console.log(`ok   reached the first hold after ${((Date.now()-t0)/1000).toFixed(1)} s`);
		await page.waitForSelector('.tracker-card.focused',{timeout:5000});
		await page.waitForSelector('.tracker-card.focused .tracker-continue',{timeout:5000});
		const title=await page.evaluate<string>(`document.querySelector('.tracker-card.focused h3')?.textContent??''`);if(!title)fail('focused card has no title');
		console.log(`ok   focused card "${title}" shows Continue`);
		await page.click('.tracker-card.focused .tracker-continue');
		await page.waitForSelector('.issue-tracker:not([data-phase="hold"])',{timeout:5000});
		const phase=await page.getAttribute('.issue-tracker','data-phase');
		if(phase!=='release'&&phase!=='cruise')fail(`after Continue, phase is ${phase} (want release or cruise)`);
		console.log(`ok   Continue left the hold (phase ${phase})`);
		if(errors.length)fail(`page errors:\n${errors.join('\n')}`);
		console.log('ok   no page or console errors');
	}finally{await browser.close();server?.kill();}
}
main().catch(e=>{console.error(`FAIL ${e instanceof Error?e.message:e}`);process.exit(1);});
