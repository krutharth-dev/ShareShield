# Context-aware MVP release candidate

Extends PR #5 at b93708a; retains the integrated PR #4 code. Source recordings were supplied but could not be transcribed in this environment. Requirements come from the user's written execution prompt; no judge quotations are asserted.

Changes: independent High/Medium/Low category rankings; sharing-purpose selector and deterministic reasons; grouped counts/pages; labelled medical/blood group and educational detection; mandatory High source-coverage gate plus output scanning; optional Medium/Low residuals permitted; local rule-based AI Guide; coordinate editing for manual rectangles; English+Kannada option. OCR-localized evidence is preferred over broad native PDF line boxes when identical candidates are available. All selections start empty.

Local validation: TypeScript passes; 59 frontend/gateway tests pass; 33 Python tests pass; production build and Wrangler dry run pass. Browser acceptance and exact-revision CI are pending at this checkpoint. This file is not proof of production deployment.

Limitations: Kannada semantics and handwriting remain manual-review only; no new accuracy claim. QR absence and unreadable OCR cannot establish clearance. Label-based clinical detection is not general medical NER. Five PDF pages per batch and 8 MB per file; larger PDFs can be split locally. DOCX remains text-only reconstruction. Source native PDF boxes can remain coarse where OCR localization fails. Face model requires a first-use network download. No paid inference.

Production is controlled by the existing Cloudflare integration-branch build trigger. Do not update the integration branch until browser/security acceptance passes. Retain existing release checks; handwritten recognition is explicitly outside the validated MVP scope. Final production commit/version and browser checks must be recorded after release.

## Additional validation during this execution
- Mixed printed English/Kannada: one generated 1400×380 PNG, Noto Sans Kannada 400 (Fontsource 5.3.0) and DejaVu Sans, with fictional name, email and blood-group labels. Tesseract using the application's eng+kan packs, PSM 6: CER 0.0149, WER 0.125 for raw and contrast variants. English email and blood-group values were both read correctly (2/2 in this tiny labelled set). Kannada label punctuation was misread. This does not establish handwriting, general field recall, or representative accuracy.
- Browser context acceptance: each tier starts at #1; medical-purpose export retains optional email/blood group after PAN removal; public-purpose change discards prior clearance and flags blood group.
- Browser first-load, floating priority control, rule-based guide, 390-pixel mobile viewport, downloaded text bytes, and zero-selection clearance checks pass.
- The browser test uses fictional two-page PDF data and writes its actual exported bytes to `/tmp/shareshield-browser-redacted.pdf` for independent inspection. Face-model network failure remains explicitly incomplete; no fail-open behavior is introduced.
- Final local browser smoke passes: manual add/move/resize/delete, two-page processing, actual export reopening. Independent PyMuPDF rendering plus native Tesseract confirms both exported pages omit the tested email/PAN/password, preserve the public note, contain no searchable source text and carry no embedded attachments. This is limited fixture evidence, not a complete leak-proof guarantee.
