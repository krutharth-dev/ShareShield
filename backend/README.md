# Backend — searchable PDF prototype

A **local-only**, early backend for the 28 October mini-project demo. This implements detection, review identifiers, content redaction and a limited reopen-and-check workflow. It is **not** a general-purpose PII detector or a complete privacy audit.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` for interactive API documentation. Dependencies and this source code have not been validated on every target laptop.

## API integration

1. POST multipart field `file` to `/analyze`. Read the `findings` array and let the user review categories, values and IDs.
2. POST the **same PDF** as `file` plus `selected_ids` as comma-separated IDs (e.g. `0,2`) to `/redact`. Receive the PDF in the response body.
3. Read `X-ShareShield-Verification` from the response. `PASS-SCOPED-TEXT-ONLY` checks selected strings in extracted page text in the reopened output; it is **not** proof that every possible privacy leak is gone.

Important: the browser UI must use the same unchanged file for both calls, and should display the saved-file verification scope and limitations.

## Known limitations

- Handles searchable PDFs only; no OCR or scanned-document support.
- Detects common email and Indian mobile-number **candidates** via patterns; no identity validation or contextual model.
- Does not inspect attachments, metadata, form fields, annotations, image pixels or alternate text representations. Treat these as **unverified**.
- All matches of a selected value on its page are redacted. Review placement carefully.
- Patterns and PDF text extraction can miss sensitive information. Never claim global privacy safety.
- Runs in memory for this module, with 10 MiB file limit. Run on loopback; do not expose it to public networks.
- PyMuPDF uses AGPL/commercial licensing; review obligations before distribution.

## Next priorities

Synthetic PDF test fixtures, regression tests, frontend upload/review integration, export inspection for unsupported PDF structures, and a stronger verification report are still required.
