import type {Candidate} from './detection.ts';
import {categoryDefinition} from './category-registry.ts';
import {normalizeDigits,validAadhaar,validPan,validIfsc,validatePhone,type Validation} from './identifier-validation.ts';
import {validIbanChecksum,validLuhn} from './extended-detection.ts';

export const CONFIDENCE_MEANING='Heuristic strength of the recognition rule, not a calibrated probability, identity authentication, OCR accuracy, or privacy clearance.';
export function explainCandidate(candidate:Candidate,text:string):Candidate {
 const definition=categoryDefinition(candidate.category);
 let validation:Validation={status:'context_only',method:'label or shape recognition',detail:'No issuer, ownership or semantic authenticity check is available for this field.'};
 const value=normalizeDigits(candidate.value);
 const check=(passed:boolean,method:string,detail:string):Validation=>({status:passed?'passed':'failed',method,detail:detail+' Passing format checks does not establish issuance, ownership or authenticity.'});
 switch(definition?.validation){
  case 'aadhaar': validation=check(validAadhaar(value.replace(/[ \t._:/-]/g,'')),'Aadhaar structure + Verhoeff','Exactly 12 digits, allowed leading digit and Verhoeff checksum.');break;
  case 'vid': validation=check(/^[0-9]{16}$/.test(value.replace(/[ \t-]/g,'')),'VID length','Labelled 16-digit virtual identifier; no Aadhaar checksum is inferred.');break;
  case 'pan': validation=check(validPan(value),'PAN character positions','Five letters, four digits, final letter; fourth character must be a supported holder type.');break;
  case 'ifsc': validation=check(validIfsc(value),'IFSC structure','Four letters, zero in position five, six alphanumeric characters. Branch existence is not checked.');break;
  case 'card': validation=check(validLuhn(value)&&!/^([0-9])\1+$/.test(value.replace(/[ -]/g,'')),'Payment-card length + Luhn','13–19 digits and Luhn checksum; repeated-digit placeholders are rejected.');break;
  case 'iban': validation=check(validIbanChecksum(value),'IBAN mod-97','IBAN syntax and mod-97 only; country-specific BBAN rules and bank existence are not checked.');break;
  case 'phone': validation=validatePhone(value);break;
 }
 const line=text.slice(0,candidate.start).split('\n').length;
 // Do not copy neighbouring private values into explanation metadata.
 const source_context=`Source line ${line}; ${definition?.family??'contextual'} field. See the highlighted original for its label and neighbouring context.`;
 return {...candidate,validation,source_context,confidence_meaning:CONFIDENCE_MEANING,
 detection_confidence:validation.status==='failed'?Math.min(candidate.detection_confidence,.45):definition?.family==='medical_identifier'&&!/[0-9೦-೯]/u.test(candidate.value)?Math.min(candidate.detection_confidence,.55):candidate.detection_confidence};
}
