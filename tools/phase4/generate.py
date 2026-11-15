"""Fresh development fixtures; no Phase 3 sealed corpus is read or tuned."""
import io,json
from pathlib import Path
import fitz
from PIL import Image,ImageDraw
import qrcode
OUT=Path(__file__).resolve().parents[2]/'frontend/tests/phase4/fixtures';OUT.mkdir(parents=True,exist_ok=True)
doc=fitz.open();page=doc.new_page(width=600,height=740);regions=[]
# Fictional values intentionally include repeated occurrences, never genuine records.
for i in range(10):
    y=70+i*42;page.insert_text((35,y),f'Aadhaar: 2345 6789 0124',fontsize=16)
    regions.append({'page':0,'box':{'x':100,'y':y-18,'width':180,'height':23}})
page.insert_text((35,520),'VID: 2345 6789 0123 4567',fontsize=16)
page.insert_text((35,570),'Medical record: MRN-482901',fontsize=16)
page.insert_text((35,610),'Patient: Example Person',fontsize=16)
page.insert_text((35,650),'Address: 42 Fictional Avenue',fontsize=16)
page=doc.new_page(width=420,height=300);page.insert_text((40,65),'Aadhaar: 2345 6789 0124',fontsize=16);page.set_cropbox(fitz.Rect(20,20,400,280));page.set_rotation(90)
page=doc.new_page(width=320,height=240);page.insert_text((30,50),'Public summary page',fontsize=16)
qr=qrcode.make('fictional-id:MRN-482901');qr_bytes=io.BytesIO();qr.save(qr_bytes,format='PNG');page.insert_image(fitz.Rect(20,90,110,180),stream=qr_bytes.getvalue())
# Synthetic avatar, not a human portrait or face-recognition accuracy benchmark.
avatar=Image.new('RGB',(100,100),'#cce0ee');draw=ImageDraw.Draw(avatar);draw.ellipse((25,15,75,65),fill='#b97558');draw.ellipse((10,65,90,130),fill='#223366');b=io.BytesIO();avatar.save(b,format='PNG');page.insert_image(fitz.Rect(180,90,280,190),stream=b.getvalue())
doc.set_metadata({'author':'fictional@example.test','title':'Synthetic security fixture'})
doc.embfile_add('fictional.txt',b'SYNTHETIC-ATTACHMENT-4829');doc[0].add_text_annot((450,60),'SYNTHETIC-COMMENT-4829')
doc.save(OUT/'adversarial.pdf');doc.close()
# Large adaptive-scale sheet exercises the previous /2 dimensions bug.
doc=fitz.open();page=doc.new_page(width=2400,height=1600);page.insert_text((100,150),'Public large sheet',fontsize=60);doc.save(OUT/'large.pdf');doc.close()
(OUT/'manifest.json').write_text(json.dumps({'fictional':True,'regions':regions},indent=2)+'\n')
print(OUT)
