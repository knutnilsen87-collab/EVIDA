from __future__ import annotations

import re

from saksrom_ai.citations import citation_from_source
from saksrom_ai.models import ChronologyEvent, SourceObject

DATE_PATTERN = re.compile(
    r"(?P<date>(?:\d{1,2}\.\d{1,2}\.\d{2,4})|(?:\d{4}-\d{2}-\d{2}))"
)


def extract_chronology(sources: list[SourceObject]) -> list[ChronologyEvent]:
    events: list[ChronologyEvent] = []
    for source in sources:
        for match in DATE_PATTERN.finditer(source.text):
            start = max(0, match.start() - 80)
            end = min(len(source.text), match.end() + 160)
            snippet = source.text[start:end].strip()
            events.append(
                ChronologyEvent(
                    date_text=match.group("date"),
                    normalized_date=None,
                    description=snippet,
                    citations=[citation_from_source(source, "date/event extraction")],
                    certainty="medium",
                )
            )
    return events
