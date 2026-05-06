$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Manifest = Join-Path $Root "reports\hash_manifest.json"

if (!(Test-Path $Manifest)) {
    python (Join-Path $PSScriptRoot "hash_manifest.py") --root $Root --out $Manifest
    Write-Host "Manifest created. Re-run verification after changes are committed/frozen."
    exit 0
}

$stored = Get-Content $Manifest -Raw | ConvertFrom-Json
$failures = @()

foreach ($file in $stored.files) {
    $path = Join-Path $Root $file.path
    if (!(Test-Path $path)) {
        $failures += @{ path = $file.path; reason = "missing" }
        continue
    }
    $actual = (Get-FileHash -Algorithm SHA256 $path).Hash.ToLowerInvariant()
    if ($actual -ne $file.sha256) {
        $failures += @{ path = $file.path; reason = "sha256_mismatch"; expected = $file.sha256; actual = $actual }
    }
}

if ($failures.Count -gt 0) {
    $failures | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $Root "reports\integrity_failures.json")
    Write-Error "Integrity verification failed for $($failures.Count) file(s)."
}

Write-Host "Integrity verification passed for $($stored.file_count) files."
