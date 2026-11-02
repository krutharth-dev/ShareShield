import {normalizeDetectionSource} from './detection-normalization.ts';
import type {Candidate} from './detection.ts';
import {categoryDefinition} from './category-registry.ts';
import {validAadhaar,validPan,validIfsc,validatePhone,validateIban,type Validation} from './identifier-validation.ts';
import {validLuhn} from './extended-detection.ts';

export const CONFIDENCE_MEANING='Heuristic strength of the recognition rule, not a calibrated probability, identity authentication, OCR accuracy, or privacy clearance.';
export function explainCandidate(candidate:Candidate,text:string):Candidate {
 const definition=categoryDefinition(candidate.category);
 let validation:Validation={status:'context_only',method:'label or shape recognition',detail:'No issuer, ownership or semantic authenticity check is available for this field.'};
 const value=normalizeDetectionSource(candidate.value).text;
 const check=(passed:boolean,method:string,detail:string):Validation=>({status:passed?'passed':'failed',method,detail:detail+' Passing format checks does not establish issuance, ownership or authenticity.'});
 switch(definition?.validation){
  case 'aadhaar': validation=check(validAadhaar(value.replace(/[ \t._:/-]/g,'')),'Aadhaar structure + Verhoeff','Exactly 12 digits, allowed leading digit and Verhoeff checksum.');break;
  case 'vid': validation=check(/^[0-9]{16}$/.test(value.replace(/[ \t-]/g,'')),'VID length','Labelled 16-digit virtual identifier; no Aadhaar checksum is inferred.');break;
  case 'pan': validation=check(validPan(value),'PAN character positions','Five letters, four digits, final letter; fourth character must be a supported holder type.');break;
  case 'ifsc': validation=check(validIfsc(value),'IFSC structure','Four letters, zero in position five, six alphanumeric characters. Branch existence is not checked.');break;
  case 'bank': validation=check(/^[0-9]{9,18}$/.test(value.replace(/[ \t-]/g,'')),'Labelled bank-account structure','Supported numeric account format is 9–18 digits. Institution-specific rules are not checked.');break;
  case 'card': validation=check(validLuhn(value)&&!/^([0-9])\1+$/.test(value.replace(/[ -]/g,'')),'Payment-card length + Luhn','13–19 digits and Luhn checksum; repeated-digit placeholders are rejected.');break;
  case 'iban': validation=validateIban(value);break;
  case 'phone': validation=validatePhone(value,candidate.category==='INDIAN_MOBILE'?'IN':candidate.country_hint);break;
 }
 const line=text.slice(0,candidate.start).split(/\r\n|\r|\n|\u2028|\u2029/).length;
 // Do not copy neighbouring private values into explanation metadata.
 const source_context=`Source line ${line}; ${definition?.family??'contextual'} field. See the highlighted original for its label and neighbouring context.`;
 return {...candidate,validation,source_context,confidence_meaning:CONFIDENCE_MEANING,
 detection_confidence:validation.status==='failed'||validation.status==='not_checked'?Math.min(candidate.detection_confidence,.45):definition?.family==='medical_identifier'&&!/[0-9೦-೯]/u.test(candidate.value)?Math.min(candidate.detection_confidence,.55):candidate.detection_confidence};
}
