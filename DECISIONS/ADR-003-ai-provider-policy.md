# ADR-003 AI Provider Policy

Status: accepted

Date: 2026-05-07

## Context

AI answers in a legal-data system must be controlled, source-grounded and policy-bound. Provider selection cannot be an implicit client-side choice when sensitive documents are involved.

## Decision

AI provider policy is owned by the Spring Boot control plane when production controls are implemented.

Default policy:

```text
safe local/source-bound mode
no raw legal documents to external AI by default
no external AI provider use without explicit approved policy
AI answers must be source-grounded for legal/case assertions
```

The desktop app and local workers may call AI helpers only within the active policy boundary. They must not become independent provider-policy authorities.

## Required Future Controls

Later implementation must define:

- allowed provider modes
- model/provider allow-list
- admin/user consent rules
- payload minimization
- source-grounding requirements
- prompt-injection handling
- audit events for AI calls
- retention and deletion behavior for prompts/answers

## Not Implemented By This ADR

This ADR does not implement provider enforcement, model gateways, prompt filters, AI evals or audit persistence. It only defines policy ownership and default behavior.
