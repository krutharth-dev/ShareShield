# ShareShield: privacy detection scope and acceptance ledger (2026-11-01)

## Safe scope of this increment
This change adds **deterministic, context-labelled** medical, academic, financial and bilingual review candidates. These rules are not trained artificial intelligence; a pattern or checksum does not verify someone's identity, account, bank, or patient registration. A high-priority privacy assistant must not silently claim a clean document if an uncertain region is left unreviewed.

The original **16 ordered base categories** remain unmodified. New subtypes are mapped into the existing High/Medium/Low policy, with explicit manual-review paths for ambiguous records. The selected sharing purpose continues to determine disclosure decisions. High-priority automatic selection is limited to confidently detected, spatially localizable, non-review fields.

## Current supported incremental categories
- English/Kannada labelled patient ID, medical record number, patient name, diagnosis, lab results, clinical notes and medical procedures.
- Labelled university admission/registration/exam IDs; USN-shaped tokens are review-only unless independently confirmed.
- Labelled payment card candidates with Luhn check, and IBAN candidates with MOD-97 check; both remain review-only. Checksum validity is **not** authentication.
- Labelled emergency contact, insurance policy, vehicle registration and international telephone candidates; international phone metadata checks are **not** implemented.
- Source character offsets preserved to enable spatial association through existing OCR text geometry; image accuracy is not validated by these text-only tests.

## Open mandatory work from the full project specification
- **Trained multilingual model:** Not trained, fine-tuned, packaged or integrated. Requires an appropriately licensed annotated English/Kannada corpus, non-leaking train/validation/test split, compute, model-card evidence, measured recall, browser-runtime performance and local inference.
- **Complete UI translations:** Existing partial language switching is not a full English/Kannada internationalization architecture. Translation parity and state-preservation must be independently tested.
- **OCR and true redaction benchmarking:** Printed Kannada CER/WER, held-out entity recall, source box quality, QR/face coverage and independently inspected exported bytes remain unverified here.
- **Tutorials:** See TUTORIAL_PRODUCTION_GUIDE.md for five scripts and recording instructions; MP4 recordings are not produced by this increment.
- **Cloudflare preview:** A branch preview can be accepted only after Cloudflare reports a successful build and its exact commit matches this branch. Never replace production just to test.
- **Future Flutter:** Keep a stable exchange schema (category, text offsets, page, boxes, policy reason, confidence type, verification status). The browser OCR implementation is not portable as-is.

## Required safety acceptance
Use exclusively fictional or specifically authorized samples. Never log extracted identifiers or documents. Validate each exported file, not just a drawn black overlay. FLAG means residual detected data; UNVERIFIED means checks incomplete; SCOPED_CLEAR means only stated checks passed. Real patient and identity materials must not be used in public demos. Do not merge until CI, browser export acceptance, Kannada OCR benchmarks and the documented security gates pass.
