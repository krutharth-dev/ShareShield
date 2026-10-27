"""Build-time assets only. Pinned upstream revisions plus SHA-256 verification."""
import hashlib
from pathlib import Path
import urllib.request
from PIL import Image, ImageDraw, ImageFont
from backend.local_handwriting import MODEL_DIR

ASSETS = {
    'det.onnx': ('https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.2/onnx/PP-OCRv5/det/ch_PP-OCRv5_det_mobile.onnx','4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae'),
    'rec.onnx': ('https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.9.2/onnx/PP-OCRv5/rec/en_PP-OCRv5_rec_mobile.onnx','c3461add59bb4323ecba96a492ab75e06dda42467c9e3d0c18db5d1d21924be8'),
    'Caveat.ttf': ('https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/Caveat%5Bwght%5D.ttf','0bdb6b660482d31531b3945849fba5916b3ef8695da7024a9e6b9ee3c4157988'),
}


def prepare():
    MODEL_DIR.mkdir(parents=True,exist_ok=True)
    for name,(url,digest) in ASSETS.items():
        path=MODEL_DIR/name
        if path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest()==digest:
            continue
        with urllib.request.urlopen(url,timeout=90) as response:
            data=response.read(25*1024*1024)
        if hashlib.sha256(data).hexdigest()!=digest:
            raise RuntimeError('Asset hash mismatch: '+name)
        temporary=path.with_suffix('.download')
        temporary.write_bytes(data); temporary.replace(path)
    licenses = {
        'PaddleOCR-LICENSE.txt':'https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE',
        'RapidOCR-LICENSE.txt':'https://raw.githubusercontent.com/RapidAI/RapidOCR/v3.9.2/LICENSE',
        'Caveat-OFL.txt':'https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/OFL.txt',
    }
    for name,url in licenses.items():
        path=MODEL_DIR/name
        if not path.is_file():
            with urllib.request.urlopen(url,timeout=30) as response:
                path.write_bytes(response.read(100000))
    image=Image.new('RGB',(1100,700),'white')
    draw=ImageDraw.Draw(image); font=ImageFont.truetype(str(MODEL_DIR/'Caveat.ttf'),52)
    for i,line in enumerate(['FICTIONAL TEST NOTE','Name: Alex Example','Email: demo@example.org',
                             'Phone: 9876543210','DOB: 08/08/2006','Keep this public sentence.']):
        draw.text((50,35+i*95),line,font=font,fill='black')
    image.save(MODEL_DIR/'fictional-handwriting.png')


if __name__=='__main__':
    prepare()
    print('Handwriting assets verified; synthetic font sample prepared.')
