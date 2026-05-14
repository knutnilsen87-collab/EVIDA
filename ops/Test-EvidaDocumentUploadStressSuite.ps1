param(
    [string]$SuitePath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "testpakker\Evida_document_upload_stress_suite_medium_to_extreme"),
    [string]$ReportPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "artifacts\document-upload-stress\evida-document-upload-stress-report.json")
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Desktop = Join-Path $Root "evida-core\desktop-tauri"

if (-not (Test-Path -LiteralPath $SuitePath)) {
    throw "Stress suite not found: $SuitePath"
}

$env:EVIDA_DOCUMENT_STRESS_SUITE_DIR = (Resolve-Path $SuitePath).Path
$env:EVIDA_DOCUMENT_STRESS_REPORT = $ReportPath

Push-Location $Desktop
try {
    cargo test --manifest-path src-tauri\Cargo.toml evida_document_upload_stress_suite_matches_truth_manifest -- --ignored --nocapture
    if ($LASTEXITCODE -ne 0) {
        throw "Document upload stress suite failed. See $ReportPath"
    }
}
finally {
    Pop-Location
}

Get-Content -LiteralPath $ReportPath -Raw
