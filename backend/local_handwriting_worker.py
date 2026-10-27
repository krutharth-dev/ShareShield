"""Isolated, bounded CPU worker. Stdout is a private JSON pipe, not a log."""
from dataclasses import asdict
import io
import json
import re
import sys
import pymupdf as fitz
import numpy as np
from PIL import Image
from backend import engine
from backend.local_handwriting import MODEL_DIR


def load_model():
    from pathlib import Path
    import rapidocr
    from rapidocr import RapidOCR, OCRVersion, ModelType, LangRec
    cls = Path(rapidocr.__file__).parent / 'models/ch_ppocr_mobile_v2.0_cls_mobile.onnx'
    if not cls.is_file() or not all((MODEL_DIR/n).is_file() for n in ('det.onnx','rec.onnx')):
        raise RuntimeError('Model assets unavailable')
    return RapidOCR(params={
        'Det.ocr_version':OCRVersion.PPOCRV5, 'Det.model_type':ModelType.MOBILE,
        'Det.model_path':str(MODEL_DIR/'det.onnx'), 'Det.limit_type':'max', 'Det.limit_side_len':736,
        'Rec.ocr_version':OCRVersion.PPOCRV5, 'Rec.model_type':ModelType.MOBILE,
        'Rec.lang_type':LangRec.EN, 'Rec.model_path':str(MODEL_DIR/'rec.onnx'), 'Rec.rec_batch_num':1,
        'Cls.model_path':str(cls), 'Global.log_level':'critical', 'Global.return_word_box':True,
        'Global.text_score':0.0, 'Global.max_side_len':1400,
        'EngineConfig.onnxruntime.intra_op_num_threads':1,
        'EngineConfig.onnxruntime.inter_op_num_threads':1,
        'EngineConfig.onnxruntime.enable_cpu_mem_arena':False})


def convert(output, number, source_width, source_height, width, height):
    # Reuse validated geometry/word-span mapping without invoking any cloud API.
    from backend.handwriting import parse_result
    if output.txts is None:
        return []
    lines, words, labeled = [], [], []
    for line_index, (text, score, poly, group) in enumerate(zip(output.txts, output.scores, output.boxes, output.word_results)):
        if not text.strip():
            continue
        polygon = np.asarray(poly).clip([0,0],[width,height]).reshape(-1).tolist()
        lines.append({'content':text, 'polygon':polygon})
        valid_words = [(word,confidence,box) for word,confidence,box in group if word and box is not None]
        if not valid_words:
            valid_words = [(text,float(score),poly)]
        joined = ' '.join(word for word,confidence,box in valid_words)
        match = re.match(r'^(?:full\s+)?(name|address)\s*[:\-]\s*(\S.*)$', joined, re.I)
        if match:
            offset, targets = 0, []
            for word,confidence,box in valid_words:
                end = offset + len(word)
                if end > match.start(2):
                    targets.append((box,confidence))
                offset = end + 1
            labeled.append((match.group(1).lower()+'_candidate', match.group(2), targets))
        for word,confidence,box in valid_words:
            polygon = np.asarray(box).clip([0,0],[width,height]).reshape(-1).tolist()
            words.append({'content':word,'confidence':float(confidence),'polygon':polygon, 'line_index':line_index})
    if len(lines) > 250 or len(words) > 2000:
        raise ValueError('Too much text; split the file')
    result = {'pages':[{'unit':'pixel','width':width,'height':height,'words':words,'lines':lines}]}
    findings = parse_result(result,number,source_width,source_height)
    for category,value,targets in labeled:
        rectangles = []
        for polygon,confidence in targets:
            points = np.asarray(polygon).clip([0,0],[width,height])
            xs,ys = points[:,0],points[:,1]
            rectangles.append((float(min(xs))*source_width/width,float(min(ys))*source_height/height,
                               float(max(xs))*source_width/width,float(max(ys))*source_height/height))
        # Prefer the value-only boxes over a broader label-based proposal.
        findings = [f for f in findings if not (f.category == category and any(
            fitz.Rect(a).intersects(fitz.Rect(b)) for a in f.rectangles for b in rectangles))]
        findings.append(engine.Finding(category,value,number,rectangles,'pretrained-handwriting',
                                       min(float(score) for _,score in targets) if targets else 0.0))
    for finding in findings:
        finding.location = 'pretrained-handwriting'
    return findings


def recognize(data, ext):
    # This worker has no network role. Fail closed if a dependency tries to
    # fetch missing models or send document content during inference.
    import socket
    def no_network(*args, **kwargs):
        raise RuntimeError('Network is disabled in handwriting workers')
    socket.socket.connect = no_network
    socket.create_connection = no_network
    model = load_model()
    findings = []
    def run(image,number,width,height):
        image.thumbnail((1400,1400))
        output = model(np.asarray(image)[:,:,::-1])
        findings.extend(convert(output,number,width,height,image.width,image.height))
        if len(findings) > engine.MAX_FINDINGS:
            raise ValueError('Too many candidates')
    if ext == '.pdf':
        with engine.open_pdf(data) as doc:
            if doc.page_count > 2:
                raise ValueError('Too many pages')
            for number,page in enumerate(doc,1):
                scale = min(2,1400/max(page.rect.width,page.rect.height))
                pix=engine.render_pdf_page(page, scale)
                image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
                run(image,number,page.rect.width,page.rect.height)
                del image, pix
    else:
        image=engine.read_image(data)
        run(image,1,image.width,image.height)
    return findings


if __name__ == '__main__':
    try:
        payload = sys.stdin.buffer.read(engine.MAX_BYTES+1)
        engine.validate_bytes(payload)
        result = recognize(payload, sys.argv[1])
        sys.stdout.write(json.dumps({'findings':[asdict(f) for f in result]}))
    except Exception:
        # Never put recognized identifiers, uploaded bytes or library traces in logs.
        sys.exit(1)
