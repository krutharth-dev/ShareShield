"""Deterministic fictional scan fixtures. Gold is generator-authored, not human validation."""
import argparse, hashlib, json, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import fitz
p=argparse.ArgumentParser();p.add_argument('--font',required=True);p.add_argument('--output',required=True);a=p.parse_args()
out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
font_path=Path(a.font);docs=[]
# Two disjoint parameter sets. Seal before inspecting results; no training on either set.
for split,seed in [('development',31091),('sealed',91437)]:
 rng=random.Random(seed)
 for index,kind in enumerate(['identity','marks','admission','hospital','medical','financial','application','legal','poor-scan','repeated']):
  lang=['eng','kan','eng+kan'][index%3]; size=15 if kind=='identity' else 28
  w,h=(740,340) if kind=='identity' else (1100,620)
  image=Image.new('RGB',(w,h),'white');d=ImageDraw.Draw(image);font=ImageFont.truetype(str(font_path),size)
  number=str(rng.randrange(4000000,9000000)); name='Fictional Mira Rao' if split=='development' else 'Fictional Tara Das'
  ka=lang=='kan'; label='ರೋಗಿಯ ಸಂಖ್ಯೆ' if ka else 'Patient MRN'; alabel='ಆಧಾರ' if ka else 'Aadhaar'
  rows=[('ಕಲ್ಪಿತ ದಾಖಲೆ' if ka else 'FICTIONAL DOCUMENT',None), (f'{alabel}: 2345 6789 0124','AADHAAR_CANDIDATE'),(f'{label}: {number}','MEDICAL_RECORD_NUMBER' if not ka else 'PATIENT_ID')]
  if kind=='marks': rows=[('ಕಲ್ಪಿತ ಅಂಕಪಟ್ಟಿ',None),('ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು: ಕಲ್ಪಿತ ರವಿ','PERSON_NAME_REVIEW'),('ರೋಗಿಯ ಸಂಖ್ಯೆ',None),(number,'FORM_IDENTIFIER_REVIEW'),('Marks: 87',None)]
  if kind=='admission':rows=[('FICTIONAL ADMISSION',None),('Student ID:',None),(number,'FORM_IDENTIFIER_REVIEW'),('Name: '+name,'PERSON_NAME_REVIEW'),('Marks: 92',None)]
  if kind=='hospital':rows=[('FICTIONAL HOSPITAL',None),('Patient MRN:',None),(number,'FORM_IDENTIFIER_REVIEW'),('Aadhaar: 2345 6789 0124','AADHAAR_CANDIDATE')]
  if kind=='medical':rows=[('ಕಲ್ಪಿತ ಆಸ್ಪತ್ರೆ',None),('ರೋಗಿಯ ಸಂಖ್ಯೆ: '+number,'PATIENT_ID'),('ರೋಗಿಯ ಸಂಖ್ಯೆ',None),(str(int(number)+1),'FORM_IDENTIFIER_REVIEW'),('ಆಧಾರ: 2345 6789','AADHAAR_OCR_REVIEW')]
  if kind=='financial':rows=[('FICTIONAL FINANCIAL FORM',None),('Account number: 432109876543','BANK_ACCOUNT_CANDIDATE'),('ಖಾತೆ ಸಂಖ್ಯೆ: 543210987654','BANK_ACCOUNT_CANDIDATE'),('VID: 2345 6789 0124 9999',None)]
  if kind=='application':rows=[('FICTIONAL APPLICATION',None),('Name: '+name,'PERSON_NAME_REVIEW'),('Address: 14 Fictional Road','ADDRESS_REVIEW'),('Hassan 573201','ADDRESS_BLOCK_REVIEW'),('Address: 29 Imaginary Lane','ADDRESS_REVIEW'),('Mysore 570001','ADDRESS_BLOCK_REVIEW')]
  if kind=='legal':rows=[('ಕಲ್ಪಿತ ದಾಖಲೆ',None),('ಹೆಸರು: ಕಲ್ಪಿತ ರವಿ','PERSON_NAME_REVIEW'),('ವಿಳಾಸ: 14 ಕಲ್ಪಿತ ರಸ್ತೆ','KANNADA_ADDRESS_REVIEW'),('ರೋಗಿಯ ಸಂಖ್ಯೆ: '+number,'PATIENT_ID')]
  if kind=='poor-scan':rows=[('FICTIONAL MIXED FORM',None),('ರೋಗಿಯ ಸಂಖ್ಯೆ: '+number,'PATIENT_ID'),('Aadhaar: 2345 6789 0124','AADHAAR_CANDIDATE'),('Name: '+name,'PERSON_NAME_REVIEW')]
  if kind=='repeated':rows=[('FICTIONAL REPEATED IDENTIFIERS',None),('Aadhaar: 2345 6789 0124','AADHAAR_CANDIDATE'),('Aadhaar: 2345 6789 0124','AADHAAR_CANDIDATE'),('Aadhaar: 2345 6789 01','AADHAAR_OCR_REVIEW'),('VID: 2345 6789 0124 9999',None)]
  entities=[]; texts=[]
  for j,(text,category) in enumerate(rows):
   x=30;y=25+j*(38 if size==15 else 75);d.text((x,y),text,font=font,fill='black');texts.append(text)
   if category:
    value=text.split(': ',1)[-1] if ': ' in text else text
    prefix=text[:-len(value)];bx=x+d.textlength(prefix,font=font);box=list(d.textbbox((bx,y),value,font=font))
    entities.append(dict(category=category,value=value,box=[box[0],box[1],box[2]-box[0],box[3]-box[1]]))
  if kind=='poor-scan':image=image.filter(ImageFilter.GaussianBlur(.65))
  identifier=f'{split}-{kind}';path=out/(identifier+'.png');image.save(path)
  docs.append(dict(id=identifier,split=split,kind=kind,language=lang,width=w,height=h,text='\n'.join(texts),entities=entities,file=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
 # Real scanned multi-page PDF (no source text layer), with repeated occurrences across pages.
 pdf=fitz.open()
 for kind in ['identity','hospital','repeated']:
  doc=next(x for x in docs if x['id']==f'{split}-{kind}');page=pdf.new_page(width=doc['width']/2,height=doc['height']/2);page.insert_image(page.rect,filename=str(out/doc['file']))
 pdf.save(out/f'{split}-multipage.pdf',deflate=True);pdf.close()
(out/'manifest.json').write_text(json.dumps(dict(schema=1,annotation='Generator gold only; independent fluent Kannada review pending',font_sha256=hashlib.sha256(font_path.read_bytes()).hexdigest(),documents=docs),ensure_ascii=False,indent=2)+'\n')
(out/'seal.sha256').write_text('\n'.join(x['sha256']+'  '+x['file'] for x in docs if x['split']=='sealed')+'\n')
print(f'Created {len(docs)} scans and two multipage PDFs in {out}')
