from __future__ import annotations

import re

SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9_\-]{10,}"),
    re.compile(r"(?i)(api[_-]?key|token|secret)\s*[:=]\s*[^\s]+"),
    re.compile(r"(?i)authorization:\s*bearer\s+[^\s]+"),
]


def redact_text(value: str) -> str:
    redacted = value
    for pattern in SECRET_PATTERNS:
        redacted = pattern.sub("[REDACTED_SECRET]", redacted)

    # Windows absolute paths can leak client/matter names.
    redacted = re.sub(r"[A-Z]:\\[^\n\r\t]+", "[REDACTED_PATH]", redacted)
    return redacted
