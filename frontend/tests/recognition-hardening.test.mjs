import test from 'node:test';
import assert from 'node:assert/strict';
import {detect,validAadhaar} from '../src/detection.ts';
import {validPan,validIfsc,validatePhone} from '../src/identifier-validation.ts';
import {validLuhn,validIbanChecksum} from '../src/extended-detection.ts';
import {CATEGORY_REGISTRY,labelledRules} from '../src/category-registry.ts';
import {rankGroups,PRIORITY_LABELS,PURPOSES,requiresManualReview,classifyPriority,priorityForCategory,mandatoryReviewQueue} from '../src/priority.ts';

const only=(text,category)=>detect(text).filter(f=>f.category===category);
test('registry covers every detector output and every extensible rule',()=>{
 for(const rule of labelledRules)assert.ok(CATEGORY_REGISTRY[rule.category],rule.category);
 const fields="Aadhaar: 2345 6789 0124\nPAN: ABCPE1234F\nMRN: DEMO123\nBlood Group: AB+\nUSN: 4MC24CS099\nIFSC: SBIN0001234\nAPI_KEY: synthetic_key_123\nIBAN: GB82 WEST 1234 5698 7654 32";
 for(const f of detect(fields))assert.ok(CATEGORY_REGISTRY[f.category],f.category);
});
test('Aadhaar checksum and PAN position checks validate syntax only',()=>{
 assert.equal(validAadhaar('234567890124'),true);
 assert.equal(validAadhaar('೨೩೪೫ ೬೭೮೯ ೦೧೨೪'),true);
 assert.equal(validAadhaar('234567890125'),false);
 assert.equal(validAadhaar('x234567890124'),false);
 for(const holder of 'ABCFGHLJPT')assert.equal(validPan(`ABC${holder}E1234F`),true);
 for(const value of ['ABCDE1234F','ABCPE12345','ABC1E1234F','ABCP1234F'])assert.equal(validPan(value),false,value);
 assert.equal(validIfsc('SBIN0001234'),true);
 assert.equal(validIfsc('SBIN1001234'),false);
 assert.equal(only('IFSC: SBIN1001234','IFSC')[0].validation.status,'failed');
 assert.equal(only('PAN: ABCDE1234F','PAN_CANDIDATE')[0].validation.status,'failed');
 assert.equal(only('PAN: ABCPE1234F','PAN_CANDIDATE')[0].validation.status,'passed');
});
test('institutional fields do not become Aadhaar even when their digits pass Verhoeff',()=>{
 for(const label of ['MRN','Patient ID','Account number','Card number','Student ID','USN','Order','Invoice','ಖಾತೆ','ರೋಗಿಯ ಸಂಖ್ಯೆ']){
  assert.equal(detect(`${label}: 234567890124`).some(f=>f.category.startsWith('AADHAAR')),false,label);
 }
 assert.equal(detect('Aadhaar: 2345 6789 0124\nMRN: 234567890124').filter(f=>f.category.startsWith('AADHAAR')).length,1);
 assert.equal(detect('Aadhaar: 2345 6789 0124\nOrder: 2345 6789 0124').filter(f=>f.category.startsWith('AADHAAR')).length,1);
 assert.equal(detect('Aadhaar: 2345 6789 0124\nOrder: 94OI 8O24 3O17').filter(f=>f.category==='AADHAAR_OCR_REVIEW').length,0);
});
test('VID is distinct, complete and does not hide following fields',()=>{
 const text='VID: 2345 6789 0124 9876\nMRN: DEMO123';
 const f=only(text,'AADHAAR_VIRTUAL_ID');
 assert.equal(f.length,1);assert.equal(f[0].validation.status,'passed');
 assert.equal(detect(text).some(x=>x.category==='AADHAAR_CANDIDATE'),false);
 assert.equal(only(text,'MEDICAL_RECORD_NUMBER').length,1);
});
test('international metadata validates country plans without domestic substrings',()=>{
 for(const value of ['+44 20 7946 0123','+1 202 555 0123','+61 412 345 678','+91 9876543210','+49 30 901820']){
  assert.equal(validatePhone(value).status,'passed',value);
  const category=value.startsWith('+91')?'INDIAN_MOBILE':'INTERNATIONAL_PHONE_REVIEW';
  const found=only('Phone: '+value,category);
  assert.equal(found.length,1,value);assert.equal(found[0].validation.status,'passed');
  if(category!=='INDIAN_MOBILE')assert.equal(only('Phone: '+value,'INDIAN_MOBILE').length,0);
 }
 for(const value of ['+999 123456789','+1 123 456 7890','+61 012 345 678'])assert.equal(validatePhone(value).status,'failed',value);
 assert.equal(only('Contact Number: +999 123456789','INTERNATIONAL_PHONE_REVIEW')[0].validation.status,'failed');
 assert.equal(only('ದೂರವಾಣಿ: +೯೧ ೯೮೭೬೫೪೩೨೧೦','INTERNATIONAL_PHONE_REVIEW')[0]?.validation.status,'passed');
});
test('medical, academic and Kannada fields retain identity and offsets',()=>{
 const text='MRN: DEMO123\nPatient ID: TEST456\nDiagnosis: fictional diagnosis\nBlood Group: A+\nPrescription: fictional medication\nಔಷಧಿ: ಕಾಲ್ಪನಿಕ ಔಷಧ\nUSN: 4MC24CS099\nAdmission number: TEST2026\nAcademic Record: fictional attendance\nGrade: A+';
 const found=detect(text);
 for(const cat of ['MEDICAL_RECORD_NUMBER','PATIENT_ID','MEDICAL_CONDITION','BLOOD_GROUP','MEDICATION','STUDENT_OR_EMPLOYEE_ID','ACADEMIC_ADMISSION_ID','ACADEMIC_RECORD_REVIEW','ACADEMIC_GRADE'])assert.ok(found.some(f=>f.category===cat),cat);
 for(const f of found){assert.equal(text.slice(f.start,f.end),f.value);assert.ok(f.source_context);assert.ok(f.validation);assert.match(f.confidence_meaning,/not a calibrated probability/);}
 assert.equal(found.filter(f=>f.category==='BLOOD_GROUP').length,1);
 assert.equal(detect('MRN is not supplied\nPatient ID: unknown').some(f=>['MEDICAL_RECORD_NUMBER','PATIENT_ID'].includes(f.category)),false);
});
test('repeated values keep separate offsets, category grouping and contiguous tier ranks',()=>{
 const text='MRN: DEMO123\nMRN: DEMO123\nEmail: one@example.test\nGrade: A+\nMarks: 80';
 assert.equal(only(text,'MEDICAL_RECORD_NUMBER').length,2);
 const groups=rankGroups(detect(text));
 assert.equal(groups.find(g=>g.category==='MEDICAL_RECORD_NUMBER').findings.length,2);
 for(const tier of ['HIGH','MEDIUM','LOW'])assert.deepEqual(groups.filter(g=>g.tier===tier).map(g=>g.rank),groups.filter(g=>g.tier===tier).map((_,i)=>i+1));
});
test('all purposes keep 16 base order while contextual MRNs and credentials rank first',()=>{
 assert.equal(PRIORITY_LABELS.length,16);
 assert.deepEqual(['AADHAAR_CANDIDATE','PAN_CANDIDATE','CREDENTIAL_OR_SECRET','BANK_ACCOUNT_CANDIDATE','ENROLMENT_NUMBER','PASSPORT_NUMBER','UPI_ID','VOTER_ID','DRIVING_LICENCE_NUMBER','STUDENT_OR_EMPLOYEE_ID','DATE_OF_BIRTH','INDIAN_MOBILE','EMAIL','ADDRESS_REVIEW','PERSON_NAME_REVIEW','LEGAL_CASE_REFERENCE'].map(priorityForCategory),Array.from({length:16},(_,i)=>i+1));
 for(const purpose of Object.keys(PURPOSES)){
  assert.equal(rankGroups([{category:'AADHAAR_CANDIDATE'},{category:'MEDICAL_RECORD_NUMBER'}],purpose)[0].category,'MEDICAL_RECORD_NUMBER');
  assert.equal(rankGroups([{category:'AADHAAR_CANDIDATE'},{category:'CREDENTIAL_OR_SECRET'}],purpose)[0].category,'CREDENTIAL_OR_SECRET');
 }
 assert.equal(classifyPriority('BLOOD_GROUP','public').tier,'HIGH');
 assert.equal(classifyPriority('BLOOD_GROUP','medical').tier,'MEDIUM');
 assert.equal(classifyPriority('BIOMETRIC_INDICATOR_REVIEW','private').tier,'HIGH');
});
test('confidential categories and failed validators enter a separate review queue',()=>{
 const found=detect('PAN: ABCDE1234F\nFingerprint ID: synthetic-template\nLegal Notes: fictional privileged advice\nAuthorization: Bearer test.token_123\nRefresh Token: test-refresh_123\nEmail: one@example.test');
 for(const cat of ['BIOMETRIC_INDICATOR_REVIEW','LEGAL_INFORMATION_REVIEW','CREDENTIAL_OR_SECRET'])assert.ok(found.some(f=>f.category===cat),cat);
 assert.equal(found.filter(f=>f.category==='CREDENTIAL_OR_SECRET').length,2);
 const queue=mandatoryReviewQueue(found);
 assert.ok(queue.some(f=>f.category==='PAN_CANDIDATE'));
 assert.ok(queue.some(f=>f.category==='BIOMETRIC_INDICATOR_REVIEW'));
 assert.equal(queue.some(f=>f.category==='EMAIL'),false);
 assert.ok(queue.every(requiresManualReview));
});
test('card and IBAN checksum failures remain reviewable, placeholders are not valid cards',()=>{
 assert.equal(validLuhn('0000000000000000'),false);
 assert.equal(validIbanChecksum('GB82 WEST 1234 5698 7654 32'),true);
 assert.equal(validIbanChecksum('GB82 WEST 1234 5698 7654 33'),false);
 const found=detect('Card Number: 4111 1111 1111 1112\nIBAN: GB82 WEST 1234 5698 7654 33');
 for(const cat of ['PAYMENT_CARD_REVIEW','IBAN_REVIEW'])assert.equal(found.find(f=>f.category===cat).validation.status,'failed');
});
test('labelled alphabetic patient IDs remain conservative review candidates',()=>{
 const found=only('Patient ID: DEMOPATIENT','PATIENT_ID');
 assert.equal(found.length,1);assert.ok(requiresManualReview(found[0]));
});
test('credential punctuation and private key envelopes are not truncated',()=>{
 const sample='Password: Demo@#1234\nAPI Key: synthetic$only!123\n-----BEGIN PRIVATE KEY-----\nSYNTHETIC_NOT_A_KEY\n-----END PRIVATE KEY-----';
 const found=only(sample,'CREDENTIAL_OR_SECRET');
 assert.equal(found.length,3);
 assert.equal(found[0].value,'Demo@#1234');
 assert.equal(found[1].value,'synthetic$only!123');
 assert.match(found[2].value,/END PRIVATE KEY/);
 for(const f of found)assert.equal(sample.slice(f.start,f.end),f.value);
});

test('unlabelled arithmetic and unsupported calling codes do not become phone findings',()=>{
 assert.equal(only('Adjustment +1234 and +999123456789','INTERNATIONAL_PHONE_REVIEW').length,0);
});
