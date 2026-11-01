import test from 'node:test';
import assert from 'node:assert/strict';
import {createTextOnlyDocx,readDocx,readZipPart} from '../src/docx.ts';
test('DOCX generated in memory round-trips English, Kannada and Hindi Unicode safely',async()=>{
 const text='Name: Demo Person\nಕನ್ನಡ: ಪರೀಕ್ಷೆ\nहिन्दी: नमूना\nEmail: synthetic@example.test';
 const output=createTextOnlyDocx(text);
 assert.equal(String.fromCharCode(...output.slice(0,2)),'PK');
 assert.equal(await readDocx(output),text);
 assert.ok(!(await readZipPart(output,'word/document.xml')).includes('externalLink'));
});
test('rebuild escapes XML injection and removes original object parts',async()=>{
 const contents='A&B <sample> "quoted" and apostrophe';
 const fresh=createTextOnlyDocx(contents);
 assert.equal(await readDocx(fresh),contents);
 await assert.rejects(readZipPart(fresh,'word/media/image1.png'));
});
test('malformed DOCX does not pretend to be reviewed',async()=>{
 await assert.rejects(readDocx(new Uint8Array([80,75,3,4,0,0])),/DOCX/);
});
