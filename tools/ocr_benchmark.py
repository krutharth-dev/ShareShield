"""Reproducible local OCR benchmark for consented/synthetic data.

Manifest JSON is an array of {"image":"relative/path.png","truth":"...","language":"eng|kan|eng+kan","split":"heldout"}.
Do not commit real personal documents. Run:
python tools/ocr_benchmark.py corpus/manifest.json --output results.json

Requires Pillow, pytesseract and installed Tesseract language packs.
"""
import argparse
import json
import statistics
import time
import unicodedata
from pathlib import Path
import pytesseract
from PIL import Image, ImageEnhance, ImageOps

def norm(s):
    return " ".join(unicodedata.normalize("NFC",s).split()).casefold()

def edits(a,b):
    prior=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        current=[i]
        for j,y in enumerate(b,1):
            current.append(min(current[-1]+1,prior[j]+1,prior[j-1]+(x!=y)))
        prior=current
    return prior[-1]

def preprocess(image,variant):
    if variant=="raw":
        return image
    if variant=="contrast":
        return ImageEnhance.Contrast(ImageOps.autocontrast(image.convert("L"))).enhance(1.6)
    if variant=="threshold":
        grayscale=ImageOps.autocontrast(image.convert("L"))
        return grayscale.point(lambda p:255 if p>=160 else 0)
    raise ValueError(variant)

def run(manifest,output,variants):
    cases=json.loads(manifest.read_text(encoding="utf8"))
    if not isinstance(cases,list) or not cases:
        raise ValueError("Nonempty JSON manifest array required")
    rows=[]
    root=manifest.parent.resolve()
    for i,case in enumerate(cases):
        language=case["language"]
        if language not in {"eng","kan","eng+kan"}:raise ValueError("Unsupported language")
        image_path=(root/case["image"]).resolve()
        if root not in image_path.parents:raise ValueError("Images must stay in corpus folder")
        if image_path.stat().st_size>8*1024*1024:raise ValueError("Image too large")
        with Image.open(image_path) as im:
            if im.width*im.height>12_000_000:raise ValueError("Image pixel cap exceeded")
            source=im.convert("RGB")
        truth=norm(case["truth"])
        for variant in variants:
            start=time.perf_counter()
            try:
                pred=norm(pytesseract.image_to_string(preprocess(source,variant),lang=language,config="--oem 1 --psm 6",timeout=20))
                row={"case":i,"split":case.get("split","unassigned"),"language":language,"variant":variant,
                     "cer":edits(truth,pred)/max(1,len(truth)),
                     "wer":edits(truth.split(),pred.split())/max(1,len(truth.split())),
                     "elapsed_ms":round((time.perf_counter()-start)*1000)}
            except Exception as e:
                row={"case":i,"language":language,"variant":variant,"error":type(e).__name__}
            rows.append(row)
    aggregates=[]
    for language in sorted({r["language"] for r in rows}):
        for variant in variants:
            eligible=[r for r in rows if r["language"]==language and r["variant"]==variant and "cer" in r]
            aggregates.append({"language":language,"variant":variant,"n":len(eligible),
                              "mean_cer":round(statistics.mean(r["cer"] for r in eligible),4) if eligible else None,
                              "mean_wer":round(statistics.mean(r["wer"] for r in eligible),4) if eligible else None})
    report={"warning":"Small synthetic or consented samples do NOT establish production accuracy or handwriting performance",
            "tesseract_version":str(pytesseract.get_tesseract_version()),
            "rows":rows,"aggregates":aggregates}
    output.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf8")
    return report

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("manifest",type=Path)
    parser.add_argument("--output",type=Path,default=Path("ocr-results.json"))
    parser.add_argument("--variants",nargs="+",default=["raw","contrast","threshold"])
    args=parser.parse_args()
    print(json.dumps(run(args.manifest,args.output,args.variants)["aggregates"],indent=2))
