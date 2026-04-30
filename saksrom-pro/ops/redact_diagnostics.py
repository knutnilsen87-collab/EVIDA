from __future__ import annotations

import argparse
import re
from pathlib import Path

PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9_\-]{10,}"),
    re.compile(r"(?i)(api[_-]?key|token|secret)\s*[:=]\s*[^\s]+"),
    re.compile(r"(?i)authorization:\s*bearer\s+[^\s]+"),
    re.compile(r"[A-Z]:\\[^\n\r\t]+"),
]


def redact(value: str) -> tuple[str, int]:
    count = 0
    output = value
    for pattern in PATTERNS:
        output, n = pattern.subn("[REDACTED]", output)
        count += n
    return output, count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.out) if args.out else input_path.with_suffix(input_path.suffix + ".redacted")
    redacted, count = redact(input_path.read_text(encoding="utf-8", errors="replace"))
    output_path.write_text(redacted, encoding="utf-8")
    print(f"Wrote {output_path} ({count} redactions)")


if __name__ == "__main__":
    main()
