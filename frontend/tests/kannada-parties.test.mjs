import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detection.ts';
import {classifyPriority,rankGroups} from '../src/priority.ts';

test('both Kannada legal party addresses are separately proposed with full continuation lines',()=>{
 const document=[
  'ಪ್ರಧಾನ ನ್ಯಾಯಾಲಯ ಹಾಸನ',
  'ಅಪೀಲುದಾರರು:',
  'ಶ್ರೀ ಕಾಲ್ಪನಿಕ ಅರ್ಜಿದಾರ',
  '38 ವರ್ಷ',
  'ಗ್ರಾಮ ಸೂರ್ಯನಗರ',
  'ತಾಲೂಕು ಹಾಸನ',
  'ಮನೆ ನಂ 12',
  'v/s',
  'ಪ್ರತ್ಯರ್ಥಿಗಳು:',
  'ಶ್ರೀಮತಿ ಕಾಲ್ಪನಿಕ ಉತ್ತರದಾರ',
  '40 ವರ್ಷ',
  'ಗ್ರಾಮ ಚಂದ್ರನಗರ',
  'ತಾಲೂಕು ಮೈಸೂರು',
  'ಮನೆ ನಂ 48',
  '',
  'ದಿನಾಂಕ: 20-09-2018 ರಂದು ಅರ್ಜಿ ಸಲ್ಲಿಸಲಾಗಿದೆ.'
 ].join('\n');
 const findings=detect(document);
 const blocks=findings.filter(f=>f.category==='KANNADA_PARTY_ADDRESS_BLOCK_REVIEW');
 assert.equal(blocks.length,2);
 assert.ok(blocks[0].value.includes('ಗ್ರಾಮ ಸೂರ್ಯನಗರ'));
 assert.ok(blocks[0].value.includes('ಮನೆ ನಂ 12'));
 assert.ok(blocks[1].value.includes('ಗ್ರಾಮ ಚಂದ್ರನಗರ'));
 assert.ok(blocks[1].value.includes('ಮನೆ ನಂ 48'));
 assert.ok(blocks[1].start>blocks[0].end);
 for(const b of blocks)assert.equal(document.slice(b.start,b.end),b.value);
 assert.equal(findings.filter(f=>f.category.startsWith('AADHAAR')).length,0);
});
test('versus separator catches the respondent block when its role is lost to OCR',()=>{
 const document=[
  'ಅಪೀಲುದಾರರು:',
  'ಶ್ರೀ ಕಲ್ಪಿತ ವ್ಯಕ್ತಿ',
  'ಗ್ರಾಮ ಸೂರ್ಯನಗರ',
  'v/s',
  'ಶ್ರೀಮತಿ ಕಲ್ಪಿತ ವ್ಯಕ್ತಿ',
  '40 ವರ್ಷ',
  'ಹಾಲಿ ವಾಸ ಮೈಸೂರು',
  'ಗ್ರಾಮ ಚಂದ್ರನಗರ',
  '',
  'ನ್ಯಾಯಾಲಯ ಆದೇಶ'
 ].join('\n');
 const hits=detect(document);
 const second=hits.filter(f=>f.category==='KANNADA_RESPONDENT_ADDRESS_BLOCK_REVIEW');
 assert.equal(second.length,1);
 assert.ok(second[0].value.includes('ಗ್ರಾಮ ಚಂದ್ರನಗರ'));
 assert.ok(!second[0].value.includes('ಸೂರ್ಯನಗರ'));
 for(const x of hits)assert.equal(document.slice(x.start,x.end),x.value);
});
test('a case number is not called Aadhaar merely because a different Aadhaar label exists',()=>{
 const document='Aadhaar No: 1111 2222 3333\nCase record: 1234 5678 9012\n';
 const findings=detect(document);
 assert.ok(findings.some(f=>f.category==='AADHAAR_REVIEW'&&f.value.includes('1111')));
 assert.ok(!findings.some(f=>f.category.startsWith('AADHAAR')&&f.value.includes('1234')));
});
test('addresses and party names have contextual risk and separate priority categories',()=>{
 for(const category of ['KANNADA_PARTY_ADDRESS_BLOCK_REVIEW','KANNADA_RESPONDENT_ADDRESS_BLOCK_REVIEW','KANNADA_ADDRESS_REVIEW','KANNADA_PARTY_IDENTITY_REVIEW']){
  assert.equal(classifyPriority(category,'public').tier,'HIGH');
  assert.equal(classifyPriority(category,'legal').tier,'MEDIUM');
 }
 const g=rankGroups([
  {category:'KANNADA_PARTY_ADDRESS_BLOCK_REVIEW'},
  {category:'KANNADA_RESPONDENT_ADDRESS_BLOCK_REVIEW'},
  {category:'AADHAAR_REVIEW'}
 ],'public');
 assert.equal(g.length,3);
 assert.ok(g.every(x=>x.tier==='HIGH'));
});

test('court document transliterated respondent label is a separate complete block',()=>{
 const document=[
  'ಅಪೀಲುದಾರರು:',
  'ಶ್ರೀ ಕಲ್ಪಿತ ಹೆಸರು',
  'ಗ್ರಾಮ ಸೂರ್ಯನಗರ',
  'ಹಾಸನ ಜಿಲ್ಲೆ',
  'v/s',
  'ರೆಸ್ಪಾಂಡೆಂಟರು :',
  'ಶ್ರೀಮತಿ ಕಲ್ಪಿತ ವ್ಯಕ್ತಿ',
  '38 ವರ್ಷ',
  'ಉದೇವಾರ ಗ್ರಾಮ',
  'ಸಕಲೇಶಪುರ ತಾಲೂಕು ಹಾಸನ ಜಿಲ್ಲೆ',
  'ಹಾಲಿವಾಸ,',
  'ತಣೀರು ಹಳ್ಳ',
  'ಸಿದ್ಧೇಶ್ವರ ಕಾಲೇಜು ಹತ್ತಿರ ಹಾಸನ.',
  '',
  'ದಂಡ ಪ್ರಕ್ರಿಯಾ ಸಂಹಿತೆ'
 ].join('\n');
 const hits=detect(document);
 const blocks=hits.filter(x=>x.category==='KANNADA_PARTY_ADDRESS_BLOCK_REVIEW');
 assert.equal(blocks.length,2);
 assert.ok(blocks[1].value.includes('ಉದೇವಾರ ಗ್ರಾಮ'));
 assert.ok(blocks[1].value.includes('ಸಿದ್ಧೇಶ್ವರ ಕಾಲೇಜು ಹತ್ತಿರ ಹಾಸನ.'));
 assert.equal(blocks[1].start,document.indexOf('ರೆಸ್ಪಾಂಡೆಂಟರು'));
 for(const hit of blocks)assert.equal(document.slice(hit.start,hit.end),hit.value);
});
