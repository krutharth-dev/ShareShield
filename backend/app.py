"""ShareShield: offline-first browser application and local API."""
from __future__ import annotations

import json
import asyncio
from pathlib import Path
import os
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from backend import engine, review, smart, snapshots
from backend.patterns import SEVERITY

DEPLOYMENT_MODE = os.environ.get("SHARESHIELD_DEPLOYMENT_MODE", "local").lower()
HOSTED_DEMO = DEPLOYMENT_MODE == "public-demo"
if DEPLOYMENT_MODE not in {"local", "public-demo"}:
    raise RuntimeError("Unknown SHARESHIELD_DEPLOYMENT_MODE")
if DEPLOYMENT_MODE == "public-demo" and not os.environ.get("SHARESHIELD_PUBLIC_HOSTNAME", "").strip():
    raise RuntimeError("Public demo requires an exact SHARESHIELD_PUBLIC_HOSTNAME")
HOSTS = ["127.0.0.1", "localhost", "testserver"]
if HOSTED_DEMO:
    # Keep host validation explicit for Railway's service domain.
    # healthcheck.railway.app is the host header used by its deployment probe.
    railway_host = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "").strip().lower()
    on_railway = bool(os.environ.get("RAILWAY_PROJECT_ID") or railway_host)
    if on_railway:
        HOSTS.append("healthcheck.railway.app")
        if railway_host:
            if (not railway_host.endswith(".up.railway.app")
                    or railway_host == ".up.railway.app"
                    or any(c in railway_host for c in ("/", ":", "*", " "))
                    or not all(c.isascii() and (c.isalnum() or c in ".-") for c in railway_host)):
                raise RuntimeError("Invalid RAILWAY_PUBLIC_DOMAIN")
            HOSTS.append(railway_host)
    # Exact public hostname; wildcard hosts are intentionally disallowed.
    custom_host = os.environ.get("SHARESHIELD_PUBLIC_HOSTNAME", "").strip().lower()
    if custom_host:
        if ("://" in custom_host or "/" in custom_host or "*" in custom_host
                or ":" in custom_host or " " in custom_host):
            raise RuntimeError("SHARESHIELD_PUBLIC_HOSTNAME must be a plain hostname")
        HOSTS.append(custom_host)
app = FastAPI(title="ShareShield privacy review API", version="0.6.0")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=HOSTS)


STATIC = Path(__file__).parent / "static" / "index.html"
FRONTEND_DIST = Path(os.environ.get("SHARESHIELD_WEB_DIST", str(Path(__file__).resolve().parent.parent / "frontend" / "dist")))


@app.middleware("http")
async def security_headers(request, call_next):
    # Fail early when the client declares an excessive multipart body. The
    # upload reader also enforces per-file limits, including unknown lengths.
    if request.method == "POST" and request.url.path in {
        "/analyze", "/preview", "/redact", "/verify"
    }:
        header = request.headers.get("content-length")
        if header is not None:
            try:
                declared = int(header)
            except ValueError:
                return JSONResponse({"detail": "Invalid Content-Length header"}, status_code=400)
            # /verify uploads both the original and an exported copy.
            max_body = engine.MAX_BYTES * (2 if request.url.path == "/verify" else 1) + 1024 * 1024
            if declared < 0 or declared > max_body:
                return JSONResponse(
                    {"detail": "Upload request too large for this local demo"},
                    status_code=413,
                )
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        permitted = {
            str(request.base_url).rstrip("/"),
            "http://127.0.0.1:5173", "http://localhost:5173",
        }
        if HOSTED_DEMO:
            # The hosting platform terminates TLS at its trusted edge.
            # Validate Origin hostname against Host instead of blindly trusting
            # forwarded-scheme headers from arbitrary browser requests.
            from urllib.parse import urlsplit
            from_host = urlsplit(origin).netloc.lower() if origin else ""
            request_host = request.headers.get("host", "").lower()
            if origin and (urlsplit(origin).scheme != "https" or from_host != request_host):
                return JSONResponse({"detail": "Cross-origin upload blocked"}, status_code=403)
        elif origin and origin not in permitted:
            return JSONResponse({"detail": "Cross-origin upload blocked on this local demo server"}, status_code=403)
        if request.headers.get("sec-fetch-site", "").lower() == "cross-site":
            return JSONResponse({"detail": "Cross-site request blocked"}, status_code=403)
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


@app.get("/theme-init.js", include_in_schema=False)
def theme_init():
    """Serve a tiny local startup script under the existing strict CSP.

    Do not put this logic in inline JavaScript; the application intentionally
    rejects inline scripts to reduce injection risk.
    """
    script = FRONTEND_DIST / "theme-init.js"
    if script.is_file():
        return FileResponse(script, media_type="application/javascript",
                            headers={"Cache-Control": "no-store"})
    raise HTTPException(404, "Theme bootstrap not found")


@app.get("/favicon.svg", include_in_schema=False)
def favicon():
    path = FRONTEND_DIST / "favicon.svg"
    if path.is_file():
        return FileResponse(path, media_type="image/svg+xml")
    raise HTTPException(404, "Favicon not found")


@app.get("/shareshield-mark.webp", include_in_schema=False)
def brand_mark():
    """Serve the approved logo under the same-origin restrictive CSP."""
    path = FRONTEND_DIST / "shareshield-mark.webp"
    if path.is_file():
        return FileResponse(path, media_type="image/webp")
    raise HTTPException(404, "ShareShield logo not built")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(FRONTEND_DIST / "index.html" if (FRONTEND_DIST / "index.html").is_file() else STATIC, media_type="text/html",
                        headers={"Cache-Control": "no-store"})


@app.get("/api/status")
@app.get("/health")
def health():
    return {"status": "ok", "mode": "local-privacy-review-v0.6",
            "processor_busy": DOCUMENT_WORK_SLOT.locked(),
            "ocr_available": engine.ocr_available(),
            "vision_available": smart.available(),
            "redaction_modes": ["blackout", "blur", "pixelate"],
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


def _expand_ids(findings: list[engine.Finding], ids: list[int], all_occurrences: bool) -> list[engine.Finding]:
    """Select the same recognized identifier on every page/line.

    Visual candidates (faces/QR codes) are not merged by their generated
    captions: the user should select individual rectangles or the category.
    """
    if not all_occurrences:
        return [findings[i] for i in ids]
    import re

    def key(f: engine.Finding):
        if f.category in {"aadhaar_candidate", "vid_candidate", "payment_card_candidate", "indian_mobile_candidate"}:
            return f.category, re.sub(r"\D", "", f.value)
        return f.category, f.value.casefold().strip()
    keys = {key(findings[i]) for i in ids if findings[i].category not in {"face_candidate", "qr_candidate"}}
    expanded = {i for i, f in enumerate(findings) if key(f) in keys}
    expanded.update(ids)
    return [findings[i] for i in sorted(expanded)]


# Bound expensive OCR/image jobs so concurrent uploads cannot starve /health.
DOCUMENT_WORK_SLOT = asyncio.Semaphore(1)
PROCESSOR_WAIT_SECONDS = 5.0


MAX_PENDING_JOBS = 2
_pending_jobs = 0


async def document_job(function, *args):
    """Bound queue memory and retain the worker slot after caller cancellation."""
    global _pending_jobs
    if _pending_jobs >= MAX_PENDING_JOBS:
        raise HTTPException(503, "Document processor queue is full. Retry shortly.",
                            headers={"Retry-After": "3"})
    _pending_jobs += 1
    try:
        try:
            await asyncio.wait_for(DOCUMENT_WORK_SLOT.acquire(), timeout=PROCESSOR_WAIT_SECONDS)
        except asyncio.TimeoutError as exc:
            raise HTTPException(503, "Document processor is handling another file. Retrying is safe.",
                                headers={"Retry-After": "3"}) from exc
    finally:
        _pending_jobs -= 1

    async def run():
        try:
            return await run_in_threadpool(function, *args)
        finally:
            DOCUMENT_WORK_SLOT.release()
    job = asyncio.create_task(run())
    # A disconnected/cancelled HTTP caller must not allow another CPU job to
    # start while its uninterruptible worker thread is still running.
    def consume_error(done):
        if not done.cancelled():
            done.exception()
    job.add_done_callback(consume_error)
    return await asyncio.shield(job)


@app.post("/analyze")
async def analyze(file: Annotated[UploadFile, File()]):
    data, ext = await _upload(file)
    # OCR and OpenCV must not block the ASGI event loop and /health.
    findings, limitations = await document_job(engine.inspect, data, ext)
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
        "analysis_id": snapshots.save(data, ext, findings, limitations),
        "source_sha256": engine.fingerprint(data),
        "review_expires_in": snapshots.TTL_SECONDS,
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
    image = await document_job(review.preview, data, ext, page)
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
    redact_all: Annotated[bool, Form()] = False,
    redaction_mode: Annotated[str, Form()] = "blackout",
):
    if redaction_mode not in {"blackout", "blur", "pixelate"}:
        raise HTTPException(422, "Invalid redaction mode")
    data, ext = await _upload(file)
    findings, original_notes = snapshots.get(analysis_id, data, ext)
    chosen = _expand_ids(findings, _ids(selected_ids, len(findings)), redact_all)
    if any(not f.rectangles and not f.location for f in chosen):
        raise HTTPException(422, "One or more selected findings could not be located")
    manual = review.parse_regions(manual_regions, ext)
    if not chosen and not manual:
        raise HTTPException(422, "Select a finding or draw a manual redaction box")
    if ext in engine.IMAGE_EXTENSIONS or ext == ".pdf":
        result, mime, name = await document_job(review.redact_visual, data, ext, chosen, manual, redaction_mode)
        result_ext = ".png" if ext in engine.IMAGE_EXTENSIONS else ".pdf"
    else:
        result, mime, name = await document_job(engine.redact, data, ext, chosen)
        result_ext = ext
    original_incomplete = any(note.startswith("UNVERIFIED:") for note in original_notes)
    report = await document_job(review.evaluate, chosen, result, result_ext, len(manual), redaction_mode, original_incomplete,
                                [f for f in findings if f not in chosen])
    if report["status"] == "FLAG":
        raise HTTPException(409,
            "FLAG: selected information is still detectable in the output"
            if report["remaining_selected_count"] else
            "FLAG: additional high-priority information was found during verification. Analyze and review the findings again.")
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
    redact_all: Annotated[bool, Form()] = False,
    redaction_mode: Annotated[str, Form()] = "blackout",
):
    if redaction_mode not in {"blackout", "blur", "pixelate"}:
        raise HTTPException(422, "Invalid redaction mode")
    original, ext = await _upload(file)
    initial, original_notes = snapshots.get(analysis_id, original, ext)
    output, out_ext = await _upload(redacted)
    valid_outputs = {".png"} if ext in engine.IMAGE_EXTENSIONS else {ext}
    if out_ext not in valid_outputs:
        raise HTTPException(422, "The redacted output has an unexpected format")
    chosen = _expand_ids(initial, _ids(selected_ids, len(initial)), redact_all)
    if manual_count < 0 or manual_count > 60:
        raise HTTPException(422, "Invalid manual redaction count")
    original_incomplete = any(note.startswith("UNVERIFIED:") for note in original_notes)
    return await document_job(review.evaluate, chosen, output, out_ext, manual_count, redaction_mode, original_incomplete,
                              [f for f in initial if f not in chosen])
