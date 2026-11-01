# OCR benchmark protocol — no accuracy results claimed

**Current state:** This repository has synthetic unit tests for text detection and ink-row review, but no labeled benchmark sufficient to calculate English/Kannada CER/WER, field recall, or residual leakage. Targets below are aspirational, **not achieved measurements**.

## Reproducible corpus plan
Create only consented or fictional samples, with ground-truth characters, words, sensitive-field labels and bounding polygons:
1. Printed English single-column and multicolumn.
2. Printed Kannada legal/administrative documents with Unicode-normalized ground truth.
3. English handwriting with four independent fields: name, email, password and student ID.
4. Kannada handwriting, including illegible and low-confidence examples.
5. Mixed Kannada-English, Kannada numerals, damaged Aadhaar labels and repeated IDs.
6. Low-quality photographs: rotation, perspective, uneven shadow, small text and QR/portrait regions.

Split by document, not page, into development and held-out evaluation sets. Record data license/consent, device, resolution, engine version, model hash, settings, all human corrections and failures.

## Measurement contract
- CER = sum Levenshtein character edits / sum ground-truth character counts; report Unicode normalization rule.
- WER = sum token-level edits / sum ground-truth word counts; document Kannada tokenization.
- Sensitive-field precision = TP / (TP+FP); recall = TP / (TP+FN). Count missed and mislabeled fields separately.
- Bounding-box coverage = overlap IoU and percent of target pixel regions fully covered, per category.
- Export leak rate = number of exports with any independently detected selected exposure / number of evaluated exports; preserve false-negative inspection records.
- Also record page runtime, memory peak, detector failure rate, and percentage marked `UNVERIFIED`.

Run the same dataset and preprocessing budget through Tesseract eng, kan, eng+kan and any **proven Kannada-compatible** alternative. Do not assume PaddleOCR or generic multilingual transformer support until verified for that exact model/version. Record confidence-calibration curves and abstention behavior, not just averages.

## Acceptance before promoting claims
- Reproduce all four handwritten-line candidates after OCR recognizes only the first.
- Test Aadhaar values at least twice across multiple pages, including incorrect checksum and Kannada numerals.
- Inspect downloaded, reopened PDF and image outputs independently for residual text, QR/photo pixels and attachments.
- Verify true-negative examples still produce understandable, limited results rather than misleading universal clearance.
- Target >=95% field recall on readable printed held-out test documents *if achievable*. Do not publish this as a measured result.

## Results
| Cohort | Samples | CER | WER | Field recall | Leak rate | Status |
|---|---:|---:|---:|---:|---:|---|
| Printed English | — | — | — | — | — | Not measured |
| Printed Kannada | — | — | — | — | — | Not measured |
| English handwriting | — | — | — | — | — | Not measured |
| Kannada handwriting | — | — | — | — | — | Not measured |
| Mixed script | — | — | — | — | — | Not measured |
| Poor-quality photos | — | — | — | — | — | Not measured |
