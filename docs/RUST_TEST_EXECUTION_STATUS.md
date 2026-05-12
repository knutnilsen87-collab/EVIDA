# Rust Test Execution Status

Reviewed: 2026-05-11

## Current local result

`cargo test --manifest-path src-tauri/Cargo.toml` was attempted with:

- default `src-tauri/target`
- separate workspace target directory
- user TEMP target directory

All attempts failed before Evida tests ran because Windows denied execution of Cargo dependency build-scripts:

```text
could not execute process ... build-script-build
Ingen tilgang. (os error 5)
```

## Interpretation

This is a local Windows execution-policy / filesystem permission blocker for Cargo build scripts in the current environment.

It is not a passing Rust test result.

## Required follow-up

Before any release that claims Rust/backend verification:

```powershell
cd evida-core/desktop-tauri
cargo test --manifest-path src-tauri/Cargo.toml
```

must pass on a machine or CI runner that can execute Cargo build scripts.

## Current mitigation

`ops/Test-EvidaRustHardeningStatic.ps1` verifies that Rust hardening tests and source-level gates are present in the repo. This does not replace `cargo test`.

