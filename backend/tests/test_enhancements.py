"""Regression tests for privacy enhancement workflow using synthetic content."""
import io
import json
import shutil

import fitz
import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont
from backend.app import app
from backend.patterns import valid_aadhaar_format

c=TestClient(app)


def valid_synthetic_aadhaar():
    prefix="23456789012"
    return next(prefix+str(n) for n in range(10)
                if valid_aadhaar_format(prefix+str(n)))


def test_indian_pii_candidates_and_checksums():
    number=valid_synthetic_aadhaar()
    assert valid_aadhaar_format(number)
    invalid=number[:-1]+str((int(number[-1])+1)%10)
    assert not valid_aadhaar_format(invalid)
    payload=(f"PAN: ABCDE1234F Aadhaar: {number} "
             f"invalid: {invalid} payment: testuser@okaxis").encode()
    r=c.post("/analyze",files={"file":("synthetic.txt",payload)})
    assert r.status_code==200,r.text
    types={x["category"] for x in r.json()["findings"]}
    assert {"pan_candidate","aadhaar_candidate","upi_candidate"} <= types
    assert r.json()["high_risk_count"]==2


def image_data():
    im=Image.new("RGB",(600,200),"white")
    draw=ImageDraw.Draw(im)
    draw.rectangle((50,40,330,120),fill="black")
    b=io.BytesIO();im.save(b,format="PNG")
    return b.getvalue()


def test_preview_and_manual_image_mask_without_auto_detections():
    source=image_data()
    analyze=c.post("/analyze",files={"file":("image.png",source)})
    assert analyze.status_code==200,analyze.text
    info=analyze.json()
    r=c.post("/preview",files={"file":("image.png",source)},data={"page":"1"})
    assert r.status_code==200 and r.content.startswith(b"\x89PNG")
    assert float(r.headers["X-Document-Width"])==600.0
    boxes=[{"page":1,"x":0.05,"y":0.1,"w":0.7,"h":0.7}]
    out=c.post("/redact",files={"file":("image.png",source)},
               data={"analysis_id":info["analysis_id"],"manual_regions":json.dumps(boxes)})
    assert out.status_code==200,out.text
    assert out.headers["X-ShareShield-Verification"]=="UNVERIFIED"
    after=Image.open(io.BytesIO(out.content))
    assert after.getpixel((100,80))==(0,0,0)
    verified=c.post("/verify",files={"file":("image.png",source),"redacted":("shareshield-redacted.png",out.content)},
                    data={"analysis_id":info["analysis_id"],"manual_count":"1"})
    assert verified.status_code==200,verified.text
    assert verified.json()["status"]=="UNVERIFIED"


def test_file_signature_and_manual_box_validation():
    r=c.post("/analyze",files={"file":("fake.pdf",b"not really PDF")})
    assert r.status_code==415
    r=c.post("/analyze",files={"file":("fake.docx",b"PK obviously invalid")})
    assert r.status_code in (415,422)
    source=image_data()
    report=c.post("/analyze",files={"file":("image.png",source)}).json()
    r=c.post("/redact",files={"file":("image.png",source)},
             data={"analysis_id":report["analysis_id"],
                   "manual_regions":'[{"page":1,"x":0.9,"y":0.5,"w":0.3,"h":0.4}]'})
    assert r.status_code==422


@pytest.mark.skipif(not shutil.which("tesseract"),reason="system OCR missing")
def test_pdf_image_embedded_on_searchable_page():
    img=Image.new("RGB",(760,140),"white")
    draw=ImageDraw.Draw(img)
    try:font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",35)
    except OSError:font=ImageFont.load_default()
    draw.text((15,35),"demo@example.org",fill="black",font=font)
    buf=io.BytesIO();img.save(buf,"PNG")
    pdf=fitz.open();p=pdf.new_page()
    p.insert_text((65,90),"Normal searchable heading")
    p.insert_image(fitz.Rect(65,150,445,220),stream=buf.getvalue())
    source=pdf.tobytes();pdf.close()
    res=c.post("/analyze",files={"file":("embedded.pdf",source)})
    assert res.status_code==200,res.text
    findings=res.json()["findings"]
    assert any(f["value"]=="demo@example.org" for f in findings),findings
    selected=[str(f["id"]) for f in findings if f["value"]=="demo@example.org"]
    red=c.post("/redact",files={"file":("embedded.pdf",source)},
               data={"analysis_id":res.json()["analysis_id"],"selected_ids":",".join(selected)})
    assert red.status_code==200,red.text
    follow=c.post("/analyze",files={"file":("redacted.pdf",red.content)})
    assert follow.status_code==200,follow.text
    assert not any(f["value"]=="demo@example.org" for f in follow.json()["findings"])
