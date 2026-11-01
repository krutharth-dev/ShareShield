import time
import fitz
import pytest
from fastapi.testclient import TestClient
from backend.app import main

@pytest.fixture
def client():
    return TestClient(main.app)

def payload(text='Email: demo.person@example.test',metadata=None):
    doc=fitz.open();page=doc.new_page(width=595,height=420);page.insert_text((50,80),text,fontsize=18)
    if metadata:doc.set_metadata(metadata)
    data=doc.tobytes();doc.close();return data

def upload(client,data=None):
    r=client.post('/api/v1/analyze',files={'files':('sample.pdf',data or payload(),'application/pdf')})
    assert r.status_code==200,r.text
    return r.json()['files'][0]

def test_health(client):
    assert client.get('/health').json()['status']=='ok'

def test_real_detection_redaction_download(client):
    f=upload(client)
    assert any(x['category']=='EMAIL' for x in f['findings'])
    assert 'demo.person@example.test' not in str(f)
    url='/api/v1/files/'+f['file_id'];headers={'Authorization':'Bearer '+f['access_token']}
    assert client.get(url+'/download').status_code==404
    assert client.post(url+'/redact',json={'finding_ids':[x['id'] for x in f['findings']]}).status_code==404
    r=client.post(url+'/redact',headers=headers,json={'finding_ids':[x['id'] for x in f['findings']]})
    assert r.status_code==200,r.text
    assert r.json()['verification']['status']=='SCOPED_CLEAR',r.json()
    out=client.get(url+'/download',headers=headers)
    assert out.status_code==200
    with fitz.open(stream=out.content,filetype='pdf') as doc:
        assert 'demo.person@example.test' not in ''.join(p.get_text() for p in doc)
    import hashlib
    assert hashlib.sha256(out.content).hexdigest()==r.json()['verification']['sha256']
    assert client.delete(url,headers=headers).status_code==200
    assert client.get(url+'/download',headers=headers).status_code==404

def test_leftover_is_flagged(client):
    f=upload(client);url='/api/v1/files/'+f['file_id'];headers={'Authorization':'Bearer '+f['access_token']}
    r=client.post(url+'/redact',headers=headers,json={'finding_ids':[]})
    assert r.json()['verification']['status']=='FLAG'

def test_wrong_capability_and_forged_finding(client):
    a=upload(client);b=upload(client);url='/api/v1/files/'+a['file_id']
    assert client.post(url+'/redact',headers={'Authorization':'Bearer '+b['access_token']},json={'finding_ids':[]}).status_code==404
    assert client.post(url+'/redact',headers={'Authorization':'Bearer '+a['access_token']},json={'finding_ids':['forged']}).status_code==422

def test_expired_capability(client):
    a=upload(client);main.records[a['file_id']]['expires']=time.time()-1
    assert client.get('/api/v1/files/'+a['file_id']+'/download',headers={'Authorization':'Bearer '+a['access_token']}).status_code==404

@pytest.mark.parametrize('name,data,status',[('notes.exe',b'test',415),('fake.pdf',b'not pdf',415),('blank.pdf',b'',400),('corrupt.pdf',b'%PDF-broken',422),('big.pdf',b'x'*(8*1024*1024+1),413)])
def test_invalid_uploads(client,name,data,status):
    assert client.post('/api/v1/analyze',files={'files':(name,data)}).status_code==status

def test_cross_origin(client):
    assert client.post('/api/v1/analyze',headers={'Origin':'https://evil.example'},files={'files':('sample.pdf',payload())}).status_code==403

def test_path_and_legacy_routes_disabled(client):
    assert client.get('/api/v1/files/not-a-file/download').status_code==404
    assert client.get('/v1/files/123/456/output').status_code==404

def test_metadata_removed(client):
    f=upload(client,payload('Public project summary',{'author':'demo.person@example.test'}));headers={'Authorization':'Bearer '+f['access_token']};url='/api/v1/files/'+f['file_id']
    r=client.post(url+'/redact',headers=headers,json={'finding_ids':[]});assert r.json()['verification']['status']=='SCOPED_CLEAR'
    out=client.get(url+'/download',headers=headers)
    with fitz.open(stream=out.content,filetype='pdf') as d:assert 'demo.person@example.test' not in str(d.metadata)
