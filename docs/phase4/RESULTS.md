# Phase 4 execution evidence

## Provenance and CI

Draft [PR #24](https://github.com/krutharth-dev/ShareShield/pull/24), branch `feat/phase4-redaction-security-20261111`, targets `feat/phase3-ocr-reliability-20261109`. Production/main and release approvals are unchanged. The baseline Phase 3 head and its parent were checked before implementation; no unrelated unfinished changes were imported.

These saved download artifacts were produced by actual Chromium 141 on **`31a83105b1c2525c77c89f28c72b0d7ac73a9963`**. The workflow checks out the exact PR head and asserts the served build-info commit equals it. GitHub's artifact name contains the event merge SHA; that is not the tested runtime SHA. Follow-up evidence/test-only commits rerun all workflows; see the PR for the final head's checks.

| Workflow | Observed result on the artifact source commit |
|---|---|
| [Frontend tests/build/compilation](https://github.com/krutharth-dev/ShareShield/actions/runs/43136677993) | PASS |
| [Backend/redaction/verification](https://github.com/krutharth-dev/ShareShield/actions/runs/43136677932) | PASS |
| [Trained model reproducibility](https://github.com/krutharth-dev/ShareShield/actions/runs/43136677929) | PASS |
| [Browser/download/independent inspection](https://github.com/krutharth-dev/ShareShield/actions/runs/43136678006) | PASS |

The original artifact is [available from Actions](https://github.com/krutharth-dev/ShareShield/actions/runs/43136678006/artifacts/13907553313) for its configured seven-day retention. Durable copies of the fictional outputs, browser reports, independent inspections and hashes are [committed here](evidence/downloads/). [provenance.json](evidence/downloads/provenance.json) records each PDF's exact SHA-256 and the downloaded ZIP hash. No real private records were used.

## Original versus downloaded output

The source [adversarial PDF](../../frontend/tests/phase4/fixtures/adversarial.pdf) has ten repeated valid fictional 12-digit Aadhaar values on page 1 and another on a rotated/cropped page 2, source metadata/comment/attachment, exposed fictional MRN/name/address, excluded VID, and a QR/drawn avatar on page 3. [large.pdf](../../frontend/tests/phase4/fixtures/large.pdf) exercises adaptive raster scaling with a 2400 × 1600 point page.

| Actual download | Browser status | Independent selected-Aadhaar scope | Evidence |
|---|---|---|---|
| [known-unredacted.pdf](evidence/downloads/known-unredacted.pdf) | FLAG | FLAG | Ground-truth glyphs remain; zero approved masks |
| [approved.pdf](evidence/downloads/approved.pdf) | FLAG | UNVERIFIED | All 11 Aadhaar glyph regions removed; all 32 approved component/manual rectangles opaque black; human review remains incomplete |
| [manual-removed.pdf](evidence/downloads/manual-removed.pdf) | FLAG | UNVERIFIED | All 11 Aadhaar regions remain masked; 31 approved masks pass; deleted QR/avatar mask restores pixels exactly |
| [one-deselected.pdf](evidence/downloads/one-deselected.pdf) | FLAG | FLAG | First Aadhaar restored exactly; other 10 stay masked; 28 remaining approved masks pass |
| [large.pdf](evidence/downloads/large.pdf) | UNVERIFIED | UNVERIFIED | Approved mask passes; original point dimensions preserved; semantic review incomplete |

The browser's broader policy correctly flags the deliberately retained MRN. The narrower offline selected-Aadhaar report does not certify the MRN/name/address. No output above is presented as completely cleared. Test assertions also prove a narrow explicit text/object/pixel contract can return SCOPED_CLEAR when every requested check passes; OCR and human review must not be implied in that narrow scope.

All five PDFs reopen without corruption. Object inspection finds no extractable text, active form fields, annotations, attachments, sensitive metadata, JavaScript/actions, optional-content layers, hidden original images or incremental revisions. Output consists of one painted raster image per page, with all image objects accounted for. Page count, displayed orientation and page dimensions are preserved. Black-overlay source PDFs fail the strict contract. Hidden form/JS residuals and incorrect masks produce FLAG even with deliberately wrong OCR. Images associated with approved regions are checked both from rendered output and embedded image pixels.

Independent image comparison examines every original dark Aadhaar glyph pixel (font bounding-box whitespace is not an identifier). Every supplied approved rectangle is also checked in full. After mask removal/deselection, rendered pixels are exactly equal to the same region in the unmasked export. This validates reconstruction from the original rather than mutation of a previous export. The original document is retained unchanged for subsequent export.

The Phase 3 [desktop and touch-emulated exports](evidence/downloads/phase3/) were rerun: all seven expected sensitive regions had 100% glyph-component mask coverage, and VID pixels were unchanged. These are actual browser downloads, not hand-created replacement outputs.

## Adversarial coverage and honest scope

“PASS” below means the stated assertion passed, not that every document is anonymous. A source-selection test without export has no clearance status.

| Case | Expected behavior | Observed result/status |
|---|---|---|
| 1. Selectable text PDF | Selected text and source objects absent | PASS; actual browser downloads and Python tests |
| 2. Scanned image PDF | Replace image pixels, preserve pages | PASS; Phase 3 desktop/touch exports; UNVERIFIED review |
| 3. Mixed image/text | Preserve physical occurrences | Native+optical proposals retained; unit/Phase 3 coverage PASS; duplicate proposals remain possible |
| 4. Form fields | Remove source field objects and values | PASS; rebuilt full-page mask clean; hidden surviving value FLAG |
| 5. Annotations | No hidden comments; reject populated annotation output | PASS; empty `/Annots []` accepted; source icon can remain rasterized |
| 6. Embedded attachment | No original embedded files | PASS; structural inspection |
| 7. Sensitive metadata | Neutral metadata/report/filename | PASS; selected metadata absent from fresh output |
| 8. Rotation/crop | Correct displayed coordinates/orientation | Manual rotated mask PASS; automatic rotated localization unavailable, mandatory review |
| 9. Different/large page sizes | Retain displayed point sizes | PASS; mixed-size Python fixture and 2400 × 1600 browser download |
| 10. Repeated/overlapping IDs | Separate occurrences, no skipped mask | PASS; 10 automatic physical occurrences plus 1 manual rotated; overlapping manual region and undo tested |
| 11. Deliberately wrong OCR | Cannot override failed pixel evidence | PASS; FLAG |
| 12. Selected finding without coordinates | Never certify removal | PASS; UNVERIFIED; browser unresolved high candidate retained for review |
| 13. Multiple names/addresses | Separate proposals, no semantic clearance claim | Existing contextual/dedup/party-address regressions PASS; browser fictional name/address remain review. No new independently annotated multi-name recall estimate |
| 14. English/Kannada mixed | Preserve scripts/source spans/AI | Kannada browser fixture, trained-model parity and Phase 3 regressions PASS; fluent-reader signoff pending |
| 15. QR | Approved pixels removed, failed scan not safety | Manual mask PASS and deletion restores exactly; decoding completeness not established; review incomplete |
| 16. Face/photo | Mask approved pixels; unavailable detector blocks semantic clearance | Drawn synthetic avatar mask PASS; unavailable model path tested; representative real face/photo evaluation pending |
| 17. Multi-page | Preserve all intended pages | 3-page Phase 4, mixed-size backend and existing 10-page browser smoke PASS |
| 18. Cancel/retry | Cleanup and successful subsequent processing | Browser cancel/clear/retry PASS; text retry SCOPED_CLEAR. Exact halfway timing/worker heap reclamation not measured |
| 19. Re-export/deselect | Restore removed selection, retain other masks | Exact pixel equality and other 10 Aadhaar masks PASS; exposed first occurrence FLAG |
| 20. Corrupt/unsupported/oversized | Explicit error; no false clearance | Existing API validation and verifier tests PASS; invalid MIME/header/empty/corrupt/>8MB rejected, verifier UNVERIFIED |

Additional repeated different Aadhaar, Kannada digits, repeated medical/student/phone fields and multiline address regressions are retained in the frontend detection suite. They test source-span/selection behavior, not independently measured end-to-end recall for every category. VID/BID remain excluded from configured detection/selection/required verification; a 12-digit substring of a longer numeric token does not become an Aadhaar mask. Unredacted VID is still potentially sensitive.

Manual drawing, numeric coordinate adjustment, invalid resizing, deletion, overlap, undo, switching pages, purpose-change invalidation and re-export were tested. The present UI has no dedicated preview rotate/zoom editing control; rotated source pages and a touch-emulated viewport were tested. This is not a physical-device or gesture-zoom certification. Broad block selection remains an explicit manual decision.

## Performance and browser privacy

Measured once on the GitHub Actions runner; these are observations, not a capacity benchmark:

| Operation | Measured time |
|---|---:|
| Three-page analysis plus automatic export | 4.005 s total (1.335 s/page arithmetic average; stages not isolated) |
| Unredacted export plus browser verification | 2.214 s |
| Approved export plus browser verification | 2.102 s |
| Remove manual mask and export/verify | 2.299 s |
| Deselect one and export/verify | 2.969 s |
| Large-page analysis | 2.356 s |
| Large-page export plus verification | 4.235 s |

Fresh native independent inspection times are recorded per output in [independent.json](evidence/downloads/independent.json), approximately two seconds per three-page output in this local run. Browser JS used heap was 19.3 MB of 33.1 MB allocated. This excludes native PDF/image/WASM/worker allocations and is not peak process memory. PDF sizes range from 45,176 to 109,153 bytes for these fixtures. Existing contextual responsiveness tests passed in CI; no physical Android or iPhone was available.

Observed browser requests contained no document POST or external request body. One pinned CDN GET was observed for the intentionally unavailable face model path; local/session storage were empty. This is a synthetic workflow trace, not a guarantee about extensions, browser internals or all possible deployment configurations. Existing CSP restrictions and local processing are retained. Resource cleanup is verified functionally by clear/cancel/retry and URL revocation paths; physical memory erasure cannot be guaranteed. The 48 MP limit is per document, not an aggregate workspace memory ceiling.

`npm audit --omit=dev` reported zero production advisories at execution; [audit JSON](evidence/npm-audit.json) records scope/counts. This does not establish that all transitive dependencies or external model code are vulnerability-free. Backend upload validation, exception sanitization and temporary export paths were reviewed; no private document telemetry was introduced.

## Preview and release decision

Cloudflare API confirmed an isolated **preview** deployment succeeded for commit `31a83105b1c2525c77c89f28c72b0d7ac73a9963`: [cfdb0f36.shareshield-mini.pages.dev](https://cfdb0f36.shareshield-mini.pages.dev), deployment `cfdb0f36-4d7a-4462-90cd-d443a4276f0b`. Production branch remains main; automatic preview settings were not changed. Served-byte/live-UI verification of that URL remains pending because available network/browser surfaces could not reach it. Do not treat API deployment success as live acceptance. Final evidence-only follow-ups are not claimed deployed.

**Not production-ready for unrestricted sensitive-document use.** Pending: independent fluent Kannada reviewers, authorized real-document evaluation, physical devices, representative faces/photographs/handwriting/QR decoding, difficult perspective/skew/dense columns, the Phase 3 tiny missed entity and duplicate proposals, and external face-model supply-chain hardening. Unlocalized or uncertain findings stay review-only. [Phase 3 reviewer instructions](../phase3/review/README.md) and [device protocol](../phase3/DEVICE_ACCEPTANCE.md) specify evidence to collect; no approvals or results are fabricated.

Raster output deliberately sacrifices text search/accessibility, editable forms, digital signatures and vector fidelity for removal of source PDF objects. It can increase size. This work demonstrates removal for approved, correctly localized supported regions; it does not prove complete detection or destruction of the user's original file.
