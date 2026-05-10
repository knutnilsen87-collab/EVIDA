# Project Context

Evida is being built as a legal-data control system, not a generic chat app. The value depends on trust: users must know what the answer is based on, what is missing, what is uncertain and what is safe to do next.

The current desktop application already contains a chat-first Saksrom, local import flows, processing progress, readiness checks, adaptive suggested actions, legal command logic and multiple workrooms. Recent work improved the Saksrom summary readability so it behaves more like a legal briefing than a dense AI text dump.

The project must remain honest about its boundary: it can be evaluated locally, but it does not yet have production-grade authentication, tenant isolation, encrypted storage, audit hash-chain enforcement, provider-policy enforcement or release signing.

Primary project references:
- `README.md`
- `ARCHITECTURE.md`
- `SECURITY.md`
- `DECISIONS/`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/SAKSROM_CHAT_FIRST_HANDOFF.md`
