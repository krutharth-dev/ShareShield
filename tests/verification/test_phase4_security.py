"""Fictional adversarial bytes; assertions cover failures as well as reconstruction."""
import json
from pathlib import Path
import fitz
import pytest
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject,NameObject,TextStringObject,ArrayObject
from backend.verification.pdf_verifier import VerificationInput,verify_pdf
from backend.verification.export_inspection import inspect_structure,inspect_pixels
from backend.app.services.processing import redact_file
from backend.app.contracts.schemas import Region

SECRET='SYNTHETIC-HIDDEN-4829'
def source(path):
    d=fitz.open();p=d.new_page(width=300,height=200);p.insert_text((30,60),SECRET);d.save(path);d.close();return path

def test_hidden_form_and_javascript_cannot_clear(tmp_path):
    p=tmp_path/'private-name.pdf';w=PdfWriter();w.add_blank_page(300,200)
    f=DictionaryObject({NameObject('/FT'):NameObject('/Tx'),NameObject('/T'):TextStringObject('private'),NameObject('/V'):TextStringObject(SECRET)})
    w._root_object[NameObject('/AcroForm')]=DictionaryObject({NameObject('/Fields'):ArrayObject([w._add_object(f)])});w.add_js('/* '+SECRET+' */');w.write(p)
    r=verify_pdf(VerificationInput(p,selected_findings=[SECRET],required_checks=['pdf_text_extraction','metadata_attachments']))
    assert r['status']=='FLAG'
    assert any(f['source']=='pdf_objects' for f in r['remaining_findings'])
    assert SECRET not in json.dumps(r) and p.name not in json.dumps(r)

@pytest.mark.parametrize('structure',['metadata','annotation','attachment','link','form','javascript','optional_content'])
def test_fresh_reconstruction_discards_original_objects(tmp_path,structure):
    p=source(tmp_path/'s.pdf');d=fitz.open(p);page=d[0]
    if structure=='metadata':d.set_metadata({'author':SECRET})
    if structure=='annotation':page.add_text_annot((200,150),SECRET)
    if structure=='attachment':d.embfile_add('note.txt',SECRET.encode())
    if structure=='link':page.insert_link({'kind':fitz.LINK_URI,'from':fitz.Rect(10,10,100,20),'uri':'https://example.test/'+SECRET})
    if structure=='form':
        w=fitz.Widget();w.field_name='field';w.field_type=fitz.PDF_WIDGET_TYPE_TEXT;w.rect=fitz.Rect(20,100,250,125);w.field_value=SECRET;page.add_widget(w)
    if structure=='optional_content':d.add_ocg(SECRET)
    d.save(tmp_path/'with.pdf');d.close();p=tmp_path/'with.pdf'
    if structure=='javascript':
        w=PdfWriter(clone_from=p);w.add_js('/* '+SECRET+' */');w.write(tmp_path/'js.pdf');p=tmp_path/'js.pdf'
    o=redact_file(p,tmp_path/'o.pdf',[Region(page=0,x0=0,y0=0,x1=300,y1=200)])
    r=inspect_structure(o,[SECRET],True)
    assert not r['residual'] and not r['structures'] and r['raster_contract'] and r['revision_markers']==1
    pixels=inspect_pixels(o,p,[{'page':0,'box':{'x':0,'y':0,'width':300,'height':200}}]);assert pixels['status']=='passed'

@pytest.mark.parametrize('rect',[(290,30,400,70),(-1,30,100,70),(30,30,30,70),(30,30,float('nan'),70)])
def test_invalid_rectangles_never_clip(tmp_path,rect):
    p=source(tmp_path/'s.pdf')
    with pytest.raises(ValueError):redact_file(p,tmp_path/'o.pdf',[Region(page=0,x0=rect[0],y0=rect[1],x1=rect[2],y1=rect[3])])
    assert not (tmp_path/'o.pdf').exists()

def test_overlay_and_wrong_coordinates_fail_independent_pixels(tmp_path):
    p=source(tmp_path/'s.pdf');o=redact_file(p,tmp_path/'o.pdf',[])
    assert inspect_pixels(o,p,[{'page':0,'box':{'x':25,'y':45,'width':180,'height':20}}])['status']=='failed'
    d=fitz.open(p);d[0].draw_rect(fitz.Rect(25,45,210,65),fill=(0,0,0));d.save(tmp_path/'overlay.pdf');d.close()
    assert not inspect_structure(tmp_path/'overlay.pdf',[SECRET],True)['raster_contract']

def test_reexport_uses_immutable_original(tmp_path):
    p=source(tmp_path/'s.pdf');original=p.read_bytes()
    a=redact_file(p,tmp_path/'a.pdf',[Region(page=0,x0=20,y0=40,x1=230,y1=70)])
    b=redact_file(p,tmp_path/'b.pdf',[])
    assert p.read_bytes()==original
    region=[{'page':0,'box':{'x':25,'y':45,'width':180,'height':20}}]
    assert inspect_pixels(a,p,region)['status']=='passed'
    assert inspect_pixels(b,p,region)['status']=='failed'

def test_rotated_crop_mixed_size_pages_preserved(tmp_path):
    d=fitz.open();p=d.new_page(width=400,height=300);p.insert_text((80,100),SECRET);p.set_cropbox(fitz.Rect(50,40,350,240));p.set_rotation(90);d.new_page(width=220,height=140);d.save(tmp_path/'s.pdf');d.close()
    o=redact_file(tmp_path/'s.pdf',tmp_path/'o.pdf',[Region(page=0,x0=0,y0=0,x1=200,y1=300)])
    assert inspect_pixels(o,tmp_path/'s.pdf',[{'page':0,'box':{'x':0,'y':0,'width':200,'height':300}}])['status']=='passed'
    with fitz.open(o) as d:assert len(d)==2 and list(d[0].rect)==[0,0,200,300] and list(d[1].rect)==[0,0,220,140]

def test_missing_coordinates_and_unresolved_review_never_clear(tmp_path):
    p=source(tmp_path/'s.pdf');o=redact_file(p,tmp_path/'o.pdf',[Region(page=0,x0=0,y0=0,x1=300,y1=200)])
    r=verify_pdf(VerificationInput(o,selected_findings=[SECRET],required_checks=['pdf_text_extraction'],unresolved_review=True,require_raster=True))
    assert r['status']=='UNVERIFIED'
    assert any(c['name']=='approved_pixels' and c['status']=='incomplete' for c in r['checks'])

def test_incorrect_ocr_cannot_override_failed_pixels(tmp_path,monkeypatch):
    import pytesseract
    monkeypatch.setattr(pytesseract,'image_to_string',lambda *a,**k:'Ordinary public text')
    p=source(tmp_path/'s.pdf');o=redact_file(p,tmp_path/'o.pdf',[])
    r=verify_pdf(VerificationInput(o,selected_findings=[SECRET],original_path=p,approved_regions=[{'page':0,'box':{'x':20,'y':40,'width':210,'height':30}}],require_raster=True))
    assert r['status']=='FLAG' and any(f['source']=='pixel_inspection' for f in r['remaining_findings'])

def test_scoped_clear_requires_complete_narrow_evidence(tmp_path):
    p=source(tmp_path/'s.pdf');o=redact_file(p,tmp_path/'o.pdf',[Region(page=0,x0=20,y0=40,x1=230,y1=70)])
    r=verify_pdf(VerificationInput(o,selected_findings=[SECRET],original_path=p,approved_regions=[{'page':0,'box':{'x':20,'y':40,'width':210,'height':30}}],required_checks=['pdf_text_extraction','metadata_attachments'],require_raster=True))
    assert r['status']=='SCOPED_CLEAR'  # explicitly scoped pixel/object contract; OCR not requested


def test_backend_vid_substring_is_excluded_but_repeated_aadhaar_preserved():
    from backend.detection.engine import detect_sensitive_data
    value='2345 6789 0124'
    assert not [f for f in detect_sensitive_data('VID: '+value+' 5678') if f.category=='AADHAAR_CANDIDATE']
    assert len([f for f in detect_sensitive_data(('Aadhaar: '+value+'\n')*10) if f.category=='AADHAAR_CANDIDATE'])==10


def test_original_image_object_cannot_hide_unpainted_in_rebuilt_pdf(tmp_path):
    p=source(tmp_path/'s.pdf');o=redact_file(p,tmp_path/'o.pdf',[])
    from pypdf.generic import DecodedStreamObject,NumberObject
    w=PdfWriter(clone_from=o);hidden=DecodedStreamObject();hidden.set_data(b'\xff\xff\xff')
    hidden.update({NameObject('/Type'):NameObject('/XObject'),NameObject('/Subtype'):NameObject('/Image'),NameObject('/Width'):NumberObject(1),NameObject('/Height'):NumberObject(1),NameObject('/BitsPerComponent'):NumberObject(8),NameObject('/ColorSpace'):NameObject('/DeviceRGB')})
    w._add_object(hidden);w.write(tmp_path/'hidden.pdf')
    assert not inspect_structure(tmp_path/'hidden.pdf',[],True)['raster_contract']


def test_incremental_revision_retaining_secret_is_not_clear(tmp_path):
    p=source(tmp_path/'s.pdf');d=fitz.open(p);d.set_metadata({'author':SECRET});d.saveIncr();d.close()
    r=verify_pdf(VerificationInput(p,selected_findings=[SECRET],required_checks=['metadata_attachments'],require_raster=True))
    assert r['status']=='FLAG'


def test_empty_annotation_array_is_not_an_annotation(tmp_path):
    p=source(tmp_path/'s.pdf');o=redact_file(p,tmp_path/'o.pdf',[])
    w=PdfWriter(clone_from=o);w.pages[0][NameObject('/Annots')]=ArrayObject();w.write(tmp_path/'empty.pdf')
    assert inspect_structure(tmp_path/'empty.pdf',[],True)['structures']==[]
    annotation=DictionaryObject({NameObject('/Type'):NameObject('/Annot'),NameObject('/Contents'):TextStringObject(SECRET)})
    w.pages[0][NameObject('/Annots')]=ArrayObject([w._add_object(annotation)]);w.write(tmp_path/'populated.pdf')
    audit=inspect_structure(tmp_path/'populated.pdf',[SECRET],True)
    assert '/Annots' in audit['structures'] and audit['residual']


def test_orphan_stream_cannot_hide_selected_bytes(tmp_path):
    from pypdf.generic import DecodedStreamObject
    p=source(tmp_path/'source.pdf')
    o=redact_file(p,tmp_path/'clean.pdf',[Region(page=0,x0=20,y0=40,x1=230,y1=70)])
    w=PdfWriter(clone_from=o);hidden=DecodedStreamObject();hidden.set_data(SECRET.encode());w._add_object(hidden);w.write(tmp_path/'orphan.pdf')
    audit=inspect_structure(tmp_path/'orphan.pdf',[SECRET],True)
    assert '/OrphanStream' in audit['structures'] and audit['unaccounted_streams']==1 and not audit['raster_contract']
    report=verify_pdf(VerificationInput(tmp_path/'orphan.pdf',selected_findings=[SECRET],original_path=p,approved_regions=[{'page':0,'box':{'x':20,'y':40,'width':210,'height':30}}],required_checks=['pdf_text_extraction','metadata_attachments'],require_raster=True))
    assert report['status']=='FLAG'
    # A general PDF request cannot silently pass uninspectable orphan stream content either.
    general=verify_pdf(VerificationInput(tmp_path/'orphan.pdf',selected_findings=[SECRET],required_checks=['pdf_text_extraction','metadata_attachments']))
    assert general['status']=='UNVERIFIED'
