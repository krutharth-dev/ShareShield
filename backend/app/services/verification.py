from typing import Protocol
from pathlib import Path


class VerificationResult(Protocol):
    status: str
    remaining_findings: list[dict]
    limitations: list[str]


class OutputVerifier(Protocol):
    def verify(self, output_path: Path) -> VerificationResult:
        """Independently inspect the produced file; do not trust API success alone."""
        ...


# Nikhil's verifier should implement OutputVerifier. It is not yet wired into
# the API response; do not claim output verification until integration is done.

