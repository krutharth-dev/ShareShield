import {detect,type Candidate} from './detection.ts';
import {classifySpan,proposeSpans,type ContextModel} from './context-model.ts';
import {explainCandidate} from './finding-explanation.ts';
import {categoryDefinition} from './category-registry.ts';
import {selectableFinding} from './selection-policy.ts';
export function detectHybrid(text:string,model:ContextModel|null):Candidate[]{
 const baseline=detect(text).map(c=>({...c,recognition_source:'deterministic' as const}));
 if(!model)return baseline;
 const result:Candidate[]=[...baseline];
 for(const span of proposeSpans(text)){
  const p=classifySpan(model,text,span);
  if(p.category==='NONE'||!categoryDefinition(p.category)||!selectableFinding({category:p.category}))continue;
  const overlap=result.filter(c=>c.start<span.end&&c.end>span.start);
  if(overlap.length){
   for(const c of overlap){
    if(c.start===span.start&&c.end===span.end&&c.category===p.category){c.recognition_source='both';c.ai_model_version=p.version;}
    else if(c.category!==p.category){
     // Keep the authoritative category and span; add a review reason, never another mask.
     c.classification_conflict={suggested_category:p.category,model_version:p.version};
    }
   }
   // Learned output never removes, widens, reclassifies or lowers existing rule findings.
   continue;
  }
  const candidate=explainCandidate({category:p.category,value:text.slice(span.start,span.end),...span,risk:'CONTEXT_DEPENDENT',detection_confidence:.49,reason:'Experimental trained contextual classifier; manual review required.',recognition_source:'trained_ai',ai_model_version:p.version},text);
  candidate.confidence_meaning='Uncalibrated trained-model output; no numerical certainty is displayed. Structural validation and privacy priority are separate. Manual review required.';
  result.push(candidate);
 }
 return result.sort((a,b)=>a.start-b.start||a.end-b.end);
}
