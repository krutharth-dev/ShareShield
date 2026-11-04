import test from 'node:test';
import assert from 'node:assert/strict';
import {isVirtualId,selectableFinding,selectableFindingIds} from '../src/selection-policy.ts';
import {classifyPriority,needsMandatoryReview,requiresManualReview} from '../src/priority.ts';

test('VID/BID are not available for selection or required redaction',()=>{
 const vid={id:'vid',category:'AADHAAR_VIRTUAL_ID'};
 const alias={id:'alias',category:'VIRTUAL_ID'};
 const aadhaar={id:'a',category:'AADHAAR_CANDIDATE'};
 assert.equal(isVirtualId(vid),true);
 assert.equal(selectableFinding(vid),false);
 assert.equal(selectableFinding(alias),false);
 assert.deepEqual(selectableFindingIds([vid,alias,aadhaar]),['a']);
 assert.equal(needsMandatoryReview('AADHAAR_VIRTUAL_ID'),false);
 assert.equal(requiresManualReview({...vid,detection_confidence:.2}),false);
 assert.equal(classifyPriority('AADHAAR_VIRTUAL_ID').mandatory,false);
 assert.equal(classifyPriority('AADHAAR_CANDIDATE').mandatory,true);
});
