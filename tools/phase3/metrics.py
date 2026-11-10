"""One-to-one generator-gold evaluation; raw OCR and complete browser findings."""
import argparse,json,statistics,re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('baseline');p.add_argument('enhanced');p.add_argument('output');a=p.parse_args()
root=Path(__file__).resolve().parents[2];manifest=json.loads((root/'frontend/tests/phase3/fixtures/stress-manifest.json').read_text())
gold={d['id']:d for d in manifest['documents']};base=json.load(open(a.baseline));enhanced=json.load(open(a.enhanced))
def norm(t):return ' '.join(t.split())
def digits(t):return ''.join(str(ord(c)-0xce6) if 0xce6<=ord(c)<=0xcef else c for c in t)
def dist(a,b):
 row=list(range(len(b)+1))
 for i,x in enumerate(a,1):
  new=[i]
  for j,y in enumerate(b,1):new.append(min(new[-1]+1,row[j]+1,row[j-1]+(x!=y)))
  row=new
 return row[-1]
def family(c):
 if c.startswith('AADHAAR') and 'VIRTUAL' not in c:return 'aadhaar'
 if 'ACCOUNT' in c:return 'bank'
 if 'ADDRESS' in c:return 'address'
 if 'NAME' in c or c=='ADDRESSEE_REVIEW':return 'name'
 if c=='KANNADA_PERSONAL_DETAIL_REVIEW':return 'generic'
 if c in ['MEDICAL_RECORD_NUMBER','PATIENT_ID','FORM_IDENTIFIER_REVIEW','STUDENT_OR_EMPLOYEE_ID','ACADEMIC_ADMISSION_ID']:return 'form'
 return None
def compatible(a,b):return family(a)==family(b) or family(a)=='generic' and family(b) in ['name','address','bank','form']
def overlap(box,g):
 x,y,w,h=g;return max(0,min(x+w,box['x']+box['width'])-max(x,box['x']))*max(0,min(y+h,box['y']+box['height'])-max(y,box['y']))
def score(doc,arm):
 g=gold[doc['id']];targets=g['entities'];used=set();tp=fp=0;unlocalized=0
 candidates=doc['deterministic'] if arm=='raw_deterministic' else doc['findings']
 for f in candidates:
  if not family(f['category']):continue
  if arm!='raw_deterministic' and not f['boxes']:unlocalized+=1
  match=None
  for i,t in enumerate(targets):
   if i in used or not compatible(f['category'],t['category']):continue
   if arm=='raw_deterministic':
    v=norm(digits(t['value']));pred=norm(digits(f['value']));okay=v==pred or v in pred
   else:okay=sum(overlap(b,t['box']) for b in f['boxes'])/(t['box'][2]*t['box'][3])>=.5
   if okay:match=i;break
  if match is None:fp+=1
  else:used.add(match);tp+=1
 return dict(tp=tp,fp=fp,fn=len(targets)-tp,unlocalized=unlocalized)
def summary(rows,arm):
 parts=[score(d,arm) for d in rows];r={k:sum(d[k] for d in parts) for k in parts[0]};tp,fp,fn=r['tp'],r['fp'],r['fn'];r.update(precision=tp/(tp+fp) if tp+fp else 0,recall=tp/(tp+fn) if tp+fn else 0,f1=2*tp/(2*tp+fp+fn) if tp else 0)
 return r
def ocr(rows,rescue):
 ce=we=nc=nw=0
 for d in rows:
  expected=norm(gold[d['id']]['text']);actual=norm(d['scaled_text'] if rescue and d['rescue_applied'] else d['raw_text']);ce+=dist(expected,actual);we+=dist(expected.split(),actual.split());nc+=len(expected);nw+=len(expected.split())
 return dict(character_errors=ce,characters=nc,cer=ce/nc,word_errors=we,words=nw,wer=we/nw)
report=dict(scope='13 sealed fictional scans (10 templates plus 3 small-text variants), generator annotations; not independently reviewed. One-to-one occurrence matching, compatible category family; duplicate aliases count as false positives. Browser findings require >=50% ground-truth value-box area coverage. Raw deterministic arm uses recognized value matching and is not a localization score.',ocr_scope='Whitespace-normalized Unicode Levenshtein. Baseline first-pass text versus first-pass text with 2x resize rescue substituted on the fixed small-glyph gate. These are OCR-pass metrics, not a concatenation or gold-selected best result across all OCR passes. All pipeline findings below use actual analyze() multipass outputs.',languages={})
for lang in ['all','eng','kan','eng+kan','small-text']:
 def chosen(d):return lang=='all' or gold[d['id']]['language']==lang or lang=='small-text' and gold[d['id']]['kind']=='small-text'
 b=[d for d in base['documents'] if chosen(d)];e=[d for d in enhanced['documents'] if chosen(d)]
 report['languages'][lang]=dict(documents=len(b),original_ocr_deterministic=summary(b,'raw_deterministic'),baseline_hybrid=summary(b,'hybrid'),enhanced_hybrid=summary(e,'hybrid'),baseline_ocr=ocr(b,False),rescue_ocr=ocr(e,True),baseline_median_analysis_ms=statistics.median(d['analysis_ms'] for d in b),enhanced_median_analysis_ms=statistics.median(d['analysis_ms'] for d in e),enhanced_max_heartbeat_gap_ms=max(d['max_heartbeat_gap_ms'] for d in e))
report['per_document']=[dict(id=d['id'],baseline=score(b,'hybrid'),enhanced=score(d,'hybrid')) for b,d in zip(base['documents'],enhanced['documents'])]
Path(a.output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['languages'],indent=2))
