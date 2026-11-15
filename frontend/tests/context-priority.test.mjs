import test from 'node:test';
import assert from 'node:assert/strict';
import {detect} from '../src/detection.ts';
import {rankGroups,classifyPriority} from '../src/priority.ts';
import {coverageCheck} from '../src/clearance.ts';
test('independent contiguous rankings group occurrences across pages',()=>{
 const groups=rankGroups(['PAN_CANDIDATE','AADHAAR_CANDIDATE','EMAIL','DATE_OF_BIRTH','ACADEMIC_RESULT','ACADEMIC_GRADE','PAN_CANDIDATE'].map((category,i)=>({category,page:i%2})));
 for(const tier of ['HIGH','MEDIUM','LOW'])assert.deepEqual(groups.filter(g=>g.tier===tier).map(g=>g.rank),[1,2]);
 assert.equal(groups[0].category,'AADHAAR_CANDIDATE');assert.equal(groups[1].findings.length,2);
});
test('medical context changes clinical disclosure but retains mandatory identifiers',()=>{
 assert.equal(classifyPriority('BLOOD_GROUP','public').tier,'HIGH');
 assert.equal(classifyPriority('BLOOD_GROUP','medical').tier,'MEDIUM');
 assert.equal(classifyPriority('PATIENT_ID','medical').mandatory,true);
 assert.equal(classifyPriority('ACADEMIC_RESULT','academic').tier,'LOW');
});
test('all eight labelled ABO/Rh types and Unicode minus are recognized, grades are not',()=>{
 for(const value of ['A+','A−','B+','B-','AB+','AB−','O+','O-'])assert.equal(detect('Blood Group: '+value).filter(f=>f.category==='BLOOD_GROUP').length,1,value);
 const found=detect('Grade: A+\nCGPA: 9.2\nBlood Group: AB-\nPatient ID: DEMO123\nDiagnosis: fictional condition');
 assert.equal(found.filter(f=>f.category==='BLOOD_GROUP').length,1);
 assert.ok(found.some(f=>f.category==='ACADEMIC_GRADE'));assert.ok(found.some(f=>f.category==='ACADEMIC_RESULT'));
 assert.ok(found.some(f=>f.category==='PATIENT_ID'));assert.ok(found.some(f=>f.category==='MEDICAL_CONDITION'));
 assert.equal(detect('A+\nGrade: A+\nCGPA: 9.2').some(f=>f.category==='BLOOD_GROUP'),false);
});
test('missing High blocks clearance even if independent OCR subsequently misses it',()=>{
 const f={id:'a',category:'PAN_CANDIDATE',page:1,boxes:[{x:20,y:10,width:80,height:20}],detection_confidence:.95};
 assert.equal(coverageCheck([f],[],[],'public').missingHigh.length,1);
 assert.equal(coverageCheck([f],['a'],[],'public').missingHigh.length,0);
 assert.equal(coverageCheck([f],[],[{page:0,box:{x:0,y:0,width:200,height:100}}],'public').missingHigh.length,1);
 assert.equal(coverageCheck([f],[],[{page:1,box:{x:0,y:0,width:200,height:100}}],'public').missingHigh.length,0);
 assert.equal(coverageCheck([{...f,boxes:[]}],['a'],[],'public').missingHigh.length,0);
 assert.equal(coverageCheck([{...f,boxes:[]}],['a'],[],'public').unresolvedReview.length,1);
 assert.equal(coverageCheck([{...f,boxes:[]}],['a'],[],'public',true).missingHigh.length,0);
});
test('optional fields do not require coverage, uncertain findings cannot disappear from review',()=>{
 const f={id:'m',category:'EMAIL',page:0,boxes:[],detection_confidence:.99};
 assert.equal(coverageCheck([f],[],[],'public',true).missingHigh.length,0);
 assert.equal(coverageCheck([{...f,category:'AADHAAR_REVIEW',detection_confidence:.45}],[],[],'public',true).unresolvedReview.length,1);
});
