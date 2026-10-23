"""Safety checks, document thumbnails, and user-drawn manual redaction boxes.

Image/PDF box coordinates are normalized to [0,1] of the displayed page.
"""
from __future__ import annotations

import io
import json
import math
import zipfile
from typing import Any

import fitz
from fastapi import HTTPException
from PIL import Image, ImageDraw

from backend import engine

MAGIC = {
    ".pdf": lambda b: b.startswith(b"%PDF-"),
    ".jpg": lambda b: b.startswith(b"\xff\xd8\xff"),
    ".jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    ".png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    ".webp": lambda b: len(b)>12 and b.startswith(b"RIFF") and b[8:12]==b"WEBP",
    ".bmp": lambda b: b.startswith(b"BM"),
    ".tif": lambda b: b.startswith(b"II*\x00") or b.startswith(b"MM\x00*"),
    ".tiff": lambda b: b.startswith(b"II*\x00") or b.startswith(b"MM\x00*"),
    ".heic": lambda b: len(b)>12 and b[4:8]==b"ftyp" and b[8:12] in (b"heic", b"heix", b"hevc", b"mif1", b"msf1"),
    ".heif": lambda b: len(b)>12 and b[4:8]==b"ftyp" and b[8:12] in (b"heif", b"mif1", b"msf1"),
}


def check_file(data: bytes, ext: str) -> None:
    engine.validate_bytes(data)
    if ext in MAGIC and not MAGIC[ext](data):
        raise HTTPException(415, "The file content does not match its extension")
    if ext == ".txt" and b"\x00" in data:
        raise HTTPException(422, "TXT must contain plain UTF-8 text, not binary data")
    if ext in {".docx", ".pptx"}:
        if not data.startswith(b"PK"):
            raise HTTPException(415, "Word/PowerPoint file is not a valid OpenXML ZIP container")
        required = "word/document.xml" if ext==".docx" else "ppt/presentation.xml"
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                parts = archive.infolist()
                if len(parts)>1500:
                    raise HTTPException(413, "Too many document components")
                if sum(p.file_size for p in parts)>60*1024*1024:
                    raise HTTPException(413, "Uncompressed document exceeds 60 MiB")
                for part in parts:
                    if part.flag_bits & 1:
                        raise HTTPException(422, "Encrypted Office components are unsupported")
                    if part.file_size>1024*1024 and part.file_size/max(1,part.compress_size)>150:
                        raise HTTPException(413, "Suspiciously compressed document component")
                if "[Content_Types].xml" not in archive.namelist() or required not in archive.namelist():
                    raise HTTPException(415, "Unexpected Office document structure")
        except HTTPException:
            raise
        except (OSError, ValueError, zipfile.BadZipFile) as exc:
            raise HTTPException(422, "Invalid or damaged Office container") from exc


def preview(data: bytes, ext: str, page_number: int) -> bytes:
    if ext in engine.IMAGE_EXTENSIONS:
        if page_number != 1:
            raise HTTPException(422, "Images have only one page")
        image = engine.read_image(data)
        image.thumbnail((1400,1400))
    elif ext == ".pdf":
        with engine.open_pdf(data) as doc:
            if page_number<1 or page_number>doc.page_count:
                raise HTTPException(422, "Page number is outside this PDF")
            page = doc[page_number-1]
            factor = min(2.0, 1400/max(page.rect.width,1))
            pix = page.get_pixmap(matrix=fitz.Matrix(factor,factor), alpha=False)
            if pix.width*pix.height>engine.MAX_PIXELS:
                raise HTTPException(413, "Page preview is too large")
            image = Image.frombytes("RGB",(pix.width,pix.height),pix.samples)
    else:
        raise HTTPException(415, "Image preview is available only for PDFs and images")
    output = io.BytesIO()
    image.save(output,format="PNG")
    return output.getvalue()


def parse_regions(raw: str, ext: str) -> list[dict[str,float|int]]:
    try:
        data = json.loads(raw or "[]")
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(422, "Manual redactions must be a JSON array") from exc
    if not isinstance(data,list) or len(data)>60:
        raise HTTPException(422, "Provide at most 60 manual redaction boxes")
    if data and ext not in (engine.IMAGE_EXTENSIONS | {".pdf"}):
        raise HTTPException(422, "Manual visual redaction is supported only for PDFs and images")
    parsed=[]
    for item in data:
        if not isinstance(item,dict) or set(item)!={"page","x","y","w","h"}:
            raise HTTPException(422, "Each box needs page, x, y, w and h")
        page = item["page"]
        if isinstance(page,bool) or not isinstance(page,int) or page < 1:
            raise HTTPException(422, "Invalid manual-redaction page")
        try:
            values=[float(item[k]) for k in ("x","y","w","h")]
        except (TypeError,ValueError,OverflowError) as exc:
            raise HTTPException(422, "Manual box coordinates must be numeric") from exc
        x,y,w,h=values
        if not all(math.isfinite(v) for v in values) or x<0 or y<0 or w<=.002 or h<=.002 or x+w>1.00001 or y+h>1.00001:
            raise HTTPException(422, "Manual redaction boxes must fit within the image")
        parsed.append({"page":page,"x":x,"y":y,"w":w,"h":h})
    return parsed


def redact_visual(data: bytes, ext: str, selected: list[engine.Finding],
                  manual: list[dict[str,float|int]]) -> tuple[bytes,str,str]:
    if ext in engine.IMAGE_EXTENSIONS:
        image = engine.read_image(data)
        draw = ImageDraw.Draw(image)
        for f in selected:
            for x0,y0,x1,y1 in f.rectangles:
                draw.rectangle((max(0,int(x0)-4),max(0,int(y0)-4),
                                min(image.width,int(x1)+4),min(image.height,int(y1)+4)), fill="black")
        for r in manual:
            if r["page"] != 1:
                raise HTTPException(422, "Images have one page only")
            draw.rectangle((round(r["x"]*image.width),round(r["y"]*image.height),
                            round((r["x"]+r["w"])*image.width),
                            round((r["y"]+r["h"])*image.height)), fill="black")
        output = io.BytesIO()
        image.save(output,"PNG")
        result=output.getvalue()
        remaining=engine.ocr(engine.read_image(result),1)
        if any((a.category,a.value) in {(b.category,b.value) for b in remaining} for a in selected):
            raise HTTPException(409, "FLAG: a selected item remains in the redacted image")
        return result,"image/png","shareshield-redacted.png"
    with engine.open_pdf(data) as doc:
        boxes: dict[int,list[fitz.Rect]]={}
        for finding in selected:
            for r in finding.rectangles:
                boxes.setdefault(finding.page,[]).append(fitz.Rect(r))
        for r in manual:
            if r["page"]>doc.page_count:
                raise HTTPException(422, "Manual box refers to a nonexistent PDF page")
            bounds=doc[r["page"]-1].rect
            boxes.setdefault(r["page"],[]).append(fitz.Rect(
                bounds.x0+r["x"]*bounds.width,bounds.y0+r["y"]*bounds.height,
                bounds.x0+(r["x"]+r["w"])*bounds.width,
                bounds.y0+(r["y"]+r["h"])*bounds.height))
        for n,rectangles in boxes.items():
            p=doc[n-1]
            for box in rectangles:
                p.add_redact_annot(box,fill=(0,0,0))
            p.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)
        result=doc.tobytes(garbage=4,deflate=True,clean=True)
    with engine.open_pdf(result) as pdf:
        after,_=engine._pdf_findings(pdf)
    tokens={(f.category,f.value,f.page) for f in after}
    if any((f.category,f.value,f.page) in tokens for f in selected):
        raise HTTPException(409, "FLAG: a selected item remains in the redacted PDF")
    return result,"application/pdf","shareshield-redacted.pdf"


def evaluate(selected: list[engine.Finding], redacted_data: bytes, ext: str,
             manual_count: int=0) -> dict[str,Any]:
    """Check selected values in exported file, always flag unchecked surfaces."""
    check_file(redacted_data,ext)
    found, warnings = engine.inspect(redacted_data,ext)
    remaining={(f.category,f.value) for f in found}
    flagged=[{"category":f.category,"value":f.value} for f in selected
             if (f.category,f.value) in remaining]
    status="FLAG" if flagged else "PASS_SCOPED" if selected else "UNVERIFIED"
    return {"status":status,"selected_count":len(selected),"manual_boxes":manual_count,
            "remaining_selected":flagged,
            "checks":["Reopened exported file","Reran configured text/OCR detectors","Compared selected detected values"],
            "unverified":[
                "Only recognized selected values were checked; other sensitive data may remain.",
                "OCR and pattern recognition may miss sensitive content.",
                "Document metadata, embedded/hidden content and Office revision history are not fully sanitized.",
                *warnings,
                *(["Manual boxes were not independently verified for sensitive text."] if manual_count else []),
            ]}
