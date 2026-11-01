import type {Risk} from './detection.ts';
export type Rule = {
  category: string;
  pattern: RegExp;
  risk: Risk;
  confidence: number;
  reason: string;
};

/** Match the value capture only, not the label; never consume a neighbouring field. */
export const labelledRules: Rule[] = [
  {
    category: 'PATIENT_ID',
    pattern: /(?:ರೋಗಿಯ?\s*(?:ಗುರುತಿನ\s*)?(?:ಸಂಖ್ಯೆ|ಐಡಿ)|patient\s*registration\s*(?:id|no\.?|number))\s*[:：#=\-]\s*([A-Z0-9೦-೯-]{3,30})/giu,
    risk: 'HIGH', confidence: .88, reason: 'Explicit patient identifier label; no issuer verification'
  },
  {
    category: 'MEDICAL_RECORD_NUMBER',
    pattern: /(?:ವೈದ್ಯಕೀಯ\s*(?:ದಾಖಲೆ|ರೆಕಾರ್ಡ್)\s*(?:ಸಂಖ್ಯೆ|ನಂಬರ್)|ಆಸ್ಪತ್ರೆ\s*(?:ನೋಂದಣಿ|ದಾಖಲೆ)\s*ಸಂಖ್ಯೆ)\s*[:：#=\-]\s*([A-Z0-9೦-೯-]{3,30})/giu,
    risk: 'HIGH', confidence: .9, reason: 'Explicit Kannada medical record or hospital registration label'
  },
  {
    category: 'PATIENT_NAME_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:patient\s*name|ರೋಗಿಯ\s*ಹೆಸರು)\s*[:：=\-]\s*([^\r\n]{3,90})/giu,
    risk: 'HIGH', confidence: .68, reason: 'Labelled patient identity; review names against source'
  },
  {
    category: 'MEDICAL_DIAGNOSIS_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:ರೋಗನಿರ್ಣಯ|diagnostic\s*impression)\s*[:：=\-]\s*([^\r\n]{2,180})/giu,
    risk: 'MEDIUM', confidence: .7, reason: 'Labelled clinical diagnosis; clinical interpretation requires review'
  },
  {
    category: 'MEDICAL_TEST_RESULT_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:ಲ್ಯಾಬ್\s*ಫಲಿತಾಂಶ|ಪರೀಕ್ಷೆಯ\s*ಫಲಿತಾಂಶ|ರಕ್ತ\s*ಪರೀಕ್ಷೆ|pathology\s*result)\s*[:：=\-]\s*([^\r\n]{2,180})/giu,
    risk: 'MEDIUM', confidence: .7, reason: 'Labelled laboratory or pathology result; interpretation requires review'
  },
  {
    category: 'CLINICAL_NOTE_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:clinical\s*notes?|ವೈದ್ಯಕೀಯ\s*ಟಿಪ್ಪಣಿ|ಚಿಕಿತ್ಸೆಯ\s*ವಿವರ)\s*[:：=\-]\s*([^\r\n]{3,180})/giu,
    risk: 'MEDIUM', confidence: .67, reason: 'Labelled clinical notes may contain several sensitive details'
  },
  {
    category: 'MEDICAL_PROCEDURE_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:procedure|surgery|operation|ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ)\s*[:：=\-]\s*([^\r\n]{3,180})/giu,
    risk: 'MEDIUM', confidence: .68, reason: 'Labelled treatment or surgery information'
  },
  {
    category: 'ACADEMIC_ADMISSION_ID',
    pattern: /(?:admission\s*(?:no\.?|number|id)|university\s*registration\s*(?:no\.?|number)|examination\s*seat\s*(?:no\.?|number)|ಪ್ರವೇಶ\s*ಸಂಖ್ಯೆ|ನೋಂದಣಿ\s*ಸಂಖ್ಯೆ)\s*[:：#=\-]\s*([A-Z0-9೦-೯/-]{4,30})/giu,
    risk: 'HIGH', confidence: .86, reason: 'Labelled admission, university or examination identifier'
  },
  {
    category: 'EMERGENCY_CONTACT_REVIEW',
    pattern: /(?:^|\n)[ \t]*(?:emergency\s*contact|ತುರ್ತು\s*ಸಂಪರ್ಕ)\s*[:：=\-]\s*([^\r\n]{4,100})/giu,
    risk: 'MEDIUM', confidence: .7, reason: 'Emergency contact may identify another person; review the entire field'
  },
  {
    category: 'VEHICLE_REGISTRATION_REVIEW',
    pattern: /(?:vehicle\s*(?:registration|number|no\.?)|registration\s*plate|ವಾಹನ\s*ಸಂಖ್ಯೆ)\s*[:：#=\-]\s*([A-Z0-9 -]{6,24})/giu,
    risk: 'MEDIUM', confidence: .65, reason: 'Vehicle identifier may be personal depending on its owner and recipient'
  },
  {
    category: 'INSURANCE_POLICY_REVIEW',
    pattern: /(?:insurance\s*policy\s*(?:number|no\.?|id)|ವಿಮೆ\s*(?:ಪಾಲಿಸಿ\s*)?ಸಂಖ್ಯೆ)\s*[:：#=\-]\s*([A-Z0-9/-]{5,32})/giu,
    risk: 'HIGH', confidence: .7, reason: 'Explicit insurance-policy identifier; type and validity not confirmed'
  },
  {
    category: 'INTERNATIONAL_PHONE_REVIEW',
    pattern: /(?:international\s*(?:mobile|phone)|overseas\s*phone|contact\s*number|phone|mobile|telephone|ದೂರವಾಣಿ)\s*[:：=\-][ \t]*(\+[1-9೧-೯][0-9೦-೯ ()-]{7,21})(?![0-9])/giu,
    risk: 'MEDIUM', confidence: .88, reason: 'Explicit international contact label; checked against country numbering-plan metadata, not subscriber ownership'
  }
];


// New recognizers belong here. Category metadata is consumed by validation and
// priority classification; additions need no parallel switch statements in the UI.
labelledRules.push(
 {category:'IFSC',pattern:/\bIFSC(?:\s*code)?\s*[:：=][ \t]*([A-Z0-9]{11})(?![A-Z0-9])/giu,risk:'HIGH',confidence:.9,reason:'Explicit IFSC field; positional structure is checked independently'},
 {category:'LEGAL_CASE_REFERENCE',pattern:/(?:case|docket|FIR)\s*(?:no\.?|number|reference|id)\s*[:：#=\-]\s*([A-Z0-9/.-]{3,40})/giu,risk:'MEDIUM',confidence:.75,reason:'Explicit legal case reference; recipient relevance requires review'},
 {category:'LEGAL_INFORMATION_REVIEW',pattern:/(?:^|\n)[ \t]*(?:legal\s*(?:advice|notes)|privileged\s*communication|settlement\s*terms)\s*[:：=]\s*([^\r\n]{3,180})/giu,risk:'HIGH',confidence:.7,reason:'Labelled confidential legal information; privilege not determined'},
 {category:'BIOMETRIC_INDICATOR_REVIEW',pattern:/(?:^|\n)[ \t]*(?:fingerprint(?:\s*(?:id|template))?|iris\s*(?:id|template)|biometric\s*(?:id|template)|ಬೆರಳಚ್ಚು)\s*[:：=]\s*([^\r\n]{3,180})/giu,risk:'HIGH',confidence:.7,reason:'Textual biometric indicator; does not detect biometric image content'},
 {category:'CONFIDENTIAL_INFORMATION_REVIEW',pattern:/(?:^|\n)[ \t]*(?:confidential\s*(?:notes|information)|trade\s*secret|ಗೌಪ್ಯ\s*ಮಾಹಿತಿ)\s*[:：=]\s*([^\r\n]{3,180})/giu,risk:'HIGH',confidence:.68,reason:'Explicit confidentiality label; confirm scope manually'},
 {category:'ACADEMIC_RECORD_REVIEW',pattern:/(?:^|\n)[ \t]*(?:academic\s*record|disciplinary\s*record|ಶೈಕ್ಷಣಿಕ\s*ದಾಖಲೆ)\s*[:：=]\s*([^\r\n]{3,180})/giu,risk:'MEDIUM',confidence:.75,reason:'Labelled student record; distinguish it from public course descriptions'},
 {category:'MEDICATION',pattern:/(?:^|\n)[ \t]*(?:ಔಷಧಿ|ಔಷಧಗಳು|ಔಷಧ\s*ಚೀಟಿ)\s*[:：=]\s*([^\r\n]{2,120})/gu,risk:'MEDIUM',confidence:.8,reason:'Explicit Kannada medication or prescription label'},
 {category:'CREDENTIAL_OR_SECRET',pattern:/\b(?:authorization\s*:\s*bearer|refresh[_ -]?token\s*[:=]|auth(?:entication)?[_ -]?token\s*[:=])\s*["']?([A-Za-z0-9._~+\/=!-]{4,})/giu,risk:'CRITICAL',confidence:.95,reason:'Explicit bearer, refresh or authentication token label'},
 {category:'CREDENTIAL_OR_SECRET',pattern:/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,risk:'CRITICAL',confidence:.96,reason:'Private-key envelope; key validity not checked'}
);

export type CategoryDefinition = {
 family:string;
 baseRank:number|null;
 validation?:'aadhaar'|'vid'|'pan'|'ifsc'|'card'|'iban'|'phone';
 high?:boolean;
 health?:boolean;
 mandatoryReview?:boolean;
};
export const CATEGORY_REGISTRY:Record<string,CategoryDefinition>={};
function register(categories:string[],definition:CategoryDefinition){
 for(const category of categories)CATEGORY_REGISTRY[category]={...definition};
}
register(['AADHAAR_CANDIDATE','AADHAAR_REVIEW','AADHAAR_OCR_REVIEW','AADHAAR_NUMBER_REGION_REVIEW'],{family:'government',baseRank:1,validation:'aadhaar',high:true});
register(['AADHAAR_VIRTUAL_ID'],{family:'government',baseRank:1,validation:'vid',high:true});
register(['PAN_CANDIDATE'],{family:'government',baseRank:2,validation:'pan',high:true});
register(['CREDENTIAL_OR_SECRET'],{family:'credential',baseRank:3,high:true});
register(['BANK_ACCOUNT_CANDIDATE'],{family:'banking',baseRank:4,high:true});
register(['ENROLMENT_NUMBER'],{family:'government',baseRank:5,high:true});
register(['PASSPORT_NUMBER'],{family:'government',baseRank:6,high:true});
register(['UPI_ID','IFSC','PAYMENT_CARD_REVIEW','IBAN_REVIEW'],{family:'banking',baseRank:7});
CATEGORY_REGISTRY.IFSC.validation='ifsc';
Object.assign(CATEGORY_REGISTRY.PAYMENT_CARD_REVIEW,{validation:'card',high:true});
Object.assign(CATEGORY_REGISTRY.IBAN_REVIEW,{validation:'iban',high:true});
register(['VOTER_ID'],{family:'government',baseRank:8});
register(['DRIVING_LICENCE_NUMBER'],{family:'government',baseRank:9});
register(['STUDENT_OR_EMPLOYEE_ID','ACADEMIC_ADMISSION_ID','COLLEGE_USN_REVIEW'],{family:'institutional',baseRank:10});
register(['DATE_OF_BIRTH'],{family:'identity',baseRank:11});
register(['INDIAN_MOBILE','INTERNATIONAL_PHONE_REVIEW'],{family:'contact',baseRank:12,validation:'phone'});
register(['EMERGENCY_CONTACT_REVIEW'],{family:'contact',baseRank:12});
register(['EMAIL'],{family:'contact',baseRank:13});
register(['ADDRESS_REVIEW','PERSONAL_DETAILS_BLOCK','POSTAL_CODE_REVIEW','KANNADA_ADDRESS_REVIEW','KANNADA_PARTY_ADDRESS_BLOCK_REVIEW','KANNADA_RESPONDENT_ADDRESS_BLOCK_REVIEW'],{family:'address',baseRank:14});
register(['PERSON_NAME_REVIEW','ADDRESSEE_REVIEW','PATIENT_NAME_REVIEW','KANNADA_PARTY_IDENTITY_REVIEW'],{family:'identity',baseRank:15});
register(['LEGAL_CASE_REFERENCE','KANNADA_CASE_REFERENCE_REVIEW','VEHICLE_REGISTRATION_REVIEW','INSURANCE_POLICY_REVIEW'],{family:'other_identifier',baseRank:16});
CATEGORY_REGISTRY.INSURANCE_POLICY_REVIEW.high=true;
register(['MEDICAL_RECORD_NUMBER','PATIENT_ID','HEALTH_INSURANCE_ID'],{family:'medical_identifier',baseRank:null,high:true});
register(['BLOOD_GROUP','RH_FACTOR','MEDICAL_CONDITION','MEDICATION','ALLERGY','LAB_RESULT','MEDICAL_HISTORY','MEDICAL_DIAGNOSIS_REVIEW','MEDICAL_TEST_RESULT_REVIEW','CLINICAL_NOTE_REVIEW','MEDICAL_PROCEDURE_REVIEW'],{family:'health',baseRank:null,health:true});
register(['ACADEMIC_RESULT','ACADEMIC_GRADE','CERTIFICATE_NUMBER','ACADEMIC_RECORD_REVIEW'],{family:'academic',baseRank:null});
register(['LEGAL_INFORMATION_REVIEW','CONFIDENTIAL_INFORMATION_REVIEW'],{family:'confidential',baseRank:16,high:true,mandatoryReview:true});
register(['BIOMETRIC_INDICATOR_REVIEW'],{family:'biometric',baseRank:16,high:true,mandatoryReview:true});
export const categoryDefinition=(category:string)=>CATEGORY_REGISTRY[category.trim().toUpperCase()];

register(['KANNADA_PERSONAL_DETAIL_REVIEW'],{family:'identity',baseRank:null,mandatoryReview:true});
