$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$env:Path = "$env:USERPROFILE\.cargo\bin;C:\Program Files\Tesseract-OCR;$Root\.tools\bin;$env:Path"
$Reports = Join-Path $Root "reports"
New-Item -ItemType Directory -Force -Path $Reports | Out-Null

function Test-CommandVersion {
    param([string]$Name, [string]$VersionArg = "--version")
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $cmd) {
        return @{ name = $Name; found = $false; version = $null }
    }
    try {
        $version = (& $Name $VersionArg 2>&1 | Select-Object -First 1) -join " "
    } catch {
        $version = "found but version check failed"
    }
    return @{ name = $Name; found = $true; version = $version }
}

$checks = @(
    Test-CommandVersion "node" "--version"
    Test-CommandVersion "npm" "--version"
    Test-CommandVersion "java" "-version"
    Test-CommandVersion "mvn" "--version"
    Test-CommandVersion "cargo" "--version"
    Test-CommandVersion "rustc" "--version"
    Test-CommandVersion "python" "--version"
    Test-CommandVersion "tesseract" "--version"
    Test-CommandVersion "sqlite3" "--version"
)

$LocalMaven = Join-Path $Root ".tools\apache-maven-3.9.11\bin\mvn.cmd"
$hasLocalMaven = Test-Path $LocalMaven
if (Test-Path $LocalMaven) {
    $localMavenVersion = (& $LocalMaven "--version" 2>&1 | Select-Object -First 1) -join " "
    $checks += @{ name = "mvn-local"; found = $true; version = $localMavenVersion }
}

$report = @{
    generated_at = (Get-Date).ToString("o")
    checks = $checks
    passed = -not ($checks | Where-Object { -not $_.found -and !($_.name -eq "mvn" -and $hasLocalMaven) })
}

$reportPath = Join-Path $Reports "prereq_report.json"
$report | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $reportPath

Write-Host "Prerequisite report:" $reportPath
$checks | Format-Table -AutoSize
if (-not $report.passed) {
    Write-Warning "One or more prerequisites are missing."
    exit 1
}
