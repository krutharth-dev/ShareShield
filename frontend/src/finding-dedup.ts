/**
 * Merge repeated observations of ONE physical identifier, not identical
 * values in different source locations. Uncertain ink and broad Kannada
 * context review are not suppressed by this numerical de-duplication.
 */
export type Located={id:string;page:number;category:string;boxes:{x:number;y:number;width:number;height:number}[];
 detection_confidence:number;ocr_confidence?:number;reason:string;validation?:{status:string;method:string;detail:string}};
const group=(s:string)=>{
 if(s==='AADHAAR_NUMBER_REGION_REVIEW')return 'fallback';
 if(s==='AADHAAR_VIRTUAL_ID'||s==='VIRTUAL_ID')return 'virtual-id';
 if(s.startsWith('AADHAAR'))return 'aadhaar';
 if(s==='INDIAN_MOBILE'||s==='MOBILE_NUMBER')return 'mobile';
 if(s.startsWith('BANK_ACCOUNT'))return 'bank-account';
 if(s.startsWith('PAN_'))return 'pan';
 if(s==='EMAIL')return 'email';
 return null;
};
const digits=(s:string)=>[...s].map(ch=>{
 const c=ch.codePointAt(0)!;return c>=0xce6&&c<=0xcef?String(c-0xce6):c>=0x966&&c<=0x96f?String(c-0x966):ch;
}).join('').replace(/[\s.\-:_/]+/g,'').toLowerCase();
const strictlyOverlaps=(a:{x:number;y:number;width:number;height:number},b:typeof a)=>{
 const overlap=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 return a.width>0&&a.height>0&&b.width>0&&b.height>0&&overlap/Math.min(a.width*a.height,b.width*b.height)>.85;
};
const intersects=(a:{x:number;y:number;width:number;height:number},b:typeof a)=>{
 const area=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*
 Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 return area>0&&area/Math.min(a.width*a.height,b.width*b.height)>.35;
};
export function consolidateLocated<T extends Located>(candidates:readonly T[],values:ReadonlyMap<string,string>){
 const kept:T[]=[],removed:string[]=[];let disagreements=0;
 for(const candidate of candidates){
  const family=group(candidate.category);
  // Dedupe repeated *identical* textual observations at the same pixels only.
  // Preserve different Kannada address blocks and all uncertain/unreadable regions.
  if(!family&&candidate.boxes.length&&!/^(UNREADABLE|HANDWRITING|FACE|QR_CODE)/.test(candidate.category)){
   const value=values.get(candidate.id)?.trim().normalize('NFKC');
   if(value&&kept.some(existing=>existing.page===candidate.page&&existing.category===candidate.category&&
    values.get(existing.id)?.trim().normalize('NFKC')===value&&
    existing.boxes.some(a=>candidate.boxes.some(b=>strictlyOverlaps(a,b))))){removed.push(candidate.id);continue;}
  }
  if(!family||!candidate.boxes.length){kept.push(candidate);continue;}
  const index=kept.findIndex(existing=>existing.page===candidate.page&&group(existing.category)===family&&
   existing.boxes.length>0&&existing.boxes.some(a=>candidate.boxes.some(b=>intersects(a,b))));
  if(index<0){kept.push(candidate);continue;}
  const old=kept[index],oldValue=digits(values.get(old.id)??''),incoming=digits(values.get(candidate.id)??'');
  const same=family==='fallback'||(oldValue!==''&&oldValue===incoming);
  if(!same&&family!=='aadhaar'){kept.push(candidate);continue;}
  if(!same&&family==='aadhaar'){
   old.category='AADHAAR_OCR_REVIEW';
   old.detection_confidence=Math.min(old.detection_confidence,.4);
   old.validation={status:'failed',method:'OCR observation consistency',detail:'Overlapping observations disagree; checksum results for individual readings do not confirm the source.'};
   old.reason='Overlapping Aadhaar-like OCR readings disagree. Manually verify the original pixels; no reading is confirmed.';
   disagreements++;
  }else if(family!=='fallback'&&candidate.category===old.category&&
   (candidate.ocr_confidence??candidate.detection_confidence)>(old.ocr_confidence??old.detection_confidence)){
   // Preserve original finding ID and its selected value; only improve location
   // from a stronger observation of the SAME normalized identifier.
   old.boxes=candidate.boxes;
   old.ocr_confidence=candidate.ocr_confidence;
   old.detection_confidence=Math.max(old.detection_confidence,candidate.detection_confidence);
  }
  removed.push(candidate.id);
 }
 return {findings:kept,removedIds:removed,disagreements};
}
