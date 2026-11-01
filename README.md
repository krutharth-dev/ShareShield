# ShareShield — Mini Project

**Detect · Prioritize · Automatically Redact · Review · Verify**

This repository is the improved mini-project continuation of the [Tech Shodha 2026 hackathon application](https://github.com/krutharth-dev/ShareShield-Hackathon). The two codebases were initially synchronized from the experimental hackathon V2 source at commit `e5961db23b5639d071889d75cbef2e21965e8a8c` (31 October 2026). Future improvements belong **only here**; the hackathon repository and Workers are not modified.

## What this mini-project adds

- Automatically detects and attempts redaction of **confidently located High-priority** sensitive findings during analysis, then displays the actual exported-file verification status.
- Users can **uncheck** unwanted masks and regenerate a fresh redaction from the retained original. Previously exported redacted bytes cannot be reversed.
- Restores detection and redaction of **labelled 16-digit virtual IDs**, alongside 12-digit Aadhaar numbers, without treating 16-digit identifiers as partial Aadhaar values.
- Includes V2 source improvements to duplicate OCR observations, Kannada identity and address review, PDF export preview and regression coverage.
- Uncertain handwriting, unlocated candidates, poor OCR, QR codes, and incomplete checks require **manual review**; never claim total PII coverage.

## Local development

```sh
cd frontend
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

## Cloudflare deployment

Mini project Worker: `shareshield-mini` (configured in `frontend/wrangler.jsonc`). From `frontend/`, after testing: `npx wrangler deploy`. The Python/Tesseract backend is not hosted by this Worker; main OCR and redaction processing run in the **browser**, with language assets loaded as needed. Do not redirect the mini-project Worker to the hackathon Worker or alter the hackathon production deployment.

## Safety and provenance

- Use synthetic/consented documents; do not upload real IDs until privacy/security acceptance tests are complete.
- No claim of perfect OCR, irreversible anonymization across arbitrary document formats, or validated handwriting recognition.
- `SCOPED_CLEAR` covers only checks that ran. `UNVERIFIED` is not a safe-to-share result.
- The mini-project repository is **public**. Review institutional/team IP and dependency licenses before redistributing source code.
- The hackathon submission remains in a separate **private** repository.

See `docs/KNOWN_LIMITATIONS.md` and `VERIFICATION_CONTRACT.md` for technical boundaries.
