import test from 'node:test';
import assert from 'node:assert/strict';
import {priorityForCategory,needsMandatoryReview,sortByPriority,PRIORITY_LABELS,isUncertainOcrRegion} from '../src/priority.ts';

test('category ranking retains exact 1–16 user-agreed priority order',()=>{
 const categories=[
  'AADHAAR_CANDIDATE','PAN_CANDIDATE','CREDENTIAL_OR_SECRET',
  'BANK_ACCOUNT_CANDIDATE','ENROLMENT_NUMBER','PASSPORT_NUMBER',
  'UPI_ID','VOTER_ID','DRIVING_LICENCE_NUMBER','STUDENT_OR_EMPLOYEE_ID',
  'DATE_OF_BIRTH','INDIAN_MOBILE','EMAIL','KANNADA_ADDRESS_REVIEW',
  'PERSON_NAME_REVIEW','KANNADA_CASE_REFERENCE_REVIEW'
 ];
 assert.equal(PRIORITY_LABELS.length,16);
 for(const [index,category] of categories.entries())assert.equal(priorityForCategory(category),index+1,category);
 assert.equal(priorityForCategory('ENROLMENT_NUMBER'),5);
 assert.equal(priorityForCategory('AADHAAR_OCR_REVIEW'),1);
 assert.equal(priorityForCategory('POSTAL_CODE_REVIEW'),14);
});
test('priority sort does not mutate detection order, checkboxes or identifiers',()=>{
 const source=[
  {id:'email',category:'EMAIL',page:0},
  {id:'aadhaar',category:'AADHAAR_REVIEW',page:2},
  {id:'student',category:'STUDENT_OR_EMPLOYEE_ID',page:1},
  {id:'pan-a',category:'PAN_CANDIDATE',page:0},
  {id:'pan-b',category:'PAN_CANDIDATE',page:1},
  {id:'secret',category:'CREDENTIAL_OR_SECRET',page:0}
 ];
 const result=sortByPriority(source);
 assert.deepEqual(result.map(f=>f.id),['aadhaar','pan-a','pan-b','secret','student','email']);
 assert.deepEqual(source.map(f=>f.id),['email','aadhaar','student','pan-a','pan-b','secret']);
 assert.equal(result[0],source[1]);
});
test('unrecognized images remain mandatory manual review, not invented priority/risk',()=>{
 for(const category of ['QR_CODE','FACE','UNREADABLE_TEXT_LINE_REVIEW','KANNADA_PERSONAL_DETAIL_REVIEW']){
  assert.equal(priorityForCategory(category),null);
  assert.equal(needsMandatoryReview(category),true);
 }
 assert.equal(needsMandatoryReview('AADHAAR_OCR_REVIEW'),true);
 assert.equal(needsMandatoryReview('EMAIL'),false);
 const sorted=sortByPriority([
  {category:'FACE',id:'face'},{category:'UNREADABLE_TEXT_LINE_REVIEW',id:'ink'},
  {category:'EMAIL',id:'email'},{category:'AADHAAR_CANDIDATE',id:'aadhaar'}
 ]);
 assert.deepEqual(sorted.map(f=>f.id),['aadhaar','email','face','ink']);
 assert.equal(priorityForCategory('unrecognized-new-category'),null);
});

test('unreadable OCR is distinct from Kannada personal-detail candidates',()=>{
 assert.equal(isUncertainOcrRegion({category:'UNREADABLE_TEXT_LINE_REVIEW'}),true);
 assert.equal(isUncertainOcrRegion({category:'KANNADA_PERSONAL_DETAIL_REVIEW'}),false);
 assert.equal(isUncertainOcrRegion({category:'KANNADA_PARTY_IDENTITY_REVIEW'}),false);
});

test('official Aadhaar retains rank one while virtual IDs are excluded from ranking',()=>{
 assert.equal(priorityForCategory('AADHAAR_CANDIDATE'),1);
 assert.equal(priorityForCategory('ENROLMENT_NUMBER'),5);
 assert.equal(priorityForCategory('AADHAAR_VIRTUAL_ID'),null);
 assert.equal(priorityForCategory('JUDGE_AADHAAR_FIELD_16'),null);
});

test('a page with unavailable OCR remains an unlocalized manual-review blocker',()=>{
 assert.equal(needsMandatoryReview('UNREADABLE_PAGE_REVIEW'),true);
 assert.equal(isUncertainOcrRegion({category:'UNREADABLE_PAGE_REVIEW'}),true);
});
