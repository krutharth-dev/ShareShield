# ShareShield Prototype Privacy Notice

**Last reviewed:** October 25, 2026
**Scope:** ShareShield student mini-project, as run with the bundled React
frontend and FastAPI server on `http://127.0.0.1:8000`. This is a
technical privacy notice for an educational prototype, **not** a legally
reviewed public-service privacy policy.

## 1. What ShareShield does

ShareShield helps you inspect a file, identify supported privacy candidates,
choose what to redact, manually mask images/PDFs, and recheck the export. It
supports user-initiated uploads only. This mini-project version **does not**
read WhatsApp, Gmail or other applications in the background and does not
automatically intercept file shares.

## 2. Information processed

When you select a file, the browser sends its contents to the configured
ShareShield server using same-origin `/analyze`, `/preview`, `/redact`
and `/verify` requests. Depending on the document, processing may expose
names, addresses, identity/financial candidates, contact details, images,
face/QR proposals, document structure and other content contained in that
file. The frontend displays finding values so you can choose individual
redactions; viewers of your screen can therefore see the original details.

The server processes submitted file bytes in request memory and returns
findings, previews and exports. The current implementation does not add a
database, account history, user-identification records, telemetry or
application-level document retention storage. Avoid treating this as a
guarantee against operating-system swapping, browser storage/caching,
application crashes, logs configured by a different deployment or backups.

## 3. Processing location and third parties

The **bundled demo** listens at `127.0.0.1:8000`; in that configuration
files are sent from the local browser to the local FastAPI process. OCR uses
the Tesseract executable; visual proposals use local OpenCV, with other
document processing libraries also running on the configured server. The
standard scan does not send documents to external AI services. Optional
handwriting mode now uses pretrained open-source models on this same server.
Model assets are fetched during deployment; recognition subprocesses have
network connections disabled. Documents are not sent to Azure or another
external handwriting API by the active application routes. All handwriting
exports remain UNVERIFIED and require visual review. The app uses locally
bundled icons instead of remote asset CDNs.

**Hosting matters.** If the service is exposed on a remote server, uploaded
documents travel to that server. Claims about strict on-device processing
would no longer be accurate. A public internet deployment would require
separate security, hosting, privacy and legal review.

## 4. Retention, browser settings and downloads

- Selected file data, analysis responses, previews and generated results
  are maintained in the current browser session; reloading/closing the tab
  clears ordinary in-memory application state. Downloads are files on
  the user's computer and remain there until deleted.
- Shieldy, the optional in-app helper, uses **locally bundled, rule-based FAQ**
  responses and only receives workflow status/counts (not file bytes,
  extracted personal details or previews). Typed help questions and answers
  remain in the current browser component memory; the helper does not send
  chat prompts to an external AI API or store a chat history. Avoid entering
  real personal identifiers or document content into its question field.
- The only deliberate localStorage setting in this frontend is
  `shareshield-appearance` (`light`, `dark`, `system`).
- The FastAPI server responds with `Cache-Control: no-store` and a
  restrictive security-header policy. This does not control all possible
  browser extensions, operating-system utilities or downstream tools.
- In the bundled demo there is no server database with an account-based
  deletion function; the user can clear the current browser session or
  remove downloaded files.
- The application does not deliberately store uploaded file contents in
  browser localStorage or cookies.

## 5. Accuracy, security and user choices

- No automated detection can find every private detail. OCR can miss
  handwritten, noisy, tiny or multilingual text, as well as photos, codes,
  diagrams, metadata and unusual file structures.
- `PASS_SCOPED` means only that the implemented checks found no supported
  leftovers in the specific inspection; it is **not a certificate** of full
  privacy or regulatory compliance. `UNVERIFIED` calls for review;
  `FLAG` blocks the export through the local demo.
- Native PDF blackouts attempt to remove underlying content. Blur and
  pixelation are weaker for privacy and may not be irreversible.
- Choose which categories and findings to redact, add manual masks where
  applicable, review each export page, and acknowledge the limitations
  before download. Do not share a file with unresolved sensitive content.
- Use **fictional files for demonstrations**. Never record or publish a
  real identity document, readable financial details or someone else's
  personal data without appropriate authorization.

## 6. Safety and operating boundaries

This student prototype restricts trusted local hosts, cross-origin uploads,
file size and input types, and adds restrictive HTTP security headers.
These mitigations do not make it an audited document sanitization or secure
public-hosting platform. Keep the service bound to loopback for demos,
avoid giving untrusted people access to the machine, and don't expose it
on the public internet.

## 7. Contact, rights and deployment-specific disclosures

No verified legal entity, controller identity, contact inbox, public domain
or retention schedule has been supplied for this project, so this notice
does not invent one. Before collecting other people's documents in any
real deployment, the project team must add confirmed organizational contact
information, identify the responsible data controller, define retention and
deletion rules, evaluate applicable laws and arrange appropriate review.

For the local prototype, the practical user controls are: refrain from
uploading, clear the selected file/session, choose redactions, stop the
local server and delete downloaded exports.

---
**Implementation references:** `backend/app.py`,
`frontend/src/App.tsx`, `frontend/public/theme-init.js`,
`docs/SMART_REDACTION.md` and `docs/EMERALD_SHIELD_UI.md`.
