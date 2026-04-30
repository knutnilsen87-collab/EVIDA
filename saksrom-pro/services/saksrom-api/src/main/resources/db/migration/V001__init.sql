CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

CREATE TABLE cases (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    case_number TEXT,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    local_first BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    case_id UUID NOT NULL REFERENCES cases(id),
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    page_count INTEGER,
    sha256 TEXT NOT NULL,
    bates_start TEXT,
    bates_end TEXT,
    storage_policy TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (case_id, sha256)
);

CREATE TABLE source_refs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    case_id UUID NOT NULL REFERENCES cases(id),
    document_id UUID NOT NULL REFERENCES documents(id),
    page_number INTEGER NOT NULL,
    bates TEXT,
    text_excerpt TEXT,
    excerpt_sha256 TEXT NOT NULL,
    ocr_quality TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    case_id UUID,
    actor_user_id UUID REFERENCES users(id),
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    event_payload JSONB NOT NULL,
    previous_event_hash TEXT,
    event_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_tenant ON cases(tenant_id);
CREATE INDEX idx_documents_case ON documents(case_id);
CREATE INDEX idx_source_refs_case_doc ON source_refs(case_id, document_id);
CREATE INDEX idx_audit_events_case_created ON audit_events(case_id, created_at);
