# Railway — ShareShield protected demonstration deployment

**Status:** Ready to configure. **Not deployed yet.**
**Scope:** October 2026 educational mini-project demonstration using **synthetic files only**. The service runs React, FastAPI, OCR and OpenCV in one Docker container. Railway hosts and processes uploaded files remotely, so this is **not strictly on-device processing**.

## Before starting

- Use the `integration/deployable-web-app` branch of [krutharth-dev/ShareShield](https://github.com/krutharth-dev/ShareShield).
- Ensure the GitHub Actions checks for the latest revision are green.
- Sign in to [Railway](https://railway.com/) via GitHub. Connect a hosting account **only when you are ready**; no account access or charges are automatic.
- Check the [current pricing](https://railway.com/pricing). The Free/Trial tiers have small memory allowances; OCR/OpenCV may need **1–2 GB RAM** or a paid plan. Do not assume zero cost. Set an appropriate spending limit or turn off the service after the demo.
- Keep source code and shared screenshots free of real identity documents.

## Deployment from GitHub

1. In Railway choose **New Project → Deploy from GitHub repo**, authorize access to `krutharth-dev/ShareShield` if requested.
2. Choose **Add Variables** **before deploying**. This ensures the app fails closed until its shared demo password is configured. If you accidentally deploy first, the service will fail to start without the password in protected-demo mode; do not add a public domain until configured.
3. In the created Railway service open **Settings → Source** and select GitHub branch **`integration/deployable-web-app`**. Do not deploy the old `main` branch. Disable automatic deploys during the presentation if subsequent commits would be risky.
4. Keep **root directory at repository root** (not `frontend/`). Railway should detect `Dockerfile` in the root and build using it. The Dockerfile builds React, then installs FastAPI, Tesseract and OpenCV.
5. Set these **Railway service Variables** (use the dashboard's secret field for the password):

| Variable | Value |
| --- | --- |
| `SHARESHIELD_DEPLOYMENT_MODE` | `protected-demo` |
| `SHARESHIELD_DEMO_USER` | `demo` (or a different nonempty name) |
| `SHARESHIELD_DEMO_PASSWORD` | Your own **unique, random password of 20+ characters** (never commit or post it) |

**Do not manually set `PORT`**: Railway supplies its own port; the Docker start command reads `$PORT` and defaults to 8000 for local Docker. Do not set a wildcard host variable, and do not add third-party API keys.

6. Under **Settings → Networking**, choose **Generate Domain**. Railway assigns a `<name>.up.railway.app` domain and injects the `RAILWAY_PUBLIC_DOMAIN` environment variable. **Redeploy the service after generating its domain**, so the FastAPI trusted-host list picks up the assigned hostname at startup.
7. Under **Settings**, set **Health Check Path** to `/health`. Railway's probe uses `healthcheck.railway.app`, which the protected-demo mode permits. Railway considers a successful `2xx` response proof the service has started, **not** proof all document operations are safe or healthy.
8. Open your **actual assigned HTTPS URL**. Confirm that the browser requires your demo username and password. Only share these credentials privately with your authorized project reviewers. Never share screenshots showing the password.

## Verify before the October 28 presentation

- [ ] A private browser window receives `401` at `/` without credentials.
- [ ] With correct credentials, the React homepage, Light/Dark theme, Cyan styling and Shieldy helper load.
- [ ] The browser checks `/health`: `status=ok` and `ocr_available=true`. Do not advertise scanned-image OCR if OCR is unavailable.
- [ ] Load **fictional** data and test analyze → review → manual masks → redact → scoped verify → preview → acknowledge → download.
- [ ] `FLAG` must still prevent export. Test with synthetic high-risk values.
- [ ] HTTPS only; the browser's own host is the allowed Origin on POST.
- [ ] Test both desktop and phone-width views on Wi-Fi/mobile data.
- [ ] Confirm no identity documents or chat questions are stored in the repo or intentionally sent to other services.
- [ ] Disable the service after demo if continued public reachability isn't required.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| App fails at startup with credentials error | Set `SHARESHIELD_DEMO_USER` and unique `SHARESHIELD_DEMO_PASSWORD` (20+ characters) in Railway Variables; redeploy |
| HTTP 400 / Invalid host after generating a domain | Verify Railway set `RAILWAY_PUBLIC_DOMAIN`, restart/redeploy after domain creation; optionally specify the exact custom hostname as `SHARESHIELD_PUBLIC_HOSTNAME` |
| Health check fails | Confirm path `/health`, container binds `0.0.0.0:$PORT`, and access isn't blocking `healthcheck.railway.app` |
| HTTP 401 | Demo HTTP Basic Auth prompt; do not disable the authentication mode |
| HTTP 403 for file operation | The browser's HTTPS Origin must exactly match the app Host |
| Image scanning fails | Check `/health` OCR and vision flags; monitor Railway memory/CPU for OpenCV/Tesseract usage |
| Build takes too long / OOM | Verify full Docker build from root; available memory; avoid 0.5 GB tiers for OCR-heavy PDFs |

## Privacy, limitations and go-live boundary

**Do not publish this as an unrestricted personal-data redaction platform.** A shared demo password provides *access gating*, not per-user sessions, brute-force protection, rate limiting, malware protection, tenant isolation or a professional penetration test.

Uploads are processed on Railway infrastructure and file frameworks can spool data to temporary host/container storage. Logs, third-party infrastructure and resource-limit behavior require separate review. Scoped verification is not a guarantee of complete sanitization. Use fictional files exclusively for this demo.

The production release blockers in [DEPLOYMENT.md](DEPLOYMENT.md) and [PRIVACY_NOTICE.md](PRIVACY_NOTICE.md) still apply.

## Current Railway platform documentation

- [GitHub deployment quick start](https://docs.railway.com/quick-start)
- [Dockerfile deployment](https://docs.railway.com/builds/dockerfiles)
- [Generated public domains](https://docs.railway.com/guides/public-networking)
- [Environment variables](https://docs.railway.com/guides/variables)
- [Health check hostname and port](https://docs.railway.com/deployments/healthchecks)
- [Pricing and plan limits](https://docs.railway.com/pricing/plans)

Note: Railway deprecated `railway.json` / `railway.toml` config-as-code for **new** services in October 2026. We intentionally use the GitHub-connected service Settings and the existing `Dockerfile` instead of introducing deprecated configuration. For full Infrastructure-as-Code support, migrate later to Railway's maintained `.railway/railway.ts` approach.
