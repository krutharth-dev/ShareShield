from pydantic import BaseModel, Field, model_validator


class Region(BaseModel):
    """Server-owned source coordinates: PDF points or image pixels."""
    page: int | None = Field(default=None, ge=0)
    x0: float = Field(ge=0)
    y0: float = Field(ge=0)
    x1: float = Field(gt=0)
    y1: float = Field(gt=0)

    @model_validator(mode="after")
    def valid_rectangle(self):
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise ValueError("Region must have positive width and height.")
        return self


class Finding(BaseModel):
    finding_id: str = Field(min_length=1, max_length=128)
    category: str = Field(min_length=1, max_length=80)
    confidence: float = Field(ge=0, le=1)
    text: str | None = Field(default=None, max_length=2000)
    location: Region
    explanation: str | None = Field(default=None, max_length=500)


class FileSelection(BaseModel):
    file_id: str = Field(min_length=32, max_length=32)
    finding_ids: list[str] = Field(min_length=1, max_length=500)


class RedactionRequest(BaseModel):
    job_id: str = Field(min_length=32, max_length=32)
    selections: list[FileSelection] = Field(min_length=1, max_length=10)

