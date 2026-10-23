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
