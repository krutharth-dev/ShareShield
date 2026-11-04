import test from 'node:test';
import assert from 'node:assert/strict';
import {isVirtualId,selectableFinding,selectableFindingIds} from '../src/selection-policy.ts';
import {priorityForCategory,classifyPriority,requiresManualReview} from '../src/priority.ts';

test('virtual IDs are not selectable or required, while real 12-digit Aadhaar remains',()=>{
 const v={id:'vid',category:'AADHAAR_VIRTUAL_ID'};
 const a={id:'aadhaar',category:'AADHAAR_CANDIDATE'};
 assert.equal(isVirtualId(v),true);
 assert.equal(selectableFinding(v),false);
 assert.equal(selectableFinding({id:'alias',category:'VIRTUAL_ID'}),false);
 assert.deepEqual(selectableFindingIds([v,a]),['aadhaar']);
 assert.equal(priorityForCategory('AADHAAR_VIRTUAL_ID'),null);
 assert.equal(classifyPriority('AADHAAR_VIRTUAL_ID').mandatory,false);
 assert.equal(requiresManualReview({...v,detection_confidence:.1}),false);
 assert.equal(priorityForCategory('AADHAAR_CANDIDATE'),1);
 assert.equal(classifyPriority('AADHAAR_CANDIDATE').mandatory,true);
});
