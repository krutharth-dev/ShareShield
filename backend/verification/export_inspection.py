"""Independent saved-byte inspection. Never imports browser detection or drawing code."""
import hashlib
import math
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, TextStringObject, StreamObject

FORBIDDEN = {'/AcroForm','/Annots','/EmbeddedFiles','/Filespec','/JavaScript','/JS','/OpenAction','/AA','/OCProperties','/OC','/URI','/RichMedia','/XFA','/Metadata'}

def inspect_structure(path, selected, require_raster=False):
    reader = PdfReader(str(path), strict=True)
    seen, strings, structures = set(), [], set()
    image_objects=set();used_images=set();stream_objects=set();container_streams=set();content_streams=set()
    def walk(obj, depth=0):
        if depth > 80 or len(seen) > 100000:
            raise ValueError('Object inspection limit exceeded')
        if isinstance(obj, IndirectObject):
            key=(obj.idnum,obj.generation)
            if key in seen: return
            seen.add(key); obj=obj.get_object()
            if isinstance(obj,DictionaryObject) and obj.get('/Subtype')=='/Image':image_objects.add(key)
            if isinstance(obj,StreamObject):
                stream_objects.add(key)
                if obj.get('/Type') in ('/ObjStm','/XRef'):container_streams.add(key)
        if isinstance(obj, DictionaryObject):
            for key,value in obj.items():
                resolved=value.get_object() if isinstance(value,IndirectObject) else value
                empty_annotations=str(key)=='/Annots' and isinstance(resolved,ArrayObject) and len(resolved)==0
                if str(key) in FORBIDDEN and not empty_annotations: structures.add(str(key))
                walk(value,depth+1)
        elif isinstance(obj, (ArrayObject,list)):
            for item in obj: walk(item,depth+1)
        elif isinstance(obj, TextStringObject): strings.append(str(obj))
    walk(reader.trailer)
    reachable_streams=stream_objects.copy()
    # Include orphaned but recoverable objects, not only the reachable document graph.
    for generation, entries in reader.xref.items():
        if generation == 65535: continue
        for number in entries:
            if number: walk(IndirectObject(number,generation,reader))
    for number in reader.xref_objStm:
        walk(IndirectObject(number,0,reader))
    if stream_objects-reachable_streams-container_streams:structures.add('/OrphanStream')
    residual=any(v.casefold() in text.casefold() for v in selected for text in strings)
    raster_ok=True
    if require_raster:
        for page in reader.pages:
            refs=page.get('/Contents')
            refs=refs if isinstance(refs,ArrayObject) else [refs]
            for ref in refs:
                if isinstance(ref,IndirectObject):content_streams.add((ref.idnum,ref.generation))
            content=page.get_contents()
            operations=content.operations if content is not None else []
            # Fresh raster exports paint one image only. Text, clipping, overlays and forms fail.
            if sum(op==b'Do' for _,op in operations)!=1 or any(op not in {b'q',b'Q',b'cm',b'Do'} for _,op in operations):
                raster_ok=False
            resources=page.get('/Resources',DictionaryObject()).get_object()
            images=resources.get('/XObject',DictionaryObject()).get_object()
            if len(images)!=1: raster_ok=False
            for image in images.values():
                if isinstance(image,IndirectObject):used_images.add((image.idnum,image.generation))
                image=image.get_object()
                if image.get('/Subtype')!='/Image' or any(k in image for k in ['/SMask','/Mask','/Alternates','/OPI']): raster_ok=False
            if resources.get('/Font'): raster_ok=False
        if image_objects!=used_images:raster_ok=False
        if stream_objects-(used_images|content_streams|container_streams):raster_ok=False
    data=Path(path).read_bytes()
    revisions=data.count(b'%%EOF')
    return {'residual':residual,'structures':sorted(structures),'raster_contract':raster_ok,
            'stream_objects':len(stream_objects),'unaccounted_streams':len(stream_objects-(used_images|content_streams|container_streams)) if require_raster else None,
            'image_objects':len(image_objects),'painted_images':len(used_images),'revision_markers':revisions,'object_count':len(seen),'page_count':len(reader.pages),
            'sha256':hashlib.sha256(data).hexdigest()}

def inspect_pixels(path, original_path, regions):
    import fitz
    from PIL import Image
    if not original_path or not regions:
        return {'status':'incomplete','reason':'Original and approved region manifest required.'}
    with fitz.open(original_path) as original, fitz.open(path) as output:
        if len(original)!=len(output):return {'status':'failed','reason':'Page count mismatch.'}
        for a,b in zip(original,output):
            if abs(a.rect.width-b.rect.width)>.02 or abs(a.rect.height-b.rect.height)>.02:
                return {'status':'failed','reason':'Displayed page dimensions differ.'}
        checked=0; changed=0
        for region in regions:
            n=region.get('page'); box=region.get('box',{})
            if not isinstance(n,int) or isinstance(n,bool) or not 0<=n<len(output):return {'status':'incomplete','reason':'Invalid manifest page.'}
            vals=[box.get(k) for k in ('x','y','width','height')]
            if not all(isinstance(v,(float,int)) and math.isfinite(v) for v in vals):return {'status':'incomplete','reason':'Invalid manifest coordinates.'}
            x,y,w,h=vals
            # Region coordinates are displayed PDF points (crop and rotation already applied).
            if min(x,y)<0 or min(w,h)<=0 or x+w>original[n].rect.width+.001 or y+h>original[n].rect.height+.001:
                return {'status':'incomplete','reason':'Out-of-bounds manifest.'}
            rect=fitz.Rect(x,y,x+w,y+h)
            pix=output[n].get_pixmap(matrix=fitz.Matrix(2,2),clip=rect,alpha=False)
            before=original[n].get_pixmap(matrix=fitz.Matrix(2,2),clip=rect,alpha=False)
            if max(pix.samples,default=255)>8:return {'status':'failed','reason':'Approved region is not opaque black.','regions_checked':checked}
            changed+=int(before.samples!=pix.samples);checked+=1
            # Inspect the embedded image pixels as well as the rendered page: no removable overlay claim.
            images=output[n].get_images(full=True)
            if len(images)!=1:return {'status':'incomplete','reason':'Unsupported image composition.'}
            raw=fitz.Pixmap(output,images[0][0]); im=Image.frombytes('RGB' if raw.n==3 else 'RGBA',(raw.width,raw.height),raw.samples).convert('RGB')
            bounds=(math.ceil(x/output[n].rect.width*raw.width),math.ceil(y/output[n].rect.height*raw.height),math.floor((x+w)/output[n].rect.width*raw.width),math.floor((y+h)/output[n].rect.height*raw.height))
            if bounds[2]<=bounds[0] or bounds[3]<=bounds[1]:return {'status':'incomplete','reason':'Region too small to inspect.'}
            if max(v[1] for v in im.crop(bounds).getextrema())>8:return {'status':'failed','reason':'Embedded image retains approved pixels.'}
        return {'status':'passed','regions_checked':checked,'regions_changed':changed,'page_count':len(output),'parser':'PyMuPDF + Pillow','coordinates':'displayed PDF points'}
