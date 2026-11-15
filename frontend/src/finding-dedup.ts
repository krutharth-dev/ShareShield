/**
 * Merge repeated observations of ONE physical identifier, not identical
 * values in different source locations. Uncertain ink and broad Kannada
 * context review are not suppressed by this numerical de-duplication.
 */
export type Located={classification_conflict?:{suggested_category:string;model_version:string};recognition_source?:string;id:string;page:number;category:string;boxes:{x:number;y:number;width:number;height:number}[];
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
// Require mutual coverage of the complete observation, not a shared word.
// A common token in two addresses/IDs must not erase a physical occurrence.
type Region=Located['boxes'][number];
function unionArea(boxes:Region[]){
 const xs=[...new Set(boxes.flatMap(b=>[b.x,b.x+b.width]))].sort((a,b)=>a-b);let area=0;
 for(let i=1;i<xs.length;i++){
  const intervals=boxes.filter(b=>b.x<xs[i]&&b.x+b.width>xs[i-1]).map(b=>[b.y,b.y+b.height]).sort((a,b)=>a[0]-b[0]);
  let start=0,end=0,height=0;
  for(const [a,b] of intervals){if(a>end){height+=end-start;start=a;end=b;}else end=Math.max(end,b);}
  area+=(xs[i]-xs[i-1])*(height+end-start);
 }
 return area;
}
function sameLocation(a:Region[],b:Region[],threshold:number){
 if(!a.length||!b.length)return false;
 const intersections:Region[]=[];
 for(const x of a)for(const y of b){
  const left=Math.max(x.x,y.x),top=Math.max(x.y,y.y);
  const width=Math.min(x.x+x.width,y.x+y.width)-left,height=Math.min(x.y+x.height,y.y+y.height)-top;
  if(width>0&&height>0)intersections.push({x:left,y:top,width,height});
 }
 const overlap=unionArea(intersections);
 return overlap/unionArea(a)>threshold&&overlap/unionArea(b)>threshold;
}
/** Native PDF font metrics include whitespace above/below the actual glyphs.
 * Match one exact native field to a contained OCR line without lowering the
 * overlap threshold for arbitrary OCR observations or multiline fields.
 */
function matchingNativeLine(a:Located,b:Located):Region[]|null{
 if((a.ocr_confidence===undefined)===(b.ocr_confidence===undefined))return null;
 const native=a.ocr_confidence===undefined?a:b,ocr=native===a?b:a;
 if(native.boxes.length!==1||!ocr.boxes.length)return null;
 const n=native.boxes[0],boxes=ocr.boxes;
 if(![n,...boxes].every(r=>Object.values(r).every(Number.isFinite)&&r.width>0&&r.height>0))return null;
 const left=Math.min(...boxes.map(r=>r.x)),right=Math.max(...boxes.map(r=>r.x+r.width));
 const top=Math.min(...boxes.map(r=>r.y)),bottom=Math.max(...boxes.map(r=>r.y+r.height));
 const pad=Math.max(2,n.height*.05);
 if(left<n.x-pad||right>n.x+n.width+pad||top<n.y-pad||bottom>n.y+n.height+pad)return null;
 if(right-left<n.width*.9||bottom-top<n.height*.4)return null;
 if(Math.abs((top+bottom)/2-(n.y+n.height/2))>n.height*.2)return null;
 // Every OCR word must belong to the same physical line.
 if(boxes.some(r=>Math.abs(r.y+r.height/2-(top+bottom)/2)>n.height*.2))return null;
 return native.boxes;
}
export function consolidateLocated<T extends Located>(candidates:readonly T[],values:ReadonlyMap<string,string>){
 const kept:T[]=[],removed:string[]=[];let disagreements=0;
 for(const candidate of [...candidates].sort((a,b)=>Number(a.recognition_source==='trained_ai')-Number(b.recognition_source==='trained_ai'))){
  const family=group(candidate.category);
  // Dedupe repeated *identical* textual observations at the same pixels only.
  // Preserve different Kannada address blocks and all uncertain/unreadable regions.
  if(!family&&candidate.boxes.length&&!/^(UNREADABLE|HANDWRITING|FACE|QR_CODE)/.test(candidate.category)){
   const value=values.get(candidate.id)?.trim().normalize('NFKC');
   const duplicate=value?kept.find(existing=>existing.page===candidate.page&&existing.category===candidate.category&&
    values.get(existing.id)?.trim().normalize('NFKC')===value&&
    sameLocation(existing.boxes,candidate.boxes,.85)):undefined;
   if(duplicate){duplicate.classification_conflict??=candidate.classification_conflict;removed.push(candidate.id);continue;}
  }
  if(!family||!candidate.boxes.length){kept.push(candidate);continue;}
  const identicalValue=(existing:T)=>{
   const value=digits(values.get(existing.id)??'');return value!==''&&value===digits(values.get(candidate.id)??'');
  };
  const index=kept.findIndex(existing=>existing.page===candidate.page&&group(existing.category)===family&&
   (sameLocation(existing.boxes,candidate.boxes,.65)||family==='aadhaar'&&identicalValue(existing)&&matchingNativeLine(existing,candidate)!==null));
  if(index<0){kept.push(candidate);continue;}
  const old=kept[index];old.classification_conflict??=candidate.classification_conflict;
  const oldValue=digits(values.get(old.id)??''),incoming=digits(values.get(candidate.id)??'');
  const same=family==='fallback'||(oldValue!==''&&oldValue===incoming);
  const nativeLine=family==='aadhaar'&&same?matchingNativeLine(old,candidate):null;
  if(nativeLine){
   // Retain the complete, exact native field region; never shrink its mask to
   // OCR glyph estimates or turn a lower-confidence review into auto-approval.
   old.boxes=nativeLine;
   old.detection_confidence=Math.min(old.detection_confidence,candidate.detection_confidence);
   // Keep native provenance (undefined OCR score) for later OCR-pass merging.
   old.ocr_confidence=undefined;
   removed.push(candidate.id);continue;
  }
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
