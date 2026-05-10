# Source Of Truth Map

## Highest authority
1. Root `README.md` for current project boundary and start/build instructions.
2. Root `ARCHITECTURE.md` for ownership and architecture boundary.
3. Root `SECURITY.md` for data/security boundary.
4. Root `DECISIONS/` ADRs for durable architecture decisions.

## Active implementation truth
- `evida-core/desktop-tauri/src/` for current desktop UX and frontend logic.
- `evida-core/desktop-tauri/package.json` for active frontend scripts/dependencies.
- `evida-core/desktop-tauri/src-tauri/` for Rust/Tauri desktop shell.
- `evida-core/services/saksrom-api` for intended enterprise/control-plane backend direction.

## Planning truth
- `docs/IMPLEMENTATION_PLAN.md` for P0 sequence.
- `docs/RELEASE_CHECKLIST.md` for evaluation/release commands and artifacts.
- `docs/SAKSROM_CHAT_FIRST_HANDOFF.md` for current Saksrom product behavior.
- `docs/evida-phase-*` for phase detail, but verify against current code before implementation.

## Lower authority / caution
- `legacy/` and `archives/` may contain useful history but are not current source of truth.
- `evida-core/backend-api` is deprecated for enterprise/control-plane ownership.

Rule: if docs conflict, root architecture/security/ADR files win over older phase docs and archive material.
