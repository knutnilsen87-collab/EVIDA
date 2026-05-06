from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4()}"


class SourceStatus(str, Enum):
    supported = "SUPPORTED"
    partial = "PARTIAL"
    insufficient = "INSUFFICIENT"
    missing = "MISSING"


class CaseDocument(BaseModel):
    id: str = Field(default_factory=lambda: new_id("DOC"))
    case_id: str
    original_name: str
    sha256: str
    page_count: int = 0
    ocr_status: str = "not_started"


class PageExtraction(BaseModel):
    document_id: str
    page_number: int
    text: str = ""
    text_status: str = "not_extracted"
    sha256: str | None = None
    ocr_confidence: float | None = None


class DocumentIngestionResult(BaseModel):
    document: CaseDocument
    mime_type: str
    pages: list[PageExtraction] = Field(default_factory=list)
    chunks: list["Chunk"] = Field(default_factory=list)
    sources: list["SourceObject"] = Field(default_factory=list)
    coverage_percent: float = 0
    warnings: list[str] = Field(default_factory=list)


class Chunk(BaseModel):
    id: str = Field(default_factory=lambda: new_id("CHK"))
    document_id: str
    page_start: int
    page_end: int
    text: str
    sha256: str


class SourceObject(BaseModel):
    id: str = Field(default_factory=lambda: new_id("SRC"))
    document_id: str
    page_start: int
    page_end: int
    chunk_id: str
    text: str
    sha256: str
    bates_start: str | None = None
    bates_end: str | None = None
    ocr_confidence: float | None = None


class Citation(BaseModel):
    source_object_id: str
    document_id: str
    page_start: int
    page_end: int
    supports: str


class SourceBoundAnswer(BaseModel):
    answer: str
    source_status: SourceStatus
    citations: list[Citation] = Field(default_factory=list)
    unsupported_claims: list[str] = Field(default_factory=list)
    uncertainty: str | None = None
    recommended_next_step: str | None = None


class ChronologyEvent(BaseModel):
    id: str = Field(default_factory=lambda: new_id("EVT"))
    date_text: str
    normalized_date: str | None = None
    description: str
    citations: list[Citation]
    certainty: str = "unknown"


class Contradiction(BaseModel):
    id: str = Field(default_factory=lambda: new_id("CON"))
    topic: str
    kind: str
    description: str
    citations: list[Citation]
    status: str = "unresolved"


class RiskItem(BaseModel):
    id: str = Field(default_factory=lambda: new_id("RSK"))
    title: str
    severity: str
    likelihood: str
    description: str
    recommended_action: str
    citations: list[Citation]


class ControlReport(BaseModel):
    id: str = Field(default_factory=lambda: new_id("CTR"))
    case_id: str
    generated_at: datetime = Field(default_factory=now_utc)
    document_coverage_percent: float
    source_coverage_percent: float
    unsupported_claims: list[str] = Field(default_factory=list)
    weak_sources: list[str] = Field(default_factory=list)
    contradictions: list[str] = Field(default_factory=list)
    blocking: bool = False
    details: dict[str, Any] = Field(default_factory=dict)
