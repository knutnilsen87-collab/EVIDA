from __future__ import annotations

from saksrom_ai.citations import citation_from_source, validate_answer_sources
from saksrom_ai.models import SourceBoundAnswer, SourceStatus, SourceObject
from saksrom_ai.retrieval import SimpleSourceIndex


class SourceBoundAgent:
    def __init__(self, sources: list[SourceObject]) -> None:
        self.sources = sources
        self.index = SimpleSourceIndex(sources)

    def answer_from_sources(self, question: str) -> SourceBoundAnswer:
        hits = self.index.search(question, limit=3)
        if not hits:
            return SourceBoundAnswer(
                answer="Dokumentgrunnlaget jeg har tilgang til gir ikke tilstrekkelig kilde for å svare.",
                source_status=SourceStatus.insufficient,
                citations=[],
                unsupported_claims=[],
                uncertainty="Ingen relevante kildeobjekter funnet.",
                recommended_next_step="Importer flere dokumenter eller avgrens spørsmålet.",
            )

        # MVP deterministic answer. Provider-based synthesis can be added behind policy gate.
        answer = "Foreløpig kildebasert funn: " + " ".join(hit.text[:240] for hit in hits[:2])
        citations = [citation_from_source(source, "retrieved support for question") for source in hits]
        return validate_answer_sources(answer, citations, hits)
