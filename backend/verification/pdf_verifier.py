"""Fail-cautious verification of a saved PDF (not the in-memory redaction result)."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import re, shutil, time
from .export_inspection import inspect_structure, inspect_pixels

@dataclass(frozen=True)
class VerificationInput:
    output_path: str | Path
    original_file_type: str = "pdf"
    selected_findings: list[dict[str, Any] | str] = field(default_factory=list)
    location_information: dict[str, Any] = field(default_factory=dict)
    redaction_metadata: dict[str, Any] = field(default_factory=dict)
    required_checks: list[str] = field(default_factory=lambda: ["pdf_text_extraction","rendered_ocr","metadata_attachments"])
    original_path: str | Path | None = None
    approved_regions: list[dict[str, Any]] = field(default_factory=list)
    unresolved_review: bool = False
    require_raster: bool = False
    timeout_seconds: float = 20.0
    ocr_language: str = "eng"

PATTERNS = {
 "email": re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"),
 "phone": re.compile(r"(?<!\w)(?:\+?\d[\d .()\-]{7,}\d)(?!\w)"),
 "aadhaar_like": re.compile(r"(?<!\d)(?:\d[ -]?){12}(?!\d)"),
 "pan_like": re.compile(r"(?i)\b[A-Z]{5}\d{4}[A-Z]\b"),
}
def _norm(s): return re.sub(r"\s+", " ", s).strip().casefold()
def _values(items):
 out=[]
 for x in items:
  value=(x if isinstance(x,str) else x.get("value") or x.get("text") or x.get("matched_text")) if isinstance(x,(str,dict)) else None
  cat="selected_sensitive_value" if isinstance(x,str) else (x.get("category") or x.get("entity_type") or "selected_sensitive_value") if isinstance(x,dict) else "selected_sensitive_value"
  if isinstance(value,str) and value.strip(): out.append({"value":value.strip(),"category":str(cat)})
 return sorted(out,key=lambda x:len(x["value"]),reverse=True)
def _fresh(text):
 from backend.detection.engine import detect_sensitive_data
 result = [{"category":f.category.lower(),"value":f.value,"source":"fresh_text_scan"} for f in detect_sensitive_data(text)]
 return result
def _report(status,out,checks,warnings,findings,start,req=None):
 return {"schema_version":"1.0","status":status,"output":{"filename":"shareshield-output.pdf","format":"pdf","size_bytes":out.stat().st_size if out.is_file() else None},
 "checks":checks,"warnings":list(dict.fromkeys(warnings)),"remaining_findings":[{k:v for k,v in item.items() if k in {"category","page","source","match_type"}} for item in findings],
 "redaction_metadata":{"details_withheld":bool(req and req.redaction_metadata)},"location_information":{"details_withheld":bool(req and req.location_information)},
 "verified_at":datetime.now(timezone.utc).isoformat(),"duration_ms":round((time.monotonic()-start)*1000,2),
 "scope_note":"SCOPED_CLEAR covers only completed checks; it is not a universal security guarantee."}
def verify_pdf(req: VerificationInput) -> dict[str,Any]:
 """Reopen saved output, compare selected values, fresh-scan text, OCR rendered pages and inspect metadata/attachments."""
 start=time.monotonic(); out=Path(req.output_path); checks=[]; warnings=[]; findings=[]
 supported={"pdf_text_extraction","rendered_ocr","metadata_attachments"}
 for name in sorted(set(req.required_checks)-supported):
  checks.append({"name":name,"status":"skipped","required":True,"detail":"No verifier implemented for this check."})
  warnings.append(f"Required check '{name}' is unsupported.")
 if req.original_file_type.lower().lstrip(".")!="pdf":
  return _report("UNVERIFIED",out,checks,warnings+["This verifier supports PDF only."],findings,start,req)
 if not out.is_file() or out.stat().st_size==0:
  return _report("UNVERIFIED",out,checks,warnings+["Saved output is missing or empty."],findings,start,req)
 selected=_values(req.selected_findings); deadline=start+max(.1,req.timeout_seconds); doc=None
 try:
  import fitz
  doc=fitz.open(str(out))
  if doc.is_encrypted and not doc.authenticate(""): raise RuntimeError("Encrypted PDF cannot be inspected.")
  if len(doc)>100 or any(p.rect.width*p.rect.height*4>12_000_000 for p in doc):
   raise ValueError("Inspection resource limit exceeded")
  try:
   structure=inspect_structure(out,[x["value"] for x in selected],req.require_raster)
   if structure["residual"]:findings.append({"category":"selected_sensitive_value","source":"pdf_objects","match_type":"selected_value_in_object"})
   structural_failure=req.require_raster and (bool(structure["structures"]) or not structure["raster_contract"] or structure["revision_markers"]!=1)
   if structural_failure:findings.append({"category":"unsafe_pdf_structure","source":"pdf_objects","match_type":"reconstruction_contract_failed"})
   checks.append({"name":"pdf_structure","required":True,"status":"failed" if structural_failure else "incomplete" if structure["structures"] or structure["revision_markers"]!=1 else "passed",**structure})
  except Exception:
   checks.append({"name":"pdf_structure","required":True,"status":"incomplete","detail":"Independent object inspection failed."})
  if selected or req.approved_regions or req.require_raster:
   try: pixel=inspect_pixels(out,req.original_path,req.approved_regions)
   except Exception: pixel={"status":"incomplete","reason":"Independent pixel inspection failed."}
   checks.append({"name":"approved_pixels","required":True,**pixel})
   if pixel["status"]=="failed":findings.append({"category":"approved_region_exposed","source":"pixel_inspection","match_type":"mask_or_geometry_failed"})
  if req.unresolved_review:checks.append({"name":"human_review","required":True,"status":"incomplete"})
  if "pdf_text_extraction" in req.required_checks:
   text="\n".join(p.get_text("text") for p in doc)
   checks.append({"name":"pdf_text_extraction","status":"passed","required":True,"pages_checked":len(doc),"parser":"PyMuPDF"})
   for x in selected:
    if _norm(x["value"]) in _norm(text): findings.append({**x,"source":"pdf_text_extraction","match_type":"selected_value_residual"})
   findings.extend(_fresh(text))
  else: checks.append({"name":"pdf_text_extraction","status":"skipped","required":False})
  if "rendered_ocr" in req.required_checks:
   try:
    import pytesseract
    from PIL import Image
    if not shutil.which("tesseract"): raise RuntimeError("Tesseract executable not found")
    pages=[]
    for p in doc:
     if time.monotonic()>deadline: raise TimeoutError("OCR timed out")
     pix=p.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
     pages.append(pytesseract.image_to_string(Image.frombytes("RGB",[pix.width,pix.height],pix.samples),timeout=max(1,int(deadline-time.monotonic())),lang=req.ocr_language,config="--psm 3"))
    if not any(p.strip() for p in pages):warnings.append("OCR returned no readable text; absence is not removal evidence.")
    ocr="\n".join(pages)
    checks.append({"name":"rendered_ocr","status":"passed" if all(p.strip() for p in pages) else "incomplete","required":True,"pages_checked":len(doc),"engine":"Tesseract","languages":req.ocr_language})
    for x in selected:
     if _norm(x["value"]) in _norm(ocr): findings.append({**x,"source":"rendered_ocr","match_type":"selected_value_visible_in_render"})
    findings.extend(_fresh(ocr))
   except Exception as e:
    checks.append({"name":"rendered_ocr","status":"failed","required":True,"detail":f"{type(e).__name__}: verification dependency failed"})
    warnings.append("Rendered OCR failed; visual residual exposure is uncertain.")
  else: checks.append({"name":"rendered_ocr","status":"skipped","required":False})
  if "metadata_attachments" in req.required_checks:
   try:
    meta=doc.metadata or {}; mt=" ".join(str(v) for v in meta.values() if v is not None) + " " + (doc.get_xml_metadata() or "")
    findings.extend(_fresh(mt))
    for x in selected:
     if _norm(x["value"]) in _norm(mt): findings.append({**x,"source":"pdf_metadata","match_type":"selected_value_in_metadata"})
    from pypdf import PdfReader
    attachments=list((getattr(PdfReader(str(out),strict=False),"attachments",{}) or {}).keys())
    status="incomplete" if attachments else "passed"
    checks.append({"name":"metadata_attachments","status":status,"required":True,"metadata_fields_checked":len(meta),"attachment_count":len(attachments),"parser":"PyMuPDF + pypdf"})
    if attachments: warnings.append("Embedded attachments were found but their contents were not recursively scanned.")
   except Exception as e:
    checks.append({"name":"metadata_attachments","status":"failed","required":True,"detail":f"{type(e).__name__}: inspection failed"})
    warnings.append("Metadata/attachment inspection failed.")
  else: checks.append({"name":"metadata_attachments","status":"skipped","required":False})
 except Exception as e:
  checks.append({"name":"pdf_open_and_parse","status":"failed","required":True,"detail":f"{type(e).__name__}: inspection failed"})
  warnings.append("Saved PDF is corrupt, encrypted or could not be parsed.")
 finally:
  if doc is not None: doc.close()
 # De-duplicate findings while retaining distinct evidence sources.
 unique=[]; seen=set()
 for f in findings:
  k=(f.get("category"),f.get("value"),f.get("source"),f.get("match_type"))
  if k not in seen: seen.add(k); unique.append(f)
 incomplete=not req.required_checks or any(c.get("required") and c["status"]!="passed" for c in checks) or bool(set(req.required_checks)-supported)
 status="FLAG" if unique else "UNVERIFIED" if incomplete else "SCOPED_CLEAR"
 if status=="SCOPED_CLEAR": warnings.append("Only the listed checks passed; no universal safety guarantee.")
 if status=="UNVERIFIED": warnings.append("Do not treat this output as verified safe; required checks are incomplete.")
 return _report(status,out,checks,warnings,unique,start,req)

