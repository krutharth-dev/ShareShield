"""Conservative India-relevant text patterns with validation.

Candidates are always user-reviewed. A format match is not proof of identity.
"""
import re

MORE_RULES = (
    ("passport_candidate", re.compile(r"(?i)\bPassport(?:\s+(?:No\.?|Number))?\s*[:#-]\s*[A-Z][0-9]{7}\b")),
    ("voter_candidate", re.compile(r"(?i)\b(?:EPIC|Voter\s+ID)(?:\s+(?:No\.?|Number))?\s*[:#-]\s*[A-Z]{3}[0-9]{7}\b")),
    ("licence_candidate", re.compile(r"(?i)\b(?:DL|Driving\s+Licen[cs]e)(?:\s+(?:No\.?|Number))?\s*[:#-]\s*[A-Z]{2}[- ]?[0-9]{2}[- ]?[0-9]{4}[- ]?[0-9]{7}\b")),
    ("bank_account_candidate", re.compile(r"(?i)\b(?:Bank\s+Account|Account|A/c)(?:\s+(?:No\.?|Number))?\s*[:#-]\s*[0-9][0-9 -]{7,24}[0-9]\b")),
    ("patient_id_candidate", re.compile(r"(?i)\b(?:MRN|Patient\s+ID|Medical\s+Record\s+Number)\s*[:#-]\s*[A-Z0-9][A-Z0-9-]{3,24}\b")),
    ("credential_candidate", re.compile(r"(?im)\b(?:password|api[_ -]?key|access[_ -]?token|secret[_ -]?key)\s*[:=]\s*[^\s]{4,200}")),
    # Context-marked candidates: intentionally conservative, not full NLP/NER.
    ("vid_candidate", re.compile(r"(?i)\bVID[\s.:-]*(?:\d{4}[\s-]?){3}\d{4}(?!\d)")),
    ("dob_candidate", re.compile(r"(?i)\b(?:DOB|D\.O\.B\.|Date of Birth)[\s.:-]*\d{1,2}[/.-]\d{1,2}[/.-]\d{4}\b")),
    ("name_candidate", re.compile(r"(?im)\b(?:Full[ \t]+Name|Name)[ \t]*:[ \t]*[^\W\d_](?:[^\W\d_]|[ .'’-]){2,75}(?=\r?$)")),
    ("address_candidate", re.compile(r"(?im)\bAddress[ \t]*:[ \t]*[^\s\r\n][^\r\n]{3,109}")),
    ("ifsc_candidate", re.compile(r"(?<![A-Za-z0-9])[A-Z]{4}0[A-Z0-9]{6}(?![A-Za-z0-9])")),
    ("payment_card_candidate", re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")),
    ("aadhaar_candidate", re.compile(r"(?<!\d)(?<!\d[ -])[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)")),
    # OCR can misread one digit: flag as an unverified 12-digit candidate instead
    # of silently declaring it harmless. Valid Aadhaar IDs use the stricter rule.
    ("id12_candidate", re.compile(r"(?<!\d)(?<!\d[ -])[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}(?![ -]?\d)")),
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




def valid_luhn_card(value: str) -> bool:
    digits = re.sub(r"[ -]", "", value)
    if not digits.isdigit() or len(digits) < 13 or len(digits) > 19 or len(set(digits)) < 2:
        return False
    total = 0
    for i, character in enumerate(reversed(digits)):
        number = int(character)
        if i % 2:
            number *= 2
            if number > 9:
                number -= 9
        total += number
    return total % 10 == 0

def valid_match(category: str, value: str) -> bool:
    if category == "aadhaar_candidate":
        return valid_aadhaar_format(value)
    if category == "id12_candidate":
        return not valid_aadhaar_format(value)
    if category == "payment_card_candidate":
        return valid_luhn_card(value)
    return True


SEVERITY = {
    "passport_candidate": "high", "voter_candidate": "high", "licence_candidate": "high",
    "bank_account_candidate": "high", "patient_id_candidate": "high", "credential_candidate": "high",
    "aadhaar_candidate": "high", "id12_candidate": "medium", "vid_candidate": "high", "dob_candidate": "high", "name_candidate": "medium", "address_candidate": "high", "face_candidate": "high", "qr_candidate": "high", "text_region_candidate": "medium", "pan_candidate": "high",
    "upi_candidate": "medium", "ifsc_candidate": "medium",
    "payment_card_candidate": "high", "indian_mobile_candidate": "medium", "email": "medium",
}


# Rule confidence is distinct from impact/severity; these are heuristic scores,
# not calibrated probabilities. Generic 12-digit strings need human selection.
CONFIDENCE = {
    "email": .98, "indian_mobile_candidate": .87, "aadhaar_candidate": .98,
    "id12_candidate": .65, "vid_candidate": .96, "dob_candidate": .96,
    "name_candidate": .86, "address_candidate": .86, "pan_candidate": .92,
    "payment_card_candidate": .97, "upi_candidate": .90, "ifsc_candidate": .75,
    "face_candidate": .80, "qr_candidate": .80,
    "passport_candidate": .95, "voter_candidate": .95, "licence_candidate": .95,
    "bank_account_candidate": .92, "patient_id_candidate": .90, "credential_candidate": .95,
}
