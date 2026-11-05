"""Offline temperature-scaling experiment; never rewrites runtime weights or policy.
Fit family 6, audit family 7 and historical test families 8/9 separately.
These synthetic gold-span results cannot establish real-world calibration.
"""
import hashlib
import json
from pathlib import Path
import numpy as np
from scipy.optimize import minimize_scalar
from scipy.special import logsumexp, softmax
from sklearn.feature_extraction.text import CountVectorizer
from train import features

ROOT = Path(__file__).resolve().parents[1]

def metrics(logits, labels, temperature):
    scaled = logits / temperature
    p = softmax(scaled, axis=1)
    confidence = p.max(axis=1)
    correct = p.argmax(axis=1) == labels
    bins = []
    for i in range(10):
        mask = (confidence >= i / 10) & (confidence < (i + 1) / 10 if i < 9 else confidence <= 1)
        count = int(mask.sum())
        bins.append(dict(lower=i/10, upper=(i+1)/10, count=count,
                         accuracy=float(correct[mask].mean()) if count else None,
                         mean_score=float(confidence[mask].mean()) if count else None))
    ece = sum(b['count'] / len(labels) * abs(b['accuracy'] - b['mean_score']) for b in bins if b['count'])
    target = np.eye(p.shape[1])[labels]
    return dict(count=len(labels), accuracy=float(correct.mean()),
                nll=float(np.mean(logsumexp(scaled, axis=1) - scaled[np.arange(len(labels)), labels])),
                multiclass_brier=float(np.mean(np.sum((p-target)**2, axis=1))),
                ece_10_equal_width_bins=float(ece), reliability_bins=bins)

def main():
    path=ROOT/'frontend/public/models/context-v1.json'
    model=json.loads(path.read_text())
    vec=CountVectorizer(analyzer='char', ngram_range=tuple(model['ngram']),
                        lowercase=False, binary=True, vocabulary=model['vocabulary'])
    classes={c:i for i,c in enumerate(model['classes'])}
    datasets={s:[json.loads(line) for line in (ROOT/'ml/data'/f'{s}.jsonl').read_text().splitlines()] for s in ['validation','test']}
    groups={'fit_family_6':[r for r in datasets['validation'] if r['family']==6],
            'audit_family_7':[r for r in datasets['validation'] if r['family']==7],
            'historical_test':datasets['test']}
    # Harder, previously inspected holdout is audit-only and NEVER used to fit T.
    review=[]
    for row in json.loads((ROOT/'ml/review-holdout.json').read_text()):
        for span in row['gold']:
            encoded=row['text'].encode('utf-16-le')
            review.append(dict(text=row['text'], language=row['language'], category=span['category'],
                               start=len(encoded[:span['start']*2].decode('utf-16-le')),
                               end=len(encoded[:span['end']*2].decode('utf-16-le'))))
    groups['fictional_review_gold_spans']=review
    assert set(r['text'] for r in groups['fit_family_6']).isdisjoint(r['text'] for r in groups['audit_family_7']+groups['historical_test'])
    def arrays(rows):
        x=vec.transform([features(r['text'],r['start'],r['end']) for r in rows])
        return x @ np.asarray(model['weights']).T + np.asarray(model['bias']), np.array([classes[r['category']] for r in rows])
    z,y=arrays(groups['fit_family_6'])
    def loss(log_t):
        scaled=z/np.exp(log_t)
        return float(np.mean(logsumexp(scaled,axis=1)-scaled[np.arange(len(y)),y]))
    result=minimize_scalar(loss,bounds=(np.log(.05),np.log(20)),method='bounded')
    assert result.success
    temperature=float(np.exp(result.x))
    report=dict(model_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),temperature=temperature,
                deployment_approved=False, scope='Synthetic gold spans only; validation families already used for model threshold selection. Historical tests are regression evidence, not a fresh blind evaluation. No real-world calibration claim.',
                fit_family=6, audit_family=7, bounds=[.05,20], groups={})
    for name,rows in groups.items():
        z,y=arrays(rows)
        report['groups'][name]={'raw':metrics(z,y,1),'temperature_scaled':metrics(z,y,temperature),'languages':{}}
        for language in ['en','kn','mixed']:
            indices=np.array([i for i,r in enumerate(rows) if r['language']==language])
            report['groups'][name]['languages'][language]={'raw':metrics(z[indices],y[indices],1),'temperature_scaled':metrics(z[indices],y[indices],temperature)}
    output=ROOT/'ml/calibration-report.json'
    output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'temperature':temperature,'deployment_approved':False,'groups':{k:{s:{m:v for m,v in d[s].items() if m!='reliability_bins'} for s in ['raw','temperature_scaled']} for k,d in report['groups'].items()}},indent=2))

if __name__=='__main__': main()
