from __future__ import annotations

import re

from saksrom_ai.models import Citation, SourceBoundAnswer, SourceObject, SourceStatus


def citation_from_source(source: SourceObject, supports: str) -> Citation:
    return Citation(
        source_object_id=source.id,
        document_id=source.document_id,
        page_start=source.page_start,
        page_end=source.page_end,
        supports=supports,
    )


def validate_answer_sources(
    answer_text: str,
    citations: list[Citation],
    available_sources: list[SourceObject],
) -> SourceBoundAnswer:
    source_ids = {source.id for source in available_sources}
    invalid = [citation.source_object_id for citation in citations if citation.source_object_id not in source_ids]

    if invalid:
        return SourceBoundAnswer(
            answer=answer_text,
            source_status=SourceStatus.partial,
            citations=[c for c in citations if c.source_object_id in source_ids],
            unsupported_claims=[f"Invalid citation: {source_id}" for source_id in invalid],
            uncertainty="One or more citations do not exist in the retrieval snapshot.",
            recommended_next_step="Re-run retrieval or remove unsupported claims.",
        )

    if not citations:
        return SourceBoundAnswer(
            answer=answer_text,
            source_status=SourceStatus.insufficient,
            citations=[],
            unsupported_claims=[answer_text] if answer_text.strip() else [],
            uncertainty="No citations were provided.",
            recommended_next_step="Retrieve sources before answering.",
        )

    return SourceBoundAnswer(
        answer=answer_text,
        source_status=SourceStatus.supported,
        citations=citations,
    )


def find_unsupported_sentences(draft_text: str, citation_markers: list[str]) -> list[str]:
    normalized = re.sub(r"\s+", " ", draft_text).strip()
    sentences = [
        item.strip().rstrip(".!?")
        for item in re.split(r"(?<=[.!?])\s+(?=[A-ZÆØÅ])", normalized)
        if item.strip()
    ]
    unsupported: list[str] = []
    for sentence in sentences:
        if not any(marker in sentence for marker in citation_markers):
            unsupported.append(sentence)
    return unsupported
