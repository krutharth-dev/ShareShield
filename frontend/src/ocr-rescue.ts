/** Bounded rescue for small printed glyphs; no extra pass on readable full-size text. */
export function shouldUpscaleOcr(width:number,height:number,tokens:readonly {box:{height:number}}[]){
 if(width*height>1_500_000)return false; // 2x remains within the six-megapixel rescue budget.
 const heights=tokens.map(t=>t.box.height).filter(h=>Number.isFinite(h)&&h>0).sort((a,b)=>a-b);
 return heights.length?heights[Math.floor(heights.length/2)]<14:width*height<=500_000;
}
export function upscaleCanvas(source:HTMLCanvasElement){
 const result=document.createElement('canvas');result.width=source.width*2;result.height=source.height*2;
 const ctx=result.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,result.width,result.height);
 ctx.drawImage(source,0,0,result.width,result.height);return result;
}
