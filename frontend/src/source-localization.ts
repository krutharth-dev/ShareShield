/** Exact token provenance. A partial/absent token is not a trusted location. */
export type SourceBox={x:number;y:number;width:number;height:number};
export type SourceToken={text:string;start:number;end:number;box:SourceBox;confidence?:number};
export function locateSourceSpan(span:{start:number;end:number;value:string},tokens:readonly SourceToken[]){
 const matches=tokens.filter(t=>t.end>span.start&&t.start<span.end);
 if(!matches.length)return {boxes:[] as SourceBox[],confidence:undefined};
 const covered=new Uint8Array(span.end-span.start);
 for(const t of matches){
  const a=Math.max(t.start,span.start),b=Math.min(t.end,span.end);
  // PDF text items may contain a whole sentence; masking that entire item
  // would hide neighbours and can make repeated numbers share one box.
  if(t.text.slice(0,a-t.start).trim()||t.text.slice(b-t.start).trim())return {boxes:[] as SourceBox[],confidence:undefined};
  if(!Object.values(t.box).every(Number.isFinite)||t.box.x<0||t.box.y<0||t.box.width<=0||t.box.height<=0)return {boxes:[] as SourceBox[],confidence:undefined};
  for(let i=a;i<b;i++)covered[i-span.start]=1;
 }
 for(let i=0;i<span.value.length;i++)if(!covered[i]&&!/\s/u.test(span.value[i]))return {boxes:[] as SourceBox[],confidence:undefined};
 const scores=matches.flatMap(t=>t.confidence===undefined?[]:[t.confidence]);
 return {boxes:matches.map(t=>t.box),confidence:scores.length?Math.min(...scores):undefined};
}
/** Map resized OCR coordinates back using actual canvas dimensions (rounding included). */
export function unscaleBox(b:SourceBox,sourceWidth:number,sourceHeight:number,ocrWidth:number,ocrHeight:number):SourceBox{
 if(![sourceWidth,sourceHeight,ocrWidth,ocrHeight].every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid OCR transform');
 const sx=sourceWidth/ocrWidth,sy=sourceHeight/ocrHeight;
 return {x:b.x*sx,y:b.y*sy,width:b.width*sx,height:b.height*sy};
}
