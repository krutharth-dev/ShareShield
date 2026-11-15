# Cloud Indigo visual refresh

User-selected option 2, based on the Aadhaar validation follow-up (PR #26). This branch changes presentation only: a light blue/lavender/ice-blue gradient (`#F0F4FF`, `#EDE9FE`, `#E0F2FE`), indigo actions (`#4F46E5`), dark text and white document panels.

The theme is isolated in `frontend/src/cloud-indigo.css`, loaded after the existing component styles. It covers landing content, workspace controls, findings, the export report, manual-edit inputs and priority/guide dialogs. Mobile controls wrap rather than overflowing. Required-review/error states retain amber/red, scoped clearance retains green, and source preview markers retain their existing meaning. No document pixels, processing, category policy, selection or validation rules are changed. The previous copy cleanup is inherited.

Local validation: 188 frontend tests and production build passed. Browser CI checks 1440px desktop and 390px touch-emulated layouts, horizontal overflow, keyboard navigation/dialog dismissal and white document surfaces. It retains screenshots of the landing page, empty workspace, populated review and priority dialog as `theme-evidence` in the normal browser artifact. The existing full OCR/redaction/export/independent PDF inspection suite also runs. Screenshots and exact-head results are linked from the draft PR after review.

No physical mobile-device result is claimed. No production release or deployment is included. The visual change does not resolve pending real-document, difficult-OCR or human-review acceptance.
