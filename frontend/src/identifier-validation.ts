import {parsePhoneNumberFromString,isSupportedCountry,type CountryCode} from 'libphonenumber-js/max';
import {validateIBAN,getCountrySpecifications} from 'ibantools';
export type Validation = {status:'passed'|'failed'|'context_only'|'not_checked';method:string;detail:string};
export function normalizeDigits(value:string):string {
 return value.replace(/[०-९೦-೯]/gu,c=>String(c.charCodeAt(0)-(c>='೦'?0xce6:0x966)));
}
const D=[[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const P=[[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export function validAadhaar(value:string){const s=normalizeDigits(value).replace(/[ \t-]/g,'');let c=0;if(!/^[2-9]\d{11}$/.test(s))return false;[...s].reverse().forEach((v,i)=>{c=D[c][P[i%8][Number(v)]]});return c===0;}

export const validPan=(value:string)=>/^[A-Z]{3}[ABCFGHLJPT][A-Z][0-9]{4}[A-Z]$/.test(value.toUpperCase());
export const validIfsc=(value:string)=>/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.toUpperCase());
export function validatePhone(value:string,countryHint?:string):Validation {
 let input=normalizeDigits(value).trim();
 if(input.startsWith('00'))input='+'+input.slice(2);
 const country=countryHint?.toUpperCase();
 const knownCountry=country&&isSupportedCountry(country)?country as CountryCode:undefined;
 const strict=/^(?:\+)?[0-9][0-9 ().-]*$/.test(input)&&input.replace(/\D/g,'').length<=15;
 const number=strict&&(input.startsWith('+')||knownCountry)?parsePhoneNumberFromString(input,{defaultCountry:knownCountry,extract:false}):undefined;
 const valid=!!number?.isValid()&&(!country||!!knownCountry);
 return {status:valid?'passed':'failed',method:'country numbering-plan metadata',
 detail:valid?`Numbering-plan format passed (${number!.country??'non-geographic'}); assignment and ownership are not verified.`:'Complete field does not match a supported numbering plan; review country code, explicit region and OCR.'};
}
const ibanCountries=getCountrySpecifications();
export function validateIban(value:string):Validation {
 const iban=normalizeDigits(value).replace(/[ \t-]/g,'').toUpperCase();
 const country=iban.slice(0,2),spec=ibanCountries[country];
 if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban))return {status:'failed',method:'IBAN country format + mod-97',detail:'IBAN contains invalid characters or header structure; review the complete field.'};
 if(!spec?.chars||!spec.bban_regexp)return {status:'not_checked',method:'IBAN country format + mod-97',detail:'Country format is absent from the bundled registry; mandatory review, not validated.'};
 const result=validateIBAN(iban);
 return {status:result.valid?'passed':'failed',method:'IBAN country format + mod-97',
 detail:result.valid?`Country length and BBAN format (${country}) plus checksums passed. Bank existence, issuance and ownership are not verified.`:'Country-specific length, BBAN format or checksum failed; retain for manual review.'};
}
