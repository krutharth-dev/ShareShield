"""Real-model synthetic-font regression; not a real-handwriting accuracy claim."""
import io
import resource
import time
from PIL import Image
from fastapi.testclient import TestClient
from backend.app import app
from backend.local_handwriting import MODEL_DIR


def main():
    client=TestClient(app)
    original=(MODEL_DIR/'fictional-handwriting.png').read_bytes()
    before=time.monotonic()
    info=client.post('/analyze',files={'file':('fictional.png',original)},data={'handwriting_mode':'true'})
    assert info.status_code==200,info.text
    data=info.json()
    email=next(f for f in data['findings'] if f['category']=='email' and f['value']=='demo@example.org')
    assert all(not f['auto_select'] for f in data['findings'])
    assert any(f['category']=='indian_mobile_candidate' for f in data['findings'])
    result=client.post('/redact',files={'file':('fictional.png',original)},
                       data={'analysis_id':data['analysis_id'],'selected_ids':str(email['id'])})
    assert result.status_code==200,result.text
    assert result.headers['X-ShareShield-Verification']=='UNVERIFIED'
    source=Image.open(io.BytesIO(original)).convert('RGB')
    output=Image.open(io.BytesIO(result.content)).convert('RGB')
    for x0,y0,x1,y1 in email['rectangles']:
        assert output.getpixel((int((x0+x1)/2),int((y0+y1)/2)))==(0,0,0)
    assert output.crop((0,500,1100,700)).tobytes()==source.crop((0,500,1100,700)).tobytes()
    print('PRETRAINED HANDWRITING SMOKE PASS: email removed, phone detected, public sentence preserved, UNVERIFIED export')
    print('Synthetic font only; seconds:',round(time.monotonic()-before,2),
          'worker peak MiB:',round(resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss/1024,1))


if __name__=='__main__': main()
