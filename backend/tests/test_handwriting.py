"""Synthetic fixtures and mocked Azure transport; no real documents or credentials."""
import io
import fitz
import httpx
import pytest
from PIL import Image
from fastapi import HTTPException
from fastapi.testclient import TestClient
from backend import handwriting as hw, engine
from backend.app import app

client = TestClient(app)
ENDPOINT = 'https://fictional-test.cognitiveservices.azure.com'
OP = ENDPOINT + '/documentintelligence/documentModels/prebuilt-read/analyzeResults/fake-result?api-version=2024-11-30'


def azure_result():
    return {'pages':[{'unit':'pixel','width':400,'height':600,
        'words':[{'content':'demo@example.org','confidence':.72,'polygon':[50,80,180,80,180,105,50,105]}],
        'lines':[{'content':'demo@example.org','polygon':[50,80,180,80,180,105,50,105]}]}]}


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', ENDPOINT)
    monkeypatch.setenv('AZURE_DOCUMENT_INTELLIGENCE_KEY','fictional-key')
    monkeypatch.setenv('SHARESHIELD_HANDWRITING_ACCESS_CODE','fictional-access-code')
    monkeypatch.setattr(hw,'_used',0)
    monkeypatch.setattr(hw,'_day','')


def pdf():
    with fitz.open() as doc:
        page=doc.new_page(width=400,height=600)
        page.insert_text((50,100),'demo@example.org')
        page.insert_text((50,220),'PUBLIC HEADING')
        return doc.tobytes()


def test_consent_access_and_disabled_checks_precede_provider(configured,monkeypatch):
    monkeypatch.setattr(hw,'inspect',lambda *args: pytest.fail('Unauthorized provider call'))
    files={'file':('fictional.pdf',pdf())}
    assert client.post('/analyze',files=files,data={'handwriting_mode':'true'}).status_code==422
    assert client.post('/analyze',files=files,data={'handwriting_mode':'true','cloud_consent':'true'}).status_code==403
    monkeypatch.delenv('AZURE_DOCUMENT_INTELLIGENCE_KEY')
    assert not client.get('/api/status').json()['handwriting_available']
    assert client.post('/analyze',files=files,data={'handwriting_mode':'true','cloud_consent':'true'}).status_code==503


def test_standard_scan_never_calls_cloud(configured,monkeypatch):
    monkeypatch.setattr(hw,'read_page',lambda *args: pytest.fail('Unexpected external call'))
    assert client.post('/analyze',files={'file':('fictional.txt',b'demo@example.org')}).status_code==200


def test_geometry_confidence_and_line_selection():
    findings=hw.parse_result(azure_result(),2,800,1200)
    email=next(f for f in findings if f.category=='email')
    assert email.rectangles==[(100,160,360,210)]
    assert email.page==2 and email.public(0)['confidence']==.72
    assert email.public(0)['auto_select'] is False
    assert any(f.category=='text_region_candidate' for f in findings)


@pytest.mark.parametrize('polygon',[[float('nan')]*8,[-1,0,2,0,2,2,0,2],[0,0,900,0,900,20,0,20],[]])
def test_invalid_geometry_rejected(polygon):
    data=azure_result();data['pages'][0]['words'][0]['polygon']=polygon
    with pytest.raises(ValueError): hw.parse_result(data,1,400,600)


def test_handwriting_export_always_unverified_no_second_cloud_call(configured,monkeypatch):
    calls=[]
    def read(payload):
        calls.append(payload)
        # PDF is rendered at 2x, Azure echoes corresponding coordinates.
        data=azure_result();page=data['pages'][0];page['width']=800;page['height']=1200
        for item in page['words']+page['lines']: item['polygon']=[v*2 for v in item['polygon']]
        return data,False
    monkeypatch.setattr(hw,'read_page',read)
    original=pdf();files={'file':('fictional.pdf',original)}
    response=client.post('/analyze',files=files,data={'handwriting_mode':'true','cloud_consent':'true','handwriting_code':'fictional-access-code'})
    assert response.status_code==200,response.text
    info=response.json();assert any('deletion' in n for n in info['limitations'])
    email=next(f for f in info['findings'] if f['category']=='email')
    data={'analysis_id':info['analysis_id'],'selected_ids':str(email['id'])}
    output=client.post('/redact',files=files,data=data)
    assert output.status_code==200,output.text
    assert output.headers['X-ShareShield-Verification']=='UNVERIFIED'
    with fitz.open(stream=output.content,filetype='pdf') as doc:
        assert 'demo@example.org' not in doc[0].get_text()
        assert 'PUBLIC HEADING' in doc[0].get_text()
    report=client.post('/verify',files={**files,'redacted':('out.pdf',output.content)},data=data).json()
    assert report['status']=='UNVERIFIED'
    assert len(calls)==1


def test_limits_before_external_calls(configured,monkeypatch):
    monkeypatch.setattr(hw,'read_page',lambda *args: pytest.fail('Limit bypass'))
    with fitz.open() as doc:
        for _ in range(3): doc.new_page()
        with pytest.raises(HTTPException) as e: hw.inspect(doc.tobytes(),'.pdf')
        assert e.value.status_code==422
    hw.reserve(20)
    with pytest.raises(HTTPException) as e: hw.reserve(1)
    assert e.value.status_code==429


def test_provider_poll_and_cleanup(configured,monkeypatch):
    methods=[]
    def handler(request):
        methods.append(request.method)
        assert request.headers['Ocp-Apim-Subscription-Key']=='fictional-key'
        if request.method=='POST': return httpx.Response(202,headers={'Operation-Location':OP})
        if request.method=='GET': return httpx.Response(200,json={'status':'succeeded','analyzeResult':azure_result()})
        return httpx.Response(204)
    real_client=httpx.Client
    monkeypatch.setattr(hw.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    result,deleted=hw.read_page(b'fictional-image')
    assert deleted and result==azure_result() and methods==['POST','GET','DELETE']


def test_provider_cannot_redirect_key(configured,monkeypatch):
    calls=[]
    def handler(request):
        calls.append(request)
        return httpx.Response(202,headers={'Operation-Location':'https://example.org/steal'})
    real_client=httpx.Client
    monkeypatch.setattr(hw.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    with pytest.raises(HTTPException) as e: hw.read_page(b'fictional-image')
    assert e.value.status_code==502 and len(calls)==1


def test_provider_failure_is_sanitized_and_deletes_result(configured,monkeypatch):
    methods=[]
    def handler(request):
        methods.append(request.method)
        if request.method=='POST': return httpx.Response(202,headers={'Operation-Location':OP})
        if request.method=='GET': return httpx.Response(200,json={'status':'failed','error':{'message':'PRIVATE RAW TEXT'}})
        return httpx.Response(204)
    real_client=httpx.Client
    monkeypatch.setattr(hw.httpx,'Client',lambda **kwargs:real_client(transport=httpx.MockTransport(handler),**kwargs))
    with pytest.raises(HTTPException) as e: hw.read_page(b'fictional-image')
    assert 'PRIVATE' not in str(e.value.detail) and methods[-1]=='DELETE'
