// Fictional, manually authored by the coding assistant. NOT human-independent annotation.
// Holdout must never be used for fitting, thresholds or proposal tuning.
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dev=[
 ['en','At the hospital, medical record [[MEDICAL_RECORD_NUMBER|4829107]] belongs to this chart.'],
 ['en','The college assigned admission [[ACADEMIC_ADMISSION_ID|5938218]] to the new student.'],
 ['en','Our employee payroll code is [[STUDENT_OR_EMPLOYEE_ID|6049329]].'],
 ['en','Please contact the patient using [[PATIENT_ID|7150430]] for treatment registration.'],
 ['en','The patient has blood type [[BLOOD_GROUP|AB+]].'],
 ['en','The academic grade awarded was [[ACADEMIC_GRADE|B+]].'],
 ['en','The bank savings account for payment is [[BANK_ACCOUNT_CANDIDATE|12345678901]].'],
 ['en','You can telephone her mobile at [[INDIAN_MOBILE|9876543210]].'],
 ['en','The guardian full name is "[[PERSON_NAME_REVIEW|Fictional Mira]]".'],
 ['en','Her residential home address is "[[ADDRESS_REVIEW|42 Fictional Lane]]".'],
 ['en','Send the email to [[EMAIL|fictional@example.test]].'],
 ['en','Her date of birth is [[DATE_OF_BIRTH|12/03/2001]].'],
 ['en','The authentication secret is "[[CREDENTIAL_OR_SECRET|TEST_ONLY_Key42]]".'],
 ['en','The court filed case [[LEGAL_CASE_REFERENCE|CASE/2026/42]] in the confidential register.'],
 ['en','The diagnosis recorded is "[[MEDICAL_CONDITION|fictional condition]]".'],
 ['en','The prescription lists "[[MEDICATION|fictional medicine]]".'],
 ['en','The laboratory result is "[[LAB_RESULT|fictional assay 42]]".'],
 ['en','Public inventory item 8261541 is available.'],
 ['en','The company is "Fictional Systems".'],
 ['en','Unknown reference 9372652 has no stated owner.'],
 ['kn','ಆಸ್ಪತ್ರೆಯ ವೈದ್ಯಕೀಯ ದಾಖಲೆ [[MEDICAL_RECORD_NUMBER|4829107]] ಅನ್ನು ನೋಡಿ.'],
 ['kn','ಕಾಲೇಜಿನ ಪ್ರವೇಶ ಸಂಖ್ಯೆ [[ACADEMIC_ADMISSION_ID|5938218]] ದಾಖಲಿಸಲಾಗಿದೆ.'],
 ['kn','ಉದ್ಯೋಗಿಯ ಸಿಬ್ಬಂದಿ ಗುರುತು [[STUDENT_OR_EMPLOYEE_ID|6049329]] ಆಗಿದೆ.'],
 ['kn','ಚಿಕಿತ್ಸೆಗೆ ರೋಗಿಯ ಸಂಖ್ಯೆ [[PATIENT_ID|7150430]] ಬಳಸಿ.'],
 ['kn','ರಕ್ತದ ಗುಂಪು "[[BLOOD_GROUP|AB+]]" ಎಂದು ದಾಖಲಿಸಲಾಗಿದೆ.'],
 ['kn','ಮನೆಯ ವಿಳಾಸ "[[ADDRESS_REVIEW|42 ಕಾಲ್ಪನಿಕ ರಸ್ತೆ]]" ಆಗಿದೆ.'],
 ['kn','ಪೋಷಕರ ಹೆಸರು "[[PERSON_NAME_REVIEW|ಕಾಲ್ಪನಿಕ ಮೀನಾ]]" ಎಂದು ನಮೂದಿಸಿ.'],
 ['kn','ಬ್ಯಾಂಕ್ ಖಾತೆ [[BANK_ACCOUNT_CANDIDATE|12345678901]] ಪಾವತಿಗೆ ಸೇರಿದೆ.'],
 ['kn','ಸಾರ್ವಜನಿಕ ವಸ್ತುವಿನ ಉಲ್ಲೇಖ 8261541 ಆಗಿದೆ.'],
 ['kn','ಕಂಪನಿಯ ಹೆಸರು "ಕಾಲ್ಪನಿಕ ಸಂಸ್ಥೆ" ಆಗಿದೆ.'],
 ['mixed','ಆಸ್ಪತ್ರೆ medical record [[MEDICAL_RECORD_NUMBER|4829107]] was retrieved.'],
 ['mixed','ಕಾಲೇಜು admission [[ACADEMIC_ADMISSION_ID|5938218]] has been approved.'],
 ['mixed','ಉದ್ಯೋಗಿ payroll code [[STUDENT_OR_EMPLOYEE_ID|6049329]] is private.'],
 ['mixed','ಪೋಷಕರ name "[[PERSON_NAME_REVIEW|Fictional Meena]]" was supplied.'],
 ['mixed','ಮನೆಯ address "[[ADDRESS_REVIEW|43 Fictional Road]]" is confidential.'],
 ['mixed','Public reference ಸಂಖ್ಯೆ 9372652 is unrelated.'],
];
const holdout=[
 ['en','This clinical chart can be retrieved with medical record [[MEDICAL_RECORD_NUMBER|8631042]].'],
 ['en','University admission [[ACADEMIC_ADMISSION_ID|9742153]] is recorded for the applicant.'],
 ['en','Payroll lists employee [[STUDENT_OR_EMPLOYEE_ID|3853264]] as active.'],
 ['en','A patient was registered for care under [[PATIENT_ID|4964375]].'],
 ['en','Transfusion notes give blood group "[[BLOOD_GROUP|O-]]".'],
 ['en','The examination grade was "[[ACADEMIC_GRADE|A+]]".'],
 ['en','Deposit funds into bank account [[BANK_ACCOUNT_CANDIDATE|23456789012]].'],
 ['en','A telephone callback is possible on [[INDIAN_MOBILE|8765432109]].'],
 ['en','The applicant is named "[[PERSON_NAME_REVIEW|Fictional Ravi]]".'],
 ['en','Letters should go to the residential address "[[ADDRESS_REVIEW|55 Invented Street]]".'],
 ['en','Write to [[EMAIL|another@example.test]] for the fictional contact.'],
 ['en','DOB: [[DATE_OF_BIRTH|21/09/2002]]'],
 ['en','Keep the API key "[[CREDENTIAL_OR_SECRET|TEST_ONLY_Another77]]" confidential.'],
 ['en','Court case [[LEGAL_CASE_REFERENCE|CASE/2025/77]] remains private.'],
 ['en','The diagnosis was "[[MEDICAL_CONDITION|invented syndrome]]".'],
 ['en','A prescription for "[[MEDICATION|invented tablet]]" was written.'],
 ['en','Lab result: [[LAB_RESULT|invented assay 77]]'],
 ['en','An inventory reference 6075486 identifies a shelf.'],
 ['en','An organization called "Invented Services" opened yesterday.'],
 ['en','No context is available for 7186597.'],
 ['kn','ಈ ವೈದ್ಯಕೀಯ ದಾಖಲೆ [[MEDICAL_RECORD_NUMBER|8631042]] ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಇದೆ.'],
 ['kn','ವಿದ್ಯಾರ್ಥಿಯ ಕಾಲೇಜು ಪ್ರವೇಶ [[ACADEMIC_ADMISSION_ID|9742153]] ಪೂರ್ಣವಾಗಿದೆ.'],
 ['kn','ಸಿಬ್ಬಂದಿಯ ಉದ್ಯೋಗಿ ಗುರುತು [[STUDENT_OR_EMPLOYEE_ID|3853264]] ದಾಖಲಿಸಲಾಗಿದೆ.'],
 ['kn','ರೋಗಿಯ ಚಿಕಿತ್ಸೆ ಸಂಖ್ಯೆ [[PATIENT_ID|4964375]] ಗೌಪ್ಯವಾಗಿದೆ.'],
 ['kn','ರಕ್ತದ ಗುಂಪು: [[BLOOD_GROUP|O-]]'],
 ['kn','ವಸತಿ ವಿಳಾಸ "[[ADDRESS_REVIEW|55 ಕಾಲ್ಪನಿಕ ಬೀದಿ]]" ದಾಖಲಿಸಲಾಗಿದೆ.'],
 ['kn','ವ್ಯಕ್ತಿಯ ಹೆಸರು "[[PERSON_NAME_REVIEW|ಕಾಲ್ಪನಿಕ ರವಿ]]" ಆಗಿದೆ.'],
 ['kn','ಪಾವತಿಯ ಬ್ಯಾಂಕ್ ಖಾತೆ [[BANK_ACCOUNT_CANDIDATE|23456789012]] ಆಗಿದೆ.'],
 ['kn','ಸಾರ್ವಜನಿಕ ದಾಸ್ತಾನು ಸಂಖ್ಯೆ 6075486 ಆಗಿದೆ.'],
 ['kn','ಸಂಸ್ಥೆಯ ಹೆಸರು "ಕಾಲ್ಪನಿಕ ವ್ಯಾಪಾರ" ಆಗಿದೆ.'],
 ['mixed','Medical chart ದಾಖಲೆ [[MEDICAL_RECORD_NUMBER|8631042]] was found in hospital.'],
 ['mixed','University ಪ್ರವೇಶ [[ACADEMIC_ADMISSION_ID|9742153]] identifies this student.'],
 ['mixed','Employee ಸಿಬ್ಬಂದಿ ಸಂಖ್ಯೆ [[STUDENT_OR_EMPLOYEE_ID|3853264]] belongs to payroll.'],
 ['mixed','Guardian ಹೆಸರು "[[PERSON_NAME_REVIEW|Fictional Ravi]]" is on the form.'],
 ['mixed','Residential ವಿಳಾಸ "[[ADDRESS_REVIEW|55 Invented Street]]" is recorded.'],
 ['mixed','Reference ಸಂಖ್ಯೆ 7186597 is not identified as personal.'],
 ['en','Aadhaar: [[AADHAAR_REVIEW|2345 6789 0123]]\nAadhaar: [[AADHAAR_REVIEW|2345 6789 0123]]'],
 ['en','VID: 1234567890123456\nBID: 1234567890123456'],
 ['en','Address: [[ADDRESS_REVIEW|55 Invented Street]]\nAddress: [[ADDRESS_REVIEW|56 Invented Street]]'],
 ['mixed','😀 ಆಸ್ಪತ್ರೆ medical record: [[MEDICAL_RECORD_NUMBER|8631042]]'],
 ['en','Hospital medica1 rec0rd [[MEDICAL_RECORD_NUMBER|8631042]] is difficult to read.'],
 ['kn','ವೈದ್ಯಕೀಯ ದಾಖಲೆ: [[MEDICAL_RECORD_NUMBER|೮೬೩೧೦೪೨]]'],
];
function parse([language,marked],i,split){
 let text='',cursor=0;const gold=[];
 for(const m of marked.matchAll(/\[\[([A-Z_]+)\|([^\]]+)\]\]/g)){
  text+=marked.slice(cursor,m.index);const start=text.length;text+=m[2];gold.push({start,end:text.length,category:m[1]});cursor=m.index+m[0].length;
 }
 text+=marked.slice(cursor);
 return {id:`${split}-${i+1}`,language,text,gold,annotation_source:'coding-assistant-authored fictional example',human_review:'pending',split};
}
const development=dev.map((r,i)=>parse(r,i,'development')),test=holdout.map((r,i)=>parse(r,i,'holdout'));
const a=new Set(development.map(r=>r.text));if(test.some(r=>a.has(r.text)))throw Error('Split overlap');
for(const [name,rows] of [['development',development],['holdout',test]]){
 const data=JSON.stringify(rows,null,2)+'\n';writeFileSync(new URL(`./review-${name}.json`,import.meta.url),data);
 console.log(name,rows.length,createHash('sha256').update(data).digest('hex'));
}
