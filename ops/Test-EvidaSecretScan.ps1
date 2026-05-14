param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$ReportPath = "artifacts\security\gitleaks-report.json"
)

$ErrorActionPreference = "Stop"

function Resolve-Gitleaks {
    $command = Get-Command gitleaks -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $wingetCandidate = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages\Gitleaks.Gitleaks_*\gitleaks.exe") -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($wingetCandidate) {
        return $wingetCandidate.FullName
    }

    return $null
}

$gitleaks = Resolve-Gitleaks
$absoluteReportPath = Join-Path $Root $ReportPath
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $absoluteReportPath) | Out-Null

if (-not $gitleaks) {
    [pscustomobject]@{
        gate = "secret-scan"
        status = "BLOCKED"
        command = $null
        report = $absoluteReportPath
        message = "gitleaks is missing. Secret scan was not run."
    } | ConvertTo-Json -Depth 5 -Compress
    exit 0
}

$scopes = @(
    "evida-core\desktop-tauri\src",
    "evida-core\desktop-tauri\src-tauri\src",
    "evida-core\desktop-tauri\scripts",
    "ops",
    "scripts",
    "configs",
    "docs",
    "tests",
    ".github",
    "AGENTS.md",
    "casepilot_first_user_readiness_pack_manifest.json"
)

$findings = @()
$scanOutputs = @()
$exitCodes = @()
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    foreach ($scope in $scopes) {
        $source = Join-Path $Root $scope
        if (-not (Test-Path -LiteralPath $source)) {
            continue
        }
        $scopeReport = Join-Path (Split-Path -Parent $absoluteReportPath) ("gitleaks-report." + ($scope -replace '[\\/:*?"<>|]', '_') + ".json")
        $output = & $gitleaks dir $source --report-format json --report-path $scopeReport --redact --no-banner --timeout 180 --max-target-megabytes 5 --log-level error 2>&1
        $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
        $exitCodes += $exitCode
        $scanOutputs += @($output | ForEach-Object { $_.ToString() })
        if (Test-Path -LiteralPath $scopeReport) {
            $raw = Get-Content -LiteralPath $scopeReport -Raw
            if (-not [string]::IsNullOrWhiteSpace($raw)) {
                $parsed = @($raw | ConvertFrom-Json)
                foreach ($finding in $parsed) {
                    $finding | Add-Member -NotePropertyName scan_scope -NotePropertyValue $scope -Force
                    $findings += $finding
                }
            }
            Remove-Item -LiteralPath $scopeReport -Force -ErrorAction SilentlyContinue
        }
    }
}
finally {
    $ErrorActionPreference = $previousErrorActionPreference
}

$encoding = New-Object System.Text.UTF8Encoding($false)
$reportJson = if (@($findings).Count -eq 0) { "[]" } else { $findings | ConvertTo-Json -Depth 10 }
[System.IO.File]::WriteAllText($absoluteReportPath, $reportJson, $encoding)
$findingCount = @($findings).Count
$exitCode = if ($exitCodes -contains 1 -or $findingCount -gt 0) { 1 } elseif ($exitCodes | Where-Object { $_ -ne 0 }) { 2 } else { 0 }

[pscustomobject]@{
    gate = "secret-scan"
    status = if ($exitCode -eq 0 -and $findingCount -eq 0) { "PASS" } else { "FAIL" }
    command = $gitleaks
    report = $absoluteReportPath
    exit_code = $exitCode
    findings = $findingCount
    scopes = $scopes
    message = if ($exitCode -eq 0 -and $findingCount -eq 0) { "gitleaks secret scan passed." } else { "gitleaks reported potential secrets or failed." }
    output = $scanOutputs
} | ConvertTo-Json -Depth 8 -Compress

exit 0
