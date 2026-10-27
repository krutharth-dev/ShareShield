"""Fictional labels: missed names and neighboring public text must stay separate."""
from types import SimpleNamespace
import numpy as np
import pytest
from backend import engine
from backend.local_handwriting_worker import convert


@pytest.mark.parametrize('name', ["Alex O'Example", 'Anne-Marie Example', 'José Example', 'Alex Example'])
@pytest.mark.parametrize('newline', ['\n', '\r\n'])
def test_labeled_names_accept_common_spelling_and_windows_newlines(name, newline):
    text = f'Name: {name}{newline}PUBLIC HEADING{newline}'
    names = [f for f in engine.scan_text(text, 1) if f.category == 'name_candidate']
    assert len(names) == 1
    assert names[0].value == f'Name: {name}'


@pytest.mark.parametrize('label', ['Name', 'Address'])
def test_blank_label_does_not_consume_next_line(label):
    assert not engine.scan_text(f'{label}:\nPUBLIC HEADING\n', 1)


def test_handwriting_line_breaks_do_not_invent_identifiers():
    texts = ['Email: demo@example.org', 'Phone: 9876543210', 'Address: 12 Example Road', 'PUBLIC HEADING', '4111 1111', '1111 1111']
    boxes, groups = [], []
    for i, text in enumerate(texts):
        y = 20 + i * 45
        boxes.append([[10, y], [390, y], [390, y+25], [10, y+25]])
        words = text.split()
        groups.append(tuple((word, .9, [[10+j*70, y], [70+j*70, y], [70+j*70, y+25], [10+j*70, y+25]]) for j, word in enumerate(words)))
    result = SimpleNamespace(txts=texts, scores=[.9]*len(texts), boxes=np.array(boxes), word_results=groups)
    findings = convert(result, 1, 400, 400, 400, 400)
    assert not any(f.category == 'payment_card_candidate' for f in findings)
    addresses = [f for f in findings if f.category == 'address_candidate']
    assert addresses and all('PUBLIC' not in f.value for f in addresses)
    assert all(r[3] <= 135 for f in addresses for r in f.rectangles)


def test_name_redaction_roundtrip_preserves_public_text():
    from fastapi.testclient import TestClient
    from backend.app import app
    source = "Name: Alex O'Example\r\nPUBLIC HEADING\r\n".encode()
    with TestClient(app) as client:
        files = {'file': ('fictional.txt', source)}
        analysis = client.post('/analyze', files=files)
        assert analysis.status_code == 200
        info = analysis.json()
        name = next(f for f in info['findings'] if f['category'] == 'name_candidate')
        output = client.post('/redact', files=files, data={'analysis_id': info['analysis_id'], 'selected_ids': str(name['id'])})
        assert output.status_code == 200, output.text
        assert b"O'Example" not in output.content
        assert b'PUBLIC HEADING\r\n' in output.content
        assert b'[REDACTED]' in output.content


def test_native_pdf_name_removed_without_covering_next_line(monkeypatch):
    import fitz
    from backend import review, smart
    monkeypatch.setattr(engine, 'ocr_available', lambda: False)
    monkeypatch.setattr(smart, 'available', lambda: False)
    with fitz.open() as doc:
        page = doc.new_page()
        page.insert_text((50, 70), "Name: Alex O'Example")
        page.insert_text((50, 120), 'PUBLIC HEADING')
        source = doc.tobytes()
    findings, _ = engine.inspect(source, '.pdf')
    names = [f for f in findings if f.category == 'name_candidate']
    assert names and all(f.rectangles for f in names)
    output, _, _ = review.redact_visual(source, '.pdf', names, [])
    with fitz.open(stream=output, filetype='pdf') as doc:
        assert "O'Example" not in doc[0].get_text()
        assert 'PUBLIC HEADING' in doc[0].get_text()
