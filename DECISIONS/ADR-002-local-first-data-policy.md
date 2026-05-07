# ADR-002 Local-First Data Policy

Status: accepted

Date: 2026-05-07

## Context

Evida processes legal documents and case data. The safe default for evaluation and desktop use is local-first processing, with no silent external transfer of document content.

## Decision

Default data policy:

```text
local-first by default
no cloud processing without explicit approved policy and user/admin action
no raw legal documents sent to external AI by default
no document text, chunks or embeddings in logs
```

Local processing is the baseline for document import, extraction, search, source references and evaluation workflows.

External processing can only be added behind explicit policy controls and must be visible to the user/admin.

## Consequences

- Document text, chunks and embeddings are sensitive derived legal data.
- Logs and diagnostics must be designed for redaction.
- Any future cloud feature must document what data leaves the machine, why, under which policy and how deletion works.
- The desktop app cannot silently switch from local to external processing.

## Not Implemented By This ADR

This ADR does not implement encryption, secure storage, deletion, backup, restore or network enforcement. Those are later production-control tasks.
