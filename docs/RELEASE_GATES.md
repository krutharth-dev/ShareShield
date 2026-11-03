# ShareShield mini-project release gates

The active target is the existing Cloudflare Pages project `shareshield-mini`; see `PRODUCTION_RELEASE.md`. PR #11 and stacked PR #12 are review work, not approved production releases. Older dated hackathon evidence describes that earlier application.

## Automated evidence required on the exact release commit

- [ ] Frontend install, typecheck, candidate/policy tests and production build.
- [ ] Pages Functions compilation.
- [ ] Locked Python dependencies and backend/redaction verification tests.
- [ ] Browser acceptance and actual downloaded-byte inspection, including multi-page files, manual restore, Unicode offsets, metadata and attachment exclusion.
- [ ] Incomplete OCR/QR/face checks retain UNVERIFIED; remaining mandatory exposure yields FLAG.

## Live and human acceptance

- [ ] Pages preview final success, expected exact commit and production preserved.
- [ ] Preview input → findings → approved masks → actual exported-file preview → downloaded and reopened output.
- [ ] Mobile/keyboard review and manual region placement.
- [ ] Printed Kannada ground-truth recognition/box benchmark with clear handwriting limits.
- [ ] Authorized private-document visual acceptance where required; no genuine IDs/patient documents in commits or public demos.
- [ ] Required reviewer approvals, security findings and explicit owner release authorization recorded.

## Outstanding full-specification work

A trained multilingual classifier with held-out results, full English/Kannada UI parity, five finished tutorial videos and broad format/security acceptance remain unestablished. Do not substitute heuristic confidence, scripts or green CI for those deliverables.

Production Git builds are enabled on main. Do not merge simply because a draft preview passes. The manual production workflow has not been dispatched by this continuation.
