# ShareShield X — known limitations and safety language

## Product classification
ShareShield is a **privacy review aid**, not an identity anonymization guarantee. `SCOPED_CLEAR` means only that specifically configured checks completed within their stated limits. `UNVERIFIED` means required evidence is incomplete. `FLAG` means a possible exposure remains.

## OCR and handwriting
- The Cloudflare Worker serves a **browser-local** React workspace; it does not host a Python/Tesseract processing API. The Python backend is optional and deployed separately if configured.
- Client OCR uses Tesseract assets for `eng`, `hin`, and `kan` languages. Model availability is not proof of legible Kannada accuracy or handwriting support.
- The ink-line fallback visually proposes suspected unreadable lines; it is **not handwriting transcription** and can miss faint ink, shaded backgrounds, overlapping lines, and lines containing mostly light strokes.
- Average OCR confidence can conceal omitted sensitive fields. Review all image regions and individual pages, not just reported candidates.
- No measured field recall, CER/WER, Kannada handwriting accuracy or missed-exposure rate is available in this change.

## Export and verification
- Rasterized PDFs discard original editable PDF layers, searchable text, forms, attachments, links and signatures. Source files are never modified.
- QR decoders only identify *decodable* codes. Missing or unsupported QR results now force `UNVERIFIED`; visible residual codes force `FLAG`. There is no automated proof that every QR-like region was removed.
- External face model downloads may fail. On failures, the output cannot be cleared; users must inspect images manually.
- A high-confidence face/QR/OCR result does not establish complete PII recognition.
- Reopening output and re-running OCR is imperfect against low-resolution scans, inaccessible content and unexpected document types. No claim of complete irreversibility should be made for untested formats.
- Visual previews need actual downloaded-file acceptance tests before release.

## Format and resource constraints
- Document types: PDF (no fixed page-count cap; page-by-page rendering subject to browser resources), PNG/JPEG, UTF-8 TXT/CSV, and DOCX reconstructed **as text only**. Maximum source size is 8 MB.
- DOCX layout, images, headers/footers, comments, embedded content, links and tracked-change semantics are not preserved. It must not be called faithful DOCX redaction.
- CSV cells/formulas and typography are not independently audited as structured spreadsheet content.
- Browser memory, CPU, and external model availability affect reliability. OCR is performed per rendered page and performance varies.

## Privacy
- Document bytes are processed locally in the browser for the Worker frontend; model and software assets may be downloaded from public CDNs when needed. Downloading a model does not by itself upload document pixels, but network inspection of third-party dependencies is still recommended.
- Do not use production with real Aadhaar/identity materials until security and privacy acceptance checks pass. Use fictional and consented data.
- Reports must not expose raw sensitive values. Do not store documents or OCR text in logs, screenshots, telemetry, or repository test fixtures.

## Unverified release requirements
Browser acceptance of exported files, accessibility, reproducible Kannada OCR accuracy benchmarking, multi-page ID documents, offline mode and model integrity pinning, and correlation of deployed Cloudflare Worker to a particular Git commit remain unverified until independently demonstrated.
