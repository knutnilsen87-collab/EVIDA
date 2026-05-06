from saksrom_ai.agent import SourceBoundAgent
from saksrom_ai.chunking import chunks_to_sources, split_text_into_chunks
from saksrom_ai.models import SourceStatus


def test_source_bound_agent_returns_citations():
    chunks = split_text_into_chunks(
        document_id="DOC-1",
        text="Varsel ble sendt 12.03.2024. Motparten svarte 15.03.2024.",
    )
    sources = chunks_to_sources(chunks)
    answer = SourceBoundAgent(sources).answer_from_sources("Når ble varsel sendt?")
    assert answer.source_status == SourceStatus.supported
    assert answer.citations
