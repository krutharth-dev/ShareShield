import {validatePhone} from './identifier-validation.ts';
import type {Candidate,Risk} from './detection.ts';
import {blockFieldRules,contextFieldRules,categoryDefinition} from './category-registry.ts';
const placeholder=/^(?:\[REDACTED\]|[•*]{4,}|null|none|unknown|unavailable|not available|n\/a)$/i;
export function detectContextFields(text:string):Candidate[]{
 const found:Candidate[]=[];
 const add=(category:string,start:number,end:number,risk:Risk,confidence:number,reason:string,extra:Partial<Candidate>={})=>{
  const value=text.slice(start,end);
  if(!value||/^(?:\[REDACTED\]|[•*]{4,})$/i.test(value.trim()))return;
  if(!category.startsWith('CREDENTIAL')&&placeholder.test(value.trim()))return;
  found.push({category,start,end,value,risk,detection_confidence:confidence,reason,...extra});
 };
 for(const rule of contextFieldRules)for(const match of text.matchAll(rule.label)){
  const start=match.index!+match[0].length;
  let lineEnd=text.indexOf('\n',start);if(lineEnd<0)lineEnd=text.length;
  let rest=text.slice(start,lineEnd);
  if(rule.kind==='credential'&&(!rest.trim()||/^[|>][+-]?$/.test(rest.trim()))){
   let pos=lineEnd+1,finish=pos;
   const baseIndent=text.slice(text.lastIndexOf('\n',match.index!-1)+1,match.index!).match(/^[ \t]*/)?.[0].length??0;
   while(pos<text.length){
    let nextEnd=text.indexOf('\n',pos);if(nextEnd<0)nextEnd=text.length;
    const next=text.slice(pos,nextEnd),indent=next.match(/^[ \t]*/)?.[0].length??0;
    if(next.trim()&&(indent<=baseIndent||(!rest.trim()&&/^[ \t]*[A-Za-z][A-Za-z _-]*[:=]/.test(next))))break;
    finish=nextEnd;pos=nextEnd+1;
   }
   if(finish>lineEnd+1)add('CREDENTIAL_FRAGMENT_REVIEW',lineEnd+1,finish,'CRITICAL',.5,'Indented credential value; inspect all continuation lines.',{field_kind:'credential'});
   continue;
  }
  if(!rest.trim())continue;
  if(rule.kind==='numeric'||rule.kind==='phone'){
   const boundary=rest.search(/[ \t]+[A-Za-z][A-Za-z _-]{0,35}[ \t]*[:=]/);
   if(boundary>=0)rest=rest.slice(0,boundary);
  }
  let from=start,end=start,review=false;
  if(rule.kind==='credential'&&(rest[0]==='"'||rest[0]==="'")){
   const quote=rest[0];from++;
   let i=1;for(;i<rest.length;i++){if(rest[i]==='\\'){i++;continue;}if(rest[i]===quote)break;}
   end=start+i;review=i===rest.length;
  }else{
   const pattern=rule.kind==='credential'?/^[^\s"'}]+/:rule.kind==='identifier'?/^[A-Z0-9][A-Z0-9_/.:-]*/i:rule.kind==='phone'?/^[+0-9][0-9 () .-]*/:/^[A-Z0-9][A-Z0-9 \t-]*/i;
   const token=rest.match(pattern)?.[0]?.trimEnd();if(!token)continue;
   end=start+token.length;
  }
  // Do not attach a short scalar match to an adjacent labelled field.
  if(rule.kind==='identifier'&&/^[A-Za-z][A-Za-z ]*:\s*/.test(text.slice(from,end)))continue;
  let category=rule.kind==='phone'&&/^\+91/.test(text.slice(from,end))&&validatePhone(text.slice(from,end)).status==='passed'?'INDIAN_MOBILE':rule.category;
  if(category==='PAYMENT_CARD_REVIEW'&&!/(?:payment|credit|debit)/i.test(match[0])&&text.slice(from,end).replace(/\D/g,'').length<13)category='OTHER_IDENTIFIER_REVIEW';
  add(category,from,end,rule.risk,review?.45:rule.confidence,
   review?'Unclosed quoted credential; inspect the complete source.':'Explicit labelled field; original source span retained.',
   {field_kind:rule.kind,country_hint:rule.countryGroup?match[rule.countryGroup]?.toUpperCase():undefined});
 }
 // Preserve incomplete envelopes as review candidates, even if OCR lost the footer.
 for(const match of text.matchAll(/-----BEGIN ((?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY)-----/g)){
  const start=match.index!,body=start+match[0].length,footer=`-----END ${match[1]}-----`;
  const closing=text.indexOf(footer,body);
  if(closing>=0)continue;
  const blank=text.indexOf('\n\n',body),next=text.indexOf('-----BEGIN ',body);
  const end=Math.min(blank<0?text.length:blank,next<0?text.length:next);
  add('CREDENTIAL_FRAGMENT_REVIEW',start,end,'CRITICAL',.45,'Private-key header without a matching footer; review all remaining key material.',{field_kind:'credential'});
 }
 const lines=text.split('\n');let offset=0;
 for(let i=0;i<lines.length;i++){
  const line=lines[i],at=offset;offset+=line.length+1;
  for(const rule of blockFieldRules){
   const label=line.match(rule.label);if(!label)continue;
   const continuation:{start:number;end:number}[]=[];
   let position=offset;
   for(let j=i+1;j<lines.length;j++){
    const next=lines[j];
    // New fields/headings and blank lines terminate the block. Continuations
    // remain review-only; no claim of understanding clinical or address prose.
    if(!next.trim()||/^[ \t]*[\p{L}][\p{L}\p{N} /()_.-]{0,80}[:=]/u.test(next)||/^\s*#{1,6}\s/.test(next))break;
    continuation.push({start:position+next.search(/\S/),end:position+next.trimEnd().length});
    position+=next.length+1;
   }
   const start=at+label[0].length;
   // Existing short single-line recognizers are preserved without extra noise.
   if(!continuation.length&&line.length-label[0].length<=120)continue;
   add(rule.category,start,at+line.trimEnd().length,'HIGH',.55,'Labelled multiline or long field; review each continuation line.');
   for(const span of continuation)add(rule.category,span.start,span.end,'HIGH',.55,'Continuation of a labelled medical/address field; inspect context.');
  }
 }
 return found;
}
/** Resolve conflicting interpretations of the same field, never identical values elsewhere. */
export function resolveCandidateOverlaps(candidates:Candidate[]):Candidate[]{
 const owners=candidates.filter(f=>f.field_kind);
 const selected=candidates.filter(f=>{
  if(f.category==='OTHER_IDENTIFIER_REVIEW'&&owners.some(g=>g.category!==f.category&&g.field_kind==='identifier'&&g.start===f.start&&g.end===f.end))return false;
  if(candidates.some(g=>g!==f&&g.category===f.category&&g.start<=f.start&&g.end>=f.end&&(g.start<f.start||g.end>f.end)))return false;
  if(!f.field_kind&&owners.some(g=>g.start<=f.start&&g.end>=f.end&&g.category!==f.category&&
   (['aadhaar','phone','pan','ifsc','vid','card'].includes(categoryDefinition(f.category)?.validation??'')||f.category==='COLLEGE_USN_REVIEW')&&
   !(f.category==='PASSPORT_NUMBER'&&g.category==='PASSPORT_NUMBER_REVIEW')))return false;
  return true;
 });
 const result:Candidate[]=[];
 for(const f of selected.sort((a,b)=>a.start-b.start||b.detection_confidence-a.detection_confidence)){
  if(result.some(g=>g.category===f.category&&g.start===f.start&&g.end===f.end))continue;
  if(f.category==='PASSPORT_NUMBER_REVIEW'&&selected.some(g=>g.category==='PASSPORT_NUMBER'&&g.start===f.start&&g.end===f.end))continue;
  result.push(f);
 }
 return result;
}
