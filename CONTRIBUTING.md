# Contributing to ShareShield

Thanks for helping improve ShareShield. This is a **privacy review and redaction aid**, not a guarantee that a document is anonymous or safe to share. Changes to detection, masking, OCR, and export verification must preserve that distinction.

## Before opening a change

1. Search existing issues and pull requests to avoid duplicate work. For larger changes, open a focused feature request first.
2. Work in this repository, `krutharth-dev/ShareShield`; do **not** modify the separate hackathon repository or its deployments.
3. Use a descriptive branch, keep changes small, and explain observable behavior rather than unsupported accuracy claims.
4. Never commit actual Aadhaar numbers, PANs, real identity documents, credentials, user-uploaded files, OCR text containing personal data, or sensitive screenshots. Use fictional/synthetic fixtures.
5. Privately report suspected security weaknesses per [SECURITY.md](SECURITY.md), rather than creating a public issue.

## Development

Frontend (browser-based application):

```bash
cd frontend
npm ci
npm run typecheck
npm test
npm run build
```

For local interactive development, run `npm run dev` from `frontend/`.

Backend (optional Python/FastAPI processing service):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pytest
```

Windows activation: `.venv\Scripts\activate`. Tesseract must be installed separately for OCR-related backend tests and functionality. Also check the repository-root `tests/` and GitHub Actions workflows for affected verification and browser tests.

Do not deploy Cloudflare Workers as part of a contribution unless the maintainer explicitly requests and authorizes a release.

## Requirements for privacy-sensitive changes

- Demonstrate detection, normalization, and redaction using **synthetic** valid, invalid, and ambiguous inputs.
- Include regression tests for boundary cases: 12-digit Aadhaar vs. labelled 16-digit VID, split OCR lines, multilingual text, duplicates, malformed documents, missing OCR assets, and uncertain locations where relevant.
- Verify the **exported file**, not just a preview or on-screen overlay. Test residual text, pixels, document metadata, attachments, and failure modes within the implemented scope.
- Preserve the meanings of `FLAG`, `UNVERIFIED`, and `SCOPED_CLEAR` described in [VERIFICATION_CONTRACT.md](VERIFICATION_CONTRACT.md). Never translate `SCOPED_CLEAR` into universal safety or full anonymization.
- Ensure failures are visible and actionable; missing, unsupported, timed-out, or incomplete verification cannot silently become success.
- Keep user-facing copy succinct, professional, accessible, and free of diagnostic/internal implementation commentary.

See [known limitations](docs/KNOWN_LIMITATIONS.md) and [release gates](docs/RELEASE_GATES.md) before proposing security or production-readiness claims.

## Pull requests

Use the pull request template. State what changed, which risks remain, how you tested it, and whether any privacy-related behavior or deployment configuration changed. Include sanitized screenshots only when they help reviewers; do not paste actual user data. Maintainers may request additional tests or independent export verification before merging.

## Licensing and ownership

This repository is publicly viewable, but source availability alone does **not** grant a licence to reuse it. Check the repository's current licensing status and confirm institutional/team IP and third-party dependency rights with the maintainers before redistributing code or assets.
