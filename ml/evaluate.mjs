/** Exact span+category scoring of the actual TypeScript runtime. No private data. */
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {validateModel,proposeSpans,classifySpan} from '../frontend/src/context-model.ts';
import {detectHybrid} from '../frontend/src/hybrid-detection.ts';
import {detect} from '../frontend/src/detection.ts';
import {selectableFinding} from '../frontend/src/selection-policy.ts';
const model=validateModel(JSON.parse(readFileSync(new URL('../frontend/public/models/context-v1.json',import.meta.url))));
const rows=readFileSync(new URL('./data/test.jsonl',import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
// Independently authored challenge phrasing; not used for training or threshold selection.
const challenge=[
 ['en','The hospital chart belongs to record 4829107.','4829107','MEDICAL_RECORD_NUMBER'],
 ['en','The university assigned 4829107 after admission.','4829107','ACADEMIC_ADMISSION_ID'],
 ['en','Staff member 4829107 joined payroll today.','4829107','STUDENT_OR_EMPLOYEE_ID'],
 ['kn','ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ದಾಖಲಾಗಿರುವ ರೋಗಿಯ ಸಂಖ್ಯೆ 4829107','4829107','PATIENT_ID'],
 ['kn','ಕಾಲೇಜಿನಲ್ಲಿ ಪ್ರವೇಶ ಪಡೆದವರ ಸಂಖ್ಯೆ 4829107','4829107','ACADEMIC_ADMISSION_ID'],
 ['mixed','ಆಸ್ಪತ್ರೆ chart record: 4829107','4829107','MEDICAL_RECORD_NUMBER'],
 ['en','Blood group: A+','A+','BLOOD_GROUP'],
 ['en','Grade: A+','A+','ACADEMIC_GRADE'],
 ['en','Bank account: 9876543210','9876543210','BANK_ACCOUNT_CANDIDATE'],
 ['en','Phone: 9876543210','9876543210','INDIAN_MOBILE'],
 ['en','Name: Fictional Mira','Fictional Mira','PERSON_NAME_REVIEW'],
 ['en','Company: Fictional Labs',null,null],
 ['en','Reference: 4829107',null,null],
 ['kn','ಉಲ್ಲೇಖ: 4829107',null,null],
 ['mixed','Unknown ಸಂಖ್ಯೆ: 4829107',null,null],
 ['en','4829107',null,null],
 ['en','VID: 1234567890123456',null,null],
 ['en','BID: 1234567890123456',null,null],
 ['en','hospital medica1 rec0rd: 4829107','4829107','MEDICAL_RECORD_NUMBER'],
 ['kn','ವೈದ್ಯಕೀಯ ದಾಖಲೆ ಸಂಖ್ಯೆ: 4829107','4829107','MEDICAL_RECORD_NUMBER'],
].map(([language,text,value,category])=>({language,text,gold:value?[{start:text.indexOf(value),end:text.indexOf(value)+value.length,category}]:[]}));
challenge.push({language:'en',text:'Aadhaar: 2345 6789 0123\nAadhaar: 2345 6789 0123',gold:[{start:9,end:23,category:'AADHAAR_REVIEW'},{start:33,end:47,category:'AADHAAR_REVIEW'}]});
challenge.push({language:'en',text:'Home address: 42 Fictional Lane\nHome address: 43 Fictional Lane',gold:[{start:14,end:31,category:'ADDRESS_REVIEW'},{start:46,end:63,category:'ADDRESS_REVIEW'}]});
// Use actual source indices, with all occurrence positions retained.
challenge.at(-1).gold=[...challenge.at(-1).text.matchAll(/4[23] Fictional Lane/g)].map(m=>({start:m.index,end:m.index+m[0].length,category:'ADDRESS_REVIEW'}));
challenge.at(-2).gold=[...challenge.at(-2).text.matchAll(/2345 6789 0123/g)].map(m=>({start:m.index,end:m.index+m[0].length,category:'AADHAAR_REVIEW'}));
const key=s=>`${s.start}:${s.end}:${s.category}`;
const metrics=({tp,fp,fn})=>({tp,fp,fn,precision:tp/(tp+fp)||0,recall:tp/(tp+fn)||0,f1:2*tp/(2*tp+fp+fn)||0});
const systems={deterministic:t=>detect(t).filter(selectableFinding),model:t=>proposeSpans(t).map(s=>({...s,...classifySpan(model,t,s)})).filter(s=>s.category!=='NONE'),hybrid:t=>detectHybrid(t,model).filter(selectableFinding)};
function evaluate(data){
 const result={};
 for(const [name,run] of Object.entries(systems)){
  const overall={tp:0,fp:0,fn:0},languages={},categories={},errors=[],times=[];
  for(const r of data){
   const begin=performance.now(),pred=run(r.text);times.push(performance.now()-begin);
   const gold=r.gold??(r.category==='NONE'?[]:[r]);const gs=new Set(gold.map(key)),ps=new Set(pred.map(key));
   const counts={tp:[...ps].filter(k=>gs.has(k)).length,fp:[...ps].filter(k=>!gs.has(k)).length,fn:[...gs].filter(k=>!ps.has(k)).length};
   languages[r.language]??={tp:0,fp:0,fn:0};for(const k of ['tp','fp','fn']){overall[k]+=counts[k];languages[r.language][k]+=counts[k];}
   for(const c of new Set([...gold,...pred].map(s=>s.category))){categories[c]??={tp:0,fp:0,fn:0};for(const s of pred.filter(s=>s.category===c))categories[c][gs.has(key(s))?'tp':'fp']++;for(const s of gold.filter(s=>s.category===c))if(!ps.has(key(s)))categories[c].fn++;}
   if(counts.fp||counts.fn)errors.push({text:r.text,language:r.language,gold,pred:pred.map(({start,end,category})=>({start,end,category}))});
  }
  times.sort((a,b)=>a-b);result[name]={overall:metrics(overall),languages:Object.fromEntries(Object.entries(languages).map(([k,v])=>[k,metrics(v)])),categories:Object.fromEntries(Object.entries(categories).map(([k,v])=>[k,metrics(v)])),latency_ms:{median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)]},errors};
 }
 return result;
}
const result={scope:'Strict exact-span AND exact-category. Synthetic only; independent challenge is small and not statistically representative.',held_out:evaluate(rows),challenge:evaluate(challenge),peak_node_rss_bytes:process.resourceUsage().maxRSS*1024,node:process.version};
writeFileSync(new URL('./evaluation.json',import.meta.url),JSON.stringify(result,null,2));
writeFileSync(new URL('./challenge.json',import.meta.url),JSON.stringify(challenge,null,2));
for(const set of ['held_out','challenge'])for(const [system,r] of Object.entries(result[set]))console.log(set,system,r.overall,r.latency_ms);
