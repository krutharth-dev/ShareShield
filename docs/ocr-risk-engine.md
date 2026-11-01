# OCR and risk engine (initial implementation)

- Tesseract printed OCR: `eng`, `kan`, `hin`, including mixed language via e.g. `eng+kan+hin`.
- Scanned PDF OCR rasterizes pages with pdf2image. Digital PDFs should use a text extractor.
- Tesseract is not claimed to reliably recognize handwritten Kannada/Hindi. Empty or low-confidence OCR must be manually reviewed.
- Detection is conservative: Aadhaar candidate requires 12 digits and Verhoeff checksum; bank account requires an explicit account label; PAN/mobile/IFSC/email/UPI and labeled credential patterns are supported.
- Names, addresses and DOB require a separately evaluated multilingual NER/context component and are not claimed as implemented.
- Risk and OCR/detection confidence are separate. A low-confidence CRITICAL candidate remains a manual-review item.

Install Python extras: `pip install -r requirements-ocr.txt`.
Install Tesseract plus language data at OS level; verify with `tesseract --list-langs`.

The response schema in `backend/pipeline.py` is provisional pending coordination with the FastAPI API owner. Raw values/evidence must never be written to logs.

