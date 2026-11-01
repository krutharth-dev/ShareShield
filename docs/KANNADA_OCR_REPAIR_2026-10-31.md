# Kannada OCR repair and validation — 31 October 2026

## Diagnosis from the repository and reported screenshot

The production screenshot showed **71 potential exposures**, including many `UNREADABLE_TEXT_LINE_REVIEW` items with an approximately 25% OCR reading. This number is not an accuracy metric. It includes image-ink review suggestions as well as sensitive-entity findings.

The browser frontend uses **Tesseract.js 7**, not the Python `backend/ocr/engine.py`, for the normal browser-local workflow. The build script copies `eng`, `kan`, and `hin` traineddata from local npm packages into `public/ocr/`. Tesseract's Python installation on a developer laptop does **not** determine the deployed browser behavior.

The browser workspace previously defaulted to `eng` despite local Kannada language data existing. The old low-confidence branch also proposed every visual ink line for review whenever the first OCR pass scored below 70%, even where a later pass recognized the text.

## Implemented on the draft PR branch

- Default the workspace's OCR selector to `eng+kan` (the selection remains user-editable).
- Compare confident OCR word boxes from *all* available passes and extractable PDF text boxes to the detected ink lines. Weakly recognized words cannot hide missed ink regions. Uncovered lines remain review candidates.
- Use the best page OCR score to avoid unnecessarily declaring the *entire* page low confidence when a later pass succeeds. This does **not** certify complete recognition; remaining ink-line warnings and manual-review restrictions still apply.
- Separate count/visibility of sensitive-information candidates from OCR-unreadable image regions. The latter remain accessible from the dedicated review UI, are never silently cleared, and continue affecting the review/verification report.
- Support Kannada/Hindi digits in explicitly labelled DOB, account and Indian mobile-number patterns. Keep original string offsets for PDF box mapping and avoid treating bare numbers as bank accounts.
- Add unit/regression tests for mixed scripts, offsets, negative examples, OCR pass merging, and packaged language assets in Playwright.
- Keep existing PDF rasterized-export behavior: selected pixels are replaced in new image bytes and embedded into a fresh PDF, so source PDF text layers and attachments are not copied. Output OCR and metadata checks remain necessary.

## Known limitations / required manual acceptance

1. The 71-warning screenshot has **not** been re-evaluated against the exact original PDF. No measured reduction, field recall, or Kannada OCR accuracy improvement can be claimed yet.
2. Multi-line Kannada names/addresses still rely on heuristic legal-party rules. A plain narrative may include implied identifiers that no regex can detect. The app is an assistive review tool, not verified Kannada named-entity recognition.
3. Low-quality scans, handwriting, and Tesseract segmentation remain limitations. Manual review remains mandatory for ambiguous Kannada image content.
4. OCR traineddata are expected inside the *built frontend*; Playwright now verifies their HTTP availability. Cloudflare production has **not** been changed by this branch.
5. Export re-OCR may miss a value even if it remains visually legible. Actual downloaded PDF/image pixels must be inspected with synthetic test identifiers and deliberately incomplete masks.
6. Native PDF text coordinates, OCR word coordinates and multi-line bounding regions need dedicated visual comparisons on sample PDFs before merge.
7. Native text-based PDF export does not preserve original searchable text: source pages are rasterized into newly created PDF pages. This deliberately removes interactive links, text layers, signatures, forms and metadata.
8. CI completion and actual Kannada end-to-end recall are different milestones; do not merge or deploy just because tests pass.

## Acceptance checklist

- Run `cd frontend && npm ci && npm run typecheck && npm test && npm run build`, then Playwright browser acceptance.
- Verify English-only, Kannada-only and mixed-language pages, both clean and blurred synthetic legal documents.
- Confirm detected names, addresses, Aadhaar candidates, PAN, DOB, bank account and mobile fields at their *correct source pixels*.
- Confirm non-sensitive Kannada legal prose is not called PII.
- Verify unreadable regions have a separate count and remain reviewable.
- Cover a synthetic secret, export, then reopen the actual download; confirm no source text or pixel representation of the selected value persists.
- Intentionally leave a synthetic secret uncovered and confirm that the output does **not** claim to be universally clear.
- Measure character/word errors and, more importantly, per-PII-field recall and independent downloaded-file leakage on a representative evaluation set.

**Release status:** draft PR only. No automatic merge/deployment.