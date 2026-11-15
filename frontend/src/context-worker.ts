import {loadContextModel} from './context-model';
import {detectHybrid} from './hybrid-detection';
// This worker's only network request is a fixed same-origin GET for weights.
// No document strings, values or findings are logged or persisted.
const model=loadContextModel();
self.onmessage=async(event:MessageEvent<{id:number;text:string}>)=>{
 const {id,text}=event.data;
 if(!Number.isSafeInteger(id)||typeof text!=='string'||text.length>500_000){self.postMessage({id,error:'Unsupported recognition request'});return;}
 try{
  const weights=await model,start=performance.now();
  const candidates=detectHybrid(text,weights);
  self.postMessage({id,candidates,available:weights!==null,inferenceMs:performance.now()-start});
 }catch{self.postMessage({id,error:'Contextual recognition failed'});}
};
