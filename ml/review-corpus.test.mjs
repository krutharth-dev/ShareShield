import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=n=>JSON.parse(readFileSync(new URL(n,import.meta.url)));
test('holdout is frozen; annotations are valid UTF-16 and honestly pending review',()=>{
 const bytes=readFileSync(new URL('./review-holdout.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'2443acfed8ddb2f8f4a880eb10009f0a48e8bb12028b1fe309aca6f59a752406');
 const dev=read('./review-development.json'),test=JSON.parse(bytes),seen=new Set();
 for(const row of [...dev,...test]){
  assert.ok(!seen.has(row.text));seen.add(row.text);assert.equal(row.human_review,'pending');
  for(const s of row.gold){assert.ok(Number.isSafeInteger(s.start)&&s.start>=0&&s.end>s.start&&s.end<=row.text.length);assert.ok(row.text.slice(s.start,s.end).trim());}
 }
 assert.equal(dev.length,36);assert.equal(test.length,42);
 const trainer=readFileSync(new URL('./train.py',import.meta.url),'utf8');assert.ok(!trainer.includes('review-holdout.json'));
});
