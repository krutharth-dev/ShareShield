import {parsePhoneNumberFromString} from 'libphonenumber-js/max';
export type Validation = {status:'passed'|'failed'|'context_only'|'not_checked';method:string;detail:string};
export function normalizeDigits(value:string):string {
 return value.replace(/[०-९೦-೯]/gu,c=>String(c.charCodeAt(0)-(c>='೦'?0xce6:0x966)));
}
const D=[[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const P=[[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export function validAadhaar(value:string){const s=normalizeDigits(value).replace(/[ \t-]/g,'');let c=0;if(!/^[2-9]\d{11}$/.test(s))return false;[...s].reverse().forEach((v,i)=>{c=D[c][P[i%8][Number(v)]]});return c===0;}

export const validPan=(value:string)=>/^[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]$/.test(value.toUpperCase());
export const validIfsc=(value:string)=>/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.toUpperCase());
export function validatePhone(value:string):Validation {
 const input=normalizeDigits(value).trim();
 // National numbers are interpreted as Indian only in the legacy Indian-mobile recognizer.
 const number=parsePhoneNumberFromString(input.startsWith('+')?input:'+91'+input);
 const valid=!!number?.isValid();
 return {status:valid?'passed':'failed',method:'country numbering-plan metadata',
 detail:valid?`Numbering-plan format passed (${number!.country??'non-geographic'}); assignment and ownership are not verified.`:'Number does not match a supported country numbering plan; review OCR and country code.'};
}
