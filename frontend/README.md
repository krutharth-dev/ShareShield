# ShareShield — integrated frontend (30 October 2026)

## Current presentation/demo state

- **GitHub integration branch:** `integration/complete-shareshield` (PR #4). The default `main` branch does **not** contain the integrated application yet. Do not deploy `main` or merge unfinished PRs just to refresh the demo.
- **Cloudflare Worker:** `shareshield-hackathon` using Workers Static Assets. Cloudflare reported production deployment `123d6102-8ac4-4a0b-90ac-c436ab37238c` created at **2026-10-30 11:41 UTC**. Deployed assets cannot be judged solely by a green CI result; complete browser acceptance tests before demonstrating.
- **Application URL to verify in browser:** https://shareshield-hackathon.krutharth-dev.workers.dev/
- **Expected no-backend health response:** `GET /health` reports `mode: browser-local`, `server_processing: false`, `demo_only: true` when no `BACKEND_ORIGIN` is configured.
- **Backend:** Browser-local PDF/image/TXT/CSV workflow is independent of the optional Python FastAPI backend. No separate hosted Python processing service was verified. Do not claim that cloud-hosted OCR or multi-user server processing is running.
- **CI:** Both frontend and backend/redaction GitHub Actions passed on PR #4 at commit `a8aa86a8f3a502726059088c36361fd4e3311e56`. This confirms automated checks, not live end-to-end safety.
- **Public use:** Demonstrate with synthetic/non-sensitive test files only. Verification is scoped, not a guarantee that all private data was removed.

## Quick smoke test before presenting

1. Load the URL above in a fresh browser session. Confirm the homepage and workspace open and that `/health` returns HTTP 200.
2. Upload a **fictional** searchable PDF with a test email/phone or a printed PNG/JPEG. Confirm a masked finding appears and the document preview renders. Keep file size ≤8 MB. There is no fixed PDF page-count cap, but long or complex documents require more time and device memory.
3. Select a finding, export the redacted file, open the **downloaded file**, and confirm the sensitive test string is no longer extractable or visible. Check the report: `FLAG`, `UNVERIFIED` and `SCOPED_CLEAR` have distinct meanings.
4. Intentionally leave a synthetic secret unredacted and verify that the report does **not** claim a universal clean result.
5. Try an unsupported `.docx` file and confirm the app rejects it rather than silently claiming successful processing. Handwriting, names, addresses, QR codes and complex formatting require manual review.

If any step fails, show the verified development workflow and explain the limitation; **do not upload actual identity documents**.

## Technology and deployment

React 18 + Vite + TypeScript, PDF.js, pdf-lib, Tesseract.js and a Cloudflare Worker with static assets. The browser-local processor performs detection, manual-region removal and image-based PDF export; this may remove searchability, forms, links and signatures. Optional FastAPI can be deployed separately and connected through the server-side `BACKEND_ORIGIN` secret after authenticating and validating that service.

From the repository root:

```sh
cd frontend
npm ci
npm run typecheck
npm test
npm run build
npm run worker:check
# only after validating the deploy target and credentials:
npx wrangler deploy
```

Worker configuration: `frontend/wrangler.jsonc`; entrypoint: `frontend/worker/index.js`. Deploy from the **integration branch**, not the current `main`. Never place credentials in `VITE_*` variables.

For integration details see [INTEGRATION_CONTRACT.md](./INTEGRATION_CONTRACT.md), [audit](../docs/AUDIT.md), and [PR #4](https://github.com/krutharth-dev/ShareShield-Hackathon/pull/4).
