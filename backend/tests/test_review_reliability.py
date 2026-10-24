import io
import fitz
from fastapi.testclient import TestClient
from backend import engine, review, snapshots
from backend.app import app

client = TestClient(app)


def test_export_uses_exact_review_without_reocr(monkeypatch):
    data = b'Name: Sample Person\nEmail: fictional@example.org'
    info = client.post('/analyze', files={'file': ('sample.txt', data)}).json()
    selected = next(f['id'] for f in info['findings'] if f['category'] == 'email')
    real = engine.inspect
    def inspect(payload, ext):
        assert payload != data, 'Original was reanalyzed after review'
        return real(payload, ext)
    monkeypatch.setattr(engine, 'inspect', inspect)
    result = client.post('/redact', files={'file': ('sample.txt', data)},
                         data={'analysis_id': info['analysis_id'], 'selected_ids': str(selected)})
    assert result.status_code == 200, result.text
    assert b'fictional@example.org' not in result.content
    assert b'Sample Person' in result.content


def test_snapshot_is_bound_to_source_and_expires(monkeypatch):
    token = snapshots.save(b'fictional', '.txt', [], [])
    from fastapi import HTTPException
    import pytest
    with pytest.raises(HTTPException) as error:
        snapshots.get(token, b'different', '.txt')
    assert error.value.status_code == 409
    monkeypatch.setattr(snapshots.time, 'monotonic', lambda: float('inf'))
    with pytest.raises(HTTPException) as error:
        snapshots.get(token, b'fictional', '.txt')
    assert error.value.status_code == 409


def test_every_incomplete_warning_prevents_pass(monkeypatch):
    monkeypatch.setattr(engine, 'inspect', lambda *a: ([], ['UNVERIFIED: A focused section could not be read.']))
    report = review.evaluate([engine.Finding('email', 'fictional@example.org', 1, [])], b'redacted', '.txt')
    assert report['status'] == 'UNVERIFIED'


def test_searchable_identity_name_and_public_header():
    doc = fitz.open(); p = doc.new_page()
    for y, text in [(50, 'Government of India'), (100, 'SAMPLE PERSON'), (125, 'DOB: 01/01/2000')]:
        p.insert_text((50, y), text)
    data = doc.tobytes(); doc.close()
    findings, _ = engine.inspect(data, '.pdf')
    names = [f for f in findings if f.category == 'name_candidate']
    assert any(f.value == 'SAMPLE PERSON' for f in names)
    assert all('Government' not in f.value for f in findings)
    result, _, _ = review.redact_visual(data, '.pdf', findings, [])
    with fitz.open(stream=result, filetype='pdf') as exported:
        assert 'Government of India' in exported[0].get_text()
        assert 'SAMPLE PERSON' not in exported[0].get_text()


def test_contextual_identifiers_and_generic_numbers():
    examples = {'passport_candidate': 'Passport: Z1234567', 'voter_candidate': 'EPIC: ABC1234567',
                'bank_account_candidate': 'Account Number: 123456789012345',
                'patient_id_candidate': 'MRN: FICTION123', 'credential_candidate': 'api_key=fake_test_1234'}
    for category, text in examples.items():
        assert category in {f.category for f in engine.scan_text(text, 1)}
    assert not engine.scan_text('Attendance 12345\nGovernment of India\nPublic opening hours 10:00', 1)
    public = engine.Finding('id12_candidate', '2345 6789 0123', 1, [(0,0,10,10)]).public(0)
    assert not public['auto_select']


def test_cancelled_caller_keeps_worker_busy():
    import asyncio
    import threading
    from backend import app as api
    started, finish = threading.Event(), threading.Event()
    def slow():
        started.set()
        finish.wait(3)
    async def scenario():
        task = asyncio.create_task(api.document_job(slow))
        while not started.is_set():
            await asyncio.sleep(.01)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        assert api.DOCUMENT_WORK_SLOT.locked()
        finish.set()
        for _ in range(100):
            if not api.DOCUMENT_WORK_SLOT.locked():
                break
            await asyncio.sleep(.01)
        assert not api.DOCUMENT_WORK_SLOT.locked()
    asyncio.run(scenario())
