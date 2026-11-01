/** Map native PDF.js text items onto the actual rendered canvas.
 * Both text rotation and viewport rotation are represented as affine matrices.
 * Malformed/fully clipped geometry is rejected; its finding remains unlocalized.
 */
export type TextBox={x:number;y:number;width:number;height:number};
export function pdfTextBoundingBox(
 tr:readonly number[],advance:number,height:number,viewport:readonly number[],
 pageWidth:number,pageHeight:number
):TextBox|null{
 if(tr.length!==6||viewport.length!==6||
  ![...tr,...viewport,advance,height,pageWidth,pageHeight].every(Number.isFinite)||
  advance<=0||height<=0||pageWidth<=0||pageHeight<=0)return null;
 const advanceMagnitude=Math.hypot(tr[0],tr[1]),verticalMagnitude=Math.hypot(tr[2],tr[3]);
 if(advanceMagnitude<1e-6||verticalMagnitude<1e-6)return null;
 const ax=tr[0]/advanceMagnitude,ay=tr[1]/advanceMagnitude;
 const nx=tr[2]/verticalMagnitude,ny=tr[3]/verticalMagnitude;
 const points:number[][]=[];
 for(const x of [0,advance])for(const y of [-height*.25,height*1.05]){
  const sx=tr[4]+ax*x+nx*y,sy=tr[5]+ay*x+ny*y;
  points.push([viewport[0]*sx+viewport[2]*sy+viewport[4],viewport[1]*sx+viewport[3]*sy+viewport[5]]);
 }
 const minX=Math.max(0,Math.min(...points.map(p=>p[0]))),maxX=Math.min(pageWidth,Math.max(...points.map(p=>p[0])));
 const minY=Math.max(0,Math.min(...points.map(p=>p[1]))),maxY=Math.min(pageHeight,Math.max(...points.map(p=>p[1])));
 if(maxX-minX<.5||maxY-minY<.5)return null;
 return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}
