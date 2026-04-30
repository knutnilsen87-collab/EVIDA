from __future__ import annotations

import re
from collections import Counter

from saksrom_ai.models import SourceObject


def tokenize(value: str) -> list[str]:
    return re.findall(r"[\wæøåÆØÅ]{3,}", value.lower())


class SimpleSourceIndex:
    """Tiny lexical retrieval index for MVP tests. Replace with hybrid search/vector store."""

    def __init__(self, sources: list[SourceObject]) -> None:
        self.sources = sources
        self.source_terms = [Counter(tokenize(source.text)) for source in sources]

    def search(self, query: str, limit: int = 5) -> list[SourceObject]:
        query_terms = Counter(tokenize(query))
        scored: list[tuple[int, SourceObject]] = []
        for source, terms in zip(self.sources, self.source_terms):
            score = sum(min(count, terms.get(term, 0)) for term, count in query_terms.items())
            if score > 0:
                scored.append((score, source))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [source for _, source in scored[:limit]]
