param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

$Service = Join-Path $Root "evida-core\services\saksrom-api"
$MvnwCmd = Join-Path $Service "mvnw.cmd"
$MvnwSh = Join-Path $Service "mvnw"
$mavenCommand = $null
$mavenArgs = @()

if (Test-Path -LiteralPath $MvnwCmd) {
    $mavenCommand = $MvnwCmd
}
elseif (Test-Path -LiteralPath $MvnwSh) {
    $mavenCommand = $MvnwSh
}
else {
    $mvn = Get-Command mvn -ErrorAction SilentlyContinue
    if ($mvn) {
        $mavenCommand = $mvn.Source
    }
    else {
        $localMaven = Get-ChildItem -Path (Join-Path $env:USERPROFILE ".evida-tools\apache-maven-*\bin\mvn.cmd") -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($localMaven) {
            $mavenCommand = $localMaven.FullName
        }
    }
}

if (-not $mavenCommand) {
    [pscustomobject]@{
        gate = "backend-tests"
        status = "BLOCKED"
        service = $Service
        command = $null
        message = "Maven is missing and no mvnw wrapper was found under evida-core/services/saksrom-api. Backend tests were not run."
    } | ConvertTo-Json -Depth 5 -Compress
    exit 0
}

Push-Location $Service
try {
    & $mavenCommand @mavenArgs test
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

[pscustomobject]@{
    gate = "backend-tests"
    status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
    service = $Service
    command = $mavenCommand
    exit_code = $exitCode
    message = if ($exitCode -eq 0) { "Backend Maven tests passed." } else { "Backend Maven tests failed." }
} | ConvertTo-Json -Depth 5 -Compress

exit 0
