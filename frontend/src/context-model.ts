/** Learned contextual classifier; weights trained by ml/train.py, no network inference. */
export type ContextModel={version:string;architecture:string;classes:string[];vocabulary:Record<string,number>;weights:number[][];bias:number[];threshold:number;calibrated:boolean};
export type Span={start:number;end:number};
export function validateModel(raw:unknown):ContextModel {
 const m=raw as ContextModel;
 if(!m||m.version!=='synthetic-context-linear-v1'||m.architecture!=='binary-char-ngram-multinomial-logistic'||m.calibrated!==false||!Array.isArray(m.classes)||m.classes.length<2||m.classes.length>64||!m.classes.includes('NONE')||!m.vocabulary||typeof m.vocabulary!=='object')throw Error('Unsupported contextual model');
 const n=Object.keys(m.vocabulary).length;
 if(n<1||n>6000||!Array.isArray(m.weights)||m.weights.length!==m.classes.length||!Array.isArray(m.bias)||m.bias.length!==m.classes.length||m.bias.some(x=>!Number.isFinite(x))||m.weights.some(w=>!Array.isArray(w)||w.length!==n||w.some(x=>!Number.isFinite(x)))||Object.values(m.vocabulary).some(i=>!Number.isInteger(i)||i<0||i>=n)||!Number.isFinite(m.threshold)||m.threshold<.5||m.threshold>1)throw Error('Invalid contextual model dimensions');
 return m;
}
export function contextFeatures(text:string,{start,end}:Span):string {
 const left=Array.from(text.slice(Math.max(0,start-192),start).split('\n').at(-1)??'').slice(-96).join('');
 const right=Array.from(text.slice(end,end+96).split('\n')[0]).slice(0,48).join('');
 return (left+' <span> '+right).toLowerCase().replace(/[0-9೦-೯]/gu,'#').replace(/\s+/gu,' ');
}
export function classifySpan(model:ContextModel,text:string,span:Span){
 const chars=Array.from(contextFeatures(text,span)), indices=new Set<number>();
 for(let n=2;n<=4;n++)for(let i=0;i+n<=chars.length;i++){
  const key=chars.slice(i,i+n).join('');
  if(Object.hasOwn(model.vocabulary,key))indices.add(model.vocabulary[key]);
 }
 const logits=model.bias.map((b,c)=>b+[...indices].reduce((sum,i)=>sum+model.weights[c][i],0));
 const max=Math.max(...logits),exp=logits.map(x=>Math.exp(x-max)),total=exp.reduce((a,b)=>a+b,0);
 const scores=exp.map(x=>x/total),best=scores.indexOf(Math.max(...scores));
 return {category:scores[best]>=model.threshold?model.classes[best]:'NONE',score:scores[best],version:model.version};
}
/** Generic span proposals are deterministic; CLASS assignment comes from learned weights.
 * Fields, numbers and short identifiers only. Arbitrary prose NER remains unsupported. */
export function proposeSpans(text:string):Span[]{
 const spans:Span[]=[];let offset=0;
 for(const line of text.split('\n')){
  if(line.length<=512&&!/(?:\bVID\b|\bBID\b|virtual\s*(?:id|identifier)|ವಿಐಡಿ|ಬಿಐಡಿ)/iu.test(line)){
   const field=/[:：=][ \t]*([^\r\n]+)/u.exec(line);
   if(field){const value=field[1].trimEnd();if(value&&!value.includes('[REDACTED]')){const start=offset+field.index+field[0].indexOf(field[1]);spans.push({start,end:start+value.length});}}
   for(const m of line.matchAll(/(?<![\p{L}\p{N}_/-])[\p{L}\p{N}][\p{L}\p{N}_/-]{3,29}(?![\p{L}\p{N}_/-])/gu)){
    if(!/[0-9೦-೯]/u.test(m[0]))continue;
    const start=offset+m.index!,end=start+m[0].length;
    if(!field||!(offset+field.index<=start&&offset+line.length>=end))spans.push({start,end});
   }
  }
  offset+=line.length+1;
 }
 return spans;
}
export async function loadContextModel(fetcher:typeof fetch=fetch):Promise<ContextModel|null>{
 try{
  // Fixed same-origin GET. Never send text, spans or document contents to a service.
  const response=await fetcher('/models/context-v1.json',{credentials:'omit',signal:AbortSignal.timeout(5000)});
  if(!response.ok) return null;
  const body=await response.text(); if(body.length>4_000_000)return null;
  return validateModel(JSON.parse(body));
 }catch{return null;}
}
