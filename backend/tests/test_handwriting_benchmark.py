import pytest
from PIL import Image, ImageDraw
from backend.handwriting_benchmark import coverage, normalize


def test_existing_black_text_is_not_counted_as_redacted_without_mask():
    source = Image.new('RGB', (20, 20), 'white')
    ImageDraw.Draw(source).rectangle((2, 2, 17, 17), fill='black')
    result = coverage(source, source, [2, 2, 18, 18], [])
    assert result['ink_pixels'] == 256
    assert result['covered_ink_pixels'] == 0
    assert result['box_coverage'] == 0


def test_partial_and_full_coverage_require_actual_black_output():
    source = Image.new('RGB', (20, 20), (100, 100, 100))
    output = Image.new('RGB', (20, 20), 'black')
    assert coverage(source, output, [0, 0, 20, 20], [(0, 0, 10, 20)])['covered_ink_pixels'] == 200
    assert coverage(source, output, [0, 0, 20, 20], [(0, 0, 20, 20)])['covered_ink_pixels'] == 400
    assert coverage(source, source, [0, 0, 20, 20], [(0, 0, 20, 20)])['covered_ink_pixels'] == 0
    with pytest.raises(ValueError):
        coverage(source, output, [-1, 0, 20, 20], [])


def test_matching_does_not_hide_ocr_character_errors():
    assert normalize('98765 43210', 'indian_mobile_candidate') == '9876543210'
    assert normalize('Demo@Example.Org', 'email') == 'demo@example.org'
    assert normalize('demo@examp1e.org', 'email') != 'demo@example.org'


def test_manifest_requires_fictional_data_and_writer_consent(tmp_path):
    import json
    from backend.handwriting_benchmark import evaluate
    path = tmp_path / 'manifest.json'
    path.write_text(json.dumps({'kind': 'consented-handwriting', 'fictional_data_only': True}))
    with pytest.raises(ValueError, match='consent'):
        evaluate(path)
    path.write_text(json.dumps({'kind': 'synthetic-font', 'fictional_data_only': False}))
    with pytest.raises(ValueError, match='fictional'):
        evaluate(path)


def test_dob_prefix_is_not_an_ocr_miss():
    assert normalize('DOB: 08/08/2006', 'dob_candidate') == '08/08/2006'
