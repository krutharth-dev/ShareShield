"""Offline fallback tests: force missing external OCR even when CI has it."""
import io
import json

import fitz
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from backend import engine
from backend.app import app

client = TestClient(app)


def test_searchable_pdf_still_works_when_tesseract_missing(monkeypatch):
    monkeypatch.setattr(engine, "ocr_available", lambda: False)
    with fitz.open() as pdf:
        page = pdf.new_page()
        page.insert_text((75, 100), "demo@example.org")
        data = pdf.tobytes()

    response = client.post("/analyze", files={"file": ("sample.pdf", data)})
    assert response.status_code == 200, response.text
    analysis = response.json()
    assert any(f["value"] == "demo@example.org" for f in analysis["findings"])
    assert any("OCR is unavailable" in note for note in analysis["limitations"])
    assert client.get("/health").json()["ocr_available"] is False

    output = client.post("/redact",
                         files={"file": ("sample.pdf", data)},
                         data={"analysis_id": analysis["analysis_id"],
                               "selected_ids": ",".join(str(f["id"]) for f in analysis["findings"])})
    assert output.status_code == 200, output.text
    with fitz.open(stream=output.content, filetype="pdf") as exported:
        assert "demo@example.org" not in exported[0].get_text()


def test_manual_image_redaction_without_tesseract(monkeypatch):
    monkeypatch.setattr(engine, "ocr_available", lambda: False)
    image = Image.new("RGB", (220, 120), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((50, 40, 145, 80), fill="black")
    raw = io.BytesIO()
    image.save(raw, format="PNG")
    data = raw.getvalue()

    analysis_response = client.post("/analyze", files={"file": ("screenshot.png", data)})
    assert analysis_response.status_code == 200, analysis_response.text
    analysis = analysis_response.json()
    assert not analysis["findings"]
    assert any("no text was scanned" in warning for warning in analysis["limitations"])

    response = client.post("/redact",
                           files={"file": ("screenshot.png", data)},
                           data={"analysis_id": analysis["analysis_id"],
                                 "manual_regions": json.dumps([{"page": 1, "x": .1, "y": .2, "w": .7, "h": .6}])})
    assert response.status_code == 200, response.text
    assert response.headers["X-ShareShield-Verification"] == "UNVERIFIED"
    assert response.content.startswith(b"\x89PNG")
    verify = client.post("/verify",
                         files={"file": ("screenshot.png", data),
                                "redacted": ("shareshield-redacted.png", response.content)},
                         data={"analysis_id": analysis["analysis_id"], "manual_count": 1})
    assert verify.status_code == 200, verify.text
    report = verify.json()
    assert report["status"] == "UNVERIFIED"
    assert any("OCR is unavailable" in msg for msg in report["unverified"])
    assert any("OCR NOT available" in item for item in report["checks"])
