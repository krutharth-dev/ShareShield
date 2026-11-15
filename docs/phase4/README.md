# Phase 4 — security hardening and independent export inspection

Development only. Based on PR #23, `ac01d99924acf766c953b500697bebc4861b0513`, whose four pull-request workflows passed. Its parent is `a4c56a0e30e4c70be6e484fad58c920a462299c6` on `feat/validation-evidence-20261105`. The compatible stack includes trained AI, Kannada fixes and Phase 3 occurrence preservation. Production was not changed.

## Threat model and invariants

An accidentally incomplete approval set, OCR/localization errors, malicious PDF objects, stale selections, malformed input, or a misleading clearance result can expose private data. The original, renderer, detector, approval state, encoder, reopened-byte verifier and downloaded-file verifier are separate trust boundaries. Detector confidence is not structural validity or proof of removal.

Every export starts from immutable source raster pages and a copied current approval set. Every supplied region must be valid. The PDF is newly allocated; source objects are never imported. Output text, structure, displayed geometry and mask pixels must be inspected. FLAG means confirmed residual exposure or a failed reconstruction contract; UNVERIFIED means incomplete evidence/review. SCOPED_CLEAR concerns only the explicitly requested completed checks. Original files and browser memory are not promised to be physically erased.

## Confirmed issues and corrections

| Issue | Demonstrated impact / severity | Correction and reproduction |
|---|---|---|
| Unused PDF stream ignored by early independent checker | High verification defect: a synthetic secret in an orphan stream returned SCOPED_CLEAR on `281243d` | Track all streams and reject orphan/unaccounted streams; reproduction now FLAG for raster contract, UNVERIFIED for general inspection. `test_orphan_stream_cannot_hide_selected_bytes` |
| Hidden form values and JavaScript omitted from Python inspection | High: selected synthetic value survived while a text+metadata request returned SCOPED_CLEAR | Traverse reachable and orphaned PDF objects with pypdf. Selected object residuals FLAG; active structures cannot pass the fresh raster contract. `test_hidden_form_and_javascript_cannot_clear`; baseline JSON records old behavior |
| Legacy backend clips out-of-bounds rectangles | Medium: approved region silently changed | Reject any incomplete/out-of-bounds region before writing; rebuild fresh raster pages. Parametrized negative/overflow/nonfinite tests |
| Source filename echoed in export/report | Medium: sensitive identifiers in filenames can accompany a redacted file | Neutral download and report filenames; no values or original locations in reports |
| PDF size assumes render scale is always two | Medium correctness/security relevance: large-sheet output coordinates/dimensions change | Preserve displayed PDF point dimensions independently of adaptive raster size; rotated/cropped/mixed-size tests |
| Auto-selection accepts one valid box among invalid boxes | Medium: invalid proposal can be approved automatically | Require all boxes to be finite, positive and nonnegative; export additionally checks page bounds |
| Backend native-vs-OCR dedup uses value alone | Medium: mixed-PDF repeated image occurrence can be dropped | Preserve optical occurrences instead of dropping same-valued detections; duplicates remain explicit proposals |
| Backend Aadhaar parser can match inside spaced 16-digit numeric tokens | Medium policy error | Exclude longer numeric spans from Aadhaar matching; dedicated ten-occurrence/VID regression |
| “Permanent pixel removal” passed on encoder success | Evidence defect, not a demonstrated frontend recoverable-overlay vulnerability | Separate reconstruction from reopened mask-pixel checks; wrong/missing pixels FLAG |

No frontend overlay-only redaction vulnerability was established: the existing frontend already rasterized into fresh PDFs. That design is preserved. The backend legacy function previously retained more original PDF structure; all callers now receive fresh raster PDFs.

## Verification independence

Browser production: pdf-lib constructs output; PDF.js reopens its bytes, checks page count/dimensions, text, annotations, actions, metadata/attachments and renders it. Pixel checks inspect decoded output, not the UI overlays. OCR and contextual rescans share engines/models with detection and are **not independent semantic validation**.

Offline/CI: `backend/verification/export_inspection.py` uses pypdf for object traversal and a strict one-image drawing contract, and PyMuPDF/Pillow to compare source/output dimensions and approved regions, including embedded image pixels. Native Tesseract freshly OCRs saved output. This is independent of the browser PDF renderer/encoder; Tesseract shares recognition lineage with browser OCR and is not an independent OCR algorithm. `tools/phase4/verify_downloads.py` checks actual browser downloads and report SHA-256, ten repeated Aadhaar values plus a rotated occurrence, manual removal/restoration, metadata/objects, and VID-visible ink. VID is potentially sensitive but remains outside policy.

The strict raster contract rejects text drawing, overlays, forms, actions, annotations, optional content and incremental revisions. Unsupported composition is incomplete or a reconstruction-contract failure, not proof of safety. The source-region manifest must be trusted and independently reviewed: correct black pixels do not establish that the detector found everything or localized the right thing. A blank OCR result is incomplete. A narrow offline text/object/pixel check may pass without asserting OCR/face/QR/semantic completeness.

## Privacy, limits and resource lifecycle

Processing remains local in the active browser application. No document-upload endpoint was added. OCR data and trained contextual weights are local assets. Existing MediaPipe face runtime/model still load from pinned CDN URLs; image pixels are passed to its on-device engine, not uploaded. This external executable dependency is a remaining supply-chain trust boundary; self-hosting/integrity hardening remains pending. CSP permits those hosts and WASM, denies objects, framing and arbitrary form actions. No document telemetry or browser document storage was added.

Existing 8 MB upload and 12 MP page bounds remain. A new cumulative 48 MP raster budget per document limits retained page previews without imposing a fixed PDF page count. This is not an aggregate workspace memory cap; many simultaneous documents can still consume substantial memory. Independent inspection caps 100 pages and 12 MP rendered page size. Legacy backend still has its existing five-page analysis limit; it is not the production browser path. Workers/PDF loading tasks close in finally blocks; failed analysis revokes previews; clear/expiry revokes URLs and clears maps; successful re-export revokes the old output URL. Shared returned analysis is cloned so callers cannot mutate the stored source geometry. Session expiry is rechecked before publishing an export. Garbage collection, temporary decoder copies and browser caches cannot be securely erased by JavaScript.

## Evidence and reproduction

- `evidence/baseline-reproductions.json`: fictional old failures, including hidden-form/JS false clearance and clipping.
- `evidence/frontend-tests.txt`, `evidence/python-tests.txt`, `evidence/typecheck.txt`: local results.
- `tests/verification/test_phase4_security.py`: adversarial structures, overlays, wrong masks, missing coordinates, bad OCR, immutable re-export, rotated/cropped mixed pages, VID exception.
- `frontend/tests/export-security.test.mjs`: occurrence/box contract, copied approvals, reopened pixels and resource budget.
- `frontend/tests/browser/phase4-security.mjs`: real UI upload/review/manual edit/download/re-export and outbound request audit. GitHub CI retains original output PDFs, report JSON, hashes and independent checks as workflow artifacts.
- `tools/phase4/generate.py`: new fictional development fixtures; install `qrcode==8.2` to regenerate. Phase 3 sealed data were not tuned.

Local baseline: 180 frontend and 33 backend tests passed. Hardened results: **187 frontend tests and 56 Python tests passed**, TypeScript, production build, Worker dry-run and Pages Functions compilation passed. Model reproduction matched SHA-256 `4eea0b5ec09e69bd184df51db4686d1498ff162dc39de2334285f2881bae83db`; annotation-package tests and frozen-corpus evaluation passed. All four GitHub workflows passed on `31a83105b1c2525c77c89f28c72b0d7ac73a9963`, including actual Chromium UI downloads, Kannada, cancellation/retry, desktop/touch emulation, contextual AI/performance and Extend viewer. See [RESULTS.md](RESULTS.md) for exact run links, measurements, test coverage and limitations. Final follow-up commits rerun CI; the PR records the final exact head. Local Chromium cannot launch in this sandbox; browser acceptance ran on GitHub Actions, not a simulated browser. Downloaded artifacts were independently rechecked locally.

## Residual risks and release blockers

No universal anonymity or production readiness is claimed. Human Kannada review, authorized real-record evaluation, physical Android/iPhone testing, difficult skew/perspective/dense-table/multi-column cases and representative face/handwriting/QR performance remain pending. The Phase 3 missed tiny entity and seven extra proposals are not claimed fixed; original source coordinates and mandatory review are retained. No model retraining or sealed-set tuning was performed. Model reproducibility was checked locally and reproduced the checked-in model hash.

Face unavailable, QR unavailable/zero decode, handwriting uncertainty, unlocalized findings, incomplete OCR and unresolved review remain UNVERIFIED. Synthetic avatar masking tests are not face-detection performance. QR pixel removal does not validate every QR decoding format. Raster export loses searchable text/accessibility, forms, signatures, links and original vector quality, and can increase output size; displayed orientation is preserved with normalized output rotation.

Follow `../phase3/review/README.md` and `../phase3/DEVICE_ACCEPTANCE.md`: actual fluent-Kannada reviewers must annotate independently, inspect every original/export page, record missed/extra/mislocalized occurrences, confirm approved glyph coverage and VID exclusion, and sign/date their evidence. Authorized real records stay local and must not be committed. Release remains blocked until the pending human/device/real-document and difficult-layout acceptance requirements are addressed. Software CI completion alone is not production approval. No production merge/deploy, paid infrastructure or private records are authorized by this PR.


### First CI failure and actual rotated-page limitation

The first browser run completed the UI workflow and Phase 3 independent pixel checks, but Phase 4 structural inspection rejected pdf-lib's empty `/Annots []` arrays. Downloaded bytes confirmed these arrays contained zero annotations. The checker now distinguishes empty arrays from actual annotation objects; a positive regression still rejects a populated annotation containing the selected synthetic value.

Separate inspection of those downloads found that ten upright Aadhaar occurrences were masked but the rotated native-text occurrence had no coordinates (its full PDF text item includes the label; vertical OCR did not localize the number). This is **not fixed automatic rotated-text recognition**. The UI keeps it unresolved; the acceptance workflow explicitly draws a precise manual region and verifies all eleven physical occurrences afterward. Ground-truth checks inspect every source glyph pixel; blank inter-word/font-metric margins are not falsely required to be masked. Supplied approved-mask rectangles are checked in full separately. No detection assertion was replaced with a fabricated localization.

Rendered annotation appearances may remain as pixels (the fixture retains a harmless comment icon), while hidden annotation objects/comments are discarded. Visible annotation or form text still requires an approved mask like other visible content. Raster reconstruction does not automatically redact everything rendered on a source page.

The final stream audit also removes the backend encoder-generated ICC profile stream after pixels have been converted to RGB. The supported strict format uses DeviceRGB pixels and accounts for page content, image, xref and object-container streams. Unsupported auxiliary streams cannot pass its reconstruction contract; no original ICC profile is imported. This is a supported-format verifier, not a universal arbitrary-PDF sanitizer.
