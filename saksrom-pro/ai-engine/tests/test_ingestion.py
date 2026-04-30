from pathlib import Path

from pypdf import PdfWriter

from saksrom_ai.ingestion import ingest_document


def test_ingests_text_document_with_sources(tmp_path: Path):
    document_path = tmp_path / "notat.txt"
    document_path.write_text("Varsel ble sendt 12.03.2024.\nMotparten svarte.", encoding="utf-8")

    result = ingest_document("CASE-1", document_path)

    assert result.document.case_id == "CASE-1"
    assert result.document.page_count == 1
    assert result.document.ocr_status == "not_required"
    assert result.coverage_percent == 100.0
    assert result.pages[0].text_status == "extracted"
    assert result.chunks
    assert result.sources


def test_ingests_pdf_page_count_and_marks_ocr_needed(tmp_path: Path):
    document_path = tmp_path / "scan.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    writer.add_blank_page(width=72, height=72)
    with document_path.open("wb") as file:
        writer.write(file)

    result = ingest_document("CASE-1", document_path)

    assert result.document.page_count == 2
    assert result.document.ocr_status == "needs_ocr"
    assert result.coverage_percent == 0.0
    assert [page.text_status for page in result.pages] == ["needs_ocr", "needs_ocr"]
    assert result.warnings == ["page_1_needs_ocr", "page_2_needs_ocr"]
