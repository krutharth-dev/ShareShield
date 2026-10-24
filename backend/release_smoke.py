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
    word_bytes = buffer.getvalue()
    matches, _ = engine.inspect(word_bytes, ".docx")
    assert any(f.value == TEST_EMAIL for f in matches), "DOCX parsing failed"

    slides = Presentation()
    slide = slides.slides.add_slide(slides.slide_layouts[6])
    shape = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(5), Inches(1))
    shape.text = f"Email: {TEST_EMAIL}"
    buffer = io.BytesIO()
    slides.save(buffer)
    slide_bytes = buffer.getvalue()
    matches, _ = engine.inspect(slide_bytes, ".pptx")
    assert any(f.value == TEST_EMAIL for f in matches), "PPTX parsing failed"

    # Call the actual ASGI endpoint functions with in-memory UploadFiles.
    # This verifies async upload decoding and threaded document processing.
    import asyncio
    from fastapi import UploadFile
    from backend.app import analyze, redact_selected, verify_result

    async def endpoint_roundtrip() -> None:
        def upload(data: bytes, filename: str) -> UploadFile:
            return UploadFile(file=io.BytesIO(data), filename=filename)

        analysis = await analyze(upload(pdf_bytes, "fictional.pdf"))
        ids = [f["id"] for f in analysis["findings"] if f["value"] == TEST_EMAIL]
        assert ids, "Analyze endpoint did not return PDF finding"
        redacted_response = await redact_selected(
            upload(pdf_bytes, "fictional.pdf"),
            analysis_id=analysis["analysis_id"],
            selected_ids=",".join(str(i) for i in ids),
            manual_regions="[]",
            redact_all=False,
            redaction_mode="blackout",
        )
        assert redacted_response.body.startswith(b"%PDF-"), "Redact endpoint did not output PDF"
        verification = await verify_result(
            upload(pdf_bytes, "fictional.pdf"),
            upload(redacted_response.body, "fictional-redacted.pdf"),
            analysis_id=analysis["analysis_id"],
            selected_ids=",".join(str(i) for i in ids),
            manual_count=0,
            redact_all=False,
            redaction_mode="blackout",
        )
        assert verification["status"] in {"PASS_SCOPED", "UNVERIFIED"}, verification["status"]

    asyncio.run(endpoint_roundtrip())

    # Editable Office redaction must actually remove the selected text,
    # while still marking uninspectable embedded content as UNVERIFIED.
    for original, ext in ((word_bytes, ".docx"), (slide_bytes, ".pptx")):
        selected, _ = engine.inspect(original, ext)
        selected = [f for f in selected if f.value == TEST_EMAIL]
        assert selected, f"{ext} finding missing before redaction"
        sanitized, _, _ = engine.redact(original, ext, selected)
        remaining, _ = engine.inspect(sanitized, ext)
        assert not any(f.value == TEST_EMAIL for f in remaining), f"{ext} redaction ineffective"
        verdict = review.evaluate(selected, sanitized, ext)
        assert verdict["status"] == "UNVERIFIED", f"{ext} should never claim full sanitization"

    # Pixel masking permanently replaces the selected source pixels.
    from PIL import Image
    image = Image.new("RGB", (180, 120), "white")
    image_bytes = io.BytesIO()
    image.save(image_bytes, "PNG")
    mask = [{"page": 1, "x": .2, "y": .2, "w": .4, "h": .4}]
    masked, _, _ = review.redact_visual(image_bytes.getvalue(), ".png", [], mask)
    with Image.open(io.BytesIO(masked)) as output_image:
        assert output_image.getpixel((65, 46)) == (0, 0, 0), "Manual mask failed"
        assert output_image.getpixel((170, 110)) == (255, 255, 255), "Mask exceeded selection"

    # Corrupt OpenXML uploads and unexpected output sources are rejected.
    from fastapi import HTTPException
    try:
        review.check_file(b"not a ZIP", ".docx")
    except HTTPException as exc:
        assert exc.status_code == 415
    else:
        raise AssertionError("Invalid Office upload accepted")

    # Bounded work-slot queue must avoid immediate 503, remain responsive to
    # /health, and still reject jobs that exceed the allowed wait.
    from backend.app import DOCUMENT_WORK_SLOT, document_job, health
    async def busy_check():
        assert health()["processor_busy"] is False
        await DOCUMENT_WORK_SLOT.acquire()
        try:
            assert health()["processor_busy"] is True
            try:
                await document_job(lambda: 1)
            except HTTPException as exc:
                assert exc.status_code == 503, "Busy status must be 503"
                assert exc.headers.get("Retry-After") == "3"
            else:
                raise AssertionError("Busy worker exceeded waiting limit")
        finally:
            DOCUMENT_WORK_SLOT.release()
        assert health()["processor_busy"] is False

        await DOCUMENT_WORK_SLOT.acquire()
        task = asyncio.create_task(document_job(lambda: 42))
        try:
            await asyncio.sleep(.08)
            assert not task.done(), "Queued work should wait for the first job"
        finally:
            DOCUMENT_WORK_SLOT.release()
        assert await task == 42, "Queued work did not run after release"
        assert health()["processor_busy"] is False

    asyncio.run(busy_check())
    print("RELEASE CHECK PASSED: PDF/Office APIs, invalid uploads, bounded busy-worker queue and responsive health")


if __name__ == "__main__":
    main()
