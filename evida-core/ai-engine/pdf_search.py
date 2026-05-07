import argparse
import json
import re
import sqlite3
from pathlib import Path


def fts_query(value: str) -> str:
    terms = re.findall(r"[\wÆØÅæøå]+", value, flags=re.UNICODE)
    if not terms:
        return '""'
    return " OR ".join(f"{term}*" for term in terms[:12])


def search(db_path: Path, case_id: str, query: str, limit: int) -> list[dict]:
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    rows = conn.execute(
        """
        SELECT
          d.id AS document_id,
          d.filename,
          s.page_number,
          s.chunk_id,
          snippet(document_search, 3, '[', ']', '...', 20) AS snippet
        FROM document_search s
        JOIN documents d ON d.id = s.document_id
        WHERE d.case_id = ?
          AND document_search MATCH ?
        LIMIT ?
        """,
        (case_id, fts_query(query), limit),
    ).fetchall()

    conn.close()

    return [dict(row) for row in rows]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--case-id", required=True)
    parser.add_argument("--query", required=True)
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()

    results = search(
        db_path=Path(args.db),
        case_id=args.case_id,
        query=args.query,
        limit=args.limit,
    )

    print(json.dumps({"results": results}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
