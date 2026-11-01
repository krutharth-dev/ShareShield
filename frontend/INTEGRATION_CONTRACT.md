# Integration contract for hackathon frontend (working draft)

**Status:** Frontend adapter specification only. Backend API owner must confirm the final HTTP response shape; no backend service has been verified in this repository.

## Existing team modules (read from GitHub)
- Manoj's `backend/pipeline.py` on `feature/ocr-risk-engine` returns `{file_id, findings: [...]}` with `finding_id`, `category`, `value`, `risk_level`, `detection_confidence`, `ocr_confidence`, `language`, `location`, `evidence`, `manual_review_required`.
- Nikhil's `VERIFICATION_CONTRACT.md` on `main` specifies `FLAG`, `UNVERIFIED`, and `SCOPED_CLEAR`. It requires verification of *saved* output and carries warnings/checks/scope details.
- These modules are NOT a running FastAPI service. OCR/handwriting support and formats depend on installed dependencies and completed integration.

## HTTP contract (to be implemented by Jayanth)
`GET /health` => `{"status":"ok"}`. Check must reflect backend readiness rather than returning healthy while processing dependencies are unavailable.

`POST /api/v1/analyze`: multipart field `files` repeated for each file. Response:
```json
{
  "files": [{
    "file_id": "server-generated-opaque-id",
    "filename": "fictional-sample.pdf",
    "status": "ready",
    "language": "eng",
    "findings": [{
      "id": "finding-opaque-id",
      "category": "EMAIL",
      "risk": "MEDIUM",
      "confidence": 0.93,
      "preview": "a***@example.test"
    }]
  }]
}
```
The API needs to preserve upload order and make per-file processing failures explicit. The frontend currently requires synchronous analyzed results (not polling): do not respond with just a background job ID. A future job API may replace this after coordination.

**Server adapter must:**
1. Convert `finding_id → id`, `risk_level → risk`, `detection_confidence → confidence`; preserve recognition confidence separately from risk.
2. Replace `value` and `evidence` with a *safe masked preview* that does not expose the original secret; never send secret values unnecessarily.
3. Persist the original value securely for backend redaction/verification if essential, scoped to the authorized session.
4. Preserve page and bbox when available, using an agreed coordinate system; scanned documents may have no reliable bbox and must signal this.
5. Return `unsupported`/`error` explicitly for capabilities not yet validated. Empty findings are **not** proof of privacy.

`POST /api/v1/files/{file_id}/redact` accepts `{"finding_ids":["finding-opaque-id"]}`. Backend must check ownership/authorization, produce a separate output, and independently verify the saved output. Respond:
```json
{
  "file_id": "server-generated-opaque-id",
  "download_url": "/api/v1/files/server-generated-opaque-id/download",
  "verification": {
    "status": "UNVERIFIED",
    "summary": "OCR validation not available for this output.",
    "checks": [{"name": "rendered_ocr", "passed": null}]
  }
}
```
If a check fails or cannot be performed, use `UNVERIFIED`; if exposure is found use `FLAG` (takes precedence). `SCOPED_CLEAR` is not complete safety certification. Preserve warnings and scope from Nikhil's full report when extending the API.

`GET /api/v1/files/{file_id}/download` streams authorized redacted bytes only; `Content-Disposition` should force attachment. Use short-lived file identifiers, cleanup, server-side access checks, and no caching.

## Security and deployment boundaries
- Cloudflare Pages frontend+Functions sends content to a remote FastAPI origin. **Do not label this as fully on-device processing.**
- `BACKEND_ORIGIN` is server-side Pages Functions config. Set a full HTTPS origin without path/query (e.g. `https://backend.example`). Never put it in `VITE_*`.
- Keep the backend's `GET /health` and `POST /api/v1/analyze` compatible with Pages Function routing. No invented success responses.
- The gateway checks origin, known HTTP methods, declared length and content type. It **does not replace** backend authentication, CSRF protection, streaming size enforcement, content validation, malware defense, or user authorization.
- Do not expose originals in analytics, frontend local storage, backend logs, stack traces, or telemetry.
- End-to-end tests require synthetic data and must include deliberately unredacted exposure that produces `FLAG`.

## Current limitations
Frontend lacks document rendering, manual region boxes, proof of real authenticated session ownership, background job progress, and end-to-end integration. These cannot be marked complete merely because CI passes.

