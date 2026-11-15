# Draft PR: Improve multilingual OCR occurrence coverage and exported-pixel verification

Target repository: https://github.com/krutharth-dev/ShareShield
Head: `feat/phase3-ocr-reliability-20261109`
Base: `feat/validation-evidence-20261105`
State: draft; do not merge or deploy to production.

Small scanned text, separated Kannada/English labels and repeated/incomplete Aadhaar occurrences could be missed, merged or mapped too broadly. This change adds bounded small-glyph OCR rescue, complete-token localization, occurrence-aware deduplication, narrow review-only form detection and explicit cancellation. Verification now honours VID exclusion and preserves uncertainty when OCR mistakes a black mask for an identifier.

On 13 sealed fictional scans with generator-authored annotations, localized hybrid proposals improved from 23/33 to 32/33: precision 76.7% → 82.1%, recall 69.7% → 97.0%, F1 73.0% → 88.9%. Seven extra/duplicate proposals and one missed tiny-scan entity remain. OCR-pass CER improved 6.78% → 1.04%, WER 8.33% → 6.41%. These template-based results are not independent human or real-document validation.

Validation completed locally:

- 180 frontend tests and 33 backend tests.
- Seven annotation tests and frozen-corpus validation.
- TypeScript, production build, Worker dry run and Pages Functions compilation.
- Browser smoke including ten-page PDFs, original Kannada regression, trained-model acceptance, cancellation/retry, and desktop/touch-emulated scanned PDF export.
- Independent PyMuPDF/Pillow inspection: all glyph components in seven expected regions masked in both downloads; no PDF text layer; VID pixels unchanged. Outputs correctly remain UNVERIFIED.
- Isolated Extend viewer build/browser acceptance, with local WASM and zero external requests.

See [full report](README.md), [metrics](metrics.json), [raw evidence](evidence/), [changed files](FILES_CHANGED.txt), [pending independent-review package](review/README.md) and [physical-device checklist](DEVICE_ACCEPTANCE.md).

Limitations: independent fluent-Kannada review, representative authorized real records and physical Android/iPhone tests are pending. Strong skew, rotated images, perspective distortion and dense multi-column/table layouts are not newly solved. Extend stays isolated until a tested coordinate contract supports `/app` integration. No model weights or priority ordering changed; no private documents used; no production or hackathon changes.

Publication authorized by the user on 10 November 2026. GitHub CI status will be reported on the draft PR. No production merge or deployment is included.
