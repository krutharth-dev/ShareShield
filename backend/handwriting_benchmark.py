"""Local, opt-in handwriting evaluation. Never uploads fixtures to a service.

Use fictional data, including when volunteers write samples by hand. Reports omit
source filenames, recognized text and expected values. This is not certification.
"""
import argparse
import io
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


def normalize(value, category):
    if category == 'dob_candidate':
        value = re.sub(r'^(?:DOB|D\.O\.B\.|Date of Birth)[\s.:-]*', '', value, flags=re.I)
    if category == 'indian_mobile_candidate':
        return re.sub(r'\D', '', value)
    return ' '.join(value.casefold().split())


def coverage(source, output, rectangle, predicted):
    """Ink must be inside a selected mask AND black in the actual export."""
    x0, y0, x1, y1 = map(int, rectangle)
    if not (0 <= x0 < x1 <= source.width and 0 <= y0 < y1 <= source.height):
        raise ValueError('Label rectangle lies outside the image')
    selected = Image.new('1', source.size)
    draw = ImageDraw.Draw(selected)
    for a, b, c, d in predicted:
        if c > a and d > b:
            draw.rectangle((int(a), int(b), int(c) - 1, int(d) - 1), fill=1)
    region = (x0, y0, x1, y1)
    inside = np.asarray(selected.crop(region), dtype=bool)
    ink = np.asarray(source.convert('L').crop(region)) < 200
    black = np.all(np.asarray(output.convert('RGB').crop(region)) == 0, axis=2)
    return {'ink_pixels': int(ink.sum()),
            'covered_ink_pixels': int((ink & inside & black).sum()),
            'box_coverage': float(inside.mean())}


def evaluate(manifest_path):
    from fastapi.testclient import TestClient
    from backend.app import app
    manifest_path = Path(manifest_path).resolve()
    manifest = json.loads(manifest_path.read_text())
    kind = manifest['kind']
    if kind not in {'synthetic-font', 'consented-handwriting'}:
        raise ValueError('Declare synthetic-font or consented-handwriting')
    if manifest.get('fictional_data_only') is not True:
        raise ValueError('Only fictional identifiers are allowed in this benchmark')
    if kind == 'consented-handwriting' and manifest.get('writers_consented') is not True:
        raise ValueError('Confirm writer consent before evaluating handwritten fixtures')
    cases = manifest['cases']
    if not cases or len(cases) > 100:
        raise ValueError('Use between 1 and 100 labeled images')
    rows = []
    with TestClient(app) as client:
        for index, case in enumerate(cases):
            path = (manifest_path.parent / case['image']).resolve()
            if not path.is_relative_to(manifest_path.parent):
                raise ValueError('Fixture must remain within the manifest directory')
            if path.stat().st_size > 12 * 1024 * 1024:
                raise ValueError('Fixture exceeds upload limit')
            payload = path.read_bytes()
            response = client.post('/analyze', files={'file': (path.name, payload)},
                                   data={'handwriting_mode': 'true'})
            if response.status_code != 200:
                raise RuntimeError(f'Case {index + 1}: analysis HTTP {response.status_code}')
            info = response.json()
            assert all(not f['auto_select'] for f in info['findings'])
            source = Image.open(io.BytesIO(payload)).convert('RGB')
            labels = case['fields']
            if not labels:
                raise ValueError('Each case needs at least one labeled field')
            matches = []
            for label in labels:
                expected = normalize(label['value'], label['category'])
                matches.append([f for f in info['findings']
                                if f['category'] == label['category'] and
                                normalize(f['value'], f['category']) == expected])
            ids = sorted({f['id'] for found in matches for f in found})
            output = source
            if ids:
                response = client.post('/redact', files={'file': (path.name, payload)},
                                       data={'analysis_id': info['analysis_id'],
                                             'selected_ids': ','.join(map(str, ids))})
                if response.status_code != 200:
                    raise RuntimeError(f'Case {index + 1}: export HTTP {response.status_code}')
                assert response.headers['X-ShareShield-Verification'] == 'UNVERIFIED'
                output = Image.open(io.BytesIO(response.content)).convert('RGB')
            for label, found in zip(labels, matches):
                metrics = coverage(source, output, label['box'],
                                   [(a-3, b-3, c+4, d+4) for f in found for a,b,c,d in f['rectangles']])
                # Same text elsewhere is not a match for this occurrence.
                rows.append({'case': index + 1, 'category': label['category'],
                             'recognized': bool(found) and metrics['box_coverage'] > 0,
                             **metrics})
    total = len(rows)
    ink = sum(r['ink_pixels'] for r in rows)
    return {'kind': kind, 'cases': len(cases), 'fields': total,
            'recognized_fields': sum(r['recognized'] for r in rows),
            'field_recall': sum(r['recognized'] for r in rows) / total,
            'selected_mask_ink_coverage': (sum(r['covered_ink_pixels'] for r in rows) / ink) if ink else None,
            'rows': rows,
            'limits': 'Exact-value labeled-field recall; mask coverage for oracle-selected matching fields only. '
                      'Not false-positive rate, user selection accuracy, or complete sanitization. '
                      'Synthetic fonts do not measure real handwriting accuracy.'}


def synthetic(directory):
    from backend.local_handwriting import MODEL_DIR
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype(str(MODEL_DIR / 'Caveat.ttf'), 52)
    image = Image.new('RGB', (1100, 700), 'white')
    draw = ImageDraw.Draw(image)
    fields = []
    for i, (label, value, category) in enumerate([
        ('Name: ', 'Alex Example', 'name_candidate'),
        ('Email: ', 'demo@example.org', 'email'),
        ('Phone: ', '9876543210', 'indian_mobile_candidate'),
        ('DOB: ', '08/08/2006', 'dob_candidate'),
    ]):
        xy = (50, 100 + i * 100)
        draw.text(xy, label + value, font=font, fill='black')
        start = (xy[0] + draw.textlength(label, font=font), xy[1])
        box = draw.textbbox(start, value, font=font)
        fields.append({'category': category, 'value': value, 'box': list(map(int, box))})
    draw.text((50, 570), 'Keep this public sentence.', font=font, fill='black')
    cases = []
    for name, variant in [('clear', image), ('blurred', image.filter(ImageFilter.GaussianBlur(.8))),
                          ('jpeg', image)]:
        filename = name + ('.jpg' if name == 'jpeg' else '.png')
        variant.save(directory / filename, **({'quality': 55} if name == 'jpeg' else {}))
        cases.append({'image': filename, 'fields': fields})
    path = directory / 'manifest.json'
    path.write_text(json.dumps({'kind': 'synthetic-font', 'fictional_data_only': True, 'cases': cases}, indent=2))
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--manifest', type=Path)
    group.add_argument('--synthetic-dir', type=Path)
    args = parser.parse_args()
    path = synthetic(args.synthetic_dir) if args.synthetic_dir else args.manifest
    print(json.dumps(evaluate(path), indent=2))


if __name__ == '__main__':
    main()
