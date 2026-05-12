# Release Hardening Status

Reviewed: 2026-05-11

## Implemented release gates

- Production-boundary verifier.
- Smoke preflight.
- Desktop test suite.
- Frontend production build.
- Release artifact verifier.
- CSP/connect-source review.
- Developer/investor pack README.
- Rust static hardening gate, with actual Cargo test status tracked separately.

## Added local release-hardening gate

```powershell
powershell -ExecutionPolicy Bypass -File ops/Test-EvidaReleaseHardening.ps1
```

This validates:

- SBOM/dependency inventory plan exists.
- Release signing decision is explicit.
- CSP/connect-source review exists.
- Clean-machine smoke status exists.
- Release artifact review exists.
- Known production blockers remain visible.

## Production blockers

- Build signing is not complete.
- SBOM is a local dependency inventory, not yet a formal signed SBOM artifact.
- Dependency/security scan gate is a documented task and local inventory check, not a full SCA/SAST pipeline.
- Clean-machine smoke has not yet passed for the current build.
- `cargo test` is currently blocked by local Windows execution policy in this environment; see `docs/RUST_TEST_EXECUTION_STATUS.md`.
