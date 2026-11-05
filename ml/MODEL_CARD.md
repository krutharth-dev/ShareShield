# Model card — synthetic-context-linear-v2

Experimental, manual-review-only contextual span classifier, trained from scratch with scikit-learn. No pretrained language model, calibrated probability, independent annotation or real-document privacy guarantee.

Checkpoint SHA-256: `4eea0b5ec09e69bd184df51db4686d1498ff162dc39de2334285f2881bae83db`. Size: 1724970 bytes. Stable client filename: `frontend/public/models/context-v1.json`; embedded model version is v2. Feature vocabulary, weights, bias, classes and threshold are included. Original synthetic training rows: 2,200; additional development spans: 36 (sample weight 12). Validation: 760. Test: original 760 plus separate frozen 42-document fictional holdout. No holdout reads occur during training.

Frozen holdout hybrid precision 90.625%, recall 78.378%, F1 84.058% (29 TP, 3 FP, 8 FN). This small assistant-authored set has no human/native-speaker validation. It is now a regression set; future tuning needs a new sealed test set. Original templated holdout F1 .7307 is unchanged. Full language/category/error records are in `review-results.json` and `evaluation.json`.

Intended use: suggest spans for human review alongside authoritative validators. Unquoted prose names, unfamiliar context, long lines and damaged OCR may be missed. Uncalibrated class scores are hidden; AI-only or contradictory findings require manual review. Deterministic categories/spans remain unchanged. Worker/model failures preserve deterministic detection and report incomplete contextual coverage. Fresh exported-content rechecks use the same model and cannot establish independent semantic clearance.

Local same-origin model GET only, no private-text upload or network inference. Weights are public. Training data are fictional; no identifiers authenticate a real person. Mobile hardware quality, independent human annotation, representative scanned-document recall and guaranteed privacy remain unvalidated. See README.md and ANNOTATION_REVIEW.md for reproduction and outstanding work.
