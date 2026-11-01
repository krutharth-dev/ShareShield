/** Redact only the precise UTF-16 offsets selected by the user.
 * Matching values elsewhere are never automatically selected. Overlapping
 * selections are merged to avoid incorrectly shifting later offsets.
 */
export type TextSpan={start:number;end:number};
export function redactSelectedSpans(text:string,spans:readonly TextSpan[]):string{
 const sorted=spans.map(({start,end})=>{
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>text.length)
   throw Error('Selected redaction span falls outside the source text.');
  return {start,end};
 }).sort((a,b)=>a.start-b.start||a.end-b.end);
 const merged:TextSpan[]=[];
 for(const span of sorted){
  const prior=merged[merged.length-1];
  if(prior&&span.start<=prior.end)prior.end=Math.max(prior.end,span.end);
  else merged.push({...span});
 }
 let result=text;
 for(let i=merged.length-1;i>=0;i--){
  const {start,end}=merged[i];
  result=result.slice(0,start)+'[REDACTED]'+result.slice(end);
 }
 return result;
}
