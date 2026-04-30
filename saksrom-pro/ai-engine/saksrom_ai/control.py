from __future__ import annotations

import re

from saksrom_ai.chronology import extract_chronology
from saksrom_ai.citations import citation_from_source, find_unsupported_sentences
from saksrom_ai.models import Citation, Contradiction, ControlReport, SourceObject
from saksrom_ai.risk import build_control_report, risks_from_contradictions


SOURCE_MARKER_PATTERN = re.compile(r"\[(SRC-[^\]\s]+)\]")


def citation_markers_for_sources(sources: list[SourceObject]) -> list[str]:
    return [f"[{source.id}]" for source in sources]


def validate_draft_against_sources(
    *,
    case_id: str,
    draft_text: str,
    sources: list[SourceObject],
    document_coverage_percent: float,
) -> ControlReport:
    markers = citation_markers_for_sources(sources)
    unsupported = find_unsupported_sentences(draft_text, markers)
    cited_ids = set(SOURCE_MARKER_PATTERN.findall(draft_text))
    source_ids = {source.id for source in sources}
    weak_sources = sorted(cited_ids - source_ids)
    contradictions = detect_contradictions(sources)

    report = build_control_report(
        case_id=case_id,
        document_coverage_percent=document_coverage_percent,
        source_coverage_percent=source_coverage_percent(sources),
        unsupported_claims=unsupported,
        weak_sources=[f"Unknown source marker: {source_id}" for source_id in weak_sources],
        contradictions=[item.description for item in contradictions],
    )
    report.details.update(
        {
            "mode": "control",
            "source_count": len(sources),
            "chronology_event_count": len(extract_chronology(sources)),
            "risk_count": len(risks_from_contradictions(contradictions)),
            "required_citation_format": "[SRC-...]",
        }
    )
    return report


def source_coverage_percent(sources: list[SourceObject]) -> float:
    if not sources:
        return 0.0
    covered_pages = {(source.document_id, page) for source in sources for page in range(source.page_start, source.page_end + 1)}
    max_pages_by_document: dict[str, int] = {}
    for source in sources:
        max_pages_by_document[source.document_id] = max(
            max_pages_by_document.get(source.document_id, 0),
            source.page_end,
        )
    possible_pages = sum(max_pages_by_document.values())
    if possible_pages == 0:
        return 0.0
    return round((len(covered_pages) / possible_pages) * 100, 2)


def detect_contradictions(sources: list[SourceObject]) -> list[Contradiction]:
    contradictions: list[Contradiction] = []
    combined = " ".join(source.text.lower() for source in sources)
    checks = [
        ("betaling", ["betalt", "ikke betalt"]),
        ("signatur", ["signert", "ikke signert"]),
        ("frist", ["frist overholdt", "frist oversittet"]),
    ]
    for topic, terms in checks:
        if all(term in combined for term in terms):
            citations = _citations_for_terms(sources, terms)
            contradictions.append(
                Contradiction(
                    topic=topic,
                    kind="term_conflict",
                    description=f"Mulig motstrid: dokumentgrunnlaget inneholder både '{terms[0]}' og '{terms[1]}'.",
                    citations=citations,
                    status="unresolved",
                )
            )
    return contradictions


def _citations_for_terms(sources: list[SourceObject], terms: list[str]) -> list[Citation]:
    citations: list[Citation] = []
    for source in sources:
        text = source.text.lower()
        if any(term in text for term in terms):
            citations.append(citation_from_source(source, "contradiction detection"))
    return citations
