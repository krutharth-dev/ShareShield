# Scope and milestones

## Phase 1 — Mini project (demo: 28 October 2026)

**Core demonstration:** run ShareShield locally, upload a supported image/document, detect selected PII candidates, review findings, redact to a separate copy, reopen/rescan the output, report limitations and download it.

### Implemented on the development branch

- Local browser-based upload and review UI.
- Searchable/scanned PDF, common image formats including HEIC (subject to target-Mac compatibility), DOCX, PPTX and TXT.
- Pattern-based email/mobile, PAN-format, checksum-valid Aadhaar-format and common UPI-handle detection.
- Original and redacted preview for PDFs/images, including manual black-box selection.
- File signature checks, document container limits, user selection and SHA-256 file binding.
- Scoped reinspection and PASS_SCOPED / FLAG / UNVERIFIED reporting.
- Synthetic regression tests and GitHub Actions.

### Demo acceptance criteria

- Run locally on the target 2017 Intel MacBook Pro; verify OCR and HEIC availability.
- Preserve original files and save new outputs.
- Test true PDF content redaction (not merely a cosmetic black rectangle).
- Show before/after previews and detection labels with synthetic example files.
- If selected identifiers remain detectable, report FLAG rather than implying safety.
- When checks are incomplete, clearly label limitations and UNVERIFIED areas.
- Confirm no private test files, credentials or identifiable real-person content are committed.
- Freeze a known-good version before the demo. Do not claim 100% privacy or measured detection accuracy without evidence.

### Known limitations

This is an educational prototype, not a complete sanitization tool. Scanning can miss handwriting, complex layouts, embedded data, Office revisions and hidden content. Visual previews are limited to images/PDFs. No face detection or unrestricted monitoring of other apps is included.

## Phase 2 — Major project

Explore mobile-compatible on-device processing, contextual/entity models, more language support, faces and other visual-PII detection, stronger metadata/content sanitization, and opt-in Android/iOS share-sheet integrations. App enable/disable controls cannot grant universal access to unrelated applications.

## Development dates

- 23–25 October: enhanced detection, preview, manual selection and verification
- 26 October: synthetic tests, security review, target-Mac compatibility
- 27 October: code freeze and demonstration rehearsal
- 28 October: mini-project demo

## Research focus

Evaluate whether independent reinspection of exported files detects residual sensitive information that a redaction-only pipeline misses. Compare false positives, missed detections, output integrity and latency using synthetic examples. Novelty or patentability has not been established.
