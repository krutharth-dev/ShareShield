import test from 'node:test';
import assert from 'node:assert/strict';
import {locateSourceSpan,unscaleBox} from '../src/source-localization.ts';
const box={x:10,y:20,width:80,height:15};
test('partial PDF sentence never becomes an automatic broad mask',()=>{
 const text='Aadhaar: 2345 6789 0124 public note';
 assert.deepEqual(locateSourceSpan({start:9,end:23,value:text.slice(9,23)},[{start:0,end:text.length,text,box}]).boxes,[]);
});
test('one missing OCR group leaves the whole occurrence unlocalized',()=>{
 const span={start:0,end:14,value:'2345 6789 0124'};
 const tokens=[{start:0,end:4,text:'2345',box},{start:10,end:14,text:'0124',box:{...box,x:200}}];
 assert.deepEqual(locateSourceSpan(span,tokens).boxes,[]);
});
test('exact groups retain three distinct original regions without enclosing gaps',()=>{
 const tokens=['2345','6789','0124'].map((text,i)=>({start:i*5,end:i*5+4,text,box:{...box,x:10+i*90},confidence:.9}));
 assert.equal(locateSourceSpan({start:0,end:14,value:'2345 6789 0124'},tokens).boxes.length,3);
});
test('non-integer OCR resize uses exact per-axis inverse',()=>{
 const b=unscaleBox({x:201,y:100,width:402,height:40},1000,499,2001,998);
 assert.equal(b.x,201*1000/2001);assert.equal(b.y,50);assert.equal(b.height,20);
});
import {shouldUpscaleOcr} from '../src/ocr-rescue.ts';
test('small-text rescue is gated by glyph height and pixel budget',()=>{
 assert.equal(shouldUpscaleOcr(740,340,[{box:{height:8}}]),true);
 assert.equal(shouldUpscaleOcr(1100,620,[{box:{height:28}}]),false);
 assert.equal(shouldUpscaleOcr(2000,2000,[{box:{height:8}}]),false);
 assert.equal(shouldUpscaleOcr(370,170,[]),true);
});
