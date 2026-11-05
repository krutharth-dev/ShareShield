"""Create a prediction-free worklist or compare two independently completed reviews.
Use fictional corpus only. Review files may contain sensitive text: keep local.
"""
import argparse, hashlib, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def export(output):
    source=(ROOT/'ml/review-holdout.json').read_bytes()
    rows=json.loads(source)
    payload=dict(source_sha256=hashlib.sha256(source).hexdigest(), reviewer_id='',
                 kannada_fluent=False, independently_annotated=False, reviewed_at='',
                 offset_convention='UTF-16 code units, end exclusive',
                 documents=[dict(id=r['id'],text=r['text'],language=r['language'],status='pending',spans=[]) for r in rows])
    Path(output).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')

def validate(review,source,categories):
    assert review['independently_annotated'] is True, 'Independent annotation must be attested'
    assert review['reviewer_id'].strip() and review['reviewed_at'].strip(), 'Reviewer ID and date required'
    assert review['source_sha256']==hashlib.sha256(source).hexdigest(), 'Wrong corpus revision'
    originals={r['id']:r for r in json.loads(source)}
    assert len(review['documents'])==len(originals), 'Incomplete corpus'
    result={}
    for doc in review['documents']:
        assert doc['id'] not in result, 'Duplicate document'
        original=originals[doc['id']]
        assert doc['text']==original['text'] and doc['language']==original['language'], 'Source changed'
        assert doc['status']=='complete', 'Pending/unresolved review cannot establish agreement'
        encoded=doc['text'].encode('utf-16-le'); spans=set()
        for span in doc['spans']:
            a,b,c=span['start'],span['end'],span['category']
            assert type(a) is int and type(b) is int and 0<=a<b<=len(encoded)//2, 'Invalid span'
            encoded[:a*2].decode('utf-16-le'); encoded[a*2:b*2].decode('utf-16-le')
            assert c in categories and c!='NONE', 'Unknown category'
            key=(a,b,c); assert key not in spans, 'Duplicate span'; spans.add(key)
        result[doc['id']]=spans
    return result

def compare(a,b,output):
    source=(ROOT/'ml/review-holdout.json').read_bytes()
    categories=set(json.loads((ROOT/'frontend/public/models/context-v1.json').read_text())['classes'])
    left,right=[json.loads(Path(p).read_text()) for p in [a,b]]
    assert left['reviewer_id']!=right['reviewer_id'], 'Two different reviewers required'
    assert left['kannada_fluent'] is True or right['kannada_fluent'] is True, 'At least one fluent Kannada reviewer required'
    x,y=validate(left,source,categories),validate(right,source,categories)
    matched=sum(len(x[k]&y[k]) for k in x); total=sum(len(x[k])+len(y[k]) for k in x)
    disagreements=[dict(id=k,left_only=sorted(x[k]-y[k]),right_only=sorted(y[k]-x[k])) for k in x if x[k]!=y[k]]
    report=dict(scope='Exact span+category inter-annotator agreement, NOT model accuracy; self-attestations are not independently verified.',
                agreement_f1=2*matched/total if total else None,empty_both=total==0,
                disagreements=disagreements,adjudication_required=bool(disagreements),production_approved=False)
    Path(output).write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__':
    p=argparse.ArgumentParser(); s=p.add_subparsers(dest='command',required=True)
    e=s.add_parser('export');e.add_argument('output')
    c=s.add_parser('compare');c.add_argument('left');c.add_argument('right');c.add_argument('output')
    args=p.parse_args()
    if args.command=='export': export(args.output)
    else: compare(args.left,args.right,args.output)
