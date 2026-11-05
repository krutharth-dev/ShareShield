import {detect,type Candidate} from './detection.ts';
export type RecognitionResult={candidates:Candidate[];available:boolean;inferenceMs:number;fallback?:string};
type WorkerPort={postMessage:(value:unknown)=>void;terminate:()=>void;onmessage:((event:MessageEvent)=>void)|null;onerror:((event:ErrorEvent)=>void)|null};
/** One worker per analysis/export operation. Terminate in finally; no cross-document cache. */
export function createContextRecognizer(factory:()=>WorkerPort=()=>new Worker(new URL('./context-worker.ts',import.meta.url),{type:'module'}),timeoutMs=15_000){
 let worker:WorkerPort|undefined,sequence=0,closed=false;
 const pending=new Map<number,{resolve:(r:RecognitionResult)=>void;text:string;timer:ReturnType<typeof setTimeout>}>();
 const fallback=(text:string,reason:string):RecognitionResult=>({candidates:detect(text).map(c=>({...c,recognition_source:'deterministic'})),available:false,inferenceMs:0,fallback:reason});
 function stop(reason:string){
  worker?.terminate();worker=undefined;
  for(const [id,p] of pending){clearTimeout(p.timer);pending.delete(id);p.resolve(fallback(p.text,reason));}
 }
 try{
  worker=factory();
  worker.onmessage=event=>{
   const d=event.data,p=pending.get(d?.id);if(!p)return;
   if(d.error||!Array.isArray(d.candidates)||typeof d.available!=='boolean'){stop('Contextual worker failed');return;}
   clearTimeout(p.timer);pending.delete(d.id);p.resolve({candidates:d.candidates,available:d.available,inferenceMs:d.inferenceMs});
  };
  worker.onerror=()=>stop('Contextual worker unavailable');
 }catch{/* Browser Worker unavailable; deterministic fallback below. */}
 return {
  async recognize(text:string):Promise<RecognitionResult>{
   if(closed)throw Error('Recognizer is closed');
   if(text.length>500_000)throw Error('Recognition text exceeds 500,000 characters');
   if(!worker)return fallback(text,'Contextual worker unavailable');
   const id=++sequence;
   return new Promise(resolve=>{
    const timer=setTimeout(()=>stop('Contextual worker timed out'),timeoutMs);
    pending.set(id,{resolve,text,timer});
    try{worker!.postMessage({id,text});}catch{stop('Contextual worker failed');}
   });
  },
  close(){closed=true;stop('Recognition operation closed');}
 };
}
