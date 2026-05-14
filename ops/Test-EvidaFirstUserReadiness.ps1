param(
    [string]$StatusBundle = "artifacts\first-user\status_bundle.first_user.final.json"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ManifestPath = Join-Path $Root "casepilot_first_user_readiness_pack_manifest.json"
$ZipPath = Join-Path $Root "casepilot_first_user_readiness_pack.zip"
$StatusBundlePath = Join-Path $Root $StatusBundle

function Assert-Exists {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing $Label`: $Path"
    }
}

function Get-PythonCommand {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) { return ,@($python.Source) }
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) { return ,@($py.Source, "-3") }
    throw "Python 3 is required to validate first-user status bundles."
}

function Invoke-JsonScript {
    param(
        [string]$ScriptPath
    )
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath 2>&1
    $jsonLine = @($output | ForEach-Object { $_.ToString() } | Where-Object { $_.Trim().StartsWith("{") } | Select-Object -Last 1)
    if ($jsonLine.Count -eq 0) {
        throw "Expected JSON output from $ScriptPath, got: $($output -join ' ')"
    }
    $jsonLine[-1] | ConvertFrom-Json
}

function Set-JsonProperty {
    param(
        [pscustomobject]$Object,
        [string]$Name,
        $Value
    )
    $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
}

function Write-JsonFile {
    param(
        [string]$Path,
        $Value
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 20), $encoding)
}

Assert-Exists $ManifestPath "first-user manifest"
Assert-Exists $ZipPath "first-user zip"
Assert-Exists $StatusBundlePath "first-user status bundle"
Assert-Exists (Join-Path $Root "configs\first-user\status_bundle.first_user.template.json") "first-user status bundle template"

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$expectedFiles = @($manifest.files)
if ($manifest.file_count -ne $expectedFiles.Count) {
    throw "Manifest file_count does not match files length."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
    $zipFiles = @(
        $zip.Entries |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_.Name) } |
            ForEach-Object { $_.FullName.Replace("/", "\") }
    )
}
finally {
    $zip.Dispose()
}

$expectedNormalized = @($expectedFiles | ForEach-Object { $_.Replace("/", "\") } | Sort-Object)
$actualNormalized = @($zipFiles | Sort-Object)
$missing = @($expectedNormalized | Where-Object { $_ -notin $actualNormalized })
$extra = @($actualNormalized | Where-Object { $_ -notin $expectedNormalized })
if ($missing.Count -gt 0 -or $extra.Count -gt 0) {
    throw "First-user zip does not match manifest. Missing=[$($missing -join ', ')] Extra=[$($extra -join ', ')]"
}

foreach ($relative in $expectedNormalized) {
    Assert-Exists (Join-Path $Root $relative) "extracted first-user file"
}

$requiredDocs = @(
    "docs\first-user\FIRST_USER_DOD.md",
    "docs\first-user\FIRST_USER_READINESS_MATRIX.md",
    "docs\first-user\MANUAL_SMOKE_TEST.md",
    "docs\first-user\APPROVAL_CHECKLIST.md",
    "artifacts\first-user\evidence.first_user.current.json",
    "artifacts\first-user\invariant_evaluation.first_user.json",
    "tests\golden\first_user\08_backup_restore.md"
)
foreach ($doc in $requiredDocs) {
    Assert-Exists (Join-Path $Root $doc) "first-user readiness doc"
}

$toolchain = Invoke-JsonScript -ScriptPath (Join-Path $Root "ops\Assert-EvidaToolchain.ps1")
$backendTests = Invoke-JsonScript -ScriptPath (Join-Path $Root "ops\Test-EvidaBackendTests.ps1")
$gitleaksTool = @($toolchain.tools | Where-Object { $_.name -eq "gitleaks" } | Select-Object -First 1)
$secretScan = if ($gitleaksTool.Count -eq 0 -or $gitleaksTool[0].status -ne "PASS") {
    [pscustomobject]@{
        gate = "secret-scan"
        status = "BLOCKED"
        command = $null
        message = "gitleaks is missing. Secret scan was not run."
    }
}
else {
    [pscustomobject]@{
        gate = "secret-scan"
        status = "PASS"
        command = $gitleaksTool[0].command
        message = "gitleaks is available. Run gitleaks in CI or a dedicated security job for final approval evidence."
    }
}

$backendStatus = if ($backendTests.status -eq "PASS") { "pass" } else { "blocked" }
$secretStatus = if ($secretScan.status -eq "PASS") { "pass" } else { "blocked" }
$evidencePath = Join-Path $Root "artifacts\first-user\evidence.first_user.current.json"
$evidence = Get-Content -LiteralPath $evidencePath -Raw | ConvertFrom-Json
Set-JsonProperty -Object $evidence.summary -Name "backend_tests_status" -Value $backendStatus
Set-JsonProperty -Object $evidence.summary -Name "secret_scan_status" -Value $secretStatus
Set-JsonProperty -Object $evidence.summary -Name "toolchain_status" -Value ($(if ($toolchain.status -eq "PASS") { "pass" } else { "blocked" }))
Set-JsonProperty -Object $evidence -Name "machine_readable_gates" -Value ([pscustomobject]@{
    toolchain = $toolchain
    backend_tests = $backendTests
    secret_scan = $secretScan
})
Write-JsonFile -Path $evidencePath -Value $evidence

$pythonCmd = Get-PythonCommand
$validator = Join-Path $Root "scripts\check-first-user-status-bundle.py"
if ($pythonCmd.Count -gt 1) {
    $validatorOutput = & $pythonCmd[0] $pythonCmd[1] $validator $StatusBundlePath
}
else {
    $validatorOutput = & $pythonCmd[0] $validator $StatusBundlePath
}
if ($LASTEXITCODE -ne 0) {
    throw "First-user status bundle validation failed."
}

$bundle = Get-Content -LiteralPath $StatusBundlePath -Raw | ConvertFrom-Json
$allowed = [bool]$bundle.current_state.first_user_allowed
$status = [string]$bundle.current_state.status

[pscustomobject]@{
    gate = "first-user-readiness-pack"
    zip_sha256 = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    manifest_file_count = $manifest.file_count
    status_bundle = (Resolve-Path $StatusBundlePath).Path
    first_user_allowed = $allowed
    status = $status
    verdict = if ($allowed -and $status -eq "pass") { "PASS" } else { "BLOCKED" }
    backend_tests_status = $backendStatus
    secret_scan_status = $secretStatus
    toolchain_status = if ($toolchain.status -eq "PASS") { "pass" } else { "blocked" }
    validator = $validatorOutput
} | ConvertTo-Json -Depth 5 -Compress
