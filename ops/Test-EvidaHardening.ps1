$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "1/6 Production boundary"
powershell -ExecutionPolicy Bypass -File (Join-Path $Root "ops\Verify-ProductionBoundary.ps1")

Write-Host "2/6 Smoke preflight"
powershell -ExecutionPolicy Bypass -File (Join-Path $Root "ops\Test-EvidaSmokePreflight.ps1")

Write-Host "3/6 Release hardening"
powershell -ExecutionPolicy Bypass -File (Join-Path $Root "ops\Test-EvidaReleaseHardening.ps1")

Write-Host "4/6 Desktop tests"
Push-Location (Join-Path $Root "evida-core\desktop-tauri")
try {
    npm.cmd test
} finally {
    Pop-Location
}

Write-Host "5/6 Rust static hardening"
powershell -ExecutionPolicy Bypass -File (Join-Path $Root "ops\Test-EvidaRustHardeningStatic.ps1")

Write-Host "6/6 Frontend build"
Push-Location (Join-Path $Root "evida-core\desktop-tauri")
try {
    npm.cmd run build
} finally {
    Pop-Location
}

Write-Host "Evida hardening checks passed."
