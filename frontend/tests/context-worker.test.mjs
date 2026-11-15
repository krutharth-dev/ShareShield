import test from 'node:test';
import assert from 'node:assert/strict';
import {createContextRecognizer} from '../src/context-client.ts';
import {detect} from '../src/detection.ts';
import {detectHybrid} from '../src/hybrid-detection.ts';
import {requiresManualReview} from '../src/priority.ts';
import {readFileSync} from 'node:fs';
const source='Aadhaar: 2345 6789 0123\nAadhaar: 2345 6789 0123';
function mock(){return {onmessage:null,onerror:null,messages:[],terminated:false,postMessage(m){this.messages.push(m)},terminate(){this.terminated=true}};}
test('worker request IDs isolate concurrent inputs; close terminates worker',async()=>{
 const port=mock(),client=createContextRecognizer(()=>port);
 const first=client.recognize('first'),second=client.recognize('second');
 port.onmessage({data:{id:2,candidates:[],available:true,inferenceMs:1}});
 port.onmessage({data:{id:1,candidates:[],available:false,inferenceMs:2}});
 assert.equal((await first).available,false);assert.equal((await second).available,true);client.close();assert.ok(port.terminated);
 await assert.rejects(client.recognize('after close'));
});
test('unavailable worker and worker error preserve every deterministic occurrence',async()=>{
 for(const mode of ['constructor','error','malformed']){
  const port=mock(),client=createContextRecognizer(()=>{if(mode==='constructor')throw Error();return port;});
  const promise=client.recognize(source);
  if(mode==='error')port.onerror({});if(mode==='malformed')port.onmessage({data:{id:1,candidates:null}});
  const result=await promise;assert.equal(result.available,false);assert.deepEqual(result.candidates.map(({recognition_source,...c})=>c),detect(source));client.close();
 }
});
test('worker timeout terminates execution and returns deterministic fallback',async()=>{
 const port=mock(),client=createContextRecognizer(()=>port,5);
 const result=await client.recognize(source);assert.equal(result.available,false);assert.match(result.fallback,/timed out/);assert.ok(port.terminated);client.close();
});
test('conflicting AI never replaces deterministic category/span and forces review',()=>{
 const m=JSON.parse(readFileSync(new URL('../public/models/context-v1.json',import.meta.url)));
 m.weights=m.weights.map(r=>r.map(()=>0));m.bias=m.classes.map(c=>c==='PATIENT_ID'?20:0);
 const base=detect(source),hybrid=detectHybrid(source,m);
 for(const b of base){const h=hybrid.find(c=>c.start===b.start&&c.end===b.end&&c.category===b.category);assert.ok(h);assert.equal(h.value,b.value);assert.equal(h.detection_confidence,b.detection_confidence);assert.equal(h.classification_conflict?.suggested_category,'PATIENT_ID');assert.ok(requiresManualReview(h));}
 assert.equal(hybrid.length,base.length);
});
test('OCR deduplication preserves conflict review from a second observation',async()=>{
 const {consolidateLocated}=await import('../src/finding-dedup.ts');
 const shape={page:0,category:'MEDICAL_RECORD_NUMBER',detection_confidence:.9,reason:'test',boxes:[{x:1,y:1,width:100,height:20}]};
 const a={...shape,id:'a'},b={...shape,id:'b',classification_conflict:{suggested_category:'ACADEMIC_ADMISSION_ID',model_version:'synthetic-context-linear-v2'}};
 const result=consolidateLocated([a,b],new Map([['a','4829107'],['b','4829107']]));
 assert.equal(result.findings.length,1);assert.equal(result.findings[0].classification_conflict.suggested_category,'ACADEMIC_ADMISSION_ID');assert.ok(requiresManualReview(result.findings[0]));
});
