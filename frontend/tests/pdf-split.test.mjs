import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {splitPdfLocally} from '../src/pdf-split.ts';
test('long PDF is segmented into eight-page independent documents',async()=>{
 const pdf=await PDFDocument.create();for(let i=0;i<19;i++)pdf.addPage([200,200]);
 const source=new File([await pdf.save()],'synthetic.pdf',{type:'application/pdf'});
 const parts=await splitPdfLocally(source);
 assert.deepEqual(parts.map(x=>x.name),['synthetic-part-1.pdf','synthetic-part-2.pdf','synthetic-part-3.pdf']);
 const lengths=[];for(const p of parts)lengths.push((await PDFDocument.load(await p.arrayBuffer())).getPageCount());
 assert.deepEqual(lengths,[8,8,3]);
});
test('rejects non-PDF split requests',async()=>{
 await assert.rejects(splitPdfLocally(new File(['hello'],'not.pdf',{type:'application/pdf'})),/signature/i);
});

test('exactly eight pages are supported without splitting',async()=>{
 const pdf=await PDFDocument.create();for(let i=0;i<8;i++)pdf.addPage([200,200]);
 await assert.rejects(splitPdfLocally(new File([await pdf.save()],'eight.pdf',{type:'application/pdf'})),/already fits within the 8-page analysis limit/);
});

test('optional local splitting can handle more than fifty pages without a hard cap',async()=>{
 const pdf=await PDFDocument.create();for(let i=0;i<51;i++)pdf.addPage([200,200]);
 const input=new File([await pdf.save()],'fictional-51-pages.pdf',{type:'application/pdf'});
 const parts=await splitPdfLocally(input);
 assert.equal(parts.length,7);
 const count=[];for(const part of parts)count.push((await PDFDocument.load(await part.arrayBuffer())).getPageCount());
 assert.deepEqual(count,[8,8,8,8,8,8,3]);
});
