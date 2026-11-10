"""Independent PyMuPDF/Pillow inspection of downloaded scanned PDF exports."""
import argparse,json,hashlib
from pathlib import Path
import fitz
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('directory');a=p.parse_args();root=Path(a.directory)
fixtures=Path(__file__).resolve().parents[2]/'frontend/tests/phase3/fixtures'
manifest=json.loads((fixtures/'manifest.json').read_text())['documents'];results=[]
for path in sorted(root.glob('*.pdf')):
 pdf=fitz.open(path);assert len(pdf)==3
 docresult=dict(file=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),pages=[])
 for page,kind in zip(pdf,['identity','hospital','repeated']):
  assert not page.get_text().strip(),'Export retained a text layer'
  source=next(x for x in manifest if x['id']==f'development-{kind}')
  pix=page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False);im=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
  original=Image.open(fixtures/source['file']).convert('RGB');assert im.size==original.size
  values=[]
  for entity in source['entities']:
   x,y,w,h=map(round,entity['box']);crop=im.crop((x,y,x+w,y+h));pixels=list(crop.getdata());fraction=sum(max(p)<8 for p in pixels)/len(pixels)
   # Digit grouping has intentional whitespace gaps between word boxes.
   threshold=.80 if 'AADHAAR' in entity['category'] else .92
   assert fraction>=threshold,(path.name,page.number,entity['category'],fraction)
   # Check every source glyph component, including its one-pixel border.
   # This catches residual characters that a whole-row average could hide.
   src=original.crop((x,y,x+w,y+h));seen=set();minimum=1.0;components=0
   for gy in range(h):
    for gx in range(w):
     if (gx,gy) in seen or max(src.getpixel((gx,gy)))>=100:continue
     stack=[(gx,gy)];seen.add((gx,gy));points=[]
     while stack:
      px,py=stack.pop();points.append((px,py))
      for dx in [-1,0,1]:
       for dy in [-1,0,1]:
        nx,ny=px+dx,py+dy
        if 0<=nx<w and 0<=ny<h and (nx,ny) not in seen and max(src.getpixel((nx,ny)))<100:seen.add((nx,ny));stack.append((nx,ny))
     if len(points)<2:continue
     l=max(0,x+min(p[0] for p in points)-1);t=max(0,y+min(p[1] for p in points)-1)
     r=min(im.width,x+max(p[0] for p in points)+2);b=min(im.height,y+max(p[1] for p in points)+2)
     mask=list(im.crop((l,t,r,b)).getdata());covered=sum(max(p)<8 for p in mask)/len(mask);minimum=min(minimum,covered);components+=1
   assert components and minimum>=.98,(path.name,page.number,entity['category'],'glyph coverage',minimum)
   values.append(dict(category=entity['category'],black_fraction=fraction,glyph_components=components,min_component_mask_fraction=minimum))
  # Excluded VID must remain byte-for-byte pixel identical on repeated page.
  if kind=='repeated':
   region=(25,320,1000,375);assert im.crop(region).tobytes()==original.crop(region).tobytes(),'VID was altered'
  docresult['pages'].append(dict(page=page.number+1,values=values,extracted_text_empty=True))
 results.append(docresult)
assert len(results)==2,'Both desktop and mobile-emulation downloads required'
(root/'independent-pixels.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
