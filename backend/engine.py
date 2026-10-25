"""Local document inspection and selected redaction.

Only recognized, locatable text is processed. A successful result is never a
blanket security certification. This module does not persist uploaded files.
"""
from __future__ import annotations

import hashlib
import io
import re
import shutil
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

from backend.patterns import MORE_RULES, SEVERITY, CONFIDENCE, valid_match

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC_AVAILABLE = True
except ImportError:
    HEIC_AVAILABLE = False

MAX_BYTES = 12 * 1024 * 1024
MAX_PIXELS = 25_000_000
MAX_PAGES = 25
MAX_FINDINGS = 500
OCR_TIMEOUT_SECONDS = 6
OCR_MAX_SIDE = 1250  # Bound time for dense identity scans
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

EXTENSIONS = {".pdf", ".docx", ".pptx", ".txt", ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif", ".csv", ".xlsx"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic", ".heif"}
EMAIL = re.compile(r"(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])")
PHONE = re.compile(r"(?<!\d)(?:\+91[ -]?)?[6-9](?:[ -]?\d){9}(?!\d)")
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
                "confidence": CONFIDENCE.get(self.category, .65),
                "auto_select": CONFIDENCE.get(self.category, .65) >= .85,
                "rectangles": self.rectangles, "location": self.location}


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
            if len(matches) > MAX_FINDINGS:
                raise HTTPException(413, "Too many detected identifiers in one text section; split the document")
    # Explicit VID context takes precedence over a coincidental card checksum.
    return [finding for start, finding in sorted(matches, key=lambda v: v[0])
            if not (finding.category == "payment_card_candidate" and any(
                other.category == "vid_candidate" and begin <= start
                and begin + len(other.value) >= start + len(finding.value)
                for begin, other in matches))]


def ocr_available() -> bool:
    """True when the external Tesseract executable is visible to this server."""
    return shutil.which(pytesseract.pytesseract.tesseract_cmd) is not None


def ocr(image: Image.Image, page: int, scale: float = 1.0, warnings: list[str] | None = None) -> list[Finding]:
    """Read small text on photographed identity cards with bounded OCR passes.

    Keep all proposal rectangles in original coordinates. The second, enhanced
    pass runs only when the first failed to detect enough identifiers. Neither
    pass asserts full identity/document coverage.
    """
    from backend.ocr_fields import inferred_identity_fields
    from backend.visual_fallback import suggest_regions
    from PIL import ImageEnhance, ImageFilter

    shrink = min(1.0, OCR_MAX_SIDE / max(image.width, image.height))
    source = image.convert("RGB")
    if shrink < 1:
        source = source.resize((
            max(1, round(image.width * shrink)),
            max(1, round(image.height * shrink)),
        ), Image.Resampling.LANCZOS)
    coordinate_scale = scale * shrink
    visual_suggestions = suggest_regions(image, page, scale=scale)
    # Avoid feeding dense encoded squares to Tesseract. QR-like blocks can
    # cause multi-second segmentation hangs on modest hosting instances.
    # The original image remains untouched and a code mask is still offered.
    code_proposals = [f for f in visual_suggestions if f.category == "qr_candidate"]
    if code_proposals:
        clean = ImageDraw.Draw(source)
        for code in code_proposals:
            for x0, y0, x1, y1 in code.rectangles:
                clean.rectangle(
                    (x0 * coordinate_scale, y0 * coordinate_scale,
                     x1 * coordinate_scale, y1 * coordinate_scale),
                    fill="white",
                )


    def with_visual_fallback(found: list[Finding]) -> list[Finding]:
        """Preserve public labels, symbols and nonsensitive text."""
        extras = [code for code in code_proposals if not any(
            other.category == "qr_candidate" and other.rectangles == code.rectangles
            for other in found)]
        return (found + extras)[:MAX_FINDINGS]

    def inspect_pass(frame: Image.Image, segmentation: int, pass_scale: float, offset_y: float = 0) -> tuple[list[Finding], int]:
        try:
            result = pytesseract.image_to_data(
                frame, output_type=Output.DICT, lang="eng",
                config=f"--psm {segmentation}", timeout=OCR_TIMEOUT_SECONDS)
        except (pytesseract.TesseractNotFoundError, OSError) as exc:
            raise HTTPException(503, "OCR unavailable; Tesseract must be installed on the processing server") from exc
        except RuntimeError as exc:
            if "timeout" in str(exc).lower():
                raise HTTPException(504, "OCR timed out on this image; try a smaller or clearer document") from exc
            raise HTTPException(422, "OCR failed on this image; try a clearer file") from exc

        by_line: dict[tuple[int, int, int, int], list[tuple[str, tuple[float, float, float, float]]]] = {}
        for i, raw in enumerate(result["text"]):
            word = str(raw).strip()
            if not word:
                continue
            key = tuple(int(result[k][i]) for k in ("page_num", "block_num", "par_num", "line_num"))
            x, y, w, h = (float(result[k][i]) / pass_scale for k in ("left", "top", "width", "height"))
            y += offset_y
            by_line.setdefault(key, []).append((word, (x, y, x+w, y+h)))

        findings: list[Finding] = []
        line_rows: list[tuple[str, tuple[float, float, float, float]]] = []
        word_count = 0
        # PSM 6 can merge a portrait or a second column into a text row.
        # Split large horizontal gaps before deriving field rectangles.
        segments = []
        for words in by_line.values():
            chunk = []
            for word, box in sorted(words, key=lambda item: item[1][0]):
                if chunk and box[0] - chunk[-1][1][2] > max(60 / pass_scale, 3 * (box[3] - box[1])):
                    segments.append(chunk)
                    chunk = []
                chunk.append((word, box))
            if chunk:
                segments.append(chunk)
        for words in segments:
            pieces, spans, cursor = [], [], 0
            word_count += len(words)
            for word, box in words:
                if pieces:
                    cursor += 1
                start = cursor
                pieces.append(word)
                cursor += len(word)
                spans.append((start, cursor, box))
            text = " ".join(pieces)

            def locate(_value: str, begin: int, end: int):
                touching = [rect for a, b, rect in spans if b > begin and a < end]
                if not touching:
                    return []
                return [(min(r[0] for r in touching), min(r[1] for r in touching),
                         max(r[2] for r in touching), max(r[3] for r in touching))]

            rect = locate(text, 0, len(text))
            if rect:
                line_rows.append((text, rect[0]))
            findings.extend(scan_text(text, page, locate))

        # Aadhaar layouts often omit "Name:" and "Address:". Infer conservative,
        # user-reviewable field boxes only if the OCR text signals an identity card.
        findings.extend(inferred_identity_fields(line_rows, page))
        return findings, word_count

    def cropped_recovery() -> list[Finding]:
        """Focused OCR after full-page OCR stalls on dense documents.

        Reads smaller image portions and maps findings back to original pixels.
        It never guesses which unreadable words were private.
        """
        if warnings is not None:
            warnings.append("UNVERIFIED: Whole-page OCR failed; focused text regions were retried.")
        cutoff = source.height // 2
        overlap = max(12, min(45, source.height // 30))
        crops = [
            (source.crop((0, 0, source.width, min(source.height, cutoff + overlap))), 0),
            (source.crop((0, max(0, cutoff - overlap), source.width, source.height)),
             max(0, cutoff - overlap)),
        ]
        recognized: list[Finding] = []
        for tile, offset in crops:
            try:
                findings, _ = inspect_pass(tile, 11, coordinate_scale, offset / coordinate_scale)
                for field in findings:
                    if not any(f.category == field.category and f.value == field.value
                               and f.page == field.page for f in recognized):
                        recognized.append(field)
            except HTTPException as exc:
                if exc.status_code not in (503, 504, 422):
                    raise
                if warnings is not None:
                    warnings.append("UNVERIFIED: A focused section could not be read.")
        return with_visual_fallback(recognized)

    try:
        primary, count = inspect_pass(source, 6, coordinate_scale)
    except HTTPException as error:
        if error.status_code != 504:
            raise
        # Retry a smaller contrast-enhanced image when large-image OCR stalls.
        if warnings is not None:
            warnings.append("UNVERIFIED: OCR timed out at full resolution; a lower-resolution fallback was used.")
        factor = min(1.0, 900 / max(source.width, source.height))
        reduced = source.resize((
            max(1, round(source.width * factor)),
            max(1, round(source.height * factor)),
        ), Image.Resampling.LANCZOS) if factor < 1 else source
        enhanced = ImageOps.autocontrast(ImageOps.grayscale(reduced), cutoff=1)
        enhanced = ImageEnhance.Contrast(enhanced).enhance(1.5)
        try:
            recovered, _ = inspect_pass(enhanced, 11, coordinate_scale * factor)
            return with_visual_fallback(recovered)
        except HTTPException:
            return cropped_recovery()
    important = {"aadhaar_candidate", "id12_candidate", "vid_candidate",
                 "dob_candidate", "indian_mobile_candidate", "pan_candidate"}
    needs_fallback = (count < 12 or len(primary) < 3 or
                      not any(f.category in important for f in primary))
    if not needs_fallback:
        return with_visual_fallback(primary)

    # Adaptive contrast and sharpening help uneven illumination and blurred
    # ID-card scans. Bounded to one extra pass to prevent runaway processing.
    enhanced = ImageOps.autocontrast(ImageOps.grayscale(source), cutoff=1)
    enhanced = ImageEnhance.Contrast(enhanced).enhance(1.5)
    enhanced = enhanced.filter(ImageFilter.UnsharpMask(radius=1.0, percent=160, threshold=2))
    try:
        secondary, _ = inspect_pass(enhanced, 11, coordinate_scale)
    except HTTPException:
        if warnings is not None:
            warnings.append("UNVERIFIED: Secondary OCR enhancement did not complete; manually inspect missed fields.")
        return with_visual_fallback(primary)

    combined = list(primary)
    for proposed in secondary:
        box = proposed.rectangles[0] if proposed.rectangles else None
        duplicate = False
        if box:
            cx, cy = (box[0] + box[2])/2, (box[1] + box[3])/2
            for found in combined:
                if found.category != proposed.category or not found.rectangles:
                    continue
                other = found.rectangles[0]
                mid_x, mid_y = (other[0] + other[2])/2, (other[1] + other[3])/2
                if (abs(cx-mid_x) < max(12, (box[2]-box[0])*.27)
                        and abs(cy-mid_y) < max(10, (box[3]-box[1])*.5)):
                    duplicate = True
                    break
        if not duplicate:
            combined.append(proposed)
    return with_visual_fallback(combined)


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
    """Skip redundant OCR on native-only PDF pages, but examine image pages."""
    findings: list[Finding] = []
    from backend import smart
    has_ocr = ocr_available()
    has_vision = smart.available()
    notes = ["PDF annotations, attachments, metadata and embedded content are not fully inspected."]
    if has_ocr:
        notes.append("OCR is best-effort on pages with raster imagery; handwriting and low-contrast text may be missed.")
    else:
        notes.append("UNVERIFIED: Tesseract OCR is unavailable; image-based text was NOT inspected.")
    notes.append("Face/QR recognition is best-effort. Manually inspect photographs, barcodes and vector graphics.")
    if not has_vision:
        notes.append("UNVERIFIED: Visual face/QR detection unavailable; manually mask photos and codes.")
    for number, page in enumerate(pdf, 1):
        text = page.get_text("text", sort=True)
        native = scan_text(text, number, lambda value, a, b: [tuple(r) for r in page.search_for(value)])
        from backend.ocr_fields import inferred_identity_fields
        rows = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                label = " ".join(span["text"] for span in line["spans"])
                rows.append((label, tuple(line["bbox"])))
        native.extend(inferred_identity_fields(rows, number))
        # Public findings use the displayed (rotated) page coordinate system,
        # matching previews, OCR boxes and user-drawn masks.
        if page.rotation:
            for finding in native:
                finding.rectangles = [tuple(fitz.Rect(rect) * page.rotation_matrix)
                                      for rect in finding.rectangles]
        visual: list[Finding] = []
        # Pages containing raster images require OCR even if they have native text.
        # Native text-only pages do not need expensive rasterization/Tesseract.
        needs_render = bool(page.get_images(full=True)) or not text.strip()
        if needs_render and (has_ocr or has_vision):
            render_scale = 1.5
            pix = page.get_pixmap(matrix=fitz.Matrix(render_scale, render_scale), alpha=False)
            if pix.width * pix.height > MAX_PIXELS:
                raise HTTPException(413, "Rendered PDF page exceeds 25-megapixel image limit")
            image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            if has_ocr:
                try:
                    visual.extend(ocr(image, number, scale=render_scale, warnings=notes))
                except HTTPException as exc:
                    if exc.status_code not in (503, 504):
                        raise
                    notes.append(f"UNVERIFIED: OCR timed out or was unavailable on page {number}. Manually inspect and mask image text.")
            if has_vision:
                visual.extend(smart.regions(image, number, scale=render_scale))
        if any(f.category in {"name_candidate", "address_candidate"} for f in visual):
            notes.append(f"Name and address boxes on page {number} are heuristic. Manually inspect the document before sharing.")
        combined: dict[tuple[str, str, int], Finding] = {}
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


def _inspect_document(data: bytes, ext: str) -> tuple[list[Finding], list[str]]:
    validate_bytes(data)
    if ext in IMAGE_EXTENSIONS:
        image = read_image(data)  # Validate image even when OCR is unavailable.
        limits = [
            "Image recognition covers OCR-visible text only, not handwriting, faces or graphics.",
            "Output image is a flattened PNG without original EXIF metadata.",
        ]
        if not ocr_available():
            from backend import smart
            return smart.regions(image, 1), [
                "UNVERIFIED: Tesseract OCR is unavailable; no text was scanned. Install Tesseract via MacPorts or Homebrew where supported.",
                "Faces and QR candidates are not a full security audit; manually review all regions.",
                *limits,
            ]
        from backend import smart
        if not smart.available():
            limits.append("UNVERIFIED: Face and QR detection unavailable; manually mask visible photos and codes.")
        else:
            limits.append("Face/QR recognition is best-effort. Review every photograph and 2D code manually.")
        try:
            recognized = ocr(image, 1, warnings=limits)
        except HTTPException as exc:
            if exc.status_code not in (503, 504):
                raise
            recognized = []
            limits.append("UNVERIFIED: OCR timed out or was unavailable. Image text is NOT verified; inspect and mask it manually.")
        if not recognized:
            limits.append("UNVERIFIED: OCR returned no sensitive-text candidates. Manually review all written fields and add masks.")
        if any(f.category in {"name_candidate", "address_candidate"} for f in recognized):
            limits.append("Name and address regions are heuristic proposals. Check every selected rectangle and every missed line.")
        return recognized + smart.regions(image, 1), limits
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


def inspect(data: bytes, ext: str) -> tuple[list[Finding], list[str]]:
    """Bound findings so huge files cannot create unbounded UI payloads."""
    findings, notes = _inspect_document(data, ext)
    if len(findings) > MAX_FINDINGS:
        raise HTTPException(
            413, "More than 500 sensitive-data candidates detected; split the input into smaller files"
        )
    return findings, notes


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
