# ShareShield backend — integration-ready development slice

## Implemented
- FastAPI upload API for PDF, PNG, JPG and JPEG (10 files/request, 20 MiB/file by default).
- PDF text-layer extraction with page coordinates.
- Local Tesseract OCR for image uploads and scanned PDF pages that have no extractable text layer.
- OCR word boxes are converted to PDF page-point coordinates for scanned PDFs.
- Server-side finding-ID redaction: clients submit `finding_ids`, never coordinates.
- PDF redaction annotations are applied and saved to a separate output; image pixels are overwritten and saved as PNG.
- Job storage with a configurable 24-hour TTL cleanup.
- Swagger multipart schema compatibility patch for the file picker.
- Tests for upload, finding-ID authorization within a job, PDF/image redaction and scanned-PDF OCR coordinate conversion.

## Run locally
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Install the Tesseract executable separately. macOS: `brew install tesseract`.
Without Tesseract, scanned PDF/image OCR reports `unavailable`; do not treat this as a clean scan.

## API
- `GET /health`
- `POST /v1/analyze` multipart field `files` (repeat for batch)
- `POST /v1/redact` JSON body, using server-returned finding IDs:
```json
{
  "job_id": "<job_id from analyze>",
  "selections": [{
    "file_id": "<file_id from analyze>",
    "finding_ids": ["<finding_id from analyze>"]
  }]
}
```
- `GET /v1/files/{job_id}/{file_id}/output`

The API rejects redaction if no server-generated findings exist. This is expected until Manoj's detector is connected. A detector must return `Finding` objects with unique `finding_id`, category, confidence, and source `location`.

## Environment settings
- `SHARESHIELD_MAX_UPLOAD_BYTES` — default 20 MiB.
- `SHARESHIELD_DATA_DIR` — default `./.shareshield_data`.
- `SHARESHIELD_JOB_TTL_SECONDS` — default 86400 seconds.

## Detector and verifier integration
Implement `DetectionEngine.detect(extracted_content, file_id)` in `app.services.detection`.
Return findings with stable IDs and source locations. PDF location is `{page,x0,y0,x1,y1}` in PDF points; image location is `{x0,y0,x1,y1}` in pixels.

`OutputVerifier` in `app.services.verification` remains an interface for Nikhil and is **not yet wired into the API**.

## Limitations / production checklist
- OCR runs only on pages with no extractable text blocks; mixed text-plus-image pages may need a hybrid OCR strategy.
- Tesseract must be installed on the host and configured for the required languages.
- Scanned-PDF OCR and redaction must be validated with real-world fixtures; OCR can miss text or produce imperfect boxes.
- The current detector is intentionally `None`; no findings means detection is not configured, not that the file is safe.
- Finding IDs are not a substitute for authentication. Add user authentication/authorization and bind each job to its owner before deployment.
- Add rate limiting, malware scanning, CPU/memory/time limits, storage quotas, encrypted storage, and operational monitoring before public deployment.
- PDF attachments, embedded files, forms, annotations, layers, metadata, and all hidden structures are not comprehensively sanitized or certified safe.
- Verification is not yet integrated. A successful redaction response is not a proof of complete sanitization.

