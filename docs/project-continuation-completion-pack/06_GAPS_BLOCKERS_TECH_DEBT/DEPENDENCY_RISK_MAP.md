# Dependency Risk Map

| Dependency / area | Risk | Action |
| --- | --- | --- |
| Tauri 2 | Desktop packaging/security boundary | Keep updated; verify CSP and updater/signing before release. |
| Vite 8 / rolldown | Build pipeline is new/fast-moving | Pin and verify CI; watch plugin/build warnings. |
| React 18 | Stable UI dependency | Low immediate risk. |
| Rust toolchain | Required for desktop release | Document exact build setup. |
| Node/npm | Required for frontend build/test | Lockfile exists; add dependency scanning. |
| Spring Boot backend | Future control plane | Define integration and CI test path. |
| Python/FastAPI starter | Ownership confusion | Deprecate/quarantine for enterprise control plane. |
