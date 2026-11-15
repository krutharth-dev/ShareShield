import type {Candidate} from './detection.ts';

// These helpers operate only on the detector's normalized matching view.
// Original UTF-16 offsets are restored by detect() before localization.
export const aadhaarLabel=/^(?:your[ \t]+)?(?:aadhaar|aadhar|uidai|ಆಧಾರ್|ಆಧಾರ|आधार)[ \t]*(?:number|no\.?|ಸಂಖ್ಯೆ|ನಂಬರ್|संख्या)?[ \t]*[:#=-]?[ \t]*$/iu;

export function fieldPrefix(text:string,start:number):string {
 const lineStart=text.lastIndexOf('\n',start-1)+1;
 const prefix=text.slice(lineStart,start);
 if(prefix.trim()||lineStart===0)return prefix;
 // Only the immediately preceding row can supply a label. Callers must
 // match a complete label; never borrow context from arbitrary earlier prose.
 const previousStart=text.lastIndexOf('\n',lineStart-2)+1;
 return text.slice(previousStart,lineStart-1).trim();
}

/** No fixed whitespace limit: a wide gap cannot turn 16 digits into 12. */
export function touchesNumericContinuation(text:string,start:number,end:number):boolean {
 let before=start-1,after=end;
 const separator=/[\s._:/-]/u;
 while(before>=0&&separator.test(text[before]))before--;
 while(after<text.length&&separator.test(text[after]))after++;
 const numericLike=(at:number,direction:number)=>{
  if(at<0||at>=text.length)return false;
  if(/[0-9]/.test(text[at]))return true;
  let token='';
  while(at>=0&&at<text.length&&/[0-9OIlS]/i.test(text[at])){token+=text[at];at+=direction;}
  // Do not mistake the last letter of a label such as "No:" for a digit.
  return !/[A-Za-z]/.test(text[at]??'')&&token.length>=4;
 };
 return numericLike(before,-1)||numericLike(after,1);
}

/** Adjacent complete rows under an Aadhaar label are separate review proposals.
 * A partial row invalidates the entire run, so a wrapped VID is never carved up.
 * Column/row association is uncertain: these are never automatic approvals.
 */
export function repeatedAadhaarRows(text:string):Candidate[]{
 const lines=text.split('\n'),starts:number[]=[];let cursor=0;
 for(const line of lines){starts.push(cursor);cursor+=line.length+1;}
 const complete=/^(?:[0-9]{12}|[0-9]{4}[ \t.-]+[0-9]{4}[ \t.-]+[0-9]{4})$/;
 const found:Candidate[]=[];
 for(let i=0;i<lines.length;i++){
  const first=lines[i].match(/([0-9][0-9 \t.-]*)$/);
  if(!first)continue;
  const value=first[1].trimEnd(),start=starts[i]+first.index!;
  if(!complete.test(value)||!aadhaarLabel.test(fieldPrefix(text,start)))continue;
  const rows=[{value,start}],begin=i;let valid=true;
  for(let j=i+1;j<lines.length&&/^[ \t]*[0-9][0-9 \t._:/-]*$/.test(lines[j]);j++){
   const value=lines[j].trim();
   if(!complete.test(value))valid=false;
   rows.push({value,start:starts[j]+lines[j].search(/\S/)});i=j;
  }
  if(rows.length<2||!valid)continue;
  // Also reject a continuation separated by whitespace/blank rows.
  const last=rows[rows.length-1];let after=last.start+last.value.length;
  while(after<text.length&&/[\s._:/-]/u.test(text[after]))after++;
  if(/[0-9]/.test(text[after]??'')||begin>0&&/^[ \t]*[0-9][0-9 \t._:/-]*$/.test(lines[begin-1]))continue;
  for(const row of rows)found.push({category:'AADHAAR_REVIEW',...row,end:row.start+row.value.length,risk:'HIGH',detection_confidence:.55,
   reason:'Complete numeric rows under an Aadhaar label; confirm each row and its source region before removal.'});
 }
 return found;
}
