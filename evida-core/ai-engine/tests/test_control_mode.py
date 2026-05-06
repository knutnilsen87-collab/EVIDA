from saksrom_ai.control import detect_contradictions, validate_draft_against_sources
from saksrom_ai.models import SourceObject


def source(source_id: str, text: str, page: int = 1) -> SourceObject:
    return SourceObject(
        id=source_id,
        document_id="DOC-1",
        chunk_id=f"CHK-{source_id}",
        page_start=page,
        page_end=page,
        text=text,
        sha256=f"hash-{source_id}",
    )


def test_control_report_blocks_unsupported_draft_sentence():
    sources = [source("SRC-1", "Varsel ble sendt 12.03.2024.")]
    report = validate_draft_against_sources(
        case_id="CASE-1",
        draft_text="Varsel ble sendt 12.03.2024 [SRC-1]. Motparten innrømmet ansvar.",
        sources=sources,
        document_coverage_percent=100,
    )

    assert report.blocking is True
    assert report.unsupported_claims == ["Motparten innrømmet ansvar"]
    assert report.details["mode"] == "control"


def test_control_report_passes_source_marked_draft():
    sources = [source("SRC-1", "Varsel ble sendt 12.03.2024.")]
    report = validate_draft_against_sources(
        case_id="CASE-1",
        draft_text="Varsel ble sendt 12.03.2024 [SRC-1].",
        sources=sources,
        document_coverage_percent=100,
    )

    assert report.blocking is False
    assert report.unsupported_claims == []


def test_detects_simple_term_contradiction():
    sources = [
        source("SRC-1", "Fakturaen er betalt.", 1),
        source("SRC-2", "Fakturaen er ikke betalt.", 2),
    ]

    contradictions = detect_contradictions(sources)

    assert len(contradictions) == 1
    assert contradictions[0].topic == "betaling"
