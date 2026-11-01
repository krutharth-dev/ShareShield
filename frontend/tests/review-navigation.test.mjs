import test from 'node:test';
import assert from 'node:assert/strict';
import {nextUnresolvedFinding} from '../src/review-navigation.ts';
const a={id:'a',boxes:[{}]},b={id:'b',boxes:[{}]},c={id:'c',boxes:[{}]},unlocated={id:'unlocated',boxes:[]};
const order=[a,b,c,unlocated];
test('review cycles through located unresolved findings without approving them',()=>{
 const remaining=[a,b,c,unlocated];
 assert.equal(nextUnresolvedFinding(order,remaining),a);
 assert.equal(nextUnresolvedFinding(order,remaining,'a'),b);
 assert.equal(nextUnresolvedFinding(order,remaining,'b'),c);
 assert.equal(nextUnresolvedFinding(order,remaining,'c'),a);
 assert.deepEqual(remaining,[a,b,c,unlocated]);
});
test('covering the current finding preserves forward progress',()=>{
 assert.equal(nextUnresolvedFinding(order,[a,c],'b'),c);
 assert.equal(nextUnresolvedFinding(order,[b],'c'),b);
});
test('empty and unlocalized queues cannot be located; stale cursors restart',()=>{
 assert.equal(nextUnresolvedFinding(order,[],'a'),undefined);
 assert.equal(nextUnresolvedFinding(order,[unlocated]),undefined);
 assert.equal(nextUnresolvedFinding([],[]),undefined);
 assert.equal(nextUnresolvedFinding(order,[b,c],'old-document'),b);
});
