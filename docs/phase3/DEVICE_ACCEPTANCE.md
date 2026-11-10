# Physical-device acceptance — pending

Desktop Chromium with a 390×844 touch-capable viewport is emulation, not Android/iPhone testing. Run on a current Android Chrome device and iPhone Safari, recording OS/browser/version and available RAM:

- Load `/app`; switch English, Kannada and mixed OCR; upload the three-page fictional scan.
- Confirm every page renders and repeated Aadhaar locations remain separate. Check numeric Kannada script with a fluent reader.
- Drag a manual mask with touch, move/resize via numeric controls, change pages, and verify no coordinate drift after zoom/orientation change.
- Cancel while loading OCR, during recognition, between pages and during export; verify retry works and workers/blob URLs are released.
- Export, save to Files/Downloads, reopen in another PDF viewer and verify the known masks and unchanged VID. No output becomes safe solely because a download succeeds.
- Try JPEG, PNG, large sheets approaching the 12MP limit and a ten-page scan. Measure time, background/foreground recovery, UI responsiveness, memory pressure and browser termination.
- Test unavailable face-model/QR support and offline model cache failures: clearance must stay UNVERIFIED/FLAG.

Outstanding image-quality coverage: significant skew/rotation, perspective distortion, dense ruled tables, multi-column ordering, unfamiliar Kannada names and real clinical/academic forms. No blanket support or accuracy claim follows from the simple synthetic layouts in this PR.
