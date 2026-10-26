"""Pretrained handwriting recognition on this server; no document API uploads."""
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
from fastapi import HTTPException
from PIL import Image
from backend import engine

MODEL_DIR = Path(os.getenv('SHARESHIELD_MODEL_DIR', Path(__file__).parent / 'models'))
NOTICE = 'UNVERIFIED: Experimental pretrained handwriting recognition can miss or misread text. Export reinspection uses local OCR and is not independent handwriting certification. Visually review every page.'


def available():
    return all((MODEL_DIR / name).is_file() for name in ('det.onnx','rec.onnx')) and importlib.util.find_spec('rapidocr') is not None and importlib.util.find_spec('onnxruntime') is not None


def inspect(data, ext):
    if ext not in engine.IMAGE_EXTENSIONS | {'.pdf'}:
        raise HTTPException(422, 'Handwriting mode accepts images and PDFs only.')
    if ext == '.pdf':
        with engine.open_pdf(data) as doc:
            if doc.page_count > 2:
                raise HTTPException(422, 'Handwriting mode supports at most two pages. Split the document.')
    else:
        try:
            with Image.open(io.BytesIO(data)) as image:
                if image.width * image.height > 4_000_000:
                    raise HTTPException(413, 'Handwriting images are limited to 4 megapixels. Resize the image first.')
                if getattr(image, 'n_frames', 1) > 1:
                    raise HTTPException(422, 'Handwriting mode requires a single image frame. Convert all frames to a PDF.')
        except (OSError, ValueError) as exc:
            raise HTTPException(422, 'Unreadable handwriting image.') from exc
    if not available():
        raise HTTPException(503, 'The handwriting model is unavailable. Use standard scanning or manual masks.')
    env = {**os.environ, 'OMP_THREAD_LIMIT':'1', 'OPENBLAS_NUM_THREADS':'1', 'SHARESHIELD_MODEL_DIR':str(MODEL_DIR)}
    try:
        # Source bytes travel over pipes only. A fresh child releases model memory
        # after the scan; subprocess.run kills and waits for timed-out children.
        result = subprocess.run([sys.executable, '-m', 'backend.handwriting_runner', ext],
                                input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                env=env, timeout=45, check=False,
                                cwd=Path(__file__).resolve().parents[1])
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(504, 'Handwriting scan timed out. Try a smaller image or manual masks.') from exc
    if result.returncode != 0:
        raise HTTPException(503, 'Handwriting recognition could not finish. Use a smaller file or manual masks.')
    try:
        body = json.loads(result.stdout)
        records = body['findings']
        if not isinstance(records, list) or len(records) > engine.MAX_FINDINGS:
            raise ValueError('Too many findings')
        findings = [engine.Finding(**item) for item in records]
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(503, 'Handwriting results could not be read safely. Use manual masks.') from exc
    notes = [NOTICE, 'Recognition runs on the ShareShield server using PP-OCRv5 mobile English models. No Azure account, API key or external document upload is used. All suggestions require explicit selection.',
             'Word boxes are estimates. Use whole-line suggestions or manual blackout boxes if a word mask is too tight. Inspect faces, signatures, codes, hidden content and unrecognized writing manually.']
    if not findings:
        notes.append('UNVERIFIED: No text was recognized. This does not mean the document is safe.')
    return findings, notes
