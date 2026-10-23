"""Conservative India-relevant text patterns with validation.

Candidates are always user-reviewed. A format match is not proof of identity.
"""
import re

MORE_RULES = (
    ("aadhaar_candidate", re.compile(r"(?<!\d)[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?!\d)")),
    ("pan_candidate", re.compile(r"(?<![A-Za-z0-9])[A-Z]{5}\d{4}[A-Z](?![A-Za-z0-9])")),
    ("upi_candidate", re.compile(
        r"(?<![\w.@-])[A-Za-z0-9._-]{2,}@(?!\.)"
        r"(?:upi|ybl|ibl|axl|okaxis|okhdfcbank|oksbi|okicici|paytm|apl|sbi|icici|hdfcbank|kotak)"
        r"(?![\w.])", re.IGNORECASE)),
)

# Verhoeff checksum, used by Aadhaar. Reject checksum-invalid 12-digit strings.
_D = (
    (0,1,2,3,4,5,6,7,8,9),
    (1,2,3,4,0,6,7,8,9,5),
    (2,3,4,0,1,7,8,9,5,6),
    (3,4,0,1,2,8,9,5,6,7),
    (4,0,1,2,3,9,5,6,7,8),
    (5,9,8,7,6,0,4,3,2,1),
    (6,5,9,8,7,1,0,4,3,2),
    (7,6,5,9,8,2,1,0,4,3),
    (8,7,6,5,9,3,2,1,0,4),
    (9,8,7,6,5,4,3,2,1,0),
)
_P = (
    (0,1,2,3,4,5,6,7,8,9),
    (1,5,7,6,2,8,3,0,9,4),
    (5,8,0,3,7,9,6,1,4,2),
    (8,9,1,6,0,4,3,5,2,7),
    (9,4,5,3,1,2,6,8,7,0),
    (4,2,8,6,5,7,3,9,0,1),
    (2,7,9,3,8,0,6,4,1,5),
    (7,0,4,6,9,1,3,2,5,8),
)


def valid_aadhaar_format(value: str) -> bool:
    digits = re.sub(r"[ -]", "", value)
    if len(digits) != 12 or not digits.isdigit() or digits[0] not in "23456789":
        return False
    checksum = 0
    for i, ch in enumerate(reversed(digits)):
        checksum = _D[checksum][_P[i % 8][int(ch)]]
    return checksum == 0


def valid_match(category: str, value: str) -> bool:
    if category == "aadhaar_candidate":
        return valid_aadhaar_format(value)
    return True


SEVERITY = {
    "aadhaar_candidate": "high", "pan_candidate": "high",
    "upi_candidate": "medium", "indian_mobile_candidate": "medium", "email": "medium",
}
