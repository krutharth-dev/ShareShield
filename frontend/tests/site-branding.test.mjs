import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('public website and workspace do not display previous team attribution',async()=>{
 for(const file of ['Landing.tsx','Workspace.tsx']){
  const source=await readFile(new URL('../src/'+file,import.meta.url),'utf8');
  assert.ok(!source.includes('Team Kalavidharu'),file+' must not include the retired team attribution');
 }
});
