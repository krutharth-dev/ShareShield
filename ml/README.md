# Experimental local contextual recognizer

This branch trains and integrates an actual multinomial logistic span classifier in English, Kannada and mixed text. It is **not a fine-tuned transformer**, general Kannada NER, identity verification, or production readiness. Learned coefficients are fitted by scikit-learn, exported to JSON and evaluated by the same TypeScript runtime used by the application. Generic field/numeric span proposal is deterministic. Category assignment is learned. The established engine remains authoritative on overlaps.

## Reproduce

Python 3.12 and Node 24:

```sh
python -m venv .venv-ai
. .venv-ai/bin/activate
pip install -r ml/requirements.txt
OPENBLAS_NUM_THREADS=1 python ml/train.py
cd frontend
npm ci --no-audit --no-fund
npm test
npm run build
cd ..
node --experimental-strip-types ml/evaluate.mjs
```

`train.py` regenerates fictional JSONL data, fits the vocabulary on training only, trains a multinomial logistic classifier, chooses an abstention threshold using validation only, saves the checkpoint/configuration/tokenizer vocabulary in `frontend/public/models/context-v1.json`, writes environment/hash/timing/classification metrics and Python-to-JavaScript parity fixtures. The deterministic feature tokenizer uses binary Unicode character 2–4 grams around a masked span, a 96-codepoint left and 48-codepoint right context window, digit masking and whitespace collapse. No external pretrained tokenizer is involved.

2,200 train / 760 validation / 760 test examples. Template families 0–5 / 6–7 / 8–9 are disjoint across ALL languages and categories. Exact text duplicates are asserted absent. Context vocabulary intentionally overlaps across splits: these are compositional synthetic fixtures, not an unseen-vocabulary benchmark. Names, identifiers and clinical values are fictional; generated strings can coincidentally resemble real identifiers and must not be treated as assigned IDs. Some shapes are deliberately malformed. No real user/patient records were used or uploaded.

The 26 sensitive labels plus NONE cover government, financial, medical, academic, identity/contact, credentials and legal case identifiers. Existing policy categories/ranks are reused. Training values include PAN/passport/licence/card/account, phone/email/address/DOB, names/guardians, clinical diagnosis/prescription/labs, school results, staff IDs, MRN/patient IDs and negatives for organizations, public references, VID/BID and isolated numbers. Legal free prose, broad USN formats, arbitrary credential formats and personal names outside proposed fields remain largely deterministic/manual-review tasks. Coverage is not comprehensive.

## Actual evaluation

See `metrics.json` (classification given gold spans) and `evaluation.json` (end-to-end exact category **and** exact source span, per-class/per-language TP/FP/FN, precision/recall/F1, latency and every error). `challenge.json` contains 22 separately authored documents including two repeated Aadhaar occurrences, two address fields, ambiguous IDs, Kannada, OCR-like substitutions and negatives. It was not used for model fitting or threshold selection. Neither benchmark is representative of real documents.

| Set/system | Precision | Recall | F1 |
|---|---:|---:|---:|
| Held-out synthetic / deterministic | .4765 | .1298 | .2040 |
| Held-out synthetic / model | .8571 | .8077 | .8317 |
| Held-out synthetic / hybrid | .7492 | .7131 | .7307 |
| Challenge / deterministic | 1.0000 | .4706 | .6400 |
| Challenge / model | 1.0000 | .1765 | .3000 |
| Challenge / hybrid | 1.0000 | .5882 | .7407 |

The perfect gold-span classifier score is an EASY synthetic test, not general NER accuracy. The hybrid retains deterministic false positives and refuses to override overlapping rule categories, explaining why its templated exact-match score is lower than model-only. Challenge hybrid still misses 7/17 gold entities. Never present these scores as a privacy guarantee. Scores measure findings, not successful pixel redaction.

Checkpoint: 1,520,583 bytes uncompressed JSON. Actual process timings and training RSS are recorded in metrics; Node peak RSS includes the complete benchmark process. Browser memory observations, if available, are not peak device memory. Quantization and ONNX export are deliberately not claimed: the measured small linear model runs directly in JS without a WASM runtime, matrix library, paid API or network inference. No quality-measured quantization experiment was performed. Flutter could implement the same feature specification and dot products, but no Flutter integration has been validated.

## Integration and safety

A fixed same-origin GET loads weights with a five-second timeout; documents never enter a request body. Failed/invalid loads retain deterministic findings and show an explicit warning. OCR/native PDF/text/CSV/DOCX analysis passes through the hybrid adapter. All existing candidates survive unchanged; AI only adds non-overlapping spans, and exact agreement records both sources. Original UTF-16 spans are used for redaction geometry. Repeated occurrences remain distinct. VID/BID-labelled lines are not proposed, virtual ID categories remain excluded, and existing Aadhaar structural checks remain in force.

AI-only findings retain low internal selection strength and require manual review even if a caller raises that number. Their cards show no numerical AI certainty. Structural validation is independent of model output. No automatic model-based masking, priority rank changes, remote inference or architecture replacement. Export verification retains the established deterministic checks and selected-value comparisons; it does not claim independent semantic AI clearance.

## Limits / unfinished acceptance

- No pretrained multilingual transformer was downloaded or fine-tuned. Torch, Transformers and ONNX were absent initially; this is not a blocker for the trained linear model delivered here. Stronger language understanding still needs a separately evaluated model and curated data.
- No unauthorized private documents, external human-labelled corpus, native Kannada expert annotation, representative OCR image corpus, or mobile-device benchmark. These missing evaluation assets prevent broad accuracy acceptance.
- Known vocabulary is heavily reused. Unfamiliar wording, unlabelled names, long/multiline semantics and unseen institutions can be missed. Proposal limits skip lines longer than 512 characters. Missing findings are not evidence of safety.
- Confidence scores are uncalibrated. NONE abstention is not a guarantee against out-of-distribution overconfidence.
- Browser peak RSS, long-document responsiveness and mobile memory limits remain unmeasured; JS runs synchronously per page. Large-scale performance optimization requires measurement.
- Existing optional face runtime availability remains independent. Unit tests and synthetic exports do not prove complete privacy protection.

## Development baseline

Inspected main `f970169be3dded2060abaf4336d27ad191a3b843` (merged #16) and PRs #11–#14. This branch is stacked on #14 `d7fd443fc4598e8eca12850ca146e96cd6a65c15`, reusing its validator/category/offset/OCR/review code and equivalent branding/VID scope fixes. No existing draft was merged. Main, production and the hackathon repository are not modified.
