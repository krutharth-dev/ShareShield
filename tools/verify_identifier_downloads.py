"""Independently inspect actual browser downloads for the adjacent-row regression."""
import hashlib
import json
import sys
import time
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.verification.export_inspection import inspect_structure, inspect_pixels

out = Path(sys.argv[1])
results = []
with fitz.open(out / 'original.pdf') as source:
    regions = source[0].search_for('2345 6789 0124')
    assert len(regions) == 10
    for name, expected in [('unapproved', 0), ('approved', 10), ('one-deselected', 9)]:
        started = time.monotonic()
        path = out / (name + '.pdf')
        report = json.loads((out / (name + '.json')).read_text())
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        assert sha == report['sha256']
        structure = inspect_structure(path, ['2345 6789 0124'], True)
        assert structure['raster_contract'] and not structure['structures'] and not structure['residual']
        assert structure['page_count'] == 1 and structure['revision_markers'] == 1
        covered = []
        with fitz.open(path) as exported:
            assert exported[0].rect == source[0].rect
            assert not exported[0].get_text().strip()
            for rect in regions:
                old = source[0].get_pixmap(matrix=fitz.Matrix(2, 2), clip=rect, alpha=False)
                new = exported[0].get_pixmap(matrix=fitz.Matrix(2, 2), clip=rect, alpha=False)
                assert (old.width, old.height) == (new.width, new.height)
                ink = [i for i in range(0, len(old.samples), 3) if max(old.samples[i:i+3]) < 100]
                assert ink
                covered.append(all(max(new.samples[i:i+3]) <= 8 for i in ink))
        assert sum(covered) == expected, (name, covered)
        if name == 'one-deselected':
            assert covered == [False] + [True] * 9
        manifest = inspect_pixels(path, out / 'original.pdf', report['mask_manifest']['regions'])
        if expected:
            assert manifest['status'] == 'passed'
        results.append({'name': name, 'sha256': sha, 'glyph_regions_removed': sum(covered),
                        'structure': structure, 'approved_pixels': manifest,
                        'inspection_seconds': round(time.monotonic() - started, 3)})
(out / 'independent.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results))
