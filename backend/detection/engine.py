
"""Conservative candidate detection.

Findings are candidates, not authoritative identity verification.
"""
from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass
class Finding:
    category: str
    value: str
    start: int
    end: int
    confidence: float
    language: str
    evidence: str
    page: int | None = None


# Sensitive-data detection patterns
EMAIL = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    re.I
)

PAN = re.compile(
    r"\b[A-Z]{5}[0-9]{4}[A-Z]\b",
    re.I
)

AADHAAR = re.compile(
    r"(?<!\d)(?:\d[ -]?){11}\d(?!\d)"
)

MOBILE = re.compile(
    r"(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)"
)

IFSC = re.compile(
    r"\b[A-Z]{4}0[A-Z0-9]{6}\b",
    re.I
)

UPI = re.compile(
    r"\b[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,63}\b",
    re.I
)

ACCOUNT = re.compile(
    r"\b(?:account(?:\s+number|\s+no\.?)?|a/c)"
    r"\s*[:#-]?\s*([0-9]{9,18})\b",
    re.I
)

SECRET = re.compile(
    r"""(?i)\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|client[_-]?secret)\s*[:=]\s*['"]?([A-Za-z0-9_./+=-]{8,})"""
)


# Correct Verhoeff multiplication table
_D = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,2,3,4,0,6,7,8,9,5],
    [2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],
    [4,0,1,2,3,9,5,6,7,8],
    [5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],
    [7,6,5,9,8,2,1,0,4,3],
    [8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
]

# Verhoeff permutation table
_P = [
    [0,1,2,3,4,5,6,7,8,9],
    [1,5,7,6,2,8,3,0,9,4],
    [5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],
    [9,4,5,3,1,2,6,8,7,0],
    [4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],
    [7,0,4,6,9,1,3,2,5,8],
]


def _verhoeff(s: str) -> bool:
    c = 0

    for i, digit in enumerate(reversed(s)):
        c = _D[c][_P[i % 8][int(digit)]]

    return c == 0


def _ctx(text: str, start: int, end: int) -> str:
    return (
        text[max(0, start - 40):min(len(text), end + 40)]
        .replace("\n", " ")
        .strip()
    )


def _lang(value: str, hint: str) -> str:
    if any("\u0c80" <= c <= "\u0cff" for c in value):
        return "Kannada"

    if any("\u0900" <= c <= "\u097f" for c in value):
        return "Hindi"

    return "English" if hint == "auto" else hint


def detect_sensitive_data(
    text: str,
    language: str = "auto",
    page: int | None = None
) -> list[Finding]:

    found = []

    patterns = [
        ("EMAIL", EMAIL, 0.99),
        ("PAN_CANDIDATE", PAN, 0.92),
        ("INDIAN_MOBILE", MOBILE, 0.91),
        ("IFSC", IFSC, 0.97),
        ("UPI_ID", UPI, 0.86),
    ]

    for category, pattern, score in patterns:
        for m in pattern.finditer(text):
            value = m.group()

            if category == "UPI_ID" and EMAIL.fullmatch(value):
                continue

            found.append(
                Finding(
                    category,
                    value,
                    m.start(),
                    m.end(),
                    score,
                    _lang(value, language),
                    _ctx(text, m.start(), m.end()),
                    page
                )
            )

    # Aadhaar candidate with Verhoeff checksum
    for m in AADHAAR.finditer(text):
        digits = re.sub(r"\D", "", m.group())

        if len(digits) == 12 and digits[0] in "23456789" and _verhoeff(digits):
            found.append(
                Finding(
                    "AADHAAR_CANDIDATE",
                    m.group(),
                    m.start(),
                    m.end(),
                    0.94,
                    _lang(m.group(), language),
                    _ctx(text, m.start(), m.end()),
                    page
                )
            )

    # Bank account candidates require an explicit contextual label
    for m in ACCOUNT.finditer(text):
        start, end = m.span(1)

        found.append(
            Finding(
                "BANK_ACCOUNT_CANDIDATE",
                m.group(1),
                start,
                end,
                0.88,
                _lang(m.group(1), language),
                _ctx(text, m.start(), m.end()),
                page
            )
        )

    # Credentials and secrets
    for m in SECRET.finditer(text):
        start, end = m.span(1)

        found.append(
            Finding(
                "CREDENTIAL_OR_SECRET",
                m.group(1),
                start,
                end,
                0.98,
                _lang(m.group(1), language),
                _ctx(text, m.start(), m.end()),
                page
            )
        )

    # Remove duplicate findings
    unique = {
        (f.start, f.end, f.category): f
        for f in found
    }

    return sorted(
        unique.values(),
        key=lambda f: (f.start, f.end)
    )

