"""Verify immutable preview assets and independently inspect synthetic live exports.

The supplemental Python scope never overrides the browser app's face/QR warnings.
No real personal documents or deployment credentials are used.
"""
import hashlib
import json
import os
from pathlib import Path
import sys
import urllib.request
from urllib.parse import urljoin, urlparse

PREVIEW_ORIGIN = 'https://5d01da12.shareshield-mini.pages.dev'
PREVIEW_SHA = 'f24fc6b51879a465ec7038b14113d0983b43b69a'
ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = Path(os.environ.get('SHARESHIELD_EVIDENCE_DIR', '/tmp/shareshield-live-evidence'))

def save(name, value):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / name).write_text(json.dumps(value, indent=2), encoding='utf-8')

def assets():
    target = os.environ.get('TEST_URL', PREVIEW_ORIGIN + '/app')
    parsed = urlparse(target)
    if parsed.scheme != 'https' or parsed.netloc != urlparse(PREVIEW_ORIGIN).netloc:
        raise ValueError('Only the pinned isolated preview may be checked by this job')
    checked = []
    for path in sorted((ROOT / 'frontend/dist/assets').rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT / 'frontend/dist').as_posix()
        request = urllib.request.Request(urljoin(PREVIEW_ORIGIN + '/', relative), headers={'Accept-Encoding':'identity'})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        expected = hashlib.sha256(path.read_bytes()).hexdigest()
        actual = hashlib.sha256(data).hexdigest()
        if actual != expected:
            raise AssertionError('Preview asset differs from tested runtime: ' + relative)
        checked.append({'path':relative, 'sha256':actual, 'size_bytes':len(data)})
    if len(checked) < 4:
        raise AssertionError('Expected the complete compiled runtime asset set')
    save('runtime-assets.json', {'preview':PREVIEW_ORIGIN, 'deployed_commit':PREVIEW_SHA, 'checked_assets':checked})
    print('PASS live preview runtime hashes match all local compiled assets')

def exports():
    sys.path.insert(0, str(ROOT))
    from backend.verification.pdf_verifier import VerificationInput, verify_pdf
    from unittest.mock import patch
    import fitz
    from pypdf import PdfReader
    selected = ['demo.person@example.test', 'ABCDE1234F', 'DemoSecret_4829']
    output = EVIDENCE / 'redacted-two-page.pdf'
    redacted = verify_pdf(VerificationInput(output, selected_findings=selected, timeout_seconds=90))
    assert redacted['status'] == 'SCOPED_CLEAR', redacted
    flagged = verify_pdf(VerificationInput(EVIDENCE / 'flagged-reference.pdf', selected_findings=selected, timeout_seconds=90))
    assert flagged['status'] == 'FLAG', flagged
    with patch('backend.verification.pdf_verifier.shutil.which', return_value=None):
        unavailable = verify_pdf(VerificationInput(output, selected_findings=selected))
    assert unavailable['status'] == 'UNVERIFIED', unavailable
    with fitz.open(output) as doc:
        assert len(doc) == 2
        assert not ''.join(page.get_text() for page in doc)
    ten = EVIDENCE / 'redacted-ten-page.pdf'
    with fitz.open(ten) as doc:
        assert len(doc) == 10
        assert doc.embfile_count() == 0
        assert 'FAKE_SOURCE_METADATA_SECRET_DO_NOT_RETAIN' not in str(doc.metadata)
    assert not list((PdfReader(str(ten)).attachments or {}).keys())
    text = (EVIDENCE / 'redacted.txt').read_text()
    for value in ['fictional@example.test', 'DummySecret4829', 'TEST2026A']:
        assert value not in text
    report = {
        'preview':PREVIEW_ORIGIN,
        'deployed_commit':PREVIEW_SHA,
        'scope':'Supplemental saved-byte PDF text, native Tesseract English OCR, metadata and attachments. Face/QR and handwriting clearance are not established.',
        'redacted_pdf':redacted,
        'intentionally_unredacted_pdf':flagged,
        'missing_ocr_dependency':unavailable,
        'sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [output, ten, EVIDENCE/'redacted.txt']},
    }
    save('independent-export-verification.json', report)
    print('PASS live saved exports: native text/OCR/metadata checks; FLAG, UNVERIFIED and SCOPED_CLEAR within declared Python scope')

if __name__ == '__main__':
    {'assets':assets, 'exports':exports}[sys.argv[1]]()
