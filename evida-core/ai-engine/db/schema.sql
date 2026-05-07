PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  page_count INTEGER,
  word_count_estimate INTEGER DEFAULT 0,
  has_text_layer INTEGER DEFAULT 0,
  needs_ocr INTEGER DEFAULT 0,
  document_type TEXT,
  local_processing INTEGER DEFAULT 1,
  cloud_used INTEGER DEFAULT 0,
  search_ready INTEGER DEFAULT 0,
  citation_ready INTEGER DEFAULT 0,
  ai_ready INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  quality_score REAL,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  extraction_method TEXT NOT NULL,
  ocr_confidence REAL,
  status TEXT NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  section_title TEXT,
  chunk_type TEXT,
  text TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  embedding_status TEXT NOT NULL DEFAULT 'pending',
  quality_score REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS document_search
USING fts5(
  document_id,
  page_number UNINDEXED,
  chunk_id UNINDEXED,
  text
);

CREATE INDEX IF NOT EXISTS idx_document_pages_document_id
ON document_pages(document_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
ON document_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_documents_case_id
ON documents(case_id);

CREATE TABLE IF NOT EXISTS document_quality_reports (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  overall_quality TEXT NOT NULL,
  pages_text_extracted INTEGER NOT NULL DEFAULT 0,
  pages_ocr_required INTEGER NOT NULL DEFAULT 0,
  pages_failed_json TEXT NOT NULL DEFAULT '[]',
  low_quality_pages_json TEXT NOT NULL DEFAULT '[]',
  citation_ready INTEGER NOT NULL DEFAULT 0,
  search_ready INTEGER NOT NULL DEFAULT 0,
  ai_ready INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_quality_reports_document_id
ON document_quality_reports(document_id);
