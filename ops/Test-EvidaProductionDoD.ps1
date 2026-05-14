param(
    [switch]$RequireProductionReady,
    [switch]$SkipMaven
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ReportDir = Join-Path $Root "artifacts\production-dod"
$ReportPath = Join-Path $ReportDir "evida-production-dod-report.json"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Invoke-Gate {
    param(
        [string]$Name,
        [string]$Script,
        [string[]]$Arguments = @()
    )
    $scriptPath = Join-Path $Root $Script
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $scriptPath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    $parsed = $null
    $jsonLine = @($output | Where-Object { $_.ToString().Trim().StartsWith("{") } | Select-Object -Last 1)
    if ($jsonLine.Count -gt 0) {
        try {
            $parsed = $jsonLine[-1].ToString() | ConvertFrom-Json
        }
        catch {
            $parsed = $null
        }
    }
    $semanticStatus = if ($parsed -and $parsed.verdict) {
        $parsed.verdict
    }
    elseif ($parsed -and $parsed.status) {
        $parsed.status
    }
    elseif ($exitCode -eq 0) {
        "PASS"
    }
    else {
        "FAIL"
    }
    [pscustomobject]@{
        name = $Name
        status = if ($exitCode -eq 0) { $semanticStatus } else { "FAIL" }
        exit_code = $exitCode
        details = $parsed
        output = @($output | ForEach-Object { $_.ToString() })
    }
}

function Get-SignatureGate {
    $release = Join-Path $Root "Evida Release"
    $artifacts = @(
        "Evida.exe",
        "Evida installer.exe",
        "Evida installer.msi",
        "Evida_0.1.0_x64-setup.exe",
        "Evida_0.1.0_x64_en-US.msi"
    )
    $results = foreach ($name in $artifacts) {
        $path = Join-Path $release $name
        if (Test-Path -LiteralPath $path) {
            $sig = Get-AuthenticodeSignature -LiteralPath $path
            [pscustomobject]@{
                artifact = $name
                status = $sig.Status.ToString()
                signer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }
            }
        }
        else {
            [pscustomobject]@{
                artifact = $name
                status = "Missing"
                signer = $null
            }
        }
    }
    $allValid = @($results | Where-Object { $_.status -ne "Valid" }).Count -eq 0
    [pscustomobject]@{
        name = "windows-code-signing"
        status = if ($allValid) { "PASS" } else { "BLOCKED" }
        artifacts = @($results)
    }
}

function Get-SbomGate {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "ops\New-EvidaDependencyInventory.ps1") | Out-Null
    $inventory = Join-Path $Root "evida-core\reports\dependency-inventory.json"
    [pscustomobject]@{
        name = "sbom-and-security-scan"
        status = if (Test-Path -LiteralPath $inventory) { "BLOCKED" } else { "FAIL" }
        local_inventory = if (Test-Path -LiteralPath $inventory) { (Resolve-Path $inventory).Path } else { $null }
        reason = "Local dependency inventory exists, but signed SBOM plus CI SCA/SAST vulnerability gate is still required for production."
    }
}

$controlArgs = @()
if ($SkipMaven) {
    $controlArgs += "-SkipMaven"
}

$gates = @(
    (Invoke-Gate "desktop-hardening" "ops\Test-EvidaHardening.ps1"),
    (Invoke-Gate "release-artifacts" "ops\Test-EvidaRelease.ps1"),
    (Invoke-Gate "release-hardening-docs" "ops\Test-EvidaReleaseHardening.ps1"),
    (Invoke-Gate "first-user-readiness-pack" "ops\Test-EvidaFirstUserReadiness.ps1"),
    (Invoke-Gate "control-plane-auth-rbac-audit" "ops\Test-EvidaControlPlaneGate.ps1" $controlArgs),
    (Get-SignatureGate),
    (Get-SbomGate)
)

$blocking = @($gates | Where-Object { $_.status -ne "PASS" })
$report = [pscustomobject]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    production_ready = $blocking.Count -eq 0
    first_user_allowed = $false
    verdict = if ($blocking.Count -eq 0) { "PASS" } else { "BLOCKED" }
    gates = $gates
    remaining_manual_gates = @(
        "Code-sign Windows executable and installers with a trusted certificate.",
        "Generate signed SBOM and run CI SCA/SAST with no release-blocking findings.",
        "Run clean-machine smoke test on a separate Windows profile or machine.",
        "Complete first-user approval checklist and status bundle review."
    )
}

$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
$report | ConvertTo-Json -Depth 8

if ($RequireProductionReady -and -not $report.production_ready) {
    throw "Production DoD is blocked. See $ReportPath"
}
