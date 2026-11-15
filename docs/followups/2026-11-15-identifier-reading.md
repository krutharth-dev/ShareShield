# Identifier reading and validation hardening

Development base: Cloud Indigo PR #27, commit `8214add65f45a5def4b953cde2cc03b91810d8f0`.
All inputs below are fictional regression values. No sealed evaluation corpus, model weights, category priorities or production settings were changed.

## Reproduced failures and corrections

| Reproducer | Before | Correction and expected result |
| --- | --- | --- |
| Aadhaar label on one row, checksum-damaged or incomplete value on the next, in English/Kannada | No Aadhaar finding for `Aadhaar:\n2345 6789 0125` | Recognize the immediate complete label, retain original offsets and send the value to mandatory review. Never repair digits or authenticate identity. |
| Aadhaar label followed by ten adjacent complete numeric rows | Zero Aadhaar findings: the numeric-continuation guard treated neighboring rows as one long number | Propose all ten complete rows separately, only under an explicit Aadhaar label. Each remains review-only because row/column association is uncertain. A partial row rejects this fallback. |
| `Patient ID:\n2345 6789 0124` | Confident Aadhaar candidate because label context stopped at the newline | Preserve the institutional label and propose a generic form identifier for review. Supports analogous English/Kannada MRN/student labels. |
| `Aadhaar: 2345 6789 O124 9999` or a valid 12-digit prefix separated from four more digits by a wide gap | A 12-character prefix was proposed as Aadhaar | Numeric-continuation checks include OCR-like adjacent tokens and have no fixed whitespace limit. The longer value does not enter the Aadhaar list. VID/BID remain excluded from selection and required verification. |
| Exact span supplied with a same-length but different OCR token, inconsistent token bounds or invalid confidence | Localization returned trusted boxes | Require exact source-token text, integral consistent offsets and finite confidence in range before returning any boxes. Invalid provenance leaves the finding unlocalized. This is a unit-level input-contract failure, not a demonstrated malicious-PDF exploit. |

The five regression groups failed against the base implementation and passed after correction. Local full suite: **194/194 tests**, including the existing 188 tests; TypeScript production build passed. These are targeted regression results, not a population accuracy estimate.

## Additional validation

Birth-date fields now receive Gregorian calendar validation, including century leap-year rules and month lengths. Impossible dates fail validation. Ambiguous day/month order and unsupported formats remain `not_checked`, requiring review. Calendar structure does not establish birth date, age, issuance or identity. No current-date or age inference is made.

The new test matrix includes 16 separate-label/language cases, three ten-occurrence layouts, ten institutional-label cases, 80 longer-number exclusion cases, malformed localization inputs, and valid/invalid/ambiguous dates. Exact original UTF-16 spans, manual-review policy and absence of automatic approval are asserted.

## Browser and independent output checks

`frontend/tests/browser/identifier-reading.mjs` generates a fresh one-page PDF containing ten adjacent fictional Aadhaar rows. It uploads the PDF to the built application, checks ten separately localized review findings, downloads unapproved/approved/one-deselected exports and the verification reports, and clears the workspace. Known remaining exposures must report `FLAG`; missing visual evidence cannot become `SCOPED_CLEAR`.

`tools/verify_identifier_downloads.py` independently reopens those actual downloads using PyMuPDF and pypdf. It checks:

- Original page geometry, no extractable text, fresh raster structure and no retained interactive structures or metadata values.
- SHA-256 agreement with the downloaded verification report.
- Original glyph pixels in every one of the ten ground-truth source rectangles: zero regions removed before approval, ten after approval, nine after deselection.
- Every approved output mask against the report manifest.

The browser workflow also retains all existing Kannada, OCR, cancellation/retry, model, desktop/touch, manual-redaction and independent PDF acceptance checks. Browser and CI results plus artifact hashes are recorded in the draft PR after execution; this document does not predeclare their outcome. Artifacts include only synthetic documents and expire after seven days.

## Scope and release limitations

This change improves interpretation and validation of recognized text and trust in its localization. It does not retrain the OCR/model, claim higher optical character-recognition accuracy, solve strong skew/perspective, or establish real-world recall/precision. A checksum is not identity verification. More review findings are not automatically more accurate findings.

No private documents were supplied, no independent fluent-Kannada reviewer participated, and no physical Android/iPhone result is claimed. Existing Phase 4 human-review and production-release blockers remain. Production is unchanged; the draft targets the compatible development branch.
