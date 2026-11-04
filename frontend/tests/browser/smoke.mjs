import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const evidenceDir=process.env.SHARESHIELD_EVIDENCE_DIR;
if(evidenceDir)await mkdir(evidenceDir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({acceptDownloads:true});
page.on('dialog',d=>d.accept());
page.on('pageerror',error=>console.error('Browser page error:',error.message));
page.on('requestfailed',req=>console.error('Browser request failed:',req.url(),req.failure()?.errorText));
try{
 const root=new URL('/',process.env.TEST_URL??'http://127.0.0.1:4174/app').toString();
 await page.goto(root,{waitUntil:'networkidle'});
 assert.equal(await page.getByRole('heading',{name:/A real workflow/}).count(),1,'Presentation page must describe the live demonstration');
 await page.getByRole('link',{name:'Launch guided demo'}).click();
 assert.ok((await page.locator('.upload-zone').textContent())?.includes('no fixed PDF page limit'),'Upload UI must not claim a fixed PDF page cap');
 assert.equal(await page.getByRole('combobox',{name:'Printed OCR language',exact:true}).count(),1,'OCR language selector must have an exact accessible name');
 assert.equal(await page.getByLabel('Printed OCR language').inputValue(),'eng+kan',
  'The workspace must default to English + Kannada for mixed-language documents');
 for(const code of ['eng','kan']){
  const asset=await page.request.get(new URL('/ocr/'+code+'.traineddata.gz',root).toString());
  assert.equal(asset.status(),200,code+' Tesseract traineddata must be served by the deployed build');
  const bytes=await asset.body();
  assert.ok(bytes.length>100000,code+' language data must not be the SPA fallback');
  // HTTP servers may transparently decode .gz content, so do not require the gzip header.
  assert.ok(!new TextDecoder().decode(bytes.subarray(0,96)).toLowerCase().includes('<!doctype html'),code+' must not serve SPA HTML');
 }
 console.log('PASS mixed-language default and packaged OCR language assets');

 await page.getByRole('region',{name:'Guided demonstration'}).waitFor({state:'visible',timeout:20000});
 assert.equal(await page.getByRole('region',{name:'Guided demonstration'}).count(),1,'Guided demo deep link must open tour');
 assert.equal(await page.getByRole('button',{name:'Load the demo PDF'}).count(),1,'Guided tour must offer a real synthetic sample');
 await page.getByRole('button',{name:'Close demo tour'}).click();
 assert.equal(await page.getByRole('region',{name:'Guided demonstration'}).count(),0,'Tour must close without changing document state');
 assert.equal(await page.locator('.app-header .demo-tour-toggle').getAttribute('aria-expanded'),'false');

 assert.equal(await page.getByRole('button',{name:'Open Priorities',exact:true}).count(),1,'Priority button must be visible on first load');
 assert.equal(await page.getByRole('button',{name:'Open Priorities anywhere'}).count(),1,'Floating priorities control must exist');
 await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
 await page.getByRole('button',{name:'Open Priorities anywhere'}).click();
 assert.equal(await page.getByRole('dialog',{name:'Sensitive information priorities'}).count(),1,'Floating priority button opens modal when scrolled');
 await page.getByRole('button',{name:'Close priorities'}).click();
 await page.evaluate(()=>window.scrollTo(0,0));

 await page.getByRole('button',{name:'Open Priorities',exact:true}).click();
 const emptyPriorityDialog=page.getByRole('dialog',{name:'Sensitive information priorities'});
 assert.equal(await emptyPriorityDialog.count(),1,'Priority overlay must open without uploading a file');
 for(const tier of ['HIGH','MEDIUM','LOW'])assert.equal(await emptyPriorityDialog.getByRole('region',{name:tier+' priority'}).count(),1);
 await page.getByRole('button',{name:'Close priorities'}).click();

 await page.locator('input[type="file"]').setInputFiles({
   name:'fictional-identity.txt',mimeType:'text/plain',
   buffer:Buffer.from('Name: Sample Person\nEmail: fictional@example.test\nPassword: DummySecret4829\nStudent ID: TEST2026A\n')
 });
 await page.getByRole('button',{name:/Analyze pending files/}).click();
 await page.locator('.finding-card').first().waitFor({timeout:20000});
 assert.equal(await page.getByRole('region',{name:'Pre-export coverage preview'}).count(),1,'Coverage checkpoint must exist after analysis');
 assert.ok((await page.getByRole('region',{name:'Pre-export coverage preview'}).textContent())?.includes('High findings covered'));

 assert.ok((await page.locator('.finding-card').first().textContent()).includes('not a calibrated probability'),'Finding cards explain heuristic confidence');
 assert.ok((await page.locator('.finding-card').first().textContent()).includes('Source line'),'Finding cards preserve source context');
 assert.ok((await page.locator('.finding-card').first().textContent()).includes('label or shape recognition'),'Finding cards expose validation scope');
 assert.ok(await page.locator('.finding-card input:checked').count()>=1,'Confident high-priority credentials should be auto-selected');
 assert.equal(await page.locator('.finding-box').count(),0,'Plain-text inputs have no visual page overlay');
 await page.locator('.findings-panel .priority-trigger').click();
 const dialog=page.getByRole('dialog',{name:'Sensitive information priorities'});
 assert.equal(await dialog.count(),1,'Priority overlay opens on demand');
 await dialog.locator('.priority-dialog-row').filter({hasText:'CREDENTIAL OR SECRET'}).getByRole('button',{name:'View findings'}).click();
 assert.equal(await page.locator('.finding-card').count(),1);
 await page.getByRole('button',{name:'Show all findings'}).click();
 await page.getByRole('button',{name:'Select all',exact:true}).click();
 if(await page.getByRole('button',{name:/Review .* uncertain OCR regions/}).count()){
  await page.getByRole('button',{name:/Review .* uncertain OCR regions/}).click();
  await page.getByRole('button',{name:'Select all',exact:true}).click();
 }
 console.log('PASS user-defined numbered PII review priorities');

 assert.ok(await page.locator('.finding-card').count()>=3,'Expected email/password/student-ID candidates');
 await page.getByRole('button',{name:'Redact & verify export'}).click();
 await page.locator('.report').waitFor({timeout:20000});
 const status=(await page.locator('.report-heading h2').textContent())?.trim()??'';
 assert.equal(status,'SCOPED CLEAR','Text-only synthetic output should pass configured checks');
 const downloadEvent=page.waitForEvent('download');
 await page.getByRole('link',{name:/Download scoped-checked file/}).click();
 const download=await downloadEvent;
 const file=await download.path();
 assert.ok(file,'Downloaded export must exist');
 const exported=(await readFile(file)).toString('utf8');
 assert.ok(exported.includes('[REDACTED]'),'Redaction placeholders required');
 for(const secret of ['fictional@example.test','DummySecret4829','TEST2026A'])
   assert.ok(!exported.includes(secret),'Downloaded export must not contain '+secret);
 if(evidenceDir)await writeFile(evidenceDir+'/redacted.txt',exported);
 console.log('PASS browser redaction and reopened downloaded-file inspection');
 await page.getByRole('button',{name:'Clear selection'}).click();
 await page.getByRole('button',{name:'Redact & verify export'}).click();
 await page.locator('.report').waitFor({timeout:20000});
 const unsafe=(await page.locator('.report-heading h2').textContent())?.trim()??'';
 assert.notEqual(unsafe,'SCOPED CLEAR','Export with zero approved redactions must not be safe');
 console.log('PASS browser zero-selection cannot clear');
 await page.getByRole('button',{name:'AI GUIDE',exact:true}).click();
 assert.ok((await page.getByRole('dialog',{name:'AI Guide'}).textContent()).includes('rule-based'));
 await page.getByRole('button',{name:'medical',exact:true}).click();
 assert.ok((await page.locator('.guide-answer').textContent()).includes('Grade: A+'));
 await page.getByRole('button',{name:'Close AI Guide'}).click();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Open Priorities anywhere'}).click();
 assert.equal(await page.getByRole('dialog').count(),1);
 await page.getByRole('button',{name:'Close priorities'}).click();
 await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:/Clear workspace/}).click();
 await page.locator('input[type="file"]').setInputFiles({name:'context.txt',mimeType:'text/plain',buffer:Buffer.from('PAN: ABCDE1234F\nEmail: optional@example.test\nBlood Group: A+\nGrade: A+\nCGPA: 9.2')});
 await page.getByRole('button',{name:/Analyze pending files/}).click();
 await page.locator('.finding-card').first().waitFor();
 await page.getByRole('button',{name:'Open Priorities',exact:true}).click();
 for(const tier of ['HIGH','MEDIUM','LOW']){
  const rows=page.getByRole('region',{name:tier+' priority'}).locator('.priority-index');
  assert.equal(await rows.first().textContent(),'#1');
 }
 await page.getByRole('button',{name:'Close priorities'}).click();
 await page.getByLabel('Sharing purpose').selectOption('medical');
 assert.ok((await page.locator('.finding-card').filter({has:page.getByRole('heading',{name:'BLOOD GROUP',exact:true})}).textContent()).includes('MEDIUM'));
 await page.locator('.finding-card').filter({hasText:'PAN CANDIDATE'}).locator('input').check();
 await page.getByRole('button',{name:'Redact & verify export'}).click();
 await page.locator('.report').waitFor();
 assert.equal((await page.locator('.report-heading h2').textContent()).trim(),'SCOPED CLEAR');
 const optionalBytes=await page.evaluate(async()=>await (await fetch(document.querySelector('.report-heading a').href)).text());
 assert.ok(optionalBytes.includes('optional@example.test')&&optionalBytes.includes('Blood Group: A+'));
 assert.ok(!optionalBytes.includes('ABCDE1234F'));
 await page.getByLabel('Sharing purpose').selectOption('public');
 assert.equal(await page.locator('.report').count(),0,'Context changes invalidate previous clearance');
 // Simulate a user overriding an automatic high-priority mask: verification must flag exposure.
 await page.locator('.finding-card').filter({has:page.getByRole('heading',{name:'BLOOD GROUP',exact:true})}).locator('input[type="checkbox"]').uncheck();
 await page.getByRole('button',{name:'Redact & verify export'}).click();
 await page.locator('.report').waitFor();
 assert.equal((await page.locator('.report-heading h2').textContent()).trim(),'FLAG','Public health exposure remains mandatory');
 console.log('PASS purpose changes, tier-local ranks, manual override and mandatory health clearance');
 // Exercise the existing synthetic printed PDF, source preview and actual
 // rasterized downloadable PDF. This does not validate handwritten accuracy.
 await page.getByRole('button',{name:/Clear workspace/}).click();
 const {PDFDocument,StandardFonts,PDFName}=await import('pdf-lib');
 const fixture=await PDFDocument.create(),font=await fixture.embedFont(StandardFonts.Helvetica);
 for(let i=0;i<2;i++){const p=fixture.addPage([595,420]);['FICTIONAL REVIEW SAMPLE '+(i+1),'Email: demo.person@example.test','PAN: ABCDE1234F','Password: DemoSecret_4829','Public note: share the summary.'].forEach((line,j)=>p.drawText(line,{x:48,y:365-j*48,size:16,font}));}
 await page.locator('input[type="file"]').setInputFiles({name:'fictional-two-pages.pdf',mimeType:'application/pdf',buffer:Buffer.from(await fixture.save())});
 await page.getByLabel('Printed OCR language').selectOption('eng');
 await page.getByRole('button',{name:/Analyze pending files/}).click();
 const pdfState=await Promise.race([
   page.locator('.finding-card').first().waitFor({timeout:60000}).then(()=> 'findings'),
   page.locator('.document-work [role="alert"]').first().waitFor({timeout:60000}).then(()=> 'error')
 ]).catch(()=> 'timeout');
 if(pdfState!=='findings'){
   const status=await page.locator('.document-item small').allTextContents();
   const errors=await page.locator('.document-work [role="alert"]').allTextContents();
   throw Error('PDF analysis failed: '+JSON.stringify({pdfState,status,errors,processing:await page.locator('.processing').allTextContents()}));
 }
 assert.equal(await page.getByLabel('Preview page').locator('option').count(),2);
 assert.ok(await page.locator('.preview-area img').count()>0,'Original PDF preview must render');
 await page.getByRole('button',{name:'Mark region',exact:true}).click();
 await page.locator('.preview-area').scrollIntoViewIfNeeded();
 const rect=await page.locator('.preview-area').boundingBox();assert.ok(rect);
 await page.mouse.move(rect.x+30,rect.y+30);await page.mouse.down();await page.mouse.move(rect.x+120,rect.y+80,{steps:8});await page.mouse.up();
 await page.getByLabel('Region 1 x',{exact:true}).fill('35');
 await page.getByLabel('Region 1 width',{exact:true}).fill('100');
 assert.equal(await page.getByLabel('Region 1 x',{exact:true}).inputValue(),'35');
 assert.equal(await page.getByLabel('Region 1 width',{exact:true}).inputValue(),'100');
 await page.getByRole('button',{name:'Remove region 1',exact:true}).click();
 assert.equal(await page.locator('.manual-editor').count(),0);
 await page.getByRole('button',{name:'Mark region',exact:true}).click();
 console.log('PASS add, move, resize and delete manual region');
 await page.getByRole('button',{name:'Clear selection'}).click();
 await page.getByRole('button',{name:/Redact & verify export/}).click();
 await page.locator('.report').waitFor({timeout:90000});
 await page.getByRole('region',{name:'Exported PDF page preview'}).waitFor({state:'visible',timeout:20000});
 await page.getByRole('img',{name:'Rendered exported PDF page'}).waitFor({state:'visible',timeout:20000});
 await page.locator('canvas[aria-label="Rendered exported PDF page"][data-rendered="true"]').waitFor({timeout:20000});
 assert.equal(await page.getByRole('button',{name:'Next exported page'}).count(),1,'In-app PDF page navigation is required');
 const statusPdf=(await page.locator('.report-heading h2').textContent())?.trim();
 assert.equal(statusPdf,'FLAG','Known unselected High exposures must flag even if OCR fails');
 if(evidenceDir){const href=await page.locator('.report-heading a[download]').getAttribute('href');const bytes=await page.evaluate(async url=>Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())),href);await writeFile(evidenceDir+'/flagged-reference.pdf',Buffer.from(bytes));}
 await page.getByRole('button',{name:'Select all',exact:true}).click();
 await page.getByRole('button',{name:/Redact & verify export/}).click();
 await page.locator('.report').waitFor({timeout:90000});
 const link=page.locator('.report-heading a[download]');
 assert.equal(await link.count(),1,'Exported PDF must have a downloadable link');
 const exportHref=await link.getAttribute('href');
 assert.ok(exportHref?.startsWith('blob:'),'Exported PDF must use a local blob URL');
 // Headless Chromium PDF viewer may suppress download events for blob PDFs.
 // Read the exact same bytes addressed by the download link, independent of
 // the redaction overlay or original PDF source.
 const base64=await page.evaluate(async href=>{
   const blob=await (await fetch(href)).blob();
   return await new Promise((resolve,reject)=>{
     const reader=new FileReader();
     reader.onerror=()=>reject(reader.error);
     reader.onload=()=>resolve(String(reader.result).split(',')[1]);
     reader.readAsDataURL(blob);
   });
 },exportHref);
 const pdfBytes=Buffer.from(base64,'base64');
 await writeFile('/tmp/shareshield-browser-redacted.pdf',pdfBytes);
 if(evidenceDir){await writeFile(evidenceDir+'/redacted-two-page.pdf',pdfBytes);await writeFile(evidenceDir+'/live-report.txt',await page.locator('.report').innerText());await page.locator('.report').screenshot({path:evidenceDir+'/live-export-preview.png'});}
 assert.equal(pdfBytes.subarray(0,5).toString('utf8'),'%PDF-');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const pdfTask=getDocument({data:new Uint8Array(pdfBytes),useSystemFonts:true});
 const rebuilt=await pdfTask.promise;
 assert.equal(rebuilt.numPages,2);
 const exportedText=(await (await rebuilt.getPage(1)).getTextContent()).items.map(item=>'str' in item?item.str:'').join('');
 assert.equal(exportedText,'','Rasterized exported PDF must not retain searchable source text objects');
 await pdfTask.destroy();
 console.log('PASS browser PDF export blob is independently reopened without searchable text');

 // Synthetic ten-page acceptance exceeds the old hard cap. Private ID scans stay out of GitHub.
 await page.getByRole('button',{name:/Clear workspace/}).click();
 const eight=await PDFDocument.create();
 // Intentionally include source-only metadata and an attachment to prove that
 // rasterized output discards hidden original data, not just visible pixels.
 const privateMarker='FAKE_SOURCE_METADATA_SECRET_DO_NOT_RETAIN';
 eight.setTitle(privateMarker);
 await eight.attach(new TextEncoder().encode('FICTIONAL_ATTACHMENT_SECRET_MARKER'),'synthetic-hidden.txt',{
  mimeType:'text/plain',description:'Synthetic export hygiene fixture'
 });
 for(let i=0;i<10;i++){
  const p=eight.addPage([360,230]);
  p.drawText('FICTIONAL ACADEMIC PAGE '+(i+1),{x:20,y:190,size:13,font});
  p.drawText('Public subject: Computer Science',{x:20,y:150,size:12,font});
  p.drawText('Email: fictional'+(i+1)+'@example.test',{x:20,y:110,size:11,font});
 }
 const withAttachment=Buffer.from(await eight.save());
 const sourcePdf=await PDFDocument.load(withAttachment);
 assert.ok(sourcePdf.catalog.lookup(PDFName.of('Names')),
  'Fixture must include an embedded-file Names dictionary before export');
 assert.equal(sourcePdf.getTitle(),privateMarker,'Fixture must contain private synthetic title metadata');
 await page.locator('input[type="file"]').setInputFiles({
  name:'synthetic-ten-page-academic.pdf',mimeType:'application/pdf',buffer:withAttachment
 });
 await page.getByLabel('Printed OCR language').selectOption('eng');
 await page.getByRole('button',{name:/Analyze pending files/}).click();
 await page.getByLabel('Preview page').locator('option').nth(9).waitFor({state:'attached',timeout:240000});
 assert.equal(await page.getByLabel('Preview page').locator('option').count(),10,
  'All ten source pages must be available in one workspace');
 await page.getByLabel('Preview page').selectOption('9');
 assert.ok(await page.locator('.preview-area img').count()>0);
 await page.getByRole('button',{name:'Redact & verify export'}).click();
 await page.locator('.report-heading a[download]').waitFor({timeout:240000});
 const hrefEight=await page.locator('.report-heading a[download]').getAttribute('href');
 const bytesEight=await page.evaluate(async href=>{
  const file=await (await fetch(href)).blob();
  return await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onerror=()=>reject(reader.error);
   reader.onload=()=>resolve(String(reader.result).split(',')[1]);
   reader.readAsDataURL(file);
  });
 },hrefEight);
 const eightTask=getDocument({data:new Uint8Array(Buffer.from(bytesEight,'base64')),useSystemFonts:true});
 const exportedEight=await eightTask.promise;
 assert.equal(exportedEight.numPages,10,'Actual downloaded PDF must retain all ten pages');
 const exportedBytes=Buffer.from(bytesEight,'base64');
 if(evidenceDir)await writeFile(evidenceDir+'/redacted-ten-page.pdf',exportedBytes);
 const reconstructed=await PDFDocument.load(exportedBytes);
 assert.ok(!reconstructed.catalog.lookup(PDFName.of('Names')),
  'Rasterized export must not import the source PDF embedded-file Names catalog');
 assert.notEqual(reconstructed.getTitle(),privateMarker,
  'Rasterized export must discard the source PDF title metadata');
 assert.equal(Object.keys((await exportedEight.getAttachments())??{}).length,0,
  'PDF.js must not expose attachments in the redacted downloaded PDF');
 await eightTask.destroy();
 assert.notEqual((await page.locator('.report-heading h2').textContent())?.trim(),'SCOPED CLEAR',
  'No approved masks must never lead to a cleared result');
 console.log('PASS no fixed page cap: ten-page PDF analysis and reopened exported PDF');
 // Mini-project acceptance: 12-digit Aadhaar selectable; labelled VID/BID excluded from the redaction list.
 await page.getByRole('button',{name:/Clear workspace/}).click();
 assert.equal(await page.getByLabel('Identifier validation').count(),0,'Experimental 16-digit profile must be removed');
 const aadhaarValue='1234 5678 9012',vidValue='8765 4321 8765 4321',bidValue='9107 2702 3707 5395';
 await page.locator('input[type="file"]').setInputFiles({name:'v2-official-aadhaar.txt',mimeType:'text/plain',
  buffer:Buffer.from('Aadhaar Number: '+aadhaarValue+'\nVID: '+vidValue+'\nBID: '+bidValue+'\nBank Account: 1111222233334444\nGrade: A+\n')});
 await page.getByRole('button',{name:/Analyze pending files/}).click();
 const aadhaarCard=page.locator('.finding-card').filter({hasText:'AADHAAR REVIEW'});
 await aadhaarCard.waitFor({state:'visible',timeout:30000});
 assert.equal(await aadhaarCard.count(),1,'One true 12-digit Aadhaar-labelled field must produce one review finding');
 assert.equal(await page.locator('.finding-card').filter({hasText:'VIRTUAL ID'}).count(),0,'VID/BID must not appear in the redaction list');
 // BID is represented as a separate labelled virtual-ID finding.
 await page.getByRole('button',{name:'Select all',exact:true}).click();
 const selectedCategories=await page.locator('.finding-card input:checked').count();
 assert.ok(selectedCategories>=1,'Aadhaar should remain selectable');
 await page.getByRole('button',{name:'Clear selection'}).click();
 await aadhaarCard.locator('input[type="checkbox"]').check();
 await page.getByRole('button',{name:'Redact & verify export'}).click();
 await page.locator('.report-heading a[download]').waitFor({timeout:25000});
 const latestExport=await page.locator('.report-heading a[download]').getAttribute('href');
 const exportedV2Text=await page.evaluate(async url=>await (await fetch(url)).text(),latestExport);
 assert.ok(!exportedV2Text.includes(aadhaarValue),'Selected 12-digit Aadhaar value must be absent from export');
 assert.ok(exportedV2Text.includes(vidValue),'VID must remain untouched');
 assert.ok(exportedV2Text.includes(bidValue),'BID must remain untouched');
 assert.ok(exportedV2Text.includes('Grade: A+'),'Ordinary academic content must remain');
 console.log('PASS mini project: 12-digit Aadhaar redaction with VID/BID deliberately out of scope');
 // Adversarial plaintext: normalization must never shift export positions.
 await page.getByRole('button',{name:/Clear workspace/}).click();
 const hiddenSecret='synthetic\u200b secret';
 const adversarialSource='{"password":"'+hiddenSecret+'"}\r\nＰＡＮ：ＡＢＣＰＥ１２３４Ｆ\r\nPrescription:\r\n  fictional first medicine\r\n  fictional tail medicine\r\nGrade: A+\r\nEND_PUBLIC';
 await page.locator('input[type="file"]').setInputFiles({name:'adversarial-offsets.txt',mimeType:'text/plain',buffer:Buffer.from(adversarialSource)});
 await page.getByRole('button',{name:/Analyze pending files/}).click();
 await page.locator('.finding-card').filter({hasText:'MEDICAL TEXT BLOCK REVIEW'}).first().waitFor({timeout:20000});
 await page.getByRole('button',{name:'Open Priorities',exact:true}).click();
 await page.locator('.priority-dialog-manual').getByRole('button',{name:'View findings'}).click();
 assert.ok(await page.locator('.finding-card').filter({hasText:'MEDICAL TEXT BLOCK REVIEW'}).count()>=2,'Continuation lines must appear in the separate manual queue');
 await page.getByRole('button',{name:'Show all findings'}).click();
 await page.getByRole('button',{name:'Select all',exact:true}).click();
 await page.getByRole('button',{name:'Redact & verify export'}).click();
 await page.locator('.report-heading a[download]').waitFor({timeout:25000});
 const adversarialLink=await page.locator('.report-heading a[download]').getAttribute('href');
 const adversarialExport=await page.evaluate(async url=>await (await fetch(url)).text(),adversarialLink);
 for(const secret of [hiddenSecret,'ＡＢＣＰＥ１２３４Ｆ','fictional tail medicine'])assert.ok(!adversarialExport.includes(secret),'Complete source value must be absent from actual export');
 assert.ok(adversarialExport.includes('END_PUBLIC'),'Unrelated suffix must survive normalized redaction');
 if(evidenceDir)await writeFile(evidenceDir+'/unicode-export.txt',adversarialExport);
 console.log('PASS normalized source offsets, multiline review queue and exported plaintext');
}finally{await page.close();await browser.close();}
