import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detection.ts';
import {isVirtualId} from '../src/selection-policy.ts';
import {selectedValueRemains} from '../src/residual-values.ts';
test('excluded VID containing a selected Aadhaar is not required verification coverage',()=>{
 const text='VID: 2345 6789 0124 9999';
 assert.equal(selectedValueRemains(text,'2345 6789 0124',detect(text).filter(isVirtualId),true),false);
 assert.equal(selectedValueRemains('2345678901249999','234567890124',[],true),false);
});
test('a real residual occurrence outside VID still fails, including Kannada numerals',()=>{
 const text='VID: 2345 6789 0124 9999\nAadhaar: ೨೩೪೫ ೬೭೮೯ ೦೧೨೪';
 assert.equal(selectedValueRemains(text,'2345 6789 0124',detect(text).filter(isVirtualId),true),true);
 assert.equal(selectedValueRemains('secret remains','secret',[],false),true);
});

import {requiresManualReview} from '../src/priority.ts';
test('OCR reading of a black mask as letters retains uncertainty instead of confirmed exposure',()=>{
 const [f]=detect('Patient MRN: INN');assert.equal(f.detection_confidence,.55);assert.equal(requiresManualReview(f),true);
 assert.equal(requiresManualReview(detect('Patient MRN: 4829107')[0]),false);
});
