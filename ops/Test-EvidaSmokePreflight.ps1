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

Assert-FileContains "CURRENT_STATUS.md" "pre-alpha local evaluation build" "CURRENT_STATUS.md must state current evaluation status."
Assert-FileContains "README.md" "CURRENT_STATUS\.md" "README.md must link the current status file."
Assert-FileContains "evida-core\backend-api\DEPRECATED.md" "deprecated for enterprise/control-plane use" "FastAPI starter must have an in-folder deprecation marker."
Assert-FileContains "docs\SPRING_BOOT_VERIFICATION.md" "mvn test" "Spring Boot verification doc must define mvn test."
Assert-FileContains "docs\ACCEPTANCE_SMOKE_TEST.md" "import -> Saksrom -> source -> workroom" "Acceptance smoke test must name the end-to-end smoke path."
Assert-FileContains "docs\WINDOWS_BUILD_PREREQUISITES.md" "Maven is missing locally" "Windows prerequisites must record current Maven gap."
Assert-FileContains "docs\CLEAN_MACHINE_SMOKE_RESULT.md" "not yet passed" "Clean-machine smoke result must be explicit."
Assert-FileContains "docs\RELEASE_CHECKLIST.md" "real client data" "Release checklist must state the real-client-data boundary."
Assert-FileContains "docs\CSP_AND_CONNECT_SOURCES.md" "connect-src.*127\.0\.0\.1" "CSP/connect-source review must document localhost access."
Assert-FileContains "docs\STALE_DOC_INVENTORY.md" "historical planning" "Stale doc inventory must identify historical planning docs."
Assert-FileContains "docs\RELEASE_ARTIFACT_REVIEW.md" "Test-EvidaRelease\.ps1" "Release artifact review must define verification command."
Assert-FileContains "docs\SECURITY_FOUNDATION_STATUS.md" "Full-file SQLCipher" "Security foundation status must keep full database encryption gap visible."
Assert-FileContains "docs\AI_SOURCE_TRUST_QA.md" "Safe fallback" "AI/source trust QA must require safe fallback."
Assert-FileContains "docs\LEGAL_WORKROOM_QA.md" "Legal Workroom QA" "Legal workroom QA must exist."
Assert-FileContains "docs\RELEASE_HARDENING_STATUS.md" "Release Hardening Status" "Release hardening status must exist."
Assert-FileContains "ops\Test-EvidaHardening.ps1" "Test-EvidaSmokePreflight\.ps1" "Hardening script must include smoke preflight."

Write-Host "Evida smoke preflight passed."
