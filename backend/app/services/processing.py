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
        import math
        from PIL import ImageDraw
        with fitz.open(source) as doc, fitz.open() as rebuilt:
            if doc.is_encrypted or not len(doc):
                raise ValueError("Encrypted or empty PDFs cannot be redacted.")
            grouped={n:[] for n in range(len(doc))}
            for region in regions:
                if region.page is None or not 0 <= region.page < len(doc):
                    raise ValueError("A valid page number is required for each PDF region.")
                rect=fitz.Rect(region.x0,region.y0,region.x1,region.y1)
                if not all(math.isfinite(v) for v in rect) or rect.is_empty or not doc[region.page].rect.contains(rect):
                    raise ValueError("A PDF redaction region is outside the page.")
                grouped[region.page].append(rect)
            for n,page in enumerate(doc):
                if page.rect.width*page.rect.height*4>12_000_000:
                    raise ValueError("Page exceeds pixel limit.")
                pix=page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
                image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
                draw=ImageDraw.Draw(image)
                for rect in grouped[n]:
                    draw.rectangle((max(0,math.floor(rect.x0*2)-2),max(0,math.floor(rect.y0*2)-2),
                                    math.ceil(rect.x1*2)+1,math.ceil(rect.y1*2)+1),fill='black')
                import io
                encoded=io.BytesIO();image.save(encoded,format='PNG')
                target=rebuilt.new_page(width=page.rect.width,height=page.rect.height)
                image_xref=target.insert_image(target.rect,stream=encoded.getvalue())
                # Pixels above are already RGB. Do not carry auxiliary ICC streams in
                # the strict fresh-raster format; garbage collection removes them.
                rebuilt.xref_set_key(image_xref,"ColorSpace","/DeviceRGB")
                image.close()
            rebuilt.save(output,garbage=4,deflate=True)
        return output

    if suffix in {".png", ".jpg", ".jpeg"}:
        try:
            with Image.open(source) as image:
                image = image.convert("RGB")
                from PIL import ImageDraw
                for region in regions:
                    if region.page is not None:
                        raise ValueError("Image regions must not include a page number.")
                    import math
                    if not all(math.isfinite(v) for v in [region.x0,region.y0,region.x1,region.y1]) or region.x0<0 or region.y0<0 or region.x1>image.width or region.y1>image.height:
                        raise ValueError("Image redaction region is outside image bounds.")
                    x0, y0 = math.floor(region.x0), math.floor(region.y0)
                    x1, y1 = math.ceil(region.x1), math.ceil(region.y1)
                    if x1 <= x0 or y1 <= y0:
                        raise ValueError("Image redaction region is outside image bounds.")
                    ImageDraw.Draw(image).rectangle((x0, y0, x1 - 1, y1 - 1), fill="black")
                actual_output = output.with_suffix(".png")
                image.save(actual_output, format="PNG")
            return actual_output
        except OSError as exc:
            raise ValueError("Image redaction failed; no output was produced.") from exc

    raise ValueError("Unsupported file type.")

