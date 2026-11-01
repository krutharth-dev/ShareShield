# Cloudflare deployment control

The production Worker is `shareshield-hackathon` at https://shareshield-hackathon.krutharth-dev.workers.dev/app.

**Do not deploy branch `fix/handwriting-and-qr-verification-20261031` directly to production.** Integrate and review PR #5 into `integration/complete-shareshield`, gather the real judge recording and consented browser/security fixtures, then verify every P0 release gate in `docs/RELEASE_GATES.md`.

A manual `Cloudflare production release (manual gate)` workflow has been added. It has no automatic triggers. It only allows dispatch on the reviewed integration branch with explicit approval and GitHub environment `production` policies, plus the account-scoped GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Availability of those secrets and environment approvals is **not established**.

The workflow installs dependencies, runs type-check, unit tests, production build and Wrangler validation, deploys the exact checked-out commit, and checks the public Worker health and app endpoints. A successful HTTP response is not itself an OCR/security acceptance test; run Playwright and independent downloaded-file inspection before release. Record the Worker deployed version and compare the exact source revision independently.

No paid service is activated, no token is hardcoded, and this workflow has **not been triggered**.
