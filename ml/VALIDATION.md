# Local validation evidence

Executed in this Work environment; no production deployment.

- Repeated CPU training reproduced the checkpoint byte-for-byte (`cmp` succeeded); SHA-256 is recorded in `metrics.json`.
- 157 frontend unit tests passed, including model loading, invalid/unavailable fallback, Python/JS parity, ambiguity abstention, UTF-16 offsets, repeated Aadhaar retention, VID/BID exclusion and manual-review enforcement even with caller-supplied confidence 1.
- TypeScript check and Vite production build passed. Existing >500 kB bundle warning remains.
- Wrangler Worker dry run and active Pages Functions compilation passed.
- 33 Python backend/redaction tests passed; upstream Starlette/httpx deprecation warning remains.
- Existing full Playwright smoke passed: review, actual text download/reopen, zero-selection refusal, priority policies, manual regions, independently reopened PDF exports, ten-page PDF, Aadhaar/VID scope and Unicode offsets. Optional external face runtime failed to load; app preserved incomplete-verification warnings.
- Additional Playwright AI test passed on Chromium 141.0.7390.37: local model request carries no document body; trained Kannada-context candidate is review-only; two Aadhaar occurrences preserved; approved redactions absent from actual downloaded text; deliberately aborted model request preserves deterministic findings and emits fallback warning.
- `browser-metrics.json`: local model transfer 340,636 encoded / 1,520,583 decoded bytes, resource duration ~59 ms; upload-to-export ~433 ms with model and ~272 ms in fallback. Small fictional text only. Observed JS heap ~16.1 MB with model, ~11.2 MB fallback; NOT peak browser RSS, model-only allocation or mobile performance.
- `evaluation.json`: actual Node runtime exact-span/category baseline/model/hybrid evaluation, per-language/category metrics and full FP/FN examples. Test output does not establish complete privacy protection.

Remote CI and Cloudflare preview evidence belong to the draft PR; this file records local results, not an assertion of future CI success.
