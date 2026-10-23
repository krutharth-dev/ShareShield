"""Security regression coverage for whole-output checks and safe audit JSON.

Only invented identifiers are used. No real ID scans or records.
"""
from fastapi.testclient import TestClient

from backend.app import app
from backend import engine, review

client = TestClient(app)


def test_leftover_unselected_high_risk_blocks_export():
    original = b"demo@example.org\nPAN: ABCDE1234F\n"
    response = client.post("/analyze", files={"file": ("fixture.txt", original)})
    assert response.status_code == 200
    info = response.json()
    email_id = next(f["id"] for f in info["findings"] if f["category"] == "email")
    redaction = client.post(
        "/redact",
        files={"file": ("fixture.txt", original)},
        data={"analysis_id": info["analysis_id"], "selected_ids": str(email_id)},
    )
    assert redaction.status_code == 409  # PAN not selected, but still detected


def test_unselected_medium_risk_requires_ack_and_report_leaks_no_values():
    original = b"demo@example.org\n9876543210\n"
    info = client.post("/analyze", files={"file": ("fixture.txt", original)}).json()
    email_id = next(f["id"] for f in info["findings"] if f["category"] == "email")
    result = client.post(
        "/redact",
        files={"file": ("fixture.txt", original)},
        data={"analysis_id": info["analysis_id"], "selected_ids": str(email_id)},
    )
    assert result.status_code == 200, result.text
    assert b"demo@example.org" not in result.content
    assert b"9876543210" in result.content
    verify = client.post(
        "/verify",
        files={"file": ("fixture.txt", original),
               "redacted": ("shareshield-redacted.txt", result.content)},
        data={"analysis_id": info["analysis_id"], "selected_ids": str(email_id)},
    )
    assert verify.status_code == 200, verify.text
    report = verify.json()
    assert report["status"] == "UNVERIFIED"
    assert report["remaining_detected_count"] >= 1
    assert report["remaining_high_risk_count"] == 0
    assert any(item["category"] == "indian_mobile_candidate"
               for item in report["remaining_detected"])
    assert "9876543210" not in verify.text
    assert "demo@example.org" not in verify.text


def test_selected_leak_holds_export_and_hides_raw_values():
    chosen = [engine.Finding("aadhaar_candidate", "234567890123", 1, [], "plain-text")]
    report = review.evaluate(chosen, b"234567890123", ".txt")
    assert report["status"] == "FLAG"
    assert report["remaining_selected_count"] == 1
    assert "234567890123" not in str(report)


def test_all_redacted_can_pass_scoped_but_never_claims_sanitized():
    original = b"demo@example.org\n"
    info = client.post("/analyze", files={"file": ("fixture.txt", original)}).json()
    result = client.post(
        "/redact", files={"file": ("fixture.txt", original)},
        data={"analysis_id": info["analysis_id"], "selected_ids": "0"},
    )
    assert result.status_code == 200, result.text
    report = client.post(
        "/verify",
        files={"file": ("fixture.txt", original),
               "redacted": ("shareshield-redacted.txt", result.content)},
        data={"analysis_id": info["analysis_id"], "selected_ids": "0"},
    ).json()
    assert report["status"] == "PASS_SCOPED"
    assert report["remaining_detected_count"] == 0
    assert report["output_sha256"] == engine.fingerprint(result.content)
    assert any("not fully sanitized" in text for text in report["unverified"])


def test_browser_review_features_exist_in_frontend_source():
    from pathlib import Path

    app_source = (Path(__file__).resolve().parents[2] /
                  "frontend" / "src" / "App.tsx").read_text()
    for label in (
        "Before / after comparison", "Move, resize or delete",
        "Undo edit", "Redo edit", "Delete box", "Enlarge", "Shrink",
        "I have visually checked page", "acknowledged",
        "remaining_detected_count", "What would you like to protect?",
    ):
        assert label in app_source, label
