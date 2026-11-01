# OCR benchmark run — 31 October 2026

## What was actually tested
A local preliminary Tesseract smoke test on **four generated fictional printed images**, each using an original and an enhanced-contrast image. Two were English and two Kannada. Printed samples only: *no handwriting*, no real ID cards, no legal-case files, no photograph/sensitive-field evaluation and no representative holdout dataset.

| Language | Condition | Original CER | Enhanced CER | Original WER | Enhanced WER |
|---|---|---:|---:|---:|---:|
| English | Clean | 0.000 | 0.000 | 0.000 | 0.000 |
| English | Rotated, resized and blurred | 0.000 | 0.000 | 0.000 | 0.000 |
| Kannada | Clean | 0.000 | 0.000 | 0.000 | 0.000 |
| Kannada | Rotated, resized and blurred | 0.020 | 0.020 | 0.125 | 0.125 |

The extra preprocessing pass **did not improve these particular images**. This may change on uneven illumination or noisy documents; image enhancement must be evaluated rather than assumed superior. These metrics have an extremely small denominator and must never be used as marketing claims or as a quality gate for sensitive-data handling.

## Additional English + Kannada mixed-script comparison
Two further fictional mixed-script images were rendered (clean and blurred/shadowed/skewed). All engines received identical images, with English-only, Kannada-only and combined Tesseract language selection.

| Language choice | Clean CER | Degraded CER | Clean WER | Degraded WER |
|---|---:|---:|---:|---:|
| eng | 27.55% | 27.55% | 45.45% | 45.45% |
| kan | 60.20% | 57.14% | 63.64% | 63.64% |
| eng+kan | 2.04% | 2.04% | 9.09% | 9.09% |

Measurements above use original pixels. Contrast enhancement did not improve the combined-language result in this tiny pilot. These results **do not validate general language detection, handwriting recognition or sensitive-field recall**. The test is intentionally artificial: the correct scripts and neat fonts were used.

## Reproduce and extend
`python tools/ocr_benchmark.py path/to/consented-manifest.json --output local-results.json`

The manifest holds records with `image` (corpus-relative path), `truth`, `language` (`eng`, `kan`, or `eng+kan`) and optional `split`. Keep test data outside GitHub when it contains real identifiers. The local run used installed Tesseract English and Kannada packs and separate English / Kannada fonts.

## Candidate engine research (not integrated)
- **Arjuna OCR Kn+En:** A third-party printed Kannada/English layout-aware ONNX model is described by its maintainer. Its published evaluation numbers are self-reported and were not independently tested here. Inspect packaging, dependencies, GPU/CPU needs, and layout-model licensing before use. Not an established handwritten-language solution.
- **Tesseract:** Available in current browser application, but handwritten English/Kannada reliability is **not established**.
- **Google Cloud Vision:** Latin handwriting is listed as supported. Kannada-script handwriting is not listed under its supported handwriting scripts at the time of research, so do not claim Kannada handwriting accuracy based on that product.
- **Kannada character classifiers:** Academic character-level results do not validate complete handwriting lines, word order, identity-field recognition or privacy-grade recall.

References: https://huggingface.co/anandkaman/arjuna-ocr-kn-en ; https://docs.cloud.google.com/vision/docs/languages ; https://github.com/SubhrajyotiSen/KannadaHandwritingRecognition

## Still required
Benchmark genuine labelled printed English, Kannada and mixed scripts under the same holdout images and compute per-field recall, image-box coverage and independent exported-file leak rate. Collect consented or synthetic handwritten Kannada and English line images. If the model cannot reliably read them, remain in manual-review mode and report `UNVERIFIED`.
