import json
import pytest
fitz=pytest.importorskip("fitz")
from backend.verification.pdf_verifier import VerificationInput, verify_pdf
SECRET="SYNTHETIC-ID-4829"
def pdf(path,text=SECRET):
 d=fitz.open(); p=d.new_page(); p.insert_text((72,100),"Reference: "+text,fontsize=18); d.save(path); d.close(); return path
def test_black_rectangle_overlay_flags_searchable_text(tmp_path):
 src=pdf(tmp_path/"src.pdf"); d=fitz.open(src); d[0].draw_rect(fitz.Rect(65,75,270,115),color=(0,0,0),fill=(0,0,0),overlay=True); out=tmp_path/"overlay.pdf"; d.save(out); d.close()
 r=verify_pdf(VerificationInput(out,selected_findings=[SECRET])); assert r["status"]=="FLAG"; assert any(f["match_type"]=="selected_value_residual" for f in r["remaining_findings"]); json.dumps(r)
def test_true_redaction_removes_selected_value(tmp_path):
 src=pdf(tmp_path/"src.pdf"); d=fitz.open(src)
 for rect in d[0].search_for(SECRET): d[0].add_redact_annot(rect,fill=(0,0,0))
 d[0].apply_redactions(); out=tmp_path/"redacted.pdf"; d.save(out,garbage=4,deflate=True); d.close()
 r=verify_pdf(VerificationInput(out,selected_findings=[SECRET])); assert r["status"] in {"SCOPED_CLEAR","UNVERIFIED"}; assert not any(f.get("value")==SECRET for f in r["remaining_findings"])
def test_remaining_sensitive_text_flags(tmp_path):
 r=verify_pdf(VerificationInput(pdf(tmp_path/"leak.pdf"),selected_findings=[{"value":SECRET,"category":"student_id"}])); assert r["status"]=="FLAG"
def test_unsupported_check_is_unverified(tmp_path):
 r=verify_pdf(VerificationInput(pdf(tmp_path/"unsupported.pdf","ordinary text"),required_checks=["pdf_text_extraction","deep_structure_scan"]))
 assert r["status"]=="UNVERIFIED"; assert any(c["name"]=="deep_structure_scan" and c["status"]=="skipped" for c in r["checks"])
def test_missing_and_corrupt_files_are_unverified(tmp_path):
 assert verify_pdf(VerificationInput(tmp_path/"missing.pdf"))["status"]=="UNVERIFIED"
 p=tmp_path/"bad.pdf"; p.write_bytes(b"not a PDF"); assert verify_pdf(VerificationInput(p))["status"]=="UNVERIFIED"
def test_fresh_scan_flags_email(tmp_path):
 r=verify_pdf(VerificationInput(pdf(tmp_path/"email.pdf","contact demo.user@example.test"),selected_findings=[]))
 assert r["status"]=="FLAG" and any(f["category"]=="email" for f in r["remaining_findings"])
def test_ocr_failure_is_unverified(monkeypatch,tmp_path):
 pytest.importorskip("pytesseract"); import pytesseract
 monkeypatch.setattr(pytesseract,"image_to_string",lambda *a,**k: (_ for _ in ()).throw(RuntimeError("synthetic OCR failure")))
 r=verify_pdf(VerificationInput(pdf(tmp_path/"ocr.pdf","ordinary text"),selected_findings=[]))
 assert r["status"]=="UNVERIFIED"; assert next(c for c in r["checks"] if c["name"]=="rendered_ocr")["status"]=="failed"
def test_batch_files_get_independent_reports(tmp_path):
 a=verify_pdf(VerificationInput(pdf(tmp_path/"clean.pdf","ordinary text"),selected_findings=[SECRET]))
 b=verify_pdf(VerificationInput(pdf(tmp_path/"leak.pdf"),selected_findings=[SECRET]))
 assert a["status"] in {"SCOPED_CLEAR","UNVERIFIED"} and b["status"]=="FLAG"

