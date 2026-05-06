from __future__ import annotations

import mimetypes
from pathlib import Path

from pypdf import PdfReader

from saksrom_ai.chunking import chunks_to_sources, split_text_into_chunks
from saksrom_ai.hashing import sha256_file, sha256_text
from saksrom_ai.models import CaseDocument, DocumentIngestionResult, PageExtraction
from saksrom_ai.ocr import ocr_image_with_tesseract


TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".log"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp"}


def ingest_document(case_id: str, path: str | Path) -> DocumentIngestionResult:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Document does not exist: {file_path}")
    if not file_path.is_file():
        raise ValueError(f"Document path is not a file: {file_path}")

    mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    document = CaseDocument(
        case_id=case_id,
        original_name=file_path.name,
        sha256=sha256_file(file_path),
    )

    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        return _ingest_pdf(document, file_path, mime_type)
    if suffix in TEXT_EXTENSIONS:
        return _ingest_text(document, file_path, mime_type)
    if suffix in IMAGE_EXTENSIONS:
        return _ingest_image(document, file_path, mime_type)

    return DocumentIngestionResult(
        document=document,
        mime_type=mime_type,
        warnings=["unsupported_file_type"],
    )


def _ingest_text(
    document: CaseDocument, file_path: Path, mime_type: str
) -> DocumentIngestionResult:
    text = file_path.read_text(encoding="utf-8", errors="replace")
    text_hash = sha256_text(text)
    page = PageExtraction(
        document_id=document.id,
        page_number=1,
        text=text,
        text_status="extracted" if text.strip() else "empty",
        sha256=text_hash,
    )
    chunks = split_text_into_chunks(document_id=document.id, text=text, page_start=1)
    sources = chunks_to_sources(chunks)
    document.page_count = 1
    document.ocr_status = "not_required" if text.strip() else "empty"
    return DocumentIngestionResult(
        document=document,
        mime_type=mime_type,
        pages=[page],
        chunks=chunks,
        sources=sources,
        coverage_percent=100.0 if sources else 0.0,
    )


def _ingest_pdf(
    document: CaseDocument, file_path: Path, mime_type: str
) -> DocumentIngestionResult:
    reader = PdfReader(str(file_path))
    pages: list[PageExtraction] = []
    chunks = []
    warnings: list[str] = []

    for index, pdf_page in enumerate(reader.pages, start=1):
        extracted = pdf_page.extract_text() or ""
        status = "extracted" if extracted.strip() else "needs_ocr"
        if status == "needs_ocr":
            warnings.append(f"page_{index}_needs_ocr")
        pages.append(
            PageExtraction(
                document_id=document.id,
                page_number=index,
                text=extracted,
                text_status=status,
                sha256=sha256_text(extracted) if extracted else None,
            )
        )
        chunks.extend(
            split_text_into_chunks(
                document_id=document.id,
                text=extracted,
                page_start=index,
            )
        )

    sources = chunks_to_sources(chunks)
    document.page_count = len(reader.pages)
    if not pages:
        document.ocr_status = "failed"
    elif all(page.text_status == "extracted" for page in pages):
        document.ocr_status = "text_extracted"
    elif any(page.text_status == "extracted" for page in pages):
        document.ocr_status = "partial_needs_ocr"
    else:
        document.ocr_status = "needs_ocr"

    coverage_percent = 0.0
    if pages:
        pages_with_sources = {chunk.page_start for chunk in chunks}
        coverage_percent = round((len(pages_with_sources) / len(pages)) * 100, 2)

    return DocumentIngestionResult(
        document=document,
        mime_type=mime_type,
        pages=pages,
        chunks=chunks,
        sources=sources,
        coverage_percent=coverage_percent,
        warnings=warnings,
    )


def _ingest_image(
    document: CaseDocument, file_path: Path, mime_type: str
) -> DocumentIngestionResult:
    ocr = ocr_image_with_tesseract(file_path)
    text = ocr.text
    page = PageExtraction(
        document_id=document.id,
        page_number=1,
        text=text,
        text_status="ocr_extracted" if text else "needs_review",
        sha256=sha256_text(text) if text else None,
        ocr_confidence=ocr.confidence,
    )
    chunks = split_text_into_chunks(document_id=document.id, text=text, page_start=1)
    sources = chunks_to_sources(chunks)
    document.page_count = 1
    document.ocr_status = "ocr_ok" if ocr.status == "ok" and text else ocr.status
    return DocumentIngestionResult(
        document=document,
        mime_type=mime_type,
        pages=[page],
        chunks=chunks,
        sources=sources,
        coverage_percent=100.0 if sources else 0.0,
        warnings=ocr.warnings,
    )
