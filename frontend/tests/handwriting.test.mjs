import test from 'node:test';
import assert from 'node:assert/strict';
import {detectInkLines,findUnrecognizedInkLines,findUnrecognizedInkLinesAcrossPasses} from '../src/handwriting.ts';
test('proposes each synthetic handwritten dark-ink line, even when OCR returns no words',()=>{
 const w=320,h=220,p=new Uint8ClampedArray(w*h*4);p.fill(255);
 for(const y of [35,80,127,178])for(let dy=0;dy<9;dy++)for(let x=25;x<240;x++){
  if(x%13===0||dy%3===0)continue;
  const i=((y+dy)*w+x)*4;p[i]=43;p[i+1]=35;p[i+2]=119;p[i+3]=255;
 }
 const rows=detectInkLines(p,w,h);
 assert.equal(rows.length,4);
 for(const y of [35,80,127,178])assert.ok(rows.some(b=>b.y<=y&&b.y+b.height>=y+8));
});
test('empty white pages do not produce fabricated handwriting findings',()=>{
 const p=new Uint8ClampedArray(200*100*4);p.fill(255);
 assert.deepEqual(detectInkLines(p,200,100),[]);
});

test('handwritten lines missing from high-confidence partial OCR are flagged',()=>{
 const rows=[35,80,127,178].map(y=>({x:20,y,width:225,height:16}));
 // OCR understands a name on line one but entirely misses other sensitive fields.
 const recognized=[{x:25,y:35,width:210,height:12}];
 const review=findUnrecognizedInkLines(rows,recognized);
 assert.deepEqual(review.map(box=>box.y),[80,127,178]);
});
test('a partially recognized sensitive line still requires review',()=>{
 const ink=[{x:20,y:35,width:225,height:16}];
 const partial=[{x:25,y:35,width:40,height:12},{x:30,y:35,width:30,height:12}];
 assert.equal(findUnrecognizedInkLines(ink,partial).length,1);
});

test('low first-pass Kannada OCR confidence does not flag a line recognized by a later pass',()=>{
 const rows=[{x:10,y:20,width:200,height:20},{x:10,y:80,width:200,height:20}];
 const weak=[{text:'???',confidence:.25,box:{x:10,y:20,width:200,height:20}}];
 const improved=[{text:'ಹೆಸರು: ಕಲ್ಪಿತ',confidence:.91,box:{x:10,y:20,width:195,height:20}}];
 const review=findUnrecognizedInkLinesAcrossPasses(rows,[weak,improved]);
 assert.deepEqual(review.map(b=>b.y),[80]);
});
test('native PDF text can cover a line while low-confidence OCR cannot hide another',()=>{
 const rows=[{x:10,y:20,width:200,height:18},{x:10,y:60,width:200,height:18}];
 const weak=[{text:'garbled',confidence:.30,box:{x:10,y:60,width:200,height:18}}];
 assert.deepEqual(findUnrecognizedInkLinesAcrossPasses(rows,[weak],[{x:10,y:20,width:200,height:18}]).map(b=>b.y),[60]);
 assert.deepEqual(findUnrecognizedInkLinesAcrossPasses(rows,[weak]).map(b=>b.y),[20,60]);
});
