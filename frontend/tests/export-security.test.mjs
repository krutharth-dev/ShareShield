import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedRegions,outputDimensions,inspectMaskPixels,checkPixelBudget} from '../src/export-security.ts';
import {autoSelectHighPriority} from '../src/auto-redaction.ts';
const page={width:100,height:100};const box={x:10,y:10,width:20,height:20};
test('all physical selected occurrences survive, including overlaps and manual regions',()=>{
 const findings=Array.from({length:10},(_,i)=>({id:String(i),page:0,boxes:[{...box,y:i*8}]}));
 assert.equal(approvedRegions(findings,findings.map(f=>f.id),[{page:0,box}], [page]).length,11);
});
test('negative, nonfinite, missing page and partially invalid selected regions fail explicitly',()=>{
 for(const finding of [{id:'a',page:1,boxes:[box]},{id:'a',page:-1,boxes:[box]},{id:'a',page:0,boxes:[box,{...box,x:-1}]},{id:'a',page:0,boxes:[{...box,width:NaN}]},{id:'a',page:0,boxes:[{...box,width:101}]}])assert.throws(()=>approvedRegions([finding],['a'],[],[page]));
});
test('approval snapshots cannot be changed during asynchronous reconstruction',()=>{
 const manual=[{page:0,box:{...box}}],regions=approvedRegions([],[],manual,[page]);manual[0].box.x=80;
 assert.equal(regions[0].box.x,10);
});
test('large sheets retain point dimensions when raster scale is below two',()=>{
 assert.deepEqual(outputDimensions({width:3000,height:3000,pointWidth:4000,pointHeight:4000}),[4000,4000]);
});
test('reopened pixel check catches blank, transparent and single-pixel missed regions',()=>{
 const pixels=new Uint8ClampedArray(100*100*4);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
 assert.equal(inspectMaskPixels(pixels,100,100,page,[box]),true);
 pixels[(15*100+15)*4]=255;assert.equal(inspectMaskPixels(pixels,100,100,page,[box]),false);
 pixels[(15*100+15)*4]=0;pixels[(15*100+15)*4+3]=0;assert.equal(inspectMaskPixels(pixels,100,100,page,[box]),false);
});
test('automatic selection rejects mixed-validity and negative boxes and failed validation',()=>{
 const base={id:'a',category:'AADHAAR_CANDIDATE',detection_confidence:.99,boxes:[box]};
 for(const f of [{...base,boxes:[box,{...box,x:-1}]},{...base,validation:{status:'failed'}},{...base,boxes:[box,{...box,width:0}]}])assert.deepEqual(autoSelectHighPriority([f],'public','pdf'),[]);
});
test('aggregate raster budget rejects oversized documents explicitly',()=>{
 assert.doesNotThrow(()=>checkPixelBudget(47_000_000));assert.throws(()=>checkPixelBudget(49_000_000));
});
