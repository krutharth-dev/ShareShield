from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse
from pydantic import ValidationError

from .services.storage import JobStorage
from .services.processing import analyze_file, redact_file
from .services.detection import detector
from .contracts.schemas import Finding, RedactionRequest

MAX_UPLOAD_BYTES = int(os.getenv("SHARESHIELD_MAX_UPLOAD_BYTES", 20 * 1024 * 1024))
DATA_DIR = Path(os.getenv("SHARESHIELD_DATA_DIR", "./.shareshield_data")).resolve()
JOB_TTL_SECONDS = int(os.getenv("SHARESHIELD_JOB_TTL_SECONDS", 24 * 60 * 60))
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}

storage = JobStorage(DATA_DIR, ttl_seconds=JOB_TTL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    storage.cleanup_expired()
    yield


app = FastAPI(title="ShareShield API", version="0.2.0", lifespan=lifespan)

@app.get("/")
def root():
    return {
        "project": "ShareShield",
        "service": "Backend API",
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
    # Pydantic 2 / OpenAPI 3.1 emits contentMediaType; Swagger UI expects binary
    # for its conventional multipart file picker.
    body = schema.get("components", {}).get("schemas", {}).get(
        "Body_analyze_v1_analyze_post", {}
    )
    item = body.get("properties", {}).get("files", {}).get("items", {})
    if item.get("contentMediaType") == "application/octet-stream":
        item.pop("contentMediaType", None)
        item["format"] = "binary"
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi


@app.get("/health")
def health():
    return {"status": "ok", "service": "shareshield-backend", "version": app.version}


def _validate_findings(raw_findings, file_id: str) -> list[Finding]:
    findings = [item if isinstance(item, Finding) else Finding.model_validate(item)
                for item in raw_findings]
    ids = [item.finding_id for item in findings]
    if len(ids) != len(set(ids)):
        raise ValueError("Detection engine returned duplicate finding IDs.")
    for finding in findings:
        if finding.location.page is None and finding.location.x0 < 0:
            raise ValueError("Invalid finding coordinates.")
    return findings


@app.post("/v1/analyze")
async def analyze(files: Annotated[list[UploadFile], File(...)]) -> dict:
    if not files:
        raise HTTPException(400, "At least one file is required.")
    if len(files) > 10:
        raise HTTPException(413, "A maximum of 10 files can be processed per request.")

    storage.cleanup_expired()
    job_id = uuid.uuid4().hex
    storage.create_job(job_id)
    results = []

    try:
        for upload in files:
            original_name = Path(upload.filename or "upload").name
            suffix = Path(original_name).suffix.lower()
            if suffix not in ALLOWED_EXTENSIONS:
                raise HTTPException(415, f"Unsupported file type: {suffix or 'unknown'}")
            file_id = uuid.uuid4().hex
            source_path = storage.input_path(job_id, file_id, suffix)

            total = 0
            with source_path.open("wb") as target:
                while chunk := await upload.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_UPLOAD_BYTES:
                        raise HTTPException(413, f"{original_name} exceeds the upload size limit.")
                    target.write(chunk)
            await upload.close()

            if total == 0:
                raise HTTPException(400, f"{original_name} is empty.")

            try:
                parsed = analyze_file(source_path, file_id)
                raw_findings = detector.detect(parsed["extracted_content"], file_id) if detector else []
                findings = _validate_findings(raw_findings, file_id)
            except (ValueError, ValidationError) as exc:
                raise HTTPException(422, f"File analysis failed: {exc}") from exc
            except Exception as exc:
                raise HTTPException(422, "File analysis or OCR failed.") from exc

            results.append({
                "file_id": file_id,
                "filename": original_name,
                "media_type": parsed["media_type"],
                "extracted_content": parsed["extracted_content"],
                "findings": [item.model_dump() for item in findings],
                "detection_status": "ready" if detector else "not_configured",
            })

        storage.write_manifest(job_id, results)
        return {
            "job_id": job_id,
            "status": "analysis_complete",
            "files": results,
            "notice": (
                "No automatic detection is configured yet. Connect the detection adapter "
                "before treating an empty findings list as a clean result."
                if detector is None else
                "Review findings carefully and select only the items you approve for redaction."
            )
        }
    except Exception:
        storage.remove_job(job_id)
        raise
    finally:
        for upload in files:
            if not upload.file.closed:
                await upload.close()


@app.post("/v1/redact")
def redact(request: RedactionRequest) -> dict:
    manifest = storage.read_manifest(request.job_id)
    if manifest is None:
        raise HTTPException(404, "Unknown, expired, or unavailable job.")
    by_id = {item["file_id"]: item for item in manifest}
    outputs = []
    seen_files = set()

    for selection in request.selections:
        if selection.file_id in seen_files:
            raise HTTPException(422, "A file may appear only once in selections.")
        seen_files.add(selection.file_id)
        file_info = by_id.get(selection.file_id)
        if file_info is None:
            raise HTTPException(404, f"File {selection.file_id} does not belong to this job.")

        findings = {item["finding_id"]: Finding.model_validate(item)
                    for item in file_info.get("findings", [])}
        if not findings:
            raise HTTPException(
                409,
                "No server-generated findings exist for this file. Detection must be configured before finding-based redaction."
            )
        if len(selection.finding_ids) != len(set(selection.finding_ids)):
            raise HTTPException(422, "Duplicate finding IDs are not allowed.")
        unknown = set(selection.finding_ids) - set(findings)
        if unknown:
            raise HTTPException(422, "One or more finding IDs are invalid for this file.")

        source = storage.find_input(request.job_id, selection.file_id)
        output_suffix = ".png" if source.suffix.lower() in {".jpg", ".jpeg", ".png"} else source.suffix
        output = storage.output_path(request.job_id, selection.file_id, output_suffix)
        regions = [findings[finding_id].location for finding_id in selection.finding_ids]
        try:
            actual_output = redact_file(source, output, regions)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        outputs.append({
            "file_id": selection.file_id,
            "output_name": actual_output.name,
            "download_url": f"/v1/files/{request.job_id}/{selection.file_id}/output",
            "selected_finding_ids": selection.finding_ids,
            "status": "generated"
        })

    return {"job_id": request.job_id, "status": "redaction_complete", "outputs": outputs}


@app.get("/v1/files/{job_id}/{file_id}/output")
def download_output(job_id: str, file_id: str):
    try:
        path = storage.find_output(job_id, file_id)
    except ValueError:
        path = None
    if path is None:
        raise HTTPException(404, "Output not found.")
    return FileResponse(path, filename=f"redacted_{file_id}{path.suffix}")

