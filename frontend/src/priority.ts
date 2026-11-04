import {isVirtualId} from './selection-policy';
/**
 * ShareShield review queue: the user's preferred category order, NOT a
 * prediction of privacy harm, PII validity, or OCR confidence.
 * Unreadable text / QR / portraits remain separately marked for mandatory
 * manual review and must never be interpreted as automatically cleared.
 */
export const PRIORITY_LABELS = [
  'Aadhaar number',
  'PAN number',
  'Passwords / API keys / tokens',
  'Bank account number',
  'Aadhaar enrolment number',
  'Passport number',
  'UPI / financial payment details',
  'Voter ID',
  'Driving licence',
  'Student / employee ID',
  'Date of birth',
  'Mobile / phone number',
  'Email address',
  'Residential address / PIN',
  'Name / guardian name',
  'Legal case reference / other ID'
] as const;

export type RankedFinding={category:string;page?:number;id?:string};
export function priorityForCategory(input:string):number|null{
 const c=input.trim().toUpperCase();
 if(isVirtualId({category:c}))return null;
 if(c==='ENROLMENT_NUMBER')return 5;
 if(c.startsWith('AADHAAR'))return 1;
 if(c.startsWith('PAN'))return 2;
 if(/^(CREDENTIAL_OR_SECRET|PASSWORD|API_KEY|ACCESS_TOKEN|SECRET_TOKEN|CLIENT_SECRET)$/.test(c))return 3;
 if(c.startsWith('BANK_ACCOUNT'))return 4;
 if(c.startsWith('PASSPORT'))return 6;
 if(c==='UPI_ID'||c==='IFSC'||c.startsWith('PAYMENT_'))return 7;
 if(c.startsWith('VOTER_ID')||c==='EPIC_NUMBER')return 8;
 if(c.startsWith('DRIVING_LICEN')||c.startsWith('DRIVER_LICENSE'))return 9;
 if(c.startsWith('STUDENT_')||c.startsWith('EMPLOYEE_')||c==='USN')return 10;
 if(c==='DATE_OF_BIRTH'||c==='DOB')return 11;
 if(c==='INDIAN_MOBILE'||c.startsWith('PHONE_')||c==='MOBILE_NUMBER')return 12;
 if(c==='EMAIL'||c==='EMAIL_ADDRESS')return 13;
 if(c==='PERSONAL_DETAILS_BLOCK'||c==='ADDRESS_REVIEW'||c==='KANNADA_ADDRESS_REVIEW'||c==='KANNADA_PARTY_ADDRESS_BLOCK_REVIEW'||c==='KANNADA_RESPONDENT_ADDRESS_BLOCK_REVIEW'||c==='POSTAL_CODE_REVIEW'||c.startsWith('RESIDENTIAL_ADDRESS'))return 14;
 if(c==='PERSON_NAME_REVIEW'||c==='ADDRESSEE_REVIEW'||c==='KANNADA_PARTY_IDENTITY_REVIEW'||c.startsWith('GUARDIAN_NAME'))return 15;
 if(c==='KANNADA_CASE_REFERENCE_REVIEW'||c==='LEGAL_CASE_REFERENCE'||c==='OTHER_IDENTIFIER')return 16;
 return null;
}
/** Needs special attention regardless of whether a numerical category exists. */
export function needsMandatoryReview(category:string):boolean{
 const c=category.trim().toUpperCase();
 if(isVirtualId({category:c}))return false;
 return /^(QR_CODE|FACE|PORTRAIT|PHOTO|UNREADABLE_TEXT_LINE_REVIEW|UNREADABLE_PAGE_REVIEW|HANDWRITING_REVIEW|KANNADA_PERSONAL_DETAIL_REVIEW)$/.test(c)||
        c==='AADHAAR_NUMBER_REGION_REVIEW'||c==='AADHAAR_OCR_REVIEW';
}
export function sortByPriority<T extends RankedFinding>(findings:readonly T[]):T[]{
 return findings.map((finding,index)=>({finding,index}))
  .sort((a,b)=>{
   const ra=priorityForCategory(a.finding.category)??(needsMandatoryReview(a.finding.category)?17:18);
   const rb=priorityForCategory(b.finding.category)??(needsMandatoryReview(b.finding.category)?17:18);
   return ra-rb||a.index-b.index;
  }).map(item=>item.finding);
}

export type Tier='HIGH'|'MEDIUM'|'LOW';
export const PURPOSES={public:'General / Public Sharing',academic:'Academic Submission',employment:'Employment Application',identity:'Identity Verification',legal:'Legal Documentation',medical:'Medical / Healthcare Sharing',private:'Internal / Private Sharing'} as const;
export type SharingPurpose=keyof typeof PURPOSES;
export const DEFAULT_CATEGORIES=['AADHAAR_CANDIDATE','PAN_CANDIDATE','CREDENTIAL_OR_SECRET','BANK_ACCOUNT_CANDIDATE','ENROLMENT_NUMBER','PASSPORT_NUMBER','UPI_ID','VOTER_ID','DRIVING_LICENCE_NUMBER','STUDENT_OR_EMPLOYEE_ID','DATE_OF_BIRTH','INDIAN_MOBILE','EMAIL','ADDRESS_REVIEW','PERSON_NAME_REVIEW','LEGAL_CASE_REFERENCE','BLOOD_GROUP','MEDICAL_CONDITION','MEDICAL_RECORD_NUMBER','ACADEMIC_RESULT','CERTIFICATE_NUMBER'];
export function classifyPriority(category:string,purpose:SharingPurpose='public',documentType='general'):{tier:Tier;mandatory:boolean;reason:string;order:number}{
 if(isVirtualId({category}))return {tier:'LOW',mandatory:false,reason:'VID/BID is excluded from the configured redaction and verification scope.',order:99};
 const c=category.toUpperCase();let tier:Tier='MEDIUM';let reason='Personal information: disclosure is optional for the selected purpose.';
 let order=priorityForCategory(c)??(c==='BLOOD_GROUP'?9.1:c.startsWith('MEDICAL_')?9.2:18);
 if(/^(AADHAAR|PAN_|CREDENTIAL|BANK_ACCOUNT|PASSPORT|CARD_NUMBER|MEDICAL_RECORD_NUMBER|PATIENT_ID|HEALTH_INSURANCE_ID|BIOMETRIC)/.test(c)){
  tier='HIGH';reason='Sensitive identifier or credential: removal is required for sharing clearance.';
 }
 if(/^(ACADEMIC_RESULT|ACADEMIC_GRADE|CERTIFICATE_NUMBER|ADMINISTRATIVE_INFO)$/.test(c)){
  tier='LOW';reason='Educational result or certificate reference; optional in this sharing context.';
 }
 if(/^(BLOOD_GROUP|RH_FACTOR|MEDICAL_CONDITION|MEDICATION|ALLERGY|LAB_RESULT|MEDICAL_HISTORY|DISABILITY)/.test(c)){
  if(purpose==='public'){tier='HIGH';reason='Public disclosure of personal health information warrants mandatory redaction.';}
  else if(purpose==='medical'){tier='MEDIUM';reason='May be needed by an authorized healthcare recipient. Confirm the recipient and retain only necessary information.';}
  else{tier='MEDIUM';reason='Health information: review whether this recipient needs it.';}
 }
 if(/^(KANNADA_PARTY_ADDRESS_BLOCK_REVIEW|KANNADA_RESPONDENT_ADDRESS_BLOCK_REVIEW|KANNADA_PARTY_IDENTITY_REVIEW|KANNADA_ADDRESS_REVIEW|KANNADA_PERSONAL_DETAIL_REVIEW|PERSON_NAME_REVIEW|ADDRESS_REVIEW|PERSONAL_DETAILS_BLOCK|ADDRESSEE_REVIEW)$/.test(c)){
  if(purpose==='public'){tier='HIGH';reason='Personal identity or multi-line residential address in a public document: confirm and remove the complete block.';}
  else{tier='MEDIUM';reason='Identifying party or address details: check whether the intended recipient is authorized to receive them.';}
 }
 if(purpose==='public'&&/^(UPI_ID|VOTER_ID|DRIVING_LICEN)/.test(c)){tier='HIGH';reason='Public sharing exposes a financial or government identifier.';}
 if(purpose==='employment'&&/^(ACADEMIC_RESULT|CERTIFICATE_NUMBER|STUDENT_)/.test(c)){reason='May support the application; disclose only what the employer requests.';}
 if(purpose==='legal'&&/CASE_REFERENCE/.test(c))reason='A case reference may be necessary for the authorized legal recipient.';
 if(purpose==='identity'&&tier==='HIGH')reason+=' Identity-verification selection alone does not authorize releasing the full identifier.';
 if(c==='CREDENTIAL_OR_SECRET'&&(documentType==='financial'||purpose==='private'))order=0;
 if(documentType==='medical'&&/^(MEDICAL_RECORD_NUMBER|PATIENT_ID)/.test(c))order=0;
 return {tier,mandatory:tier==='HIGH',reason,order};
}
export function inferDocumentType(findings:readonly RankedFinding[]):string{
 if(findings.some(f=>/^(BLOOD_GROUP|MEDICAL_|PATIENT_ID|ALLERGY|LAB_RESULT)/.test(f.category)))return 'medical';
 if(findings.some(f=>f.category.startsWith('AADHAAR')||f.category.startsWith('PAN_')))return 'identity';
 if(findings.some(f=>/^(BANK_|IFSC|UPI_)/.test(f.category)))return 'financial';
 if(findings.some(f=>/^(KANNADA_PARTY_|KANNADA_RESPONDENT_|KANNADA_CASE_REFERENCE_|LEGAL_CASE_REFERENCE)/.test(f.category)))return 'legal';
 if(findings.some(f=>/^(ACADEMIC_|STUDENT_)/.test(f.category)))return 'academic';return 'general';
}
/** Image ink not reliably read by OCR; keep separate from identified PII. */
export function isUncertainOcrRegion(f:{category:string}):boolean{
 return /^(UNREADABLE_TEXT_LINE_REVIEW|UNREADABLE_PAGE_REVIEW|HANDWRITING_REVIEW)$/.test(f.category.toUpperCase());
}
export function requiresManualReview(f:{category:string;detection_confidence?:number}){
 if(isVirtualId(f))return false;
 return needsMandatoryReview(f.category)||f.category.endsWith('_REVIEW')||(f.detection_confidence!==undefined&&f.detection_confidence<.6);
}
export function rankGroups<T extends RankedFinding>(findings:readonly T[],purpose:SharingPurpose='public'){
 const documentType=inferDocumentType(findings),categories=[...new Set(findings.map(f=>f.category))];
 const counters:Record<Tier,number>={HIGH:0,MEDIUM:0,LOW:0};const tiers:Record<Tier,number>={HIGH:0,MEDIUM:1,LOW:2};
 return categories.map(category=>({category,...classifyPriority(category,purpose,documentType),findings:findings.filter(f=>f.category===category)}))
 .sort((a,b)=>tiers[a.tier]-tiers[b.tier]||a.order-b.order||a.category.localeCompare(b.category))
 .map(g=>({...g,rank:++counters[g.tier]}));
}
