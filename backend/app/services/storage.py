import json
import shutil
import time
from pathlib import Path


class JobStorage:
    def __init__(self, root: Path, ttl_seconds: int = 24 * 60 * 60):
        self.root = root
        self.ttl_seconds = ttl_seconds
        self.root.mkdir(parents=True, exist_ok=True)

    def job_dir(self, job_id: str) -> Path:
        if not job_id.isalnum() or len(job_id) != 32:
            raise ValueError("Invalid job identifier.")
        return self.root / job_id

    def create_job(self, job_id: str):
        (self.job_dir(job_id) / "inputs").mkdir(parents=True, exist_ok=False)
        (self.job_dir(job_id) / "outputs").mkdir()

    def input_path(self, job_id: str, file_id: str, suffix: str) -> Path:
        if not file_id.isalnum() or len(file_id) != 32:
            raise ValueError("Invalid file identifier.")
        return self.job_dir(job_id) / "inputs" / f"{file_id}{suffix}"

    def output_path(self, job_id: str, file_id: str, suffix: str) -> Path:
        if not file_id.isalnum() or len(file_id) != 32:
            raise ValueError("Invalid file identifier.")
        return self.job_dir(job_id) / "outputs" / f"{file_id}{suffix}"

    def find_input(self, job_id: str, file_id: str) -> Path:
        if not file_id.isalnum() or len(file_id) != 32:
            raise FileNotFoundError("Input not found.")
        folder = self.job_dir(job_id) / "inputs"
        matches = list(folder.glob(f"{file_id}.*"))
        if len(matches) != 1:
            raise FileNotFoundError("Input not found.")
        return matches[0]

    def find_output(self, job_id: str, file_id: str):
        if not file_id.isalnum() or len(file_id) != 32:
            return None
        folder = self.job_dir(job_id) / "outputs"
        matches = list(folder.glob(f"{file_id}.*"))
        return matches[0] if len(matches) == 1 else None

    def write_manifest(self, job_id: str, data):
        (self.job_dir(job_id) / "manifest.json").write_text(
            json.dumps(data), encoding="utf-8"
        )

    def read_manifest(self, job_id: str):
        try:
            return json.loads((self.job_dir(job_id) / "manifest.json").read_text("utf-8"))
        except (OSError, ValueError):
            return None

    def remove_job(self, job_id: str):
        shutil.rmtree(self.job_dir(job_id), ignore_errors=True)

    def cleanup_expired(self) -> int:
        """Remove jobs whose directory has not been modified within the TTL."""
        cutoff = time.time() - self.ttl_seconds
        removed = 0
        for child in self.root.iterdir():
            if not child.is_dir():
                continue
            try:
                if child.stat().st_mtime < cutoff:
                    shutil.rmtree(child)
                    removed += 1
            except FileNotFoundError:
                continue
        return removed

