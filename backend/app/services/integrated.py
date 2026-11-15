"""Bounded, source-located detection integrating the team's detector and risk engine."""
import io
import uuid
from pathlib import Path
import fitz
from PIL import Image
from backend.detection.engine import detect_sensitive_data
from backend.risk.classifier import classify_risk
from backend.ocr.engine import _run

MAX_PIXELS = 12_000_000
MAX_PAGES = 5

def _findings(text, tokens, page, source):
    out = []
    for f in detect_sensitive_data(text, page=page):
        matched = [t for t in tokens if t['end'] > f.start and t['start'] < f.end]
        if not matched:
            continue
        scores = [t['confidence'] for t in matched if t.get('confidence') is not None]
        out.append({'id': uuid.uuid4().hex, 'category': f.category,
                    'risk': classify_risk(f.category), 'detection_confidence': f.confidence,
                    'ocr_confidence': min(scores) if scores else None,
                    'preview': '••••' + f.value[-3:], 'value': f.value,
                    'page': page, 'source': source,
                    'regions': [t['box'] for t in matched]})
    return out

def analyze_document(path: Path, language='eng'):
    if language not in {'eng', 'hin', 'kan', 'eng+hin+kan'}:
        raise ValueError('Unsupported language')
    findings, warnings = [], ['Handwriting, names, addresses and QR contents require manual review.']
    if path.suffix == '.pdf':
        with fitz.open(path) as doc:
            if doc.is_encrypted or len(doc) > MAX_PAGES or not len(doc):
                raise ValueError('PDF is encrypted, empty, or exceeds five pages')
            for n, page in enumerate(doc):
                if page.rect.width * page.rect.height * 4 > MAX_PIXELS:
                    raise ValueError('Page exceeds pixel limit')
                text, tokens = '', []
                for x0,y0,x1,y1,word,*_ in page.get_text('words', sort=True):
                    start = len(text); text += word + ' '
                    rect=fitz.Rect(x0,y0,x1,y1)*page.rotation_matrix
                    x0,y0,x1,y1=rect
                    tokens.append({'start':start,'end':start+len(word), 'box':{'page':n,'x0':x0,'y0':y0,'x1':x1,'y1':y1}})
                native = _findings(text,tokens,n,'text_layer'); findings.extend(native)
                pix = page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
                image = Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
                optical, notes = _ocr_findings(image,language,n,2)
                findings.extend(optical)  # Keep separate OCR occurrences; value-only dedup loses embedded-image copies.
                warnings.extend(notes)
            if doc.embfile_count():
                warnings.append('Attachments are removed from the exported PDF; their contents are not analyzed.')
    else:
        with Image.open(path) as image:
            if image.width*image.height > MAX_PIXELS:
                raise ValueError('Image exceeds pixel limit')
            findings, notes = _ocr_findings(image.convert('RGB'),language,None,1)
            warnings.extend(notes)
    return findings, list(dict.fromkeys(warnings))

def _ocr_findings(image, language, page, scale):
    result = _run(image,language,page or 0,.60)
    text, tokens = '', []
    for word in result.words:
        start=len(text); text+=word.text+' '; b=word.bbox
        tokens.append({'start':start,'end':start+len(word.text),'confidence':word.confidence,
                       'box':{'page':page,'x0':b['x']/scale,'y0':b['y']/scale,
                              'x1':(b['x']+b['width'])/scale,'y1':(b['y']+b['height'])/scale}})
    return _findings(text,tokens,page,'ocr'), result.warnings

def redact_document(source, output, regions):
    from .processing import redact_file
    from ..contracts.schemas import Region
    # Reuse the team's true content/pixel redaction implementation.
    actual = redact_file(source,output,[Region(**r) for r in regions])
    return actual
