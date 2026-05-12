# Stale / Legacy Document Inventory

Reviewed: 2026-05-11

## Current rule

Root docs, ADRs and the continuation pack are the current source of truth:

```text
CURRENT_STATUS.md
README.md
ARCHITECTURE.md
SECURITY.md
DECISIONS/
docs/project-continuation-completion-pack/
```

## Treat as historical planning unless revalidated

These folders contain useful product planning, but some details predate the current local Tauri evaluation-build direction:

```text
docs/evida-phase-1-3/
docs/evida-phase-4-8/
```

Use them for context, not as binding implementation truth, when they conflict with current root docs or the continuation pack.

## Known ambiguity to avoid

- Older SaaS/Next.js/PostgreSQL MVP planning is not the current active implementation path.
- FastAPI must not be interpreted as the production enterprise/control-plane backend.
- Production launch checklists are future-state requirements, not current status.

## Next cleanup

- Move or mark individual obsolete docs once a production-control-plane milestone is chosen.
- Keep `docs/project-continuation-completion-pack/` updated after each hardening milestone.
- Prefer adding current status to `CURRENT_STATUS.md` instead of creating another overlapping roadmap.

