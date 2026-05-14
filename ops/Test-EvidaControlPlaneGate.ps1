param(
    [switch]$SkipMaven
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Service = Join-Path $Root "evida-core\services\saksrom-api"

function Assert-FileContains {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Message
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Missing required file: $Path"
    }
    $content = Get-Content -LiteralPath $Path -Raw
    if ($content -notmatch $Pattern) {
        throw $Message
    }
}

Assert-FileContains (Join-Path $Service "src\main\java\no\saksrom\api\config\SecurityConfig.java") "oauth2ResourceServer|localDevMode" "Control-plane security config must require JWT or explicit local-dev mode."
Assert-FileContains (Join-Path $Service "src\main\java\no\saksrom\api\config\SecurityModeValidator.java") "productionProfileRequires|Jwt|issuer" "Production security validator must fail closed without JWT trust config."
Assert-FileContains (Join-Path $Service "src\main\java\no\saksrom\api\security\CurrentUserService.java") "tenant|roles|Jwt" "Current user service must derive tenant and roles from authenticated context."
Assert-FileContains (Join-Path $Service "src\main\java\no\saksrom\api\audit\AuditService.java") "previousHash|verify|eventHash" "Audit service must maintain and verify hash chain."
Assert-FileContains (Join-Path $Service "src\test\java\no\saksrom\api\config\SecurityModeValidatorTest.java") "productionProfileRequiresJwtTrustConfiguration" "Security mode validator must have production fail-closed test coverage."
Assert-FileContains (Join-Path $Service "src\test\java\no\saksrom\api\casefile\CaseFileServiceTest.java") "listCasesFiltersByAuthenticatedTenant" "Tenant filtering must have test coverage."

$mavenStatus = "SKIPPED"
if (-not $SkipMaven) {
    $mvn = Get-Command mvn -ErrorAction SilentlyContinue
    if ($mvn) {
        Push-Location $Service
        try {
            & $mvn.Source test
            if ($LASTEXITCODE -ne 0) {
                throw "Maven tests failed for saksrom-api."
            }
            $mavenStatus = "PASS"
        }
        finally {
            Pop-Location
        }
    }
    else {
        $mavenStatus = "BLOCKED_MAVEN_NOT_FOUND"
    }
}

[pscustomobject]@{
    gate = "control-plane-auth-rbac-audit"
    service = $Service
    static_checks = "PASS"
    maven_tests = $mavenStatus
    verdict = if ($mavenStatus -eq "BLOCKED_MAVEN_NOT_FOUND") { "BLOCKED" } else { "PASS" }
} | ConvertTo-Json -Depth 4 -Compress
