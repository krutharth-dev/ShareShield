import test from 'node:test';
import assert from 'node:assert/strict';
import {abortable} from '../src/cancellation.ts';
test('cancellation rejects immediately even when an OCR task never settles',async()=>{
 const c=new AbortController();const task=abortable(new Promise(()=>{}),c.signal);c.abort();
 await assert.rejects(task,{name:'AbortError'});
});
test('completed and failed work retain results without cancellation',async()=>{
 const c=new AbortController();assert.equal(await abortable(Promise.resolve(42),c.signal),42);
 await assert.rejects(abortable(Promise.reject(Error('OCR failure')),c.signal),/OCR failure/);
});
