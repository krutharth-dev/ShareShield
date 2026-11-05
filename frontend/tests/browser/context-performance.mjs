import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],proxy:process.env.SHARESHIELD_BROWSER_PROXY?{server:process.env.SHARESHIELD_BROWSER_PROXY}:undefined});
const report={browser:browser.version(),samples:[],memory_scope:'Peak sampled aggregate RSS of this Node process and Chromium descendants, including browser overhead; NOT model-only memory. 100 ms samples may miss short peaks.'};
let peak=0,memoryAvailable=true;
const sampler=setInterval(()=>{
 if(!memoryAvailable)return;
 try{
 const rows=execFileSync('ps',['-eo','pid=,ppid=,rss='],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split('\n').map(s=>s.trim().split(/\s+/).map(Number));
 const pids=new Set([process.pid]);let changed=true;while(changed){changed=false;for(const [pid,ppid] of rows)if(pids.has(ppid)&&!pids.has(pid)){pids.add(pid);changed=true;}}
 peak=Math.max(peak,rows.filter(([pid])=>pids.has(pid)).reduce((n,r)=>n+r[2]*1024,0));
 }catch{memoryAvailable=false;}
},100);
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile});page.on('dialog',d=>d.accept());
  let workers=0;page.on('worker',()=>workers++);
  await page.goto(process.env.TEST_URL??'http://127.0.0.1:4174/app',{waitUntil:'networkidle'});
  await page.evaluate(()=>{window.__ticks=[];window.__timer=setInterval(()=>window.__ticks.push(performance.now()),16);});
  const source=Array.from({length:2000},(_,i)=>`Public inventory reference ${4000000+i} is a shelf code.\n`).join('')+'Email: fictional@example.test';
  const start=Date.now();await page.locator('input[type=file]').setInputFiles({name:'fictional-large.txt',mimeType:'text/plain',buffer:Buffer.from(source)});
  await page.getByRole('button',{name:/Analyze pending files/}).click();await page.locator('.finding-card').first().waitFor({timeout:30000});
  const timing=await page.evaluate(()=>{clearInterval(window.__timer);const t=window.__ticks;return {heartbeat_ticks:t.length,max_heartbeat_gap_ms:Math.max(0,...t.slice(1).map((x,i)=>x-t[i]))};});
  assert.ok(workers>=1,'real background worker required');assert.ok(timing.heartbeat_ticks>5,'UI event loop must continue during inference');
  report.samples.push({viewport:mobile?'mobile emulation (desktop CPU)':'desktop',input_characters:source.length,upload_to_findings_ms:Date.now()-start,workers,...timing});await page.close();
 }
}finally{clearInterval(sampler);await browser.close();}
report.peak_sampled_process_tree_rss_bytes=memoryAvailable?peak:null;
report.memory_available=memoryAvailable;
if(!memoryAvailable)report.memory_blocker='This runtime cannot execute ps successfully; no process peak RSS measurement is claimed.';
console.log(JSON.stringify(report,null,2));if(process.env.SHARESHIELD_PERFORMANCE_REPORT)await writeFile(process.env.SHARESHIELD_PERFORMANCE_REPORT,JSON.stringify(report,null,2)+'\n');
