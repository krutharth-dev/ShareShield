"""Read-only exact-commit acceptance gate. Never deploys or targets production."""
import hashlib,json,os,time,urllib.request
from pathlib import Path
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
ORIGIN='https://feat-local-multilingual-ai-2.shareshield-mini.pages.dev'
if urlparse(os.environ['TEST_URL']).netloc!=urlparse(ORIGIN).netloc:
    raise ValueError('Only the authorized isolated branch preview may be checked')
sha=os.environ['GITHUB_SHA']
evidence=Path(os.environ.get('SHARESHIELD_EVIDENCE_DIR','/tmp/context-live-evidence'));evidence.mkdir(parents=True,exist_ok=True)
def get(path):
    request=urllib.request.Request(ORIGIN+'/'+path,headers={'Accept-Encoding':'identity','User-Agent':'ShareShield-Acceptance/2.0 (+https://github.com/krutharth-dev/ShareShield)'})
    with urllib.request.urlopen(request,timeout=20) as r:return r.read()
last='Preview not ready'
for attempt in range(30):
    try:
        deployed=json.loads(get('build-info.json'))
        if deployed.get('commit')==sha:break
        last='Preview still serves a different commit'
    except Exception as exc:last=type(exc).__name__
    time.sleep(10)
else:raise RuntimeError(last+'; expected '+sha)
files=[ROOT/'frontend/dist/index.html',ROOT/'frontend/dist/models/context-v1.json',*(ROOT/'frontend/dist/assets').glob('*')]
checked=[]
for path in files:
    if not path.is_file():continue
    rel=path.relative_to(ROOT/'frontend/dist').as_posix();actual=hashlib.sha256(get(rel)).hexdigest();expected=hashlib.sha256(path.read_bytes()).hexdigest()
    if actual!=expected:raise AssertionError('Preview asset mismatch: '+rel)
    checked.append({'path':rel,'sha256':actual,'bytes':path.stat().st_size})
assert len(checked)>=7,'Expected both contextual and PDF workers plus application assets'
(evidence/'asset-hashes.json').write_text(json.dumps({'commit':sha,'origin':ORIGIN,'assets':checked},indent=2))
print('PASS exact preview commit and all model/runtime asset hashes',sha)
