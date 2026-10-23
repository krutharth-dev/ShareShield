"""ShareShield: offline-first browser application and local API."""
from __future__ import annotations

import json
from pathlib import Path
import os
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from backend import engine, review
from backend.patterns import SEVERITY

app = FastAPI(title="ShareShield local privacy review API", version="0.4.0")
STATIC = Path(__file__).parent / "static" / "index.html"
FRONTEND_DIST = Path(os.environ.get("SHARESHIELD_WEB_DIST", str(Path(__file__).resolve().parent.parent / "frontend" / "dist")))


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if FRONTEND_DIST.is_dir():
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' blob: data:; connect-src 'self'; font-src 'self'; "
            "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        )
    return response


if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="built-assets")


@app.get("/favicon.svg", include_in_schema=False)
def favicon():
    path = FRONTEND_DIST / "favicon.svg"
    if path.is_file():
        return FileResponse(path, media_type="image/svg+xml")
    raise HTTPException(404, "Favicon not found")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(FRONTEND_DIST / "index.html" if (FRONTEND_DIST / "index.html").is_file() else STATIC, media_type="text/html",
                        headers={"Cache-Control": "no-store"})


@app.get("/health")
def health():
    return {"status": "ok", "mode": "local-privacy-review-v0.4",
            "ocr_available": engine.ocr_available(),
            "ocr_setup": None if engine.ocr_available() else "Install Tesseract with brew install tesseract; restart server"}


async def _upload(file: UploadFile) -> tuple[bytes, str]:
    ext = engine.extension(file.filename or "")
    data = await file.read(engine.MAX_BYTES + 1)
    if not data or len(data) > engine.MAX_BYTES:
        raise HTTPException(413, "File must be nonempty and at most 12 MiB")
    review.check_file(data, ext)
    return data, ext


def _ids(raw: str, count: int) -> list[int]:
    try:
        ids = [int(v.strip()) for v in raw.split(",") if v.strip()]
    except ValueError as exc:
        raise HTTPException(422, "selected_ids must be comma-separated integers") from exc
    if len(ids) != len(set(ids)) or any(n < 0 or n >= count for n in ids):
        raise HTTPException(422, "Invalid or duplicate finding IDs")
    return ids


@app.post("/analyze")
async def analyze(file: Annotated[UploadFile, File()]):
    data, ext = await _upload(file)
    findings, limitations = engine.inspect(data, ext)
    page_count = 1
    if ext == ".pdf":
        with engine.open_pdf(data) as doc:
            page_count = doc.page_count
    counts: dict[str, int] = {}
    for f in findings:
        counts[f.category] = counts.get(f.category, 0) + 1
    return {
        "filename": file.filename,
        "format": ext,
        "analysis_id": engine.fingerprint(data),
        "findings": [f.public(i) for i, f in enumerate(findings)],
        "counts": counts,
        "high_risk_count": sum(1 for f in findings if SEVERITY.get(f.category) == "high"),
        "page_count": page_count,
        "preview_supported": ext in engine.IMAGE_EXTENSIONS or ext == ".pdf",
        "limitations": limitations,
        "message": "Review results; no findings does not mean the file contains no sensitive data.",
    }


@app.post("/preview")
async def preview_file(
    file: Annotated[UploadFile, File()],
    page: Annotated[int, Form()] = 1,
):
    data, ext = await _upload(file)
    image = review.preview(data, ext, page)
    if ext == ".pdf":
        with engine.open_pdf(data) as doc:
            bounds = doc[page - 1].rect
            width, height = bounds.width, bounds.height
    else:
        source = engine.read_image(data)
        width, height = source.width, source.height
    return Response(content=image, media_type="image/png",
                    headers={"Cache-Control": "no-store",
                             "X-Document-Width": str(width),
                             "X-Document-Height": str(height)})


@app.post("/redact")
async def redact_selected(
    file: Annotated[UploadFile, File()],
    analysis_id: Annotated[str, Form()],
    selected_ids: Annotated[str, Form()] = "",
    manual_regions: Annotated[str, Form()] = "[]",
):
    data, ext = await _upload(file)
    if engine.fingerprint(data) != analysis_id:
        raise HTTPException(409, "File differs from the analyzed copy. Reanalyze the file.")
    findings, _ = engine.inspect(data, ext)
    chosen = [findings[i] for i in _ids(selected_ids, len(findings))]
    if any(not f.rectangles and not f.location for f in chosen):
        raise HTTPException(422, "One or more selected findings could not be located")
    manual = review.parse_regions(manual_regions, ext)
    if not chosen and not manual:
        raise HTTPException(422, "Select a finding or draw a manual redaction box")
    if ext in engine.IMAGE_EXTENSIONS or ext == ".pdf":
        result, mime, name = review.redact_visual(data, ext, chosen, manual)
        result_ext = ".png" if ext in engine.IMAGE_EXTENSIONS else ".pdf"
    else:
        result, mime, name = engine.redact(data, ext, chosen)
        result_ext = ext
    report = review.evaluate(chosen, result, result_ext, len(manual))
    if report["status"] == "FLAG":
        raise HTTPException(409, "FLAG: selected information is still detectable in the output")
    return Response(content=result, media_type=mime,
                    headers={
                        "Content-Disposition": f'attachment; filename="{name}"',
                        "X-ShareShield-Verification": report["status"],
                        "X-ShareShield-Selected-Count": str(len(chosen)),
                        "X-ShareShield-Manual-Count": str(len(manual)),
                        "Cache-Control": "no-store",
                        "X-Content-Type-Options": "nosniff",
                    })


@app.post("/verify")
async def verify_result(
    file: Annotated[UploadFile, File()],
    redacted: Annotated[UploadFile, File()],
    analysis_id: Annotated[str, Form()],
    selected_ids: Annotated[str, Form()] = "",
    manual_count: Annotated[int, Form()] = 0,
):
    original, ext = await _upload(file)
    if engine.fingerprint(original) != analysis_id:
        raise HTTPException(409, "Original file differs from the analyzed copy")
    output, out_ext = await _upload(redacted)
    valid_outputs = {".png"} if ext in engine.IMAGE_EXTENSIONS else {ext}
    if out_ext not in valid_outputs:
        raise HTTPException(422, "The redacted output has an unexpected format")
    initial, _ = engine.inspect(original, ext)
    chosen = [initial[i] for i in _ids(selected_ids, len(initial))]
    if manual_count < 0 or manual_count > 60:
        raise HTTPException(422, "Invalid manual redaction count")
    return review.evaluate(chosen, output, out_ext, manual_count)
