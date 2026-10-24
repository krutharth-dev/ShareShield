"""Synthetic PDF and Office release smoke tests.

Runs in the Docker image build, using only invented sample data.
"""
import io

import fitz
from docx import Document
from pptx import Presentation
from pptx.util import Inches

from backend import engine, review


TEST_EMAIL = "fictional.demo@example.org"


def main() -> None:
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 80), f"Fictional email: {TEST_EMAIL}", fontsize=12)
    pdf_bytes = pdf.tobytes()
    pdf.close()

    findings, _ = engine.inspect(pdf_bytes, ".pdf")
    chosen = [f for f in findings if f.value == TEST_EMAIL]
    assert chosen and chosen[0].rectangles, "Native PDF detection and bounding boxes"
    output, _, _ = review.redact_visual(pdf_bytes, ".pdf", chosen, [], "blackout")
    with engine.open_pdf(output) as inspected:
        assert TEST_EMAIL not in inspected[0].get_text(), "PDF sensitive text not removed"
    remaining, _ = engine.inspect(output, ".pdf")
    assert not any(f.value == TEST_EMAIL for f in remaining), "PDF still detects sensitive text"
    report = review.evaluate(chosen, output, ".pdf")
    assert report["status"] in {"PASS_SCOPED", "UNVERIFIED"}, report["status"]

    word = Document()
    word.add_paragraph(f"Email: {TEST_EMAIL}")
    buffer = io.BytesIO()
    word.save(buffer)
    matches, _ = engine.inspect(buffer.getvalue(), ".docx")
    assert any(f.value == TEST_EMAIL for f in matches), "DOCX parsing failed"

    slides = Presentation()
    slide = slides.slides.add_slide(slides.slide_layouts[6])
    shape = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(5), Inches(1))
    shape.text = f"Email: {TEST_EMAIL}"
    buffer = io.BytesIO()
    slides.save(buffer)
    matches, _ = engine.inspect(buffer.getvalue(), ".pptx")
    assert any(f.value == TEST_EMAIL for f in matches), "PPTX parsing failed"

    print("RELEASE CHECK PASSED: PDF scan/redact/verify, DOCX scan, PPTX scan")


if __name__ == "__main__":
    main()
