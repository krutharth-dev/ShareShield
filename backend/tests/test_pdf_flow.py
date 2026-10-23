"""Compatibility smoke test: unsupported file types are rejected."""
from fastapi.testclient import TestClient
from backend.app import app

def test_rejects_bad_extension():
    result = TestClient(app).post("/analyze",files={"file":("sample.exe",b"junk")})
    assert result.status_code == 415
