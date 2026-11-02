/** A matching-only view. The original string is never used with normalized offsets. */
export function normalizeDetectionSource(source:string){
 type Edit={start:number;end:number;sourceStart:number;sourceEnd:number};
 const edits:Edit[]=[];
 const pattern=/[\r\u00a0\u2000-\u200f\u2028-\u202f\u2060\u2066-\u2069\ufeff\uff01-\uff5e\u0660-\u0669\u06f0-\u06f9\u0966-\u096f\u0ce6-\u0cef\u2010-\u2015\u2212]/g;
 let cursor=0,length=0;const parts:string[]=[];
 for(const match of source.matchAll(pattern)){
  const ch=match[0],code=ch.charCodeAt(0),index=match.index!;
  const unchanged=source.slice(cursor,index);parts.push(unchanged);length+=unchanged.length;
  let replacement=ch;
  if(code>=0xff01&&code<=0xff5e)replacement=String.fromCharCode(code-0xfee0);
  else if(code>=0xce6&&code<=0xcef)replacement=String(code-0xce6);
  else if(code>=0x966&&code<=0x96f)replacement=String(code-0x966);
  else if(code>=0x660&&code<=0x669)replacement=String(code-0x660);
  else if(code>=0x6f0&&code<=0x6f9)replacement=String(code-0x6f0);
  else if(ch==='\u2028'||ch==='\u2029')replacement='\n';
  else if(ch==='\r')replacement=source[index+1]==='\n'?'':'\n';
  else if(/[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/.test(ch))replacement='';
  else if(/[\u2010-\u2015\u2212]/.test(ch))replacement='-';
  else replacement=' ';
  edits.push({start:length,end:length+replacement.length,sourceStart:index,sourceEnd:index+1});
  parts.push(replacement);length+=replacement.length;cursor=index+1;
 }
 if(!edits.length)return {text:source,originalStart:(offset:number)=>offset,originalEnd:(offset:number)=>offset};
 parts.push(source.slice(cursor));
 function map(offset:number,end:boolean){
  let lo=0,hi=edits.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(end?edits[mid].start<offset:edits[mid].start<=offset)lo=mid+1;else hi=mid;}
  const edit=edits[lo-1];if(!edit)return offset;
  if(end?offset<=edit.end:offset<edit.end)return end?edit.sourceEnd:edit.sourceStart;
  return offset+edit.sourceEnd-edit.end;
 }
 return {text:parts.join(''),originalStart:(offset:number)=>map(offset,false),originalEnd:(offset:number)=>map(offset,true)};
}
