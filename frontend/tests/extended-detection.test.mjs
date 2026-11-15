import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detection.ts';
import {validLuhn, validIbanChecksum} from '../src/extended-detection.ts';
import {classifyPriority,rankGroups,PRIORITY_LABELS,requiresManualReview} from '../src/priority.ts';

test('new bilingual medical fields retain exact source offsets',()=>{
 const sample='ರೋಗಿಯ ಸಂಖ್ಯೆ: HSP48291\nವೈದ್ಯಕೀಯ ದಾಖಲೆ ಸಂಖ್ಯೆ: 4829107\nರೋಗಿಯ ಹೆಸರು: ಕಾಲ್ಪನಿಕ ವ್ಯಕ್ತಿ\nರೋಗನಿರ್ಣಯ: ಕಾಲ್ಪನಿಕ ರೋಗ\nPatient Name: Fictional Patient';
 const found=detect(sample);
 for(const category of ['PATIENT_ID','MEDICAL_RECORD_NUMBER','PATIENT_NAME_REVIEW','MEDICAL_DIAGNOSIS_REVIEW']){
  assert.ok(found.some(f=>f.category===category),category);
 }
 for(const f of found)assert.equal(sample.slice(f.start,f.end),f.value);
});
test('medical and academic purposes change priorities without reordering 16 base labels',()=>{
 assert.equal(PRIORITY_LABELS.length,16);
 assert.equal(PRIORITY_LABELS[0],'Aadhaar number');
 assert.equal(classifyPriority('MEDICAL_DIAGNOSIS_REVIEW','public').tier,'HIGH');
 assert.equal(classifyPriority('MEDICAL_DIAGNOSIS_REVIEW','medical').tier,'MEDIUM');
 assert.equal(classifyPriority('ACADEMIC_ADMISSION_ID','public').tier,'HIGH');
 assert.equal(classifyPriority('ACADEMIC_ADMISSION_ID','academic').tier,'MEDIUM');
 assert.equal(classifyPriority('PATIENT_NAME_REVIEW','public').tier,'HIGH');
 const groups=rankGroups(['PATIENT_ID','MEDICAL_DIAGNOSIS_REVIEW','ACADEMIC_ADMISSION_ID'].map(category=>({category})),'public');
 assert.equal(groups.filter(g=>g.tier==='HIGH').map(g=>g.rank).join(','),'1,2,3');
});
test('multiple labelled medical and college fields remain distinct',()=>{
 const source='Patient ID: DEMO221\nPatient Name: Fictional Person\nLab Result: normal fictional result\nAdmission Number: DEMO-2026\n4MC24CS099\nGrade: A+';
 const found=detect(source);
 assert.ok(found.some(f=>f.category==='PATIENT_ID'));
 assert.ok(found.some(f=>f.category==='PATIENT_NAME_REVIEW'));
 assert.ok(found.some(f=>f.category==='ACADEMIC_ADMISSION_ID'));
 assert.ok(found.some(f=>f.category==='COLLEGE_USN_REVIEW'));
 assert.ok(!found.some(f=>f.category==='BLOOD_GROUP'));
 assert.ok(found.some(f=>f.category==='ACADEMIC_GRADE'));
});
test('Luhn and IBAN checks do not claim issued accounts',()=>{
 assert.equal(validLuhn('4111 1111 1111 1111'),true);
 assert.equal(validLuhn('4111 1111 1111 1112'),false);
 assert.equal(validIbanChecksum('GB82 WEST 1234 5698 7654 32'),true);
 assert.equal(validIbanChecksum('GB82 WEST 1234 5698 7654 33'),false);
 const found=detect('Card Number: 4111 1111 1111 1111\nIBAN: GB82 WEST 1234 5698 7654 32');
 assert.ok(found.some(f=>f.category==='PAYMENT_CARD_REVIEW'));
 assert.ok(found.some(f=>f.category==='IBAN_REVIEW'));
 assert.ok(found.filter(f=>/^(PAYMENT_CARD|IBAN)_REVIEW/.test(f.category)).every(requiresManualReview));
});
test('explicit international contact and emergency details are review, not metadata-valid phone claims',()=>{
 const found=detect('International Phone: +44 20 7946 0123\nEmergency Contact: Fictional Guardian 9876543210');
 assert.ok(found.some(f=>f.category==='INTERNATIONAL_PHONE_REVIEW'));
 assert.ok(found.some(f=>f.category==='EMERGENCY_CONTACT_REVIEW'));
});
test('replacement markers are never classified as sensitive values',()=>{
 const found=detect('ರೋಗಿಯ ಹೆಸರು: [REDACTED]\nPatient Name: [REDACTED]\nEmergency Contact: [REDACTED]');
 assert.equal(found.filter(f=>['PATIENT_NAME_REVIEW','EMERGENCY_CONTACT_REVIEW'].includes(f.category)).length,0);
});
