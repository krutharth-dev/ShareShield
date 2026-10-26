"""Synthetic, privacy-safe OCR regression tests for photographed identity layouts."""
import io

import pymupdf as fitz
from PIL import Image, ImageDraw, ImageFont

from backend import engine, review


def main() -> None:
    font = ImageFont.load_default(size=32)
    card = Image.new("RGB", (1100, 900), "white")
    pencil = ImageDraw.Draw(card)
    rows = [
        "Government of India",
        "SAMPLE STUDENT",
        "S/O SAMPLE PARENT",
        "Flat 14, Example Street",
        "3rd Main Example Nagar",
        "Fiction City 560001",
        "Mobile: 98765 43210",
        "Your Aadhaar No:",
        "2345 6789 0123",
        "VID: 1111 2222 3333 4444",
        "DOB: 08/08/2006",
    ]
    for index, line in enumerate(rows):
        pencil.text((70, 34 + index * 68), line, fill="black", font=font)
    memory = io.BytesIO()
    card.save(memory, "PNG")
    image_bytes = memory.getvalue()

    detected, notes = engine.inspect(image_bytes, ".png")
    categories = {item.category for item in detected}
    expected = {
        "id12_candidate", "vid_candidate", "dob_candidate",
        "indian_mobile_candidate", "name_candidate", "address_candidate",
    }
    assert expected <= categories, "Image identity text missed: " + repr(sorted(expected - categories))
    assert all(item.rectangles for item in detected), "Missing OCR mask coordinates"
    assert not any(item.category == "text_region_candidate" for item in detected), (
        "A public heading or emblem was incorrectly considered sensitive text"
    )
    chosen = [item for item in detected if item.category in expected]
    secured, _, _ = review.redact_visual(image_bytes, ".png", chosen, [], "blackout")
    with Image.open(io.BytesIO(secured)) as redacted:
        # The government header must remain unchanged by automatic redaction.
        public_header = (65, 28, 550, 85)
        assert redacted.crop(public_header).tobytes() == card.crop(public_header).tobytes(), (
            "Public government heading was changed by automatic redaction"
        )
    remaining, _ = engine.inspect(secured, ".png")
    assert not {item.category for item in remaining} & expected, "Image export retains detected fields"

    pdf = fitz.open()
    page = pdf.new_page(width=550, height=450)
    page.insert_image(page.rect, stream=image_bytes)
    pdf_bytes = pdf.tobytes()
    pdf.close()
    pdf_found, _ = engine.inspect(pdf_bytes, ".pdf")
    actual = {item.category for item in pdf_found}
    assert {"id12_candidate", "vid_candidate"} <= actual, "Image-based PDF text not recognized"
    assert all(item.rectangles for item in pdf_found), "Scanned PDF masks lack locations"

    # Simulate a full-size Tesseract timeout; lower-resolution fallback must
    # recover usable regions and carry an explicit unverified warning.
    from unittest.mock import patch
    real_ocr = engine.pytesseract.image_to_data
    calls = [0]

    def timeout_once(*args, **kwargs):
        calls[0] += 1
        if calls[0] == 1:
            raise RuntimeError("OCR process timeout")
        return real_ocr(*args, **kwargs)

    recovered_warnings = []
    with patch.object(engine.pytesseract, "image_to_data", side_effect=timeout_once):
        recovered = engine.ocr(card, 1, warnings=recovered_warnings)
    recovered_categories = {item.category for item in recovered}
    assert {"id12_candidate", "vid_candidate", "name_candidate", "address_candidate"} <= recovered_categories, (
        "Fallback missed sensitive fields: " + repr(sorted(recovered_categories))
    )
    assert any("UNVERIFIED:" in note for note in recovered_warnings), "Fallback must remain unverified"
    # Simulate slow full-page OCR but successful focused reads. The fallback
    # must recover semantic fields, never blanket-select all visible text.
    def fail_large(*args, **kwargs):
        frame = args[0]
        if frame.height >= 650:
            raise RuntimeError("OCR process timeout")
        return real_ocr(*args, **kwargs)
    focused_notes = []
    with patch.object(engine.pytesseract, "image_to_data", side_effect=fail_large):
        focused = engine.ocr(card, 1, warnings=focused_notes)
    recovered_categories = {item.category for item in focused}
    assert {"id12_candidate", "vid_candidate", "name_candidate", "address_candidate"} <= recovered_categories, (
        "Focused OCR did not recover identity fields: " + repr(sorted(recovered_categories))
    )
    assert not any(f.category == "text_region_candidate" for f in focused)
    assert any(note.startswith("UNVERIFIED:") for note in focused_notes)

    # Even when every OCR pass fails, never redact ordinary printed text.
    all_failed_notes = []
    with patch.object(engine.pytesseract, "image_to_data",
                      side_effect=RuntimeError("OCR process timeout")):
        proposals = engine.ocr(card, 1, warnings=all_failed_notes)
    assert not any(f.category == "text_region_candidate" for f in proposals)
    assert not any(f.category in {"name_candidate", "address_candidate"} for f in proposals)
    assert any(note.startswith("UNVERIFIED:") for note in all_failed_notes)
    assert len(proposals) <= 6, "OCR failure unexpectedly created many automatic masks"

    print("OCR CHECK PASSED: selective PII, public headings preserved, focused recovery, total failure fails safely")


if __name__ == "__main__":
    main()
