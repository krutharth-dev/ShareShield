import io
import struct
import zipfile
import zlib
from fastapi.testclient import TestClient
from openpyxl import Workbook
from PIL import Image
from backend.app import app


def test_malformed_workbook_xml_is_validation_error():
    source, output = io.BytesIO(), io.BytesIO()
    Workbook().save(source)
    with zipfile.ZipFile(io.BytesIO(source.getvalue())) as original, zipfile.ZipFile(output, 'w') as broken:
        for name in original.namelist():
            broken.writestr(name, b'<broken' if name == 'xl/workbook.xml' else original.read(name))
    r = TestClient(app).post('/analyze', files={'file':('invalid.xlsx',output.getvalue())})
    assert r.status_code == 422


def test_handwriting_header_bomb_rejected_without_model_load(monkeypatch):
    from backend import local_handwriting
    def forbidden(*a, **k): raise AssertionError('worker must not launch')
    monkeypatch.setattr(local_handwriting.subprocess, 'run', forbidden)
    source = io.BytesIO()
    Image.new('RGB',(1,1)).save(source,format='PNG')
    payload = bytearray(source.getvalue())
    payload[16:24] = struct.pack('>II',60000,60000)
    payload[29:33] = struct.pack('>I',zlib.crc32(payload[12:29]))
    r = TestClient(app).post('/analyze',files={'file':('oversized.png',bytes(payload))},
                             data={'handwriting_mode':'true'})
    assert r.status_code == 413


def test_preview_decodes_once_inside_job(monkeypatch):
    from backend import engine
    source = io.BytesIO()
    Image.new('RGB',(600,1800),'white').save(source,format='PNG')
    calls = []
    original = engine.read_image
    def read(data):
        import threading
        calls.append(threading.current_thread().name)
        return original(data)
    monkeypatch.setattr(engine,'read_image',read)
    r = TestClient(app).post('/preview',files={'file':('sample.png',source.getvalue())})
    assert r.status_code == 200
    assert len(calls) == 1 and 'worker' in calls[0].lower()
    assert float(r.headers['X-Document-Width']) == 600
    assert float(r.headers['X-Document-Height']) == 1800
