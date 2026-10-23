"""ShareShield's local-only, searchable-PDF prototype API.

No uploaded document is written to disk by this module.
Only fictional/consented documents should be used during development.
"""
from __future__ import annotations

import io
import re
from typing import Annotated

import fitz
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

MAX_BYTES = 10 * 1024 * 1024
EMAIL = re.compile(r"(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])")
PHONE = re.compile(r"(?<!\d)(?:\+91[ -]?)?[6-9]\d{9}(?!\d)")
PATTERNS = (("email", EMAIL), ("indian_mobile_candidate", PHONE))

app = FastAPI(title="ShareShield local PDF API", version="0.1.0")


def _open_pdf(data: bytes) -> fitz.Document:
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413, "PDF must be nonempty and at most 10 MiB")
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        if doc.needs_pass or doc.is_encrypted:
            doc.close()
            raise HTTPException(422, "Password-protected PDFs are unsupported")
        if not doc.page_count:
            doc.close()
            raise HTTPException(422, "PDF has no pages")
        return doc
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(422, "Unreadable or invalid PDF") from exc


async def _read_upload(file: UploadFile) -> bytes:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(415, "Upload a .pdf file")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "PDF exceeds 10 MiB")
    return data


def _findings(doc: fitz.Document) -> list[dict]:
    findings = []
    for page_num, page in enumerate(doc):
        plain_text = page.get_text("text", sort=True)
        for category, pattern in PATTERNS:
            for match in pattern.finditer(plain_text):
                value = match.group(0)
                # PyMuPDF may not locate a text match crossing PDF layout boundaries.
                rectangles = page.search_for(value)
                findings.append({
                    "id": len(findings),
                    "page": page_num + 1,
                    "category": category,
                    "value": value,
                    "locatable": bool(rectangles),
                })
    return findings


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "mode": "local-pdf-prototype"}


@app.post("/analyze")
async def analyze(file: Annotated[UploadFile, File()]) -> dict:
    data = await _read_upload(file)
    with _open_pdf(data) as doc:
        findings = _findings(doc)
        return {
            "page_count": doc.page_count,
            "findings": findings,
            "limitations": [
                "Searchable text only; no OCR",
                "Patterns can miss sensitive information or produce false positives",
                "Embedded files, annotations, metadata, images and other hidden content are not inspected",
            ],
        }


@app.post("/redact")
async def redact(
    file: Annotated[UploadFile, File()],
    selected_ids: Annotated[str, Form(description="Comma-separated finding IDs from /analyze")],
) -> Response:
    try:
        requested = [int(part.strip()) for part in selected_ids.split(",") if part.strip()]
    except ValueError as exc:
        raise HTTPException(422, "selected_ids must contain integers") from exc
    if not requested or len(requested) != len(set(requested)) or any(i < 0 for i in requested):
        raise HTTPException(422, "Select one or more unique finding IDs")

    data = await _read_upload(file)
    with _open_pdf(data) as doc:
        findings = _findings(doc)
        if any(i >= len(findings) for i in requested):
            raise HTTPException(422, "Finding IDs do not match this PDF")
        selected = [findings[i] for i in requested]
        if any(not finding["locatable"] for finding in selected):
            raise HTTPException(422, "Selected text cannot be located for safe redaction")

        # Page search locates all copies of an approved value on that page.
        for finding in selected:
            page = doc[finding["page"] - 1]
            for rect in page.search_for(finding["value"]):
                page.add_redact_annot(rect, fill=(0, 0, 0))
        for page in doc:
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)
        output = doc.tobytes(garbage=4, deflate=True, clean=True)

    # Verify the written file, rather than the preview or the in-memory original.
    with _open_pdf(output) as saved:
        remaining = [
            f for f in selected
            if saved[f["page"] - 1].search_for(f["value"])
            or f["value"] in saved[f["page"] - 1].get_text("text")
        ]
    if remaining:
        raise HTTPException(409, "FLAG: selected text remains in exported PDF")

    # This result is scoped to extracted page text only; not a whole-file security audit.
    return Response(
        content=output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="shareshield-redacted.pdf"',
            "X-ShareShield-Verification": "PASS-SCOPED-TEXT-ONLY",
            "X-ShareShield-Selected-Count": str(len(selected)),
            "Cache-Control": "no-store",
        },
    )
