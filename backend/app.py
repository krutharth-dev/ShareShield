"""ShareShield local-only UI and API: use uvicorn backend.app:app --host 127.0.0.1."""
from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from backend.engine import MAX_BYTES, extension, fingerprint, inspect, redact

app = FastAPI(title="ShareShield local privacy review API", version="0.2.0")
STATIC = Path(__file__).parent / "static" / "index.html"


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(STATIC, media_type="text/html", headers={"Cache-Control": "no-store"})


@app.get("/health")
def health():
    return {"status": "ok", "mode": "local-multiformat-prototype"}


async def _upload(file: UploadFile) -> tuple[bytes,str]:
    ext = extension(file.filename or "")
    data = await file.read(MAX_BYTES+1)
    if len(data) > MAX_BYTES or not data:
        raise HTTPException(413,"File must be nonempty and under 12 MiB")
    return data,ext


@app.post("/analyze")
async def analyze(file: Annotated[UploadFile, File()]):
    data,ext = await _upload(file)
    findings,limits = inspect(data,ext)
    return {"filename": file.filename, "format": ext, "analysis_id": fingerprint(data),
            "findings": [f.public(i) for i,f in enumerate(findings)],
            "limitations": limits,
            "message": "Review each finding. Undetected and unsupported sensitive content may remain."}


@app.post("/redact")
async def redact_selected(
    file: Annotated[UploadFile, File()],
    selected_ids: Annotated[str, Form(description="Comma-separated IDs returned by /analyze")],
    analysis_id: Annotated[str, Form(description="SHA-256 analysis_id returned by /analyze")],
):
    data,ext = await _upload(file)
    if fingerprint(data) != analysis_id:
        raise HTTPException(409,"File differs from the one analyzed; please analyze again")
    try:
        ids = [int(i.strip()) for i in selected_ids.split(",") if i.strip()]
    except ValueError as exc:
        raise HTTPException(422,"selected_ids must be comma-separated integers") from exc
    if not ids or len(ids) != len(set(ids)) or any(i<0 for i in ids):
        raise HTTPException(422,"Select one or more unique finding IDs")
    findings,_ = inspect(data,ext)
    if any(i>=len(findings) for i in ids):
        raise HTTPException(422,"Finding IDs do not match file")
    selected = [findings[i] for i in ids]
    if any(not f.rectangles and not f.location for f in selected):
        raise HTTPException(422,"One or more selected findings cannot be located")
    result,mimetype,output_name = redact(data,ext,selected)
    return Response(content=result,media_type=mimetype,
                    headers={"Content-Disposition":f'attachment; filename="{output_name}"',
                             "X-ShareShield-Verification":"PASS-SELECTED-FINDINGS-ONLY",
                             "X-ShareShield-Selected-Count":str(len(selected)),
                             "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"})
