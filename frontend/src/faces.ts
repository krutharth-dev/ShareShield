/**
 * Browser-local face detection for the ShareShield review workspace.
 * MediaPipe runtime and model are fetched on first use; image pixels are NEVER uploaded.
 * If dependencies cannot load, the caller must require manual review.
 */
export type FaceRegion={x:number;y:number;width:number;height:number;confidence:number};
type Detection={boundingBox?:{originX:number;originY:number;width:number;height:number};categories?:{score?:number}[]};
type FaceEngine={detect:(image:HTMLCanvasElement)=>{detections:Detection[]}};
const VERSION='0.10.34';
const BASE='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+VERSION;
const MODEL='https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
let engine:Promise<FaceEngine>|undefined;
async function bounded<T>(work:Promise<T>,milliseconds:number):Promise<T>{
 let timeout:ReturnType<typeof setTimeout>|undefined;
 try{
  return await Promise.race([work,new Promise<T>((_,reject)=>{timeout=setTimeout(()=>reject(Error('On-device detector timed out; manual review required.')),milliseconds);})]);
 }finally{if(timeout!==undefined)clearTimeout(timeout);}
}

async function initialize():Promise<FaceEngine>{
 if(!engine)engine=(async()=>{
   // Loading a model is a network request; the document itself is processed only in the browser.
   const mod=await import(/* @vite-ignore */ (BASE+'/vision_bundle.mjs')) as {
     FaceDetector:{createFromOptions:(vision:unknown,opts:unknown)=>Promise<FaceEngine>};
     FilesetResolver:{forVisionTasks:(root:string)=>Promise<unknown>};
   };
   const files=await mod.FilesetResolver.forVisionTasks(BASE+'/wasm');
   return mod.FaceDetector.createFromOptions(files,{baseOptions:{modelAssetPath:MODEL,delegate:'CPU'},runningMode:'IMAGE',minDetectionConfidence:0.45});
 })().catch(error=>{engine=undefined;throw error;});
 return engine;
}
function expand(box:FaceRegion,w:number,h:number):FaceRegion{
 // Pad substantially to cover facial features, hair and the border of ID photographs.
 const x=Math.max(0,Math.floor(box.x-box.width*.28)),y=Math.max(0,Math.floor(box.y-box.height*.32));
 const right=Math.min(w,Math.ceil(box.x+box.width*1.28)),bottom=Math.min(h,Math.ceil(box.y+box.height*1.28));
 return {x,y,width:right-x,height:bottom-y,confidence:box.confidence};
}
function overlap(a:FaceRegion,b:FaceRegion){
 const x=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
 const y=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 return x*y/Math.min(a.width*a.height,b.width*b.height);
}
export async function findFaces(image:HTMLCanvasElement):Promise<FaceRegion[]>{
 const face=await bounded(initialize(),12_000);const found:FaceRegion[]=[];
 function scan(source:HTMLCanvasElement,x:number,y:number,scaleX:number,scaleY:number){
   for(const d of face.detect(source).detections??[]){
     const b=d.boundingBox;if(!b||b.width<=0||b.height<=0)continue;
     const raw={x:x+b.originX*scaleX,y:y+b.originY*scaleY,width:b.width*scaleX,height:b.height*scaleY,confidence:d.categories?.[0]?.score??.6};
     const padded=expand(raw,image.width,image.height);
     if(padded.width>4&&padded.height>4&&!found.some(old=>overlap(old,padded)>.55))found.push(padded);
   }
 }
 scan(image,0,0,1,1);
 // A passport photo occupies a small part of a tall ID scan. Tile tall pages
 // so the tiny portrait remains visible to the 128x128 BlazeFace detector.
 if(image.height/image.width>1.25||image.width>1700){
   const cols=image.width>900?2:1,rows=image.height>1500?4:2;
   for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
     const x=col*image.width/cols,y=row*image.height/rows;
     const w=Math.min(image.width-x,image.width/cols),h=Math.min(image.height-y,image.height/rows);
     const c=document.createElement('canvas');
     c.width=Math.min(650,Math.round(w));c.height=Math.min(650,Math.round(h));
     c.getContext('2d')!.drawImage(image,x,y,w,h,0,0,c.width,c.height);
     scan(c,x,y,w/c.width,h/c.height);c.width=c.height=0;
   }
 }
 return found;
}

type ScannedCode={boundingBox:{x:number;y:number;width:number;height:number};format?:string};
type BarcodeReader=new (settings:{formats:string[]})=>{detect:(image:HTMLCanvasElement)=>Promise<ScannedCode[]>};
/** Returns null if the browser cannot reliably scan QR codes. Never returns decoded payloads. */
export async function findQrCodes(image:HTMLCanvasElement):Promise<FaceRegion[]|null>{
 const ctor=(globalThis as unknown as {BarcodeDetector?:BarcodeReader}).BarcodeDetector;
 if(!ctor)return null;
 try{
   const codes=await bounded(new ctor({formats:['qr_code']}).detect(image),5_000);
   return codes.filter(c=>c.boundingBox&&c.boundingBox.width>0&&c.boundingBox.height>0)
      .map(c=>expand({...c.boundingBox,confidence:1},image.width,image.height));
 }catch{return null;}
}
