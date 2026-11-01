import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfTextBoundingBox} from '../src/pdf-text-geometry.ts';
test('maps horizontal PDF text with flipped PDF.js viewport Y to image coordinates',()=>{
 const box=pdfTextBoundingBox([12,0,0,12,30,50],40,12,[2,0,0,-2,0,200],300,200);
 assert.ok(box);
 assert.equal(box.x,60);
 assert.equal(box.y,74.8);
 assert.equal(box.width,80);
 assert.ok(Math.abs(box.height-31.2)<.0001);
});
test('90 degree rotated text uses text-direction transform, not width along X',()=>{
 const box=pdfTextBoundingBox([0,12,-12,0,70,40],30,12,[2,0,0,-2,0,200],300,200);
 assert.ok(box);
 assert.ok(Math.abs(box.x-114.8)<.001);
 assert.ok(Math.abs(box.width-31.2)<.001);
 assert.equal(box.y,60);
 assert.equal(box.height,60);
});
test('fully outside and degenerate text rectangles fail closed',()=>{
 assert.equal(pdfTextBoundingBox([12,0,0,12,-200,40],30,12,[2,0,0,-2,0,200],100,200),null);
 assert.equal(pdfTextBoundingBox([0,0,0,12,30,40],30,12,[2,0,0,-2,0,200],100,200),null);
 assert.equal(pdfTextBoundingBox([12,0,0,12,30,40],NaN,12,[2,0,0,-2,0,200],100,200),null);
});
