# Project Asset Map

## Product assets
- `assets/brand/` and `evida-core/desktop-tauri/public/` contain app visual/static assets.
- `Evida Release/` contains local release outputs and is not the source of truth for code.

## Documentation assets
- Root docs: production boundary and governance.
- `docs/`: product specs, handoffs, release/evaluation plans.
- `DECISIONS/`: architecture decision records.

## Code assets
- Desktop app: `evida-core/desktop-tauri`.
- Rust/Tauri shell: `evida-core/desktop-tauri/src-tauri`.
- Future authoritative backend: `evida-core/services/saksrom-api`.
- Deprecated starter: `evida-core/backend-api`.

## Operational assets
- `ops/New-EvidaRelease.ps1`.
- `ops/Test-EvidaRelease.ps1`.
- `ops/Verify-ProductionBoundary.ps1`.

## Do not use as active source without review
- `legacy/`.
- `archives/`.
- Old zip-analysis/source starter folders.
