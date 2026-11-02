import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detection.ts';
import {validatePhone} from '../src/identifier-validation.ts';
import {requiresManualReview} from '../src/priority.ts';
import {redactSelectedSpans} from '../src/text-redaction.ts';
const hits=(s,c)=>detect(s).filter(f=>f.category===c);

test('structured, quoted and short credentials retain the complete secret',()=>{
 for(const [source,value] of [
  ['{"password":"two words @#123"}','two words @#123'],
  ['API_KEY="test-only-123"','test-only-123'],
  ["password: 'a b'",'a b'],
  ['Password: ab','ab'],
  ['Access Token: demo.token_123','demo.token_123'],
  ['Authorization: Bearer synthetic-token','synthetic-token']]){
   const found=hits(source,'CREDENTIAL_OR_SECRET');
   assert.ok(found.some(f=>f.value===value),source);
   for(const f of found)assert.equal(source.slice(f.start,f.end),f.value);
  }
});
test('empty labels never consume the next field',()=>{
 const source='Password:\nName: Fictional Person\nMRN:\nDiagnosis: fictional disease';
 assert.equal(hits(source,'CREDENTIAL_OR_SECRET').length,0);
 assert.equal(hits(source,'MEDICAL_RECORD_NUMBER').length,0);
});
test('incomplete private-key envelopes remain review blockers',()=>{
 const source='-----BEGIN PRIVATE KEY-----\nSYNTHETIC_KEY_BODY';
 const found=detect(source).filter(f=>f.category.includes('CREDENTIAL'));
 assert.ok(found.some(f=>f.value.includes('SYNTHETIC_KEY_BODY')));
 assert.ok(found.some(requiresManualReview));
});
test('international validation rejects embedded numbers and oversized fields',()=>{
 assert.equal(validatePhone('garbage +44 20 7946 0123 garbage').status,'failed');
 const found=hits('Phone: +44 20 7946 0123 4567 8901','INTERNATIONAL_PHONE_REVIEW');
 assert.ok(found.length>0);
 assert.ok(found.every(f=>f.validation.status!=='passed'));
 assert.ok(found.some(f=>f.value.endsWith('8901')));
});
test('VIDs never accept a 16-digit prefix of a longer grouped value',()=>{
 const found=detect('VID: 1234 5678 9012 3456 7890');
 assert.equal(found.some(f=>f.category==='AADHAAR_VIRTUAL_ID'&&f.validation.status==='passed'),false);
 assert.ok(found.some(requiresManualReview));
});
test('institutional IDs with delimiters are complete and do not become phones or Aadhaar',()=>{
 for(const [label,value] of [['MRN','HOSP/2026/9876543210'],['Patient ID','DEMO_2026/123'],['USN','4MC24CS099'],['Admission number','234567890124']]){
  const found=detect(`${label}: ${value}`);
  assert.ok(found.some(f=>f.value===value),label);
  assert.equal(found.some(f=>f.category.startsWith('AADHAAR')||f.category==='INDIAN_MOBILE'),false,label);
 }
});
test('multiline medical and address content has review coverage through the final line',()=>{
 for(const source of ['Prescription:\n  fictional medicine one\n  fictional medicine two\nPatient ID: DEMO123', 'Address: 12 Fictional Street\n  Example District\n  Example City\nEmail: demo@example.test']){
  const expected=source.includes('Prescription')?'fictional medicine two':'Example City';
  assert.ok(detect(source).some(f=>f.value.includes(expected)&&requiresManualReview(f)),source);
 }
});
test('fullwidth, nonbreaking separators and zero-width characters preserve raw redaction offsets',()=>{
 const source='🛡️ ＰＡＮ：ＡＢＣＰＥ１２３４Ｆ\nPassword: syn\u200bthetic-secret\nಆಧಾರ್: ೨೩೪೫\u00a0೬೭೮೯\u00a0೦೧೨೪';
 const found=detect(source);
 for(const category of ['PAN_CANDIDATE','CREDENTIAL_OR_SECRET','AADHAAR_CANDIDATE'])assert.ok(found.some(f=>f.category===category),category);
 for(const f of found)assert.equal(source.slice(f.start,f.end),f.value);
 const secret=found.find(f=>f.category==='CREDENTIAL_OR_SECRET');
 assert.equal(secret.value,'syn\u200bthetic-secret');
 assert.ok(!redactSelectedSpans(source,[secret]).includes('thetic-secret'));
});
test('unrecognized passport jurisdictions still receive labelled review candidates',()=>{
 for(const value of ['123456789','C01X00T47'])assert.ok(detect('Passport Number: '+value).some(f=>f.category.startsWith('PASSPORT')&&f.value===value));
});
test('long clinical lines are not silently truncated by the recognizer',()=>{
 const value='fictional '.repeat(30)+'TAIL_SENSITIVE';
 assert.ok(detect('Diagnosis: '+value).some(f=>f.value.endsWith('TAIL_SENSITIVE')));
});

test('IBAN country length and BBAN rules reject checksum-valid fabrications',async()=>{
 const {validateIban}=await import('../src/identifier-validation.ts');
 const {validIbanChecksum}=await import('../src/extended-detection.ts');
 function checksum(country,bban){
  const chars=(bban+country+'00').replace(/[A-Z]/g,c=>String(c.charCodeAt(0)-55));
  let remainder=0;for(const ch of chars)remainder=(remainder*10+Number(ch))%97;
  return country+String(98-remainder).padStart(2,'0')+bban;
 }
 for(const value of [checksum('GB','123412345678901234'),checksum('GB','WEST123456987654321')]){
  assert.equal(validIbanChecksum(value),true);
  assert.equal(validateIban(value).status,'failed');
  assert.ok(hits('IBAN: '+value,'IBAN_REVIEW').every(requiresManualReview));
 }
 assert.equal(validateIban(checksum('ZZ','123456789012345678')).status,'not_checked');
 for(const value of ['GB82 WEST 1234 5698 7654 32','DE89 3704 0044 0532 0130 00','NL91 ABNA 0417 1643 00'])assert.equal(validateIban(value).status,'passed',value);
 assert.equal(hits('IBAN: GB82 WEST 1234 5698 7654 32\tBIC: TESTGB22','IBAN_REVIEW')[0].value,'GB82 WEST 1234 5698 7654 32');
 assert.ok(hits('IBAN: GB82 WEST! 1234 5698 7654 32','IBAN_REVIEW').some(f=>f.value.endsWith('32')&&f.validation.status==='failed'));
});
test('explicit country hints permit national formats without guessing foreign country',()=>{
 for(const [source,country] of [['Phone (US): 202 555 0123','US'],['Phone (AU): 0412 345 678','AU'],['Phone (GB): 020 7946 0123','GB']]){
  const found=hits(source,'INTERNATIONAL_PHONE_REVIEW');
  assert.ok(found.some(f=>f.validation.status==='passed'&&f.validation.detail.includes(country)),source);
 }
 assert.equal(validatePhone('020 7946 0123').status,'failed');
 assert.equal(validatePhone('2025550123','ZZ').status,'failed');
});
test('malformed numeric fields preserve all OCR text for review',()=>{
 for(const [source,category] of [['Card Number: 4111 111I 1111 1111','PAYMENT_CARD_REVIEW'],['Account Number: 1234 56O8 9012','BANK_ACCOUNT_CANDIDATE'],['VID: 1234 5678 9O12 3456','AADHAAR_VIRTUAL_ID']]){
  const found=hits(source,category);
  assert.equal(found.length,1);assert.equal(found[0].value,source.split(': ')[1]);
  assert.equal(found[0].validation.status,'failed');assert.ok(requiresManualReview(found[0]));
 }
});
test('literal short/placeholder-like passwords and YAML continuation values remain protected',()=>{
 assert.ok(hits('Password: "null"','CREDENTIAL_OR_SECRET').some(f=>f.value==='null'));
 const source='password: |\n  synthetic line one\n  synthetic line two\nName: Fictional Person';
 const found=hits(source,'CREDENTIAL_FRAGMENT_REVIEW');
 assert.equal(found.length,1);assert.ok(found[0].value.includes('synthetic line two'));
 assert.ok(!found[0].value.includes('Name:'));assert.ok(requiresManualReview(found[0]));
});
test('normalization maps source positions across CRLF, emojis and removed format controls',()=>{
 for(const prefix of ['','🛡️ before\r\n','Header\r','\u200b\u2060','ಎಚ್ಚರಿಕೆ\n'])for(const gap of ['\u200b','\u200c','\u2060','']){
  const value='synthetic'+gap+'secret',source=prefix+'Ｐａｓｓｗｏｒｄ： "'+value+'"\r\nAFTER';
  const found=hits(source,'CREDENTIAL_OR_SECRET');assert.equal(found.length,1,source);
  assert.equal(found[0].value,value);assert.equal(source.slice(found[0].start,found[0].end),value);
  assert.equal(redactSelectedSpans(source,found),prefix+'Ｐａｓｓｗｏｒｄ： "[REDACTED]"\r\nAFTER');
 }
});
test('failed validation blocks auto-selection and clearance even with high numeric confidence',async()=>{
 const {autoSelectHighPriority}=await import('../src/auto-redaction.ts');
 const {coverageCheck}=await import('../src/clearance.ts');
 for(const status of ['failed','not_checked']){
 const finding={id:'invalid',category:'BANK_ACCOUNT_CANDIDATE',detection_confidence:.99,validation:{status,method:'test',detail:'synthetic'},page:0,boxes:[]};
 assert.deepEqual(autoSelectHighPriority([finding],'public','txt'),[]);
 assert.equal(coverageCheck([finding],[],[],'public',true).unresolvedReview.length,1);
 }
});
test('college card identifiers are not payment cards and Unicode line separators delimit fields',()=>{
 const source='College ID card number: 4MC24CS099\u2028Password:\u2029Name: Fictional Student';
 const found=detect(source);
 assert.ok(found.some(f=>f.category==='STUDENT_OR_EMPLOYEE_ID'&&f.value==='4MC24CS099'));
 assert.equal(found.some(f=>f.category==='PAYMENT_CARD_REVIEW'||f.category==='CREDENTIAL_OR_SECRET'),false);
 assert.ok(hits('Card number: 123456789','OTHER_IDENTIFIER_REVIEW').some(requiresManualReview));
});
