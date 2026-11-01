import {classifyPriority,inferDocumentType,requiresManualReview,type SharingPurpose} from './priority.ts';
import {selectableFinding} from './selection-policy.ts';
/** High-priority default masks; never auto-mask uncertain/unlocalized OCR. */
export type AutomaticFinding={id:string;category:string;detection_confidence:number;ocr_confidence?:number;boxes:{x:number;y:number;width:number;height:number}[]};
export function autoSelectHighPriority<T extends AutomaticFinding>(findings:readonly T[],purpose:SharingPurpose,kind:string):string[]{
 const documentType=inferDocumentType(findings),textOnly=['txt','csv','docx'].includes(kind);
 return [...new Set(findings.filter(f=>
  selectableFinding(f)&&classifyPriority(f.category,purpose,documentType).mandatory&&
  !requiresManualReview(f)&&f.detection_confidence>=.75&&
  (f.ocr_confidence===undefined||f.ocr_confidence>=.70)&&
  (textOnly||f.boxes.some(b=>[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0))
 ).map(f=>f.id))];
}
