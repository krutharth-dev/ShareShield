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
