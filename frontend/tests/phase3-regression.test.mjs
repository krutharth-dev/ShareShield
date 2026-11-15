import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detection.ts';
import {consolidateLocated} from '../src/finding-dedup.ts';
test('a line-wrapped 16-digit sequence never contributes a 12-digit Aadhaar',()=>{
 for(const label of ['Aadhaar: ','VID: ','BID: ',''])for(const value of ['2345 6789 0124\n9999','9999\n2345 6789 0124','2345\n6789 0124 9999']){
  assert.ok(!detect(label+value).some(f=>/^AADHAAR_(CANDIDATE|REVIEW|OCR_REVIEW)$/.test(f.category)),label+value);
 }
});
test('standalone label and numeric value on next row are review-only with exact source offsets',()=>{
 for(const label of ['ರೋಗಿಯ ಸಂಖ್ಯೆ','Patient MRN','ವೈದ್ಯಕೀಯ ದಾಖಲೆ ಸಂಖ್ಯೆ','Admission number','ಪ್ರವೇಶ ಸಂಖ್ಯೆ','Student ID']){
  for(const delimiter of [':\n','\n',':\r\n']){
   const text='📄\n'+label+delimiter+'೪೮೨೯೧೦೭\nMarks: 87';
   const result=detect(text).filter(f=>f.value==='೪೮೨೯೧೦೭');
   assert.equal(result.length,1,text);assert.ok(result[0].detection_confidence<.7);
   assert.equal(text.slice(result[0].start,result[0].end),'೪೮೨೯೧೦೭');
  }
 }
 for(const value of ['87','2026-11-09','4829107 pending','Page 4829107','4829107-42','1234567890123456'])
  assert.ok(!detect('ರೋಗಿಯ ಸಂಖ್ಯೆ\n'+value).some(f=>f.category==='FORM_IDENTIFIER_REVIEW'));
});
test('each incomplete labelled Aadhaar is flagged even beside a complete occurrence',()=>{
 const text='Aadhaar: 2345 6789 0124\nAadhaar: 2345 6789\nAadhaar: 2345 6789 01';
 const f=detect(text).filter(f=>f.category.startsWith('AADHAAR'));
 assert.equal(f.length,3);assert.equal(f.filter(f=>f.category==='AADHAAR_OCR_REVIEW').length,2);
});
test('one common word box cannot deduplicate distinct multiline occurrences',()=>{
 const box=(x,y)=>({x,y,width:80,height:20});
 const a={id:'a',page:0,category:'AADHAAR_CANDIDATE',boxes:[box(10,10),box(100,10),box(190,10)],detection_confidence:.9,reason:''};
 const b={...a,id:'b',boxes:[box(10,10),box(100,90),box(190,90)]};
 assert.equal(consolidateLocated([a,b],new Map([['a','234567890124'],['b','234567890124']])).findings.length,2);
});
import {validAadhaar} from '../src/detection.ts';
test('different checksum-valid Aadhaar values and repeated copies retain every source span',()=>{
 const second=Array.from({length:10},(_,i)=>'56789012345'+i).find(validAadhaar);assert.ok(second);
 const text=['Aadhaar: 2345 6789 0124','Aadhaar: '+second,'Aadhaar: 2345 6789 0124'].join('\n');
 const found=detect(text).filter(f=>f.category==='AADHAAR_CANDIDATE');assert.equal(found.length,3);assert.equal(new Set(found.map(f=>f.start)).size,3);
});


// New fictional reproducer; not a change to the frozen OCR evaluation corpus.
import {autoSelectHighPriority} from '../src/auto-redaction.ts';
test('line-wrapped Aadhaar validation agrees with detection without relaxing checksum or VID boundaries',()=>{
 for(const value of ['2345\n6789\n0124','2345\r\n6789\r\n0124','೨೩೪೫\n೬೭೮೯\n೦೧೨೪']){
  assert.equal(validAadhaar(value),true);
  const text='Aadhaar: '+value;const hits=detect(text).filter(f=>f.category==='AADHAAR_CANDIDATE');
  assert.equal(hits.length,1);assert.equal(hits[0].validation.status,'passed');
  assert.equal(text.slice(hits[0].start,hits[0].end),value);
  const located={...hits[0],id:'wrapped',boxes:[0,1,2].map(i=>({x:20,y:20+30*i,width:50,height:20})),ocr_confidence:.9};
  assert.deepEqual(autoSelectHighPriority([located],'public','pdf'),['wrapped']);
  assert.deepEqual(autoSelectHighPriority([{...located,boxes:[]}],'public','pdf'),[]);
  assert.deepEqual(autoSelectHighPriority([{...located,ocr_confidence:.4}],'public','pdf'),[]);
 }
 const invalid=detect('Aadhaar: 2345\n6789\n0125').find(f=>f.category==='AADHAAR_REVIEW');
 assert.equal(invalid?.validation?.status,'failed');
 assert.deepEqual(autoSelectHighPriority([{...invalid,id:'bad',boxes:[{x:20,y:20,width:50,height:20}]}],'public','pdf'),[]);
 assert.equal(validAadhaar('2345\n6789\n0124\n9999'),false);
 assert.ok(!detect('VID: 2345\n6789\n0124\n9999').some(f=>/^AADHAAR_(CANDIDATE|REVIEW|OCR_REVIEW)$/.test(f.category)));
});
