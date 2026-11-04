"""CPU-only synthetic contextual span classifier. No pretrained weights or private data."""
import json, re, hashlib, time, resource, platform
from pathlib import Path
import numpy as np
import sklearn
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, log_loss
ROOT=Path(__file__).resolve().parents[1]
# Each entry defines a semantic class, independent English/Kannada contexts and fictional values.
SPECS=[
('MEDICAL_RECORD_NUMBER','hospital medical record archive','ಆಸ್ಪತ್ರೆ ವೈದ್ಯಕೀಯ ದಾಖಲೆ', '4829107'),
('PATIENT_ID','patient treatment registration','ರೋಗಿಯ ಚಿಕಿತ್ಸೆ ಗುರುತು','5928107'),
('ACADEMIC_ADMISSION_ID','college admission registration','ಕಾಲೇಜು ಪ್ರವೇಶ ನೋಂದಣಿ','6928107'),
('STUDENT_OR_EMPLOYEE_ID','employee staff payroll identity','ಉದ್ಯೋಗಿ ಸಿಬ್ಬಂದಿ ಗುರುತು','7928107'),
('BLOOD_GROUP','patient blood group transfusion','ರೋಗಿಯ ರಕ್ತದ ಗುಂಪು','AB+'),
('ACADEMIC_GRADE','student academic examination grade','ವಿದ್ಯಾರ್ಥಿ ಶೈಕ್ಷಣಿಕ ಪರೀಕ್ಷೆ ಅಂಕ','A+'),
('BANK_ACCOUNT_CANDIDATE','bank savings account transfer','ಬ್ಯಾಂಕ್ ಉಳಿತಾಯ ಖಾತೆ','12345678901'),
('INDIAN_MOBILE','personal phone mobile contact','ವೈಯಕ್ತಿಕ ಮೊಬೈಲ್ ದೂರವಾಣಿ','9876543210'),
('PERSON_NAME_REVIEW','person full name guardian','ವ್ಯಕ್ತಿಯ ಪೂರ್ಣ ಹೆಸರು ಪೋಷಕ','Fictional Mira'),
('ADDRESS_REVIEW','residential home address street','ವಸತಿ ಮನೆ ವಿಳಾಸ ರಸ್ತೆ','42 Fictional Lane'),
('DATE_OF_BIRTH','personal date of birth birthday','ವೈಯಕ್ತಿಕ ಹುಟ್ಟಿದ ದಿನಾಂಕ','12/03/2001'),
('EMAIL','personal email contact inbox','ವೈಯಕ್ತಿಕ ಇಮೇಲ್ ಸಂಪರ್ಕ','fictional@example.test'),
('CREDENTIAL_OR_SECRET','secret password authentication token API key','ರಹಸ್ಯ ಪಾಸ್ವರ್ಡ್ ದೃಢೀಕರಣ ಕೀ','TEST_ONLY_secret_42'),
('LEGAL_CASE_REFERENCE','confidential court legal case identifier','ಗೌಪ್ಯ ನ್ಯಾಯಾಲಯ ಪ್ರಕರಣ ಸಂಖ್ಯೆ','CASE/2026/42'),
('MEDICAL_CONDITION','patient diagnosis disease condition','ರೋಗಿಯ ರೋಗನಿರ್ಣಯ ಕಾಯಿಲೆ','fictional condition'),
('MEDICATION','patient prescription medication treatment','ರೋಗಿಯ ಔಷಧಿ ಚಿಕಿತ್ಸೆ','fictional medicine'),
('LAB_RESULT','patient laboratory blood test result','ರೋಗಿಯ ಪ್ರಯೋಗಾಲಯ ರಕ್ತ ಪರೀಕ್ಷೆ ಫಲಿತಾಂಶ','fictional result 42'),
('ACADEMIC_RESULT','student examination marks result','ವಿದ್ಯಾರ್ಥಿ ಪರೀಕ್ಷೆ ಅಂಕ ಫಲಿತಾಂಶ','82%'),
('AADHAAR_REVIEW','government Aadhaar identity number','ಸರ್ಕಾರಿ ಆಧಾರ್ ಗುರುತಿನ ಸಂಖ್ಯೆ','234567890123'),
('PAN_CANDIDATE','government PAN income tax identity','ಸರ್ಕಾರಿ ಪ್ಯಾನ್ ಆದಾಯ ತೆರಿಗೆ','ABCPA1234Z'),
('PASSPORT_NUMBER','government passport travel identity','ಸರ್ಕಾರಿ ಪಾಸ್ಪೋರ್ಟ್ ಪ್ರಯಾಣ ಗುರುತು','Z1234567'),
('VOTER_ID','government voter election identity','ಸರ್ಕಾರಿ ಮತದಾರ ಚುನಾವಣೆ ಗುರುತು','ZZZ1234567'),
('DRIVING_LICENCE_NUMBER','government driving licence motor vehicle','ಸರ್ಕಾರಿ ಚಾಲನಾ ಪರವಾನಗಿ ವಾಹನ','KA0120260000042'),
('IFSC','bank branch IFSC routing','ಬ್ಯಾಂಕ್ ಶಾಖೆ ಐಎಫ್ಎಸ್ಸಿ','TEST0123456'),
('UPI_ID','bank payment UPI transfer handle','ಬ್ಯಾಂಕ್ ಪಾವತಿ ಯುಪಿಐ ವರ್ಗಾವಣೆ','fictional@upi'),
('PAYMENT_CARD_REVIEW','bank debit credit payment card','ಬ್ಯಾಂಕ್ ಡೆಬಿಟ್ ಕ್ರೆಡಿಟ್ ಪಾವತಿ ಕಾರ್ಡ್','4111111111111111'),
('NONE','public reference inventory order catalogue','ಸಾರ್ವಜನಿಕ ಉಲ್ಲೇಖ ದಾಸ್ತಾನು ಆದೇಶ','4829107'),
('NONE','organization company business name','ಸಂಸ್ಥೆ ಕಂಪನಿ ವ್ಯಾಪಾರ ಹೆಸರು','Fictional Labs'),
('NONE','virtual VID BID excluded identifier','ವರ್ಚುವಲ್ ವಿಐಡಿ ಬಿಐಡಿ ಗುರುತು','1234567890123456'),
('NONE','unlabelled unknown ambiguous reference','ಲೇಬಲ್ ಇಲ್ಲದ ಅಜ್ಞಾತ ಉಲ್ಲೇಖ','4829107'),
]
# Family split shared across ALL languages/classes; values also disjoint by split.
FRAMES=[
 ('{c}: {v}','{c}: {v}'),
 ('Recorded {c}: {v}','ದಾಖಲಿಸಿದ {c}: {v}'),
 ('Private {c} is {v}','ಖಾಸಗಿ {c} ಇದು {v}'),
 ('For {c}, use {v}','{c} ಗಾಗಿ {v} ಬಳಸಿ'),
 ('The {c} entry: {v}','{c} ನಮೂದು: {v}'),
 ('Confirm {c} equals {v}','{c} ಮೌಲ್ಯ {v} ದೃಢಪಡಿಸಿ'),
 ('Updated {c}: {v}','ನವೀಕರಿಸಿದ {c}: {v}'),
 ('Review {c} with value {v}','{c} ಮೌಲ್ಯವನ್ನು ಪರಿಶೀಲಿಸಿ {v}'),
 ('Archived {c}: {v}','ಸಂಗ್ರಹಿಸಿದ {c}: {v}'),
 ('Regarding {c}, the entry was {v}','{c} ಸಂಬಂಧಿಸಿದ ನಮೂದು {v}'),
]
def features(text,start,end):
    # Unicode codepoints; same implementation in TS. No normalization of source offsets.
    left=text[:start].split('\n')[-1][-96:]
    right=text[end:].split('\n')[0][:48]
    return re.sub(r'\s+', ' ', re.sub(r'[0-9೦-೯]', '#', (left+' <span> '+right).lower()))
def generate():
 rows=[]
 for ci,(cat,en,kn,val) in enumerate(SPECS):
  for fi,(ef,kf) in enumerate(FRAMES):
   split='train' if fi<6 else 'validation' if fi<8 else 'test'
   for lang in ['en','kn','mixed']:
    for variation in range(4):
     context=en if lang=='en' else kn if lang=='kn' else kn+' '+en
     # Vary context word order, not class label; all derived variants stay in family.
     if variation%2: context=' '.join(context.split()[1:]+context.split()[:1])
     value=(val[:-2]+str(fi)+str(variation)) if val.isdigit() else val+'-'+str(fi)+str(variation)
     template=kf if lang=='kn' else ef
     text=template.format(c=context,v=value)
     start=text.index(value)
     rows.append(dict(text=text,start=start,end=start+len(value),category=cat,language=lang,family=fi,split=split))
 # Explicit unknown negatives, grouped separately; no forced classification of isolated numbers.
 for split,fi in [('train',0),('validation',6),('test',8)]:
  for i in range(40):
   text=str(4000000+fi*1000+i)
   rows.append(dict(text=text,start=0,end=len(text),category='NONE',language=['en','kn','mixed'][i%3],family=fi,split=split))
 assert len({r['text'] for r in rows})==len(rows)
 for a in ['train','validation','test']:
  for b in ['train','validation','test']:
   if a!=b: assert not {r['family'] for r in rows if r['split']==a}&{r['family'] for r in rows if r['split']==b}
 return rows

def main():
 rows=generate(); out=ROOT/'ml'; (out/'data').mkdir(exist_ok=True)
 for split in ['train','validation','test']:
  subset=[r for r in rows if r['split']==split]
  (out/'data'/f'{split}.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in subset))
 train=[r for r in rows if r['split']=='train']; val=[r for r in rows if r['split']=='validation']; test=[r for r in rows if r['split']=='test']
 vec=CountVectorizer(analyzer='char',ngram_range=(2,4),lowercase=False,binary=True,max_features=6000)
 x=vec.fit_transform([features(r['text'],r['start'],r['end']) for r in train]); y=[r['category'] for r in train]
 start=time.perf_counter(); clf=LogisticRegression(C=1,solver='lbfgs',max_iter=300,random_state=42).fit(x,y); elapsed=time.perf_counter()-start
 vx=vec.transform([features(r['text'],r['start'],r['end']) for r in val]); vp=clf.predict_proba(vx)
 # Validation-only threshold selection; uncalibrated scores are NOT probabilities in UI.
 threshold=.5
 for t in [.5,.6,.7,.8,.9]:
  predictions=[clf.classes_[p.argmax()] if p.max()>=t else 'NONE' for p in vp]
  report=classification_report([r['category'] for r in val],predictions,output_dict=True,zero_division=0)
  if report['macro avg']['precision']>=.95: threshold=t;break
 model=dict(version='synthetic-context-linear-v1',architecture='binary-char-ngram-multinomial-logistic',ngram=[2,4],window=[96,48],vocabulary=vec.vocabulary_,classes=clf.classes_.tolist(),weights=np.round(clf.coef_,8).tolist(),bias=np.round(clf.intercept_,8).tolist(),threshold=threshold,calibrated=False)
 model['vocabulary']={k:int(v) for k,v in model['vocabulary'].items()}
 path=ROOT/'frontend/public/models/context-v1.json'; path.write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')))
 tx=vec.transform([features(r['text'],r['start'],r['end']) for r in test]); t=time.perf_counter(); probs=clf.predict_proba(tx); inference=time.perf_counter()-t
 pred=[clf.classes_[p.argmax()] if p.max()>=threshold else 'NONE' for p in probs]
 metrics=dict(scope='Synthetic held-out family classification GIVEN GOLD SPANS; not end-to-end NER recall.',counts={s:sum(r['split']==s for r in rows) for s in ['train','validation','test']},training_seconds=elapsed,iterations=clf.n_iter_.tolist(),validation_log_loss=float(log_loss([r['category'] for r in val],vp,labels=clf.classes_)),threshold=threshold,report=classification_report([r['category'] for r in test],pred,output_dict=True,zero_division=0),languages={lang:classification_report([r['category'] for r in test if r['language']==lang],[p for r,p in zip(test,pred) if r['language']==lang],output_dict=True,zero_division=0) for lang in ['en','kn','mixed']},batch_inference_ms=inference*1000,peak_training_process_rss_kib=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,model_bytes=path.stat().st_size,model_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),python=platform.python_version(),sklearn=sklearn.__version__,numpy=np.__version__)
 (out/'metrics.json').write_text(json.dumps(metrics,indent=2))
 (out/'parity.json').write_text(json.dumps([dict(r,expected=p,score=float(prob.max())) for r,p,prob in zip(test[:36],pred[:36],probs[:36])],ensure_ascii=False))
 print(json.dumps({k:v for k,v in metrics.items() if k not in ['report','languages']},indent=2));print('test macro',metrics['report']['macro avg'])
if __name__=='__main__': main()
