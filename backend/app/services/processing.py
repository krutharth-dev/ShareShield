from pathlib import Path

import fitz
from PIL import Image, UnidentifiedImageError


def _ocr_image(image: Image.Image) -> list[dict]:
    """Run local Tesseract OCR and return word boxes in image pixel coordinates."""
    import pytesseract

    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    words = []
    for i, raw in enumerate(data.get("text", [])):
        text = raw.strip()
        if not text:
            continue
        try:
            confidence = float(data["conf"][i])
        except (TypeError, ValueError, KeyError):
            confidence = -1.0
        x, y = int(data["left"][i]), int(data["top"][i])
        w, h = int(data["width"][i]), int(data["height"][i])
        if w <= 0 or h <= 0:
            continue
        words.append({
            "text": text,
            "location": {"x0": x, "y0": y, "x1": x + w, "y1": y + h},
            "confidence": confidence,
        })
    return words


def analyze_file(path: Path, file_id: str, ocr_dpi: int = 200) -> dict:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        try:
            doc = fitz.open(path)
            if doc.is_encrypted:
                doc.close()
                raise ValueError("Encrypted PDFs are not supported.")
            pages = []
            ocr_status = "not_needed"
            for page_index, page in enumerate(doc):
                blocks = []
                for block in page.get_text("blocks"):
                    text = block[4].strip()
                    if text:
                        blocks.append({
                            "text": text,
                            "location": {
                                "page": page_index,
                                "x0": block[0], "y0": block[1],
                                "x1": block[2], "y1": block[3]
                            },
                            "source": "text_layer",
                        })

                if not blocks:
                    try:
                        import pytesseract  # noqa: F401
                        scale = ocr_dpi / 72.0
                        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                        image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                        words = _ocr_image(image)
                        # OCR boxes are pixels; convert them back to PDF page points.
                        for word in words:
                            loc = word["location"]
                            blocks.append({
                                "text": word["text"],
                                "location": {
                                    "page": page_index,
                                    "x0": loc["x0"] / scale,
                                    "y0": loc["y0"] / scale,
                                    "x1": loc["x1"] / scale,
                                    "y1": loc["y1"] / scale,
                                },
                                "confidence": word["confidence"],
                                "source": "ocr",
                            })
                        ocr_status = "available" if words else "no_text_detected"
                    except (ImportError, OSError, RuntimeError):
                        ocr_status = "unavailable"
                pages.append({"page": page_index, "blocks": blocks})
            doc.close()
            return {
                "media_type": "application/pdf",
                "extracted_content": {
                    "kind": "pdf", "pages": pages, "ocr_status": ocr_status
                }
            }
        except fitz.FileDataError as exc:
            raise ValueError("Malformed or unreadable PDF.") from exc

    if suffix in {".png", ".jpg", ".jpeg"}:
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                image = image.convert("RGB")
                try:
                    words = _ocr_image(image)
                    ocr_status = "available"
                except (ImportError, OSError, RuntimeError):
                    words, ocr_status = [], "unavailable"
                return {
                    "media_type": "image",
                    "extracted_content": {
                        "kind": "image", "width": image.width,
                        "height": image.height, "words": words,
                        "ocr_status": ocr_status
                    }
                }
        except (UnidentifiedImageError, OSError) as exc:
            raise ValueError("Malformed or unreadable image.") from exc

    raise ValueError("Unsupported file type.")


def redact_file(source: Path, output: Path, regions):
    suffix = source.suffix.lower()
    if suffix == ".pdf":
        try:
            doc = fitz.open(source)
            if doc.is_encrypted:
                doc.close()
                raise ValueError("Encrypted PDFs cannot be redacted.")
            for region in regions:
                if region.page is None or region.page >= len(doc):
                    raise ValueError("A valid page number is required for each PDF region.")
                page = doc[region.page]
                rect = fitz.Rect(region.x0, region.y0, region.x1, region.y1)
                if not page.rect.intersects(rect):
                    raise ValueError("A PDF redaction region is outside the page.")
                page.add_redact_annot(rect & page.rect, fill=(0, 0, 0))
            for page in doc:
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)
            doc.save(output, garbage=4, deflate=True, clean=True)
            doc.close()
            return output
        except (fitz.FileDataError, RuntimeError) as exc:
            raise ValueError("PDF redaction failed; no output was produced.") from exc

    if suffix in {".png", ".jpg", ".jpeg"}:
        try:
            with Image.open(source) as image:
                image = image.convert("RGB")
                from PIL import ImageDraw
                for region in regions:
                    if region.page is not None:
                        raise ValueError("Image regions must not include a page number.")
                    x0, y0 = max(0, int(region.x0)), max(0, int(region.y0))
                    x1, y1 = min(image.width, int(region.x1)), min(image.height, int(region.y1))
                    if x1 <= x0 or y1 <= y0:
                        raise ValueError("Image redaction region is outside image bounds.")
                    ImageDraw.Draw(image).rectangle((x0, y0, x1 - 1, y1 - 1), fill="black")
                actual_output = output.with_suffix(".png")
                image.save(actual_output, format="PNG")
            return actual_output
        except OSError as exc:
            raise ValueError("Image redaction failed; no output was produced.") from exc

    raise ValueError("Unsupported file type.")

