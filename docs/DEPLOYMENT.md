# ShareShield: deployment runbook

## Scope

The integration branch packages React, FastAPI, OCR and document processors
into a **self-hosted demonstration application**. It is not security audited,
and **must not** be publicly exposed for use with real private files.

## Docker on your own computer

Prerequisites: Docker Engine + Compose plugin (or Docker Desktop).

From the repository root:

~~~bash
docker compose up --build -d
docker compose ps
~~~

Visit http://127.0.0.1:8000/ in your browser. Use the fictional demo file.

~~~bash
docker compose logs --tail=100
docker compose down
~~~

The service binds host port **127.0.0.1:8000** only and runs inside the
container as a non-root user with a read-only root filesystem. Multipart file
uploads can spool to the private ephemeral in-memory /tmp location.

## One-command local demo on macOS (no Docker needed)

See [requirements and official download links](PREREQUISITES.md). Once
Python and Node are installed:

~~~bash
bash scripts/setup-macos.sh
bash scripts/check-ready.sh
bash scripts/start-demo.sh
~~~

The app stays at http://127.0.0.1:8000/ until you press Control+C.
Generate harmless, synthetic test files with:

~~~bash
.venv/bin/python scripts/generate-demo-files.py
~~~

## Local development without Docker

Requires Python >=3.10, Node.js 22, npm, and optional external Tesseract OCR.

Terminal 1:

~~~bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
~~~

Terminal 2:

~~~bash
cd frontend
npm ci
npm run dev
~~~

Open http://127.0.0.1:5173/.

Build a single-origin server without Docker:

~~~bash
cd frontend
npm ci
npm run build
cd ..
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
~~~

Restart the Python server if the frontend/dist directory was just created.

## Verification

Run npm run build and npm run lint from frontend/. Run
python -m pytest backend/tests -v from the root with backend requirements
installed. GitHub Actions builds the frontend, runs Python tests and attempts
a Docker image build. A green CI status is required before merge.


## Selected demonstration path: Cloudflare Tunnel

The user-selected platform is **Cloudflare** for a protected, temporary
student demo. Follow [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md).

This keeps React, FastAPI, Tesseract OCR and OpenCV running together on the
Mac, while a Cloudflare Quick Tunnel provides an HTTPS `trycloudflare.com`
link. The tunnel does not make the app permanently hosted or fully isolated.
The launcher requires an exact hostname and 20+ character shared password;
only fictional files are appropriate. No Cloudflare service is live yet.

Cloudflare Pages **alone** cannot run the Python OCR backend. Cloudflare
Containers could host the complete stack later, with Workers Paid pricing
and new deployment integration. Railway and Render instructions below are
retained as alternatives.

## Alternative provider: Railway — protected educational demo

**Railway is an alternative deployment target**, not the selected Cloudflare route. Use [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for the
current step-by-step instructions, including configuring secrets inside
Railway, selecting the integration branch, setting `/health`, generating the
Railway HTTPS domain and redeploying to register its hostname.

The site **has not been deployed to Railway**. Only the repo is prepared. A
verified Railway account, chosen hosting plan and service creation are still
needed. Keep `SHARESHIELD_DEPLOYMENT_MODE=protected-demo` and an original
20+ character secret in Railway. Never upload genuine personal documents to
the public educational demo. The React app now explicitly distinguishes local
from hosted processing in its UI.

The existing Render configuration below remains as an alternative, but it is
not our selected deployment provider.

## Protected hosted demo — Render (preparation, not yet deployed)

A Render Docker Blueprint is supplied at `render.yaml`. It uses the existing
single-service Dockerfile to run the React UI, FastAPI backend, Tesseract and
OpenCV at the same origin. This section is for an **educational demonstration
with fictional files**, NOT a public production document-privacy service.

### Set up in Render

1. Push/keep `integration/deployable-web-app` up to date and do **not** merge
   prematurely.
2. Sign into [Render](https://dashboard.render.com/), create **New →
   Blueprint**, connect GitHub and select `krutharth-dev/ShareShield`.
   Configure it from the **integration/deployable-web-app** branch; Render
   must be configured to deploy that exact branch, not the old `main`.
3. Render should detect `render.yaml`, Docker runtime, Starter instance,
   port 8000 and HTTP health check `/health`. Check pricing and billing
   before confirming any paid service. If Render does not recognize the
   Blueprint in that branch, use **New → Web Service** from GitHub with
   Docker runtime, the integration branch, and environment settings matching
   `render.yaml`.
4. During Blueprint creation set **SHARESHIELD_DEMO_PASSWORD** in Render
   secrets to a unique, randomly generated **20+ character** password.
   Do not paste that password into GitHub, ChatGPT, screenshots or
   presentation materials. The username defaults to `demo` (or change
   `SHARESHIELD_DEMO_USER` in Render). This is a shared demo login, not
   individual accounts.
5. After the build, open your assigned `https://<service>.onrender.com/`
   URL, enter the username/password through the browser's built-in dialog
   and check that the dashboard, Shieldy, sample upload, scan, preview,
   redaction, verification and download all work.
6. Open the URL in a private/incognito browser to confirm that anonymous
   requests receive `401` and the actual document endpoints are gated.
7. Disable/remove the demo service after the presentation. Turn off
   unnecessary auto-deploys if edits might break your review.

### Protection and critical limitations

- `SHARESHIELD_DEPLOYMENT_MODE=protected-demo` requires a username and a
  20+ character password to **start**. All app routes are protected except
  `/health`, used by Render. HTTP Basic Auth should only be used over
  the platform's HTTPS URL. Credentials are not stored in the repository.
- In cloud mode, the API accepts HTTPS same-origin writes from the assigned
  host. Host headers are restricted to `*.onrender.com` and localhost
  (plus a separately configured plain `SHARESHIELD_PUBLIC_HOSTNAME`
  for a custom domain).
- In local mode, auth and allowed-origin behavior remain unchanged. Keep
  Mac development at `http://127.0.0.1:8000/`.
- This password gate is **not** tenant isolation, an authenticated
  user/account system, CSRF-proof authentication, rate limiting, malware
  isolation, DoS protection, privacy certification or a security audit.
  Host resource caps, memory use, processing timeouts, concurrent requests,
  uploaded files and upstream caching must still be reviewed.
- Uploaded documents go to Render servers. Hosting **is not on-device**;
  never suggest that it is. Use **only synthetic files** for demos.
- Treat the full public-facing service as **unapproved for real personal or
  regulated data**. Keep password sharing restricted to the project reviewers.

For a truly public launch handling real sensitive documents, implement the
additional security blockers listed in the next section before enabling
anonymous uploads or sharing the site widely.

## Limits and public release blockers

The public-cloud release is **not completed**. The prototype has no login,
authorization, rate limiting, malware scanning, tenant isolation, or external
penetration test. There is no HTTPS edge, and no data-retention policy.
A publicly reachable instance could expose the service to resource abuse.
Do not expose host port to 0.0.0.0 or deploy to a public host as-is.

Metadata, embedded files, spreadsheet caches/notes, Office revisions, OCR
misses and document attachments may persist; PASS_SCOPED checks selected
recognized values only. The original file is not meant to be persisted by
application code, though upload frameworks may spool multipart data to /tmp.
Do not claim end-to-end encryption, perfect detection, or verified anonymity.

Before a public launch: add authentication, tenant isolation, limits and
concurrency controls, malware isolation, HTTPS with secure host validation,
audited file storage/retention and deletion policy, security review and
licensing review (including PyMuPDF's AGPL/commercial terms).

The app has been packaged, **not deployed to a third-party hosting account**.
