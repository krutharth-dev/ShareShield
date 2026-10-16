# Security policy

**Status:** Prototype planning. There is no publicly released or security-audited version of ShareShield.

## Reporting a vulnerability
For now, communicate suspected security issues **privately to the repository owner or authorized collaborators**. Do not post sensitive documents or exploit details in public issues. A dedicated private vulnerability reporting channel may be configured before any public release.

## Handling sensitive files
- Test using synthetic or explicitly approved information only.
- Never commit source documents, redacted copies, logs containing sensitive values, API keys or session tokens.
- Process locally for the mini-project; avoid sending original documents to cloud services.
- Avoid storing uploaded files beyond what is necessary for processing.
- Use separate output copies and inspect the actual output before any PASS result.
- Treat unsupported formats or incomplete verification as **UNVERIFIED/FLAG**, not as safe.
- Do not claim that ShareShield guarantees removal of all confidential information.

## Before external deployment
Complete threat modeling, dependency/license audit, input validation and file-size limits, secure temp-file handling, permissions review, malware and malformed-document testing, and independent security evaluation.
