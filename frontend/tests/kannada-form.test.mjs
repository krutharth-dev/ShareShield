import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detection.ts';

test('column-spaced Kannada IDs retain the category and position of each occurrence', () => {
  const text = '📄\nರೋಗಿಯ ಸಂಖ್ಯೆ 4829107\r\nವೈದ್ಯಕೀಯ ದಾಖಲೆ ಸಂಖ್ಯೆ\t4829107\nಪ್ರವೇಶ ಸಂಖ್ಯೆ ೪೮೨೯೧೦೭\nರೋಗಿಯ ಸಂಖ್ಯೆ 4829107';
  for (const [label,category] of [['ರೋಗಿಯ ಸಂಖ್ಯೆ','PATIENT_ID'],['ವೈದ್ಯಕೀಯ ದಾಖಲೆ ಸಂಖ್ಯೆ','MEDICAL_RECORD_NUMBER'],['ಪ್ರವೇಶ ಸಂಖ್ಯೆ','ACADEMIC_ADMISSION_ID']]) {
    const found = detect(text).filter(f => f.category === category);
    assert.equal(found.length, text.split(label).length-1);
    for (const f of found) assert.equal(text.slice(f.start,f.end), f.value);
    assert.equal(new Set(found.map(f=>f.start)).size,found.length);
  }
});

test('spaced patient label cannot consume the next row, prose or part of another ID', () => {
  for (const text of ['ರೋಗಿಯ ಸಂಖ್ಯೆ\n4829107','ರೋಗಿಯ ಸಂಖ್ಯೆ 4829107 pending','ರೋಗಿಯ ಸಂಖ್ಯೆ 4829107-42','ರೋಗಿಯ ಸಂಖ್ಯೆ 1234567890123456','4829107']) {
    assert.ok(!detect(text).some(f=>f.category==='PATIENT_ID'),text);
  }
});
