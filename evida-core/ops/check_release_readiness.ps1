$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$env:Path = "$env:USERPROFILE\.cargo\bin;C:\Program Files\Tesseract-OCR;$Root\.tools\bin;$env:Path"
$Reports = Join-Path $Root "reports"
New-Item -ItemType Directory -Force -Path $Reports | Out-Null

function Test-CommandPresence {
    param([string]$Name, [string]$VersionArg = "--version")
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $cmd) {
        return @{ name = $Name; found = $false; version = $null; required_for = "release" }
    }
    try {
        $version = (& $Name $VersionArg 2>&1 | Select-Object -First 1) -join " "
    } catch {
        $version = "found but version check failed"
    }
    return @{ name = $Name; found = $true; version = $version; required_for = "release" }
}

$checks = @(
    Test-CommandPresence "node" "--version"
    Test-CommandPresence "npm" "--version"
    Test-CommandPresence "java" "-version"
    Test-CommandPresence "cargo" "--version"
    Test-CommandPresence "rustc" "--version"
    Test-CommandPresence "tesseract" "--version"
    Test-CommandPresence "sqlite3" "--version"
)

$localMaven = Join-Path $Root ".tools\apache-maven-3.9.11\bin\mvn.cmd"
$checks += @{
    name = "maven"
    found = ((Get-Command "mvn" -ErrorAction SilentlyContinue) -or (Test-Path $localMaven))
    version = if (Test-Path $localMaven) { (& $localMaven "--version" 2>&1 | Select-Object -First 1) -join " " } else { $null }
    required_for = "enterprise-backend"
}

$tauriConfig = Get-Content (Join-Path $Root "desktop-tauri\src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json
$cspConfigured = $null -ne $tauriConfig.app.security.csp -and $tauriConfig.app.security.csp.Trim().Length -gt 0
$encryptedDbConfigured = Select-String -Path (Join-Path $Root "desktop-tauri\src-tauri\Cargo.toml") -Pattern "sqlcipher|bundled-sqlcipher" -Quiet

$report = @{
    generated_at = (Get-Date).ToString("o")
    checks = $checks
    csp_configured = $cspConfigured
    encrypted_db_configured = $encryptedDbConfigured
    build_ready = $cspConfigured -and -not ($checks | Where-Object { -not $_.found -and $_.name -in @("cargo", "rustc", "tesseract", "sqlite3") })
    release_ready = $cspConfigured -and $encryptedDbConfigured -and -not ($checks | Where-Object { -not $_.found -and $_.name -in @("cargo", "rustc", "tesseract", "sqlite3") })
    notes = @(
        "Release requires Rust/Cargo for full Tauri build.",
        "OCR release requires Tesseract or another OCR engine.",
        "Encrypted local DB/SQLCipher remains required before real legal data."
    )
}

$reportPath = Join-Path $Reports "release_readiness.json"
$report | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $reportPath

Write-Host "Release readiness report:" $reportPath
Write-Host "CSP configured:" $cspConfigured
Write-Host "Encrypted DB configured:" $encryptedDbConfigured
$checks | Format-Table -AutoSize
if (-not $report.release_ready) {
    Write-Warning "Release readiness is incomplete. See report for missing prerequisites."
    exit 1
}
