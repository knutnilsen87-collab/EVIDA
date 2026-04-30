$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$env:Path = "$env:USERPROFILE\.cargo\bin;C:\Program Files\Tesseract-OCR;$Root\.tools\bin;$env:Path"
$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (!(Test-Path $Python)) {
    $Python = "python"
}

try {
    Write-Host "Running Python AI engine tests..."
    Push-Location (Join-Path $Root "ai-engine")
    & $Python -m pytest
    Pop-Location

    Write-Host "Running backend API tests..."
    Push-Location (Join-Path $Root "backend-api")
    & $Python -m pytest
    Pop-Location

    Write-Host "Running Python lint..."
    & $Python -m ruff check (Join-Path $Root "ai-engine") (Join-Path $Root "backend-api")

    Write-Host "Running desktop frontend audit and build..."
    Push-Location (Join-Path $Root "desktop-tauri")
    npm.cmd audit --audit-level=moderate
    npm.cmd run build
    Pop-Location

    $LocalMaven = Join-Path $Root ".tools\apache-maven-3.9.11\bin\mvn.cmd"
    $Maven = $null
    if (Test-Path $LocalMaven) {
        $Maven = $LocalMaven
    } elseif (Get-Command "mvn" -ErrorAction SilentlyContinue) {
        $Maven = "mvn"
    }

    if ($null -ne $Maven) {
        Write-Host "Running Spring Boot backend tests..."
        Push-Location (Join-Path $Root "services\saksrom-api")
        & $Maven test
        Pop-Location
    } else {
        Write-Warning "Maven not found. Skipping Spring Boot tests."
    }
} finally {
    while ((Get-Location).Path -ne $Root -and (Get-Location).Path.StartsWith($Root)) {
        Pop-Location
    }
}
