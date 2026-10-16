# ShareShield

**Detect. Redact. Verify. Then Share.**

> **Status:** Planning and repository setup. Development begins 19 October 2026. This is not yet a finished application.

ShareShield is a privacy-focused document review and redaction project. It aims to help people identify selected sensitive information, review it, remove it from a copy of a supported file, and **inspect the exported copy** for residual information before sharing.

## The problem

A black box drawn over an identifier can make it appear hidden while the original text remains searchable, copyable, or otherwise present in the file. ShareShield's distinguishing research focus is the **post-export verification step**, alongside user-controlled redaction.

## Mini-project scope — demo on 28 October 2026

The first demonstration is planned as a **locally hosted web application**: documents are selected from the user's laptop and processed by a local service, not uploaded to a public cloud.

Planned workflow:

1. Select a **searchable English PDF** or a **text-based .pptx** presentation.
2. Extract supported text and flag configured ID/email patterns.
3. Show detections and let the user choose what to remove.
4. Apply actual content redaction or text replacement to a **new copy**, retaining the original.
5. Reopen the saved copy and check for selected sensitive values.
6. Report **PASS**, **FLAG**, or **UNVERIFIED** with the checks performed; allow verified output to be downloaded.

**Priority:** A robust searchable-PDF workflow is the minimum demo commitment; PPTX is a planned extension subject to testing. Image-only PDFs, OCR, text inside pictures, embedded files, complex presentation structures, and broader leak checks are not assumed to be supported in version 1.

**PASS is not a claim of complete safety:** It means selected values were not detected by the checks actually completed. Failed or incomplete required checks must not be represented as passing.

## Intended development stack

| Area | Planned technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Local API | Python, FastAPI |
| PDF operations | PyMuPDF (licensing review required before distribution) |
| PPTX operations | python-pptx |
| Initial detection | Configurable rules and regular expressions |
| Version control | Git and GitHub |

Technology choices can change as compatibility, evaluation, and licensing are checked. No source code or installable application is included yet.

## Development milestones

| Date | Target |
| --- | --- |
| 16–18 Oct 2026 | Repository, prerequisites, and fictional test materials |
| 19–22 Oct | Frontend/backend foundations; PDF detection and review |
| 23–25 Oct | PDF redaction and verification; attempt PPTX support |
| 26 Oct | Validation, bug fixes, documentation |
| 27 Oct | Freeze, backup and rehearsal |
| **28 Oct** | **Mini-project demonstration** |

## Future major-project direction

Explore Android/iOS applications with on-device processing, OCR, visual and face redaction, and user-initiated share-sheet or authorized app integrations. Mobile operating systems do **not** provide unrestricted access to monitor every WhatsApp, Gmail, or other-app upload in the background. Supported sharing integrations must be evaluated per platform.

## Repository documents

- [Prerequisites](docs/PREREQUISITES.md)
- [Scope and milestones](docs/PROJECT_SCOPE.md)
- [Collaboration guidelines](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [IP and licensing considerations](docs/IP_AND_LICENSING.md)

## Privacy and responsible development

Use **fictional or explicitly authorized** sample documents only. Do not commit real identifiers, private user documents, generated redacted exports, credentials, or processing logs. Verification outcomes must document the limitations of completed checks.

## Rights and license

This repository is private and **has no public software license at present**. No permission for general reuse or redistribution is granted by the absence of a license. Ownership, college policies, contributor agreements, and dependency licenses require review before public release. See [IP and licensing](docs/IP_AND_LICENSING.md).

---
**Project:** ShareShield · Mini-project prototype (planned) · Malnad College of Engineering
