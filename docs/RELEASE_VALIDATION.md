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
