param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

$ReportDir = Join-Path $Root "artifacts\security"
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Invoke-Captured {
    param(
        [string]$Name,
        [scriptblock]$Command
    )
    $output = & $Command 2>&1
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    [pscustomobject]@{
        name = $Name
        exit_code = $exitCode
        status = if ($exitCode -eq 0) { "PASS" } else { "BLOCKED" }
        output = @($output | ForEach-Object { $_.ToString() })
    }
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Text
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    $normalized = (($Text.Replace("`r`n", "`n") -split "`n") | ForEach-Object { $_.TrimEnd() }) -join "`n"
    [System.IO.File]::WriteAllText($Path, $normalized, $encoding)
}

function New-BlockedEvidence {
    param(
        [string]$Name,
        [string]$Message
    )
    [pscustomobject]@{
        name = $Name
        exit_code = 127
        status = "BLOCKED"
        output = @($Message)
    }
}

function Resolve-MavenCommand {
    $wrapper = Join-Path $Root "evida-core\services\saksrom-api\mvnw.cmd"
    if (Test-Path -LiteralPath $wrapper) {
        return $wrapper
    }

    $pathCommand = Get-Command mvn -ErrorAction SilentlyContinue
    if ($pathCommand) {
        return $pathCommand.Source
    }

    $cached = Get-ChildItem -Path (Join-Path $env:USERPROFILE ".evida-tools\apache-maven-*\bin\mvn.cmd") -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cached) {
        return $cached.FullName
    }

    return $null
}

$inventoryOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "ops\New-EvidaDependencyInventory.ps1") 2>&1
$inventoryPath = Join-Path $Root "evida-core\reports\dependency-inventory.json"

$secretScan = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "ops\Test-EvidaSecretScan.ps1") | ConvertFrom-Json)

$npmAuditPath = Join-Path $ReportDir "npm-audit.json"
$previousNodeOptions = $env:NODE_OPTIONS
$env:NODE_OPTIONS = (($previousNodeOptions, "--use-system-ca") | Where-Object { $_ } | Select-Object -Unique) -join " "
$npmCommand = Get-Command npm.cmd,npm -ErrorAction SilentlyContinue | Select-Object -First 1
$npmAudit = if ($npmCommand) {
    Invoke-Captured -Name "npm-audit" -Command {
        Push-Location (Join-Path $Root "evida-core\desktop-tauri")
        try {
            & $npmCommand.Source audit --json
        }
        finally {
            Pop-Location
        }
    }
}
else {
    New-BlockedEvidence -Name "npm-audit" -Message "npm was not available."
}
$env:NODE_OPTIONS = $previousNodeOptions
Write-Utf8NoBom -Path $npmAuditPath -Text ($npmAudit.output -join [Environment]::NewLine)

$cargoTreePath = Join-Path $ReportDir "cargo-tree.txt"
$cargoCommand = Get-Command cargo -ErrorAction SilentlyContinue
$cargoTree = if ($cargoCommand) {
    Invoke-Captured -Name "cargo-tree" -Command {
        & $cargoCommand.Source tree --manifest-path (Join-Path $Root "evida-core\desktop-tauri\src-tauri\Cargo.toml") --locked
    }
}
else {
    New-BlockedEvidence -Name "cargo-tree" -Message "cargo was not available."
}
Write-Utf8NoBom -Path $cargoTreePath -Text ($cargoTree.output -join [Environment]::NewLine)

$mavenTreePath = Join-Path $ReportDir "maven-dependency-tree.txt"
$mavenCommand = Resolve-MavenCommand
$mavenTree = if ($mavenCommand) {
    Invoke-Captured -Name "maven-dependency-tree" -Command {
        & $mavenCommand -q -f (Join-Path $Root "evida-core\services\saksrom-api\pom.xml") org.apache.maven.plugins:maven-dependency-plugin:3.8.1:tree -DoutputType=text
    }
}
else {
    New-BlockedEvidence -Name "maven-dependency-tree" -Message "Maven was not available."
}
Write-Utf8NoBom -Path $mavenTreePath -Text ($mavenTree.output -join [Environment]::NewLine)

$npmVulnTotal = $null
if (Test-Path -LiteralPath $npmAuditPath) {
    try {
        $npmParsed = Get-Content -LiteralPath $npmAuditPath -Raw | ConvertFrom-Json
        $npmVulnTotal = $npmParsed.metadata.vulnerabilities.total
    }
    catch {
        $npmVulnTotal = $null
    }
}

$report = [pscustomobject]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    gate = "local-security-evidence"
    status = if ($secretScan.status -eq "PASS" -and $npmAudit.status -eq "PASS" -and $npmVulnTotal -eq 0) { "PARTIAL_PASS" } else { "BLOCKED" }
    production_gate = "BLOCKED"
    reason = "Local evidence exists, but production still requires signed SBOM plus CI SCA/SAST with no release-blocking findings."
    evidence = [pscustomobject]@{
        dependency_inventory = $inventoryPath
        secret_scan = $secretScan
        npm_audit = [pscustomobject]@{
            status = $npmAudit.status
            report = $npmAuditPath
            vulnerabilities_total = $npmVulnTotal
        }
        cargo_tree = [pscustomobject]@{
            status = $cargoTree.status
            report = $cargoTreePath
        }
        maven_dependency_tree = [pscustomobject]@{
            status = $mavenTree.status
            report = $mavenTreePath
            note = "Blocked here if Maven cannot resolve dependency plugin through local trust store."
        }
    }
    inventory_output = @($inventoryOutput | ForEach-Object { $_.ToString() })
}

$reportPath = Join-Path $ReportDir "evida-security-evidence.json"
Write-Utf8NoBom -Path $reportPath -Text ($report | ConvertTo-Json -Depth 12)
$report | ConvertTo-Json -Depth 12 -Compress
