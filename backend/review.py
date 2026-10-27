"""Safety checks, document thumbnails, and user-drawn manual redaction boxes.

Image/PDF box coordinates are normalized to [0,1] of the displayed page.
"""
from __future__ import annotations

import io
import json
import math
import zipfile
from typing import Any

import pymupdf as fitz
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
    if ext in {".txt", ".csv"} and b"\x00" in data:
        raise HTTPException(422, "TXT must contain plain UTF-8 text, not binary data")
    if ext in {".docx", ".pptx", ".xlsx"}:
        if not data.startswith(b"PK"):
            raise HTTPException(415, "Word/PowerPoint file is not a valid OpenXML ZIP container")
        required = {"docx":"word/document.xml","pptx":"ppt/presentation.xml","xlsx":"xl/workbook.xml"}[ext.lstrip(".")]
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
    return preview_details(data, ext, page_number)[0]


def preview_details(data: bytes, ext: str, page_number: int):
    if ext in engine.IMAGE_EXTENSIONS:
        if page_number != 1:
            raise HTTPException(422, "Images have only one page")
        image = engine.read_image(data)
        width, height = image.size
        image.thumbnail((1400,1400))
    elif ext == ".pdf":
        with engine.open_pdf(data) as doc:
            if page_number<1 or page_number>doc.page_count:
                raise HTTPException(422, "Page number is outside this PDF")
            page = doc[page_number-1]
            width, height = page.rect.width, page.rect.height
            factor = min(2.0, 1400/max(page.rect.width,page.rect.height,1))
            pix = engine.render_pdf_page(page, factor)
            if pix.width*pix.height>engine.MAX_PIXELS:
                raise HTTPException(413, "Page preview is too large")
            image = Image.frombytes("RGB",(pix.width,pix.height),pix.samples)
    else:
        raise HTTPException(415, "Image preview is available only for PDFs and images")
    output = io.BytesIO()
    image.save(output,format="PNG")
    return output.getvalue(), width, height


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


def _paint(image: Image.Image, rectangle: tuple[float, float, float, float],
           mode: str, margin: int = 0) -> None:
    """Apply an actual pixel transformation, never a removable overlay."""
    from PIL import ImageFilter
    x0, y0, x1, y1 = rectangle
    left = max(0, math.floor(x0) - margin)
    top = max(0, math.floor(y0) - margin)
    right = min(image.width, math.ceil(x1) + margin)
    bottom = min(image.height, math.ceil(y1) + margin)
    if left >= right or top >= bottom:
        return
    coords = (left, top, right, bottom)
    if mode == "blackout":
        ImageDraw.Draw(image).rectangle(coords, fill="black")
        return
    crop = image.crop(coords)
    width, height = crop.size
    if mode == "blur":
        replacement = crop.filter(ImageFilter.GaussianBlur(radius=max(12, min(width, height) * .22)))
    elif mode == "pixelate":
        reduced = crop.resize((max(1, width // 20), max(1, height // 20)),
                              Image.Resampling.BILINEAR)
        replacement = reduced.resize(crop.size, Image.Resampling.NEAREST)
    else:
        raise HTTPException(422, "Unknown redaction mode")
    image.paste(replacement, (left, top))


def _page_boxes(page_number: int, bounds: fitz.Rect,
                selected: list[engine.Finding], manual: list[dict[str, float | int]]
                ) -> list[tuple[tuple[float, float, float, float], str]]:
    """Return page-space areas with the requested effect class.

    Only face photos and manual image selections can be softened; text and QR
    codes are always permanently blacked out even with visual blur selected.
    """
    boxes: list[tuple[tuple[float, float, float, float], str]] = []
    for finding in selected:
        if finding.page == page_number:
            for rect in finding.rectangles:
                boxes.append((tuple(rect), "visual" if finding.category == "face_candidate" else "blackout"))
    for region in manual:
        if region["page"] == page_number:
            boxes.append(((bounds.x0 + region["x"] * bounds.width,
                           bounds.y0 + region["y"] * bounds.height,
                           bounds.x0 + (region["x"] + region["w"]) * bounds.width,
                           bounds.y0 + (region["y"] + region["h"]) * bounds.height), "visual"))
    return boxes


def _scrub_pdf_extras(doc: fitz.Document) -> None:
    """Discard obvious PDF metadata and hidden payload containers.

    This is a best-effort local safeguard, not a complete PDF sanitizer.
    Hidden layers, forms, scripts and accessibility text may still need audit.
    """
    doc.set_metadata({})
    if doc.xref_xml_metadata():
        doc.del_xml_metadata()
    for name in list(doc.embfile_names()):
        doc.embfile_del(name)
    for page in doc:
        for annotation in list(page.annots() or []):
            page.delete_annot(annotation)
        for link in list(page.get_links()):
            page.delete_link(link)


def redact_visual(data: bytes, ext: str, selected: list[engine.Finding],
                  manual: list[dict[str, float | int]],
                  mode: str = "blackout") -> tuple[bytes, str, str]:
    if mode not in {"blackout", "blur", "pixelate"}:
        raise HTTPException(422, "Redaction mode must be blackout, blur or pixelate")
    if ext in engine.IMAGE_EXTENSIONS:
        image = engine.read_image(data)
        if any(region["page"] != 1 for region in manual):
            raise HTTPException(422, "Images have one page only")
        bounds = fitz.Rect(0, 0, image.width, image.height)
        boxes = _page_boxes(1, bounds, selected, manual)
        # Blackout is ALWAYS used for detected IDs and QR codes.
        for rect, kind in boxes:
            _paint(image, rect, mode if kind == "visual" else "blackout",
                   margin=4 if kind == "blackout" else 0)
        output = io.BytesIO()
        image.save(output, format="PNG")
        result = output.getvalue()
        return result, "image/png", "shareshield-redacted.png"

    if ext != ".pdf":
        raise HTTPException(415, "Visual masking is only available for images and PDFs")
    with engine.open_pdf(data) as doc:
        if any(region["page"] > doc.page_count for region in manual):
            raise HTTPException(422, "Manual mask refers to a nonexistent PDF page")
        if mode == "blackout":
            for page_number, page in enumerate(doc, 1):
                boxes = _page_boxes(page_number, page.rect, selected, manual)
                if not boxes:
                    continue
                for rectangle, _ in boxes:
                    # PyMuPDF annotations use unrotated page coordinates.
                    target = fitz.Rect(rectangle) * page.derotation_matrix
                    page.add_redact_annot(target, fill=(0, 0, 0))
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)
            # Remove metadata and extraneous attachments/annotations/links.
            _scrub_pdf_extras(doc)
            result = doc.tobytes(garbage=4, deflate=True, clean=True)
        else:
            # Blur/pixelate PDFs ONLY after flattening every page. This prevents
            # original selectable text or embedded images hiding under a mask.
            with fitz.open() as flattened:
                for page_number, page in enumerate(doc, 1):
                    pix = engine.render_pdf_page(page, 2)
                    if pix.width * pix.height > engine.MAX_PIXELS:
                        raise HTTPException(413, "Flattened PDF page exceeds 25 MP")
                    image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                    for rectangle, kind in _page_boxes(page_number, page.rect, selected, manual):
                        coords = tuple(2 * value for value in rectangle)
                        _paint(image, coords, mode if kind == "visual" else "blackout",
                               margin=7 if kind == "blackout" else 0)
                    payload = io.BytesIO()
                    image.save(payload, format="PNG")
                    output_page = flattened.new_page(width=page.rect.width, height=page.rect.height)
                    output_page.insert_image(output_page.rect, stream=payload.getvalue())
                result = flattened.tobytes(garbage=4, deflate=True, clean=True)
    return result, "application/pdf", "shareshield-redacted.pdf"


def evaluate(selected: list[engine.Finding], redacted_data: bytes, ext: str,
             manual_count: int=0, mode: str = "blackout",
             original_incomplete: bool = False,
             retained: list[engine.Finding] | None = None) -> dict[str,Any]:
    """Rescan the *entire* export, not only previously selected values.

    Never claim full privacy: undetected visual content, OCR errors and
    metadata may remain. Audit JSON contains counts and categories, not
    raw identifiers or the unmasked selected values.
    """
    check_file(redacted_data, ext)
    found, warnings = engine.inspect(redacted_data, ext)
    selected_values = {(f.category, f.value) for f in selected
                       if f.category not in {"face_candidate", "qr_candidate", "text_region_candidate"}}
    remaining_values = {(f.category, f.value) for f in found
                        if f.category not in {"face_candidate", "qr_candidate", "text_region_candidate"}}
    leaked = selected_values.intersection(remaining_values)
    remaining_selected = [
        {"category": f.category, "page": f.page, "severity": engine.SEVERITY.get(f.category, "medium")}
        for f in found if (f.category, f.value) in leaked
    ]
    # Previously reviewed but unselected findings are intentional retained
    # content. Warn without misreporting a failed selected redaction. New
    # high-risk discoveries still block export and require another review.
    high_risk = [f for f in found if engine.SEVERITY.get(f.category) == "high"
                 and f.category not in {"face_candidate", "qr_candidate"}]
    retained_values = {(f.category, f.value) for f in (retained or [])}
    unexpected_high_risk = [f for f in high_risk
                            if (f.category, f.value) not in retained_values]
    retained_found = [f for f in found if (f.category, f.value) in retained_values]
    remainder = [
        {"category": f.category, "page": f.page,
         "severity": engine.SEVERITY.get(f.category, "medium")}
        for f in found
    ]
    contains_visual = any(f.category in {"face_candidate", "qr_candidate", "text_region_candidate"} for f in selected)
    # Office file internals and workbook metadata are not completely
    # sanitized. Never represent a scoped text check as comprehensive safety.
    office_unverified = ext in {".docx", ".pptx", ".xlsx"}
    scan_incomplete = original_incomplete or office_unverified or any(
        note.startswith("UNVERIFIED:") or "OCR timed out" in note or "OCR is unavailable" in note
        or "Tesseract OCR is unavailable" in note for note in warnings
    )
    status = (
        "FLAG" if remaining_selected or unexpected_high_risk else
        "UNVERIFIED" if scan_incomplete or remainder or manual_count or contains_visual or mode != "blackout" else
        "PASS_SCOPED" if selected else "UNVERIFIED"
    )
    checks = ["Reopened and rescanned the complete exported file"]
    if ext in engine.IMAGE_EXTENSIONS or ext == ".pdf":
        if engine.ocr_available():
            checks.append("Reran available OCR and text patterns over all exported pages")
        else:
            checks.append("Reran extractable text checks; OCR NOT available")
    else:
        checks.append("Reran available cell/text patterns across the exported document")
    checks.append("Compared selected values and checked for other remaining candidates")
    return {
        "status": status,
        "selected_count": len(selected),
        "manual_boxes": manual_count,
        "remaining_selected": remaining_selected[:50],
        "remaining_selected_count": len(remaining_selected),
        "remaining_detected": remainder[:50],
        "remaining_detected_count": len(remainder),
        "remaining_high_risk_count": len(high_risk),
        "remaining_unselected_count": len(retained_found),
        "unexpected_high_risk_count": len(unexpected_high_risk),
        "redaction_mode": mode,
        "checks": checks,
        "output_sha256": engine.fingerprint(redacted_data),
        "unverified": [
            "Only recognized patterns were checked; undetected text, images and identity numbers may remain.",
            *(["UNVERIFIED: The original image/PDF was not completely scanned, so the exported document cannot receive a scoped pass."] if original_incomplete else []),
            *(["Office and spreadsheet internal content is not completely sanitized; output is UNVERIFIED."] if office_unverified else []),
            "OCR and visual recognition can miss small or noisy text, Kannada, handwritten fields and unusual codes.",
            "Document metadata, embedded/hidden content and Office revision history are not fully sanitized.",
            *warnings,
            *(["Unreviewed high-priority identifiers remain. Export is blocked; analyze and review again."] if unexpected_high_risk else []),
            *(["Previously detected information was left unselected and remains visible. Confirm that retaining it is intentional before sharing."] if retained_found else []),
            *(["Some unselected candidate identifiers remain. Review them before sharing."] if remainder and not high_risk else []),
            *(["Faces/QR candidates require human visual review; their removal is not machine-certified."] if contains_visual else []),
            *(["Blur/pixelation may expose information. Blackout is recommended for private documents."] if mode != "blackout" else []),
            *(["Manual boxes have not been independently verified. Inspect every page."] if manual_count else []),
        ],
    }
