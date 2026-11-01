import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detection.ts';
const pages=[
 'Government of India\nAadhaar Number: 1234 5678 9012\nName: Fictional Person\nVID: 1234 5678 9012 3456',
 'ಆಧಾರ್ ಸಂಖ್ಯೆ: ೧೨೩೪ ೫೬೭೮ ೯೦೧೨\nಪ್ರತಿವಾದಿ: ಮಾದರಿ ಹೆಸರು\nಮರುಮುದ್ರಣ Aadhaar: 1234 5678 9012'
];
test('Aadhaar review must retain repeated candidates across page boundaries and scripts',()=>{
 const findings=pages.map((p,page)=>detect(p).filter(f=>f.category.startsWith('AADHAAR')).map(f=>({...f,page}))).flat();
 assert.ok(findings.filter(f=>f.value.includes('1234 5678 9012')).length>=2);
 assert.ok(findings.some(f=>/[೦-೯]/u.test(f.value)));
 assert.ok(!findings.some(f=>f.category==='VIRTUAL_ID'));
 assert.ok(detect(pages[0]).some(f=>f.category==='AADHAAR_VIRTUAL_ID'&&f.value.includes('3456')));
 assert.ok(findings.some(f=>f.page===1));
 for(const f of findings)assert.equal(pages[f.page].slice(f.start,f.end),f.value);
});
test('ambiguous handwriting-like Aadhaar OCR never gets promoted to a verified number',()=>{
 const f=detect('Aadhaar No: 12OI 5O78 9O12');
 assert.ok(f.some(x=>x.category==='AADHAAR_OCR_REVIEW'));
 assert.ok(!f.some(x=>x.category==='AADHAAR_CANDIDATE'));
});
test('legal case references remain human-review candidates rather than blindly redacting every number',()=>{
 const f=detect('ಪ್ರಕರಣ ಸಂಖ್ಯೆ 12/2026\nಹೆಸರು: ಮಾದರಿ ವ್ಯಕ್ತಿ\nCourt room 123456');
 assert.ok(f.some(x=>x.category==='KANNADA_CASE_REFERENCE_REVIEW'));
 assert.ok(!f.some(x=>x.value==='123456'&&x.category.startsWith('AADHAAR')));
});
