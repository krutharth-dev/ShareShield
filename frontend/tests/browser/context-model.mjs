import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox'],proxy:process.env.SHARESHIELD_BROWSER_PROXY?{server:process.env.SHARESHIELD_BROWSER_PROXY}:undefined});
const base=process.env.TEST_URL??'http://127.0.0.1:4174/app';
const report={browser:browser.version(),cases:[]};
try{
 for(const unavailable of [false,true]){
  const page=await browser.newPage({acceptDownloads:true});page.on('dialog',d=>d.accept());let requests=0;
  await page.route('**/models/context-v1.json',async route=>{requests++;assert.equal(route.request().method(),'GET');assert.equal(route.request().postData(),null);if(unavailable)await route.abort();else await route.continue();});
  await page.goto(base,{waitUntil:'networkidle'});
  const source='😀 ಆಸ್ಪತ್ರೆ ವೈದ್ಯಕೀಯ ದಾಖಲೆ: 4829107\nAadhaar: 2345 6789 0123\nAadhaar: 2345 6789 0123';
  const begin=Date.now();await page.locator('input[type=file]').setInputFiles({name:'fictional-context.txt',mimeType:'text/plain',buffer:Buffer.from(source)});
  await page.getByRole('button',{name:/Analyze pending files/}).click();
  await page.locator('.finding-card').first().waitFor();
  assert.ok(requests>=1);
  if(!unavailable){
   assert.ok(await page.getByText('Trained AI · manual review required',{exact:false}).count()>0);
   const ai=page.locator('.finding-card').filter({hasText:'Trained AI · manual review required'});
   assert.equal(await ai.locator('input:checked').count(),0);
   assert.equal(await ai.count(),1);
  }else assert.ok((await page.locator('body').textContent()).includes('Contextual model unavailable'));
  const aadhaar=page.locator('.finding-card').filter({hasText:'AADHAAR'});assert.equal(await aadhaar.count(),2);
  await page.getByRole('button',{name:'Select all',exact:true}).click();
  await page.getByRole('button',{name:'Redact & verify export'}).click();await page.locator('.report').waitFor();
  const pending=page.waitForEvent('download');await page.locator('.report-heading a[download]').click();
  const download=await pending,content=await readFile(await download.path(),'utf8');
  assert.ok(!content.includes('2345 6789 0123'));
  assert.ok((await page.locator('.report').textContent()).includes('Fresh contextual review'));
  if(unavailable)assert.ok((await page.locator('.report').textContent()).includes('Contextual worker/model unavailable'));
  if(!unavailable)assert.ok(!content.includes('4829107'));
  const metrics=await page.evaluate(()=>({resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('/models/')).map(r=>({duration:r.duration,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize})),jsHeap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null}));
  report.cases.push({unavailable,upload_to_export_ms:Date.now()-begin,...metrics});await page.close();
 }
 report.memory_scope='JS heap observed after upload/export, NOT peak renderer RSS or model-only memory. Browser peak memory remains unmeasured.';
 console.log(JSON.stringify(report,null,2));
 if(process.env.SHARESHIELD_AI_REPORT)await writeFile(process.env.SHARESHIELD_AI_REPORT,JSON.stringify(report,null,2));
}finally{await browser.close();}
