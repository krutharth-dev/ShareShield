import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/tmp/theme-evidence';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base=process.env.TEST_URL??'http://127.0.0.1:4174/app';
const result={theme:'Cloud Indigo',physicalDevice:false,viewports:[]};
try {
 for(const [name,width,height,touch] of [['desktop',1440,1000,false],['mobile',390,844,true]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
  const page=await context.newPage();page.on('dialog',dialog=>dialog.accept());
  await page.goto(new URL('/',base).href);await page.locator('.hero').waitFor();
  const overflow=()=>page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>{const b=el.getBoundingClientRect();return b.width&&b.right>innerWidth+2&&getComputedStyle(el).position!=='absolute'&&getComputedStyle(el).position!=='fixed';}).map(el=>el.className).slice(0,12)}));
  assert.ok((await overflow()).body<=width+2,JSON.stringify(await overflow()));
  assert.equal(await page.locator('.hero .btn').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(79, 70, 229)');
  await page.keyboard.press('Tab');assert.equal(await page.locator('.skip-link').evaluate(el=>el===document.activeElement),true);
  await page.locator('h1').click();await page.screenshot({path:out+'/'+name+'-landing.png'});
  if(touch){await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('navigation').getByRole('link',{name:'Features',exact:true}).click();}
  await page.goto(base);await page.locator('.upload-zone').waitFor();
  assert.ok((await overflow()).body<=width+2,JSON.stringify(await overflow()));
  assert.equal(await page.locator('.upload-zone').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  await page.screenshot({path:out+'/'+name+'-workspace.png'});
  await page.locator('input[type=file]').setInputFiles({name:'fictional-review.txt',mimeType:'text/plain',buffer:Buffer.from('Aadhaar: 2345 6789 0124\nEmail: example@example.test')});
  await page.getByRole('button',{name:/Analyze pending files/}).click();
  await page.locator('.report-heading').waitFor({timeout:120000});
  assert.ok((await overflow()).body<=width+2,JSON.stringify(await overflow()));
  assert.equal(await page.locator('.document-work').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  await page.locator('.document-work').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/'+name+'-review.png'});
  await page.locator('.priority-global-button').click();await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('dialog').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  assert.ok((await page.getByRole('dialog').boundingBox()).width<=width);
  await page.screenshot({path:out+'/'+name+'-priorities.png'});
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  result.viewports.push({name,width,height,overflow:false,whiteDocumentPanels:true,keyboardDialogClose:true});
  await context.close();
 }
 await writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
