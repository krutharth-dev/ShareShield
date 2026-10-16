# Scope and milestones

## Phase 1 — Mini project (demo: 28 October 2026)

**Core priority:** searchable English PDF upload, detection of selected IDs/emails, user approval, real PDF redaction, export, reopening, post-export text verification, and a meaningful PASS/FLAG/UNVERIFIED result.

**Stretch goal:** detection and replacement/redaction of editable text in modern `.pptx` files, followed by saved-file verification. Slides may contain hidden or unsupported structures; these must be reported honestly, never silently accepted as safe.

### Acceptance criteria
- Run the frontend and backend locally on **one Mac** during the demo.
- Preserve the original file; save a separate edited copy.
- A user can choose which supported detections to redact.
- Verification actually reopens the saved output and inspects it independently of the preview.
- If required checks fail or cannot run, sharing/download is held for review, not labeled PASS.
- Demonstrate a **fictional** PDF in which drawing a visual covering does not remove copyable text.
- Record completed checks, limitations, and measured results; do not invent test accuracy.

### Out of initial scope
Native Android/iOS apps; unrestricted monitoring of third-party apps; scanned-image OCR; face recognition/redaction; Kannada language support; password-protected/encrypted documents; guaranteed inspection of every metadata/attachment/embedded structure.

## Phase 2 — Major project (post-demo)

Investigate mobile-compatible on-device engines, OCR, visual redaction, verified sharing through Android share intents and iOS extensions, and authorized app-specific integrations. App-level enable/disable settings control ShareShield itself; they cannot grant universal access to other applications' uploads.

## Dates
- 16–18 October: Repo/readiness
- 19–22 October: Foundations and detection
- 23–25 October: Redaction and verification; PPTX attempt
- 26 October: Tests and documentation
- 27 October: Freeze and rehearse
- 28 October: Demonstrate

## Research focus
Evaluate whether **independent reinspection of exported documents** catches residual leaks missed by an otherwise comparable redaction-only workflow. Measure leak-detection rate, false positives, detection quality and processing time with fictional data. Novelty or patentability has not been established.
