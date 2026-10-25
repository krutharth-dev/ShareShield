# Selective review reliability release

## Changes
- Export and verification use the immutable analysis the user actually reviewed. An unguessable review token is bound to the source hash and format; no second OCR pass can reorder selected IDs.
- At most 16 review snapshots remain in process memory, with a ten-minute validity window. Source document bytes are not cached. Restart, capacity eviction or expiry requires reanalysis. This design supports the current single-worker deployment; multiple workers require a shared expiring store.
- Every UNVERIFIED scan warning prevents PASS_SCOPED, including focused-region failures.
- OCR timeout recovery actually reduces resolution (900px versus the primary 1250px). Tesseract/OpenBLAS thread counts are limited in Docker.
- Two waiting jobs maximum; cancelled callers retain the processing slot until the underlying worker completes.
- Searchable PDFs now use the same contextual name/address inference as OCR.
- Context-labelled passport, driving licence, voter, account, patient and credential patterns are supported. These are conservative format heuristics, not general NER.
- UI separates heuristic rule confidence from severity. Lower-confidence suggestions remain unchecked until reviewed.

## Validation commands
```
npm ci --prefix frontend
npm run build --prefix frontend
OMP_THREAD_LIMIT=1 python -m pytest backend/tests -q
OMP_THREAD_LIMIT=1 python -m backend.release_smoke
OMP_THREAD_LIMIT=1 python -m backend.ocr_smoke
```
Build the frontend before running server asset tests. Tests use fictional values only.

## Presentation sequence
1. Open the deployed URL and wait for the processing server to be ready.
2. Use the built-in fictional sample for a quick text workflow, or generate fixtures with `python scripts/generate-demo-files.py --output /tmp/shareshield-demo`.
3. Choose privacy categories and analyze. Review suggested fields and confidence; explicitly select any medium-confidence identifiers needing protection.
4. For images/PDFs, inspect every page, zoom and add manual masks where needed. Keep blackout selected.
5. Export, inspect the original/redacted comparison, read the verification report and download.
6. Explain that PASS_SCOPED only covers supported checks. Office/visual/manual/incomplete scans may be UNVERIFIED.

## Known limits
- Hosted processing runs on Render, not on the device. Browser compatibility is independent of OCR runtime, which remains server-side.
- Detection cannot guarantee arbitrary names, Kannada/handwriting, all document layouts, barcodes or photographs. Review is mandatory. Kannada OCR packs and general NER are not implemented.
- Office support covers editable text structures; embedded images, revisions, notes and hidden content are not comprehensively sanitized.
- A free Render service can cold-start and has limited processing capacity. No paid plan changes are made by this release.
- Mobile viewport testing is not equivalent to physical iPhone/Safari or Android testing.

## Hosted validation, 24 October 2026

| Fixture | Export/reinspection | Outcome |
| --- | --- | --- |
| Searchable PDF | Completed | PASS_SCOPED |
| Scanned PDF | Completed | PASS_SCOPED |
| PNG / JPG | Completed | UNVERIFIED (best-effort OCR coverage) |
| DOCX / PPTX / XLSX | Completed | UNVERIFIED (Office limitations) |
| CSV / TXT | Completed | PASS_SCOPED |

Browser checks used connected Chrome at 1440×1000, 768×1024 and 390×844, with light/dark themes. No horizontal document overflow was observed. Built-in fictional image detected the name, parent, address, DOB, phone, 12-digit ID and VID. Export preserved the public header and test badge. Large OCR gaps are split before localization, and addresses use individual line masks.

Manual-mask drawing, undo and redo, category selection, original/export comparison, review acknowledgement and download-button activation were exercised. The browser download action was invoked; saved OS file completion could not be independently confirmed because download-event capture timed out and browser policy blocks the downloads-history page. Export bytes and reopening were independently verified through the hosted API.

A browser-specific fetch failure for `/health` was reproduced while direct navigation and API processing worked. The browser now polls `/api/status`, backed by the same health function; fresh-page status and OCR readiness succeeded. Render continues to probe `/health`. The underlying browser/network filter causing the path-specific failure is not identified.

The helper launcher is hidden during active review so it cannot obscure document masks or export controls. Explicit VID context takes precedence over coincidental payment-card checksum matches.

Physical Safari/iOS/Android and universal device compatibility are not certified. General NER, Kannada OCR, complete hidden-content sanitization and a guarantee of all sensitive-data detection remain outside this release. The current service stays on the existing free plan.

## Selective-export correction, 25 October 2026

A user report exposed a verification-policy mismatch: leaving DOB unchecked still blocked export because DOB is high priority. Export now distinguishes findings left unselected in the reviewed snapshot from selected findings that survive, and from newly discovered high-priority findings. Retained findings keep the output UNVERIFIED and appear in the report with an explicit reminder to confirm the choice; they do not alone block export. Selected leaks and new high-priority findings continue to block export. The latter now receive an accurate error instead of falsely claiming selected information survived.

Regression coverage includes keeping name/DOB while redacting VID in a synthetic searchable PDF, retaining an unselected PAN, selected-content export failures, and unexpected high-risk discoveries. No real identity documents are needed for testing this behavior.

## Additional error audit, 25 October 2026

Reproduced a manual blackout missing its target on a PDF rotated 90 degrees.
Native PDF findings now use displayed page coordinates, matching OCR and previews;
PDF redaction annotations convert those coordinates back to the unrotated page.
Sixteen regression cases cover 0/90/180/270-degree pages, manual blackout and detected
text with blackout/blur/pixelate. Checks verify actual black pixels, removed text,
preserved public headings (native blackout), and output dimensions.

Page navigation now clears old previews and draft masks before loading the next
page. Drawing requires a loaded original preview; review acknowledgement requires
an export preview. This prevents the previous page being reviewed as the new page.
This frontend guard was source-reviewed and build/lint checked, not independently
exercised in a physical-device browser during this audit.

Validation: 99 Python tests passed; frontend build and ESLint passed; release and
OCR smoke checks passed. Two purity-rule false positives in asynchronous click
handlers have narrowly scoped explanatory suppressions. No global rule disabled.
