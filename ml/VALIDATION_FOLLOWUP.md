# Validation follow-up, 5 November 2026

Runtime weights, confidence display and redaction policy are unchanged. These are validation tools and actual experiment results, not production approval.

## Calibration experiment: rejected for deployment

Run `OPENBLAS_NUM_THREADS=1 python ml/calibrate.py` after installing `ml/requirements.txt`.
Temperature scaling fits only synthetic validation family 6 (400 spans), checks family 7 (360 spans), and audits the historical 760 test spans and 37 harder fictional gold spans. The validation families previously selected the detector threshold, so this is not independent calibration validation. Reports include NLL, multiclass Brier score, ten-bin expected calibration error (ECE), reliability bins and language breakdowns. No weights are rewritten.

Fitted temperature: 0.11817278. On the harder fictional gold spans, raw → scaled:

| Metric | Raw | Scaled |
|---|---:|---:|
| NLL | 0.98319 | 5.88781 |
| Brier | 0.44854 | 0.63789 |
| ECE | 0.15585 | 0.32125 |

Scaling amplifies overconfidence under context shift. **Do not deploy this temperature or expose probability-like scores.** Both results are classification given gold spans, not end-to-end detection. A new independently annotated calibration split with errors, negatives and realistic OCR is needed, plus a separate sealed evaluation split. Calibration cannot repair missed span proposals.

## OCR stress results

Run `python ml/ocr-stress.py` with Pillow 13.0.0, Tesseract CLI and DejaVu Sans. The script creates temporary fictional English images, runs real local OCR, retains source/recognized text and image hashes in `ocr-stress-report.json`, then removes images. It never uploads data. This exercises CLI OCR, not the browser Tesseract.js pipeline.

24 images: four fictional forms under six rendering conditions. Clean, 2-degree rotation, blur radius 1.2 and 12-pixel text each recovered 12/12 exact expected value occurrences. Blur radius 2.5 recovered 11/12, with character error rate 0.00556. Tiny text recovered 0/12, CER 0.90556. Both repeated Aadhaar occurrences are counted independently. VID occurrence retention here measures OCR transcription only; it is not selected for redaction.

The stronger stress conditions were added after the initial mild cases produced no transcription errors. This is an exploratory stress suite, not a blind benchmark. English synthetic image results cannot substitute for authorized real scans. Kannada rendering was not run because no Kannada-capable font is installed; scoring missing-glyph images would be invalid. Existing packaged Kannada OCR data is present.

## Independent human review: ready, not completed

Create two prediction-free worklists:

```sh
python ml/annotation_review.py export /tmp/reviewer-a.json
python ml/annotation_review.py export /tmp/reviewer-b.json
```

Each reviewer independently fills reviewer_id (pseudonym is sufficient), reviewed_at, kannada_fluent, independently_annotated and document status/spans. Offsets use UTF-16 code units, end exclusive. Use existing model category identifiers. Leave unresolved rows pending. Do not consult model predictions or existing gold labels. Keep completed files local; do not commit sensitive real documents.

```sh
python ml/annotation_review.py compare /tmp/reviewer-a.json /tmp/reviewer-b.json /tmp/agreement.json
```

The tool rejects pending, duplicate, altered-source, invalid-offset and unknown-category records. It requires different reviewer IDs and at least one attested fluent Kannada speaker. It reports exact span/category agreement and disagreements for adjudication, never production approval. Self-attestation cannot verify actual independence or fluency. No human review has occurred in this task.

## Physical mobile: blocked by device availability

No Android Debug Bridge or physical phone is connected to this environment. Desktop browser viewport emulation from PR #17 is not a physical device test. Use the isolated PR #17 preview on a real Android Chrome and iPhone Safari; record device model, OS/browser version, preview build-info commit, cold/warm timing, responsiveness, foreground/background recovery, offline model failure, Kannada/English synthetic uploads, all repeated Aadhaar occurrences, manual review and export/reopen checks. Record observed crashes and OS process memory only where accessible; do not substitute JS heap for peak process memory. Never upload private documents for this test.

No physical-device result, representative real-document result or completed Kannada review is claimed. Remaining inputs: two independent reviewers (one Kannada-fluent), authorized representative samples and access to physical devices.
