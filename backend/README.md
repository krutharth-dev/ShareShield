# ShareShield — multi-format local prototype

## Mac setup

Install the separate Tesseract OCR program:

~~~bash
brew install tesseract
~~~

In Terminal, inside the ShareShield folder:

~~~bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m pip install pytest httpx
python -m pytest backend/tests -v
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
~~~

**Open http://127.0.0.1:8000/ for the real upload page.** The old /docs API page remains available. After updating a branch, stop and restart the server. Python 3.10+ is recommended; on old Macs, compatibility depends on your installed macOS and package versions.

## What files work?

| Input | Examined content | Redacted output |
| --- | --- | --- |
| JPG/JPEG, PNG, HEIC/HEIF, WEBP, BMP, TIFF | Visible OCR text | Flattened PNG with opaque black rectangles |
| PDF, including scanned pages | Extracted PDF text, plus OCR on pages with little text | New redacted PDF |
| Word DOCX | Editable paragraphs, tables and headers/footers | New DOCX |
| PowerPoint PPTX | Editable slide text, groups and tables | New PPTX |
| Plain UTF-8 TXT | Plain text | New TXT |

Unsupported: legacy Word DOC, spreadsheets, ZIP/RAR, videos, audio, animated/multipage images, password-protected PDFs and unknown formats. Convert DOC to DOCX first. Files are limited to 12 MiB, PDFs to 25 pages, and images to 25 megapixels.

## Workflow

1. Select or drag/drop a file.
2. Click **Scan for sensitive data**.
3. Review and select detected items (email and Indian mobile-number candidates currently).
4. Click **Redact selected & download**.
5. **Open and manually inspect** the new file before sharing.

The original remains unchanged by the application. HEIC/JPEG/etc. image output is PNG to avoid preserving original image metadata.

## API

- POST /analyze: multipart field file; returns findings, limitations, analysis_id.
- POST /redact: same multipart file, analysis_id, selected_ids as comma-separated integers.
- GET /health: status.

The analysis_id is a SHA-256 fingerprint to prevent using selections from the wrong document. The verification header is **PASS-SELECTED-FINDINGS-ONLY**, not a declaration that the whole file is safe.

## Security and accuracy limitations

This prototype uses deterministic patterns and OCR. It can miss text and produce false positives. It does **not** yet detect faces, images of ID cards as objects, handwritten text, or broad contextual personal information. It does not verify DOCX/PPTX embedded images, annotations, speaker notes, revision history, attachments, hidden content or metadata. Images embedded in otherwise searchable PDFs may be missed. Selected text redactions may modify formatting in DOCX/PPTX.

The local API should run on 127.0.0.1 only, not a public-facing server. Uploaded data is handled in memory by this implementation. Never use real personal files in tests without authorization.

PyMuPDF has AGPL/commercial licensing requirements that must be reviewed before external distribution. The prototype is not production-ready and does not guarantee privacy.
