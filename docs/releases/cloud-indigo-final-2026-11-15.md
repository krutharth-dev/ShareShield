# Cloud Indigo final-version release candidate

The owner selected the Cloud Indigo design and the latest redaction/identifier fixes as the intended final ShareShield website/app on 15 November 2026. This is a release candidate for the existing `shareshield-mini` Pages project, not a claim of complete detection or unrestricted sensitive-document readiness.

## Exact source and integration

- Selected, tested development commit: `65f8ab0f9c45af8c53c6f1bac73d038e5b90aa2b` (PR #28).
- Current main/production commit: `f970169be3dded2060abaf4336d27ad191a3b843`.
- Current preview: https://f5817ad4.shareshield-mini.pages.dev
- Release branch: `release/cloud-indigo-final-20261115`.
- Integrates the selected development state with main's ancestry. Main's separate branding/VID changes already exist in the development state: neutral branding, VID/BID exclusion, Aadhaar priority and tests remain. The integration retains the selected application files exactly.
- Community documentation PR #29 remains separate and unmodified; it has not been merged into main.

## Available evidence

[PR #28](https://github.com/krutharth-dev/ShareShield/pull/28) records the exact-head CI runs, source/export hashes and downloadable synthetic evidence. All 196 frontend tests, backend/redaction, model reproducibility, browser acceptance and independent PDF inspection passed on the selected development commit. The release PR records its own exact-head rerun after integration.

The new ten-occurrence fixture yields ten separate review findings. Independent inspection confirms 10/10 approved glyph regions removed; deselection restores only one region and produces FLAG. Missing visual/semantic evidence still results in UNVERIFIED. Earlier Phase 4 coverage includes structures, metadata, forms, annotations, attachments, multiple pages, manual masks, rotation limitations and cancellation. No new real-document or physical-device results are claimed.

## Required release gate

The active [Protect main rule](https://github.com/krutharth-dev/ShareShield/rules/25740927) requires **one approving pull-request review** and resolved review threads, with no bypass actors. Owner preference in chat does not create a GitHub review. The release PR must obtain the required approval before merging.

The [release workflow](../../.github/workflows/cloudflare-manual-release.yml) also requires reviewed security/judge evidence and the production environment. The [release runbook](../PRODUCTION_RELEASE.md) warns that merging main can trigger Cloudflare's Git build directly. Do not merge as a way to bypass release sign-off; do not mark uncompleted review as completed or change protection/settings.

Pending human/acceptance evidence remains documented in [Phase 4 results](../phase4/RESULTS.md): independent Kannada review, appropriately authorized real-document evaluation, physical Android/iPhone testing, representative visual regions and difficult scan layouts. Automated synthetic success does not substitute for these reviews.

## Promotion and verification after approval

Use the repository's normal protected PR/release process. Keep the existing project and domain, retain local document processing and preserve all warnings/status semantics. After release, verify the canonical Cloudflare deployment SHA and public `/build-info.json`, then repeat synthetic detection, manual selection/restore, download and independent exported-file inspection against the live site. Record the previous production deployment for rollback; do not change secrets, billing, release approvals or retired services.

Production has not been changed by preparing this release candidate.
