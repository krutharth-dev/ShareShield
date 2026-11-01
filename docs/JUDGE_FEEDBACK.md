# ShareShield X — judge-feedback evidence and engineering trace

**Status:** Written engineering brief received 31 October 2026; judge audio was **not provided** in the accessible files. No audio was transcribed. No judge quotations or audio timestamps are claimed. Items below are from the supplied written brief, not authenticated statements by a judge.

## Requested evidence not available
- WhatsApp audio recording and timestamped transcript: unavailable.
- Original screenshots or personally identifying demonstration documents: unavailable in this task.
- Exact ground-truth OCR text/boxes for four-field handwritten note: unavailable.
- Reproducible Kannada evaluation corpus and consent documentation: unavailable.

## Written brief → code mapping
| ID | Source from written brief | Priority | Code touchpoint | Acceptance criteria / evidence status |
|---|---|---|---|---|
| OCR-01 | One handwritten note reportedly yielded only a name, missing email, password and student ID | P0 | `frontend/src/handwriting.ts`, `processor.ts` | Detect/review all four visually distinct ink lines despite high average OCR confidence. New synthetic unit regression; still needs real scanned document/browser test. |
| VER-01 | Verification must never clear incomplete checks or zero detection | P0 | `frontend/src/processor.ts`, `verification-policy.ts` | Unsupported/empty QR scan and empty exported OCR are incomplete; remaining QR is flagged. Regression tests added; full browser export test outstanding. |
| ID-01 | Aadhaar repeats and OCR-damaged digits are missed | P0 | `frontend/src/detection.ts` | All synthetic repeats independently localized and redacted; existing detection unit tests cover review candidates; image ground-truth tests outstanding. |
| PIX-01 | Redaction must truly remove selected pixels and PDF embedded content | P0 | `processor.ts`, `backend/app/services/processing.py` | Reopen exported bytes; inspect pixels and extracted text, attachments and metadata. Existing primitives, not yet demonstrated against all supplied document types. |
| KA-01 | Kannada legal parties, names, addresses and digits | P1 | `frontend/src/detection.ts`, OCR assets | Run Kannada ground-truth CER/WER and PII recall. Heuristic review exists; accuracy not validated. |
| UI-01 | Manual select/deselect and adjustable redaction rectangles | P1 | `frontend/src/Workspace.tsx` | Browser-test selected categories, clearing, manual drawing, rerunning redaction; existing drag-select control, editing a rectangle remains limited. |
| DOCX-01 | Original-format claims must be accurate | P1 | `frontend/src/docx.ts` | Clearly label text-only reconstruction, reopen exported DOCX; no layout-fidelity claim. |
| SEC-01 | Private local processing, no silent model uploads | P0 | `frontend/src/processor.ts`, `faces.ts` | Private pixels stay in browser; third-party model/asset downloads must be disclosed; manual mode remains available. |
| QA-01 | Reproducible OCR benchmarks and end-to-end export tests | P0 | `frontend/tests`, `docs/OCR_BENCHMARK.md` | Real metrics, fixtures and exported-byte checks required before any accuracy guarantee; not yet achieved. |

## Implemented on feature review branch
- Inspect high-contrast line regions even when Tesseract returns a high average OCR confidence.
- Require manual review of ink regions not adequately covered by localized OCR words.
- Treat QR scans with zero decoded results or an unavailable decoder as incomplete during export verification.
- Treat empty exported OCR output as incomplete.
- Add synthetic regression tests for handwriting rows and QR scan clearance.

## Release gate
Do not treat this document as a judge transcript. Obtain the actual recording and anonymized, permissioned failing examples to add timestamped evidence and verify every P0 acceptance criterion before promoting a safety claim.
