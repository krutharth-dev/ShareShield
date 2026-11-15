# Review corpus and independent annotation gap

The 36 development and 42 holdout documents are fictional examples authored and annotated by the coding assistant. They are separate from the original template generator, but **not independently human-annotated, native-speaker-reviewed or representative real documents**. Every row records `human_review: pending`. No outside reviewer was contacted and no actual identity or patient records were used.

The holdout was frozen before the v2 fit/proposal changes; SHA-256:
`2443acfed8ddb2f8f4a880eb10009f0a48e8bb12028b1fe309aca6f59a752406`.
Development SHA-256:
`af457c7344827bf9fad9a48b116518c0abd8b222c3b178bb75c945c3676fa293`.

The before report `review-baseline.json` records the v1 checkpoint hash; `review-results.json` records the updated model. Development annotations feed training and therefore development metrics are NOT held-out evidence. The new holdout is not opened by training. After results have been inspected it becomes a regression set: future model selection requires another sealed test set.

## Human review procedure

Use `review-holdout.json` as an annotation worklist. Each reviewer should independently read `text`, record every sensitive span using UTF-16 start/end offsets (end exclusive), and select existing registry categories. Do not see model predictions while annotating. Mark genuinely ambiguous categories unresolved instead of guessing; unlabelled public reference numbers and organizations are negative unless context identifies a person. VID/BID remain out of policy, whereas every distinct 12-digit Aadhaar occurrence is annotated separately. Preserve Kannada combining characters and emoji offsets.

Record reviewer qualification, review date, corrections and adjudication in a separate reviewed revision, rather than overwriting the frozen benchmark. At least one fluent Kannada reviewer and a second independent annotator are needed to measure agreement. Report disagreement and adjudicate before scoring. A medical label does not authenticate an identifier or justify a diagnosis.

No reviewer identity or completed independent annotation is claimed. Without that external review and representative authorized OCR/document samples, production accuracy acceptance remains blocked.
