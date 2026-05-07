param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

$requiredFiles = @(
    "ARCHITECTURE.md",
    "SECURITY.md",
    "DECISIONS\ADR-001-backend-ownership.md",
    "DECISIONS\ADR-002-local-first-data-policy.md",
    "DECISIONS\ADR-003-ai-provider-policy.md",
    "DECISIONS\ADR-004-audit-hash-chain.md",
    "docs\IMPLEMENTATION_PLAN.md",
    "evida-core\backend-api\README.md",
    "evida-core\DECISIONS\ADR-001-backend-ownership.md"
)

$failures = New-Object System.Collections.Generic.List[string]

foreach ($relativePath in $requiredFiles) {
    $path = Join-Path $Root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $failures.Add("Missing required file: $relativePath")
    }
}

function Assert-Contains {
    param(
        [string]$RelativePath,
        [string]$Pattern,
        [string]$Message
    )

    $path = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return
    }

    $content = Get-Content -Raw -LiteralPath $path
    if ($content -notmatch $Pattern) {
        $failures.Add($Message)
    }
}

Assert-Contains "README.md" "Spring Boot .*authoritative enterprise/control-plane backend" "README.md must state Spring Boot backend ownership."
Assert-Contains "README.md" "FastAPI starter .*deprecated" "README.md must state FastAPI backend deprecation."
Assert-Contains "evida-core\backend-api\README.md" "Status: deprecated" "backend-api README must begin from deprecated status."
Assert-Contains "evida-core\backend-api\README.md" "must not be used for tenant, policy, license, user, audit or provider-routing decisions" "backend-api README must forbid enterprise/control-plane ownership."
Assert-Contains "evida-core\DECISIONS\ADR-001-backend-ownership.md" "Canonical ADR" "evida-core ADR-001 must point to canonical root ADR."
Assert-Contains "DECISIONS\ADR-001-backend-ownership.md" "Spring Boot is the authoritative enterprise/control-plane backend" "Root ADR-001 must define Spring Boot ownership."
Assert-Contains "DECISIONS\ADR-002-local-first-data-policy.md" "local-first by default" "Root ADR-002 must define local-first policy."
Assert-Contains "DECISIONS\ADR-003-ai-provider-policy.md" "AI provider policy is owned by the Spring Boot control plane" "Root ADR-003 must define AI provider ownership."
Assert-Contains "DECISIONS\ADR-004-audit-hash-chain.md" "tamper-evident hash chain" "Root ADR-004 must define audit hash-chain direction."

if ($failures.Count -gt 0) {
    Write-Host "Production boundary verification failed:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Production boundary verification passed." -ForegroundColor Green
