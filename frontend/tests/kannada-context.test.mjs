import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detection.ts';

test('Kannada-labelled birth dates, phones and bank accounts preserve source offsets',()=>{
 const input=[
  'ಹೆಸರು: ಶ್ರೀ ಕಲ್ಪಿತ ವ್ಯಕ್ತಿ',
  'ಜನ್ಮ ದಿನಾಂಕ: ೨೦-೦೯-೨೦೧೮',
  'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ: ೯೮೭೬ ೫೪೩೨೧೦',
  'ಖಾತೆ ಸಂಖ್ಯೆ: ೧೨೩೪೫೬೭೮೯೦೧೨',
  'PAN: ABCDE1234F',
 ].join('\n');
 const hits=detect(input);
 const dob=hits.find(f=>f.category==='DATE_OF_BIRTH');
 const phone=hits.find(f=>f.category==='INDIAN_MOBILE'&&f.value.includes('೯'));
 const bank=hits.find(f=>f.category==='BANK_ACCOUNT_CANDIDATE');
 assert.ok(dob,'Missing Kannada date of birth');
 assert.ok(phone,'Missing grouped Kannada phone number');
 assert.ok(bank,'Missing Kannada-labelled bank number');
 assert.ok(hits.some(f=>f.category==='PAN_CANDIDATE'));
 for(const h of [dob,phone,bank])assert.equal(input.slice(h.start,h.end),h.value);
});
test('Hindi-script digits in an explicitly labelled date and account are recognized',()=>{
 const input='जन्म तिथि: १२-०३-२००१\nखाता: १२३४५६७८९०१२';
 const hits=detect(input);
 assert.ok(hits.some(f=>f.category==='DATE_OF_BIRTH'));
 assert.ok(hits.some(f=>f.category==='BANK_ACCOUNT_CANDIDATE'));
 for(const h of hits)assert.equal(input.slice(h.start,h.end),h.value);
});
test('ordinary Kannada court narrative is not automatically classified as PII',()=>{
 const text='ನ್ಯಾಯಾಲಯವು ಇಂದು ವಿಚಾರಣೆಯನ್ನು ಮುಂದೂಡಿತು.\nದಿನಾಂಕ: 20-09-2018 ರಂದು ಅರ್ಜಿ ವಿಚಾರಣೆ ನಡೆಯಿತು.';
 assert.equal(detect(text).length,0);
});
test('a bare court case number and unrelated long number are not mistaken for account details',()=>{
 const text='ಪ್ರಕರಣ ಸಂಖ್ಯೆ: 123/2019\nಪರೀಕ್ಷೆ ಕ್ರಮಾಂಕ: 123456789012';
 const hits=detect(text);
 assert.equal(hits.some(f=>f.category==='BANK_ACCOUNT_CANDIDATE'),false);
 assert.equal(hits.some(f=>f.category.startsWith('AADHAAR')),false);
});
test('existing English mobile and date-of-birth recognition remain available',()=>{
 const hits=detect('DOB: 20/09/2018\nCall: +91 9876543210\nAccount number: 123456789012');
 assert.ok(hits.some(f=>f.category==='DATE_OF_BIRTH'));
 assert.ok(hits.some(f=>f.category==='INDIAN_MOBILE'));
 assert.ok(hits.some(f=>f.category==='BANK_ACCOUNT_CANDIDATE'));
});

test('fictional academic demo labels have source-accurate offsets',()=>{
 const pages=[
  'Student Name: Fictional Student\nDate of Birth: 15 August 2005\nCourse: Engineering',
  'Account Holder: Fictional Student\nBank Account Number (Synthetic): 111122223333\nKnown Allergy: Sample Substance\nMedical Insurance Policy Number (Synthetic): MEDTEST0001',
  'Temporary Password (Synthetic): DEMO-ONLY-SECRET\nStudent Application ID: APPTEST2026\nವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು: ಮಾದರಿ ವಿದ್ಯಾರ್ಥಿ\nಪೋಷಕರ ಹೆಸರು: ಕಾಲ್ಪನಿಕ ಪೋಷಕ'
 ];
 const hits=pages.flatMap(page=>detect(page));
 for(const category of ['PERSON_NAME_REVIEW','DATE_OF_BIRTH','BANK_ACCOUNT_CANDIDATE','ALLERGY','HEALTH_INSURANCE_ID','CREDENTIAL_OR_SECRET','STUDENT_OR_EMPLOYEE_ID','KANNADA_PERSONAL_DETAIL_REVIEW'])
   assert.ok(hits.some(f=>f.category===category),'Missing '+category);
 assert.ok(!hits.some(f=>f.value==='Engineering'));
 for(const page of pages)for(const hit of detect(page))assert.equal(page.slice(hit.start,hit.end),hit.value);
});
test('academic dates without an explicit DOB label are not classified as birth dates',()=>{
 assert.equal(detect('Exam held 17 July 2022\nMarks: 95').filter(f=>f.category==='DATE_OF_BIRTH').length,0);
});
