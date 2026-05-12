$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Assert-FileContains {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Message
    )

    $fullPath = Join-Path $Root $Path
    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "Missing required file: $Path"
    }

    $content = Get-Content -LiteralPath $fullPath -Raw
    if ($content -notmatch $Pattern) {
        throw $Message
    }
}

powershell -ExecutionPolicy Bypass -File (Join-Path $Root "ops\New-EvidaDependencyInventory.ps1")

Assert-FileContains "docs\SECURITY_FOUNDATION_STATUS.md" "Sensitive legal text fields are encrypted" "Security foundation status must describe current encryption controls."
Assert-FileContains "docs\AI_SOURCE_TRUST_QA.md" "Prompt-injection" "AI/source QA must include prompt-injection coverage."
Assert-FileContains "docs\LEGAL_WORKROOM_QA.md" "Chronology" "Legal workroom QA must list workroom surfaces."
Assert-FileContains "docs\RELEASE_HARDENING_STATUS.md" "Production blockers" "Release hardening status must keep blockers visible."
Assert-FileContains "docs\DEPENDENCY_AND_SBOM_PLAN.md" "signed SBOM" "Dependency/SBOM plan must include signed SBOM production target."
Assert-FileContains "docs\RELEASE_SIGNING_DECISION.md" "unsigned pre-alpha evaluation builds" "Release signing decision must state current unsigned status."
Assert-FileContains "docs\CSP_AND_CONNECT_SOURCES.md" "do not add broad" "CSP review must block broad external connect sources."
Assert-FileContains "docs\PROD_READINESS_CHECKLIST.md" "Dependency/SBOM gate" "Prod readiness checklist must include dependency/SBOM gate."
Assert-FileContains "evida-core\reports\dependency-inventory.json" "local dependency inventory" "Dependency inventory must be generated."

Write-Host "Evida release hardening checks passed."
