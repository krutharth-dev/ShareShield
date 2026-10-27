"""Synthetic tests for review-based smart privacy preferences and visual masking."""
from __future__ import annotations

import io

import fitz
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from backend import engine, smart
from backend.app import app
from backend.patterns import valid_aadhaar_format

client = TestClient(app)


def upload_image() -> bytes:
    image = Image.new("RGB", (200, 150), "white")
    draw = ImageDraw.Draw(image)
    for index in range(20, 80, 10):
        draw.rectangle((index, 20, index + 5, 80), fill=(40, 110, 170))
    draw.rectangle((110, 20, 175, 90), fill=(70, 60, 90))
    saved = io.BytesIO()
    image.save(saved, format="PNG")
    return saved.getvalue()


def valid_sample_id():
    prefix = "23456789012"
    return next(prefix + str(check) for check in range(10)
                if valid_aadhaar_format(prefix + str(check)))


def test_labeled_identity_dob_vid_name_and_address():
    number = valid_sample_id()
    payload = (
        f"Aadhaar No: {number}\n"
        "VID: 1111 2222 3333 4444\n"
        "Name: Fictional Example\n"
        "Address: Imaginary Street 12, Example City\n"
        "DOB: 08/08/2006\n"
    ).encode("utf-8")
    r = client.post("/analyze", files={"file": ("sample.txt", payload)})
    assert r.status_code == 200, r.text
    categories = {x["category"] for x in r.json()["findings"]}
    assert {"aadhaar_candidate", "vid_candidate", "name_candidate",
            "address_candidate", "dob_candidate"} <= categories


def test_matching_identifier_redacted_across_pdf_pages(monkeypatch):
    # Native PDF text is enough; avoid dependence on OCR version/fonts.
    monkeypatch.setattr(engine, "ocr_available", lambda: False)
    monkeypatch.setattr(smart, "available", lambda: False)
    with fitz.open() as document:
        for _ in range(2):
            page = document.new_page()
            page.insert_text((50, 80), f"Aadhaar: {valid_sample_id()}")
        data = document.tobytes()
    response = client.post("/analyze", files={"file": ("twice.pdf", data)})
    assert response.status_code == 200, response.text
    info = response.json()
    ids = [x["id"] for x in info["findings"] if x["category"] == "aadhaar_candidate"]
    assert len(ids) == 2
    output = client.post(
        "/redact",
        files={"file": ("twice.pdf", data)},
        data={"analysis_id": info["analysis_id"], "selected_ids": str(ids[0]),
              "redact_all": "true", "redaction_mode": "blackout"},
    )
    assert output.status_code == 200, output.text
    with fitz.open(stream=output.content, filetype="pdf") as exported:
        assert exported.page_count == 2
        for page in exported:
            assert valid_sample_id() not in page.get_text()
    verification = client.post(
        "/verify",
        files={"file": ("twice.pdf", data),
               "redacted": ("shareshield-redacted.pdf", output.content)},
        data={"analysis_id": info["analysis_id"], "selected_ids": str(ids[0]),
              "redact_all": "true", "redaction_mode": "blackout"},
    )
    assert verification.status_code == 200, verification.text
    assert verification.json()["selected_count"] == 2


def test_face_blur_and_qr_blackout_are_explicitly_unverified(monkeypatch):
    monkeypatch.setattr(engine, "ocr_available", lambda: False)

    def fake_regions(_image, page, scale=1):
        return [
            engine.Finding("face_candidate", "Face candidate 1", page,
                           [(20, 20, 80, 80)]),
            engine.Finding("qr_candidate", "QR candidate 2", page,
                           [(110, 20, 175, 90)]),
        ]

    monkeypatch.setattr(smart, "regions", fake_regions)
    img = upload_image()
    analysis = client.post("/analyze", files={"file": ("photo.png", img)})
    assert analysis.status_code == 200, analysis.text
    info = analysis.json()
    categories = {x["category"] for x in info["findings"]}
    assert categories == {"face_candidate", "qr_candidate"}
    selected_ids = ",".join(str(item["id"]) for item in info["findings"])
    output = client.post(
        "/redact", files={"file": ("photo.png", img)},
        data={"analysis_id": info["analysis_id"], "selected_ids": selected_ids,
              "redaction_mode": "pixelate"},
    )
    assert output.status_code == 200, output.text
    processed = Image.open(io.BytesIO(output.content))
    assert processed.getpixel((135, 50)) == (0, 0, 0)  # Codes always blacked out.
    assert processed.getpixel((32, 33)) != (0, 0, 0)  # Face pixels were pixelated.
    verification = client.post(
        "/verify",
        files={"file": ("photo.png", img),
               "redacted": ("shareshield-redacted.png", output.content)},
        data={"analysis_id": info["analysis_id"], "selected_ids": selected_ids,
              "redaction_mode": "pixelate"},
    )
    assert verification.status_code == 200
    assert verification.json()["status"] == "UNVERIFIED"


def test_pdf_blur_flattens_original_text(monkeypatch):
    monkeypatch.setattr(engine, "ocr_available", lambda: False)
    monkeypatch.setattr(smart, "available", lambda: False)
    with fitz.open() as doc:
        page = doc.new_page(width=300, height=220)
        page.insert_text((70, 100), "Fictional private information")
        original = doc.tobytes()
    info = client.post("/analyze", files={"file": ("manual.pdf", original)}).json()
    manual = '[{"page":1,"x":0.1,"y":0.2,"w":0.8,"h":0.5}]'
    output = client.post(
        "/redact", files={"file": ("manual.pdf", original)},
        data={"analysis_id": info["analysis_id"],
              "manual_regions": manual, "redaction_mode": "blur"},
    )
    assert output.status_code == 200, output.text
    with fitz.open(stream=output.content, filetype="pdf") as exported:
        assert exported[0].get_text().strip() == ""  # No original text layer.
        assert exported[0].get_images()
    report = client.post(
        "/verify",
        files={"file": ("manual.pdf", original),
               "redacted": ("shareshield-redacted.pdf", output.content)},
        data={"analysis_id": info["analysis_id"], "manual_count": "1",
              "redaction_mode": "blur"},
    )
    assert report.status_code == 200, report.text
    assert report.json()["status"] == "UNVERIFIED"


def test_invalid_visual_effect_rejected():
    img = upload_image()
    info = client.post("/analyze", files={"file": ("fake.png", img)}).json()
    response = client.post(
        "/redact", files={"file": ("fake.png", img)},
        data={"analysis_id": info["analysis_id"],
              "manual_regions": '[{"page":1,"x":0.1,"y":0.1,"w":0.3,"h":0.3}]',
              "redaction_mode": "unrecognized"},
    )
    assert response.status_code == 422
