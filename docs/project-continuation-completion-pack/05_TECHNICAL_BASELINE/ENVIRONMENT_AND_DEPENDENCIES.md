# Environment And Dependencies

## Desktop frontend
Path: `evida-core/desktop-tauri`

Runtime/tooling observed:
- Node/npm on Windows.
- Tauri CLI via npm devDependency.
- Rust toolchain for Tauri release build.

Important dependencies:
- `@tauri-apps/api` ^2.0.0
- `@tauri-apps/cli` ^2.0.0
- `react` ^18.3.1
- `react-dom` ^18.3.1
- `vite` ^8.0.10
- `typescript` ^5.6.3
- `lucide-react` ^0.468.0

## Commands
```powershell
npm.cmd test
npm.cmd run build
npm.cmd run tauri:build
```

## Dependency risks
No SBOM or formal dependency review is complete. Add dependency scanning before external pilot or production distribution.
