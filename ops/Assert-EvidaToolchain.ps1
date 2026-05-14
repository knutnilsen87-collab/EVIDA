param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

function Resolve-Tool {
    param(
        [string]$Name,
        [string[]]$Commands,
        [string]$RequiredFor,
        [string[]]$LocalPaths = @()
    )

    foreach ($localPath in $LocalPaths) {
        $fullPath = Join-Path $Root $localPath
        if (Test-Path -LiteralPath $fullPath) {
            return [pscustomobject]@{
                name = $Name
                status = "PASS"
                command = $fullPath
                required_for = $RequiredFor
                message = "$Name available via repo-local wrapper."
            }
        }
    }

    foreach ($command in $Commands) {
        $resolved = Get-Command $command -ErrorAction SilentlyContinue
        if ($resolved) {
            return [pscustomobject]@{
                name = $Name
                status = "PASS"
                command = $resolved.Source
                required_for = $RequiredFor
                message = "$Name available on PATH."
            }
        }
    }

    [pscustomobject]@{
        name = $Name
        status = "BLOCKED"
        command = $null
        required_for = $RequiredFor
        message = "$Name is missing. Install or provide it in CI; this script does not install tools automatically."
    }
}

$tools = @(
    (Resolve-Tool -Name "java" -Commands @("java") -RequiredFor "backend_tests"),
    (Resolve-Tool -Name "maven" -Commands @("mvn") -LocalPaths @("evida-core\services\saksrom-api\mvnw.cmd", "evida-core\services\saksrom-api\mvnw") -RequiredFor "backend_tests"),
    (Resolve-Tool -Name "node" -Commands @("node") -RequiredFor "desktop_frontend_tests"),
    (Resolve-Tool -Name "npm" -Commands @("npm.cmd", "npm") -RequiredFor "desktop_frontend_tests"),
    (Resolve-Tool -Name "cargo" -Commands @("cargo") -RequiredFor "desktop_rust_tests"),
    (Resolve-Tool -Name "python" -Commands @("python", "py") -RequiredFor "status_bundle_validation"),
    (Resolve-Tool -Name "gitleaks" -Commands @("gitleaks") -RequiredFor "secret_scan")
)

$blocked = @($tools | Where-Object { $_.status -ne "PASS" })

[pscustomobject]@{
    gate = "evida-toolchain"
    status = if ($blocked.Count -eq 0) { "PASS" } else { "BLOCKED" }
    tools = $tools
    blocked_tools = @($blocked | ForEach-Object { $_.name })
} | ConvertTo-Json -Depth 6 -Compress

