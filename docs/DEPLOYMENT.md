# ShareShield deployment source of truth

## Current live synthetic demo

- URL: https://shareshield-demo.onrender.com
- Render service: `srv-dbebegivcj2c73cdgjjg`, free Docker web service, one instance.
- Source: `krutharth-dev/ShareShield`, branch `integration/deployable-web-app`.
- Every commit pushed to that branch auto-deploys. Review changes on a separate
  branch; explicit release approval is required before updating it.
- One container serves React and FastAPI; uvicorn binds `0.0.0.0:$PORT`.
  Render uses `PORT=10000`; localhost Docker defaults to 8000.
- Health probe: `/health`. Browser status endpoint: `/api/status`.
- Configuration: `SHARESHIELD_DEPLOYMENT_MODE=public-demo` and exact
  `SHARESHIELD_PUBLIC_HOSTNAME=shareshield-demo.onrender.com` (see render.yaml).
- No password gate or user accounts. Uploads leave the device and are processed
  on Render. Use fictional data only. HTTPS is provided by Render's edge.
- Handwriting models are downloaded and checksummed at image build time;
  inference uses an isolated short-lived worker and no external document API.
  No Azure credentials are required. See [HANDWRITING.md](HANDWRITING.md).

This is a demonstration, not approved production processing for private records.
Health and smoke-test success do not certify redaction accuracy or privacy.

## Local alternatives

Run `docker compose up --build -d`, then open http://127.0.0.1:8000.
Compose binds only localhost, runs non-root with a read-only filesystem and a
128 MiB tmpfs. Its default 2 GiB cap is for local use, not evidence of fitting
Render's 512 MiB runtime. CI explicitly tests a 512 MiB container.

For macOS: `bash scripts/setup-macos.sh`, `bash scripts/check-ready.sh`, then
`bash scripts/start-demo.sh`. Tesseract must be installed separately.
For development: install `backend/requirements.txt`, start uvicorn on
127.0.0.1:8000, then `npm ci --prefix frontend` and `npm run dev --prefix frontend`.
Vite proxies the API and handwriting fixture to the backend on port 8000.
Local handwriting additionally needs the dependencies and build preparation in
HANDWRITING.md. Without model assets, handwriting stays unavailable.

## Retired deployment paths

The password-protected Cloudflare/Railway guides were prototypes. The current
server accepts only `local` and `public-demo`; `protected-demo` is unsupported.
The old Cloudflare launcher now exits immediately instead of soliciting a
password for a nonexistent gate. Do not substitute public-demo to expose a
local server under the assumption it is password protected. Restoring a
protected hosted path requires separately reviewed authentication and approval.

## Validation and release

Run pytest, frontend lint/build, release/OCR/handwriting smokes and a clean Docker
build. CI's container checks use 512 MiB, no swap, read-only root, tmpfs, non-root
and dropped capabilities. These tests are required evidence, not guarantees for
all possible hostile documents. Document any unavailable checks.

Before release, review the branch diff and audit limitations, obtain approval
for the exact commit, then update the integration branch. Watch build tests,
wait for Render status `live`, confirm commit identity and exercise actual HTTP
upload/redaction/verification with fictional inputs. Recheck runtime errors and
memory metrics. Sampled metrics can miss transient allocation peaks.

## Remaining security boundaries

Host/Origin checks, upload byte/concurrency limits, bounded processing queues,
source-bound review tokens and OCR timeouts reduce exposure; they are not
per-user authentication, tenant isolation, malware isolation or comprehensive
DoS protection. Framework multipart uploads can spool to ephemeral temporary
storage. Documents are not intentionally retained by application storage;
in-memory review findings expire, but platform-level retention is not audited.

Manual and handwriting exports remain UNVERIFIED. Office metadata, revisions,
formulas, hidden structures and embedded content are not fully sanitized.
PASS_SCOPED covers recognized selections, not complete anonymization. Review
licenses, including PyMuPDF terms, before distributing the application.
