"""Synthetic, privacy-safe OCR regression tests for photographed identity layouts."""
import io

import fitz
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
    chosen = [item for item in detected if item.category in expected]
    secured, _, _ = review.redact_visual(image_bytes, ".png", chosen, [], "blackout")
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

    print("OCR CHECK PASSED: synthetic ID number, VID, DOB, phone, name, address, image redaction & scanned PDF")


if __name__ == "__main__":
    main()
