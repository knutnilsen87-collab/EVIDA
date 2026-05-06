-- Evida local case database schema
-- MVP starter. Production target should use encrypted local DB.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT 'NO',
  status TEXT NOT NULL DEFAULT 'active',
  source_coverage_percent REAL NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'unknown',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  local_path TEXT NOT NULL,
  mime_type TEXT,
  sha256 TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  ocr_status TEXT NOT NULL DEFAULT 'not_started',
  ocr_quality REAL,
  bates_start TEXT,
  bates_end TEXT,
  exhibit_id TEXT,
  imported_at TEXT NOT NULL,
  UNIQUE(case_id, sha256)
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  sha256 TEXT,
  text_status TEXT NOT NULL DEFAULT 'not_extracted',
  ocr_confidence REAL,
  created_at TEXT NOT NULL,
  UNIQUE(document_id, page_number)
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  text TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_objects (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id TEXT REFERENCES chunks(id) ON DELETE SET NULL,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  bates_start TEXT,
  bates_end TEXT,
  text_excerpt TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  ocr_confidence REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chronology_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  date_text TEXT NOT NULL,
  normalized_date TEXT,
  description TEXT NOT NULL,
  certainty TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chronology_event_sources (
  event_id TEXT NOT NULL REFERENCES chronology_events(id) ON DELETE CASCADE,
  source_object_id TEXT NOT NULL REFERENCES source_objects(id) ON DELETE CASCADE,
  PRIMARY KEY(event_id, source_object_id)
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  source_coverage_percent REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_links (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE,
  source_object_id TEXT NOT NULL REFERENCES source_objects(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK(direction IN ('supports', 'weakens', 'neutral')),
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contradictions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unresolved',
  severity TEXT NOT NULL DEFAULT 'medium',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contradiction_sources (
  contradiction_id TEXT NOT NULL REFERENCES contradictions(id) ON DELETE CASCADE,
  source_object_id TEXT NOT NULL REFERENCES source_objects(id) ON DELETE CASCADE,
  PRIMARY KEY(contradiction_id, source_object_id)
);

CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  likelihood TEXT NOT NULL,
  description TEXT NOT NULL,
  recommended_action TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  draft_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS draft_citations (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  source_object_id TEXT NOT NULL REFERENCES source_objects(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  supports TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS control_reports (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  report_json TEXT NOT NULL,
  blocking INTEGER NOT NULL DEFAULT 0,
  generated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  result TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_source_case ON source_objects(case_id);
CREATE INDEX IF NOT EXISTS idx_source_document ON source_objects(document_id);
CREATE INDEX IF NOT EXISTS idx_events_case ON chronology_events(case_id);
CREATE INDEX IF NOT EXISTS idx_claims_case ON claims(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_case ON audit_events(case_id);
