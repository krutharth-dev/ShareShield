import {createContextRecognizer} from './context-client';
import {classifyPriority,inferDocumentType,type SharingPurpose} from './priority';
import {isVirtualId} from './selection-policy';
import {coverageCheck} from './clearance';
import {getDocument,GlobalWorkerOptions,type PDFDocumentProxy} from 'pdfjs-dist';
import type {TextItem} from 'pdfjs-dist/types/src/display/api';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createWorker,type Worker} from 'tesseract.js';
import {detect,masked,verificationStatus,type Candidate,type Risk} from './detection';
import {consolidateLocated} from './finding-dedup';
import {findFaces,findQrCodes} from './faces';
import {readDocx,createTextOnlyDocx} from './docx';
import {findInkLineBoxes,findUnrecognizedInkLinesAcrossPasses} from './handwriting';
import {qrExportStatus,validateManualRegions} from './verification-policy';
import {enhanceCanvas} from './preprocessing';
import {redactSelectedSpans,type TextSpan} from './text-redaction';
import {pdfTextBoundingBox} from './pdf-text-geometry';
GlobalWorkerOptions.workerSrc=pdfWorker;
export type Box={x:number;y:number;width:number;height:number};
export type Finding={classification_conflict?:Candidate['classification_conflict'];recognition_source?:Candidate['recognition_source'];ai_model_version?:string;id:string;category:string;risk:Risk;detection_confidence:number;ocr_confidence?:number;preview:string;reason:string;validation?:Candidate['validation'];source_context?:string;confidence_meaning?:string;page:number;boxes:Box[]};
export type PageView={url:string;width:number;height:number};
export type Check={name:string;status:'passed'|'failed'|'incomplete';detail:string};
export type ResidualDetail={category:string;page:number;source:'PDF text'|'metadata'|'OCR'|'text export'|'DOCX export'|'face scan'|'QR scan'|'source coverage'};
export type Report={status:'FLAG'|'UNVERIFIED'|'SCOPED_CLEAR';checks:Check[];warnings:string[];scope:string;remaining_count:number;residual_findings:ResidualDetail[];verified_at:string;sha256:string};
export type Analysis={file_id:string;filename:string;kind:string;findings:Finding[];pages:PageView[];warnings:string[];language:string;expires:number};
export type Output={url:string;filename:string;report:Report};
type Token={text:string;start:number;end:number;box:Box;confidence?:number};
type Stored={analysis:Analysis;bytes:Uint8Array;values:Map<string,string>;textSpans:Map<string,TextSpan>;tokens:Token[][];text?:string;outputs:string[];visionIncomplete:boolean;multilingualReviewRequired:boolean;ocrReviewRequired:boolean};
const records=new Map<string,Stored>();
const LIMIT=8*1024*1024,PIXELS=12_000_000,TTL=15*60_000;
const nextFrame=()=>new Promise<void>(r=>setTimeout(r,0));
function canvas(w:number,h:number){if(w*h>PIXELS||w<1||h<1)throw Error('Page exceeds the 12-megapixel processing limit.');const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;}
async function blob(c:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Image export failed.')),'image/png'));}
async function render(pdf:PDFDocumentProxy,n:number){
 const page=await pdf.getPage(n);
 // Each page is rendered independently. Adapt the scale instead of rejecting
 // unusually large sheets at the default 2x zoom. Preserve pixel coordinates
 // by using the same viewport for text geometry and redaction.
 const base=page.getViewport({scale:1});
 if(!(base.width>0&&base.height>0&&Number.isFinite(base.width*base.height)))
  throw Error('Invalid PDF page dimensions.');
 const scale=Math.min(2,Math.sqrt((PIXELS*.95)/(base.width*base.height)),16000/base.width,16000/base.height);
 if(scale<=0||!Number.isFinite(scale))throw Error('This page cannot be safely rendered in the browser.');
 const viewport=page.getViewport({scale});
 const c=canvas(viewport.width,viewport.height);
 await page.render({canvas:c,canvasContext:c.getContext('2d')!,viewport}).promise;
 return {page,viewport,c};
}
async function openPdf(bytes:Uint8Array){return getDocument({data:bytes.slice(),stopAtErrors:true,useSystemFonts:true}).promise;}
async function ocrWorker(lang:string,progress:(s:string)=>void){return createWorker(lang.includes('+')?lang.split('+'):lang,1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',workerBlobURL:false,cacheMethod:'none',logger:m=>{if(m.status)progress(`OCR · ${m.status} ${Math.round((m.progress??0)*100)}%`);}});}
async function ocr(c:HTMLCanvasElement,worker:Worker){const r=await worker.recognize(c,{}, {blocks:true,text:true});const tokens:Token[]=[];let text='';for(const block of r.data.blocks??[])for(const para of block.paragraphs)for(const line of para.lines){for(const w of line.words){const start=text.length;text+=w.text+' ';tokens.push({text:w.text,start,end:start+w.text.length,box:{x:w.bbox.x0,y:w.bbox.y0,width:w.bbox.x1-w.bbox.x0,height:w.bbox.y1-w.bbox.y0},confidence:w.confidence/100});}text+='\n';}return {text:text||r.data.text,tokens,confidence:r.data.confidence/100};}
function makeFindings(candidates:Candidate[],tokens:Token[],page:number,values:Map<string,string>,textSpans?:Map<string,TextSpan>){
 return candidates.filter(f=>!isVirtualId(f)).map(f=>{
   const matches=tokens.filter(t=>t.end>f.start&&t.start<f.end);
   const id=crypto.randomUUID();values.set(id,f.value);textSpans?.set(id,{start:f.start,end:f.end});
   const scores=matches.flatMap(t=>t.confidence===undefined?[]:[t.confidence]);
   let boxes=matches.map(t=>t.box);
   // Treat a multi-line legal party/address as one complete visual region,
   // not a handful of correctly OCR'd words with potentially exposed gaps.
   if(/^KANNADA_(?:PARTY|RESPONDENT)_ADDRESS_BLOCK_REVIEW$/.test(f.category)&&matches.length>=2){
     const x=Math.max(0,Math.min(...boxes.map(b=>b.x))-5);
     const y=Math.max(0,Math.min(...boxes.map(b=>b.y))-5);
     const right=Math.max(...boxes.map(b=>b.x+b.width))+5;
     const bottom=Math.max(...boxes.map(b=>b.y+b.height))+5;
     boxes=[{x,y,width:right-x,height:bottom-y}];
   }
   return {id,classification_conflict:f.classification_conflict,recognition_source:f.recognition_source,ai_model_version:f.ai_model_version,category:f.category,risk:f.risk,detection_confidence:f.detection_confidence,
     ocr_confidence:scores.length?Math.min(...scores):undefined,preview:masked(f.value),reason:f.reason,validation:f.validation,source_context:f.source_context,confidence_meaning:f.confidence_meaning,page,boxes};
 });
}
export function forget(id:string){const s=records.get(id);if(s){s.analysis.pages.forEach(p=>URL.revokeObjectURL(p.url));s.outputs.forEach(u=>URL.revokeObjectURL(u));s.bytes.fill(0);s.values.clear();s.textSpans.clear();records.delete(id);}}
export function clearAll(){for(const id of records.keys())forget(id);}
export async function analyze(file:File,lang='eng',progress:(s:string)=>void=()=>{}):Promise<Analysis>{
 if(!['eng','hin','kan','eng+kan','eng+hin+kan'].includes(lang))throw Error('Unsupported OCR language.');
 if(!file.size||file.size>LIMIT)throw Error('Choose a non-empty file up to 8 MB.');
 if(records.size>=10)throw Error('Clear the workspace before adding more than 10 documents.');
 const kind=file.name.split('.').pop()!.toLowerCase();if(!['pdf','png','jpg','jpeg','txt','csv','docx'].includes(kind))throw Error('This format is not supported yet. Use PDF, DOCX, PNG, JPEG, TXT or CSV.');
 const bytes=new Uint8Array(await file.arrayBuffer());const sig=new TextDecoder().decode(bytes.slice(0,8));
 if(kind==='pdf'&&!sig.startsWith('%PDF-'))throw Error('The file signature does not match PDF.');
 if(kind==='png'&&!(bytes[0]===137&&sig.slice(1,4)==='PNG'))throw Error('The file signature does not match PNG.');
 if(['jpg','jpeg'].includes(kind)&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw Error('The file signature does not match JPEG.');
 if(kind==='docx'&&!(bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4))throw Error('DOCX must be a valid Word ZIP container.');
 const a:Analysis={file_id:crypto.randomUUID(),filename:file.name,kind,findings:[],pages:[],warnings:['Detection can miss sensitive content. Review every page. Names, addresses, QR codes and handwriting require manual review.'],language:lang,expires:Date.now()+TTL};
 a.warnings.push('VID/BID values are excluded from the configured redaction and verification scope. Review original documents before public sharing.');
 const s:Stored={analysis:a,bytes,values:new Map(),textSpans:new Map(),tokens:[],outputs:[],visionIncomplete:false,multilingualReviewRequired:false,ocrReviewRequired:false};let worker:Worker|undefined,pdf:PDFDocumentProxy|undefined;
 const recognizer=createContextRecognizer();
 let modelNote=false;
 const recognize=async(text:string)=>{
  const r=await recognizer.recognize(text);
  if(!r.available)a.warnings.push('Contextual model unavailable: deterministic detection remains active; review for missed contextual information.');
  else if(!modelNote){a.warnings.push('Experimental trained contextual recognition is active locally in a background worker. Synthetic-data model; review AI-only findings and all unrecognised content.');modelNote=true;}
  return r.candidates;
 };
 let stage='initialization';
 try{
 if(kind==='txt'||kind==='csv'||kind==='docx'){
 const text=kind==='docx'?await readDocx(bytes):new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(text.includes('\0'))throw Error('Binary content is not supported as text.');if(text.length>500_000)throw Error('Text is limited to 500,000 characters.');
 s.text=text;
 if(/[\u0C80-\u0CFF]/u.test(text)){s.multilingualReviewRequired=true;a.warnings.push('Kannada script detected: identity and legal-party recognition is heuristic. Full manual review is mandatory before sharing.');}
 a.findings=makeFindings(await recognize(text),[],0,s.values,s.textSpans);
 if(kind==='docx')a.warnings.push('DOCX MVP: only extractable Word text is reviewed. Export creates a fresh plain-text Word document without original images, comments, tracked changes, styling, hyperlinks, headers, footers or metadata. Complex formats must be reviewed manually.');
 else a.warnings.push('UTF-8 text only. CSV redaction preserves the text structure; spreadsheet formulas are not evaluated.');
 }else{
 stage='opening and inspecting PDF';
 let count=1;if(kind==='pdf'){pdf=await openPdf(bytes);count=pdf.numPages;if(count<1)throw Error('The PDF contains no pages.');const meta=await pdf.getMetadata();if(meta.info&&Object.values(meta.info).some(v=>typeof v==='string'&&detect(v).length))a.warnings.push('Metadata contains candidate sensitive content. Export will discard source metadata.');if(await pdf.getAttachments())a.warnings.push('Embedded attachments are excluded from the exported file.');}
 try{worker=await ocrWorker(lang,progress);}
 catch{
  s.ocrReviewRequired=true;
  a.warnings.push('OCR initialization failed. Scanned text and embedded image fields are UNVERIFIED; review every page and add manual masks.');
 }
 for(let n=1;n<=count;n++){
 stage=`page ${n} of ${count} — PDF rendering and text extraction`;
 progress(`Reading page ${n} of ${count}`);let c:HTMLCanvasElement;let text='',tokens:Token[]=[];
 if(pdf){const r=await render(pdf,n);c=r.c;const tc=await r.page.getTextContent();for(const item of tc.items){if(!('str' in item))continue;const t=item as TextItem;const tr=t.transform;const h=Math.max(Math.hypot(tr[2],tr[3]),Math.abs(t.height));const start=text.length;text+=t.str+(t.hasEOL?'\n':' ');const box=pdfTextBoundingBox(tr,t.width,h,r.viewport.transform,c.width,c.height);if(box)tokens.push({text:t.str,start,end:start+t.str.length,box});}
 }else{const image=await createImageBitmap(new Blob([bytes]));c=canvas(image.width,image.height);c.getContext('2d')!.drawImage(image,0,0);image.close();}
 // Always OCR rendered pixels as well: mixed PDFs may have text and sensitive images.
 stage=`page ${n} of ${count} — OCR`;
 let firstOcr:Awaited<ReturnType<typeof ocr>>|undefined;
 if(worker){
  try{firstOcr=await ocr(c,worker);}
  catch{
   s.ocrReviewRequired=true;
   a.warnings.push('Page '+n+': OCR failed. This page is UNVERIFIED and requires manual inspection.');
   try{await worker.terminate();}catch{/* Broken worker. */}
   worker=undefined;
  }
 }
 const o=firstOcr??{text:'',tokens:[] as Token[],confidence:0};
 // Limit enhanced OCR to scan-heavy pages; full base OCR still runs for
 // text-bearing pages to detect additional embedded image content.
 const scanHeavy=text.trim().length<250;
 const ocrPasses=[o];
 if(worker&&c.width*c.height<=6_000_000&&scanHeavy&&(o.confidence<.85||lang.includes('kan')||/aadha(?:ar|r)?|uidai|ಆಧಾರ/iu.test(o.text))){
   try{
     progress('OCR second pass · correcting uneven lighting');
     const enhanced=enhanceCanvas(c,'contrast');
     try{ocrPasses.push(await ocr(enhanced,worker));}finally{enhanced.width=enhanced.height=0;}
     if(ocrPasses.every(p=>p.confidence<.65)){
       progress('OCR third pass · adaptive thresholding');
       const binary=enhanceCanvas(c,'adaptive');
       try{ocrPasses.push(await ocr(binary,worker));}finally{binary.width=binary.height=0;}
     }
     a.warnings.push('Page '+n+': '+ocrPasses.length+' OCR passes processed without changing original source pixels.');
   }catch{
     s.ocrReviewRequired=true;
     a.warnings.push('Page '+n+': enhanced OCR failed; manual page review required.');
   }
 }
 if(/[\u0C80-\u0CFF]/u.test(text+' '+ocrPasses.map(p=>p.text).join(' '))){
   s.multilingualReviewRequired=true;
   a.warnings.push('Page '+n+': Kannada text or OCR detected. Name/address/party detection is experimental; review every line and region manually.');
 }
 const bestOcrConfidence=Math.max(...ocrPasses.map(pass=>pass.confidence));
  if(bestOcrConfidence<.6||(!text.trim()&&!ocrPasses.some(pass=>pass.text.trim()))){
   s.ocrReviewRequired=true;
   a.warnings.push('Page '+n+': OCR recognition may be incomplete. Export cannot be automatically cleared without review.');
 }
 const native=makeFindings(await recognize(text),tokens,n-1,s.values);
 const acrossPasses:Finding[]=[];
 for(const pass of ocrPasses)acrossPasses.push(...makeFindings(await recognize(pass.text),pass.tokens,n-1,s.values));
 // Compare all OCR passes using actual overlapping boxes after aggregation; small pixel shifts must not multiply findings.
 // Retain incomplete OCR status when even the best pass is weak; per-line
  // coverage below separately checks for omitted words and handwritten ink.
  if(bestOcrConfidence<.6)s.ocrReviewRequired=true;
 // OCR cannot classify handwriting reliably. Propose each high-contrast ink
 // line as a separate region so emails, passwords, IDs and names are not
 // silently skipped when only one label was understood.
 // Even when OCR confidently reads one line, it can miss nearby handwriting.
 stage=`page ${n} of ${count} — detecting unreadable text`;
 let inkRows:Box[]=[];
 try{inkRows=findInkLineBoxes(c);}
 catch{
  s.ocrReviewRequired=true;
  a.warnings.push('Page '+n+': ink-line detection failed; all source pixels need visual review.');
  a.findings.push({id:crypto.randomUUID(),category:'UNREADABLE_PAGE_REVIEW',risk:'HIGH',
   detection_confidence:0,preview:'Ink coverage unavailable — inspect whole page',
   reason:'Ink-line detection failed; full manual visual inspection is required.',page:n-1,boxes:[]});
 }
 // Use per-word confidence across all passes and any extractable PDF text.
  // The first pass's low page average must not classify already-readable lines
  // as unreadable. Low-confidence words never count as adequate coverage.
  const reliableNative=tokens.filter(t=>t.text.trim()&&!/\uFFFD/.test(t.text)).map(t=>t.box);
  const reviewRows=findUnrecognizedInkLinesAcrossPasses(inkRows,ocrPasses.map(p=>p.tokens),reliableNative);
 if(reviewRows.length){
   for(const box of reviewRows)a.findings.push({id:crypto.randomUUID(),category:'UNREADABLE_TEXT_LINE_REVIEW',risk:'HIGH',detection_confidence:.35,preview:'Review full text line',reason:'Visible ink not reliably covered by OCR. This is not handwriting recognition; inspect the whole line manually.',page:n-1,boxes:[box]});
   a.warnings.push('Page '+n+': '+reviewRows.length+' ink-line region(s) may contain missed handwriting or printed text. Inspect each complete line.');
   s.ocrReviewRequired=true;
 }
 if(bestOcrConfidence<.7)s.ocrReviewRequired=true;
 if(!firstOcr){
  // Do not offer a dangerously broad full-page black mask. A missing OCR pass
  // is an UNLOCATED manual-review blocker, not a completed detection.
  a.findings.push({id:crypto.randomUUID(),category:'UNREADABLE_PAGE_REVIEW',risk:'HIGH',
   detection_confidence:0,preview:'OCR unavailable — inspect whole page',
   reason:'OCR did not examine all pixels. Scanned IDs and embedded image text may be missed.',page:n-1,boxes:[]});
 }
 // For Aadhaar-labelled scans where OCR fails to return the 12 digits,
 // propose the labelled number band for human confirmation.
 if(![...native,...acrossPasses].some(f=>f.category.startsWith('AADHAAR'))){
   const observedText=[text,...ocrPasses.map(p=>p.text)].join('\n');
   const apparent16=/(?:\b(?:Aadhaar|Aadhar)\b|आधार|ಆಧಾರ್|ಆಧಾರ)[^\r\n]{0,36}(?:[0-9०-९೦-೯]{4}[ \t-]?){3}[0-9०-९೦-೯]{4}(?![0-9०-९೦-೯])/iu.test(observedText);
   const labels=[...tokens,...ocrPasses.flatMap(p=>p.tokens)].filter(t=>/aadha(?:ar|r)?|aadhar|uidai|आधार|ಆಧಾರ್|ಆಧಾರ/i.test(t.text));
   if(labels.length&&!apparent16){
     // The label alone cannot reliably locate a 12-digit number. Do not
     // make broad selectable OCR bands that could cover nearby VID/BID.
     a.findings.push({id:crypto.randomUUID(),category:'AADHAAR_NUMBER_REGION_REVIEW',
       risk:'HIGH',detection_confidence:.3,preview:'Aadhaar field not reliably read',
       reason:'Aadhaar label seen without a confirmed 12-digit value. Inspect the original scan and mark the exact number manually.',
       page:n-1,boxes:[]});
     s.ocrReviewRequired=true;
     a.warnings.push('Page '+n+': Aadhaar label requires human verification; no automatic region was selected.');
   }
 }
 // Detect faces on rendered pixels, including photos inside scanned documents.
 // A model-load or detector failure is reported rather than silently claiming safety.
 try{
   progress('Detecting faces locally · page '+n);
   const faces=await findFaces(c);
   for(const f of faces){a.findings.push({id:crypto.randomUUID(),category:'FACE',risk:'HIGH',detection_confidence:f.confidence,preview:'Face region',reason:'Automatic on-device face detection; inspect for missed faces',page:n-1,boxes:[{x:f.x,y:f.y,width:f.width,height:f.height}]});}
   if(faces.length)a.warnings.push('Page '+n+': '+faces.length+' face candidate(s) detected; none selected automatically. Verify the full portrait is covered.');
 }catch{
   s.visionIncomplete=true;
   a.warnings.push('Page '+n+': face detector could not load. No automatic face clearance; mark every portrait manually. Model files require internet on first use.');
 }
 const qr=await findQrCodes(c);
 if(qr===null)a.warnings.push('Page '+n+': automatic QR decoding is unsupported in this browser; cover every QR code manually.');
 else for(const q of qr)a.findings.push({id:crypto.randomUUID(),category:'QR_CODE',risk:'HIGH',detection_confidence:1,preview:'Encoded QR payload',reason:'QR content may disclose private data; redact entire code',page:n-1,boxes:[{x:q.x,y:q.y,width:q.width,height:q.height}]});
 stage=`page ${n} of ${count} — merging detections`;
 a.findings.push(...native,...acrossPasses);
 // De-duplicate the underlying source findings before they reach either the
 // priority list or the redaction/clearance engine.
 const pageStart=a.findings.findIndex(f=>f.page===n-1);
 if(pageStart>=0){
  const consolidated=consolidateLocated(a.findings.slice(pageStart),s.values);
  a.findings.splice(pageStart,a.findings.length-pageStart,...consolidated.findings);
  for(const duplicateId of consolidated.removedIds){s.values.delete(duplicateId);s.textSpans.delete(duplicateId);}
  if(consolidated.disagreements){
    s.ocrReviewRequired=true;
    a.warnings.push('Page '+n+': '+consolidated.disagreements+' conflicting Aadhaar-like OCR reading(s) require visual review.');
  }
 }
 s.tokens.push(tokens);if(bestOcrConfidence<.6&&ocrPasses.some(pass=>pass.text.trim()))a.warnings.push(`Page ${n}: low OCR confidence across available passes; manual review required.`);
 if(!text.trim()&&!ocrPasses.some(pass=>pass.text.trim()))a.warnings.push(`Page ${n}: no readable text detected; inspect the preview manually.`);
 stage=`page ${n} of ${count} — generating preview`;
 a.pages.push({url:URL.createObjectURL(await blob(c)),width:c.width,height:c.height});c.width=c.height=0;await nextFrame();
 }
 }
 records.set(a.file_id,s);setTimeout(()=>forget(a.file_id),TTL);return a;
 }catch(e){
  a.pages.forEach(p=>URL.revokeObjectURL(p.url));bytes.fill(0);s.values.clear();s.textSpans.clear();
  const message=e instanceof Error?e.message:typeof e==='string'?e:'browser processing error without details';
  throw new Error('Analysis stopped during '+stage+': '+(message||'unknown error')+'. No redaction or clearance was completed.');
 }finally{
  recognizer.close();
  try{await worker?.terminate();}catch{/* Worker already stopped. */}
  try{await pdf?.loadingTask.destroy();}catch{/* PDF already closed. */}
 }
}
export type Manual={page:number;box:Box};
export async function redact(id:string,selected:string[],manual:Manual[],progress:(s:string)=>void=()=>{},purpose:SharingPurpose='public'):Promise<Output>{
 const s=records.get(id);if(!s||Date.now()>s.analysis.expires)throw Error('Document session expired. Add the file again.');
 if(new Set(selected).size!==selected.length||selected.some(x=>!s.analysis.findings.some(f=>f.id===x)))throw Error('Invalid finding selection.');
 if(manual.length>100)throw Error('Limit manual redactions to 100 regions.');
 if(s.text===undefined)validateManualRegions(manual,s.analysis.pages);
 const exportRecognizer=createContextRecognizer();
 try{
 const values=selected.map(x=>s.values.get(x)).filter((v):v is string=>v!==undefined);let output:Uint8Array;let mime:string;let extension:string;const checks:Check[]=[];let remaining=0,incomplete=false;
 const warnings=['SCOPED_CLEAR is limited to the listed checks. It is not a guarantee of anonymity.'];
 warnings.push('VID/BID values are intentionally excluded from automatic redaction and configured verification. The export may still expose those identifiers; review before sharing.');
 if(selected.length===0&&manual.length===0){
   incomplete=true;
   warnings.push('No redactions were approved or applied. A document with zero detected findings cannot be automatically declared safe.');
   checks.push({name:'Redaction coverage',status:'incomplete',detail:'No candidate or manually marked region was redacted. Inspect all pages and approve relevant regions.'});
 }
 if(s.multilingualReviewRequired){
   incomplete=true;
   warnings.push('Kannada legal and identity text requires human review. Automatic OCR and pattern matching do not verify all personal details.');
   checks.push({name:'Kannada semantic and identity coverage',status:'incomplete',detail:'Experimental Kannada name, party and address detection; complete manual review is required.'});
 }
 if(s.ocrReviewRequired){
   incomplete=true;
   warnings.push('Low-confidence or empty OCR result on at least one page. Manual pixel review is required.');
   checks.push({name:'Source OCR completeness',status:'incomplete',detail:'At least one source page had low OCR confidence or no recognized text.'});
 }
 const coverage=coverageCheck(s.analysis.findings,selected,manual,purpose,s.text!==undefined);
 if(coverage.missingHigh.length){remaining+=coverage.missingHigh.length;checks.push({name:'Mandatory High-priority coverage',status:'failed',detail:coverage.missingHigh.length+' High-priority finding(s) remain uncovered.'});}
 else checks.push({name:'Mandatory High-priority coverage',status:'passed',detail:'All localized detected High-priority findings are covered within the declared scope.'});
 if(coverage.unresolvedReview.length){incomplete=true;checks.push({name:'Uncertain-source review',status:'incomplete',detail:coverage.unresolvedReview.length+' uncertain source finding(s) remain uncovered; clearance is withheld.'});}
 const residual_findings:ResidualDetail[]=coverage.missingHigh.map(f=>({category:f.category,page:f.page+1,source:'source coverage'}));
 const recordResidual=(category:string,page:number,source:ResidualDetail['source'])=>{remaining++;if(residual_findings.length<50)residual_findings.push({category,page,source});};
 const testResidual=async(text:string,page:number,source:ResidualDetail['source'],normalize=false)=>{
   const before=remaining;
   const contextual=await exportRecognizer.recognize(text);
   for(const f of contextual.candidates)if(f.recognition_source!=='trained_ai'&&!isVirtualId(f)&&classifyPriority(f.category,purpose,inferDocumentType(s.analysis.findings)).mandatory)recordResidual(f.category,page,source);
   const review=contextual.candidates.filter(f=>f.recognition_source==='trained_ai'||f.classification_conflict);
   if(!contextual.available||review.length){incomplete=true;}
   checks.push({name:'Fresh contextual review · '+source+' '+page,status:!contextual.available||review.length?'incomplete':'passed',detail:!contextual.available?'Contextual worker/model unavailable; semantic review remains incomplete.':review.length+' AI-only or conflicting finding(s) require manual inspection. Same-model recheck is not independent semantic verification.'});
   for(const f of review)if(residual_findings.length<50)residual_findings.push({category:f.category,page,source});
   const val=(s:string)=>normalize?s.replace(/\s/g,'').toLowerCase():s;
   for(const original of values){if(original.length>2&&val(text).includes(val(original)))recordResidual('SELECTED_VALUE_REMAINS',page,source);}
   return remaining-before;
 };
 if(s.visionIncomplete){incomplete=true;warnings.push('Automatic face detection was unavailable on at least one page. Verify portraits manually before sharing.');}
 const unlocalized=selected.filter(x=>s.analysis.findings.some(f=>f.id===x&&f.boxes.length===0));
 if(unlocalized.length&&s.text===undefined){incomplete=true;warnings.push(unlocalized.length+' selected candidates had no located pixel box. Mark them manually and re-export.');
 checks.push({name:'Selected candidate localization',status:'incomplete',detail:'Some OCR candidates could not be mapped to pixel regions; manual redaction is required.'});}
 if(s.text!==undefined){
 if(manual.length)throw Error('Manual pixel regions apply only to images or PDFs.');
 // Redact the exact selected occurrence, not every other copy with the same
 // value. A missing or shifted span must never be silently ignored.
 const selectedSpans=selected.map(findingId=>{
  const span=s.textSpans.get(findingId);
  if(!span||s.text!.slice(span.start,span.end)!==s.values.get(findingId))throw Error('Selected text finding no longer maps to its source; re-analyze before exporting.');
  return span;
 });
 let text=redactSelectedSpans(s.text,selectedSpans);
 if(s.analysis.kind==='docx'){
  output=createTextOnlyDocx(text);mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';extension='docx';
  incomplete=true;
  warnings.push('Word export is intentionally text-only, with original formatting, media and OOXML structures removed. Output is UNVERIFIED until you manually review its full contents.');
  const reopened=await readDocx(output);
  const docxMatches=await testResidual(reopened,0,'DOCX export');
  checks.push({name:'Reopen rebuilt DOCX and scan extracted text',status:docxMatches?'failed':'passed',detail:'The newly generated Word document was reopened and scanned for residual configured patterns and selected values.'});
  checks.push({name:'Original Word layout and non-text content',status:'incomplete',detail:'Text-only reconstruction discards original media and layout; full visual fidelity and semantic privacy cannot be independently verified.'});
 }else{
  output=new TextEncoder().encode(text);mime='text/plain;charset=utf-8';extension=s.analysis.kind;
  const reopened=new TextDecoder('utf-8',{fatal:true}).decode(output);
  const textMatches=await testResidual(reopened,0,'text export');
  checks.push({name:'Reopen exported UTF-8 bytes',status:textMatches?'failed':'passed',detail:'Selected-value comparison and fresh candidate detection completed.'});
 }
 }else{
 const result=await PDFDocument.create();let png:Uint8Array|undefined;
 for(let p=0;p<s.analysis.pages.length;p++){
 progress(`Removing approved regions · page ${p+1}`);const page=s.analysis.pages[p];const bitmap=await createImageBitmap(await (await fetch(page.url)).blob());const c=canvas(page.width,page.height);const ctx=c.getContext('2d')!;ctx.drawImage(bitmap,0,0);bitmap.close();
 const boxes=[...s.analysis.findings.filter(f=>selected.includes(f.id)&&f.page===p).flatMap(f=>f.boxes),...manual.filter(m=>m.page===p).map(m=>m.box)];
 for(const b of boxes){if(!Object.values(b).every(Number.isFinite)||b.width<=0||b.height<=0||b.x<0||b.y<0||b.x+b.width>c.width+1||b.y+b.height>c.height+1)throw Error('Invalid redaction coordinates.');ctx.fillStyle='#000';ctx.fillRect(Math.floor(b.x)-2,Math.floor(b.y)-2,Math.ceil(b.width)+4,Math.ceil(b.height)+4);}
 png=new Uint8Array(await (await blob(c)).arrayBuffer());const img=await result.embedPng(png);const outPage=result.addPage([c.width/2,c.height/2]);outPage.drawImage(img,{x:0,y:0,width:c.width/2,height:c.height/2});c.width=c.height=0;await nextFrame();
 }
 if(s.analysis.kind==='pdf'){output=await result.save({useObjectStreams:false});mime='application/pdf';extension='pdf';}else{output=png!;mime='image/png';extension='png';}
 checks.push({name:'Permanent pixel removal',status:'passed',detail:'Approved pixels replaced. A new file was encoded without copying original PDF objects, attachments, text layers or image metadata.'});
 warnings.push('Image-based export: original searchable text, forms, annotations, links, attachments and signatures are not preserved.');
 let worker:Worker|undefined,pdf:PDFDocumentProxy|undefined;
 try{
 progress('Reopening exported bytes');if(extension==='pdf'){pdf=await openPdf(output);for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const tc=await page.getTextContent();const text=tc.items.map(i=>'str'in i?i.str:'').join(' ');await testResidual(text,n,'PDF text');}
 const meta=await pdf.getMetadata();const mt=JSON.stringify(meta.info)+' '+(meta.metadata?.getRaw()??'');await testResidual(mt,0,'metadata');if(await pdf.getAttachments())incomplete=true;
 checks.push({name:'Saved PDF text, metadata and attachments',status:remaining?'failed':incomplete?'incomplete':'passed',detail:'Reopened exported PDF with PDF.js; extracted text and inspected metadata/attachments.'});}
 worker=await ocrWorker(s.analysis.language,progress);
 const count=pdf?.numPages??1;let ocrResiduals=0;
 for(let n=1;n<=count;n++){
 let c:HTMLCanvasElement;if(pdf)c=(await render(pdf,n)).c;else{const image=await createImageBitmap(new Blob([output]));c=canvas(image.width,image.height);c.getContext('2d')!.drawImage(image,0,0);image.close();}
 const o=await ocr(c,worker);ocrResiduals+=await testResidual(o.text,n,'OCR',true);
 // Independently scan the exported pixels for any remaining faces.
 // A failed face-model check must never produce a cleared result.
 try{
   const faces=await findFaces(c);
   for(const _ of faces)recordResidual('FACE_REMAINS',n,'face scan');
   if(faces.length)warnings.push('Exported page '+n+': '+faces.length+' face region(s) may still be exposed.');
   checks.push({name:'Fresh face detection · exported page '+n,status:faces.length?'failed':'passed',detail:faces.length?'Detected an unredacted face; repeat the redaction.':'No face candidates identified by the configured face model.'});
 }catch{
   incomplete=true;
   checks.push({name:'Fresh face detection · exported page '+n,status:'incomplete',detail:'Face model was unavailable. Manual inspection of the output is mandatory.'});
 }
 const qr=await findQrCodes(c);
 const qrCheckStatus=qrExportStatus(qr===null?null:qr.length);
 if(qr!==null&&qrCheckStatus==='failed'){
   for(const _ of qr)recordResidual('QR_CODE_REMAINS',n,'QR scan');
   checks.push({name:'Fresh QR scan · exported page '+n,status:'failed',detail:'QR code remains visible/decodable in the export. Redact the full QR region.'});
 }else{
   // Zero decodable QR results cannot exclude damaged, small or unsupported QR
   // regions. An export may be inspected privately, but not certified clear.
   incomplete=true;
   checks.push({name:'Fresh QR scan · exported page '+n,status:'incomplete',detail:qr===null?'QR detector unavailable. Inspect the exported image and mask any codes manually.':'No QR decoded; unreadable or partially damaged QR regions cannot be ruled out. Review the exported pixels manually.'});
 }
 if(!o.text.trim()||o.confidence<.6)incomplete=true;c.width=c.height=0;
 }
 checks.push({name:'Fresh OCR of exported pixels',status:ocrResiduals?'failed':incomplete?'incomplete':'passed',detail:`Tesseract ${s.analysis.language}; selected-value comparison and fresh detection on ${count} page(s). ${ocrResiduals} unresolved OCR match(es).`});
 }catch{incomplete=true;checks.push({name:'Reopen and OCR verification',status:'failed',detail:'A required verification dependency or processing step failed.'});}finally{await worker?.terminate();await pdf?.loadingTask.destroy();}
 }
 const hash=await crypto.subtle.digest('SHA-256',output as BufferSource);const sha256=[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
 const url=URL.createObjectURL(new Blob([output as BlobPart],{type:mime}));s.outputs.push(url);
 return {url,filename:s.analysis.filename.replace(/\.[^.]+$/,'')+'-redacted.'+extension,report:{status:verificationStatus(remaining,incomplete),checks,warnings,remaining_count:remaining,residual_findings,scope:s.analysis.kind==='docx'?'Rebuilt text-only DOCX content and selected-value comparison. Original layout/media were discarded; manual final review mandatory.':s.text!==undefined?'UTF-8 text: mandatory High-priority categories for '+purpose+' sharing and all selected values. Optional Medium/Low content may remain.':'Exported text, rendered printed OCR, metadata and attachment presence. Handwriting, QR decoding and semantic identity inference are outside scope.',verified_at:new Date().toISOString(),sha256}};
 }finally{exportRecognizer.close();}
}
export async function syntheticFile(){const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const page=doc.addPage([595,420]);const lines=['SHARESHIELD / SYNTHETIC REVIEW SAMPLE','This file contains fictional demonstration data.','Email: demo.person@example.test','PAN: ABCDE1234F','Password: DemoSecret_4829','Public note: Please share the project summary.'];lines.forEach((t,i)=>page.drawText(t,{x:48,y:365-i*43,size:i===0?17:15,font,color:rgb(.1,.15,.2)}));return new File([await doc.save() as BlobPart],'ShareShield-synthetic.pdf',{type:'application/pdf'});}
