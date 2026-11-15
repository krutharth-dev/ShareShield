# Accessibility at ShareShield

ShareShield aims to make document privacy review understandable and usable by as many people as possible, including people who navigate with keyboards, screen readers, magnification, or reduced-motion preferences.

## Our target

We use **WCAG 2.2 Level AA as an accessibility design target**, not a claim of compliance or completed certification. Accessibility acceptance testing has **not** yet been independently completed.

Priorities include:
- Keyboard operability and visible focus for uploads, findings, mask selection, and export actions.
- Accessible names, descriptions, error messages, and status announcements.
- Readable contrast and text scaling without loss of function.
- Clear, non-color-only distinctions between `FLAG`, `UNVERIFIED`, and `SCOPED_CLEAR`.
- Review options that do not depend solely on precise pointer interactions or visual OCR overlays.
- Reduced-motion behavior for decorative transitions where applicable.

## Environments and limitations

The primary interface is a browser-based React application. Specific browser, operating-system, screen-reader, zoom-level, and assistive-technology combinations have **not yet been verified** and should not be described as officially supported.

Document previews, scanned PDFs, coordinate-based masks, image text, and OCR overlays may be difficult or impossible to interpret with some assistive technologies. OCR accuracy and handwriting interpretation are not accessibility guarantees. See [known limitations](docs/KNOWN_LIMITATIONS.md) and [verification contract](VERIFICATION_CONTRACT.md).

## Report an accessibility barrier

Open an [accessibility issue](https://github.com/krutharth-dev/ShareShield/issues/new) with:
- The task you were trying to complete and what prevented you from doing so.
- Browser/OS and assistive technology (if applicable).
- Reproduction steps using fictional or synthetic documents.
- Expected behavior and any safe workaround.

Please do **not** upload real identity documents, private identifiers, raw OCR results, or screenshots containing personal data. For a vulnerability or information disclosure, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

We welcome specific, reproducible feedback and will prioritize fixes based on severity and impact; no fixed response SLA is currently offered.
