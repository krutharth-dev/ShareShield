# Cloudflare deployment choices for ShareShield

**Prepared on 24 October 2026. Not yet deployed.** All public testing must use fictional documents.

ShareShield is not a static website: its frontend is React/Vite, while the
document workflows depend on FastAPI, Tesseract OCR, OpenCV, PyMuPDF, and
native image/document libraries.

| Path | Full backend? | Hosts on Cloudflare? | Best use |
| --- | --- | --- | --- |
| Cloudflare Pages | No, frontend only | Yes | UI-only mockup, not working redaction |
| Cloudflare Quick Tunnel | Yes, routes to your Mac | No; Mac remains the compute server | **Short student demo (recommended first)** |
| Named Tunnel + Cloudflare Access | Yes, routes to Mac/server | No; origin must stay online | Repeated private demo with an owned Cloudflare domain |
| Cloudflare Containers + Worker | Yes, Docker-based solution | Yes, requires Workers Paid | Later, always-online hosting requiring new orchestration and paid resources |

Do not deploy only the frontend to Pages and claim the application works:
without same-origin FastAPI `/analyze`, `/preview`, `/redact` and `/verify`,
document processing will not work.

## Option 1: Protected Quick Tunnel (recommended for the student demo)

Cloudflare issues a temporary `https://<random>.trycloudflare.com` address.
**No purchased domain or Cloudflare account is required.** Your MacBook needs
to stay awake and connected, with the local ShareShield Python server running.
The tunnel will stop when its terminal process stops.

Quick Tunnel URLs are publicly reachable, not inherently private. We run
ShareShield in its own fail-closed password-protected mode, restrict the exact
host, reject other origins, and recommend **fictional files exclusively**.
This is not production hosting or a safe service for real IDs.

### Preparation on your Mac

Pull `integration/deployable-web-app` and check the build:

```bash
cd ~/Desktop/ShareShield
git switch integration/deployable-web-app
git pull --ff-only origin integration/deployable-web-app
bash scripts/check-ready.sh
```

Install `cloudflared` using the [official Cloudflare instructions](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
On macOS, for example, `brew install cloudflared` if Homebrew is working.
If the Mac's Homebrew installation is broken, use Cloudflare's official binary
download/alternative package-manager installation instead. Do not install
random unofficial binaries.

### Terminal A — start tunnel before the backend

```bash
cloudflared tunnel --url http://127.0.0.1:8000
```

Copy the full randomly generated `https://...trycloudflare.com` URL.
The endpoint may initially return a 502 because the backend is not started
yet; that is expected. **Keep Terminal A running.**

### Terminal B — launch ShareShield with a DEMO password

```bash
cd ~/Desktop/ShareShield
bash scripts/start-cloudflare-demo.sh https://YOUR-GENERATED-HOST.trycloudflare.com
```

Use the actual URL printed in Terminal A. The script accepts only a plain
`*.trycloudflare.com` hostname, securely prompts for a password of at least
20 characters, and starts the local FastAPI server with:

- `SHARESHIELD_DEPLOYMENT_MODE=protected-demo`
- `SHARESHIELD_PUBLIC_HOSTNAME` = exact assigned public hostname
- `SHARESHIELD_DEMO_USER=demo`
- `SHARESHIELD_DEMO_PASSWORD` = your password, entered privately

Do not add these sensitive values to GitHub or screenshots. A very long
random password is better than a shared class password. Browser HTTP Basic
Authentication is appropriate **only over the HTTPS tunnel URL**, not over
plaintext internet connections.

### Test before sending the link

1. Open the tunnel URL in a private browser window; confirm it requests
   `demo` username and the private password. Anonymous access must give
   HTTP `401`.
2. Enter credentials and confirm the dashboard and approved ShareShield logo
   load; also open the small Shieldy helper and both themes.
3. Use the *fictional demo file only*. Exercise upload, scan, findings,
   manual blackout, scoped verify, review acknowledgement and download.
4. Test a synthetic flagged value to confirm `FLAG` still blocks export.
5. Check the app from a second device while Terminal A and B are running.
6. Press Control+C in **both terminals** when finished. The temporary
   URL should become unavailable.

**Troubleshooting:**
- `400 Invalid host`: ensure the **exact** tunnel hostname was passed to
  `scripts/start-cloudflare-demo.sh`, then restart the protected server.
- `401`: enter your demo username/password. Test in a private window.
- `403` on upload: the browser must use the tunnel's HTTPS URL and match
  the assigned host exactly; do not embed this site in another website.
- `502`: backend not running or blocked; check Terminal B for errors.
- OCR failures: use `/health` only for setup checks (it does not prove
  complete redaction). Monitor memory and avoid complex PDFs.
- Quick Tunnel can be rate-limited, unstable or unsuitable for graded demos;
  retain the working offline localhost app as fallback.

**Scope boundary:** A Quick Tunnel is *not* a permanent cloud deployment.
Cloudflare passes the requests to the laptop, and the laptop's resources
perform OCR and redaction. The application only makes a best-effort
redaction; never upload real IDs via a public demo.

## Option 2: Named Tunnel + Cloudflare Access

If the team already owns a domain using Cloudflare DNS:

1. [Create a named tunnel](https://developers.cloudflare.com/tunnel/get-started/)
   under Networking → Tunnels and route `demo.yourdomain.com` to
   `http://127.0.0.1:8000`.
2. In **Cloudflare Access**, create a self-hosted application protecting the
   same hostname and allow only specific reviewer email addresses or verified
   group membership. Avoid an `Everyone` allow rule.
3. Run the FastAPI server in protected-demo mode with the exact hostname as
   `SHARESHIELD_PUBLIC_HOSTNAME` and a strong shared password, as an
   additional authentication layer. Keep the Mac/server online while using it.
4. Verify both Access login **and** the ShareShield HTTP Basic Auth gate from
   a private browser. Do not bypass the Access policy for the upload paths.

Do not publicly publish a sensitive file processing website by only creating
a DNS record or tunnel. Authentication configuration is essential.

## Option 3: Cloudflare Containers — future full cloud deployment

[Cloudflare Containers](https://developers.cloudflare.com/containers/)
can run existing Docker applications with native runtime needs. This may
eventually host ShareShield's Python OCR stack in Cloudflare infrastructure,
managed by a Worker that forwards permitted requests to a container instance.

However it is **not** a single-click Cloudflare Pages deployment. It
requires Workers Paid (currently a $5/month base plan with metered resource
billing), an appropriate container size, custom Worker/Container integration
code, strict access authentication, upload limits, testing, and monitoring.
Cold starts, compute limits, temporary data handling, and concurrent access
need validation before the site is released. Do not claim the app is
fully on-device when documents are processed in Cloudflare Containers.

We are **not** enabling a paid plan or uploading documents. Cloudflare
Containers is a future engineering option after the mini-project demo.

## Official documentation

- [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/)
- [Cloudflare Pages + React](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- [Cloudflare Containers](https://developers.cloudflare.com/containers/)
- [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/)
