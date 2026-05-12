# ARCHITECTURE_DECISIONS

## ADR-001: Local Evidence Ingestion Engine embedded in Evida Desktop
### Status
Accepted.

### Context
Evida is a local desktop app handling potentially sensitive case documentation. The import engine must run locally, but the code must not be tightly coupled to Evida UI or legal analysis logic.

### Decision
Build a local embedded engine shipped with Evida Desktop, but implemented as separate reusable packages:
- `local-ingestion-core`
- `local-ingestion-workers`
- `local-storage`
- `local-search`
- `evida-ingestion-adapter`

### Consequences
- Evida gets robust local operation.
- Engine can be reused later.
- Clear adapter boundary prevents product-specific leakage.
- Packaging complexity is higher but justified.

## ADR-002: SQLite WAL for local persistence
### Status
Proposed/Recommended.

### Context
The engine needs durable local state, queue recovery and audit events.

### Decision
Use SQLite with WAL mode for MVP.

### Consequences
- Simple local deployment.
- Good enough for desktop workloads.
- Requires careful write batching and concurrency management.

## ADR-003: Progressive readiness instead of single completion
### Status
Accepted.

### Context
Large cases may take time to OCR and process. Users need early value without false certainty.

### Decision
Expose separate metrics:
- import progress
- processing progress
- verification coverage
- AI usable coverage
- manual review remaining

### Consequences
- AI can work on partial material with warnings.
- User sees truth.
- UI must avoid single misleading progress.

## ADR-004: Manual review is a first-class workflow
### Status
Accepted.

### Context
Some pages/files cannot be machine-read. Users need a simple way to inspect and mark them.

### Decision
Create `ManualReviewItem` and `ManualReviewAction` objects with audit trail.

### Consequences
- Problem resolution is explicit.
- Case readiness can account for manual review.
- AI must distinguish manual review from machine-readable text.

## ADR-005: Source provenance required for AI use
### Status
Accepted.

### Context
Evida must produce trustworthy, source-based answers.

### Decision
No chunk is AI-usable unless it has a source reference to file/document/page and extraction method.

### Consequences
- Some material may remain unavailable to AI until processing completes.
- Prevents unsupported claims.
- Retrieval must filter by source provenance.

## ADR-006: Safety gate before extraction
### Status
Accepted.

### Context
User may import archives, macros, corrupt files or malicious files.

### Decision
Run file type detection and safety gate before extraction/preview where applicable.

### Consequences
- Some files will be blocked until user action.
- Prevents unsafe parser behavior.
- Requires failure codes and user-friendly explanations.
