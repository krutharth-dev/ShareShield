# Handwriting and mobile validation

Handwriting uses the existing pretrained local PP-OCRv5/RapidOCR models. This
release does not train a model or send documents to Azure or another document API.

## Repeatable local benchmark

After installing the backend and handwriting dependencies and preparing the model
assets, run from the repository root:

```bash
python -m backend.handwriting_benchmark --synthetic-dir /tmp/shareshield-benchmark
```

This generates clear, lightly blurred and JPEG-compressed fictional font images,
then exercises analysis and blackout export through the local API in-process.
It reports exact-value field recall separately from selected-mask ink coverage.
Expected date labels are normalized to exclude the `DOB:` prefix; phone labels
ignore spacing, but OCR character substitutions are not corrected for scoring.

The 26 October 2026 run detected **12/12 labeled fields (100%)**, with **99.60%**
aggregate sensitive-ink coverage. The examples contain name, email, phone and date
of birth fields. This is a small font regression dataset, **not real handwriting
accuracy**. No accuracy improvement to the recognition model is claimed.

Coverage counts dark source pixels inside the annotated field rectangle only when
they lie within a selected matching detection's mask (including the image
exporter's existing 3-pixel padding) and are black in the actual exported file.
This avoids mistaking already-black text for redaction. A missing detection counts
as uncovered. The remaining fraction shows why tight word masks still need visual
inspection or a broader manual mask. Export status remains `UNVERIFIED`.

The evaluator selects matches using ground-truth labels. Its score does not measure
user selection accuracy, false positives, whole-document sanitization, or regions
outside the supplied labels. Label quality also affects the result.

## Consented pen-writing evaluation

Ask volunteers to write **fictional** identifiers in different handwriting styles,
photograph them under varied lighting, and record their consent. Keep images and
labels outside Git and outside this public demo. Run locally:

```bash
python -m backend.handwriting_benchmark --manifest /path/to/fixtures/manifest.json
```

Example manifest (coordinates in the source image's pixel space; use upright,
orientation-normalized images):

```json
{
  "kind": "consented-handwriting",
  "fictional_data_only": true,
  "writers_consented": true,
  "cases": [
    {
      "image": "writer-01.png",
      "fields": [
        {"category": "email", "value": "demo@example.org", "box": [40, 80, 460, 140]}
      ]
    }
  ]
}
```

Images must stay within the manifest directory. Use tight value boxes and label
every occurrence. The output omits filenames, expected values and recognized text.
No consented pen-writing set has been supplied or evaluated yet.

## Browser regression checks

```bash
npm ci --prefix frontend
cd frontend
npx playwright install --with-deps chromium webkit
# Default interpreter: ../.venv/bin/python; override for other environments.
SHARESHIELD_TEST_PYTHON=python npm run test:e2e
```

The suite starts local Vite and FastAPI, uses fictional fixtures, and runs desktop
Chromium, Pixel-sized Chromium, 320-pixel-wide Chromium, and iPhone-sized WebKit.
It checks layout overflow, text download bytes and SHA-256, 200% zoom mask
coordinates, undo/redo, secondary-contact rejection, cancellation, review gates,
image download, and native touch-swipe scrolling in mobile Chromium. Browsing defaults to native touch pan/pinch; drawing must be
enabled explicitly. WebKit emulation is not a test on a physical iPhone or Safari
installation. Device-specific camera/file picker behavior still needs manual QA.
