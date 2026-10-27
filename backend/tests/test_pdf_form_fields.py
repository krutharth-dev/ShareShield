"""Synthetic regression checks for confidential PDF form fields.

Interactive AcroForm widgets are distinct from regular PDF annotations.
A masked page must not carry those hidden form values into a shared copy.
"""
import fitz

from backend import engine, review


SECRET = "PRIVATE FICTIONAL FORM VALUE"


def example_pdf_with_widget():
    with fitz.open() as pdf:
        page = pdf.new_page(width=420, height=400)
        page.insert_text((40, 80), "demo@example.org")
        widget = fitz.Widget()
        widget.field_name = "confidential-comment"
        widget.field_value = SECRET
        widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
        widget.rect = fitz.Rect(40, 150, 360, 185)
        page.add_widget(widget)
        return pdf.tobytes()


def test_redaction_removes_interactive_pdf_widgets_and_hidden_values():
    source = example_pdf_with_widget()
    findings, _ = engine.inspect(source, ".pdf")
    email = next(f for f in findings if f.category == "email")
    with fitz.open(stream=source, filetype="pdf") as original:
        assert [widget.field_value for widget in original[0].widgets()] == [SECRET]

    output, mime, _ = review.redact_visual(source, ".pdf", [email], [])
    assert mime == "application/pdf"
    with fitz.open(stream=output, filetype="pdf") as exported:
        assert not list(exported[0].widgets() or [])
        assert "demo@example.org" not in exported[0].get_text()
        assert SECRET not in exported[0].get_text()
        assert "confidential-comment" not in str(exported.xref_object(exported.pdf_catalog()))


def test_export_verification_blocks_pdf_with_remaining_form_fields():
    source = example_pdf_with_widget()
    with fitz.open(stream=source, filetype="pdf") as pdf:
        page = pdf[0]
        rect = page.search_for("demo@example.org")[0]
        page.add_redact_annot(rect, fill=(0, 0, 0))
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)
        # This intentionally bypasses the ShareShield scrub to simulate an
        # externally supplied redacted document that retains hidden widgets.
        unsafe_output = pdf.tobytes(garbage=4, deflate=True, clean=True)

    selected = [engine.Finding("email", "demo@example.org", 1, [])]
    report = review.evaluate(selected, unsafe_output, ".pdf")
    assert report["status"] == "FLAG"
    assert report["remaining_selected_count"] == 0
    assert report["pdf_form_fields_remaining"] == 1
    assert any("form fields" in warning for warning in report["unverified"])
    assert SECRET not in str(report)
