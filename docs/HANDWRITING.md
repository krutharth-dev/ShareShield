# Pretrained handwriting recognition (experimental)

The active handwriting mode now uses open-source PP-OCRv5 mobile detection and
English recognition models, executed by RapidOCR 3.9.2 / ONNX Runtime on the
ShareShield server. No Azure account, access code, external document API or
per-page OCR fee is required. Hosting still consumes server CPU and memory.
This is integration of pretrained weights, not training a model from scratch
and not fine-tuning on user documents.

## Using it

Enable **Handwritten document**, upload a single image (at most 4 megapixels)
or a PDF of at most two pages, and analyze. Or use **Use handwriting-style
sample**, which creates a fictional note rendered with the Caveat font.
The sample is a functional regression fixture, not actual pen handwriting or
a representative handwriting accuracy benchmark.

All findings require explicit selection. Supported pattern identifiers and
labeled names/addresses have candidates; every recognized line also has a
selectable whole-line candidate. Use manual masks for missed details or loose
word localization. General names in prose, signatures, faces, codes, cursive,
poor scans and non-English writing require special care. There is no universal
handwriting accuracy guarantee and no text-transcription editing in this version.

Exports stay UNVERIFIED. The output is reopened and reinspected with existing
local OCR, which does not independently certify handwriting removal. Inspect
every page and acknowledge limitations before downloading.

## Deployment and privacy

Docker installs the pinned runtime, downloads checksum-verified detection and
recognition models at build time, creates the fictional sample, and runs a
real-model export smoke test. Requests never download models. Missing assets
fail closed and the UI reports the model unavailable. Ordinary scans remain on
the existing Tesseract workflow.

Recognition runs in a fresh subprocess with network connections disabled,
one inference thread, bounded input dimensions and a 45-second timeout. Source
bytes and results use pipes; the worker does not write documents to disk or
print identifiers to server logs. The existing single document-work slot limits
concurrent scans. Model memory is released when the child exits. PDF pages are
processed sequentially, with a maximum raster side of 1400 pixels. Model-based
word positions are estimates, not proof that all ink lies inside the boxes.

Documents still travel to the configured ShareShield server when it is remotely
hosted. This is not browser-only or on-device processing. No Azure calls are
made by the active API, including from older clients that send Azure fields.
Legacy Azure adapter code remains for its geometry parser and regression tests,
but is disconnected from application routes. Previously configured Azure/tester
variables are unused; they do not activate any external processing.

Local setup after installing backend/requirements.txt:

```sh
python -m pip install -r backend/requirements-handwriting.txt
python -m pip install --no-deps rapidocr==3.9.2
python -m backend.prepare_handwriting
python -m backend.handwriting_smoke
```

The separate --no-deps install avoids RapidOCR pulling in GUI OpenCV alongside
our existing headless OpenCV. The companion requirements file supplies its other
dependencies. Local Mac/Windows wheel support should be checked separately; the
published Linux service is the supported deployment target for this release.

## Testing and later fine-tuning

Unit/API tests cover input limits, unavailable models, timeout/crash handling,
word coordinate scaling, labeled-name boxes, no automatic selection and honest
UNVERIFIED exports. The real-model smoke verifies synthetic handwriting-style
text recognition, actual email blackout and preservation of a public sentence.

Next accuracy work should use consented or fictional pen-written samples from
multiple writers, with accurate transcriptions and sensitive-region labels.
Keep writers separate between training and held-out evaluation; measure word
error rate, sensitive-field recall and mask coverage. Only then decide whether
fine-tuning improves the pretrained baseline. No private user documents have
been collected for training and no fine-tuning has been performed.

Sources and licenses: see THIRD_PARTY_HANDWRITING.md.
