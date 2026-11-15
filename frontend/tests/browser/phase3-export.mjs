import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=process.env.SHARESHIELD_EVIDENCE_DIR??'/tmp/phase3-exports';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({acceptDownloads:true,viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  page.on('dialog',d=>d.accept());
  // All document processing remains local. Test the unavailable-face-model path explicitly.
  await page.route(/https:\/\/(cdn\.jsdelivr\.net|storage\.googleapis\.com)\//,r=>r.abort());
  await page.goto(process.env.TEST_URL??'http://127.0.0.1:4174/app');
  await page.getByLabel('Printed OCR language').selectOption('eng+kan');
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('../phase3/fixtures/development-multipage.pdf',import.meta.url)));
  await page.getByRole('button',{name:/Analyze pending files/}).click();
  const select=page.getByRole('button',{name:'Select all',exact:true});await select.waitFor({timeout:120000});
  await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Select all');return b&&!b.disabled;},{},{timeout:120000});
  const cards=page.locator('.finding-card');
  assert.ok(await cards.filter({hasText:'AADHAAR CANDIDATE'}).count()>=4,'all four complete Aadhaar occurrences must survive');
  assert.ok(await cards.filter({hasText:'AADHAAR OCR REVIEW'}).count()>=1,'incomplete Aadhaar requires review');
  assert.equal(await cards.filter({hasText:'VIRTUAL ID'}).count(),0);
  await select.click();
  if(mobile){
   await page.getByLabel('Preview page').selectOption('1');
   await page.getByRole('button',{name:'Mark region',exact:true}).click();
   const area=page.locator('.preview-area');await area.scrollIntoViewIfNeeded();
   // Touch-capable desktop emulation: dispatch pointer events through the UI.
   const r=await area.boundingBox();const cdp=await page.context().newCDPSession(page);
   for(const [type,x,y] of [['touchStart',.02,.02],['touchMove',.2,.09],['touchEnd',.2,.09]])await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:r.x+r.width*x,y:r.y+r.height*y}]});
   await cdp.detach();
   assert.ok(await page.getByRole('button',{name:'Remove region 1',exact:true}).count()>0,'touch gesture must create a manual mask');
  }
  await page.getByRole('button',{name:'Redact & verify export',exact:true}).click();
  const link=page.locator('.report-heading a[download]');await link.waitFor({timeout:120000});
  await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Redact & verify export');return b&&!b.disabled;},{},{timeout:120000});
  const downloadEvent=page.waitForEvent('download');await link.click();const download=await downloadEvent;
  const prefix=mobile?'mobile-emulation':'desktop';await download.saveAs(output+'/'+prefix+'.pdf');
  const status=await page.locator('.report-heading h2').textContent();await writeFile(output+'/'+prefix+'-report.txt',await page.locator('.report').innerText());assert.equal(status.trim(),'UNVERIFIED','Pixel coverage must not override unavailable face/QR or semantic checks');
  results.push({viewport:prefix,status,findings:await cards.count(),aadhaar:await cards.filter({hasText:'AADHAAR CANDIDATE'}).count()});
  await page.getByRole('button',{name:'Clear workspace',exact:true}).click();assert.equal(await page.locator('.finding-card').count(),0);
  await page.close();
 }
}finally{await browser.close();}
await writeFile(output+'/browser.json',JSON.stringify({browser:browser.version(),results},null,2)+'\n');console.log(JSON.stringify(results));
