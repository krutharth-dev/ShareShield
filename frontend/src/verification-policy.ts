/**
 * Export verification is fail-cautious: barcode decoders can miss partially
 * damaged, low-resolution or unsupported QR codes. A zero-result scan is
 * not evidence that all encoded private data has been removed.
 */
export function qrExportStatus(decodedCount:number|null):'failed'|'incomplete'{
 if(decodedCount!==null&&(!Number.isInteger(decodedCount)||decodedCount<0))throw Error('Invalid QR scan count.');
 return decodedCount!==null&&decodedCount>0?'failed':'incomplete';
}

/** Reject every manual box that would be silently skipped or clipped at export. */
export function validateManualRegions(
 regions:readonly {page:number;box:{x:number;y:number;width:number;height:number}}[],
 pages:readonly {width:number;height:number}[]
):void{
 for(const region of regions){
  const p=pages[region.page],b=region.box;
  if(!Number.isInteger(region.page)||!p||!b||
     ![b.x,b.y,b.width,b.height,p.width,p.height].every(Number.isFinite)||
     b.x<0||b.y<0||b.width<=0||b.height<=0||
     b.x+b.width>p.width||b.y+b.height>p.height)
   throw Error('Manual redaction region falls outside its document page.');
 }
}
