import test from 'node:test';
import assert from 'node:assert/strict';
import {qrExportStatus,validateManualRegions} from '../src/verification-policy.ts';
import {verificationStatus} from '../src/detection.ts';

test('unsupported QR scan cannot mark an image/PDF export clear',()=>{
 const state=qrExportStatus(null);
 assert.equal(state,'incomplete');
 assert.equal(verificationStatus(0,state==='incomplete'),'UNVERIFIED');
});
test('zero decoded QR codes is not proof no encoded data remain',()=>{
 const state=qrExportStatus(0);
 assert.equal(state,'incomplete');
 assert.equal(verificationStatus(0,state==='incomplete'),'UNVERIFIED');
});
test('new QR detection on exported pixels flags a residual exposure',()=>{
 const state=qrExportStatus(1);
 assert.equal(state,'failed');
 assert.equal(verificationStatus(1,true),'FLAG');
});
test('invalid detection results are rejected',()=>{
 assert.throws(()=>qrExportStatus(-1),/Invalid/);
 assert.throws(()=>qrExportStatus(1.5),/Invalid/);
});

test('manual pixel redactions cannot point to missing pages or outside their bounds',()=>{
 const pages=[{width:595,height:842},{width:595,height:842}];
 assert.doesNotThrow(()=>validateManualRegions([{page:1,box:{x:50,y:60,width:200,height:100}}],pages));
 assert.throws(()=>validateManualRegions([{page:3,box:{x:50,y:60,width:200,height:100}}],pages),/outside/);
 assert.throws(()=>validateManualRegions([{page:0,box:{x:560,y:30,width:100,height:50}}],pages),/outside/);
 assert.throws(()=>validateManualRegions([{page:0,box:{x:20,y:20,width:0,height:30}}],pages),/outside/);
 assert.throws(()=>validateManualRegions([{page:0.5,box:{x:20,y:20,width:10,height:30}}],pages),/outside/);
});
