from pathlib import Path
import fitz
from PIL import Image

from app.services.processing import analyze_file, redact_file
from app.contracts.schemas import Region


def test_pdf_extract_and_redact(tmp_path):
    src = tmp_path / "source.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 80), "Synthetic email: demo@example.test")
    doc.save(src)
    doc.close()

    parsed = analyze_file(src, "f1")
    assert parsed["media_type"] == "application/pdf"
    assert "demo@example.test" in parsed["extracted_content"]["pages"][0]["blocks"][0]["text"]

    out = tmp_path / "redacted.pdf"
    redact_file(src, out, [Region(page=0, x0=45, y0=60, x1=230, y1=90)])
    result = fitz.open(out)
    text = "".join(p.get_text() for p in result)
    assert "demo@example.test" not in text
    result.close()
    assert src.exists()


def test_scanned_pdf_uses_ocr_and_converts_coordinates(tmp_path, monkeypatch):
    import app.services.processing as processing
    src = tmp_path / "scan.pdf"
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    # Create a valid image-backed page fixture.
    import io
    buffer = io.BytesIO()
    Image.new("RGB", (260, 360), "white").save(buffer, format="PNG")
    doc[0].insert_image(fitz.Rect(20, 20, 280, 380), stream=buffer.getvalue())
    doc.save(src)
    doc.close()

    monkeypatch.setattr(processing, "_ocr_image", lambda image: [{
        "text": "scan@example.test",
        "location": {"x0": 100, "y0": 200, "x1": 300, "y1": 240},
        "confidence": 95.0,
    }])
    parsed = analyze_file(src, "f2", ocr_dpi=200)
    content = parsed["extracted_content"]
    assert content["pages"][0]["blocks"][0]["source"] == "ocr"
    scale = 200 / 72
    loc = content["pages"][0]["blocks"][0]["location"]
    assert abs(loc["x0"] - 100 / scale) < 0.01
    assert content["ocr_status"] == "available"


def test_image_redaction_overwrites_pixels(tmp_path):
    src = tmp_path / "source.png"
    Image.new("RGB", (100, 80), "white").save(src)
    out = tmp_path / "redacted.png"
    redact_file(src, out, [Region(x0=10, y0=10, x1=40, y1=40)])
    with Image.open(out) as result:
        assert result.getpixel((20, 20)) == (0, 0, 0)
        assert result.getpixel((70, 70)) == (255, 255, 255)
    assert src.exists()

