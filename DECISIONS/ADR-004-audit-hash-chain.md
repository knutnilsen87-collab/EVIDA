# ADR-004 Audit Hash Chain

Status: accepted

Date: 2026-05-07

## Context

Legal-data workflows require trustworthy audit records for document import, source use, AI/provider actions, exports, deletion and administrative operations.

A production audit log must be tamper-evident, not just append-only in application code.

## Decision

Production audit design must use a tamper-evident hash chain.

Each audit event must include a stable canonical payload and a hash that links it to the previous event:

```text
previous_hash
canonical_payload_json
event_hash
```

Canonical JSON must be stable. Whitespace and key ordering must not change the hash.

## Required Future Controls

Later implementation must define:

- event schema
- canonical JSON serialization
- hash algorithm
- verification command
- failure behavior
- retention policy
- redaction rules
- tenant/user scoping
- local and control-plane audit responsibilities

## Not Implemented By This ADR

This ADR does not implement audit hash-chain storage, verification or migrations. It only locks the required production direction.
