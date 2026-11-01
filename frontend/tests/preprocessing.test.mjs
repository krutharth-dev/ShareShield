import test from 'node:test';
import assert from 'node:assert/strict';
import {enhanceRGBA} from '../src/preprocessing.ts';
test('illumination normalization keeps redaction pixel coordinates intact',()=>{
 const w=64,h=64,p=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,dark=x>8&&x<54&&y>=25&&y<33,v=dark?22:x<32?218:248;
  p[i]=p[i+1]=p[i+2]=v;p[i+3]=255;
 }
 const before=p.slice(),enhanced=enhanceRGBA(p,w,h,'contrast'),binary=enhanceRGBA(p,w,h,'adaptive');
 assert.deepEqual(p,before);assert.equal(enhanced.length,p.length);assert.equal(binary[(29*w+20)*4],0);
 assert.equal(binary[(4*w+20)*4],255);
});
test('rejects invalid coordinates',()=>{
 assert.throws(()=>enhanceRGBA(new Uint8ClampedArray(10),4,4,'contrast'),/dimensions/);
});
