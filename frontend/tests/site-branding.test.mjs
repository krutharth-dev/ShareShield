import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('public UI never mentions retired team name',async()=>{
 for(const f of ['Landing.tsx','Workspace.tsx']){
  const s=await readFile(new URL('../src/'+f,import.meta.url),'utf8');
  assert.ok(!s.includes('Team Kalavidharu'),f);
 }
});
