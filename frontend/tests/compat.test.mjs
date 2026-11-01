import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/compat.ts';
test('PDF.js Map compatibility safely computes only absent entries',()=>{
 const map=new Map([['existing',42]]);
 const compute=map.getOrInsertComputed;
 assert.equal(typeof compute,'function');
 assert.equal(compute.call(map,'existing',()=>{throw Error('should not run');}),42);
 assert.equal(compute.call(map,'new',()=>7),7);
 assert.equal(map.get('new'),7);
});
test('Map compatibility does not override callback-inserted values',()=>{
 const map=new Map();
 assert.equal(map.getOrInsertComputed('field',()=>{map.set('field',3);return 4;}),3);
 assert.equal(map.get('field'),3);
});
