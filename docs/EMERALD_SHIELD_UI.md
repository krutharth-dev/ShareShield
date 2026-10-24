# Emerald Shield — ShareShield UI Design & Implementation Blueprint

**Version:** Student mini-project dashboard visual refresh, 23 October 2026  
**Branch:** `integration/deployable-web-app`  
**Target:** 2017 Intel MacBook Pro, macOS Ventura; self-hosted FastAPI + React/Vite.

## 1. Product personality

Emerald Shield blends a premium security SaaS visual style with an approachable
document workbench. **Balanced** means soft shadows, precise boundaries,
subtle gradients and large readable typography. **Subtle** motion means short
feedback transitions and helpful progress states, never theatrical animations.

Information architecture:

1. **Dashboard:** Actual local backend/OCR state; supported file formats; the
   number of findings from the current scan; the current verification result.
   No invented percentages, security scores or fictional usage analytics.
2. **Redact document:** Intentional file upload, format indicators, privacy
   category tiles, and optional recognized repeated-identifier handling.
3. **Review workspace:** Human-review detection list next to a larger PDF/photo
   canvas, manual mask tool, zoom, split/focused page viewing.
4. **Verification:** Report state with remaining candidate counts; comparison,
   page-review checkboxes and explicit acknowledgement.
5. **Tools:** Fictional demo file, current-session status, appearance and project
   information. Session data is not an account history.

Navigation is implemented in the existing single-page React application;
there is no new account, backend API or data persistence requirement.

## 2. Design tokens

All colors are defined as CSS variables in `frontend/src/App.css`,
supporting runtime `html[data-theme='light'|'dark']` switching.
Avoid hardcoding colors on new components.

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--sh-bg` | `#F3F8F5` | `#0C1713` | Application canvas |
| `--sh-surface` | `#FFFFFF` | `#15251D` | Cards and panels |
| `--sh-surface-2` | `#F7FAF8` | `#1A2C22` | Raised/review zones |
| `--sh-ink` | `#19362A` | `#EAF7EE` | Primary typography |
| `--sh-muted` | `#718779` | `#9DB7A6` | Secondary typography |
| `--sh-green` | `#167B53` | `#59D79A` | Accents and checked states |
| `--sh-green-light` | `#E4F3EA` | `#204D36` | Active background |
| `--sh-border` | `#DEE9E1` | `#294538` | Subtle boundaries |

Status styling uses contextual tokens: success green, caution amber,
high-risk red. Never communicate verification status solely by color.

Typography:

- **Headlines:** Manrope when locally available, then Avenir Next / system
  fallback (no internet font fetch).
- **Body and controls:** Inter when locally available, then native system UI
  font for dependable, readable display on Ventura.
- Heading scale approximately 18–53 px, body 11–14 px, metadata 9–11 px;
  sensitive detection values must still be readable and allow wrapping.
- Radius: 9–12 px on inputs/buttons, 14–17 px on cards, 24 px on hero.

## 3. Layout specification

### Desktop ≥ 1160 px

Fixed **270 px** left sidebar that collapses to **82 px**. Sticky 73 px topbar
shows breadcrumb, segmented appearance switch and real backend status.
The overview starts with an emerald gradient hero and shield illustration
built from local CSS/SVG (no remote imagery), four session metrics, a six-stage
workflow, and an accessible file dropzone. After analysis, the workspace uses
a narrower findings column and a wide document editor; detection severity and
selection are visible independently.

### Compact ≤ 1160 px

Dashboard metrics become two columns; the review list stacks above the document
workspace. At 930 px, desktop sidebar automatically presents an icon rail.

### Mobile ≤ 720 px

The sidebar is an accessible off-canvas menu with a backdrop and close control.
A theme icon switch remains available in the topbar. Document previews stack
vertically, upload tiles use two columns then one under 440 px, and the six
workflow stages wrap into two rows on the narrowest screens.

## 4. Theme logic

The only browser setting stored is `localStorage['shareshield-appearance']`.
Valid values: **light**, **dark**, and **system**. Missing/invalid storage means
**system**. The small `/theme-init.js` script executes before the
React application and applies `data-theme` immediately, avoiding a
flash of the wrong stored appearance. The script is a first-party public asset
served by FastAPI under the existing `script-src 'self'` CSP.
No unsafe inline script, external CDN font or tracking library is required.

React listens to `prefers-color-scheme` changes and updates automatically
when System is selected. The user may override it instantly. If storage is
disabled, the setting still works for that session.

## 5. Interaction specification

- **Upload:** Visible drag-over boundary and light scan animation, file limits
  maintained, clear error states, no fake percent progress.
- **Privacy tiles:** Icons, category titles, concise explanation, keyboard
  focus/checkbox semantics and selected badge; backend remains authoritative.
- **Document workbench:** Drawing toggle, original/export/split focus options,
  existing before/after slider, 100–300% zoom, mask nudge/resize/delete and
  undo/redo; supported image/PDF masking unchanged.
- **Verification:** Full-export scan with status, remaining-category counts,
  warnings, output hash. Download disabled until explicit acknowledgement
  and every image/PDF page marked reviewed.
- **Motion:** 180–250 ms focus/hover transitions and actual operation spinner;
  reduced-motion OS preference cancels animation and smooth scrolling.
- **Disabled navigation:** Review/report destinations are disabled until content
  exists. Sidebar demo action intentionally uses synthetic values.

## 6. Privacy and security acceptance requirements

- Do not store uploaded file data, extracted names, identity numbers or
  rendered thumbnails in localStorage.
- Do not request third-party external assets. SVG icons are bundled.
- No promise of fully secure / certified redaction; detection can miss
  scanned numbers, handwriting, Kannada, profiles or small QR-like codes.
- Don't turn blur/pixelate into default for identity identifiers; backend
  always blacks those out.
- Never weaken the FastAPI same-origin, CSP, anti-DNS-rebinding or
  no-store headers to support animations.
- Preserve verification report value redaction and manual page review.

## 7. Build and validation

~~~bash
cd ~/Desktop/ShareShield
git switch integration/deployable-web-app
git pull --ff-only origin integration/deployable-web-app
bash scripts/setup-macos.sh
bash scripts/check-ready.sh
(cd frontend && npm run lint && npm run build)
.venv/bin/python -m pytest backend/tests -v
bash scripts/start-demo.sh
~~~

Then manually test on **the actual Mac**:

- [ ] Follow macOS System Light and System Dark automatically.
- [ ] Override Light/Dark and reload to verify preference persists.
- [ ] Collapse and expand navigation; keyboard tab through controls.
- [ ] Resize browser/mobile viewport and test off-canvas navigation.
- [ ] Load synthetic demo; scan, choose categories and review findings.
- [ ] Try JPG and scanned PDF from synthetic generated files.
- [ ] Draw, nudge, resize, delete and undo a manual rectangle.
- [ ] Compare original/processed pages, zoom, switch focus views.
- [ ] Mark every export page reviewed, acknowledge warning, download.
- [ ] Verify audit report exposes counts/categories, not raw IDs.
- [ ] Check invalid file, missing server and unsupported OCR warnings.
- [ ] Turn on macOS Reduce Motion and ensure animations disappear.

The CI workflow verifies the code, built frontend and localhost integration,
but visual evaluation on the actual Intel Mac is still necessary.

## 8. Implementation files

- `frontend/src/App.tsx` — dashboard, controls and workflow state.
- `frontend/src/App.css` — tokenized light/dark layouts and motion.
- `frontend/src/Icon.tsx` — local inline SVG icon set.
- `frontend/public/theme-init.js` — initial theme resolution.
- `frontend/index.html` — loads bootstrap before application.
- `backend/app.py` — serves secure first-party bootstrap.
- `backend/tests/test_theme_dashboard.py` — focused regression coverage.


## Aurora Edition — advanced visual and motion update (24 October 2026)

The design now includes an advanced but self-contained command-center aesthetic,
with **no networked fonts, icon libraries, chart services or tracking**.

### Signature visual: illustrative document scan console

The emerald hero features a CSS/SVG-layered, **fictional** privacy document,
a soft aurora grid, floating review badges and animated blackout bars. This
is an illustration only; it never displays actual uploaded data.

When the user performs a real analysis or redaction request, the document
visualizer activates a bounded scanning beam and the upload area shows an
indeterminate scan treatment. These animations indicate activity **only**;
they do not fake an estimated completion percentage or claim that a document
is completely safe.

### Power-user command menu

Press **⌘K** on macOS or **Ctrl+K** on Windows/Linux, or select the magnifying
glass in the top bar. Search for these working actions:

- Open file upload or load the fictional demo.
- Open the editor and verification report when those sections are available.
- Open Privacy & safety or Appearance settings.
- Switch to Light, Dark or System appearance.

The keyboard menu supports arrow selection, Enter, Escape, Tab focus trapping,
focus restoration on close and disabled unavailable actions. It is entirely
client-side; typing into it triggers no network requests.

### Motion control and macOS compatibility

- Aurora pulse, hover effects, shield mascot, document float, small glints,
  contextual scan transitions and subtle dialog opening effects.
- A top-bar sparkle button and an appearance-panel switch allow users to
  pause/re-enable decorative animation **for the current browser tab**.
- When macOS Reduce Motion is enabled, that OS preference **always overrides**
  the app's animation setting.
- Avoid heavy canvas loops, video wallpaper and large per-frame blur operations.
  Animate mainly transform and opacity so the 2017 Intel MacBook stays responsive.
- Visuals are not evidence of successful verification. Backend status remains
  the authoritative signal.

### Updated implementation map

- `frontend/src/HeroVisual.tsx` — decorative fictional live-state scan console.
- `frontend/src/CommandPalette.tsx` — keyboard command search.
- `frontend/src/App.tsx` — theme, animation and navigation commands with real state.
- `frontend/src/App.css` — emerald aurora design, motion and mobile breakpoints.
- `backend/tests/test_aurora_ui.py` — UI, privacy and reduced-motion regressions.

### Real-device acceptance checks

1. Verify hero is beautiful in light **and** dark mode; no real content is
   shown in the fictional hero preview.
2. Press ⌘K, type "demo", choose the sample; use arrows and Enter.
3. Press Escape; keyboard focus returns to the previous control.
4. Open Settings, turn effects off; motion pauses without blocking workflow.
5. Enable macOS Reduce Motion; confirm no animations play even if app effects
   are on.
6. Scan a fictional file; the beam runs **during** actual processing and
   stops when the operation finishes.
7. Confirm blocked or unverified reports still demand appropriate inspection.
8. Check 1280×800, 1440×900, tablet and phone widths for overflow.


## Shieldy Assistant — context-aware offline help (24 October 2026)

ShareShield includes a **small collapsible helper in the lower-right corner**.
It is a deterministic, in-browser FAQ and guided tour, **not** a cloud chatbot
or large language model. Its content is maintained in
`frontend/src/shieldyKnowledge.ts`.

### Beginner experience

- Click the shield bubble ("Need a hand?") to open **Ask Shieldy** or
  **Guided tour**. It never opens a full-screen welcome modal by default.
- Ask general questions such as "How do I draw a mask?", "Which method is
  safest?", "Can I hide a face?", "Why can't I download?", and "What does
  UNVERIFIED mean?". Contextual FAQ shortcuts update as the user progresses.
- Replies are selected from reviewed, local help topics. Unrecognized questions
  get a clear explanation of the supported topics instead of a fabricated AI
  answer. Obvious email/ID/phone-like inputs receive a do-not-share warning
  and are **not repeated in the answer**.
- Start Guided Mode for a highlighted five-step flow:
  1. Choose a file or use a fictional sample
  2. Choose privacy categories, then analyze
  3. Review findings and draw masks as needed
  4. Inspect every exported page and acknowledge limitations
  5. Download the reviewed file
- Progress is derived from **actual React state**: file, analysis, output,
  verification status, reviewed page count and acknowledgement. Buttons focus
  relevant sections; they never secretly submit files or perform redaction.
- **Skip tour** returns to regular help immediately. The helper can be closed
  without stopping a guided session; its button remains accessible.

### Trust, security and privacy

- Questions and answers remain in the current browser component state.
  No chat transcript is stored in localStorage or posted to a remote model.
- Only non-sensitive status **counts and booleans** pass from the application to
  Shieldy; it is not given the uploaded file, finding values or previews.
- If output is `FLAG`, Shieldy explicitly says export is blocked. It never
  turns an `UNVERIFIED` or `PASS_SCOPED` report into a guarantee of safety.
- Manually selected findings, actual redaction, page-review checkboxes and
  download acknowledgement remain in the existing React/FastAPI workflow.
- The helper works without network access; data processing still depends on
  the configured ShareShield server when the user analyzes a file.
- Keyboard support: Escape closes the helper and focuses the launcher;
  visible focus states, polite answer announcements, reduced-motion styling,
  and narrow mobile sizing are included.

### Acceptance checklist

- [ ] On a new visit, the small helper is collapsed; click to open.
- [ ] Ask "how do I blur a face?" and "why is export blocked?"; review advice.
- [ ] Paste a fictional ID/phone value into the question; Shieldy warns
      against sharing details without repeating that value in its answer.
- [ ] Start Guided Mode; the upload section is highlighted.
- [ ] Load the fictional demo; verify the step changes to category selection.
- [ ] Analyze; verify the step advances to detection review.
- [ ] Check the export and mark pages; ensure verification and acknowledgment
      are still required before download.
- [ ] Skip the tour, reopen it, switch theme and test macOS Reduce Motion.
- [ ] Test `FLAG` and `UNVERIFIED` states with synthetic test documents.
- [ ] Confirm Ctrl/Command+K command menu and Shieldy coexist without
      keyboard-focus problems on desktop and mobile.
