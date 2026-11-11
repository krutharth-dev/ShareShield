import {validateManualRegions} from './verification-policy.ts';
type Box={x:number;y:number;width:number;height:number};
type Region={page:number;box:Box};
type Page={width:number;height:number;pointWidth?:number;pointHeight?:number};

/** Snapshot the complete approval set before asynchronous work. No invalid box is skipped. */
export function approvedRegions(findings:readonly {id:string;page:number;boxes:Box[]}[],selected:readonly string[],manual:readonly Region[],pages:readonly Page[]):Region[]{
 const regions=[...findings.filter(f=>selected.includes(f.id)).flatMap(f=>{
  if(!Number.isInteger(f.page)||!pages[f.page])throw Error('Selected finding references an invalid page.');
  return f.boxes.map(box=>({page:f.page,box:{...box}}));
 }),...manual.map(m=>({page:m.page,box:{...m.box}}))];
 validateManualRegions(regions,pages);
 return regions;
}

export function outputDimensions(page:Page):[number,number]{
 const dimensions:[number,number]=[page.pointWidth??page.width/2,page.pointHeight??page.height/2];
 if(!dimensions.every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid output page dimensions.');
 return dimensions;
}

/** Reopened output pixels, independently of the painting loop. Coordinates are source raster pixels. */
export function inspectMaskPixels(data:Uint8ClampedArray,width:number,height:number,source:Page,boxes:readonly Box[]):boolean{
 if(data.length!==width*height*4||width<1||height<1)return false;
 for(const b of boxes){
  const left=Math.floor(b.x*width/source.width),top=Math.floor(b.y*height/source.height);
  const right=Math.ceil((b.x+b.width)*width/source.width),bottom=Math.ceil((b.y+b.height)*height/source.height);
  if(left<0||top<0||right>width||bottom>height||right<=left||bottom<=top)return false;
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   const i=(y*width+x)*4;
   if(data[i]>8||data[i+1]>8||data[i+2]>8||data[i+3]!==255)return false;
  }
 }
 return true;
}

export const DOCUMENT_PIXEL_BUDGET=48_000_000;
export function checkPixelBudget(total:number){
 if(!Number.isFinite(total)||total>DOCUMENT_PIXEL_BUDGET)throw Error('Document exceeds the 48-megapixel workspace budget. Split it into smaller documents.');
}
