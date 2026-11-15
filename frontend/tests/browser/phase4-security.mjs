import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=process.env.SHARESHIELD_EVIDENCE_DIR??'/tmp/phase4-exports';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
const evidence={browser:browser.version(),physicalDevice:false,results:[],externalRequests:[]};
try{
 const page=await browser.newPage({acceptDownloads:true});page.on('dialog',d=>d.accept());
 await page.route(/^https?:\/\//,async r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'){evidence.externalRequests.push({host:u.hostname,method:r.request().method(),hasBody:!!r.request().postData()});return r.abort();}return r.continue();});
 await page.goto(process.env.TEST_URL??'http://127.0.0.1:4174/app');
 evidence.buildCommit=(await (await page.request.get(new URL('/build-info.json',page.url()).toString())).json()).commit;
 if(process.env.EXPECTED_COMMIT)assert.equal(evidence.buildCommit,process.env.EXPECTED_COMMIT);
 await page.getByLabel('Printed OCR language').selectOption('eng');
 const source=fileURLToPath(new URL('../phase4/fixtures/adversarial.pdf',import.meta.url));
 await page.locator('input[type=file]').setInputFiles(source);
 let start=Date.now();await page.getByRole('button',{name:/Analyze pending files/}).click();
 const button=page.getByRole('button',{name:'Redact & verify export',exact:true});await button.waitFor({timeout:180000});
 await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Redact & verify export');return b&&!b.disabled;},{},{timeout:180000});
 evidence.analysisAndAutomaticExportMs=Date.now()-start;
 const aadhaar=page.locator('.finding-card:not([data-region-count="0"])').getByRole('checkbox',{name:/Select AADHAAR CANDIDATE on page/});assert.ok(await aadhaar.count()>=10,'ten upright physical Aadhaar occurrences must be localized');
 evidence.aadhaarOccurrences=await aadhaar.count();assert.equal(await page.getByRole('checkbox',{name:/VIRTUAL ID/}).count(),0);
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 // Open the details containing the report download once an output exists.
 async function exportWithReport(name){
  const start=Date.now();await button.click();const link=page.locator('.report-heading a[download]');await link.waitFor({timeout:180000});
  const event=page.waitForEvent('download');await link.click();const file=await event;assert.equal(file.suggestedFilename(),'shareshield-redacted.pdf');await file.saveAs(out+'/'+name+'.pdf');
  if(await page.locator('.report details').getAttribute('open')===null)await page.getByText('Warnings, export hash & report',{exact:true}).click();
  const reportEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download verification JSON'}).click();await (await reportEvent).saveAs(out+'/'+name+'.json');
  const status=(await page.locator('.report-heading h2').textContent()).trim();evidence.results.push({name,status,exportAndVerificationMs:Date.now()-start});return status;
 }
 assert.equal(await exportWithReport('known-unredacted'),'FLAG');
 for(let i=0;i<await aadhaar.count();i++)await aadhaar.nth(i).check();
 await page.getByRole('button',{name:'Mark region',exact:true}).click();
 async function drawRegion(pageIndex,index,box){
  await page.getByLabel('Preview page').selectOption(String(pageIndex));
  const area=page.locator('.preview-area');await area.scrollIntoViewIfNeeded();const bounds=await area.boundingBox();
  await page.mouse.move(bounds.x+10,bounds.y+10);await page.mouse.down();await page.mouse.move(bounds.x+60,bounds.y+50);await page.mouse.up();
  for(const key of ['width','height'])await page.getByLabel(`Region ${index} ${key}`,{exact:true}).fill('10');
  for(const [key,value] of Object.entries(box))await page.getByLabel(`Region ${index} ${key}`,{exact:true}).fill(String(value));
 }
 // Vertical OCR does not localize the rotated native-text finding: explicit manual approval.
 await drawRegion(1,1,{x:416,y:174,width:54,height:242});
 evidence.rotatedOccurrence='manual mask required; automatic localization unavailable';
 await drawRegion(2,2,{x:20,y:160,width:580,height:250});
 // Reject an invalid resize without silently clipping the existing approval.
 await page.getByLabel('Region 2 width',{exact:true}).fill('99999');
 assert.equal(await page.getByLabel('Region 2 width',{exact:true}).inputValue(),'580');
 // Overlapping regions can be drawn and undone independently.
 await drawRegion(2,3,{x:30,y:170,width:50,height:50});
 await page.getByRole('button',{name:/Undo last manual region/}).click();
 assert.equal(await page.getByLabel('Region 3 x',{exact:true}).count(),0);
 const status=await exportWithReport('approved');assert.notEqual(status,'SCOPED CLEAR');
 await page.getByRole('button',{name:'Remove region 2',exact:true}).click();
 assert.equal(await page.locator('.report').count(),0,'selection changes invalidate previous report');
 await exportWithReport('manual-removed');
 // Deselect a single repeated physical occurrence; all other masks must persist.
 await aadhaar.first().uncheck();await exportWithReport('one-deselected');
 await page.getByLabel('Sharing purpose').selectOption('medical');assert.equal(await page.locator('.report').count(),0);
 evidence.storage=await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),memory:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null}));
 await page.getByRole('button',{name:'Clear workspace',exact:true}).click();assert.equal(await page.locator('.finding-card').count(),0);
 // Large adaptive-scale output must retain the original point dimensions.
 await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('../phase4/fixtures/large.pdf',import.meta.url)));
 start=Date.now();await page.getByRole('button',{name:/Analyze pending files/}).click();
 await button.waitFor({timeout:180000});await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Redact & verify export');return b&&!b.disabled;},{},{timeout:180000});
 evidence.largeAnalysisMs=Date.now()-start;
 if(await page.getByRole('button',{name:'Mark region',exact:true}).getAttribute('aria-pressed')!=='true')await page.getByRole('button',{name:'Mark region',exact:true}).click();
 await drawRegion(0,1,{x:100,y:100,width:500,height:200});await exportWithReport('large');
 await page.getByRole('button',{name:'Clear workspace',exact:true}).click();
 assert.ok(evidence.externalRequests.every(r=>r.method==='GET'&&!r.hasBody),'no outbound document request');
}finally{await browser.close();await writeFile(out+'/browser.json',JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify(evidence));
