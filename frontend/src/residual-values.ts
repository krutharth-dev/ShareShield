import {normalizeDetectionSource} from './detection-normalization.ts';
/** Selected-value checks must honour excluded VID fields and complete digit boundaries. */
export function selectedValueRemains(text:string,value:string,excluded:readonly {start:number;end:number}[],compact=false){
 let scoped=text;
 for(const span of [...excluded].sort((a,b)=>b.start-a.start))scoped=scoped.slice(0,span.start)+'\0'+scoped.slice(span.end);
 const normalize=(s:string)=>{const t=normalizeDetectionSource(s).text;return compact?t.replace(/\s/g,'').toLowerCase():t;};
 const source=normalize(scoped),target=normalize(value);
 if(value.length<=2||!target)return false;
 const numeric=/^[0-9 -]+$/.test(target);
 for(let at=source.indexOf(target);at>=0;at=source.indexOf(target,at+1)){
  if(numeric&&(/[0-9]/.test(source[at-1]??'')||/[0-9]/.test(source[at+target.length]??'')))continue;
  return true;
 }
 return false;
}
