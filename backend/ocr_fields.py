"""Reviewable OCR regions for unlabeled identity documents.

Heuristics deliberately require Aadhaar/UIDAI/VID-style context; they provide
editable candidate boxes, never confirmed identity classifications. All text
coordinates are in original image (or PDF page) units.
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.engine import Finding

_ID_CONTEXT = re.compile(r"\b(?:aadhaar|aadhar|adhaar|uidai|vid|virtual\s+id)\b|government\s+of\s+india", re.I)
_RELATION = re.compile(r"(?:\b[SDWC]\s*[/\\]\s*O\b|\b(?:son|daughter|wife|care)\s+of\b|\b(?:father|mother|guardian)\s*[:.-])", re.I)
_DOB = re.compile(r"\b(?:DOB|D\.?O\.?B\.?|birth|जन्म)\b", re.I)
_ADDRESS = re.compile(r"\b(?:address|residence|postal\s+address)\b", re.I)
_STOP = re.compile(r"\b(?:aadhaar|aadhar|vid|virtual\s+id|signature|government\s+of\s+india|dob|date\s+of\s+birth|issue\s+date)\b", re.I)
_BLOCKED_NAMES = re.compile(r"\b(?:government|india|authority|aadhaar|aadhar|birth|dob|address|gender|male|female|number|valid|signature|vid|date|mobile|phone|card|unique|identity|enrolment|pincode|pin)\b", re.I)


def inferred_identity_fields(
    rows: list[tuple[str, tuple[float, float, float, float]]], page: int
) -> list["Finding"]:
    """Conservatively propose parent/name/address masks from grouped OCR lines."""
    from backend.engine import Finding

    rows = sorted((text.strip(), box) for text, box in rows if text.strip())
    # Reorder after dedupe by geometry to preserve reading flow.
    rows.sort(key=lambda row: (round(row[1][1] / 12), row[1][0]))
    if not _ID_CONTEXT.search(" ".join(text for text, _ in rows)):
        return []

    output: list[Finding] = []
    seen: set[tuple[str, int, int, int, int]] = set()

    def union(boxes):
        return (
            min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes),
        )

    def add(category: str, indexes: list[int]):
        if not indexes:
            return
        box = union([rows[i][1] for i in indexes])
        signature = (category, *(round(v / 12) for v in box))
        if signature in seen:
            return
        seen.add(signature)
        value = " ".join(rows[i][0] for i in indexes)[:330]
        output.append(Finding(category, value, page, [box]))

    def possible_person(line: str):
        if _BLOCKED_NAMES.search(line) or re.search(r"\d", line):
            return False
        cleaned = re.sub(r"[^A-Za-z. ]", " ", line)
        words = [w for w in cleaned.split() if len(w) > 1]
        return 2 <= len(words) <= 5 and len(cleaned.strip()) >= 6 and len(line) <= 80

    for i, (text, box) in enumerate(rows):
        if _RELATION.search(text):
            # Relationships reveal a parent/guardian even without "Name:".
            add("name_candidate", [i])
            for j in (i-1, i-2):
                if j >= 0 and 0 <= box[1] - rows[j][1][3] <= max(95, 6 * (box[3]-box[1])) and possible_person(rows[j][0]):
                    add("name_candidate", [j])
                    break
            # On the reverse side, address runs often start with S/O or C/O.
            # Cover the block rather than just a single fragment of the address.
            indexes = [i]
            for j in range(i + 1, min(i + 9, len(rows))):
                follow, follow_box = rows[j]
                if _STOP.search(follow) or follow_box[1] - rows[indexes[-1]][1][3] > 95:
                    break
                if follow_box[1] < box[1] - 5:
                    break
                indexes.append(j)
                if re.search(r"\b\d{6}\b", follow):
                    break
            if len(indexes) >= 3:
                add("address_candidate", indexes)
        if _ADDRESS.search(text):
            indexes = [i]
            for j in range(i + 1, min(i + 9, len(rows))):
                follow, follow_box = rows[j]
                if _STOP.search(follow) or follow_box[1] - rows[indexes[-1]][1][3] > 95:
                    break
                indexes.append(j)
                if re.search(r"\b\d{6}\b", follow):
                    break
            if len(indexes) >= 2:
                add("address_candidate", indexes)
        if _DOB.search(text) and i:
            # A front-side name often appears immediately before the DOB row.
            for j in (i-1, i-2):
                if j >= 0 and 0 <= box[1] - rows[j][1][3] <= 85 and possible_person(rows[j][0]):
                    add("name_candidate", [j])
                    break
    return output
