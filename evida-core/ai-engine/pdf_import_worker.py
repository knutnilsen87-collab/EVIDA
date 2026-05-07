import argparse
import hashlib
import json
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

import fitz  # PyMuPDF


CHUNK_TARGET_WORDS = 900
CHUNK_OVERLAP_WORDS = 120
MAX_PDF_BYTES = 300 * 1024 * 1024


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def emit(event: dict) -> None:
    print(json.dumps(event, ensure_ascii=False), flush=True)


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def word_count(text: str) -> int:
    return len(re.findall(r"\S+", text or ""))


def normalize_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def init_db(conn: sqlite3.Connection, schema_path: Path) -> None:
    with schema_path.open("r", encoding="utf-8") as handle:
        conn.executescript(handle.read())
    ensure_schema_compat(conn)
    conn.commit()


def ensure_schema_compat(conn: sqlite3.Connection) -> None:
    table_columns = {
        row["name"] for row in conn.execute("PRAGMA table_info(documents)").fetchall()
    }
    document_columns = {
        "document_type": "TEXT",
        "local_processing": "INTEGER DEFAULT 1",
        "cloud_used": "INTEGER DEFAULT 0",
        "search_ready": "INTEGER DEFAULT 0",
        "citation_ready": "INTEGER DEFAULT 0",
        "ai_ready": "INTEGER DEFAULT 0",
    }
    for name, definition in document_columns.items():
        if name not in table_columns:
            conn.execute(f"ALTER TABLE documents ADD COLUMN {name} {definition}")

    chunk_columns = {
        row["name"] for row in conn.execute("PRAGMA table_info(document_chunks)").fetchall()
    }
    for name, definition in {
        "section_title": "TEXT",
        "chunk_type": "TEXT",
        "quality_score": "REAL",
    }.items():
        if name not in chunk_columns:
            conn.execute(f"ALTER TABLE document_chunks ADD COLUMN {name} {definition}")


def upsert_document(
    conn: sqlite3.Connection,
    document_id: str,
    case_id: str,
    pdf_path: Path,
    content_hash: str,
    status: str,
) -> None:
    timestamp = now_iso()
    conn.execute(
        """
        INSERT INTO documents (
          id, case_id, filename, original_path, file_size, content_hash,
          status, local_processing, cloud_used, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at
        """,
        (
            document_id,
            case_id,
            pdf_path.name,
            str(pdf_path),
            pdf_path.stat().st_size,
            content_hash,
            status,
            1,
            0,
            timestamp,
            timestamp,
        ),
    )
    conn.commit()


def update_document(conn: sqlite3.Connection, document_id: str, **fields) -> None:
    if not fields:
        return

    fields["updated_at"] = now_iso()
    assignments = ", ".join([f"{key} = ?" for key in fields.keys()])
    values = list(fields.values())
    values.append(document_id)

    conn.execute(f"UPDATE documents SET {assignments} WHERE id = ?", values)
    conn.commit()


def insert_page(
    conn: sqlite3.Connection,
    document_id: str,
    page_number: int,
    text: str,
    extraction_method: str,
    status: str,
    error_code: str | None = None,
) -> None:
    timestamp = now_iso()
    conn.execute(
        """
        INSERT OR REPLACE INTO document_pages (
          id, document_id, page_number, text, word_count,
          extraction_method, status, error_code, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            f"{document_id}_page_{page_number}",
            document_id,
            page_number,
            text,
            word_count(text),
            extraction_method,
            status,
            error_code,
            timestamp,
            timestamp,
        ),
    )


def create_chunks(conn: sqlite3.Connection, document_id: str) -> int:
    rows = conn.execute(
        """
        SELECT page_number, text
        FROM document_pages
        WHERE document_id = ?
          AND status IN ('text_extracted', 'ocr_completed')
        ORDER BY page_number ASC
        """,
        (document_id,),
    ).fetchall()

    chunk_index = 0
    timestamp = now_iso()

    conn.execute("DELETE FROM document_chunks WHERE document_id = ?", (document_id,))
    conn.execute("DELETE FROM document_search WHERE document_id = ?", (document_id,))

    current_words: list[str] = []
    current_page_start: int | None = None
    current_page_end: int | None = None

    def flush_chunk(words: list[str], page_start: int, page_end: int) -> None:
        nonlocal chunk_index

        chunk_text = " ".join(words).strip()
        if not chunk_text:
            return

        chunk_id = f"{document_id}_chunk_{chunk_index}"

        conn.execute(
            """
            INSERT INTO document_chunks (
              id, document_id, page_start, page_end, chunk_index,
              section_title, chunk_type, text, token_count, embedding_status,
              quality_score, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chunk_id,
                document_id,
                page_start,
                page_end,
                chunk_index,
                None,
                "page_text",
                chunk_text,
                len(words),
                "pending",
                0.9,
                timestamp,
                timestamp,
            ),
        )

        conn.execute(
            """
            INSERT INTO document_search (
              document_id, page_number, chunk_id, text
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                document_id,
                page_start,
                chunk_id,
                chunk_text,
            ),
        )

        chunk_index += 1

    for page_number, text in rows:
        page_words = re.findall(r"\S+", text or "")
        if not page_words:
            continue

        if current_page_start is None:
            current_page_start = page_number

        current_page_end = page_number
        current_words.extend(page_words)

        while len(current_words) >= CHUNK_TARGET_WORDS:
            chunk = current_words[:CHUNK_TARGET_WORDS]
            flush_chunk(chunk, current_page_start, current_page_end)

            current_words = current_words[CHUNK_TARGET_WORDS - CHUNK_OVERLAP_WORDS :]
            current_page_start = current_page_end

    if current_words and current_page_start is not None and current_page_end is not None:
        flush_chunk(current_words, current_page_start, current_page_end)

    conn.commit()
    return chunk_index


def classify_pdf(page_count: int, pages_with_text: int, is_encrypted: bool) -> str:
    if is_encrypted:
        return "encrypted_pdf"
    if page_count <= 0:
        return "unsupported_pdf"
    if pages_with_text == 0:
        return "scanned_pdf"
    if pages_with_text < page_count:
        return "hybrid_pdf"
    return "text_pdf"


def insert_quality_report(
    conn: sqlite3.Connection,
    document_id: str,
    page_count: int,
    pages_text_extracted: int,
    pages_ocr_required: int,
    pages_failed: list[int],
    search_ready: bool,
    citation_ready: bool,
    ai_ready: bool,
) -> dict:
    warnings: list[str] = []
    if pages_ocr_required:
        warnings.append(f"{pages_ocr_required} sider mangler tekstlag og er markert for OCR.")
    if pages_failed:
        warnings.append(f"{len(pages_failed)} sider kunne ikke leses.")

    if pages_failed:
        overall_quality = "medium" if pages_text_extracted else "low"
    elif pages_ocr_required:
        overall_quality = "medium" if pages_text_extracted else "low"
    else:
        overall_quality = "high"

    report = {
        "document_id": document_id,
        "overall_quality": overall_quality,
        "page_count": page_count,
        "pages_text_extracted": pages_text_extracted,
        "pages_ocr_required": pages_ocr_required,
        "pages_failed": pages_failed,
        "low_quality_pages": [],
        "citation_ready": citation_ready,
        "search_ready": search_ready,
        "ai_ready": ai_ready,
        "warnings": warnings,
    }

    timestamp = now_iso()
    conn.execute("DELETE FROM document_quality_reports WHERE document_id = ?", (document_id,))
    conn.execute(
        """
        INSERT INTO document_quality_reports (
          id, document_id, overall_quality, pages_text_extracted,
          pages_ocr_required, pages_failed_json, low_quality_pages_json,
          citation_ready, search_ready, ai_ready, warnings_json, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            f"{document_id}_quality",
            document_id,
            overall_quality,
            pages_text_extracted,
            pages_ocr_required,
            json.dumps(pages_failed),
            json.dumps([]),
            1 if citation_ready else 0,
            1 if search_ready else 0,
            1 if ai_ready else 0,
            json.dumps(warnings, ensure_ascii=False),
            timestamp,
        ),
    )
    conn.commit()
    return report


def import_pdf(pdf_path: Path, db_path: Path, schema_path: Path, case_id: str) -> int:
    if not pdf_path.exists():
        emit({"type": "failed", "error_code": "file_missing", "message": str(pdf_path)})
        return 1

    if pdf_path.suffix.lower() != ".pdf":
        emit({"type": "failed", "error_code": "not_pdf", "message": str(pdf_path)})
        return 1

    if pdf_path.stat().st_size > MAX_PDF_BYTES:
        emit(
            {
                "type": "failed",
                "error_code": "file_too_large",
                "message": "PDF file exceeds local MVP size limit.",
            }
        )
        return 1

    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    init_db(conn, schema_path)

    document_id = make_id("doc")
    content_hash = sha256_file(pdf_path)

    emit(
        {
            "type": "received",
            "document_id": document_id,
            "filename": pdf_path.name,
            "file_size": pdf_path.stat().st_size,
            "status": "received",
            "local_processing": True,
            "cloud_used": False,
        }
    )

    upsert_document(
        conn=conn,
        document_id=document_id,
        case_id=case_id,
        pdf_path=pdf_path,
        content_hash=content_hash,
        status="received",
    )

    try:
        pdf = fitz.open(str(pdf_path))
    except Exception as exc:
        update_document(conn, document_id, status="failed", error_code="pdf_corrupt")
        emit(
            {
                "type": "failed",
                "document_id": document_id,
                "error_code": "pdf_corrupt",
                "message": str(exc),
            }
        )
        return 1

    if pdf.needs_pass:
        update_document(
            conn,
            document_id,
            status="failed",
            error_code="pdf_encrypted",
            page_count=pdf.page_count,
        )
        emit(
            {
                "type": "failed",
                "document_id": document_id,
                "error_code": "pdf_encrypted",
                "page_count": pdf.page_count,
            }
        )
        return 1

    page_count = pdf.page_count
    sample_pages = min(page_count, 5)
    sample_pages_with_text = 0
    for index in range(sample_pages):
        try:
            if word_count(normalize_text(pdf.load_page(index).get_text("text"))) > 0:
                sample_pages_with_text += 1
        except Exception:
            continue

    probe_type = classify_pdf(page_count, sample_pages_with_text, False)
    if sample_pages and 0 < sample_pages_with_text < sample_pages:
        probe_type = "hybrid_pdf"

    update_document(
        conn,
        document_id,
        status="probed",
        page_count=page_count,
        has_text_layer=1 if sample_pages_with_text else 0,
        needs_ocr=1 if sample_pages_with_text < sample_pages else 0,
        document_type=probe_type,
    )

    emit(
        {
            "type": "probed",
            "document_id": document_id,
            "page_count": page_count,
            "has_text_layer": sample_pages_with_text > 0,
            "needs_ocr": sample_pages_with_text < sample_pages,
            "is_encrypted": False,
            "is_corrupt": False,
            "document_type": probe_type,
            "document_type_guess": "legal_document",
        }
    )

    update_document(conn, document_id, status="extracting_text")

    total_words = 0
    pages_with_text = 0
    pages_failed: list[int] = []

    for index in range(page_count):
        page_number = index + 1

        try:
            page = pdf.load_page(index)
            text = normalize_text(page.get_text("text"))
            page_words = word_count(text)

            if page_words > 0:
                pages_with_text += 1
                total_words += page_words
                insert_page(
                    conn,
                    document_id=document_id,
                    page_number=page_number,
                    text=text,
                    extraction_method="pdf_text_layer",
                    status="text_extracted",
                )
            else:
                insert_page(
                    conn,
                    document_id=document_id,
                    page_number=page_number,
                    text="",
                    extraction_method="none",
                    status="ocr_pending",
                )

            if page_number % 5 == 0 or page_number == page_count:
                conn.commit()

            emit(
                {
                    "type": "page_progress",
                    "document_id": document_id,
                    "page_number": page_number,
                    "page_count": page_count,
                    "pages_with_text": pages_with_text,
                    "word_count_estimate": total_words,
                }
            )

        except Exception as exc:
            pages_failed.append(page_number)
            insert_page(
                conn,
                document_id=document_id,
                page_number=page_number,
                text="",
                extraction_method="pdf_text_layer",
                status="failed",
                error_code="page_extraction_failed",
            )
            emit(
                {
                    "type": "page_failed",
                    "document_id": document_id,
                    "page_number": page_number,
                    "error_code": "page_extraction_failed",
                    "message": str(exc),
                }
            )

    conn.commit()

    has_text_layer = pages_with_text > 0
    needs_ocr = pages_with_text < page_count

    if pages_with_text == 0:
        document_status = "ocr_pending"
    elif pages_failed or needs_ocr:
        document_status = "partial"
    else:
        document_status = "text_extracted"

    update_document(
        conn,
        document_id,
        status=document_status,
        has_text_layer=1 if has_text_layer else 0,
        needs_ocr=1 if needs_ocr else 0,
        word_count_estimate=total_words,
    )

    emit(
        {
            "type": "text_extracted",
            "document_id": document_id,
            "status": document_status,
            "page_count": page_count,
            "pages_with_text": pages_with_text,
            "pages_failed": len(pages_failed),
            "word_count_estimate": total_words,
            "needs_ocr": needs_ocr,
        }
    )

    chunk_count = create_chunks(conn, document_id)
    search_ready = chunk_count > 0
    citation_ready = pages_with_text > 0
    ai_ready = search_ready and citation_ready

    update_document(
        conn,
        document_id,
        status="ai_ready" if ai_ready else ("search_indexed" if search_ready else document_status),
        document_type=classify_pdf(page_count, pages_with_text, False),
        search_ready=1 if search_ready else 0,
        citation_ready=1 if citation_ready else 0,
        ai_ready=1 if ai_ready else 0,
    )

    emit(
        {
            "type": "search_indexed",
            "document_id": document_id,
            "chunk_count": chunk_count,
            "word_count_estimate": total_words,
            "search_ready": search_ready,
            "citation_ready": citation_ready,
        }
    )

    report = insert_quality_report(
        conn,
        document_id=document_id,
        page_count=page_count,
        pages_text_extracted=pages_with_text,
        pages_ocr_required=page_count - pages_with_text,
        pages_failed=pages_failed,
        search_ready=search_ready,
        citation_ready=citation_ready,
        ai_ready=ai_ready,
    )
    emit({"type": "quality_report", **report})
    emit(
        {
            "type": "document_ready",
            "document_id": document_id,
            "readiness": {
                "imported": True,
                "search_ready": search_ready,
                "citation_ready": citation_ready,
                "ai_ready": ai_ready,
                "needs_review": bool(pages_failed or (page_count - pages_with_text)),
            },
            "status": "ai_ready" if ai_ready else document_status,
        }
    )

    conn.close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--db", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--case-id", required=True)
    args = parser.parse_args()

    return import_pdf(
        pdf_path=Path(args.pdf),
        db_path=Path(args.db),
        schema_path=Path(args.schema),
        case_id=args.case_id,
    )


if __name__ == "__main__":
    raise SystemExit(main())
