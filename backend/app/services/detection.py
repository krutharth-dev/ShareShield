from typing import Protocol
from ..contracts.schemas import Finding


class DetectionEngine(Protocol):
    def detect(self, extracted_content: dict, file_id: str) -> list[Finding]:
        """Analyze extracted text and return source-located findings."""
        ...


class UnconfiguredDetector:
    """Safe placeholder: never claims that an input contains no sensitive data."""
    def detect(self, extracted_content: dict, file_id: str) -> list[Finding]:
        return []


# Manoj's module can replace this object with an adapter implementing detect().
detector: DetectionEngine | None = None

