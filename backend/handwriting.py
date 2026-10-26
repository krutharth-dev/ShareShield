"""Opt-in Azure Read adapter. Never invoked by ordinary scans or export checks."""
import hmac
import io
import math
import os
import re
import threading
import time
from urllib.parse import urlsplit

import pymupdf as fitz
import httpx
from fastapi import HTTPException
from PIL import Image
from backend import engine

NOTICE = 'UNVERIFIED: Cloud handwriting recognition can miss or misread text. Export is checked with local OCR only, not independent handwriting recognition. Visually inspect every page.'
_lock = threading.Lock()
_day = ''
_used = 0


def config():
    endpoint = os.getenv('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', '').rstrip('/')
    key = os.getenv('AZURE_DOCUMENT_INTELLIGENCE_KEY', '')
    code = os.getenv('SHARESHIELD_HANDWRITING_ACCESS_CODE', '')
    valid = re.fullmatch(r'https://[a-zA-Z0-9-]+\.cognitiveservices\.azure\.com', endpoint)
    return (endpoint, key, code) if valid and key and len(code) >= 16 else None


def authorize(consent, code):
    if not consent:
        raise HTTPException(422, 'Explicit consent to send page images to Azure is required.')
    settings = config()
    if not settings:
        raise HTTPException(503, 'Handwriting recognition is not configured. Use standard scanning or manual masks.')
    if not hmac.compare_digest(code.encode(), settings[2].encode()):
        raise HTTPException(403, 'Invalid handwriting access code.')


def reserve(pages):
    global _day, _used
    with _lock:
        today = time.strftime('%Y-%m-%d', time.gmtime())
        if today != _day:
            _day, _used = today, 0
        if _used + pages > 20:
            raise HTTPException(429, 'Handwriting page allowance reached. Use standard scanning or manual masks.')
        _used += pages  # Attempts count even on provider failures; never auto-retry submissions.


def read_page(payload):
    settings = config()
    if not settings:
        raise HTTPException(503, 'Handwriting recognition is not configured.')
    endpoint, key, _ = settings
    prefix = endpoint + '/documentintelligence/documentModels/prebuilt-read/analyzeResults/'
    url = endpoint + '/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-11-30&locale=en-US'
    operation = None
    cleanup_ok = True
    result = None
    try:
        with httpx.Client(timeout=15, follow_redirects=False) as client:
            headers = {'Ocp-Apim-Subscription-Key': key}
            response = client.post(url, content=payload, headers={**headers, 'Content-Type':'image/png'})
            if response.status_code != 202:
                raise HTTPException(502, 'Handwriting provider rejected the request. Check its configuration or quota.')
            candidate = response.headers.get('Operation-Location', '')
            parsed = urlsplit(candidate)
            if not candidate.startswith(prefix) or parsed.fragment or not re.fullmatch(r'[a-zA-Z0-9-]+', parsed.path.rsplit('/', 1)[-1]):
                raise HTTPException(502, 'Handwriting provider returned an invalid operation location.')
            operation = candidate
            try:
                deadline = time.monotonic() + 60
                while time.monotonic() < deadline:
                    response = client.get(operation, headers=headers)
                    response.raise_for_status()
                    body = response.json()
                    if body.get('status') == 'succeeded':
                        result = body['analyzeResult']
                        break
                    if body.get('status') not in {'running', 'notStarted'}:
                        raise HTTPException(502, 'Handwriting recognition failed. Try a clearer scan or manual masks.')
                    time.sleep(1)
                if result is None:
                    raise HTTPException(504, 'Handwriting recognition timed out. No automatic retry was made.')
            finally:
                try:
                    cleanup_ok = client.delete(operation, headers=headers).status_code in {200, 202, 204, 404}
                except httpx.HTTPError:
                    cleanup_ok = False
    except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise HTTPException(502, 'Handwriting service could not complete the scan. Use manual masks or retry explicitly.') from exc
    return result, cleanup_ok


def parse_result(result, page_number, width, height):
    pages = result.get('pages', [])
    if len(pages) != 1 or pages[0].get('unit') != 'pixel':
        raise ValueError('Unexpected page geometry')
    page = pages[0]
    source_w, source_h = float(page['width']), float(page['height'])
    if not all(math.isfinite(x) and x > 0 for x in (source_w, source_h)):
        raise ValueError('Invalid page size')

    def box(item):
        polygon = item['polygon']
        if len(polygon) != 8 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in polygon):
            raise ValueError('Invalid word geometry')
        xs, ys = polygon[::2], polygon[1::2]
        if min(xs) < 0 or min(ys) < 0 or max(xs) > source_w + 1 or max(ys) > source_h + 1:
            raise ValueError('Geometry outside page')
        rect = (min(xs)*width/source_w, min(ys)*height/source_h,
                min(max(xs),source_w)*width/source_w, min(max(ys),source_h)*height/source_h)
        if rect[2] <= rect[0] or rect[3] <= rect[1]:
            raise ValueError('Empty word geometry')
        return rect

    words = page.get('words', [])
    if len(words) > 5000:
        raise ValueError('Too many words')
    text, spans = '', []
    for word in words:
        value = word['content']
        if not isinstance(value, str) or len(value) > 2000:
            raise ValueError('Invalid text')
        confidence = float(word.get('confidence', 0))
        if not math.isfinite(confidence) or not 0 <= confidence <= 1:
            raise ValueError('Invalid confidence')
        start = len(text)
        text += value + ' '
        spans.append((start, start+len(value), box(word), confidence))
    def rectangles(value, start, end):
        return [rect for a,b,rect,c in spans if a < end and b > start]
    findings = engine.scan_text(text, page_number, rectangles, 'cloud-handwriting')
    rows = [(line['content'], box(line)) for line in page.get('lines', [])]
    from backend.ocr_fields import inferred_identity_fields
    findings.extend(inferred_identity_fields(rows, page_number))
    # Every line is also selectable, including unclassified names and missed IDs.
    for label, rect in rows:
        findings.append(engine.Finding('text_region_candidate', label, page_number, [rect], 'cloud-handwriting'))
    for finding in findings:
        finding.location = 'cloud-handwriting'
        scores = [c for a,b,rect,c in spans if any(fitz.Rect(rect).intersects(fitz.Rect(r)) for r in finding.rectangles)]
        finding.ocr_confidence = min(scores) if scores else 0.0
    return findings


def inspect(data, ext):
    if ext not in engine.IMAGE_EXTENSIONS | {'.pdf'}:
        raise HTTPException(422, 'Handwriting mode accepts images and PDFs only.')
    if ext == '.pdf':
        with engine.open_pdf(data) as doc:
            if doc.page_count > 2:
                raise HTTPException(422, 'Handwriting mode supports at most two pages per document.')
            reserve(doc.page_count)
            images = []
            for page in doc:
                scale = min(2, 2000/max(page.rect.width, page.rect.height))
                pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                images.append((Image.frombytes('RGB', (pix.width,pix.height),pix.samples), page.rect.width, page.rect.height))
    else:
        image = engine.read_image(data)
        width, height = image.size
        image.thumbnail((2000,2000))
        reserve(1)
        images = [(image,width,height)]
    findings, notes = [], [NOTICE, 'Page images were sent to Azure Document Intelligence with your consent. English handwriting support is experimental. All cloud findings require explicit selection.']
    for number, (image,width,height) in enumerate(images, 1):
        buffer = io.BytesIO(); image.save(buffer, format='PNG')
        result, cleanup_ok = read_page(buffer.getvalue())
        try:
            findings.extend(parse_result(result, number, width, height))
        except (KeyError, ValueError, TypeError, OverflowError, AttributeError) as exc:
            raise HTTPException(502, 'Handwriting results could not be safely located. Use manual masks.') from exc
        if not cleanup_ok:
            notes.append('UNVERIFIED: Azure result deletion could not be confirmed. Provider retention rules apply.')
    if not findings:
        notes.append('UNVERIFIED: No handwriting was recognized. Use manual masks; this is not a clean-document result.')
    if len(findings) > engine.MAX_FINDINGS:
        raise HTTPException(413, 'Too many handwriting regions. Split the document.')
    return findings, notes
