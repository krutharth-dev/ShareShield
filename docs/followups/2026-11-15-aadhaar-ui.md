# Aadhaar validation and workspace copy follow-up

Based on Phase 4 commit `56596ed03c088bdcc44e7669854fcc63db95379f`. Production deployment metadata still identifies `f970169be3dded2060abaf4336d27ad191a3b843`, so it does not include the Phase 3/4 fixes. This is a development change only.

## Confirmed reproduction

The fictional input `Aadhaar: 2345\n6789\n0124` was detected as an Aadhaar candidate but received validation `failed` and confidence 0.45. The same digits on one line received `passed` and confidence 0.94. Grouped detection strips line breaks; the explanatory validator stripped punctuation but not line breaks, so the two stages disagreed and prevented otherwise eligible automatic selection.

Normalize the explicitly supported group separators inside the shared checksum validator. The explanatory check now calls that validator directly. Exact 12-digit length, leading-digit constraints and Verhoeff remain required. Nothing slices 12 digits from longer numeric sequences. No authenticity/issuance/ownership check is implied.

A new regression covers English/Kannada digits, LF/CRLF, original source spans, three localized component boxes, missing boxes, uncertain OCR, a failing checksum and a line-wrapped 16-digit VID. All 188 frontend tests and TypeScript checks passed locally. CI runs all existing browser/export and independent-output tests on the published commit. This proves this particular validation mismatch, not that it reproduces the user's unspecified failing document or fixes rotated/skewed OCR.

## Copy cleanup

Carry PR #25's already-prepared removal of the redundant control-bar note into this compatible development branch, so the banner does not return when development changes are eventually integrated. Also replace the crowded introductory policy paragraph with one concise instruction. Keep exclusion disclosures in verification report warnings, with the configured VID/BID exclusion unchanged. Keep actual validation results and required-review warnings visible.

No colour theme or broad redesign is implemented yet. Three separate visual concepts have been supplied for user selection. No production merge, production deployment, model change or priority-policy change.
