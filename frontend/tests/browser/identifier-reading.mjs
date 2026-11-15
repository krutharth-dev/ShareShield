import {chromium} from 'playwright';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/tmp/identifier-evidence';await mkdir(out,{recursive:true});
const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),sheet=pdf.addPage([600,800]);
sheet.drawText('Fictional identifier regression fixture',{x:40,y:770,size:12,font});
sheet.drawText('Aadhaar:',{x:40,y:730,size:18,font});
for(let i=0;i<10;i++)sheet.drawText('2345 6789 0124',{x:160,y:730-i*48,size:18,font});
const bytes=await pdf.save();await writeFile(out+'/original.pdf',bytes);
const evidence={physicalDevice:false,results:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({acceptDownloads:true});page.on('dialog',d=>d.accept());
 await page.route(/^https?:\/\//,route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:4174/app');
 evidence.commit=(await (await page.request.get('http://127.0.0.1:4174/build-info.json')).json()).commit;
 if(process.env.EXPECTED_COMMIT)assert.equal(evidence.commit,process.env.EXPECTED_COMMIT);
 await page.getByLabel('Printed OCR language').selectOption('eng');
 await page.locator('input[type=file]').setInputFiles({name:'fictional-identifiers.pdf',mimeType:'application/pdf',buffer:Buffer.from(bytes)});
 const started=Date.now();await page.getByRole('button',{name:/Analyze pending files/}).click();
 const exportButton=page.getByRole('button',{name:'Redact & verify export',exact:true});
 await exportButton.waitFor({timeout:180000});
 await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Redact & verify export');return b&&!b.disabled;},{},{timeout:180000});
 evidence.analysisMs=Date.now()-started;
 const rows=page.locator('.finding-card:not([data-region-count="0"])').getByRole('checkbox',{name:/Select AADHAAR REVIEW on page/});
 assert.equal(await rows.count(),10,'each of ten adjacent source rows must be localized independently');
 for(let i=0;i<10;i++)assert.equal(await rows.nth(i).isChecked(),false,'ambiguous row association cannot auto-approve');
 assert.equal(await page.getByRole('checkbox',{name:/VIRTUAL ID/}).count(),0);
 async function save(name){
  const start=Date.now();await exportButton.click();
  const link=page.locator('.report-heading a[download]');await link.waitFor({timeout:180000});
  const event=page.waitForEvent('download');await link.click();await (await event).saveAs(out+'/'+name+'.pdf');
  if(await page.locator('.report details').getAttribute('open')===null)await page.getByText('Warnings, export hash & report',{exact:true}).click();
  const report=page.waitForEvent('download');await page.getByRole('button',{name:'Download verification JSON'}).click();await (await report).saveAs(out+'/'+name+'.json');
  const status=(await page.locator('.report-heading h2').textContent()).trim();
  evidence.results.push({name,status,exportAndVerificationMs:Date.now()-start});return status;
 }
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 assert.equal(await save('unapproved'),'FLAG');
 for(let i=0;i<10;i++)await rows.nth(i).check();
 assert.notEqual(await save('approved'),'SCOPED CLEAR','unavailable visual checks remain unresolved');
 await rows.first().uncheck();assert.equal(await page.locator('.report').count(),0);
 assert.equal(await save('one-deselected'),'FLAG');
 await page.getByRole('button',{name:'Clear workspace',exact:true}).click();
 assert.equal(await page.locator('.finding-card').count(),0);
}finally{await browser.close();await writeFile(out+'/browser.json',JSON.stringify(evidence,null,2)+'\n');}
console.log(JSON.stringify(evidence));
