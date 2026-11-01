import {validAadhaar} from './identifier-validation.ts';
import {explainCandidate} from './finding-explanation.ts';
import {detectExtended} from './extended-detection.ts';
export type Risk = 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'CONTEXT_DEPENDENT';
export type Candidate = {category:string;value:string;start:number;end:number;risk:Risk;detection_confidence:number;reason:string;validation?:import('./identifier-validation.ts').Validation;source_context?:string;confidence_meaning?:string};
export {validAadhaar} from './identifier-validation.ts';
export function detect(text:string):Candidate[]{
 const found:Candidate[]=[];
 const patterns:[string,RegExp,Risk,number,string,number?][]=[
 ['BLOOD_GROUP',/(?:blood\s*(?:group|type)|ರಕ್ತದ?\s*ಗುಂಪು)\s*[:=\-]?\s*((?:AB|A|B|O)\s*(?:[+−-]|positive|negative))(?![A-Za-z])/gi,'MEDIUM',.96,'Explicit blood-group label, not an academic grade',1],
 ['RH_FACTOR',/\b(?:rh\s*(?:factor|type))\s*[:=]?\s*(positive|negative|[+−-])/gi,'MEDIUM',.96,'Explicit Rh-factor label',1],
 ['MEDICAL_RECORD_NUMBER',/\b(?:medical\s*record\s*(?:number|no\.?|id)|MRN|hospital\s*(?:registration|reg)\s*(?:number|no\.?|id))\s*[:#=\-]?\s*([A-Z0-9-]{3,30})/gi,'HIGH',.94,'Explicit medical-record identifier label',1],
 ['PATIENT_ID',/\bpatient\s*(?:id|number|no\.?)\s*[:#=\-]?\s*([A-Z0-9-]{3,30})/gi,'HIGH',.94,'Explicit patient identifier label',1],
  ['HEALTH_INSURANCE_ID',/\b(?:(?:medical|health)\s*insurance(?:\s*policy)?|insurance\s*member)\s*(?:id|number|no\.?)\s*(?:\(synthetic\))?\s*[:#=\-]?\s*([A-Z0-9-]{3,30})/gi,'HIGH',.93,'Explicit medical/health insurance identifier',1],
 ['MEDICAL_CONDITION',/(?:^|\n)\s*(?:diagnosis|diagnoses|medical\s*condition)\s*[:=]\s*([^\n]{2,120})/gim,'MEDIUM',.92,'Labelled diagnosis; semantic completeness is not guaranteed',1],
 ['MEDICATION',/(?:^|\n)\s*(?:medications?|prescription|prescribed\s*medications?)\s*[:=]\s*([^\n]{2,120})/gim,'MEDIUM',.92,'Labelled medication',1],
  ['ALLERGY',/(?:^|\n)\s*(?:(?:known|reported)\s+)?allerg(?:y|ies)\s*[:=]\s*([^\n]{2,120})/gim,'MEDIUM',.92,'Labelled allergy',1],
 ['LAB_RESULT',/(?:^|\n)\s*(?:lab(?:oratory)?\s*results?)\s*[:=]\s*([^\n]{2,120})/gim,'MEDIUM',.9,'Labelled laboratory results',1],
 ['MEDICAL_HISTORY',/(?:^|\n)\s*(?:medical\s*history|emergency\s*medical\s*information|disability)\s*[:=]\s*([^\n]{2,120})/gim,'MEDIUM',.9,'Labelled medical history or disability information',1],
 ['ACADEMIC_RESULT',/\b(?:CGPA|GPA|marks|exam\s*result)\s*[:=]?\s*(\d{1,3}(?:\.\d{1,2})?\s*%?)/gi,'LOW',.95,'Labelled academic result',1],
 ['ACADEMIC_GRADE',/\bgrade\s*[:=]\s*([A-F][+-]?)(?![A-Za-z])/gi,'LOW',.96,'Explicit academic grade; not blood group',1],
 ['CERTIFICATE_NUMBER',/\bcertificate\s*(?:number|no\.?|id)\s*[:#=\-]?\s*([A-Z0-9-]{3,30})/gi,'LOW',.9,'Labelled certificate reference',1],
 ['PASSPORT_NUMBER',/\bpassport\s*(?:number|no\.?)\s*[:#=\-]?\s*([A-Z][0-9]{7})\b/gi,'HIGH',.95,'Labelled Indian passport-shaped identifier',1],
 ['VOTER_ID',/\b(?:voter\s*id|EPIC)\s*[:#=\-]?\s*([A-Z]{3}[0-9]{7})\b/gi,'HIGH',.95,'Labelled voter identifier',1],
 ['DRIVING_LICENCE_NUMBER',/\b(?:driving\s*licen[cs]e|DL)\s*(?:number|no\.?)?\s*[:#=]\s*([A-Z0-9 -]{8,25})/gi,'HIGH',.88,'Labelled licence identifier; review jurisdiction format',1],
 ['EMAIL',/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'MEDIUM',.99,'Email syntax'],
 ['PAN_CANDIDATE',/\b[A-Z]{5}\d{4}[A-Z]\b/gi,'HIGH',.9,'PAN-shaped candidate; not identity validation'],
 ['INDIAN_MOBILE',/(?<![0-9०-९೦-೯])(?:\+91[ \t-]?)?[6-9६-९೬-೯][0-9०-९೦-೯]{9}(?![0-9०-९೦-೯])/gu,'MEDIUM',.91,'Indian mobile number pattern, including Kannada/Hindi digits'],
 ['IFSC',/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi,'HIGH',.97,'IFSC structure'],
 ['UPI_ID',/\b[a-z0-9._-]{2,256}@[a-z][a-z0-9-]{1,63}(?![a-z0-9.-])/gi,'HIGH',.85,'Payment handle candidate'],
  ['BANK_ACCOUNT_CANDIDATE',/(?:bank\s+)?(?:account(?:\s+number|\s+no\.?)?|a\/c|खाता|ಖಾತೆ(?:\s*(?:ಸಂಖ್ಯೆ|ನಂಬರ್))?)(?:\s*\(synthetic\))?\s*[:#：=\-]?\s*([0-9०-९೦-೯]{9,18})(?![0-9०-९೦-೯])/gi,'HIGH',.88,'Explicit bank-account label in English, Hindi or Kannada; not arbitrary numbers',1],
  ['CREDENTIAL_OR_SECRET',/\b(?:(?:temporary|temp)\s+)?(?:api[_ -]?key|access[_-]?token|secret|password|passwd|client[_-]?secret)(?:\s*\(synthetic\))?\s*[:=]\s*["']?([^\s"\'\r\n]{4,256})/gi,'CRITICAL',.97,'Explicit credential or temporary-password label',1],
 ['CREDENTIAL_OR_SECRET',/(?:ತಾತ್ಕಾಲಿಕ[ \t]+)?(?:ಪಾಸ್[\u200c\u200d]?[ \t]*ವರ್ಡ್|ಪಾಸ್ವರ್ಡ್|ಗುಪ್ತ[ \t]*ಪದ|ರಹಸ್ಯ[ \t]*ಪದ)[ \t]*(?:\(ಸಿಂಥೆಟಿಕ್\))?[ \t]*[:：=][ \t]*["']?([^\s"'\r\n]{4,100})/gu,'CRITICAL',.94,'Explicit Kannada password or secret label; review source content',1],
 ['DATE_OF_BIRTH',/(?:date of birth|dob|ಜನ್ಮ\s*ದಿನಾಂಕ|ಹುಟ್ಟಿದ\s*ದಿನಾಂಕ|जन्म तिथि)\s*[:：=\-]?\s*([0-9०-९೦-೯]{1,4}[/.\-][0-9०-९೦-೯]{1,2}[/.\-][0-9०-९೦-೯]{1,4})/gi,'CONTEXT_DEPENDENT',.85,'Explicit date-of-birth label; supports Indian scripts',1],
  ['STUDENT_OR_EMPLOYEE_ID',/(?:\b(?:student\s*(?:application\s*)?id|employee\s*id|USN|roll\s*(?:no|number))|ವಿದ್ಯಾರ್ಥಿ(?:ಯ)?\s*ಗುರುತಿನ\s*ಸಂಖ್ಯೆ)\s*[:#=-]?\s*([A-Z0-9-]{4,30})/gi,'HIGH',.85,'Explicit institutional identifier label in English or Kannada',1],
 ['ENROLMENT_NUMBER',/\b(?:enrolment|enrollment)\s*(?:no|number)\.?\s*[:#-]?\s*(\d{4}\s*\/\s*\d{5}\s*\/\s*\d{5})/gi,'HIGH',.93,'Aadhaar enrolment identifier',1],
  ['PERSON_NAME_REVIEW',/(?:^|\n)[ \t]*(?:(?:student[ \t]+name|full[ \t]+name|applicant[ \t]+name|name[ \t]+of[ \t]+(?:student|candidate|parent|guardian)|name|account[ \t]+holder|father(?:'s)?[ \t]+name|mother(?:'s)?[ \t]+name|parent(?:'s)?[ \t]+name|guardian(?:'s)?[ \t]+name)[ \t]*[:=-][ \t]*|[SDWC]\/O[ \t]*[:=-]?[ \t]*)([^\r\n]{4,65})/gim,'HIGH',.65,'Explicit personal-name label or S/O-D/O relationship; manual identity review',1],
 ['ADDRESSEE_REVIEW',/(?:^|\n)\s*To\s*\n\s*([^\n]{4,65})/gim,'HIGH',.62,'Addressee line; review manually',1],
 ['ADDRESS_REVIEW',/(?:^|\n)\s*((?:No\.?\s*\d{1,5}\b|(?:\d+(?:st|nd|rd|th)?\s+)?(?:Main|Cross|Street|Road|Lane)\b|Near\b|Address\s*:)[^\n]{3,95})/gim,'HIGH',.67,'Address-like line; inspect neighboring lines',1],
 ['POSTAL_CODE_REVIEW',/\b([1-9]\d{5})\b/g,'MEDIUM',.55,'Indian PIN-shaped sequence; context review',1],
 ];
 for(const [category,re,risk,confidence,reason,group] of patterns)for(const m of text.matchAll(re)){const value=m[group??0];const start=m.index!+(group?m[0].lastIndexOf(value):0);if(/^\s*\[REDACTED\]\s*$/i.test(value))continue;
 if(category==='POSTAL_CODE_REVIEW'&&!/(?:\bpin(?:\s*code)?|\bpostal\s*code|\bpostcode)\s*[:=-]?\s*$/i.test(text.slice(Math.max(0,start-40),start)))continue;
 if(category==='INDIAN_MOBILE'){
  const lineStart=text.lastIndexOf('\n',start-1)+1;
  const label=text.slice(lineStart,start).trim();
  if(/(?:\bVID\b|virtual\s*id|aadha(?:ar|r)?|aadhar|bank\s*account|account\s*(?:no|number)|ಖಾತೆ|ಆಧಾರ್|ಆಧಾರ)\s*[:#=\-]?\s*$/iu.test(label))continue;
 }
 if(category==='UPI_ID'&&found.some(f=>f.category==='EMAIL'&&f.start<=start&&f.end>=start+value.length))continue;found.push({category,value,start,end:start+value.length,risk,detection_confidence:confidence,reason});}



 // Recognize labelled month-name birth dates without confusing general exam dates.
 const longFormDOB=/(?:date\s*of\s*birth|dob)\s*[:：=\-]\s*((?:0?[1-9]|[12]\d|3[01])\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(?:19|20)\d{2})\b/giu;
 for(const m of text.matchAll(longFormDOB)){
  const value=m[1],start=m.index!+m[0].lastIndexOf(value);
  found.push({category:'DATE_OF_BIRTH',value,start,end:start+value.length,risk:'CONTEXT_DEPENDENT',detection_confidence:.9,reason:'Explicitly labelled long-form date of birth'});
 }

 // Kannada labels may separate a mobile number into groups. Keep original
 // Unicode offsets so recognized values still map to their source PDF boxes.
 const asciiDigits=(value:string)=>[...value].map(ch=>{
  const cp=ch.codePointAt(0)!;
  if(cp>=0xce6&&cp<=0xcef)return String(cp-0xce6);
  if(cp>=0x966&&cp<=0x96f)return String(cp-0x966);
  return ch;
 }).join('');
 const kannadaLabelledPhone=/(?:ಮೊಬೈಲ್(?:\s*ಸಂಖ್ಯೆ)?|ದೂರವಾಣಿ(?:\s*ಸಂಖ್ಯೆ)?|ಫೋನ್(?:\s*ನಂಬರ್)?)\s*[:：=\-]?\s*((?:\+91[ \t-]?)?(?:[0-9०-९೦-೯][ \t-]?){10})(?![0-9०-९೦-೯])/gu;
 for(const m of text.matchAll(kannadaLabelledPhone)){
  const value=m[1].trimEnd();
  const normalized=asciiDigits(value).replace(/[ \t-]/g,'');
  const subscriber=normalized.startsWith('+91')?normalized.slice(3):normalized;
  if(!/^[6-9][0-9]{9}$/.test(subscriber))continue;
  const start=m.index!+m[0].lastIndexOf(value);
  if(found.some(f=>f.category==='INDIAN_MOBILE'&&f.start===start&&f.end===start+value.length))continue;
  found.push({category:'INDIAN_MOBILE',value,start,end:start+value.length,risk:'MEDIUM',detection_confidence:.89,reason:'Explicit Kannada phone label and valid Indian mobile number shape'});
 }

 // Address blocks in scanned government letters often start with a standalone
 // "To" line. Select the following name/address lines together for explicit review.
 // This is a heuristic: it must never be presented as confirmed identity extraction.
 const lines=text.split('\n');let cursor=0;
 for(let i=0;i<lines.length;i++){
   const line=lines[i];
   if(/^\s*To\s*$/i.test(line)){
     const begin=cursor+line.length+1;let end=begin,linesAdded=0;
     for(let j=i+1;j<Math.min(lines.length,i+12);j++){
       const next=lines[j].trim();
       if(!next||/^(?:signature|signed|your aadhaar|aadhaar no|vid\b|photo|government of india|भारत सरकार)/i.test(next))break;
       if(lines[j].length>140)break;
       end+=lines[j].length+1;linesAdded++;
     }
     if(linesAdded>=2&&end>begin&&text.slice(begin,end).replace(/\[REDACTED\]/gi,'').trim())found.push({category:'PERSONAL_DETAILS_BLOCK',value:text.slice(begin,end).trimEnd(),start:begin,end:end-1,risk:'HIGH',detection_confidence:.64,reason:'Name/address block after addressee; verify all highlighted lines'});
   }
   cursor+=line.length+1;
 }

 // Kannada legal and identity documents: suggest review of party identities,
 // addresses, and age. This is heuristic, not multilingual named-entity recognition.
 // Offsets must remain in original JS string units for PDF/OCR box mapping.
 const kaRole=/^\s*(?:ದೂರುದಾರ(?:ರು)?|ಫಿರ್ಯಾದಿ(?:ಯವರು|ದಾರರು)?|ಪಿರ್ಯಾದಿ|ಅರ್ಜಿದಾರ(?:ರು)?|ಅಪೀಲುದಾರ(?:ರು)?|ಅಪೀಲುದಾರರು|ಆರೋಪ(?:ಿ|ಿಗಳು|ದಾರರು|ದವರು)|ಆಪಾದನಾದಾರರು|ಪ್ರತಿವಾದಿ(?:ಗಳು|ಯವರು)?|ಪ್ರತ್ಯರ್ಥಿ(?:ಗಳು|ಯವರು)?|ರ[ೆಿ]?ಸ್?ಪಾಂಡೆಂಟ(?:ರು|್ಸ್|ು)?|ಉತ್ತರದಾರ(?:ರು)?|ಎದುರುದಾರ(?:ರು)?|ರಕ್ಷಣಾದಾರ(?:ರು)?|ಪ್ರತಿಸ್ಪರ್ಧಿ(?:ಗಳು)?|ವಾದಿ(?:ಗಳು)?|ಪಕ್ಷಕಾರ(?:ರು)?|ಸಾಕ್ಷಿ(?:ಗಳು)?)\s*[:：.\-]?\s*/u;
 const kaLabel=/(?:ಪೂರ್ಣ\s*)?(?:(?:ವಿದ್ಯಾರ್ಥಿಯ|ಪೋಷಕರ)\s*ಹೆಸರು|ವಿದ್ಯಾರ್ಥಿ\s*ಗುರುತಿನ\s*ಸಂಖ್ಯೆ|ಹೆಸರು|ತಂದೆ(?:ಯ)?\s*ಹೆಸರು|ತಾಯಿ(?:ಯ)?\s*ಹೆಸರು|ಪತಿ(?:ಯ)?\s*ಹೆಸರು|ವಿಳಾಸ|ವಾಸಸ್ಥಳ|ವಯಸ್ಸು|ಜನ್ಮ\s*ದಿನಾಂಕ|ದೂರವಾಣಿ(?:\s*ಸಂಖ್ಯೆ)?|ಮೊಬ\s*ೈಲ್(?:\s*ಸಂಖ್ಯೆ)?|ಮೊಬೈಲ್(?:\s*ಸಂಖ್ಯೆ)?|ಖಾತೆ(?:\s*ಸಂಖ್ಯೆ)?)\s*[:：=\-]\s*([^\r\n]{2,100})/gu;
 const kaAddress=/^\s*(?:ಮನೆ\s*ನಂ\.?|ಗ್ರಾಮ|ಹೋಬಳಿ|ತಾಲ್ಲೂಕು|ತಾಲೂಕು|ಜಿಲ್ಲೆ|ಹಾಲಿ\s*ವಾಸ|ವಾಸಿ|ನಿವಾಸಿ|ವಿಳಾಸ|ವಾಸಸ್ಥಳ|ಅಂಚೆ|ರಸ್ತೆ|ಬೀದಿ|ನಗರ|ಪಿನ್\s*ಕೋಡ್)\s*[:：.\-]?\s*[^\r\n]{3,100}/u;
 const kaCase=/(?:ಪ್ರಕರಣ|ದಾವೆ|ಅಪೀಲು|ಕ್ರಿಮಿನಲ್|ಮೊಕದ್ದಮೆ|ನ್ಯಾಯಾಲಯ)[^\n]{0,38}?\b(\d{1,6}\s*\/\s*\d{4})\b/gu;
 const pushKa=(category:string,value:string,start:number,risk:Risk,confidence:number,reason:string)=>{
   if(!value.trim()||/^\s*(?:\[REDACTED\]\s*)+$/i.test(value))return;
   found.push({category,value,start,end:start+value.length,risk,detection_confidence:confidence,reason});
 };
 for(const m of text.matchAll(kaLabel)){
   const val=m[1];pushKa('KANNADA_PERSONAL_DETAIL_REVIEW',val,m.index!+m[0].lastIndexOf(val),'HIGH',.68,'Kannada-labelled personal data; review the complete line');
 }
 for(const m of text.matchAll(kaCase)){
   const val=m[1];pushKa('KANNADA_CASE_REFERENCE_REVIEW',val,m.index!+m[0].lastIndexOf(val),'MEDIUM',.6,'Kannada legal case reference; decide if disclosure is appropriate');
 }
 const kaLines=text.split('\n');let kaOffset=0;
 for(let i=0;i<kaLines.length;i++){
   const line=kaLines[i];const role=line.match(kaRole);
   if(role){
     // Preserve each full party/address block, including its continuation lines.
     // These are review candidates and are never automatically redacted.
     let blockEnd=kaOffset+line.length,blockCursor=blockEnd+1,blockLines=0;
     for(let j=i+1;j<Math.min(i+12,kaLines.length);j++){
       const next=kaLines[j],trimmed=next.trim();
       if(!trimmed||/^(?:v\s*\/\s*s|vs\.?|ವಿರುದ್ಧ|ವಿರುದ್ದ)$/iu.test(trimmed)||
          kaRole.test(next)||next.length>130||blockLines>=10||
          !/[\u0C80-\u0CFF]/u.test(next))break;
       blockEnd=blockCursor+next.length;blockCursor+=next.length+1;blockLines++;
     }
     if(blockLines>=1){
       const firstNonspace=line.search(/\S/u);
       const start=kaOffset+Math.max(0,firstNonspace);
       pushKa('KANNADA_PARTY_ADDRESS_BLOCK_REVIEW',text.slice(start,blockEnd),start,'HIGH',.65,
         'Complete Kannada party details including possible multi-line address; verify all lines');
     }
     const first=line.slice(role[0].length).trim();
     if(first&&first.length<=100&&/[\u0C80-\u0CFF]/u.test(first)){
       const ix=line.indexOf(first,role[0].length);
       pushKa('KANNADA_PARTY_IDENTITY_REVIEW',first,kaOffset+ix,'HIGH',.7,'Named party/complainant/accused: verify before sharing');
     }
     // The next short lines are usually names, relationships, age and address.
     // Stop at narrative paragraphs, another role or the versus separator.
     let cursor=kaOffset+line.length+1,parts=0;
     for(let j=i+1;j<Math.min(i+8,kaLines.length);j++){
       const next=kaLines[j],trimmed=next.trim();
       if(!trimmed||next.length>110||/^(?:v\/s|vs\.?|ವಿರುದ್ಧ|ವಿರುದ್ದ)/iu.test(trimmed)||kaRole.test(next))break;
       if(parts>=6)break;
       if(/[\u0C80-\u0CFF]/u.test(next)){
         pushKa('KANNADA_PARTY_IDENTITY_REVIEW',trimmed,cursor+next.indexOf(trimmed),'HIGH',.62,'Kannada legal party details: name, family, age or address; review manually');
         parts++;
       }
       cursor+=next.length+1;
     }
   }
   if(kaAddress.test(line)&&/[\u0C80-\u0CFF]/u.test(line)){
     const val=line.trim();
     pushKa('KANNADA_ADDRESS_REVIEW',val,kaOffset+line.indexOf(val),'HIGH',.63,'Kannada locality or residential-address line');
   }
   kaOffset+=line.length+1;
 }
 // A missing or mistranscribed respondent label must not cause its second
 // address to be silently skipped. Use the versus divider as a second cue.
 const versus=/^\s*(?:v\s*\/\s*s|vs\.?|ವಿರುದ್ಧ|ವಿರುದ್ದ)\s*$/iu;
 let scanOffset=0;
 for(let i=0;i<kaLines.length;i++){
   const line=kaLines[i],at=scanOffset;
   scanOffset+=line.length+1;
   if(!versus.test(line)||!kaLines.slice(0,i).some(x=>kaRole.test(x)))continue;
   if(found.some(f=>f.category==='KANNADA_PARTY_ADDRESS_BLOCK_REVIEW'&&f.start>at))continue;
   let start=-1,end=-1,offset=scanOffset,count=0;
   for(let j=i+1;j<Math.min(kaLines.length,i+14);j++){
     const next=kaLines[j],trimmed=next.trim();
     if(!trimmed){if(count)break;offset+=next.length+1;continue;}
     if(next.length>130||!/[\u0C80-\u0CFF]/u.test(next))break;
     if(start<0)start=offset+next.search(/\S/u);
     end=offset+next.length;offset+=next.length+1;count++;
   }
   if(count>=2&&start>=0)pushKa('KANNADA_RESPONDENT_ADDRESS_BLOCK_REVIEW',
     text.slice(start,end),start,'HIGH',.55,
     'Potential respondent and multi-line address after versus; confirm against page pixels');
 }
 // Include labelled 16-digit VID/BID as distinct findings; never infer partial 12-digit Aadhaar from them.
 // Standard Aadhaar is exactly 12 digits. Do not carve 12 digits out of a
 // longer space-separated or ungrouped number; preserve source offsets.
 const numericDigit='[0-9०-९೦-೯]';
 const touchesOtherDigits=(start:number,end:number)=>
   new RegExp(numericDigit+'[ \t._:/\\-]{0,6}$','u').test(text.slice(Math.max(0,start-9),start))||
   new RegExp('^[ \t._:/\\-]{0,6}'+numericDigit,'u').test(text.slice(end,end+9));
 const virtualIdField=/(?:\b(?:VID|BID)\b|virtual\s*(?:identification\s*)?id|ವರ್ಚುವಲ್\s*(?:ಐಡಿ|ಗುರುತಿನ\s*ಸಂಖ್ಯೆ))\s*[:#=\-]?\s*((?:[0-9०-९೦-೯][ \t-]?){15}[0-9०-९೦-೯])(?![0-9०-९೦-೯])/giu;
 const virtualIdMatches=[...text.matchAll(virtualIdField)];
 const excludedVirtualRanges=virtualIdMatches.map(m=>({start:m.index!,end:m.index!+m[0].length}));
 for(const m of virtualIdMatches){const value=m[1],start=m.index!+m[0].lastIndexOf(value);
  found.push({category:'AADHAAR_VIRTUAL_ID',value,start,end:start+value.length,risk:'HIGH',detection_confidence:.96,reason:'Labelled 16-digit virtual ID; syntax alone does not validate identity'});
 }
 const inVirtualField=(start:number,end:number)=>
   excludedVirtualRanges.some(range=>start<range.end&&end>range.start);
 const labelledAadhaarDigits=new Set<string>();
 const conflictingField=(start:number)=>/(?:MRN|patient\s*(?:id|number)|medical\s*record\s*(?:number|id)|(?:bank\s*)?account\s*(?:number|no\.?)|card\s*(?:number|no\.?)|student\s*id|USN|order|invoice|ಖಾತೆ|ರೋಗಿಯ?\s*ಸಂಖ್ಯೆ)\s*[:#=\-]?\s*$/iu.test(text.slice(text.lastIndexOf('\n',start-1)+1,start));
 for(const m of text.matchAll(/(?<!\d)(?:\d[ -]?){11}\d(?!\d)/g)){const valid=validAadhaar(m[0]);if(conflictingField(m.index!)||touchesOtherDigits(m.index!,m.index!+m[0].length)||inVirtualField(m.index!,m.index!+m[0].length))continue;const lineStart=text.lastIndexOf('\n',m.index!)+1;const context=text.slice(Math.max(lineStart,m.index!-90),m.index!);const locallyLabelled=/(?:aadha(?:ar|r)?|aadhar|uidai|आधार|ಆಧಾರ್|ಆಧಾರ)/iu.test(context);if(locallyLabelled)labelledAadhaarDigits.add(m[0].replace(/\D/g,''));if(valid||locallyLabelled||labelledAadhaarDigits.has(m[0].replace(/\D/g,'')))found.push({category:valid?'AADHAAR_CANDIDATE':'AADHAAR_REVIEW',value:m[0],start:m.index!,end:m.index!+m[0].length,risk:'HIGH',detection_confidence:valid?.94:.45,reason:valid?'Verhoeff checksum passed; identity not verified':'Aadhaar label but checksum failed; review possible OCR error'});}

 // Review 4-4-4 groups even with OCR separators, Kannada/Devanagari digits,
 // or an unreliable Aadhaar checksum. This intentionally does not authenticate IDs.
 const asciiDigit=(ch:string)=>{
   const cp=ch.codePointAt(0)!;
   return cp>=0x966&&cp<=0x96f?String(cp-0x966):cp>=0xce6&&cp<=0xcef?String(cp-0xce6):ch;
 };
 const aadhaarContext=/(?:aadha(?:ar|r)?|aadhar|uidai|आधार|ಆಧಾರ್|ಆಧಾರ|unique identification)/iu;
 const numberGroup=/(?<![0-9०-९೦-೯])(?:[0-9०-९೦-೯]{4}[\s._:/\-]{0,6}){2}[0-9०-९೦-೯]{4}(?![0-9०-९೦-೯])/gu;
 for(const m of text.matchAll(numberGroup)){
   const digit=m[0].replace(/[०-९೦-೯]/gu,asciiDigit).replace(/\D/g,'');
   if(conflictingField(m.index!)||digit.length!==12||touchesOtherDigits(m.index!,m.index!+m[0].length)||inVirtualField(m.index!,m.index!+m[0].length))continue;
   const valid=validAadhaar(digit);
   const hereStart=text.lastIndexOf('\n',m.index!)+1;
   const hereEnd=text.indexOf('\n',m.index!);
   const near=text.slice(Math.max(hereStart,m.index!-110),Math.min(hereEnd<0?text.length:hereEnd,m.index!+m[0].length+20));
   if(!valid&&!aadhaarContext.test(near)&&!labelledAadhaarDigits.has(digit))continue;
   if(found.some(f=>f.start<=m.index!&&f.end>=m.index!+m[0].length&&f.category.startsWith('AADHAAR')))continue;
   found.push({category:valid?'AADHAAR_CANDIDATE':'AADHAAR_REVIEW',value:m[0],start:m.index!,end:m.index!+m[0].length,risk:'HIGH',detection_confidence:valid?.94:.5,reason:'12-digit Aadhaar-shaped sequence. Verify duplicated or OCR-damaged numbers manually.'});
 }
 // A failed OCR may substitute O/I/l for 0/1. Only interpret these within
 // Aadhaar-labelled text; require a complete grouped 4-4-4 candidate.
 if(aadhaarContext.test(text)){
   const uncertain=/(?<![0-9A-Za-z])(?:[0-9OIlS०-९೦-೯]{4}[\s._:/\-]{1,6}){2}[0-9OIlS०-९೦-೯]{4}(?![0-9A-Za-z])/giu;
   for(const m of text.matchAll(uncertain)){
     if(!aadhaarContext.test(text.slice(text.lastIndexOf('\n',m.index!-1)+1,m.index!))||!/[OIlS]/i.test(m[0])||inVirtualField(m.index!,m.index!+m[0].length))continue;
     if(found.some(f=>f.start<=m.index!&&f.end>=m.index!+m[0].length&&f.category.startsWith('AADHAAR')))continue;
     found.push({category:'AADHAAR_OCR_REVIEW',value:m[0],start:m.index!,end:m.index!+m[0].length,risk:'HIGH',detection_confidence:.4,reason:'Possible Aadhaar digits distorted by OCR. Verify exact pixels manually.'});
   }
 }
 const combined=[...found,...detectExtended(text,found)];
 // A local-number substring inside a +country-code number is not a second phone.
 const phones=combined.filter(f=>f.category==='INTERNATIONAL_PHONE_REVIEW');
 return combined.filter(f=>!(f.category==='INDIAN_MOBILE'&&phones.some(p=>p.start<=f.start&&p.end>=f.end)))
 .filter(f=>!(/^(?:PATIENT_ID|MEDICAL_RECORD_NUMBER)$/.test(f.category)&&/^(?:unknown|unavailable|none|null|missing|not)$/i.test(f.value)))
 .filter(f=>f.category==='AADHAAR_VIRTUAL_ID'||!inVirtualField(f.start,f.end)).sort((a,b)=>a.start-b.start).map(f=>explainCandidate(f,text));
}
export const masked=(value:string)=>value.length<=4?'••••':'••••'+value.slice(-3);
export function verificationStatus(residuals:number,incomplete:boolean){return residuals?'FLAG':incomplete?'UNVERIFIED':'SCOPED_CLEAR';}
