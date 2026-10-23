"""Tests of resource limits, graceful failures, and synthetic demo generation."""
from __future__ import annotations

import io
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from backend import engine
from backend.app import app

client = TestClient(app)


def test_large_declared_multipart_rejected_early():
    # The server rejects oversized bodies before multipart decoding.
    body = b"not a multipart body"
    response = client.post(
        "/analyze",
        content=body,
        headers={
            "Content-Type": "application/octet-stream",
            "Content-Length": str(engine.MAX_BYTES + 1024 * 1024 + 1),
        },
    )
    assert response.status_code == 413, response.text
    response = client.post(
        "/verify",
        content=body,
        headers={
            "Content-Type": "application/octet-stream",
            "Content-Length": str(engine.MAX_BYTES * 2 + 1024 * 1024 + 1),
        },
    )
    assert response.status_code == 413, response.text


def test_too_many_identifiers_rejected():
    fake_content = b" ".join([b"demo@example.org"] * (engine.MAX_FINDINGS + 1))
    response = client.post("/analyze", files={"file": ("lots.txt", fake_content)})
    assert response.status_code == 413, response.text
    assert "too many" in response.text.lower()


def test_ocr_runtime_timeout_returned_cleanly(monkeypatch):
    monkeypatch.setattr(engine, "ocr_available", lambda: True)

    def timed_out(*args, **kwargs):
        assert kwargs["timeout"] == engine.OCR_TIMEOUT_SECONDS
        raise RuntimeError("Tesseract process timeout")

    monkeypatch.setattr(engine.pytesseract, "image_to_data", timed_out)
    img = Image.new("RGB", (64, 64), "white")
    data = io.BytesIO()
    img.save(data, format="PNG")
    response = client.post("/analyze", files={"file": ("image.png", data.getvalue())})
    assert response.status_code == 504, response.text
    assert "timed out" in response.json()["detail"].lower()


def test_generate_fictional_demo_files(tmp_path: Path):
    root = Path(__file__).resolve().parents[2]
    script = root / "scripts" / "generate-demo-files.py"
    generated = tmp_path / "demo-output"
    output = subprocess.run(
        [sys.executable, str(script), "--output", str(generated)],
        check=True,
        capture_output=True,
        text=True,
    )
    assert "fictional" in output.stdout.lower()
    expected = {
        "sample.txt", "sample.csv", "sample.png", "sample.jpg",
        "sample-searchable.pdf", "sample-scanned.pdf",
        "sample.docx", "sample.pptx", "sample.xlsx",
    }
    assert expected == {file.name for file in generated.iterdir()}
    for name in expected:
        assert (generated / name).stat().st_size > 0
