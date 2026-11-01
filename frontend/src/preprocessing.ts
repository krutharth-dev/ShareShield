/** Geometry-preserving local OCR enhancement. Never use this to generate export pixels. */
export type Enhancement='contrast'|'adaptive';
const clamp=(v:number)=>Math.max(0,Math.min(255,Math.round(v)));
export function enhanceRGBA(rgba:Uint8ClampedArray,width:number,height:number,mode:Enhancement):Uint8ClampedArray{
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>12_000_000||rgba.length!==width*height*4)throw Error('Invalid image dimensions');
 const tile=32,cols=Math.ceil(width/tile),rows=Math.ceil(height/tile),sums=new Float64Array(cols*rows),counts=new Uint32Array(cols*rows);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,t=Math.floor(y/tile)*cols+Math.floor(x/tile);
  sums[t]+=.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2];counts[t]++;
 }
 const means=sums.map((s,i)=>s/Math.max(1,counts[i]));
 const result=new Uint8ClampedArray(rgba.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,t=Math.floor(y/tile)*cols+Math.floor(x/tile);
  const gray=.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2];
  const corrected=clamp(245+(gray-means[t])*1.8);
  const v=mode==='adaptive'?(corrected<185?0:255):corrected;
  result[i]=result[i+1]=result[i+2]=v;result[i+3]=255;
 }
 return result;
}
export function enhanceCanvas(source:HTMLCanvasElement,mode:Enhancement):HTMLCanvasElement{
 const result=document.createElement('canvas');result.width=source.width;result.height=source.height;
 const input=source.getContext('2d',{willReadFrequently:true}),ctx=result.getContext('2d');
 if(!input||!ctx)throw Error('Canvas image processing unavailable.');
 const src=input.getImageData(0,0,source.width,source.height);
 ctx.putImageData(new ImageData(enhanceRGBA(src.data,source.width,source.height,mode),source.width,source.height),0,0);
 return result;
}
