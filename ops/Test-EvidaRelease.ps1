param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

$release = Join-Path $Root "Evida Release"
$required = @(
    "Evida.exe",
    "Evida installer.exe",
    "Evida installer.msi",
    "SHA256SUMS.txt",
    "release-manifest.json",
    "LES_MEG.txt"
)

foreach ($name in $required) {
    $path = Join-Path $release $name
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing release file: $path"
    }
}

$checksumLines = Get-Content -LiteralPath (Join-Path $release "SHA256SUMS.txt")
foreach ($line in $checksumLines) {
    if ($line -notmatch '^([a-f0-9]{64})\s\s(.+)$') {
        throw "Invalid checksum line: $line"
    }
    $expected = $Matches[1]
    $fileName = $Matches[2]
    $filePath = Join-Path $release $fileName
    if (-not (Test-Path -LiteralPath $filePath)) {
        throw "Checksum references missing file: $fileName"
    }
    $actual = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        throw "Checksum mismatch for $fileName"
    }
}

$manifest = Get-Content -Raw -LiteralPath (Join-Path $release "release-manifest.json") | ConvertFrom-Json
if ($manifest.product -ne "Evida") {
    throw "Manifest product must be Evida"
}
if ($manifest.real_client_data_allowed -ne $false) {
    throw "Manifest must mark real_client_data_allowed=false for evaluation builds"
}

Write-Host "Evida release verification passed."
