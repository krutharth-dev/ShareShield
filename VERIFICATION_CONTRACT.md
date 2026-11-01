# ShareShield verification contract (v1)

## Request
```json
{
  "output_path": "/private/work/output.pdf",
  "original_file_type": "pdf",
  "selected_findings": [{"value": "SYNTHETIC-ID-4829", "category": "student_id"}],
  "location_information": {"page": 1},
  "redaction_metadata": {"method": "true_pdf_redaction", "redaction_id": "opaque-id"},
  "required_checks": ["pdf_text_extraction", "rendered_ocr", "metadata_attachments"],
  "timeout_seconds": 20
}
```
Findings may be strings or objects with `value` (or `text` / `matched_text`) and optional category. Avoid logging raw values.

## Response and decision rules
JSON report includes `schema_version`, `status`, `output`, `checks`, `warnings`, `remaining_findings`, `redaction_metadata`, `location_information`, `verified_at`, `duration_ms`, and `scope_note`.

- **FLAG**: selected value or fresh candidate PII remains detectable.
- **UNVERIFIED**: a required check is skipped, failed, unsupported, timed out, or incomplete.
- **SCOPED_CLEAR**: configured required checks completed without detecting residual exposure; not a universal security guarantee.
- FLAG takes precedence when a leak is found, even if another check failed.

## Implemented PDF checks and limits
1. `pdf_text_extraction`: reopen saved bytes with PyMuPDF and extract page text; search selected values and fresh email/phone/Aadhaar-like/PAN-like patterns.
2. `rendered_ocr`: render saved PDF pages and OCR via Tesseract; OCR language uses installed default in this first slice, not explicit English/Kannada/Hindi routing.
3. `metadata_attachments`: inspect PDF metadata and enumerate attachments using PyMuPDF + pypdf. Attachment contents are not recursively scanned; attachments make the check incomplete and result UNVERIFIED unless a leak causes FLAG.

DOCX/XLSX/PPTX and standalone image verification are not implemented. Do not mark them clear with this module.

## Integration
Jayanth should save the output first, then call `verify_pdf(VerificationInput(...))` against the saved path. Return the report alongside output metadata. Frontend should display exact status/warnings and never translate SCOPED_CLEAR into “safe” or “100% protected.” Manoj's category taxonomy can be passed in, but the verifier performs its own extraction and residual scan.

