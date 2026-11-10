import test from 'node:test';
import assert from 'node:assert/strict';
import {detect,validAadhaar,verificationStatus} from '../src/detection.ts';
test('detects supported labelled identifiers without confusing severity and confidence',()=>{
 const f=detect('Email: demo@example.test PAN ABCDE1234F Password: DemoSecret_4829 Account number: 123456789012');
 for(const name of ['EMAIL','PAN_CANDIDATE','CREDENTIAL_OR_SECRET','BANK_ACCOUNT_CANDIDATE'])assert.ok(f.some(x=>x.category===name));
 assert.equal(f.find(x=>x.category==='CREDENTIAL_OR_SECRET').risk,'CRITICAL');
});
test('invalid Aadhaar with explicit context is reviewable rather than silently discarded',()=>{const f=detect('Aadhaar: 1234 5678 9012');assert.equal(f[0].category,'AADHAAR_REVIEW');assert.equal(f[0].risk,'HIGH');assert.ok(f[0].detection_confidence<.5);});
test('unlabelled order number is not a bank account',()=>{assert.ok(!detect('Order 123456789012').some(f=>f.category==='BANK_ACCOUNT_CANDIDATE'));});
test('valid Aadhaar checksum requires allowed starting digit',()=>{assert.equal(validAadhaar('000000000000'),false);});
test('email is not duplicated as a UPI handle',()=>{assert.deepEqual(detect('demo.person@example.test').map(x=>x.category),['EMAIL']);});
test('mixed script context preserves identifier detection',()=>{assert.ok(detect('ಖಾತೆ: 123456789012').some(x=>x.category==='BANK_ACCOUNT_CANDIDATE'));assert.ok(detect('खाता: 123456789012').some(x=>x.category==='BANK_ACCOUNT_CANDIDATE'));});
test('FLAG precedes incomplete checks; missing checks never clear',()=>{assert.equal(verificationStatus(1,true),'FLAG');assert.equal(verificationStatus(0,true),'UNVERIFIED');assert.equal(verificationStatus(0,false),'SCOPED_CLEAR');});

test('labelled 16-digit VID and BID are high-risk selectable findings',()=>{
 for(const label of ['VID','BID','Virtual ID','Virtual Identification ID'])assert.equal(detect(label+': 9107 2702 3707 5395').filter(f=>f.category==='AADHAAR_VIRTUAL_ID').length,1,label);
});
test('detects enrolment identifier',()=>{assert.ok(detect('Enrolment No.: 0000/00593/24474').some(x=>x.category==='ENROLMENT_NUMBER'));});
test('reviews names and addresses in printed OCR lines',()=>{
 const f=detect('To\nSample Person\nS/O Fictional Guardian\nNo 106 Example House\n3rd Main 3rd Cross\nNear Sample Landmark');
 assert.ok(f.some(x=>x.category==='ADDRESSEE_REVIEW'));
 assert.ok(f.some(x=>x.category==='PERSON_NAME_REVIEW'));
 assert.ok(f.some(x=>x.category==='ADDRESS_REVIEW'));
});

test('review labels do not re-flag actual redaction placeholders',()=>{
 const d=detect('Name: [REDACTED]\nTo\n[REDACTED]\n[REDACTED]');
 assert.equal(d.filter(x=>['PERSON_NAME_REVIEW','ADDRESSEE_REVIEW','PERSONAL_DETAILS_BLOCK'].includes(x.category)).length,0);
});

test('institution letterhead postal code alone is not a private-data match',()=>{
 assert.ok(!detect('Malnad College\nHassan 573202 Karnataka').some(x=>x.category==='POSTAL_CODE_REVIEW'));
 assert.ok(detect('PIN Code: 573202').some(x=>x.category==='POSTAL_CODE_REVIEW'));
});
test('Aadhaar documents retain checksum-failing repeated number candidates for review',()=>{
 const hits=detect('Your Aadhaar No. 1234 5678 9012\nVID: 1234 5678 9012 3456\nAnother copy 1234 5678 9012');
 assert.ok(hits.filter(x=>x.category==='AADHAAR_REVIEW').length>=2);
});

test('Kannada legal parties, household details and case identifiers are reviewed',()=>{
 const text='ಕ್ರಿಮಿನಲ್ ಅಪೀಲು ಸಂಖ್ಯೆ 12/2019\nದೂರುದಾರರು: ಶ್ರೀ ಮಾದೇಶ್\nತಂದೆ ರಾಮಣ್ಣ\n38 ವರ್ಷ\nಹಾಸನ ತಾಲ್ಲೂಕು\n\nವಿರುದ್ಧ\nಪ್ರತಿವಾದಿಗಳು: ಶ್ರೀಮತಿ ಗೌರಿ\nಹೆಸರು: ಕುಮಾರಿ ಶಾಂತಿ\nವಿಳಾಸ: ಮೈಸೂರು ಗ್ರಾಮ';
 const hits=detect(text);
 assert.ok(hits.some(x=>x.category==='KANNADA_PARTY_IDENTITY_REVIEW'&&x.value.includes('ಮಾದೇಶ್')));
 assert.ok(hits.some(x=>x.category==='KANNADA_PARTY_IDENTITY_REVIEW'&&x.value.includes('ರಾಮಣ್ಣ')));
 assert.ok(hits.some(x=>x.category==='KANNADA_ADDRESS_REVIEW'));
 assert.ok(hits.some(x=>x.category==='KANNADA_PERSONAL_DETAIL_REVIEW'&&x.value.includes('ಶಾಂತಿ')));
 assert.ok(hits.some(x=>x.category==='KANNADA_CASE_REFERENCE_REVIEW'));
});
test('Kannada review candidates keep original text offsets and skip placeholders',()=>{
 const text='ಹೆಸರು: ಶ್ರೀ ಮಂಜುನಾಥ\nವಿಳಾಸ: [REDACTED]\nಪ್ರತಿವಾದಿ: [REDACTED]';
 const hits=detect(text);
 for(const h of hits)assert.equal(text.slice(h.start,h.end),h.value);
 assert.ok(!hits.some(h=>h.value.trim()==='[REDACTED]'));
});

test('Aadhaar groups with Hindi and Kannada digits are reviewable',()=>{
 const text='ಆಧಾರ್ ಸಂಖ್ಯೆ: ೯೪೦೧ ೮೦೨೪ ೩೦೧೭\nआधार संख्या: ९४०१ ८०२४ ३०१७';
 const hits=detect(text).filter(x=>x.category.startsWith('AADHAAR'));
 assert.ok(hits.length>=2);
 for(const h of hits)assert.equal(text.slice(h.start,h.end),h.value);
});
test('Aadhaar label permits review despite uncertain OCR substitutions',()=>{
 const hits=detect('Your Aadhaar Number: 94OI 8O24 3O17');
 assert.ok(hits.some(x=>x.category==='AADHAAR_OCR_REVIEW'));
});


test('academic subject/course labels are not misclassified as personal names',()=>{
 const sample=[
  'Name of Subject/Course: Computer Science',
  'Name of the Course: BSc Information Technology',
  'Subject Name: Mathematics',
  'Name of Subject: Physics',
  'Course: Engineering',
 ].join('\n');
 assert.equal(detect(sample).filter(f=>f.category==='PERSON_NAME_REVIEW').length,0);
});
test('personal labels and relationship names remain reviewable with accurate source offsets',()=>{
 const sample='Name: Fictional Student\nName of Student: Fictional Learner\nAccount Holder: Fictional Owner\nS/O Fictional Guardian';
 const results=detect(sample).filter(f=>f.category==='PERSON_NAME_REVIEW');
 assert.equal(results.length,4);
 for(const hit of results)assert.equal(sample.slice(hit.start,hit.end),hit.value);
});
test('Kannada-labelled and mixed-script passwords are high-risk without unrelated prose matches',()=>{
 const samples=['ಪಾಸ್‌ವರ್ಡ್: Demo_Only!2026','ಪಾಸ್ವರ್ಡ್: Test-9876','ಗುಪ್ತಪದ: Example@1234','ತಾತ್ಕಾಲಿಕ ಪಾಸ್‌ವರ್ಡ್: FakeKey456'];
 for(const input of samples){
  const hits=detect(input).filter(f=>f.category==='CREDENTIAL_OR_SECRET');
  assert.equal(hits.length,1,'A labelled Kannada credential must be reviewable');
  assert.equal(hits[0].risk,'CRITICAL');
  assert.equal(input.slice(hits[0].start,hits[0].end),hits[0].value);
 }
 assert.equal(detect('ಪಾಸ್‌ವರ್ಡ್: [REDACTED]').filter(f=>f.category==='CREDENTIAL_OR_SECRET').length,0);
 assert.equal(detect('ಸಾಮಾನ್ಯ ಮಾಹಿತಿಯ ಬಗ್ಗೆ ಚರ್ಚೆ.').filter(f=>f.category==='CREDENTIAL_OR_SECRET').length,0);
});

test('exactly 12 Aadhaar digits are candidates or explicit manual-review findings',()=>{
 const text='Aadhaar Number: 1234 5678 9012\nआधार संख्या: ९४०१ ८०२४ ३०१७\nಆಧಾರ್ ಸಂಖ್ಯೆ: ೯೪೦೧ ೮೦೨೪ ೩೦೧೭';
 const hits=detect(text).filter(f=>f.category.startsWith('AADHAAR'));
 assert.ok(hits.length>=3);
 for(const h of hits){assert.equal(text.slice(h.start,h.end),h.value);assert.equal([...h.value].filter(c=>/[0-9०-९೦-೯]/u.test(c)).length,12);}
});
test('16-digit virtual IDs stay distinct from official 12-digit Aadhaar',()=>{
 for(const label of ['VID','BID','Aadhaar Number','Virtual ID','ಆಧಾರ್ ಸಂಖ್ಯೆ']){
  for(const number of ['1234 5678 9012 3456','1234567890123456']){
   const hits=detect(label+': '+number);
   assert.equal(hits.filter(f=>f.category==='AADHAAR_VIRTUAL_ID').length,/^(VID|BID|Virtual ID)$/.test(label)?1:0,label+' '+number);
   assert.ok(!hits.some(f=>f.category==='AADHAAR_CANDIDATE'||f.category==='AADHAAR_REVIEW'),label+' '+number);
  }
 }
});
test('a valid 12-digit Aadhaar and a VID may share a line without hiding Aadhaar',()=>{
 const input='Aadhaar: 1234 5678 9012   VID: 1234 5678 9012 3456';
 const hits=detect(input);
 assert.equal(hits.filter(f=>f.category==='AADHAAR_REVIEW').length,1);
 assert.equal(hits.filter(f=>f.category==='AADHAAR_VIRTUAL_ID').length,1);
});
test('9, 11, 13 and 17 digits are not 12-digit Aadhaar',()=>{
 for(const digits of ['123456789','12345678901','1234567890123','12345678901234567']){
  const hits=detect('Aadhaar Number: '+digits).filter(f=>f.category.startsWith('AADHAAR'));
  assert.ok(hits.every(f=>f.category==='AADHAAR_OCR_REVIEW'&&f.detection_confidence<.5),digits);
  if(digits.length>12)assert.equal(hits.length,0,digits);
 }
});
test('a VID line is not matched as another private numeric category',()=>{
 const text='Aadhaar Number: 1234 5678 9012\nVID: 9107 2702 3707 5395\nBID: 1122 3344 5566 7788\nStudent ID: TEST2026';
 const hits=detect(text);
 assert.ok(hits.some(f=>f.category.startsWith('AADHAAR')));
 assert.ok(hits.some(f=>f.category==='STUDENT_OR_EMPLOYEE_ID'));
 assert.equal(hits.filter(f=>f.category==='AADHAAR_VIRTUAL_ID').length,2);
 assert.ok(!hits.some(f=>f.category==='INDIAN_MOBILE'&&/9107|1122/.test(f.value)));
});
test('phone patterns must not extract substrings from invalid-length or VID fields',()=>{
 const hits=detect('Mobile: +91 9876543210\nPhone: 987654321\nPhone: 98765432101\nVID: 9876543210987654');
 assert.equal(hits.filter(f=>f.category==='INDIAN_MOBILE').length,1);
});
