import test from 'node:test';
import assert from 'node:assert/strict';
import {autoSelectHighPriority} from '../src/auto-redaction.ts';
const f=(id,category,confidence=.94,boxes=[{x:10,y:10,width:80,height:20}],ocr=.95)=>({id,category,detection_confidence:confidence,ocr_confidence:ocr,boxes});
test('auto-selects located high-risk Aadhaar, PAN and bank, but excludes VID',()=>{
 assert.deepEqual(autoSelectHighPriority([f('a','AADHAAR_CANDIDATE'),f('p','PAN_CANDIDATE'),f('b','BANK_ACCOUNT_CANDIDATE'),f('v','AADHAAR_VIRTUAL_ID')],'public','pdf'),['a','p','b']);
});
test('low confidence, unlocated, uncertain OCR and optional academic fields are not auto-selected',()=>{
 assert.deepEqual(autoSelectHighPriority([f('a','AADHAAR_CANDIDATE',.9,[]),f('b','BANK_ACCOUNT_CANDIDATE',.9,undefined,.35),f('k','KANNADA_PARTY_ADDRESS_BLOCK_REVIEW'),f('grade','ACADEMIC_GRADE')],'public','pdf'),[]);
});
test('high-risk fields in plaintext are selected without image boxes',()=>{
 assert.deepEqual(autoSelectHighPriority([f('a','PAN_CANDIDATE',.9,[])],'public','txt'),['a']);
});
