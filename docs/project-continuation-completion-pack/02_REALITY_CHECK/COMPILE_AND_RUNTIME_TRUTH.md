# Compile And Runtime Truth

## Compile truth
The active desktop frontend compiles with:

```powershell
cd evida-core\desktop-tauri
npm.cmd run build
```

This passed on 2026-05-10.

## Test truth
The local desktop logic tests pass with:

```powershell
cd evida-core\desktop-tauri
npm.cmd test
```

This passed on 2026-05-10.

## Desktop packaging truth
Tauri packaging has passed recently with:

```powershell
cd evida-core\desktop-tauri
npm.cmd run tauri:build
```

## Runtime truth
The product should still be treated as pre-alpha. A compiled desktop app is not the same as production readiness.

## Known runtime boundaries
- Test/evaluation data only.
- Local-first processing expectation.
- External AI/cloud use must remain off unless explicit approved policy exists.
- No real legal client matter should be processed.
