# Current State Audit

## What files/repos/folders currently exist
- Root repo: `F:\prosjekter\CasePilot`.
- Active source: `evida-core/`.
- Active desktop app: `evida-core/desktop-tauri`.
- Future authoritative backend/control plane: `evida-core/services/saksrom-api`.
- Deprecated backend starter: `evida-core/backend-api`.
- Canonical governance: root `ARCHITECTURE.md`, `SECURITY.md`, `DECISIONS/`.
- Planning docs: `docs/` including phase docs and release/evaluation specs.
- Release helper scripts: `ops/`.
- Legacy/archive material: `legacy/`, `archives/`.

## What parts clearly exist
- Tauri desktop app shell and React UI.
- Saksrom chat-first view with import, progress, source-grounded answer structure and sticky composer.
- Local processing/readiness/adaptive Saksrom/command test scripts.
- Workrooms for chronology, evidence, arguments, contradictions, risk and litigation simulation.
- Settings/security surfaces and multi-window/menu specs.
- Release packaging flow for Windows.
- Production-boundary documentation and verification script.

## What parts appear partial
- Spring Boot backend/control plane exists as direction but is not yet fully integrated as production authority.
- Security controls are specified but not fully implemented.
- AI provider policy is documented but not production-enforced.
- Local data storage and audit behavior need hardening before real legal use.
- Evaluation/pilot workflows exist, but broad automated e2e coverage appears incomplete.

## What parts appear broken
No broken source area was confirmed during this pack generation. The current desktop test and build commands passed. Treat this as a local verification snapshot, not production proof.

## What parts are unclear
- Exact release gating for pilot vs public alpha.
- Which legacy materials still contain useful requirements vs obsolete direction.
- Final backend migration/removal plan for deprecated FastAPI starter.
- Full data retention, backup and restore policy.

## What parts are missing
- Production authentication/authorization.
- Tenant/user isolation.
- Encrypted local data storage.
- Tamper-evident audit hash-chain storage and verification.
- Provider-policy enforcement with admin/user approval gates.
- Prompt-injection and source-grounding evaluation gates.
- SBOM, dependency scanning policy and release signing.

## What has never been verified in this pack
- Real client-data workflows: intentionally not allowed.
- Full Spring Boot test suite in this generation snapshot.
- Clean machine installer installation.
- Security penetration tests.

## What needs immediate clarification
Decide the next milestone: internal evaluation hardening, pilot release, or production-control-plane implementation. Do not pursue all three at once.
