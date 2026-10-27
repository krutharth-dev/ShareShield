# Manual selection and review fixes

Reproduced on the hosted demo: generate an image export, choose Export focus,
then move a manual mask. The export is invalidated but Export focus remains
selected and disabled, leaving the original hidden and the workspace empty.

- Invalidating an export now restores Original focus when necessary.
- Enabling Draw mask opens Original focus so the editing surface is visible
  and large enough to use. Export focus switches drawing off.
- Category toggles update only that category. Explicitly checked suggestions
  and unchecked findings in unrelated categories retain their selected state.
- Drawing uses the image bounds rather than its bordered frame and waits for
  decoded image dimensions. Native image dragging is suppressed during a stroke.
- File changes, rescans, page/view/zoom changes and export cancel unfinished
  strokes and release pointer capture. New analyses clear the old preview.
- Small/empty strokes and the 60-mask limit now give feedback instead of silently
  ignoring the user's action. Minimum dimensions match the API validator.
- Repeated-occurrence protection is disabled while scanning or exporting,
  including though it lives outside the disabled review fieldset.

Regression coverage includes selection preservation, drawing from Export focus,
editing after export, submitted manual regions, export-setting locking and native
Chromium touch input. Existing browser workflows cover cancellation, undo/redo,
zoom, touch panning, verification and reviewed downloads. Backend redaction and
verification policy are unchanged.

Validation commands:

```sh
npm run lint --prefix frontend
npm run build --prefix frontend
OMP_THREAD_LIMIT=1 .venv/bin/python -m pytest backend/tests -q
cd frontend && npm run test:e2e
```

Local frontend lint/build and 155 backend tests passed before release. Browser
engine downloads in the editing environment returned truncated archives; the
full browser matrix and container checks run in GitHub CI before deployment.
Physical-device behavior and general detection completeness are not certified.
