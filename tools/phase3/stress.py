"""Additional DEVELOPMENT stress variants; sealed corpus is never changed."""
import json,hashlib
from pathlib import Path
from PIL import Image,ImageFilter,ImageEnhance
root=Path('frontend/tests/phase3/fixtures');manifest=json.loads((root/'manifest.json').read_text())
for split in ['development','sealed']:
 original=next(x for x in manifest['documents'] if x['id']==split+'-identity');im=Image.open(root/original['file'])
 for scale in [.5,.65,.8]:
  doc=json.loads(json.dumps(original));doc['id']=f'{split}-small-{scale}';doc['kind']='small-text';doc['file']=doc['id']+'.png'
  scaled=im.resize((int(im.width*scale),int(im.height*scale)),Image.Resampling.LANCZOS);scaled.save(root/doc['file']);doc['width'],doc['height']=scaled.size
  for e in doc['entities']:e['box']=[v*scale for v in e['box']]
  doc['sha256']=hashlib.sha256((root/doc['file']).read_bytes()).hexdigest();manifest['documents'].append(doc)
(root/'stress-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
