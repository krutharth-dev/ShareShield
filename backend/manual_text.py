"""Manual text selections bound to exact editable source locations."""
import json

from fastapi import HTTPException

from backend import engine, tabular

FORMATS = {'.txt', '.csv', '.xlsx', '.docx', '.pptx'}
CATEGORY = 'manual_text_candidate'


def sections(data: bytes, ext: str):
    if ext not in FORMATS:
        raise HTTPException(422, 'Text selection is supported for TXT, CSV, DOCX, XLSX and PPTX; use rectangle masks for PDFs and images')
    if ext in {'.csv', '.xlsx'}:
        document, values = tabular._locations(data, ext)
        if ext == '.xlsx':
            document.close()
        return values
    if ext in {'.docx', '.pptx'}:
        _, paragraphs = engine.office_paragraphs(data, ext)
        return [(location, paragraph.text) for location, paragraph in paragraphs if paragraph.text]
    try:
        return [('plain-text', data.decode('utf-8-sig'))]
    except UnicodeError as exc:
        raise HTTPException(422, 'TXT must be UTF-8') from exc


def preview(data: bytes, ext: str):
    values = sections(data, ext)
    if len(values) > 2000 or sum(len(text) for _, text in values) > 200_000:
        raise HTTPException(413, 'Manual text preview is limited to 2,000 sections and 200,000 characters. Split this document into smaller files.')
    return [{'location': location, 'text': text} for location, text in values]


def parse(raw: str, data: bytes, ext: str, all_occurrences: bool = False):
    try:
        regions = json.loads(raw or '[]')
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, 'Manual text selections must be a JSON array') from exc
    if not isinstance(regions, list) or len(regions) > 60:
        raise HTTPException(422, 'Provide at most 60 manual text selections')
    if not regions:
        return []
    values = dict(sections(data, ext))
    pairs = set()
    for region in regions:
        if not isinstance(region, dict) or set(region) != {'location', 'value'}:
            raise HTTPException(422, 'Each text selection needs location and value')
        location, value = region['location'], region['value']
        if not isinstance(location, str) or not isinstance(value, str) or not value.strip() or len(value) > 2000:
            raise HTTPException(422, 'Select between 1 and 2,000 characters of nonblank text')
        if location not in values or value not in values[location]:
            raise HTTPException(422, 'A manual text selection does not match the reviewed source location')
        pairs.add((location, value))
    if all_occurrences:
        tokens = {value for _, value in pairs}
        pairs = {(location, value) for location, text in values.items() for value in tokens if value in text}
    if len(pairs) > engine.MAX_FINDINGS:
        raise HTTPException(413, 'More than 500 matching text locations; split the document')
    return [engine.Finding(CATEGORY, value, 1, [], location) for location, value in sorted(pairs)]


def surviving(selected, data: bytes, ext: str):
    custom = [finding for finding in selected if finding.category == CATEGORY]
    if not custom:
        return []
    values = dict(sections(data, ext))
    return [finding for finding in custom if finding.value in values.get(finding.location, '')]
