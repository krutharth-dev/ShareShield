"""Local document inspection and selected redaction.

Only recognized, locatable text is processed. A successful result is never a
blanket security certification. This module does not persist uploaded files.
"""
from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import fitz
from docx import Document
from fastapi import HTTPException
from PIL import Image, ImageDraw, ImageOps, UnidentifiedImageError
from pptx import Presentation
import pytesseract
from pytesseract import Output

from backend.patterns import MORE_RULES, SEVERITY, valid_match

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC_AVAILABLE = True
except ImportError:
    HEIC_AVAILABLE = False

MAX_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 25_000_000
MAX_PAGES = 25
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

EXTENSIONS = {".pdf", ".docx", ".pptx", ".txt", ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif", ".csv", ".xlsx"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif"}
EMAIL = re.compile(r"(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])")
PHONE = re.compile(r"(?<!\d)(?:\+91[ -]?)?[6-9]\d{9}(?!\d)")
RULES = (("email", EMAIL), ("indian_mobile_candidate", PHONE))


@dataclass
class Finding:
    category: str
    value: str
    page: int
    rectangles: list[tuple[float, float, float, float]]
    location: str = ""

    def public(self, index: int) -> dict:
        return {"id": index, "category": self.category, "value": self.value,
                "page": self.page, "locatable": bool(self.rectangles) or bool(self.location),
                "severity": SEVERITY.get(self.category, "medium"),
                "rectangles": self.rectangles}


def extension(filename: str) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext not in EXTENSIONS:
        raise HTTPException(415, f"Unsupported format: {ext or 'unknown'}. Use PDF, DOCX, PPTX, XLSX, CSV, TXT, JPG, PNG, HEIC, TIFF, BMP or WEBP. Legacy .doc is not supported; save it as .docx.")
    if ext in {".heic", ".heif"} and not HEIC_AVAILABLE:
        raise HTTPException(503, "HEIC requires pillow-heif. Install backend/requirements.txt in the active virtual environment.")
    return ext


def validate_bytes(data: bytes) -> None:
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413, "File must be nonempty and no larger than 12 MiB")


def scan_text(text: str, page: int, rectangles: Callable[[str, int, int], list[tuple[float,float,float,float]]] | None = None, location: str = "") -> list[Finding]:
    matches = []
    for category, regex in RULES + MORE_RULES:
        for match in regex.finditer(text):
            if not valid_match(category, match.group(0)):
                continue
            boxes = rectangles(match.group(0), match.start(), match.end()) if rectangles else []
            matches.append((match.start(), Finding(category, match.group(0), page, boxes, location)))
    return [m[1] for m in sorted(matches, key=lambda v: v[0])]


def ocr(image: Image.Image, page: int, scale: float = 1.0) -> list[Finding]:
    """Locate matches in OCR lines; return rectangles in original image/page units."""
    try:
        result = pytesseract.image_to_data(image.convert("RGB"), output_type=Output.DICT, config="--psm 11")
    except (pytesseract.TesseractNotFoundError, OSError) as exc:
        raise HTTPException(503, "OCR unavailable: install the Tesseract application (macOS: brew install tesseract), then restart ShareShield") from exc
    except pytesseract.TesseractError as exc:
        raise HTTPException(422, "OCR failed on this image; try a clearer file") from exc
    lines: dict[tuple[int,int,int,int], list[tuple[str, tuple[float,float,float,float]]]] = {}
    for i, word in enumerate(result["text"]):
        word = word.strip()
        if not word:
            continue
        key = tuple(int(result[k][i]) for k in ("page_num", "block_num", "par_num", "line_num"))
        x,y,w,h = (float(result[k][i]) / scale for k in ("left", "top", "width", "height"))
        lines.setdefault(key, []).append((word, (x,y,x+w,y+h)))
    findings = []
    for words in lines.values():
        pieces, spans, cursor = [], [], 0
        for word, box in words:
            if pieces:
                cursor += 1
            start = cursor
            pieces.append(word)
            cursor += len(word)
            spans.append((start, cursor, box))
        full = " ".join(pieces)
        def locate(_value: str, start: int, end: int) -> list[tuple[float,float,float,float]]:
            touching = [r for s,e,r in spans if e > start and s < end]
            if not touching:
                return []
            return [(min(r[0] for r in touching), min(r[1] for r in touching), max(r[2] for r in touching), max(r[3] for r in touching))]
        findings.extend(scan_text(full, page, locate))
    return findings


def read_image(data: bytes) -> Image.Image:
    try:
        with Image.open(io.BytesIO(data)) as raw:
            if getattr(raw, "n_frames", 1) > 1:
                raise HTTPException(422, "Animated or multipage images are not supported; select one frame")
            if raw.width * raw.height > MAX_PIXELS:
                raise HTTPException(413, "Image exceeds the 25-megapixel limit")
            image = ImageOps.exif_transpose(raw)
            return image.convert("RGB")
    except HTTPException:
        raise
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(422, "Unreadable or invalid image") from exc


def open_pdf(data: bytes):
    try:
        pdf = fitz.open(stream=data, filetype="pdf")
        if pdf.needs_pass or pdf.is_encrypted:
            pdf.close()
            raise HTTPException(422, "Password-protected PDFs are unsupported")
        if not 0 < pdf.page_count <= MAX_PAGES:
            pdf.close()
            raise HTTPException(422, "PDF must have between 1 and 25 pages")
        return pdf
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(422, "Unreadable or invalid PDF") from exc


def _pdf_findings(pdf: fitz.Document) -> tuple[list[Finding], list[str]]:
    findings: list[Finding] = []
    notes = [
        "PDF annotations, attachments, file metadata and embedded content are not fully inspected.",
        "OCR checks rendered PDF pages, but faint text, handwriting and unusual layouts may be missed.",
    ]
    for number, page in enumerate(pdf, 1):
        text = page.get_text("text", sort=True)
        native = scan_text(
            text, number,
            lambda value, a, b: [tuple(r) for r in page.search_for(value)]
        )
        # Every page is rendered, not just image-only pages, so that screenshots
        # embedded in otherwise searchable PDFs can be detected as candidates.
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        if pix.width * pix.height > MAX_PIXELS:
            raise HTTPException(413, "Rendered PDF page exceeds 25-megapixel image limit")
        image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        visual = ocr(image, number, scale=2)
        combined: dict[tuple[str,str,int], Finding] = {}
        for finding in native + visual:
            key = (finding.category, finding.value, finding.page)
            if key not in combined:
                combined[key] = finding
            else:
                prior = combined[key]
                for rect in finding.rectangles:
                    if rect not in prior.rectangles:
                        prior.rectangles.append(rect)
        findings.extend(combined.values())
    return findings, notes


def _paragraphs_docx(doc):
    def walk_table(table, prefix):
        for row_i,row in enumerate(table.rows):
            for col_i,cell in enumerate(row.cells):
                loc = f"{prefix}:r{row_i}:c{col_i}"
                for p_i,p in enumerate(cell.paragraphs):
                    yield f"{loc}:p{p_i}", p
                for t_i,nested in enumerate(cell.tables):
                    yield from walk_table(nested, f"{loc}:t{t_i}")
    for i,p in enumerate(doc.paragraphs):
        yield f"body:p{i}", p
    for i,table in enumerate(doc.tables):
        yield from walk_table(table, f"body:t{i}")
    for sec_i,section in enumerate(doc.sections):
        for name,part in (("header",section.header),("footer",section.footer)):
            for i,p in enumerate(part.paragraphs):
                yield f"sec{sec_i}:{name}:p{i}", p
            for i,t in enumerate(part.tables):
                yield from walk_table(t, f"sec{sec_i}:{name}:t{i}")


def _walk_shapes(shapes, prefix):
    for i,shape in enumerate(shapes):
        loc = f"{prefix}:s{i}"
        if shape.has_text_frame:
            for j,p in enumerate(shape.text_frame.paragraphs):
                yield f"{loc}:p{j}", p
        if shape.has_table:
            for r,row in enumerate(shape.table.rows):
                for c,cell in enumerate(row.cells):
                    for j,p in enumerate(cell.text_frame.paragraphs):
                        yield f"{loc}:r{r}:c{c}:p{j}", p
        if shape.shape_type == 6:  # MSO_SHAPE_TYPE.GROUP
            yield from _walk_shapes(shape.shapes, loc)


def office_paragraphs(data: bytes, ext: str):
    try:
        if ext == ".docx":
            doc = Document(io.BytesIO(data))
            return doc, list(_paragraphs_docx(doc))
        slides = Presentation(io.BytesIO(data))
        paragraphs = []
        for i,slide in enumerate(slides.slides):
            paragraphs.extend(_walk_shapes(slide.shapes, f"slide{i+1}"))
        return slides, paragraphs
    except Exception as exc:
        raise HTTPException(422, "Invalid or unsupported Office document") from exc


def _office_findings(data: bytes, ext: str) -> tuple[list[Finding],list[str]]:
    _, paragraphs = office_paragraphs(data, ext)
    findings = []
    for loc,p in paragraphs:
        findings.extend(scan_text(p.text, 1, location=loc))
    return findings, ["Only editable paragraphs, tables, headers/footers (DOCX) and slide text/shapes (PPTX) are inspected.",
                      "Embedded images, comments, tracked changes, notes, hidden content and file metadata remain unverified."]


def inspect(data: bytes, ext: str) -> tuple[list[Finding], list[str]]:
    validate_bytes(data)
    if ext in IMAGE_EXTENSIONS:
        return ocr(read_image(data),1), ["Image OCR recognizes visible text only; handwriting, faces and graphics are not inspected.",
                                                "Output image will be a flattened PNG without original EXIF metadata."]
    if ext == ".pdf":
        with open_pdf(data) as pdf:
            return _pdf_findings(pdf)
    if ext in {".docx", ".pptx"}:
        return _office_findings(data, ext)
    if ext in {".csv", ".xlsx"}:
        from backend import tabular
        return tabular.inspect(data, ext)
    try:
        text = data.decode("utf-8-sig")
    except UnicodeError as exc:
        raise HTTPException(422, "TXT must be UTF-8") from exc
    return scan_text(text,1,location="plain-text"), ["Plain UTF-8 text only."]


def redact(data: bytes, ext: str, selected: list[Finding]) -> tuple[bytes,str,str]:
    if ext in {".csv", ".xlsx"}:
        from backend import tabular
        return tabular.redact(data, ext, selected)
    if ext in IMAGE_EXTENSIONS:
        image = read_image(data)
        draw = ImageDraw.Draw(image)
        for f in selected:
            for r in f.rectangles:
                x0,y0,x1,y1 = r
                # Expand slightly to cover anti-aliased glyph edges.
                draw.rectangle((max(0,int(x0)-3), max(0,int(y0)-3), min(image.width,int(x1)+3), min(image.height,int(y1)+3)), fill="black")
        out = io.BytesIO()
        image.save(out, format="PNG")
        result = out.getvalue()
        verification = ocr(read_image(result), 1)
        if any(f.value in [v.value for v in verification] for f in selected):
            raise HTTPException(409, "FLAG: OCR still finds selected text after image redaction")
        return result, "image/png", "shareshield-redacted.png"
    if ext == ".pdf":
        with open_pdf(data) as pdf:
            by_page: dict[int,list[tuple[float,float,float,float]]] = {}
            for f in selected:
                if not f.rectangles:
                    raise HTTPException(422, "Could not locate selected PDF text")
                by_page.setdefault(f.page, []).extend(f.rectangles)
            for n, boxes in by_page.items():
                p = pdf[n-1]
                for box in boxes:
                    p.add_redact_annot(fitz.Rect(box), fill=(0,0,0))
                p.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)
            result = pdf.tobytes(garbage=4, deflate=True, clean=True)
        with open_pdf(result) as saved:
            after, _ = _pdf_findings(saved)
        if any((old.category,old.value,old.page) in {(f.category,f.value,f.page) for f in after} for old in selected):
            raise HTTPException(409, "FLAG: Selected text is still detectable in exported PDF")
        return result, "application/pdf", "shareshield-redacted.pdf"
    if ext in {".docx", ".pptx"}:
        document, paragraphs = office_paragraphs(data, ext)
        selected_locations: dict[str,set[str]] = {}
        for f in selected:
            selected_locations.setdefault(f.location,set()).add(f.value)
        for loc,p in paragraphs:
            if loc in selected_locations:
                new = p.text
                for value in sorted(selected_locations[loc], key=len, reverse=True):
                    new = new.replace(value, "[REDACTED]")
                # python-docx/python-pptx replace paragraph runs; formatting in
                # edited paragraphs may change, and unsupported content remains.
                p.text = new
        out = io.BytesIO()
        document.save(out)
        result = out.getvalue()
        after,_ = _office_findings(result,ext)
        if any((f.value,f.location) in {(x.value,x.location) for x in after} for f in selected):
            raise HTTPException(409,"FLAG: Selected text remains in exported Office document")
        mimetype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document" if ext == ".docx" else "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        return result,mimetype,f"shareshield-redacted{ext}"
    try:
        text = data.decode("utf-8-sig")
    except UnicodeError as exc:
        raise HTTPException(422,"TXT must be UTF-8") from exc
    for value in sorted({f.value for f in selected},key=len,reverse=True):
        text = text.replace(value,"[REDACTED]")
    result = text.encode("utf-8")
    if any(f.value in text for f in selected):
        raise HTTPException(409,"FLAG: Selected text remains in exported TXT")
    return result,"text/plain","shareshield-redacted.txt"


def fingerprint(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
