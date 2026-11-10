import test from 'node:test';
import assert from 'node:assert/strict';
import {consolidateLocated} from '../src/finding-dedup.ts';
const box=(x,y,width=110,height=18)=>({x,y,width,height});
const f=(id,category,page,x,y,confidence=.8)=>({id,category,page,boxes:[box(x,y)],detection_confidence:confidence,ocr_confidence:confidence,reason:'synthetic'});
test('three OCR passes at shifted coordinates collapse to one true source occurrence',()=>{
 const a=[f('a','AADHAAR_CANDIDATE',0,20,15,.7),f('b','AADHAAR_CANDIDATE',0,27,17,.8),f('c','AADHAAR_CANDIDATE',0,23,14,.75)];
 const data=new Map(a.map(x=>[x.id,'1234 5678 9012']));
 const result=consolidateLocated(a,data);
 assert.equal(result.findings.length,1);
 assert.equal(result.removedIds.length,2);
 assert.equal(result.disagreements,0);
});
test('the same identifier at different locations and pages remains separate',()=>{
 const a=[f('a','AADHAAR_CANDIDATE',0,20,15),f('b','AADHAAR_CANDIDATE',0,20,135),f('c','AADHAAR_CANDIDATE',1,20,15)];
 const result=consolidateLocated(a,new Map(a.map(x=>[x.id,'123456789012'])));
 assert.equal(result.findings.length,3);
});
test('bank account and Aadhaar findings are never merged even when spatially overlapping',()=>{
 const a=[f('a','AADHAAR_CANDIDATE',0,20,15),f('v','BANK_ACCOUNT_CANDIDATE',0,21,16)];
 assert.equal(consolidateLocated(a,new Map([['a','123456789012'],['v','123456789012']])).findings.length,2);
});
test('conflicting readings of same Aadhaar location trigger one manual-review record',()=>{
 const a=[f('a','AADHAAR_CANDIDATE',0,20,15),f('b','AADHAAR_CANDIDATE',0,21,16)];
 const r=consolidateLocated(a,new Map([['a','123456789012'],['b','1234567890123457']]));
 assert.equal(r.findings.length,1);assert.equal(r.findings[0].category,'AADHAAR_OCR_REVIEW');
 assert.equal(r.disagreements,1);
});
test('bank values and Kannada personal-review text are not absorbed by Aadhaar dedupe',()=>{
 const a=[f('a','AADHAAR_CANDIDATE',0,20,15),f('bank','BANK_ACCOUNT_CANDIDATE',0,21,16),f('kn','KANNADA_PERSONAL_DETAIL_REVIEW',0,19,12)];
 assert.equal(consolidateLocated(a,new Map(a.map(x=>[x.id,'123456789012']))).findings.length,3);
});
test('unrecognized ink lines and genuinely distinct blank-location detections remain',()=>{
 const a=[{...f('a','UNREADABLE_TEXT_LINE_REVIEW',0,20,15)},{...f('b','UNREADABLE_TEXT_LINE_REVIEW',0,20,15)}, {...f('c','AADHAAR_CANDIDATE',0,20,15),boxes:[]}];
 assert.equal(consolidateLocated(a,new Map()).findings.length,3);
});
test('duplicate fallback bands consolidate, separate bands do not',()=>{
 const a=[f('a','AADHAAR_NUMBER_REGION_REVIEW',0,20,15),f('b','AADHAAR_NUMBER_REGION_REVIEW',0,21,16),f('c','AADHAAR_NUMBER_REGION_REVIEW',0,20,145)];
 assert.equal(consolidateLocated(a,new Map()).findings.length,2);
});

test('exact duplicate Kannada address observations are collapsed without suppressing distinct addresses',()=>{
 const a=[f('a','KANNADA_ADDRESS_REVIEW',0,20,15),f('b','KANNADA_ADDRESS_REVIEW',0,21,15),f('c','KANNADA_ADDRESS_REVIEW',0,20,145)];
 const r=consolidateLocated(a,new Map([['a','ಮನೆ 1, ರಸ್ತೆ'],['b','ಮನೆ 1, ರಸ್ತೆ'],['c','ಮನೆ 2, ರಸ್ತೆ']]));
 assert.equal(r.findings.length,2);assert.deepEqual(r.removedIds,['b']);
});
test('virtual identifiers are not collapsed with nearby 12-digit Aadhaar findings',()=>{
 const a=[f('a','AADHAAR_CANDIDATE',0,20,15),f('v','AADHAAR_VIRTUAL_ID',0,21,16)];
 assert.equal(consolidateLocated(a,new Map([['a','123456789012'],['v','1234567890123456']])).findings.length,2);
});

test('OCR disagreement invalidates stale successful structural validation',()=>{
 const boxes=[{x:10,y:10,width:100,height:20}];
 const first={id:'old',page:0,category:'AADHAAR_CANDIDATE',boxes,detection_confidence:.94,reason:'checksum pass',validation:{status:'passed',method:'Verhoeff',detail:'format only'}};
 const second={...first,id:'new'};
 const result=consolidateLocated([first,second],new Map([['old','234567890124'],['new','234567890125']]));
 assert.equal(result.findings[0].validation.status,'failed');
 assert.equal(result.findings[0].category,'AADHAAR_OCR_REVIEW');
});
test('two-word and three-word OCR segmentations of one number consolidate',()=>{
 const a=f('a','AADHAAR_CANDIDATE',0,10,10);a.boxes=[box(10,10,40),box(55,10,40),box(100,10,40)];
 const b={...a,id:'b',boxes:[box(10,10,85),box(100,10,40)]};
 assert.equal(consolidateLocated([a,b],new Map([['a','2345 6789 0124'],['b','23456789 0124']])).findings.length,1);
});
