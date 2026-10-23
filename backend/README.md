# ShareShield local prototype v0.4

This is the **ShareShield upload and privacy review website**, served locally at http://127.0.0.1:8000/. It is an educational prototype, not a guarantee against privacy leaks.

## Update the existing Mac clone

Stop the server using Control+C, then run:

~~~bash
cd ~/Desktop/ShareShield
git switch backend/pdf-redaction-verification
git pull origin backend/pdf-redaction-verification
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m pip install pytest httpx
python -m pytest backend/tests -v
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
~~~

Install system OCR separately with **brew install tesseract** and confirm **tesseract --version**. If Homebrew or pillow-heif fails on an older Intel macOS version, report your version and the error. Open http://127.0.0.1:8000/ and refresh your browser; /docs is for API debugging.

## Features

| Feature | Implemented scope |
| --- | --- |
| Upload | JPG/JPEG, PNG, HEIC/HEIF, WEBP, BMP, TIFF, searchable/scanned PDF, DOCX, PPTX, XLSX, UTF-8 CSV/TXT |
| Detection | Email, Indian mobile candidates, PAN candidates, checksum-validated Aadhaar-format candidates, common UPI handles, IFSC-format codes and Luhn-valid payment-card candidates |
| Review | Checkbox selection, category counts and higher-priority candidate count |
| Image/PDF preview | Before/after images, selected finding overlays, page navigation |
| Manual redaction | Draw opaque rectangles on images and PDF pages |
| Output | Redacted PDF, flattened PNG, DOCX/PPTX, XLSX, CSV or TXT copy |
| Audit export | Download JSON report with original/output SHA-256, selected checks and warnings |
| Verification | Reopen output, rerun supported detectors, flag selected findings that remain |

**DOCX/PPTX/XLSX/CSV/TXT do not have rendered previews**, so review the exported file using the corresponding editor. Office run-level formatting may change.

## How to use

1. Upload a file and press **Scan file**.
2. Review detected candidate identifiers and select the items to remove.
3. For PDF/images, draw extra redaction boxes on anything the scanner missed.
4. Generate the new copy and inspect the before/after pages if available.
5. Read the verification report, download the JSON audit and manually open the output before sharing.

The original file is not overwritten. Statuses have intentionally limited meanings:

- **PASS_SCOPED:** selected recognized identifiers no longer found by configured checks; other sensitive information could remain.
- **FLAG:** a selected identifier was still detected in the output; download is blocked.
- **UNVERIFIED:** any manual boxes (even alongside detected items), or no recognized items to independently verify; inspect the export carefully.

## Endpoints

- POST /analyze — multipart file; returns findings (including rectangles), category counts, page count and SHA-256 analysis_id.
- POST /preview — multipart file and page number; PNG result and document dimensions; only images/PDFs.
- POST /redact — original file, analysis_id, selected_ids as comma-separated integers, optional manual_regions JSON array with page/x/y/w/h normalized to [0,1].
- POST /verify — original file, redacted output, analysis_id, selected_ids and manual_count; returns checks, warnings and output_sha256 checksum. The browser additionally adds the original SHA-256 and a timestamp to the downloadable audit JSON.
- GET /health — status.


## If Tesseract OCR is missing on macOS

The Python package `pytesseract` is **not** the OCR executable. Install the system program:

```bash
brew install tesseract
which tesseract
tesseract --version
```

After installation, **stop and restart** the ShareShield server. The `GET /health` endpoint includes an `ocr_available` boolean. Without Tesseract, the app can still scan selectable PDF text and DOCX/PPTX/CSV/XLSX/TXT data. It can also generate **UNVERIFIED manual-only image/PDF masks**, but cannot automatically read image text or scanned-PDF text; the website displays an explicit warning. A partial text-only scan does not establish that the whole document is safe.

## Limits and privacy caveats

This is not full-file sanitization. OCR can miss handwriting, faint text and complex layouts. Rules can yield false positives or miss sensitive items. PAN, IFSC and UPI patterns are only syntactic candidates; Luhn is not proof a card number is issued, and Aadhaar checksum validation does not establish an identity. Face detection/redaction has **not** been implemented. Some Office comments, revision history, embedded media and metadata, plus PDF attachments, hidden content and metadata remain unchecked.

Limits: 12 MiB files, 25-page PDFs, 25-megapixel images, 60 manual rectangles. DOCX/PPTX/XLSX have component-count and decompression checks. XLSX formulas, charts, comments, cached formula results and hidden structures are not fully checked. CSV imports can interpret formula-like cells. Legacy .doc, .xls, ZIP, audio, video and encrypted PDFs are not supported. HEIC decoding needs pillow-heif, and image exports are flattened PNGs without original EXIF metadata.

Keep the service bound to **127.0.0.1**, not a public address. Use synthetic test data and do not commit real IDs or private documents to GitHub. PyMuPDF AGPL/commercial licensing must be reviewed before redistribution.