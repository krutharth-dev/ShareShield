"""Displayed masks must hit their targets on rotated PDFs (fictional text)."""
import fitz
import pytest
from PIL import Image
from backend import engine, review


@pytest.mark.parametrize('rotation', [0, 90, 180, 270])
@pytest.mark.parametrize('manual,mode', [(True, 'blackout'), (False, 'blackout'),
                                         (False, 'blur'), (False, 'pixelate')])
def test_rotated_pdf_masks_match_preview(rotation, mode, manual):
    with fitz.open() as doc:
        page = doc.new_page(width=400, height=600)
        page.insert_text((50, 100), 'demo@example.org')
        page.insert_text((50, 220), 'PUBLIC HEADING')
        page.set_rotation(rotation)
        expected = page.search_for('demo@example.org')[0] * page.rotation_matrix
        bounds = page.rect
        data = doc.tobytes()
    findings, _ = engine.inspect(data, '.pdf')
    email = next(f for f in findings if f.category == 'email')
    assert tuple(email.rectangles[0]) == pytest.approx(tuple(expected))
    # Manual privacy masks are tested with blackout. Detected text must remain
    # blacked out even when the user chooses blur/pixelate for visual content.
    regions = [{'page':1, 'x':expected.x0/bounds.width, 'y':expected.y0/bounds.height,
                'w':expected.width/bounds.width, 'h':expected.height/bounds.height}] if manual else []
    actual_mode = 'blackout' if manual else mode
    output, _, _ = review.redact_visual(data, '.pdf', [] if manual else [email], regions, actual_mode)
    with fitz.open(stream=output, filetype='pdf') as doc:
        page = doc[0]
        assert 'demo@example.org' not in page.get_text()
        if actual_mode == 'blackout':
            assert 'PUBLIC HEADING' in page.get_text()
        pix = page.get_pixmap(alpha=False)
        image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
        center = (int((expected.x0 + expected.x1)/2), int((expected.y0 + expected.y1)/2))
        assert image.getpixel(center) == (0, 0, 0)
        assert (pix.width, pix.height) == (int(bounds.width), int(bounds.height))


@pytest.mark.parametrize('rotation', [90, 180, 270])
def test_direct_engine_pdf_redaction_uses_display_coordinates(rotation):
    with fitz.open() as doc:
        page = doc.new_page(width=400, height=600)
        page.insert_text((50, 100), 'demo@example.org')
        page.set_rotation(rotation)
        data = doc.tobytes()
    findings, _ = engine.inspect(data, '.pdf')
    output, _, _ = engine.redact(data, '.pdf', findings)
    with fitz.open(stream=output, filetype='pdf') as doc:
        assert 'demo@example.org' not in doc[0].get_text()
