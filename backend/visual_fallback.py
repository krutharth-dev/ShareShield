"""Fast visual suggestions when OCR stalls on scanned identity documents.

These are conservative, reviewer-controlled boxes, not claims that the
enclosed text has been semantically understood. Works without Tesseract.
"""
from __future__ import annotations

import cv2
import numpy as np
from PIL import Image


def suggest_regions(image: Image.Image, page: int, scale: float = 1.0):
    from backend.engine import Finding

    width, height = image.size
    shrink = min(1.0, 1500.0 / max(width, height))
    frame = image.convert("RGB")
    if shrink < 1:
        frame = frame.resize((round(width * shrink), round(height * shrink)),
                             Image.Resampling.BILINEAR)
    arr = np.asarray(frame)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 31, 12,
    )
    factor = scale * shrink
    output = []

    def rect(x, y, dx, dy, margin=0):
        return (
            max(0.0, (x-margin) / factor),
            max(0.0, (y-margin) / factor),
            min(width/scale, (x+dx+margin) / factor),
            min(height/scale, (y+dy+margin) / factor),
        )

    # Repetitive high-density square: Aadhaar Secure QR and similar codes
    # often fail optical decoders, but should still have reviewable masks.
    square_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (max(5, round(w / 175)), max(5, round(h / 175)))
    )
    square_blobs = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, square_kernel)
    contours, _ = cv2.findContours(square_blobs, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    codes = []
    for contour in contours:
        x, y, cw, ch = cv2.boundingRect(contour)
        size = min(w, h)
        if not (cw >= size * .22 and ch >= size * .22 and .72 <= cw/ch <= 1.35):
            continue
        occupancy = float(np.mean(binary[y:y+ch, x:x+cw] > 0))
        if .28 <= occupancy <= .86:
            codes.append((x, y, cw, ch))
    for idx, (x,y,cw,ch) in enumerate(sorted(codes, key=lambda v:(v[1],v[0]))[:6], 1):
        output.append(Finding("qr_candidate", f"Possible dense code {idx}", page,
                              [rect(x,y,cw,ch,margin=max(4,round(w*.006)))]))

    # Join neighboring letters within a text line; no machine-language
    # interpretation is necessary. Reject dense QR-like squares and lines.
    stroke_kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT, (max(10,round(w/80)), max(2,round(h/450)))
    )
    text_blobs = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, stroke_kernel)
    contours, _ = cv2.findContours(text_blobs, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    bands = []
    for contour in contours:
        x,y,cw,ch = cv2.boundingRect(contour)
        if cw < max(17,w*.027) or ch < max(4,h*.005) or ch > max(54,h*.1):
            continue
        if not (1.5 <= cw/max(ch,1) <= 90):
            continue
        if cw >= w*.96 and ch <= 8:
            continue
        pixel_ratio = float(np.mean(binary[y:y+ch,x:x+cw] > 0))
        if not .07 <= pixel_ratio <= .88:
            continue
        if any(
            (x + cw/2 >= bx and x + cw/2 <= bx+bw
             and y+ch/2 >= by and y+ch/2 <= by+bh)
            for bx,by,bw,bh in codes
        ):
            continue
        bands.append((x,y,cw,ch))
    # Cap noise and keep the most text-like features. Boxes are suggestions.
    bands = sorted(bands, key=lambda box:(box[1],box[0]))[:65]
    for idx,(x,y,cw,ch) in enumerate(bands,1):
        output.append(Finding("text_region_candidate", f"Visible text area {idx}", page,
                              [rect(x,y,cw,ch,margin=max(3,round(w*.004)))]))
    return output
