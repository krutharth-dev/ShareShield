import test from 'node:test';
import assert from 'node:assert/strict';
import {isVirtualId,selectableFinding,selectableFindingIds} from '../src/selection-policy.ts';
test('mini-project permits users to redact and restore labelled virtual IDs',()=>{
 const v={id:'vid',category:'AADHAAR_VIRTUAL_ID'};
 assert.equal(isVirtualId(v),true);assert.equal(selectableFinding(v),true);
 assert.deepEqual(selectableFindingIds([v,{id:'a',category:'AADHAAR_CANDIDATE'}]),['vid','a']);
});
