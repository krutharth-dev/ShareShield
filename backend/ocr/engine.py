"""Tesseract OCR for printed text. Handwriting is explicitly best-effort."""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import os
import pytesseract

if os.name == "nt":
    tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

    if os.path.exists(tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
@dataclass
class OCRWord:
    text: str
    confidence: float
    page: int
    bbox: dict[str, int]

@dataclass
class OCRResult:
    text: str
    language: str
    words: list[OCRWord]
    average_confidence: float
    needs_manual_review: bool
    warnings: list[str]

def _deps():
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("Install OCR extras: pip install -r requirements-ocr.txt") from exc
    return pytesseract, Image

def _language(value: str) -> str:
    allowed = {"eng", "kan", "hin"}
    parts = value.split("+")
    if not parts or any(p not in allowed for p in parts):
        raise ValueError("language must be eng, kan, hin, or a '+' combination")
    return value

def _run(image, lang: str, page: int, threshold: float) -> OCRResult:
    pytesseract, _ = _deps()
    data = pytesseract.image_to_data(image, lang=lang,
        output_type=pytesseract.Output.DICT, config="--oem 1 --psm 3", timeout=20)
    words, warnings = [], []
    for i, raw in enumerate(data["text"]):
        token = str(raw).strip()
        try:
            conf = float(data["conf"][i])
        except (TypeError, ValueError):
            conf = -1
        if token and conf >= 0:
            words.append(OCRWord(token, round(conf / 100, 3), page, {
                "x": int(data["left"][i]), "y": int(data["top"][i]),
                "width": int(data["width"][i]), "height": int(data["height"][i])}))
    text = " ".join(w.text for w in words)
    avg = round(sum(w.confidence for w in words) / len(words), 3) if words else 0.0
    low = sum(w.confidence < threshold for w in words)
    if not words:
        warnings.append("No readable OCR tokens; manual review required.")
    if low:
        warnings.append(f"{low} token(s) below OCR confidence threshold.")
    return OCRResult(text, lang, words, avg, not words or bool(low), warnings)

def extract_image(path: str | Path, language: str = "eng", page: int = 1,
                  min_confidence: float = 0.60) -> OCRResult:
    """OCR a printed image; low-confidence or empty results require human review."""
    _, Image = _deps()
    with Image.open(path) as im:
        return _run(im.convert("RGB"), _language(language), page, min_confidence)

def extract_pdf(path: str | Path, language: str = "eng", dpi: int = 250,
                min_confidence: float = 0.60) -> list[OCRResult]:
    """Rasterize scanned PDF pages and OCR them. Digital PDFs should use a text parser."""
    try:
        from pdf2image import convert_from_path
    except ImportError as exc:
        raise RuntimeError("Install OCR extras: pip install -r requirements-ocr.txt") from exc
    lang = _language(language)
    return [_run(im, lang, n, min_confidence)
            for n, im in enumerate(convert_from_path(str(path), dpi=dpi), 1)]

