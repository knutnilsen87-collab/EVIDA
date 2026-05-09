param(
    [Parameter(Mandatory = $true)]
    [string]$BundlePath,

    [string]$Root = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Root)) {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $Root = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

if (-not (Test-Path -LiteralPath $BundlePath)) {
    throw "Bundle not found: $BundlePath"
}

$work = Join-Path $Root ".tmp\okokrim_stress"
if (Test-Path -LiteralPath $work) {
    Remove-Item -LiteralPath $work -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $work | Out-Null

Expand-Archive -LiteralPath $BundlePath -DestinationPath $work -Force

$pdf = Get-ChildItem -LiteralPath $work -Filter "*.pdf" -File | Select-Object -First 1
$manifest = Get-ChildItem -LiteralPath $work -Filter "*truth_manifest.json" -File | Select-Object -First 1

if (-not $pdf) {
    throw "No PDF found in bundle."
}
if (-not $manifest) {
    throw "No truth manifest found in bundle."
}

Push-Location (Join-Path $Root "evida-core\desktop-tauri\src-tauri")
try {
    $env:EVIDA_STRESS_PDF = $pdf.FullName
    $env:EVIDA_STRESS_MANIFEST = $manifest.FullName
    cargo test okokrim_10000_bundle_passes_ingestion_gate -- --ignored --nocapture
} finally {
    Remove-Item Env:\EVIDA_STRESS_PDF -ErrorAction SilentlyContinue
    Remove-Item Env:\EVIDA_STRESS_MANIFEST -ErrorAction SilentlyContinue
    Pop-Location
}
