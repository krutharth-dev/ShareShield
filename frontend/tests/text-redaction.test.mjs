import test from 'node:test';
import assert from 'node:assert/strict';
import {redactSelectedSpans} from '../src/text-redaction.ts';
test('only the selected duplicate value is redacted, not every matching copy',()=>{
 const input='PAN: ABCDE1234F\nAudit copy: ABCDE1234F';
 const start=input.indexOf('ABCDE1234F');
 assert.equal(redactSelectedSpans(input,[{start,end:start+10}]),
  'PAN: [REDACTED]\nAudit copy: ABCDE1234F');
});
test('multiple disjoint selections use original source positions',()=>{
 const input='ಹೆಸರು: ಕಲ್ಪಿತ\nDOB: ೨೦-೦೯-೨೦೧೮';
 const nameStart=input.indexOf('ಕಲ್ಪಿತ'),dateStart=input.indexOf('೨೦-೦೯-೨೦೧೮');
 const result=redactSelectedSpans(input,[{start:nameStart,end:nameStart+'ಕಲ್ಪಿತ'.length},{start:dateStart,end:dateStart+'೨೦-೦೯-೨೦೧೮'.length}]);
 assert.equal(result,'ಹೆಸರು: [REDACTED]\nDOB: [REDACTED]');
});
test('overlapping and duplicate spans become one removal',()=>{
 assert.equal(redactSelectedSpans('0123456789',[{start:2,end:6},{start:4,end:8},{start:2,end:6}]),'01[REDACTED]89');
});
test('invalid or stale source spans fail closed',()=>{
 for(const span of [{start:-1,end:2},{start:1,end:1},{start:0,end:8},{start:.5,end:2}]){
  assert.throws(()=>redactSelectedSpans('abcd',[span]),/outside/);
 }
 assert.equal(redactSelectedSpans('unchanged',[]),'unchanged');
});
