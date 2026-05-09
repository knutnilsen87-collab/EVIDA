param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$desktop = Join-Path $Root "evida-core\desktop-tauri"
$release = Join-Path $Root "Evida Release"
$target = Join-Path $desktop "src-tauri\target\release"
$nsis = Join-Path $target "bundle\nsis\Evida_0.1.0_x64-setup.exe"
$msi = Join-Path $target "bundle\msi\Evida_0.1.0_x64_en-US.msi"
$exe = Join-Path $target "evida-desktop.exe"

if (-not $SkipBuild) {
    Push-Location $desktop
    try {
        npm.cmd run tauri:build
    } finally {
        Pop-Location
    }
}

New-Item -ItemType Directory -Force -Path $release | Out-Null

$artifacts = @(
    @{ Source = $exe; Destination = (Join-Path $release "Evida.exe") },
    @{ Source = $nsis; Destination = (Join-Path $release "Evida installer.exe") },
    @{ Source = $msi; Destination = (Join-Path $release "Evida installer.msi") }
)

foreach ($artifact in $artifacts) {
    if (-not (Test-Path $artifact.Source)) {
        throw "Missing release artifact: $($artifact.Source)"
    }
    Copy-Item -LiteralPath $artifact.Source -Destination $artifact.Destination -Force
}

$checksumPath = Join-Path $release "SHA256SUMS.txt"
$manifestPath = Join-Path $release "release-manifest.json"
$readmePath = Join-Path $release "LES_MEG.txt"

$checksums = foreach ($file in Get-ChildItem -LiteralPath $release -File | Where-Object { $_.Name -match '^Evida' }) {
    $hash = Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256
    [pscustomobject]@{
        file = $file.Name
        sha256 = $hash.Hash.ToLowerInvariant()
        bytes = $file.Length
        updated_at = $file.LastWriteTimeUtc.ToString("o")
    }
}

$checksums | ForEach-Object { "$($_.sha256)  $($_.file)" } | Set-Content -LiteralPath $checksumPath -Encoding UTF8

[pscustomobject]@{
    product = "Evida"
    version = "0.1.0-alpha"
    status = "pre-alpha evaluation build"
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    local_processing = $true
    real_client_data_allowed = $false
    artifacts = $checksums
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

@"
Evida Release
==============

Dobbeltklikk Evida.exe for å starte programmet direkte.

Status:
- PRE-ALPHA / evaluation build
- Bruk testdata
- Ikke bruk ekte klientdata uten skriftlig avtale og verifisert sikkerhetsoppsett

Installerfiler:
- Evida installer.exe  (anbefalt Windows-installer)
- Evida installer.msi  (MSI-pakke)

Kontrollfiler:
- SHA256SUMS.txt
- release-manifest.json

Rotmappen har én startfil:
- Start Evida.bat
"@ | Set-Content -LiteralPath $readmePath -Encoding UTF8

Write-Host "Evida release prepared:"
Write-Host "  $release"
Write-Host "  $checksumPath"
Write-Host "  $manifestPath"

