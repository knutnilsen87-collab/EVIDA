$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Reports = Join-Path $Root "evida-core\reports"
New-Item -ItemType Directory -Force -Path $Reports | Out-Null

function Get-PackageLockSummary {
    $path = Join-Path $Root "evida-core\desktop-tauri\package-lock.json"
    if (-not (Test-Path -LiteralPath $path)) {
        return @{ found = $false; dependency_count = 0 }
    }
    $content = Get-Content -LiteralPath $path -Raw
    $count = ([regex]::Matches($content, 'node_modules[/\\][^"]+"')).Count
    return @{ found = $true; dependency_count = $count }
}

function Get-CargoLockSummary {
    $path = Join-Path $Root "evida-core\desktop-tauri\src-tauri\Cargo.lock"
    if (-not (Test-Path -LiteralPath $path)) {
        return @{ found = $false; dependency_count = 0 }
    }
    $content = Get-Content -LiteralPath $path
    $count = @($content | Where-Object { $_ -eq "[[package]]" }).Count
    return @{ found = $true; dependency_count = $count }
}

function Get-MavenSummary {
    $path = Join-Path $Root "evida-core\services\saksrom-api\pom.xml"
    if (-not (Test-Path -LiteralPath $path)) {
        return @{ found = $false; dependency_count = 0 }
    }
    [xml]$pom = Get-Content -LiteralPath $path -Raw
    $count = @($pom.project.dependencies.dependency).Count
    return @{ found = $true; dependency_count = $count }
}

$inventory = [pscustomobject]@{
    generated_at = (Get-Date).ToString("o")
    status = "local dependency inventory, not a signed SBOM"
    package_lock = Get-PackageLockSummary
    cargo_lock = Get-CargoLockSummary
    maven_pom = Get-MavenSummary
    production_gate = "Before production, replace this with CI SCA/SAST plus signed SBOM artifact."
}

$path = Join-Path $Reports "dependency-inventory.json"
$inventory | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $path -Encoding UTF8
Write-Host "Dependency inventory written:" $path
