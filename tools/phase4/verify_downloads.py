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
def glyphs(path,required):
    # Ground-truth PDF text boxes include white inter-word gaps and font ascenders.
    # Inspect all source glyph pixels, not averages over those blank margins.
    from PIL import Image
    checked=0
    with fitz.open(source) as a,fitz.open(path) as b:
        for r in required:
            n=r['page'];v=r['box'];rect=fitz.Rect(v['x'],v['y'],v['x']+v['width'],v['y']+v['height'])
            old=a[n].get_pixmap(matrix=fitz.Matrix(2,2),clip=rect,alpha=False)
            new=b[n].get_pixmap(matrix=fitz.Matrix(2,2),clip=rect,alpha=False)
            assert (old.width,old.height)==(new.width,new.height)
            ink=[i for i in range(0,len(old.samples),3) if max(old.samples[i:i+3])<100]
            assert ink,'Ground truth must contain visible glyphs'
            if any(max(new.samples[i:i+3])>8 for i in ink):return {'status':'failed','regions_checked':checked}
            checked+=1
    return {'status':'passed','regions_checked':checked}
results=[]
for name in ['known-unredacted','approved','manual-removed','one-deselected']:
    path=out/(name+'.pdf');start=time.monotonic()
    structure=inspect_structure(path,[value,'SYNTHETIC-ATTACHMENT-4829','SYNTHETIC-COMMENT-4829'],True)
    assert not structure['structures'] and not structure['residual'] and structure['raster_contract']
    assert structure['page_count']==3 and structure['revision_markers']==1
    pixel=glyphs(path,regions)
    assert pixel['status']==('failed' if name in ['known-unredacted','one-deselected'] else 'passed'),(name,pixel)
    manual=[{'page':2,'box':{'x':10,'y':80,'width':290,'height':125}}]
    manual_result=inspect_pixels(path,source,manual)
    assert manual_result['status']==('passed' if name=='approved' else 'failed')
    # Every occurrence except the deliberately deselected first one must stay masked.
    if name=='one-deselected':assert glyphs(path,regions[1:])['status']=='passed'
    with fitz.open(source) as a,fitz.open(path) as b:
        r=fitz.Rect(30,500,350,530)
        pa=a[0].get_pixmap(matrix=fitz.Matrix(2,2),clip=r,alpha=False)
        pb=b[0].get_pixmap(matrix=fitz.Matrix(2,2),clip=r,alpha=False)
        # Different PDF renderers may antialias text differently; compare visible ink coverage.
        assert sum(v<100 for v in pb.samples)>sum(v<100 for v in pa.samples)*.8,'VID must remain outside redaction scope'
    browser=json.loads((out/(name+'.json')).read_text())
    approved=inspect_pixels(path,source,browser['mask_manifest']['regions'])
    if name!='known-unredacted':assert approved['status']=='passed',approved
    report=verify_pdf(VerificationInput(path,selected_findings=[value],original_path=source,approved_regions=browser['mask_manifest']['regions'],require_raster=True,unresolved_review=True,timeout_seconds=90))
    assert report['status'] in ['UNVERIFIED','FLAG']
    if pixel['status']=='failed': report['status']='FLAG';report['checks'].append({'name':'mandatory_ground_truth_glyphs','status':'failed','required':True})
    browser=json.loads((out/(name+'.json')).read_text())
    assert hashlib.sha256(path.read_bytes()).hexdigest()==browser['sha256']
    results.append({'name':name,'structure':structure,'aadhaar_pixels':pixel,'approved_pixels':approved,'manual_pixels':manual_result,'report':report,'inspection_seconds':round(time.monotonic()-start,3),'size_bytes':path.stat().st_size})
large_source=ROOT/'frontend/tests/phase4/fixtures/large.pdf';large=out/'large.pdf'
large_report=json.loads((out/'large.json').read_text())
large_pixels=inspect_pixels(large,large_source,large_report['mask_manifest']['regions'])
assert large_pixels['status']=='passed',large_pixels
with fitz.open(large) as d:assert abs(d[0].rect.width-2400)<.01 and abs(d[0].rect.height-1600)<.01
results.append({'name':'large','aadhaar_pixels':{'status':'not_applicable'},'approved_pixels':large_pixels,'report':large_report,'size_bytes':large.stat().st_size,'sha256':hashlib.sha256(large.read_bytes()).hexdigest()})
(out/'independent.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps([{'name':r['name'],'pixels':r['aadhaar_pixels']['status'],'status':r['report']['status']} for r in results]))
