"""Reproducible fictional English OCR stress test, NOT real-document evaluation.
Uses local Tesseract CLI, not the browser OCR engine. No networking.
"""
import hashlib, json, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
ROOT=Path(__file__).resolve().parents[1]
DOCS=[
 ('hospital','FICTIONAL HOSPITAL\nPatient MRN: 4829107\nBlood group: AB+\nPrescription: TEST MEDICINE', ['4829107','AB+','TEST MEDICINE']),
 ('college','FICTIONAL COLLEGE\nAdmission number: 4829107\nAcademic grade: A+\nStudent: Fictional Mira',['4829107','A+','Fictional Mira']),
 ('identity','FICTIONAL IDENTITY RECORD\nAadhaar: 234567890123\nCopy: 234567890123\nVID: 1234567890123456',['234567890123','234567890123','1234567890123456']),
 ('contact','FICTIONAL CONTACT RECORD\nHome: 42 Fictional Lane\nPostal: 71 Example Road\nEmail: fictional@example.test',['42 Fictional Lane','71 Example Road','fictional@example.test'])
]
def distance(a,b):
    previous=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        current=[i]
        for j,y in enumerate(b,1): current.append(min(current[-1]+1,previous[j]+1,previous[j-1]+(x!=y)))
        previous=current
    return previous[-1]

def main():
    font_path=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    font=ImageFont.truetype(str(font_path),30)
    version=subprocess.check_output(['tesseract','--version'],text=True).splitlines()[0]
    samples=[]
    with tempfile.TemporaryDirectory() as td:
        for doc,text,values in DOCS:
            for condition in ['clean','rotated_2deg','blur_1_2','small_text','blur_2_5','tiny_text']:
                im=Image.new('RGB',(1050,280),'white')
                ImageDraw.Draw(im).multiline_text((35,30),text,font=font,fill='black',spacing=12)
                if condition=='rotated_2deg': im=im.rotate(2,expand=True,fillcolor='white',resample=Image.Resampling.BICUBIC)
                if condition=='blur_1_2': im=im.filter(ImageFilter.GaussianBlur(1.2))
                if condition=='blur_2_5': im=im.filter(ImageFilter.GaussianBlur(2.5))
                if condition=='tiny_text': im=im.resize((245,65),Image.Resampling.LANCZOS)
                if condition=='small_text': im=im.resize((420,112),Image.Resampling.LANCZOS)
                path=Path(td)/f'{doc}-{condition}.png'; im.save(path)
                result=subprocess.run(['tesseract',str(path),'stdout','-l','eng','--psm','6'],capture_output=True,text=True,check=True)
                actual=result.stdout.strip(); expected=' '.join(text.split()); normalized=' '.join(actual.split())
                required={v:values.count(v) for v in values}
                recovered=sum(min(normalized.count(v),count) for v,count in required.items())
                samples.append(dict(document=doc,condition=condition,source_text=text,ocr_text=actual,
                                    image_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                                    character_errors=distance(expected,normalized),reference_characters=len(expected),
                                    required_value_occurrences=len(values),recovered_exact_value_occurrences=recovered))
    report=dict(scope='24 assistant-authored fictional English rendered images; local CLI OCR only, not representative real scans or browser end-to-end recognition.',
                tesseract=version,font_sha256=hashlib.sha256(font_path.read_bytes()).hexdigest(),
                kannada_status='NOT RUN: no Kannada-capable font installed; do not score missing-glyph images.',
                samples=samples,summary={})
    for condition in ['clean','rotated_2deg','blur_1_2','small_text','blur_2_5','tiny_text']:
        rows=[r for r in samples if r['condition']==condition]
        report['summary'][condition]=dict(character_error_rate=sum(r['character_errors'] for r in rows)/sum(r['reference_characters'] for r in rows),
            exact_value_occurrences=sum(r['recovered_exact_value_occurrences'] for r in rows),required_value_occurrences=sum(r['required_value_occurrences'] for r in rows))
    (ROOT/'ml/ocr-stress-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report['summary'],indent=2))
if __name__=='__main__': main()
