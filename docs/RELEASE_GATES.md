# ShareShield X release gates

## State
This change is on a review branch based on `integration/complete-shareshield`. It has not been merged into `main` or deployed to the existing production Worker.

## Must pass before merging/deploying
- [ ] Frontend CI: install, TypeScript typecheck, Node tests, Vite build and Wrangler dry-run on exact branch head.
- [ ] Backend CI: locked Python requirements, unit and integration tests, and verifier cases on exact branch head.
- [ ] Browser acceptance with Playwright using fictional PDF/PNG/JPEG/DOCX examples.
- [ ] Inspect actual downloaded outputs, not overlay highlights; independently rasterize and scan final files.
- [ ] Demonstrate all four suspected handwriting lines when OCR confidently identifies only one.
- [ ] Confirm QR unsupported/undecoded never yields `SCOPED_CLEAR`.
- [ ] Confirm corrupt/empty OCR cannot produce automated clearance.
- [ ] Demonstrate an intentionally remaining email, Aadhaar and QR region yields `FLAG`.
- [ ] Confirm no sensitive values are displayed in error reports or committed to source.
- [ ] Run Kannada-specific printed ground-truth benchmark, document its limits; do not fabricate accuracy.
- [ ] Confirm deployed Worker version, build source and exact Git commit using Cloudflare and GitHub evidence.
- [ ] Obtain judge-feedback audio before creating quotations or timestamps; review with project owner.

## Deployment policy
No automatic or irreversible production update until all essential release gates pass. Keep the existing production Worker and integration PR intact. If a browser, model, cloud or paid dependency is unavailable, report `UNVERIFIED` rather than silently claiming success.
