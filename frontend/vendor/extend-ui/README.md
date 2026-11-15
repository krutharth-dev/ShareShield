# Extend installation, 5 November 2026

Installed SDK: `extend-ai` 2.5.0. No production import, client instantiation, API key, external inference or upload route is enabled. SDK installation does not grant permission to send documents to Extend. A future SDK integration must be server-side, explicitly authorized and separately reviewed.

Installed Extend UI components: PDF viewer and document-viewer sidebar, with their Radix/shadcn primitives. Official installation used `shadcn@4.23.0 add @extend/pdf-viewer` and the style-aware registry (`new-york`, resolved by CLI to `new-york-v4`). Component source is vendored under `src/components`; dependencies are recorded in package-lock.json. This is a selected component installation, not installation of every viewer or support for all file formats. Tesseract.js is retained.

Source: https://github.com/extend-hq/ui and https://www.extend.ai/ui/docs . MIT license retained in LICENSE.md (includes Extend and shadcn notices). Registry source changes over time; the committed files and lockfile define this snapshot.

Local adaptations:
- React 18 composed-ref setter typing in PDFViewer (no React upgrade).
- Added missing `class-variance-authority` dependency.
- PDFium is bundled from pinned local `@embedpdf/pdfium` 2.15.1 instead of jsDelivr.
- Tailwind 4 evaluation stylesheet is separate from the main application's stylesheet.

Development evaluation:

```sh
cd frontend
npm ci
npm run extend:dev
# Open http://127.0.0.1:4176/extend-preview.html
npm run extend:build
```

The page creates a fictional one-page PDF in memory. Upload/download controls are disabled; it is a viewer evaluation, not a redaction workflow. `dist-extend` is a separate output, excluded from git and from the normal production build. The normal app does not import Extend components, SDK or evaluation stylesheet. Existing source positions, OCR, redaction and export policy are untouched.

Measured isolated build assets: PDFium WASM 4.65 MB (gzip 2.15 MB), viewer JS 984 KB (gzip 346 KB), worker JS 709 KB (gzip 124 KB), CSS 31 KB. Build emits large-chunk warnings. These costs justify keeping it outside the main app until integration is assessed.

Browser test `tests/browser/extend-viewer.mjs` loads the generated fixture, waits for one rendered page image, blocks and fails any attempted external HTTP request, and confirms local WASM loading. This does not prove all library features are network-free or establish redaction safety. Existing full application tests remain required. No production deployment or API credentials are needed for this installation.

Validation on this installation: SDK import succeeded; TypeScript, isolated build, normal app build, 162 frontend tests and Cloudflare Worker dry-run passed. Chromium 141 rendered the fictional viewer fixture with local WASM HTTP 200 and zero external requests. Existing browser upload/review/export, repeated Aadhaar/VID-policy and contextual unavailable-model tests passed. The pre-existing optional MediaPipe face-runtime CDN request failed in this environment; no face-detection availability claim is made.
