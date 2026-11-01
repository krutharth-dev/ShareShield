import json
import fitz
from backend.verification.pdf_verifier import VerificationInput, verify_pdf

def test_verification_report_masks_fictional_residuals(tmp_path):
    path=tmp_path/"fictional.pdf"
    d=fitz.open();p=d.new_page()
    p.insert_text((50,95),"Email: fictional@example.test",fontsize=18)
    d.save(path);d.close()
    report=verify_pdf(VerificationInput(path,selected_findings=["fictional@example.test"]))
    assert report["status"]=="FLAG"
    assert report["remaining_findings"]
    text=json.dumps(report)
    assert "fictional@example.test" not in text
    assert all("value" not in f for f in report["remaining_findings"])

def test_optional_report_metadata_never_echoes_private_fields(tmp_path):
    path=tmp_path/"metadata.pdf"
    d=fitz.open();d.new_page();d.save(path);d.close()
    report=verify_pdf(VerificationInput(
        path,
        required_checks=["pdf_text_extraction"],
        redaction_metadata={"raw_secret":"fictional@example.test"},
        location_information={"sensitive_address":"123 Example St"}
    ))
    serialized=json.dumps(report)
    assert "fictional@example.test" not in serialized
    assert "123 Example St" not in serialized
    assert report["redaction_metadata"]["details_withheld"]
