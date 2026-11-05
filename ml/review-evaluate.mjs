import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {detectHybrid} from '../frontend/src/hybrid-detection.ts';
import {detect} from '../frontend/src/detection.ts';
import {selectableFinding} from '../frontend/src/selection-policy.ts';
import {classifySpan,proposeSpans,validateModel} from '../frontend/src/context-model.ts';
const file=new URL('../frontend/public/models/context-v1.json',import.meta.url),bytes=readFileSync(file),model=validateModel(JSON.parse(bytes));
const score=({tp,fp,fn})=>({tp,fp,fn,precision:tp/(tp+fp)||0,recall:tp/(tp+fn)||0,f1:2*tp/(2*tp+fp+fn)||0});
const key=f=>`${f.start}:${f.end}:${f.category}`;
const report={model_sha256:createHash('sha256').update(bytes).digest('hex'),annotation_status:'assistant-authored, human and native-speaker review PENDING',sets:{}};
for(const split of ['development','holdout']){
 const source=readFileSync(new URL(`./review-${split}.json`,import.meta.url)),rows=JSON.parse(source);report.sets[split]={sha256:createHash('sha256').update(source).digest('hex'),documents:rows.length,systems:{}};
 for(const [system,run] of Object.entries({baseline:t=>detect(t).filter(selectableFinding),model:t=>proposeSpans(t).map(s=>({...s,...classifySpan(model,t,s)})).filter(f=>f.category!=='NONE'),hybrid:t=>detectHybrid(t,model).filter(selectableFinding)})){
  const total={tp:0,fp:0,fn:0},languages={},categories={},errors=[];
  for(const row of rows){
   const pred=run(row.text),gold=new Set(row.gold.map(key)),found=new Set(pred.map(key));
   const counts={tp:[...found].filter(k=>gold.has(k)).length,fp:[...found].filter(k=>!gold.has(k)).length,fn:[...gold].filter(k=>!found.has(k)).length};
   languages[row.language]??={tp:0,fp:0,fn:0};for(const k of ['tp','fp','fn']){total[k]+=counts[k];languages[row.language][k]+=counts[k];}
   for(const c of new Set([...row.gold,...pred].map(f=>f.category))){categories[c]??={tp:0,fp:0,fn:0};for(const p of pred.filter(f=>f.category===c))categories[c][gold.has(key(p))?'tp':'fp']++;for(const g of row.gold.filter(f=>f.category===c))if(!found.has(key(g)))categories[c].fn++;}
   if(counts.fp||counts.fn)errors.push({id:row.id,text:row.text,gold:row.gold,pred:pred.map(({start,end,category})=>({start,end,category}))});
  }
  report.sets[split].systems[system]={overall:score(total),languages:Object.fromEntries(Object.entries(languages).map(([k,v])=>[k,score(v)])),categories:Object.fromEntries(Object.entries(categories).map(([k,v])=>[k,score(v)])),errors};
  console.log(split,system,score(total));
 }
}
writeFileSync(new URL(process.env.REVIEW_REPORT??'./review-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
