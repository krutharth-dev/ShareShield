import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateModel,classifySpan,loadContextModel,proposeSpans} from '../src/context-model.ts';
import {detectHybrid} from '../src/hybrid-detection.ts';
import {detect} from '../src/detection.ts';
import {requiresManualReview} from '../src/priority.ts';
import {autoSelectHighPriority} from '../src/auto-redaction.ts';
const model=validateModel(JSON.parse(readFileSync(new URL('../public/models/context-v1.json',import.meta.url))));
test('exported JS predictions match Python learned weights on held-out English Kannada mixed data',()=>{
 const rows=JSON.parse(readFileSync(new URL('../../ml/parity.json',import.meta.url)));
 for(const r of rows){const p=classifySpan(model,r.text,r);assert.equal(p.category,r.expected);assert.ok(Math.abs(p.score-r.score)<1e-6);}
});
test('unavailable invalid timed-out model fails closed to deterministic recognition',async()=>{
 for(const fetcher of [async()=>{throw Error('offline')},async()=>new Response('no',{status:404}),async()=>new Response('{}'),async()=>new Response('<html>fallback')])assert.equal(await loadContextModel(fetcher),null);
 const text='Aadhaar: 2345 6789 0123\nEmail: fictional@example.test';
 assert.deepEqual(detectHybrid(text,null).map(({recognition_source,...c})=>c),detect(text));
 assert.throws(()=>validateModel({...model,weights:[[NaN]]}));
});
test('model is loaded only via same-origin GET without document payload',async()=>{
 let calls=0;
 const loaded=await loadContextModel(async(url,options)=>{calls++;assert.equal(url,'/models/context-v1.json');assert.equal(options.body,undefined);assert.equal(options.credentials,'omit');return new Response(JSON.stringify(model));});
 assert.ok(loaded);assert.equal(calls,1);
});
test('same numeric value receives learned contextual categories and isolated value abstains',()=>{
 for(const [context,category] of [['hospital medical record archive','MEDICAL_RECORD_NUMBER'],['college admission registration','ACADEMIC_ADMISSION_ID'],['employee staff payroll identity','STUDENT_OR_EMPLOYEE_ID'],['ಆಸ್ಪತ್ರೆ ವೈದ್ಯಕೀಯ ದಾಖಲೆ','MEDICAL_RECORD_NUMBER']]){
  const text=context+': 4829107';assert.equal(classifySpan(model,text,{start:text.indexOf('4829107'),end:text.length}).category,category);
 }
 assert.equal(classifySpan(model,'4829107',{start:0,end:7}).category,'NONE');
});
test('AI additions preserve UTF-16 source offsets, require review and cannot auto-mask',()=>{
 const text='😀 ಆಸ್ಪತ್ರೆ ವೈದ್ಯಕೀಯ ದಾಖಲೆ: 4829107';
 const findings=detectHybrid(text,model),ai=findings.filter(f=>f.recognition_source==='trained_ai');assert.ok(ai.length);
 for(const f of ai){assert.equal(text.slice(f.start,f.end),f.value);assert.ok(requiresManualReview(f));}
 assert.deepEqual(autoSelectHighPriority(ai.map((f,i)=>({...f,id:String(i),boxes:[]})),'public','txt'),[]);
});
test('regex findings including repeated Aadhaar survive unchanged and overlaps never duplicate',()=>{
 const text='Aadhaar: 2345 6789 0123\nAadhaar: 2345 6789 0123\nPatient ID: 4829107';
 const base=detect(text),hybrid=detectHybrid(text,model);
 assert.equal(base.filter(f=>f.category.startsWith('AADHAAR')).length,2);
 for(const b of base)assert.ok(hybrid.some(h=>h.start===b.start&&h.end===b.end&&h.category===b.category&&h.detection_confidence===b.detection_confidence));
 assert.equal(new Set(hybrid.map(f=>`${f.start}:${f.end}:${f.category}`)).size,hybrid.length);
});
test('VID/BID is not proposed to the AI, multiple address fields remain separate',()=>{
 assert.deepEqual(proposeSpans('VID: 1234567890123456\nBID: 1234567890123456'),[]);
 const text='residential home address street: 42 Fictional Lane\nresidential home address street: 43 Fictional Lane';
 const spans=proposeSpans(text);assert.equal(spans.length,2);assert.notEqual(spans[0].start,spans[1].start);
});
test('AI review cannot be bypassed by caller supplied confidence',()=>{
 const f={id:'ai',category:'MEDICAL_RECORD_NUMBER',recognition_source:'trained_ai',detection_confidence:1,boxes:[]};
 assert.ok(requiresManualReview(f));assert.deepEqual(autoSelectHighPriority([f],'hospital','txt'),[]);
});
