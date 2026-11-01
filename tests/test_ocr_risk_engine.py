from backend.detection import detect_sensitive_data
from backend.pipeline import analyze_text

def test_common_pii_candidates():
    text = "Email demo@example.com PAN ABCDE1234F mobile 9876543210 IFSC SBIN0001234"
    cats = {f.category for f in detect_sensitive_data(text)}
    assert {"EMAIL", "PAN_CANDIDATE", "INDIAN_MOBILE", "IFSC"} <= cats

def test_plain_number_is_not_assumed_to_be_account_or_aadhaar():
    found = detect_sensitive_data("Order ref 123456789012 and batch 987654321")
    assert not any(f.category in {"BANK_ACCOUNT_CANDIDATE", "AADHAAR_CANDIDATE"} for f in found)

def test_bank_account_needs_context_label():
    found = detect_sensitive_data("Account number: 123456789012")
    assert any(f.category == "BANK_ACCOUNT_CANDIDATE" for f in found)

def test_low_ocr_confidence_does_not_lower_risk():
    item = analyze_text("api_key=AbCdEfGhIjKlMnOp", "synthetic-file", ocr_confidence=.31)["findings"][0]
    assert item["risk_level"] == "CRITICAL"
    assert item["manual_review_required"] is True
    assert item["ocr_confidence"] == .31

def test_language_script_detection_for_supported_finding():
    # The email remains detectable in a mixed-script sentence.
    found = detect_sensitive_data("ವಿಳಾಸ: demo@example.com नाम")
    assert found[0].category == "EMAIL"

