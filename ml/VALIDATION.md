# Phase 2 follow-up validation

All examples are fictional. Production remains unchanged. Exact remote CI/preview results are recorded in draft PR #17.

## Local evidence

- 162 frontend unit tests passed, including conflict preservation through OCR deduplication, Worker request isolation/termination, constructor/error/timeout fallback, original source offsets, repeated Aadhaar and review-policy checks.
- Frozen-corpus test passed: 36 development / 42 holdout documents, no exact text overlap, valid UTF-16 spans, holdout SHA unchanged, every human-review status explicitly pending.
- v2 training repeated byte-for-byte; Python/JS prediction parity remains tested. Training reads only the development supplement, not the new holdout.
- TypeScript/Vite build, Worker dry-run and Pages Functions compile passed. Bundle-size warning remains.
- 33 backend/redaction tests passed; upstream Starlette/httpx deprecation warning remains.
- Full existing browser smoke passed with worker-based analysis and fresh export scans: actual text download/reopen, PDF reopening, ten-page exports, zero-selection, priority/manual masks, Aadhaar/VID scope and Unicode offsets. Optional face runtime remained unavailable and did not clear verification.
- AI/browser fallback test passed. Export reports contain the fresh contextual review check; blocked model loading marks contextual verification incomplete. Downloaded approved fictional values are absent.
- 104,029-character text performance check passed at desktop and mobile viewport (desktop CPU). Observed upload-to-findings ~436 / 422 ms, max UI heartbeat gaps ~31.6 / 27 ms, real contextual Worker created. See `performance.json`; timings are machine/sample-specific, not physical mobile benchmarks.
- Local `ps` process-memory sampling fails in this runtime. `performance.json` records `null`, not an invented RSS value. GitHub runner executes the same sampler and retains measured JSON as CI evidence when supported.

## Remote/live verification design

The push-only `contextual_live_preview` CI job targets the authorized feature branch alias. It never deploys and never targets production. It waits for `build-info.json` to identify the exact tested commit, compares SHA-256 of current HTML/runtime assets/workers/model with its fresh build, and runs full browser smoke, contextual fallback/export checks and responsiveness tests against the deployed preview. Evidence artifacts include hashes, synthetic exports and runtime measurements.

The Work runtime's direct live Playwright navigation failed; explicitly using its configured proxy returned a certificate-trust error. Certificate validation was not disabled. The GitHub-hosted live job is the intended completion route.

Passing tests and these small synthetic benchmarks does not establish complete privacy protection, independent Kannada annotation, representative real-document recall, calibrated uncertainty, or production readiness.
