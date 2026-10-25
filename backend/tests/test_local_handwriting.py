import io
import json
import subprocess
from types import SimpleNamespace
import fitz
import numpy as np
import pytest
from fastapi import HTTPException
from PIL import Image
from backend import local_handwriting as local
from backend.local_handwriting_worker import convert


def png(size=(200,100)):
    out=io.BytesIO();Image.new('RGB',size,'white').save(out,format='PNG');return out.getvalue()


def test_missing_models_fail_closed(monkeypatch,tmp_path):
    monkeypatch.setattr(local,'MODEL_DIR',tmp_path)
    assert not local.available()
    with pytest.raises(HTTPException) as e: local.inspect(png(),'.png')
    assert e.value.status_code==503


@pytest.mark.parametrize('kind',['format','pages','pixels','frames'])
def test_input_limits_before_worker(monkeypatch,kind):
    monkeypatch.setattr(local.subprocess,'run',lambda *a,**k:pytest.fail('Worker should not start'))
    data,ext=png(),'.txt'
    if kind=='pages':
        with fitz.open() as doc:
            for _ in range(3):doc.new_page()
            data,ext=doc.tobytes(),'.pdf'
    elif kind=='pixels': data,ext=png((2100,2000)),'.png'
    elif kind=='frames':
        out=io.BytesIO();image=Image.new('RGB',(100,100),'white');image.save(out,format='TIFF',save_all=True,append_images=[image]);data,ext=out.getvalue(),'.tiff'
    with pytest.raises(HTTPException) as e:local.inspect(data,ext)
    assert e.value.status_code in {413,422}


@pytest.mark.parametrize('failure',['timeout','crash','invalid'])
def test_worker_failure_never_returns_a_clean_scan(monkeypatch,failure):
    monkeypatch.setattr(local,'available',lambda:True)
    def run(*args,**kwargs):
        assert kwargs['timeout']==45 and kwargs['input']==png()
        if failure=='timeout':raise subprocess.TimeoutExpired('worker',45)
        return SimpleNamespace(returncode=1 if failure=='crash' else 0,stdout=b'private traceback',stderr=b'sensitive')
    monkeypatch.setattr(local.subprocess,'run',run)
    with pytest.raises(HTTPException) as e:local.inspect(png(),'.png')
    assert e.value.status_code in {503,504}
    assert 'private' not in e.value.detail and 'sensitive' not in e.value.detail


def test_no_text_warns(monkeypatch):
    monkeypatch.setattr(local,'available',lambda:True)
    monkeypatch.setattr(local.subprocess,'run',lambda *a,**k:SimpleNamespace(returncode=0,stdout=b'{"findings":[]}'))
    findings,notes=local.inspect(png(),'.png')
    assert not findings and any('No text was recognized' in x for x in notes)
    assert notes[0].startswith('UNVERIFIED:')


def test_word_coordinates_and_labeled_name():
    output=SimpleNamespace(txts=('Name: Alex Example',),scores=(.8,),
        boxes=np.array([[[0,0],[180,0],[180,20],[0,20]]]),
        word_results=((('Name:',.9,[[0,0],[45,0],[45,20],[0,20]]),
                       ('Alex',.8,[[50,0],[95,0],[95,20],[50,20]]),
                       ('Example',.7,[[100,0],[180,0],[180,20],[100,20]])),))
    findings=convert(output,2,400,200,200,100)
    name=next(f for f in findings if f.category=='name_candidate')
    assert name.value=='Alex Example' and name.page==2
    assert name.rectangles==[(100,0,190,40),(200,0,360,40)]
    assert name.public(0)['auto_select'] is False and name.ocr_confidence==.7
    assert any(f.category=='text_region_candidate' for f in findings)
