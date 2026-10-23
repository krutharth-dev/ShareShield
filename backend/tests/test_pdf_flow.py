"""Tests use synthetic information only; never real identities."""
import io

import fitz
from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def sample_pdf() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 100), "Email: demo@example.org")
    page.insert_text((72, 130), "Phone: 9876543210")
    data = doc.tobytes()
    doc.close()
    return data


def test_analyze_and_redact():
    source = sample_pdf()
    upload = {"file": ("sample.pdf", io.BytesIO(source), "application/pdf")}
    response = client.post("/analyze", files=upload)
    assert response.status_code == 200
    findings = response.json()["findings"]
    assert {f["category"] for f in findings} == {"email", "indian_mobile_candidate"}
    assert all(f["locatable"] for f in findings)

    redacted = client.post(
        "/redact",
        files={"file": ("sample.pdf", io.BytesIO(source), "application/pdf")},
        data={"selected_ids": ",".join(str(f["id"]) for f in findings)},
    )
    assert redacted.status_code == 200
    assert redacted.headers["X-ShareShield-Verification"] == "PASS-SCOPED-TEXT-ONLY"
    assert source != redacted.content
    with fitz.open(stream=redacted.content, filetype="pdf") as doc:
        assert "demo@example.org" not in doc[0].get_text()
        assert "9876543210" not in doc[0].get_text()


def test_rejects_invalid_inputs():
    assert client.post("/analyze", files={"file": ("note.txt", b"hello")}).status_code == 415
    assert client.post("/analyze", files={"file": ("bad.pdf", b"not a pdf")}).status_code == 422
    assert client.post(
        "/redact",
        files={"file": ("sample.pdf", sample_pdf())},
        data={"selected_ids": "999"},
    ).status_code == 422
