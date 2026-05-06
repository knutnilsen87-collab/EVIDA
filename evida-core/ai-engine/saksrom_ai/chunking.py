from __future__ import annotations

import re

from saksrom_ai.hashing import sha256_text
from saksrom_ai.models import Chunk, SourceObject


def split_text_into_chunks(
    *,
    document_id: str,
    text: str,
    page_start: int = 1,
    max_chars: int = 1600,
) -> list[Chunk]:
    """Simple MVP chunker. Replace with page-aware PDF parser in production."""
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []

    chunks: list[Chunk] = []
    cursor = 0
    while cursor < len(normalized):
        piece = normalized[cursor : cursor + max_chars].strip()
        if piece:
            chunks.append(
                Chunk(
                    document_id=document_id,
                    page_start=page_start,
                    page_end=page_start,
                    text=piece,
                    sha256=sha256_text(piece),
                )
            )
        cursor += max_chars
    return chunks


def chunks_to_sources(chunks: list[Chunk]) -> list[SourceObject]:
    return [
        SourceObject(
            document_id=chunk.document_id,
            page_start=chunk.page_start,
            page_end=chunk.page_end,
            chunk_id=chunk.id,
            text=chunk.text,
            sha256=sha256_text(
                f"{chunk.document_id}:{chunk.page_start}:{chunk.page_end}:{chunk.sha256}"
            ),
        )
        for chunk in chunks
    ]
