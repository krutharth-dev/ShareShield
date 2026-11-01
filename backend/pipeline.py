"""Provisional structured contract; align field types with the API owner before integration."""
from uuid import uuid4
from backend.detection import detect_sensitive_data
from backend.risk import classify_risk

def analyze_text(text: str, file_id: str, language: str = "auto",
                 page: int | None = None, ocr_confidence: float | None = None) -> dict:
    results = []
    for f in detect_sensitive_data(text, language=language, page=page):
        results.append({
            "finding_id": str(uuid4()), "file_id": file_id, "category": f.category,
            "value": f.value, "risk_level": classify_risk(f.category),
            "detection_confidence": f.confidence, "ocr_confidence": ocr_confidence,
            "language": f.language,
            "location": {"page": page, "start": f.start, "end": f.end, "bbox": None},
            "evidence": f.evidence,
            "manual_review_required": (f.confidence < .80 or
                (ocr_confidence is not None and ocr_confidence < .60)),
        })
    return {"file_id": file_id, "findings": results}

