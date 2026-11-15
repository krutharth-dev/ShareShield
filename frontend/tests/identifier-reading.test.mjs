import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detection.ts';
import {autoSelectHighPriority} from '../src/auto-redaction.ts';
import {requiresManualReview} from '../src/priority.ts';
import {locateSourceSpan} from '../src/source-localization.ts';
import {validateBirthDate} from '../src/identifier-validation.ts';

const aadhaar=text=>detect(text).filter(f=>/^AADHAAR_(CANDIDATE|REVIEW|OCR_REVIEW)$/.test(f.category));
const box={x:20,y:30,width:60,height:18};
test('separate-row English and Kannada Aadhaar labels retain damaged values for review',()=>{
 for(const label of ['Aadhaar:', 'Aadhaar Number:', 'ಆಧಾರ್ ಸಂಖ್ಯೆ:', 'आधार संख्या:']){
  for(const value of ['2345 6789 0125','೨೩೪೫ ೬೭೮೯ ೦೧೨೫','2345 6789','2345 6789 O124']){
   const text='📄\n'+label+'\r\n'+value;
   const hits=aadhaar(text);assert.equal(hits.length,1,text);
   assert.equal(hits[0].value,value);assert.equal(text.slice(hits[0].start,hits[0].end),value);
   assert.ok(requiresManualReview(hits[0]));
  }
 }
});
test('adjacent full-length Aadhaar rows retain ten separate reviewable occurrences',()=>{
 for(const value of ['2345 6789 0124','2345 6789 0125','೨೩೪೫ ೬೭೮೯ ೦೧೨೪']){
  const text='Aadhaar: '+Array(10).fill(value).join('\n');
  const hits=aadhaar(text);assert.equal(hits.length,10);
  assert.equal(new Set(hits.map(f=>f.start)).size,10);
  for(const f of hits){assert.equal(f.value,value);assert.ok(requiresManualReview(f));}
  const located=hits.map((f,i)=>({...f,id:String(i),boxes:[{...box,y:30+i*30}],ocr_confidence:.99}));
  assert.deepEqual(autoSelectHighPriority(located,'public','pdf'),[],'row association requires approval');
 }
 assert.equal(aadhaar('Account number: '+Array(3).fill('2345 6789 0124').join('\n')).length,0);
});
test('separate-row institutional labels cannot authenticate an Aadhaar-shaped value',()=>{
 for(const label of ['Patient ID','MRN','Student ID','USN','ರೋಗಿಯ ಸಂಖ್ಯೆ']){
  for(const value of ['234567890124','2345 6789 0124']){
   const text=label+':\n'+value;assert.equal(aadhaar(text).length,0,text);
   const findings=detect(text).filter(f=>f.category==='FORM_IDENTIFIER_REVIEW');
   assert.equal(findings.length,1,text);assert.equal(findings[0].value,value);
   assert.ok(requiresManualReview(findings[0]));
  }
 }
});
test('arbitrarily wide separators and OCR letters never carve Aadhaar from longer IDs',()=>{
 for(const label of ['Aadhaar: ','VID: ','BID: ',''])for(const gap of [' ', '\n', ' '.repeat(32), '\n\n\n\n\n\n\n']){
  for(const value of [`2345 6789 0124${gap}9999`,`9999${gap}2345 6789 0124`,`2345 6789 O124${gap}9999`,`2345 6789 0124${gap}O999`,`999O${gap}2345 6789 0124`])
   assert.equal(aadhaar(label+value).length,0,label+value);
 }
});
test('token text and offsets must agree before localization can authorize a mask',()=>{
 const span={start:0,end:14,value:'2345 6789 0124'};
 const tokens=['2345','6789','0124'].map((text,i)=>({text,start:i*5,end:i*5+4,box:{...box,x:20+i*70},confidence:.9}));
 assert.equal(locateSourceSpan(span,tokens).boxes.length,3);
 for(const changes of [{text:'9999'},{end:3},{start:-1},{confidence:NaN},{confidence:1.2}]){
  assert.deepEqual(locateSourceSpan(span,[{...tokens[0],...changes},...tokens.slice(1)]).boxes,[],JSON.stringify(changes));
 }
 for(const invalid of [{...span,start:-1},{...span,end:15},{...span,start:.5},{...span,end:Infinity}])
  assert.deepEqual(locateSourceSpan(invalid,tokens).boxes,[]);
});

test('birth-date calendar validation rejects impossible dates and retains format ambiguity',()=>{
 for(const value of ['31/02/2020','29/02/1900','2023-02-29','00/12/2000','2000-13-01','31 April 2020']){
  assert.equal(validateBirthDate(value).status,'failed',value);
  const found=detect('DOB: '+value).find(f=>f.category==='DATE_OF_BIRTH');
  assert.equal(found.validation.status,'failed');assert.ok(requiresManualReview(found));
 }
 for(const value of ['29/02/2000','2024-02-29','02/29/2024','29 February 2024','೨೯/೦೨/೨೦೨೪'])
  assert.equal(validateBirthDate(value).status,'passed',value);
 for(const value of ['03/04/2000','12/11/2000','01/02/03','2020-01/02'])assert.equal(validateBirthDate(value).status,'not_checked',value);
 assert.ok(requiresManualReview(detect('DOB: 03/04/2000').find(f=>f.category==='DATE_OF_BIRTH')));
});
