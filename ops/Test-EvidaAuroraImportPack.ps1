param(
    [string]$PackPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "Evida_Aurora_tailored_practical_import_test_pack\evida_tailored_aurora_test_pack"),
    [string]$ReportPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "artifacts\aurora-import\evida-aurora-medium-import-report.json")
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Desktop = Join-Path $Root "evida-core\desktop-tauri"

if (-not (Test-Path -LiteralPath $PackPath)) {
    throw "Aurora test pack not found: $PackPath"
}

$Answers = Join-Path $PackPath "00_ANSWERS_DO_NOT_UPLOAD"
$Upload = Join-Path $PackPath "01_MEDIUM_import_fullfort_kontroll_kreves\UPLOAD_THIS_FOLDER"
if (-not (Test-Path -LiteralPath $Answers)) {
    throw "Aurora answers folder not found: $Answers"
}
if (-not (Test-Path -LiteralPath $Upload)) {
    throw "Aurora medium upload folder not found: $Upload"
}

$env:EVIDA_AURORA_TEST_PACK_DIR = (Resolve-Path $PackPath).Path
$env:EVIDA_AURORA_IMPORT_REPORT = $ReportPath

Push-Location $Desktop
try {
    cargo test --manifest-path src-tauri\Cargo.toml aurora_medium_import_fullfort_kontroll_kreves_matches_expected_outcome -- --ignored --nocapture
    if ($LASTEXITCODE -ne 0) {
        throw "Aurora medium import test failed. See $ReportPath"
    }
}
finally {
    Pop-Location
}

Get-Content -LiteralPath $ReportPath -Raw
