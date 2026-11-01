/** Conservative ink-line review for handwritten or unreadable document images.
 * This does not recognize handwriting; it proposes pixel regions for human review.
 * Expects RGBA from a downscaled browser canvas, never uploads image pixels.
 */
export type InkBox={x:number;y:number;width:number;height:number};
export function detectInkLines(pixels:Uint8ClampedArray,width:number,height:number):InkBox[]{
 if(width<80||height<40||pixels.length!==width*height*4)return [];
 const hits=new Uint16Array(height),left=new Int32Array(height),right=new Int32Array(height);
 left.fill(width);
 for(let y=0;y<height;y++){
  for(let x=0;x<width;x++){
   const k=(y*width+x)*4,r=pixels[k],g=pixels[k+1],b=pixels[k+2],alpha=pixels[k+3];
   // Dark print or colored blue/black ink against a white/light page.
   const dark=(r+g+b)<405;
   const blue=b>r*1.15&&b>g*1.08&&r<170&&g<170;
   if(alpha>100&&(dark||blue)){
    hits[y]++;left[y]=Math.min(left[y],x);right[y]=Math.max(right[y],x);
   }
  }
 }
 const threshold=Math.max(5,Math.round(width*.006));
 const intervals:{top:number;bottom:number}[]=[];
 let top=-1,last=-1;
 for(let y=0;y<height;y++){
  const active=hits[y]>=threshold&&hits[y]<width*.8;
  if(active){if(top<0)top=y;last=y;}
  else if(top>=0&&y-last>4){intervals.push({top,bottom:last});top=-1;}
 }
 if(top>=0)intervals.push({top,bottom:last});
 const boxes:InkBox[]=[];
 for(const row of intervals){
  if(row.bottom-row.top<2||row.bottom-row.top>height*.18)continue;
  let minX=width,maxX=0,inkRows=0;
  for(let y=row.top;y<=row.bottom;y++){
   if(hits[y]<threshold||hits[y]>=width*.8)continue;
   minX=Math.min(minX,left[y]);maxX=Math.max(maxX,right[y]);inkRows++;
  }
  if(inkRows<3||maxX-minX<width*.05)continue;
  const padX=Math.max(5,Math.round(width*.018)),padY=Math.max(4,Math.round(height*.008));
  const x=Math.max(0,minX-padX),y=Math.max(0,row.top-padY);
  boxes.push({x,y,width:Math.min(width,maxX+padX+1)-x,height:Math.min(height,row.bottom+padY+1)-y});
 }
 return boxes.slice(0,30);
}
/** Image-only conservative fallback when printed OCR is insufficient. */
export function findInkLineBoxes(canvas:HTMLCanvasElement):InkBox[]{
 const scale=Math.min(1,800/canvas.width,1200/canvas.height);
 const w=Math.max(1,Math.round(canvas.width*scale)),h=Math.max(1,Math.round(canvas.height*scale));
 const mini=document.createElement('canvas');mini.width=w;mini.height=h;
 const ctx=mini.getContext('2d',{willReadFrequently:true});
 if(!ctx)return [];
 ctx.drawImage(canvas,0,0,w,h);
 const rgba=ctx.getImageData(0,0,w,h).data;
 const boxes=detectInkLines(rgba,w,h);
 mini.width=0;mini.height=0;
 return boxes.map(b=>({x:Math.floor(b.x/scale),y:Math.floor(b.y/scale),width:Math.min(canvas.width-Math.floor(b.x/scale),Math.ceil(b.width/scale)),height:Math.min(canvas.height-Math.floor(b.y/scale),Math.ceil(b.height/scale))}));
}

/**
 * Find visually present ink rows that printed OCR has not adequately localized.
 * OCR can return a high average confidence for one readable name while missing
 * a password, email and student ID on other handwritten lines altogether.
 * Horizontal word-box coverage is a heuristic, not handwriting recognition.
 * Every returned region must be manually reviewed before a privacy claim.
 */
export function findUnrecognizedInkLines(inkLines:InkBox[],ocrWordBoxes:InkBox[]):InkBox[]{
 return inkLines.filter(line=>{
  if(line.width<=0||line.height<=0)return false;
  const intervals:[number,number][]=[];
  for(const word of ocrWordBoxes){
   if(word.width<=0||word.height<=0)continue;
   const yOverlap=Math.max(0,Math.min(line.y+line.height,word.y+word.height)-Math.max(line.y,word.y));
   if(yOverlap<Math.min(line.height,word.height)*0.35)continue;
   const left=Math.max(line.x,word.x),right=Math.min(line.x+line.width,word.x+word.width);
   if(right>left)intervals.push([left,right]);
  }
  intervals.sort((a,b)=>a[0]-b[0]);
  let covered=0,left=-1,right=-1;
  for(const [a,b] of intervals){
   if(left<0){left=a;right=b;}
   else if(a<=right)right=Math.max(right,b);
   else{covered+=right-left;left=a;right=b;}
  }
  if(left>=0)covered+=right-left;
  return covered/line.width<0.45;
 });
}


/** Use all OCR passes, not the first page-average score, when deciding which
 * printed/handwritten lines remain unreadable. A confidence score is not proof
 * of semantic correctness; uncertain regions still require visual review.
 */
export type OCRLocatedWord={text:string;confidence?:number;box:InkBox};
export function findUnrecognizedInkLinesAcrossPasses(
 inkLines:InkBox[],passes:readonly (readonly OCRLocatedWord[])[],nativePdfBoxes:readonly InkBox[]=[],
 minimumWordConfidence=.65
):InkBox[]{
 const usable=[...nativePdfBoxes,...passes.flatMap(words=>words
  .filter(word=>Number.isFinite(word.confidence)&&Number(word.confidence)>=minimumWordConfidence&&word.text.trim().length>0)
  .map(word=>word.box))];
 return findUnrecognizedInkLines(inkLines,usable);
}
