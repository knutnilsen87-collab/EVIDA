# Technical Baseline

## Active desktop stack
- React 18.
- TypeScript.
- Vite 8.
- Tauri 2.
- Rust/Tauri shell under `src-tauri`.
- `lucide-react` for icons.

## Active commands
```powershell
cd evida-core\desktop-tauri
npm.cmd test
npm.cmd run build
npm.cmd run tauri:build
```

## Current verified state
- Desktop tests passed on 2026-05-10.
- Frontend build passed on 2026-05-10.
- Tauri build passed recently.
- Production boundary verifier passed on 2026-05-10.

## Architecture baseline
- Desktop app owns local evaluation UX and local orchestration.
- Spring Boot `evida-core/services/saksrom-api` is intended authoritative enterprise/control-plane backend.
- FastAPI `evida-core/backend-api` is deprecated for enterprise/control-plane ownership.
