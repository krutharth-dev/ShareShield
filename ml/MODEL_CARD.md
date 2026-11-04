# Model card: synthetic-context-linear-v1

Status: experimental, review-only. Genuine supervised training from scratch; no pretrained model. Not approved for autonomous privacy decisions.

## Identity and inputs

Checkpoint SHA-256: `3aca9f3fcd1d90a0575378bf674241a8c8e69bb2fcea0889e88a3b231f71d551`. 1520583 bytes. The checkpoint contains learned weights, bias, classes, vocabulary, feature specification and validation-selected abstention threshold. Inputs are local text and candidate UTF-16 spans; Unicode character ngrams are extracted from masked context. Outputs are a category or NONE. Scores are uncalibrated and hidden in the application.

## Measured hybrid results by language

| Set | Language | Precision | Recall | F1 | TP / FP / FN |
|---|---|---:|---:|---:|---|
| held_out | en | 0.7602 | 0.7163 | 0.7376 | 149 / 47 / 59 |
| held_out | kn | 0.7277 | 0.7067 | 0.7171 | 147 / 55 / 61 |
| held_out | mixed | 0.7602 | 0.7163 | 0.7376 | 149 / 47 / 59 |
| challenge | en | 1.0000 | 0.6154 | 0.7619 | 8 / 0 / 5 |
| challenge | kn | 1.0000 | 0.3333 | 0.5000 | 1 / 0 / 2 |
| challenge | mixed | 1.0000 | 1.0000 | 1.0000 | 1 / 0 / 0 |

Tiny challenge language subsets do not support reliable language comparisons. Full class metrics and false positive/negative examples are in evaluation.json. Synthetic metrics cannot be extrapolated to real patients, identities, institutional documents or damaged OCR.

## Intended use and risks

Assist manual review alongside deterministic recognition. Do not use to certify anonymization, authenticate identities, diagnose conditions or replace source inspection. Category vocabulary repeats across training/test families; realistic prose recognition remains weak. Kannada wording was authored synthetically without native-expert validation. Models can miss identifiers or label harmless text; all AI-only findings require review. Existing deterministic candidates are never removed by AI.

## Privacy and deployment

Same-origin static JSON, local JS inference, no paid external API. No private data used for training. Runtime requires no ONNX dependency. Model weights are public, not secrets. Retraining updates the versioned checkpoint and must rerun tests/evaluation; do not promote this draft to production based on synthetic scores. Quantization, mobile benchmarks and peak browser RSS are not established. See README.md and DATA_PROVENANCE.md for reproduction and selection rationale.
