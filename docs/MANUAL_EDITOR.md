# Opening the manual editor

Choose a file, then press **Open manual editor**. Automatic OCR/analysis is
optional. If an analysis already exists, opening the editor preserves it.

- **PDF and images:** the original opens with rectangle drawing enabled. Drag
  across the area to mask; use the box controls to move, resize or delete it.
  The toolbar stays visible while scrolling the document.
- **TXT, CSV, DOCX, XLSX and PPTX:** select text in the editable text preview and
  press **Redact selected text**, or enter an exact phrase and choose **Add
  matching text**. These are paragraph/cell previews, not page renderings.
  Export to PDF first if a visual rectangle is needed on an Office page.

Manual text is validated against the original source and its stable editable
location. The review token must match the uploaded source. Literal occurrences
within a selected paragraph/cell are replaced together. The existing repeated-
occurrence setting expands matching selections to other editable locations.
Verification separately checks selected custom text even when no automatic PII
pattern recognizes it. Surviving selections cause FLAG; successful manual-only
exports remain UNVERIFIED and require review. Unexpected high-priority findings
still block export, so run normal analysis and review them if needed.

Limits: 60 selected text regions, 2,000 characters per region, at most 500
expanded matching locations. The preview supports up to 2,000 sections and
200,000 characters; larger files need splitting. Spreadsheet formulas, embedded
images, revision history and other hidden Office content remain outside this
text editor's coverage. Existing visual mask limits remain unchanged.

OCR: Tesseract for standard OCR; RapidOCR with PP-OCRv5 mobile models running on
ONNX Runtime for experimental English handwriting; PyMuPDF for native PDF text.
No new OCR provider or dependency was introduced.

Regression coverage includes all five editable-text formats, manual-only entry
without OCR, exact-source validation, independent custom-text leak detection,
location-scoped versus repeated-value replacement, preserved Excel formulas,
preview limits, direct drawing entry, native text highlighting and downloads.
