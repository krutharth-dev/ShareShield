// Real Tesseract WASM + actual analyze(), synthetic-only. TEST_URL: local Vite.
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile(new URL('./fixtures/'+(process.env.MANIFEST??'manifest.json'),import.meta.url),'utf8'));
const split=process.env.SPLIT??'development';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const report={schema:1,split,browser:browser.version(),source:process.env.SOURCE_SHA,scope:'Synthetic generator gold. No independent annotations. External face assets blocked identically in all arms; face verification remains incomplete.',documents:[]};
try{
 const page=await browser.newPage();
 await page.route(/https:\/\/(cdn\.jsdelivr\.net|storage\.googleapis\.com)\//,r=>r.abort());
 await page.goto(process.env.TEST_URL??'http://127.0.0.1:4174/app');
 for(const doc of manifest.documents.filter(d=>d.split===split&&(!process.env.ONLY||d.id.includes(process.env.ONLY)))){
  const bytes=await readFile(new URL('./fixtures/'+doc.file,import.meta.url));
  if(createHash('sha256').update(bytes).digest('hex')!==doc.sha256)throw Error('Fixture hash changed');
  const result=await page.evaluate(async({doc,base64})=>{
   const {default:{createWorker}}=await import('/node_modules/tesseract.js/dist/tesseract.esm.min.js');
   const {analyze,forget}=await import('/src/processor.ts');
   const {detect}=await import('/src/detection.ts');
   const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
   const image=await createImageBitmap(new Blob([bytes]));const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);image.close();
   const start=performance.now();const worker=await createWorker(doc.language.split('+'),1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',workerBlobURL:false,cacheMethod:'none'});
   const raw=await worker.recognize(c,{}, {blocks:true,text:true});const rawMs=performance.now()-start;
   const enlarged=document.createElement('canvas');enlarged.width=c.width*2;enlarged.height=c.height*2;enlarged.getContext('2d').drawImage(c,0,0,enlarged.width,enlarged.height);
   const scaledStart=performance.now();const scaled=await worker.recognize(enlarged,{}, {blocks:true,text:true});const scaledMs=performance.now()-scaledStart;
   enlarged.width=enlarged.height=0;await worker.terminate();
   const heights=(raw.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words.map(w=>w.bbox.y1-w.bbox.y0)))).filter(h=>h>0).sort((a,b)=>a-b);
   const rescue=c.width*c.height<=1500000&&(heights.length?heights[Math.floor(heights.length/2)]<14:c.width*c.height<=500000);
   const rawText=(raw.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.map(l=>l.words.map(w=>w.text).join(' ')))).join('\n')||raw.data.text;
   const t=performance.now();let ticks=0,last=performance.now(),maxGap=0;const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++},16);
   const analysis=await analyze(new File([bytes],doc.file,{type:'image/png'}),doc.language);clearInterval(timer);
   const result={id:doc.id,raw_text:rawText,raw_ms:rawMs,rescue_applied:rescue,raw_confidence:raw.data.confidence,scaled_text:scaled.data.text,scaled_ms:scaledMs,scaled_confidence:scaled.data.confidence,deterministic:detect(rawText),findings:analysis.findings,analysis_ms:performance.now()-t,heartbeat_ticks:ticks,max_heartbeat_gap_ms:maxGap,warnings:analysis.warnings};
   forget(analysis.file_id);c.width=c.height=0;return result;
  },{doc,base64:bytes.toString('base64')});
  report.documents.push(result);console.log(doc.id,Math.round(result.analysis_ms)+'ms',result.findings.length+' findings');
 }
}finally{await browser.close();}
await writeFile(process.env.REPORT??'/tmp/phase3-benchmark.json',JSON.stringify(report,null,2)+'\n');
