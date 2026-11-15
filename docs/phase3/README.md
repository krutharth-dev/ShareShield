# Phase 3: multilingual OCR and occurrence reliability

This development change fixes reproduced detection, localization and verification failures. It is **not a production-readiness or complete privacy claim**. Independent Kannada reviewers, authorized real-document evaluation and physical-device acceptance are still pending.

## Baseline and scope

Base: `a4c56a0e30e4c70be6e484fad58c920a462299c6`, branch `feat/validation-evidence-20261105`, including PRs #17–20. PR #20's frontend, backend, model and browser workflows all passed before this work. The baseline had 164 passing frontend tests. Only `krutharth-dev/ShareShield` was changed. Production and the retired hackathon deployment were not modified.

## Reproduced failures and implemented fixes

| Failure | Reproduction | Fix |
|---|---|---|
| A 16-digit run split after the first 12 digits becomes Aadhaar | Failing baseline unit regression | Numeric-boundary checks include line breaks; retain Verhoeff and VID exclusion |
| Standalone Kannada/English identifier label followed by a numeric row is missed | Failing baseline regression and actual synthetic scan upload | Narrow 3–11 digit next-row recognizer, explicitly review-only; rejects dates, prose and partial IDs |
| Incomplete Aadhaar is ignored when a complete occurrence exists elsewhere | Failing baseline regression and repeated-ID scanned PDF | Preserve each labelled incomplete numeric occurrence for review, without guessing digits |
| One overlapping word box merges distinct physical observations | Failing baseline geometry regression | Mutual union-area overlap of all boxes; supports different OCR tokenizations while retaining separate locations/pages |
| Partial PDF text span inherits a whole-sentence mask | Source inspection and geometry regression | Require complete exact token coverage; otherwise unlocalized/manual review; remove broad Kannada address rectangles |
| Tiny printed scans produce empty or incorrect OCR | Measured browser Tesseract baseline on downsampled fictional cards | Bounded 2× rescue replaces the second contrast pass for small glyphs; inverse per-axis coordinate mapping; no dependency added |
| Selected Aadhaar substring inside excluded VID causes a residual flag | Regression and initial export investigation | Selected-value verification excludes parsed VID spans and requires complete numeric boundaries, including normalized Kannada digits |
| OCR reads black masks as `INN`, then verifier treats uncertainty as confirmed exposure | Reopened exported first page; real Tesseract `eng+kan` | Existing manual-review policy also applies to fresh residual findings: uncertainty blocks clearance as UNVERIFIED; reliable residuals and exact selected values still FLAG |
| Analysis has no cancellation control | UI/code inspection | Abort signal through worker initialization/OCR/model waits; dispose workers/PDFs; cancel control and browser recovery regression |
| Ordinary Vite dev startup scans isolated Extend entry and fails aliases | Reproduced dev-server error | Limit default dependency entry scan to `index.html`; isolated viewer config remains separate |

The 16 priorities, trained weights, local processing and AI review-only policy remain intact. No private records were used.

## Evaluation and limitations of the numbers

`metrics.json` and `evidence/{baseline,enhanced}-sealed.json` contain measurements. The corpus has 26 fictional PNGs: 10 document templates plus three small-text variants in each of development and sealed subsets, plus two three-page image-only PDFs. Templates cover identity-style cards, marks/admission/hospital/medical/financial/application/legal forms, mild blur and repeated IDs. These are simple layouts, not a representative population sample. The two subsets share templates; all gold annotations are generated, not independent human judgments. The old 42-document holdout was not reused as a new benchmark.

The OCR/detection configuration was frozen before inspecting the sealed subset (`evaluation-freeze.json`). Subsequent changes addressed export-verifier uncertainty, cancellation and compiler narrowing, not the recognition parameters. The sealed runs were repeated after runtime refresh to retain raw evidence; this was a repeat of the same evaluation, not a fresh test set.

Located-entity scoring uses one-to-one matching with compatible category families and at least 50% value-box area coverage; redundant category aliases count as false positives. It measures localized review proposals, not exact recognized-value accuracy or automatic selection. The original deterministic arm uses raw recognized-value matching, so its localization was not established. The strongest like-for-like comparison is baseline hybrid versus enhanced hybrid. Full approved-mask pixel correctness is tested separately below.

OCR CER/WER are whitespace-normalized Unicode Levenshtein errors on the first OCR pass, compared with the gated 2× rescue pass where applicable. This is a pass-level measurement, not a gold-selected best result or concatenation of all passes. The application retains and consolidates all applicable OCR observations.

| Measure | Baseline hybrid | Enhanced hybrid |
|---|---:|---:|
| Localized proposals found | 23 | 32 |
| Missed occurrences | 10 | 1 |
| Extra/duplicate proposals | 7 | 7 |
| Precision | 76.7% | 82.1% |
| Recall | 69.7% | 97.0% |
| F1 | 73.0% | 88.9% |

Original first-pass OCR + deterministic detection: 23/33 recognized-value matches, precision 79.3%, recall 69.7%, F1 74.2% (not localized).

OCR pass CER: 6.78% → 1.04%; WER: 8.33% → 6.41%. Median full analysis: 637 → 630 ms/page.

| Language/subset | Baseline localized recall | Enhanced localized recall |
|---|---:|---:|
| English | 12/18 | 17/18 |
| Kannada | 5/8 | 8/8 |
| Mixed | 6/7 | 7/7 |
| Small-text subset | 2/6 | 5/6 |

Timing includes worker setup, model inference, preprocessing and analysis, but not export. Chromium runs on a shared host and timings are descriptive, not statistically controlled performance claims. External face assets are deliberately blocked identically in benchmark arms; face checks remain incomplete. Responsiveness is separately measured in `evidence/responsiveness.json`; a sampled process RSS is reported only when available.

## Actual browser export checks

The browser test uploads a three-page scanned PDF through `/app`, checks four separate complete Aadhaar occurrences, approves the incomplete Aadhaar and separated-ID review candidates, exports, clicks the download link and saves actual bytes. It repeats at 390×844 with touch events, a manual mask, page switching and clearing the workspace. This is desktop mobile emulation.

`tools/phase3/verify_exports.py` reopens both downloaded PDFs independently with PyMuPDF/Pillow. It checks seven expected sensitive regions across three pages, every source glyph component and its one-pixel border, empty extracted text layers, unchanged page geometry, and byte-identical VID-region pixels. Exact hashes and per-glyph coverage are in `evidence/exports/independent-pixels.json`. The existing Kannada browser regression separately covers both repeated Aadhaar values and patient number 4829107 in its reopened PNG. These checks concern known fixture regions; they do not prove unknown personal information is absent.

Statuses: FLAG means configured residual/source exposure was detected; UNVERIFIED means uncertainty or required checks remain incomplete; SCOPED_CLEAR remains limited to configured checks. The image/PDF fixtures must not become SCOPED_CLEAR because face/QR/semantic completeness is not established.

## Tests and reproducibility

Local validation: **180 frontend tests, 33 backend tests, seven annotation tests and the frozen-corpus test passed**. TypeScript, production build, Worker dry run and Pages Functions compilation passed. Browser smoke (including ten-page PDFs), Kannada export, contextual model, cancellation/retry, desktop/touch-emulated exports and isolated Extend viewer passed. Model regeneration previously reproduced the exact checked-in weights; no model weights changed.

Run unit/build/backend/model checks as in `.github/workflows/`. Browser CI now includes cancellation, phase-3 scanned-PDF exports, independent Python pixel verification and retained artifacts, in addition to existing smoke, Kannada, trained-model and Extend checks.

```sh
# Recreate fictional fixtures with the bundled OFL font (Pillow + PyMuPDF).
python tools/phase3/generate.py --font frontend/tests/phase3/fonts/NotoSansKannada.ttf --output frontend/tests/phase3/fixtures
python tools/phase3/stress.py

# On separate local Vite servers for baseline and candidate respectively:
cd frontend
MANIFEST=stress-manifest.json SPLIT=sealed TEST_URL=http://127.0.0.1:4175/app REPORT=/tmp/baseline.json node tests/phase3/benchmark.mjs
MANIFEST=stress-manifest.json SPLIT=sealed TEST_URL=http://127.0.0.1:4174/app REPORT=/tmp/enhanced.json node tests/phase3/benchmark.mjs
cd ..
python tools/phase3/metrics.py /tmp/baseline.json /tmp/enhanced.json /tmp/metrics.json
```

Use the baseline commit in a separate worktree, its own prepared OCR assets, and the same installed versions. For baseline Vite only, constrain dependency scanning to `index.html` to avoid the pre-existing Extend alias startup failure; do not change baseline processing source. Never run both servers on the same port.

New regressions are in `phase3-regression`, `source-localization`, `residual-values`, `cancellation`, and the extended `finding-dedup` tests. Existing invalid-length Aadhaar assertions now distinguish review-only incomplete values from confident 12-digit detections, as required by this task.

## Independent review, viewer and remaining work

- `review/` contains two genuinely pending blind worklists, image mapping, categories, annotation instructions and disagreement workflow. Existing PR #18 tools accept a custom source and category list; their original default remains unchanged. No reviewer annotations were fabricated.
- Extend remains the working isolated local-only demo. Its build and real-browser test are retained. Integrating it into `/app` now would require a new viewport/zoom/rotation-to-source coordinate contract and mask lifecycle; that would expand the risk surface of this OCR change. Existing viewer remains active. No external service is mandatory for the demo.
- One tiny-scan entity remains missed; extra/duplicate proposals remain. Numeric-row association is deliberately uncertain. Character-exact localization within a large PDF text item remains unavailable unless OCR provides complete tokens.
- Strong skew, rotated images, perspective distortion, dense tables and multi-column reordering are not newly solved or validated by this change. Existing PDF geometry unit tests cover PDF transforms, not comprehensive camera-scan deskew. No heavyweight browser preprocessing library was added without evidence.
- Independent fluent-Kannada review, representative authorized real records and physical Android/iPhone acceptance remain pending. See `DEVICE_ACCEPTANCE.md`.
- No new Cloudflare preview was deployed. Local production-build browser evidence and GitHub CI are the validation targets for this draft. Production merge/deploy is not authorized by this task.

Reference for the small-text experiment: [Tesseract image-quality guidance](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html). Scaling was retained because it improved measured small-text results; general rescaling/deskew claims were not assumed from that guidance.

## Publication status

The user explicitly authorized publishing this development branch and its fictional evidence on 10 November 2026. See the draft PR for its current commit and GitHub CI status. No production merge/deploy or new Cloudflare preview is included.
