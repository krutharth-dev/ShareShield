# Independent review package — pending

Neither pending JSON file is a completed human annotation. Use two different reviewers working independently; at least one must read Kannada fluently. Do not share the generator gold, predictions, metrics or each other's responses until both submissions are locked.

1. Give reviewer A `reviewer-a.pending.json`, reviewer B `reviewer-b.pending.json`, and each `corpus.json`, `images.json`, `categories.json` and the linked fictional images. Text includes intentional label separation; inspect original pixels as well as the transcription.
2. Use category definitions in `frontend/src/category-registry.ts`, priority explanations in `frontend/src/priority.ts`, and the existing `ml/ANNOTATION_REVIEW.md`. VID/BID is excluded. Mark every physical occurrence independently, including repeated values. Uncertain names, addresses, damaged numbers and ambiguous cross-row associations remain review candidates.
3. Annotate `start`, `end` (UTF-16, end exclusive) and `category` in `spans`. Do not guess missing digits. Record uncertainty in a separate notes file; resolve before marking a document complete. For image localization record page and exact original-pixel rectangles separately; the reused comparison tool validates text spans only, not image rectangles.
4. Each reviewer fills their own identity, date, Kannada-fluency field and independent-annotation attestation. An empty/pending review cannot pass validation.
5. Run from repository root:

```sh
python ml/annotation_review.py compare review-a.json review-b.json disagreement.json \
  --source docs/phase3/review/corpus.json --categories docs/phase3/review/categories.json
```

6. A third adjudicator or the two reviewers together resolve every disagreement after independent completion. Preserve original reviews, disagreement output, final adjudication and rationale. Do not overwrite the independent submissions or present agreement as model accuracy.

All examples are fictional. Real documents require permission and local handling; do not commit their contents, annotations, screenshots or logs to this public repository.
