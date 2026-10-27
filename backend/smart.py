"""Best-effort offline visual proposals: Haar face boxes and QR quadrilaterals.

No pretrained model downloads, cloud calls or face identification. Detection
can miss profiles, tiny faces, unfamiliar barcodes and 2D codes. Candidates
are suggestions; the user must inspect all pages and approve boxes.
"""
from __future__ import annotations

from functools import lru_cache

from PIL import Image

try:
    import cv2
    import numpy as np
except ImportError:  # Keep text-only functionality working without OpenCV.
    cv2 = None
    np = None

MAX_SIDE = 1600
MAX_FACES = 25
MAX_CODES = 25


def available() -> bool:
    return cv2 is not None and np is not None


@lru_cache(maxsize=1)
def _cascade():
    if not available():
        return None
    path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    classifier = cv2.CascadeClassifier(path)
    return None if classifier.empty() else classifier


def regions(image: Image.Image, page: int, scale: float = 1.0):
    """Return visual Finding proposals in original image or PDF page units."""
    if not available():
        return []
    from backend.engine import Finding

    original_width, original_height = image.size
    shrink = min(1.0, MAX_SIDE / max(original_width, original_height))
    frame = image.convert("RGB")
    if shrink < 1:
        frame = frame.resize(
            (max(1, round(original_width * shrink)),
             max(1, round(original_height * shrink))), Image.Resampling.BILINEAR
        )
    rgb = np.asarray(frame, dtype=np.uint8)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    factor = scale * shrink
    results = []

    cascade = _cascade()
    if cascade is not None:
        detected = cascade.detectMultiScale(
            gray, scaleFactor=1.14, minNeighbors=5,
            minSize=(max(24, round(gray.shape[1] * .035)),
                     max(24, round(gray.shape[0] * .035))),
        )
        for x, y, width, height in sorted(detected, key=lambda a: (a[1], a[0]))[:MAX_FACES]:
            # Add a small margin around hairline, cheeks, and chin.
            margin = .13
            x0 = max(0, (x - width * margin) / factor)
            y0 = max(0, (y - height * margin) / factor)
            x1 = min(original_width / scale, (x + width * (1 + margin)) / factor)
            y1 = min(original_height / scale, (y + height * (1 + margin)) / factor)
            results.append(Finding("face_candidate", f"Face candidate {len(results)+1}", page,
                                   [(x0, y0, x1, y1)]))

    try:
        detector = cv2.QRCodeDetector()
        has_codes, points = detector.detectMulti(gray)
        if has_codes and points is not None:
            for polygon in points[:MAX_CODES]:
                x0, y0 = polygon.min(axis=0)
                x1, y1 = polygon.max(axis=0)
                margin = 5.0
                results.append(Finding(
                    "qr_candidate", f"QR candidate {len(results)+1}", page,
                    [(max(0, (float(x0)-margin)/factor), max(0, (float(y0)-margin)/factor),
                      min(original_width/scale, (float(x1)+margin)/factor),
                      min(original_height/scale, (float(y1)+margin)/factor))],
                ))
    except (cv2.error, ValueError):
        # A malformed/unusual code must not break OCR or report "safe".
        pass
    return results
