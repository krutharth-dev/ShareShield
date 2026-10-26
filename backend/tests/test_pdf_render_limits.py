import io
import pymupdf as fitz
import pytest
from fastapi import HTTPException
from PIL import Image
from backend import engine, review


def pdf(width, height, rotation=0):
    with fitz.open() as doc:
        page = doc.new_page(width=width, height=height)
        page.set_rotation(rotation)
        return doc.tobytes()


@pytest.mark.parametrize('rotation', [0, 90])
def test_tall_preview_bounds_both_dimensions(rotation):
    output = review.preview(pdf(100, 10000, rotation), '.pdf', 1)
    with Image.open(io.BytesIO(output)) as image:
        assert max(image.size) <= 1400
        assert min(image.size) == 14


@pytest.mark.parametrize('operation', ['scan', 'blur', 'pixelate'])
def test_oversized_render_rejected_before_allocation(monkeypatch, operation):
    data = pdf(5000, 5000)
    def forbidden(*args, **kwargs):
        pytest.fail('Oversized raster allocation was attempted')
    monkeypatch.setattr(fitz.Page, 'get_pixmap', forbidden)
    monkeypatch.setattr(engine, 'ocr_available', lambda: True)
    with pytest.raises(HTTPException) as exc:
        if operation == 'scan':
            with engine.open_pdf(data) as doc:
                engine._pdf_findings(doc)
        else:
            review.redact_visual(data, '.pdf', [], [], operation)
    assert exc.value.status_code == 413
