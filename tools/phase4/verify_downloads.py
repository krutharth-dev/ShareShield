"""Inspect browser-downloaded bytes with PyMuPDF, pypdf, Pillow and fresh Tesseract."""
import hashlib,json,sys,time
from pathlib import Path
import fitz
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT))
from backend.verification.export_inspection import inspect_structure,inspect_pixels
from backend.verification.pdf_verifier import VerificationInput,verify_pdf
out=Path(sys.argv[1]);source=ROOT/'frontend/tests/phase4/fixtures/adversarial.pdf';value='2345 6789 0124'
regions=[]
with fitz.open(source) as d:
    for n,p in enumerate(d):
        for r in p.search_for(value):
            r=r*p.rotation_matrix
            regions.append({'page':n,'box':{'x':r.x0,'y':r.y0,'width':r.width,'height':r.height}})
assert len(regions)==11
results=[]
for name in ['known-unredacted','approved','manual-removed','one-deselected']:
    path=out/(name+'.pdf');start=time.monotonic()
    structure=inspect_structure(path,[value,'SYNTHETIC-ATTACHMENT-4829','SYNTHETIC-COMMENT-4829'],True)
    assert not structure['structures'] and not structure['residual'] and structure['raster_contract']
    assert structure['page_count']==3 and structure['revision_markers']==1
    pixel=inspect_pixels(path,source,regions)
    assert pixel['status']==('failed' if name in ['known-unredacted','one-deselected'] else 'passed'),(name,pixel)
    manual=[{'page':2,'box':{'x':10,'y':80,'width':290,'height':125}}]
    manual_result=inspect_pixels(path,source,manual)
    assert manual_result['status']==('passed' if name=='approved' else 'failed')
    # Every occurrence except the deliberately deselected first one must stay masked.
    if name=='one-deselected':assert inspect_pixels(path,source,regions[1:])['status']=='passed'
    with fitz.open(source) as a,fitz.open(path) as b:
        r=fitz.Rect(30,500,350,530)
        pa=a[0].get_pixmap(matrix=fitz.Matrix(2,2),clip=r,alpha=False)
        pb=b[0].get_pixmap(matrix=fitz.Matrix(2,2),clip=r,alpha=False)
        # Different PDF renderers may antialias text differently; compare visible ink coverage.
        assert sum(v<100 for v in pb.samples)>sum(v<100 for v in pa.samples)*.8,'VID must remain outside redaction scope'
    report=verify_pdf(VerificationInput(path,selected_findings=[value],original_path=source,approved_regions=regions,require_raster=True,unresolved_review=True,timeout_seconds=90))
    assert report['status'] in (['FLAG'] if name in ['known-unredacted','one-deselected'] else ['UNVERIFIED','FLAG'])
    browser=json.loads((out/(name+'.json')).read_text())
    assert hashlib.sha256(path.read_bytes()).hexdigest()==browser['sha256']
    results.append({'name':name,'structure':structure,'aadhaar_pixels':pixel,'manual_pixels':manual_result,'report':report,'inspection_seconds':round(time.monotonic()-start,3),'size_bytes':path.stat().st_size})
(out/'independent.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps([{'name':r['name'],'pixels':r['aadhaar_pixels']['status'],'status':r['report']['status']} for r in results]))
