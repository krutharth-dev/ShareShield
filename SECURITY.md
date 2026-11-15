# Security Policy

Security and privacy reports are especially important to ShareShield because users may rely on its OCR, redaction, and exported-file checks.

## Supported scope

Active development occurs on the `main` branch of this **mini-project** repository. Historical hackathon builds, forks, and experimental deployments are not covered by a guaranteed security support schedule. No response-time or remediation-time commitment is currently offered.

ShareShield is a **privacy review aid**, not a certified anonymization service. `SCOPED_CLEAR` applies only to the checks actually completed. `UNVERIFIED` must not be treated as safe, and `FLAG` means a possible exposure remains. Read [known limitations](docs/KNOWN_LIMITATIONS.md) before handling sensitive material.

## Reporting a vulnerability privately

**Do not disclose an exploitable vulnerability, sensitive document, token, or personal identifier in a public GitHub issue, pull request, or discussion.**

1. Visit the repository's **Security** tab and use **Report a vulnerability** if private vulnerability reporting is enabled.
2. If that option is unavailable, use a private contact method provided on the [maintainer's GitHub profile](https://github.com/krutharth-dev). If no private contact channel is published, you may open a *minimal*, nontechnical public issue requesting a secure reporting channel; **do not include vulnerability details**.
3. Include the affected commit/version, environment, impact, sanitized reproduction steps, and any relevant evidence using **synthetic** documents. Do not send real IDs or third-party user data.

Maintainers will assess the report, determine an appropriate remediation path, and coordinate disclosure where feasible. Do not assume a fixed SLA or that private reporting is enabled until GitHub shows that option.

## High-priority classes of issues

Please report, among other things:
- An original sensitive value remaining recoverable in exported PDF text, raster pixels, attachments, metadata, or hidden layers.
- Redaction masks applied to the wrong coordinates, wrong pages, or wrong source findings.
- Aadhaar/VID/PAN validation or OCR errors that silently produce a misleading positive safety verdict.
- A verifier returning `SCOPED_CLEAR` after an incomplete, skipped, unsupported, or failed required check.
- Cross-user access, document retention/logging of personal data, unauthorized downloads, dependency compromise, or unsafe upload handling.
- User-interface messages that conceal verification failure or overstate anonymization guarantees.

## Safe research guidelines

Test only systems and data you own or have explicit authorization to use. Use fictional identifiers and locally generated fixtures. Avoid disruption, persistence, data exfiltration, and public disclosure of working exploit details before maintainers have a reasonable opportunity to respond.

The repository and its source code are public; this does not mean it is approved for production use with real identity materials.
