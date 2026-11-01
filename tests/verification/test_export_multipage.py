"""Synthetic multi-page export security regression. No real identity information."""
import fitz
from backend.app.services.integrated import redact_document
from backend.verification.pdf_verifier import VerificationInput,verify_pdf

TOKEN="fictional@example.test"

def test_reopened_multipage_export_removes_repeated_fields_and_source_objects(tmp_path):
    source=tmp_path/"source.pdf"
    doc=fitz.open()
    doc.set_metadata({"author":TOKEN,"title":"Fictional two-page ID example"})
    selections=[]
    for i in range(2):
        page=doc.new_page(width=420,height=300)
        page.insert_text((30,100),"Email: "+TOKEN,fontsize=18)
        rects=page.search_for(TOKEN)
        assert len(rects)==1
        r=rects[0]
        selections.append(dict(page=i,x0=r.x0-3,y0=r.y0-3,x1=r.x1+3,y1=r.y1+3))
    doc.save(source);doc.close()
    output=tmp_path/"export.pdf"
    actual=redact_document(source,output,selections)
    with fitz.open(actual) as exported:
        assert len(exported)==2
        assert all(not p.get_text().strip() for p in exported)
        assert all(p.get_images() for p in exported)
        assert TOKEN not in str(exported.metadata)
        assert exported.embfile_count()==0
    evidence=verify_pdf(VerificationInput(actual,selected_findings=[TOKEN],ocr_language="eng"))
    assert evidence["status"] in {"SCOPED_CLEAR","UNVERIFIED"}
    assert not evidence["remaining_findings"]
    assert source.exists()

def test_reopened_unredacted_second_page_is_flagged(tmp_path):
    source=tmp_path/"source.pdf"
    doc=fitz.open()
    for i in range(2):
        p=doc.new_page();p.insert_text((30,90),"Email: "+TOKEN,fontsize=18)
    doc.save(source)
    d=fitz.open(source)
    for r in d[0].search_for(TOKEN):d[0].add_redact_annot(r,fill=(0,0,0))
    d[0].apply_redactions()
    output=tmp_path/"partially-redacted.pdf"
    d.save(output);d.close();doc.close()
    evidence=verify_pdf(VerificationInput(output,selected_findings=[TOKEN],ocr_language="eng"))
    assert evidence["status"]=="FLAG"
    assert any(f["category"] for f in evidence["remaining_findings"])
