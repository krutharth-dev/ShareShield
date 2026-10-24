"""Bounded CSV/XLSX PII inspection and cell-level text replacement.

Only straightforward visible/hidden worksheet cells (not formulas) are inspected.
OpenXML structures, formulas, charts and metadata are NOT fully sanitized.
"""
from __future__ import annotations

import csv
import io
from collections import defaultdict

from fastapi import HTTPException
from openpyxl import load_workbook

MAX_CELLS = 100_000
MAX_SHEETS = 40

WARNINGS = [
    "Spreadsheet formulas, cached formula results, charts, comments, hyperlinks, images, hidden workbook structures and metadata are not reliably sanitized.",
    "Cell values are inspected individually. A sensitive value split across cells may be missed.",
    "Exported workbook formatting and unsupported Excel features should be checked manually.",
]


def _read_csv(data: bytes):
    try:
        text = data.decode("utf-8-sig")
        if "\x00" in text:
            raise ValueError("binary data")
        reader = csv.reader(io.StringIO(text, newline=""), strict=True)
        rows = []
        total = 0
        for row in reader:
            total += len(row)
            if len(rows) >= 20_000 or total > MAX_CELLS:
                raise HTTPException(413, "CSV exceeds 20,000 rows or 100,000 cells")
            rows.append(row)
        return rows
    except (UnicodeDecodeError, csv.Error, ValueError) as exc:
        raise HTTPException(422, "CSV must contain valid UTF-8 CSV text") from exc


def _open_xlsx(data: bytes):
    try:
        book = load_workbook(io.BytesIO(data), keep_links=False, data_only=False)
    except (OSError, ValueError, KeyError, TypeError, EOFError, ImportError) as exc:
        raise HTTPException(422, "Invalid or unsupported XLSX workbook") from exc
    if len(book.worksheets) > MAX_SHEETS:
        raise HTTPException(413, "XLSX exceeds 40 worksheets")
    if sum(len(ws._cells) for ws in book.worksheets) > MAX_CELLS:
        raise HTTPException(413, "XLSX exceeds 100,000 stored cells")
    return book


def _cell_text(value):
    if value is None or isinstance(value, bool):
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (float, int)):
        return str(int(value)) if float(value).is_integer() else str(value)
    return ""


def _locations(data: bytes, ext: str):
    """Return stable locations and editable text for scan/redaction."""
    if ext == ".csv":
        rows = _read_csv(data)
        values = []
        for ri, row in enumerate(rows):
            for ci, value in enumerate(row):
                if value:
                    values.append((f"csv:r{ri}:c{ci}", value))
        return rows, values
    book = _open_xlsx(data)
    values = []
    for si, sheet in enumerate(book.worksheets):
        for cell in sheet._cells.values():
            if cell.data_type == "f":  # Preserve formulas; never claim to sanitize them.
                continue
            value = _cell_text(cell.value)
            if value:
                values.append((f"xlsx:s{si}:{cell.coordinate}", value))
    return book, values


def inspect(data: bytes, ext: str):
    from backend.engine import scan_text
    _, values = _locations(data, ext)
    findings = []
    for loc, value in values:
        findings.extend(scan_text(value, 1, location=loc))
    return findings, list(WARNINGS if ext == ".xlsx" else [
        "CSV fields are scanned separately; formulas or dangerous spreadsheet-style cell content are not evaluated.",
        "Importing the exported CSV into spreadsheet software may interpret cells as formulas.",
        "CSV has no rendered preview; check downloaded data before sharing.",
    ])


def redact(data: bytes, ext: str, selected):
    by_loc = defaultdict(set)
    for f in selected:
        by_loc[f.location].add(f.value)

    document, _ = _locations(data, ext)
    if ext == ".csv":
        for ri, row in enumerate(document):
            for ci, value in enumerate(row):
                loc = f"csv:r{ri}:c{ci}"
                for token in sorted(by_loc.get(loc, ()), key=len, reverse=True):
                    value = value.replace(token, "[REDACTED]")
                row[ci] = value
        output = io.StringIO(newline="")
        writer = csv.writer(output, lineterminator="\r\n")
        writer.writerows(document)
        data_out = output.getvalue().encode("utf-8-sig")
        return data_out, "text/csv", "shareshield-redacted.csv"

    for si, sheet in enumerate(document.worksheets):
        for cell in sheet._cells.values():
            loc = f"xlsx:s{si}:{cell.coordinate}"
            if loc not in by_loc or cell.data_type == "f":
                continue
            text = _cell_text(cell.value)
            for token in sorted(by_loc[loc], key=len, reverse=True):
                text = text.replace(token, "[REDACTED]")
            cell.value = text
    output = io.BytesIO()
    document.save(output)
    return output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "shareshield-redacted.xlsx"
