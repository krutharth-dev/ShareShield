<div align="center">

# 🛡️ ShareShield

### Detect → Review → Redact → Verify → Share

**A locally hosted privacy-review workspace for PDFs, screenshots and common documents.**

**Integrated demo deployment branch:** `integration/deployable-web-app` · **28 October 2026 mini-project**

</div>

## Working full-stack application

The existing React + TypeScript dashboard is connected to a FastAPI backend, with OCR and file-format-specific redaction. **One container serves both frontend and API at the same origin**; no cloud account is required for the demo.

| Area | Implemented |
| --- | --- |
| React frontend (team) | Midnight Cyan responsive dashboard, Light/Dark/System themes, friendly guide, quick category presets, file uploads, findings checklist, preview and manual masks |
| Backend | FastAPI OCR/text detection, selected redactions, PDF/image/Office/tabular outputs |
| Detection | Email, Indian phones, format/checksum candidates for Aadhaar, PAN, IFSC, UPI and payment cards |
| Images and PDFs | Before/after preview, page navigation, user-drawn masking |
| Documents and sheets | DOCX, PPTX, XLSX, CSV and TXT inspection/export (no visual previews) |
| Verification | Independent output reinspection, PASS_SCOPED / FLAG / UNVERIFIED with JSON report and SHA-256 |
| Deployment | Multi-stage Dockerfile + localhost-bound Compose + GitHub Actions frontend/backend/container checks |

### Supported file formats

- **Images:** JPG/JPEG, PNG, HEIC/HEIF, WEBP, BMP and TIFF (output PNG)
- **PDFs:** selectable or scanned text (output PDF; OCR requires Tesseract)
- **Office:** DOCX and PPTX, Excel XLSX
- **Text/tabular:** CSV and UTF-8 TXT

Old DOC/XLS, archives, audio, video and password-protected PDFs are **not** supported. Input limit is 12 MiB; other page, pixel and complexity limits apply.

## Approved ShareShield logo (integrated)

The website now uses the **approved image-generated ShareShield icon**, optimized
as a small transparent `frontend/public/shareshield-mark.webp` asset. The
sidebar and mobile header render the actual mark beside a responsive
"Share" + cyan "Shield" wordmark. It uses the same asset in Light and Dark
themes. The source image is also available to the team separately for
presentations and future high-resolution brand exports.

## Midnight Cyan privacy command center (selected design A)

ShareShield now uses a cohesive **Midnight Blue + Electric Cyan** palette:
midnight `#0B1426`, deep-slate cards, electric cyan `#43C9F5`,
periwinkle accents and ice-blue text. **Light / Dark / System** appearance
preferences remain supported, with a coordinated pale-blue light mode.
Shieldy's animated robot and the browser favicon use the same identity.
Success (teal-green), warning (amber) and failure (rose) are separate
signals—not merely decorative cyan.

This is a visual update, **not** a change to the OCR, redaction or
verification engine. Reduced-motion support remains available.

## Live ShareShield website — Render

The publicly accessible project workspace is deployed at
**https://shareshield-demo.onrender.com** using a single Docker container
for the React UI, FastAPI, Tesseract OCR, and document-redaction engine.
No password or account is required. Render processes uploaded documents
remotely, **not on the user's device**. Use fictional or synthetic samples
only; this educational deployment has not been certified to handle real
identity documents or sensitive private files.

A successful `/health` response confirms that the service is responsive,
but it does **not** certify the accuracy of automatic redaction. The Docker
build executes `python -m backend.release_smoke` before deploying and fails
if its synthetic processing tests regress. Office and spreadsheet exports
remain `UNVERIFIED` because embedded/hidden content and metadata are not
fully sanitized.

Local macOS/Linux running remains available through the project setup
instructions. Cloudflare and Railway guides in `docs/` describe alternative
deployment paths and may reflect historical prototypes; neither is the live
Render production configuration.

## Emerald Shield premium workspace

The React application has a complete visual refresh with a collapsible premium
dashboard sidebar, real session metrics, a six-stage privacy workflow, accessible
upload/categories, and a dedicated wide document review workbench. It supports
**Light / Dark / System** themes that follow the Mac automatically and persist
the appearance choice only (never file contents). All icons are local SVG;
subtle motion respects Reduce Motion.

### Shieldy — built-in beginner helper

The bottom-right **Shieldy** bubble offers an offline FAQ, a "Start guided
tour" option, and contextual advice. It highlights the real upload, review,
page-check and export sections as users progress. Unlike a generic chat bot,
it only uses the current stage and safe counts (never document contents or
detected identity values), never calls third-party APIs, and never clicks
redact/download/acknowledgement for users.

- **Ask:** "How do I hide a face?", "What does UNVERIFIED mean?",
  "Why is download disabled?" or use the suggested question buttons.
- **Guide:** Choose file → configure & analyze → review/redact →
  inspect & acknowledge → save reviewed export.
- **Skip or close:** Both are supported at any point. The tour follows real
  application state, not fake progress.
- **No stored chats:** Replies are from a bundled FAQ; users are warned not
  to paste real personal information.

See the [Shieldy assistant documentation and acceptance checklist](docs/EMERALD_SHIELD_UI.md#shieldy-assistant--context-aware-offline-help-24-october-2026).

### Aurora Edition — more advanced, still lightweight

ShareShield now has a **premium animated document command center** with an
illustrative redaction preview, actual-processing scan glow, responsive aurora
lighting, improved hover interactions, and **⌘K / Ctrl+K** searchable commands.
The command menu opens upload, fictional demo files, the editor, verification,
privacy information and appearance controls—actual working actions, not just
decoration.

A top-bar **motion toggle** pauses decorative effects for the current tab.
macOS **Reduce Motion** always overrides animations. The hero uses entirely
fictional placeholder content; no uploaded file data appears in it. Privacy
checks and manual acknowledgement still govern downloads.

See the [Aurora design/interaction acceptance notes](docs/EMERALD_SHIELD_UI.md#aurora-edition--advanced-visual-and-motion-update-24-october-2026).

### Fun and simple, without skipping privacy checks

- **Shieldy companion:** friendly, context-aware three-step guidance that uses
  actual file/verification state—not invented success scores or analytics.
- **One-tap privacy selection:** All categories or clear selection, with
  detailed options tucked away until needed. Redaction still requires review.
- **Polished document comparison:** clearly labeled ORIGINAL / REDACTED views,
  simple next-step guidance, compact review/download checklist and lightweight
  feedback messages.
- **Privacy & safety screen:** available from sidebar or footer. It explains
  the local processing model, limits and downloaded-file handling; read the
  [prototype privacy notice](docs/PRIVACY_NOTICE.md).
- **Honest safety states:** high-risk leftovers stay blocked; the visual
  guide never calls an unverified export "completely secure".

Read the [full UI blueprint, color tokens and Mac acceptance checklist](docs/EMERALD_SHIELD_UI.md).
The local-first FastAPI/OCR/redaction/verification pipeline is unchanged.

## Smart Redaction Preferences (image + PDF + document text)

The full-stack integration includes an interactive **What would you like to
protect?** panel. Choose Aadhaar/12-digit ID/VID, name, address, DOB,
face/photo, phone/email, QR candidate, financial IDs, or other manual areas.
Detected candidates are preselected by category, and a toggle requests
redaction of all **recognized matching occurrences** across pages.

For photos and manually drawn regions on images/PDFs, choose **blackout**,
**blur** or **pixelate**. Automatically detected identity numbers, textual
identifiers and QR regions are always blacked out. Blur/pixelation are visual
effects and are *not guaranteed irreversible*. PDFs using these effects are
flattened to prevent leaving the source text layer under an overlay.

Automatic face and QR proposals use local OpenCV only, with no model downloads
or cloud calls. Detection is best-effort; unusual barcodes, names without
labels, multilingual content and small faces may be missed. Always review the
original/export and draw manual boxes. The status `PASS_SCOPED` is **not**
a certification that the whole document is anonymous.

See [workflow, limitations and demo tests](docs/SMART_REDACTION.md).
**Never upload real Aadhaar cards or personal data to a public prototype.**

## Quickest setup on your Intel Mac

With the integration branch checked out, run:

~~~bash
bash scripts/setup-macos.sh
bash scripts/check-ready.sh
bash scripts/start-demo.sh
~~~

Open http://127.0.0.1:8000/ and use **Load fictional demo file**.
System Tesseract must be installed separately for OCR. Make sample PDFs,
JPGs, DOCX, PPTX and spreadsheets using:

~~~bash
.venv/bin/python scripts/generate-demo-files.py
open demo-output
~~~

See [all requirements and official download links](docs/PREREQUISITES.md)
for the 2017/2019 Intel MacBook setup.

## Start on your own laptop

**Option A — Docker Compose (simplest integrated demo):**

~~~bash
docker compose up --build -d
docker compose ps
~~~

Open **http://127.0.0.1:8000/**. Use **Load fictional demo file**.
Stop with `docker compose down`.

**Option B — without Docker:**

Terminal 1:

~~~bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
~~~

Install the external Tesseract program if you need image/scanned-PDF OCR (macOS: `brew install tesseract`).

Terminal 2:

~~~bash
cd frontend
npm ci
npm run dev
~~~

Open **http://127.0.0.1:5173/**. The Vite dev proxy sends API calls to the Python server. For a single server without Docker, build the React app using `npm run build` from frontend/ and restart FastAPI; it then serves the compiled app at port 8000.

## Architecture

~~~mermaid
flowchart LR
    Browser["Existing React dashboard"] -->|Same origin| API["FastAPI"]
    API --> Parser["PDF, image, Office, spreadsheet parsers"]
    Parser --> OCR["Tesseract OCR (when available)"]
    Parser --> PII["Format/checksum candidate detection"]
    OCR --> PII
    PII --> Review["Human review + manual masks"]
    Review --> Export["Redacted output"]
    Export --> Verify["Reopen and rescan selected values"]
    Verify --> Browser
~~~

## Verification and privacy

A **PASS_SCOPED** result means that recognized *selected* strings were not found during the checks performed. It is **not a statement that all private data has been eliminated**. **UNVERIFIED** covers manual-only masks and incomplete coverage; **FLAG** indicates recognized selected data was still found. Review every export before sharing.

Files are uploaded only to the server you configure. The bundled Docker configuration binds to **127.0.0.1** on your own computer. Do not publicly expose this prototype with real personal data. The default local app has no per-user accounts, user isolation, anti-malware scanning or complete public-production security hardening. Optional hosted-demo mode adds shared-password access gating, which is not equivalent to audited authentication or upload isolation. Upload frameworks can temporarily spool document contents. It is not end-to-end encrypted or certified for sensitive records.

The team should review the PyMuPDF AGPL/commercial terms and all third-party licenses before distribution.

## Project resources

- [Frontend setup](frontend/README.md)
- [Backend setup and limitations](backend/README.md)
- [Cloudflare Tunnel/Containers deployment guide](docs/CLOUDFLARE_DEPLOYMENT.md)
- [Self-hosted deployment runbook](docs/DEPLOYMENT.md)
- [Scope and milestones](docs/PROJECT_SCOPE.md)
- [Security policy](SECURITY.md)
- [IP and licensing](docs/IP_AND_LICENSING.md)

**Team demo goal:** Run the full scan → select → redact → verify → download journey using *fictional examples* and honestly explain remaining limitations.

---

<div align="center">

**ShareShield — Student mini-project prototype**

*Detect. Redact. Verify. Then Share.*

</div>
