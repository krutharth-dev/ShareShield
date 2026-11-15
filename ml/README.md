# Phase 2 follow-up: local contextual model v2

Status: experimental; keep draft PR #17 unmerged. This is a trained multinomial logistic span classifier, not a pretrained transformer or general Kannada NER. All source documents and annotations used here are fictional and assistant-authored. Independent human/native-Kannada review has NOT been completed.

## What changed

- Actual CPU retraining uses the original 2,200 synthetic training rows plus 36 weighted development spans. The original 760 validation rows select the abstention threshold. Neither the original 760 test rows nor new 42-document holdout is used for fitting.
- Generic quoted spans supplement field/numeric proposals, helping contextual names, addresses, diagnoses and credentials in quoted prose. This is not arbitrary unquoted-name recognition.
- A dedicated browser Worker handles hybrid recognition. Requests have IDs and a 15-second timeout; worker failure preserves deterministic findings. Each analysis/export operation terminates its worker in `finally`. No documents or predictions are logged, persisted or transmitted to a remote model.
- Conflicting AI categories are shown on the existing finding and sent to manual review. Original deterministic category, value, positions, confidence and validation are retained. No duplicate redaction mask is added. Conflict review can withhold automatic selection until the user reviews it.
- Exported text, DOCX text, reopened PDF text/metadata and exported-page OCR receive a fresh contextual scan. AI-only/conflicting residuals or an unavailable model make verification incomplete. This is a same-model recheck, NOT independent semantic verification or proof of privacy.
- The existing 16-category policy, Aadhaar occurrences, VID/BID exclusions, branding and production architecture are retained.

## Reproduce

Python 3.12 / Node 24:

```sh
python -m venv .venv-ai
. .venv-ai/bin/activate
pip install -r ml/requirements.txt
node --test ml/review-corpus.test.mjs
OPENBLAS_NUM_THREADS=1 python ml/train.py
cd frontend
npm ci --no-audit --no-fund
npm test
npm run build
cd ..
node --experimental-strip-types ml/evaluate.mjs
node --experimental-strip-types ml/review-evaluate.mjs
```

The existing URL `frontend/public/models/context-v1.json` is retained for client compatibility; the embedded version is `synthetic-context-linear-v2`. JSON includes coefficients, bias, classes, vocabulary, feature configuration and threshold. Training is from scratch; no external pretrained tokenizer or model. Feature tokenization is binary Unicode character 2–4 grams over a masked span's 96-codepoint left / 48-codepoint right context, digit masking and whitespace collapse. Model scores remain uncalibrated and are not displayed as AI certainty.

## New frozen fictional holdout

`review-baseline.json` is v1 before the follow-up. `review-results.json` is v2. Both score exact category AND exact UTF-16 span; missing/extra occurrences count separately. 42 documents contain 37 annotated entities plus negatives. Development examples are training data, so their results are not test evidence.

| System on same holdout | Precision | Recall | F1 | TP / FP / FN |
|---|---:|---:|---:|---|
| Deterministic | 0.8182 | 0.2432 | 0.3750 | 9 / 2 / 28 |
| Previous hybrid v1 | 0.9000 | 0.4865 | 0.6316 | 18 / 2 / 19 |
| Updated hybrid v2 | 0.9062 | 0.7838 | 0.8406 | 29 / 3 / 8 |

Updated hybrid by language (tiny samples, not reliable population estimates):

| Language | Precision | Recall | F1 |
|---|---:|---:|---:|
| en | 0.8421 | 0.7273 | 0.7805 |
| kn | 1.0000 | 0.8889 | 0.9412 |
| mixed | 1.0000 | 0.8333 | 0.9091 |

Full category metrics and error lists are saved in the JSON reports. The original templated holdout hybrid F1 remains .7307; the old 22-document challenge rises to .8667 but was previously inspected and must be treated as regression evidence, not a new blind test. Perfect classification given gold spans remains an easy vocabulary-reuse test and must not be presented as real-document NER quality.

## Data provenance and remaining acceptance blockers

See `DATA_PROVENANCE.md` for external dataset/model licensing research and `ANNOTATION_REVIEW.md` for the pending independent review worklist. New development/holdout examples were frozen separately before fitting, but their vocabulary overlaps and the same assistant authored both. Human reviewers, real-document/OCR samples and independent accuracy validation are unavailable in this session. No actual user/patient/government records were used.

The model still misses entities, produces false positives, struggles with unfamiliar wording/unquoted names/multiline meaning, and skips lines over 512 characters. Quotes are proposals, not proof of sensitivity. Uncertainty is uncalibrated. This is not a universal sensitive-content recognizer.

ONNX conversion and quantization are not required for this small direct-JS model and are not claimed. Flutter could port the features/weights but has not been implemented. Mobile viewport testing uses desktop Chromium CPU and is not physical-device validation. Sampled browser-process RSS is not exact peak or model-only memory. Benchmark meanings are recorded alongside measurements. Worker-unavailable fallback executes the pre-existing deterministic code on the main thread and may still block on very large documents.

No main merge or production deployment. PR #17 remains stacked on the existing development chain. Local/CI/preview validation records are in `VALIDATION.md` and the PR.

## Validation follow-up

See [calibration rejection, OCR stress evidence and reviewer/device blockers](VALIDATION_FOLLOWUP.md). Run `python -m unittest discover -s ml -p test_validation.py` for annotation and calibration guards.
