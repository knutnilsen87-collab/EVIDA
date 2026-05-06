$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$StatusFile = Join-Path $Root "status_bundle.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$status = @"
PROJECT_NAME=Evida
PROJECT_ROOT=$Root
PROJECT_TYPE=evida_monorepo
SOURCE_OF_TRUTH=README_MASTER.md
WORKFLOW_MODE=PASTE_DIRECTLY_IN_POWERSHELL
STATUS_BUNDLE_IS_PRIMARY_DOCUMENT=true
LAST_UPDATED=$timestamp
CURRENT_PHASE=Local setup
LAST_ACTION=Generated status bundle
LAST_RESULT=PASS
NEXT_ACTION=Run check_prereqs.ps1 and initialize DB
BUILD_STATUS=UNKNOWN
COMPILE_STATUS=UNKNOWN
RUNTIME_STATUS=UNKNOWN
DB_STATUS=UNKNOWN
AUTH_STATUS=UNKNOWN
TEST_STATUS=UNKNOWN
CI_STATUS=UNKNOWN
RISKS=Starter scaffold only; validate locally.
NOTES=All legal outputs require source binding.

MACHINE_READABLE_JSON_BEGIN
{
  "project_name": "Evida",
  "project_root": "$($Root -replace '\\','\\\\')",
  "project_type": "evida_monorepo",
  "source_of_truth": "README_MASTER.md",
  "workflow_mode": "paste_directly_in_powershell",
  "status_bundle_is_primary_document": true,
  "last_updated": "$timestamp",
  "current_phase": "Local setup",
  "last_action": "Generated status bundle",
  "last_result": "PASS",
  "next_action": "Run check_prereqs.ps1 and initialize DB"
}
MACHINE_READABLE_JSON_END
"@

$status | Set-Content -Encoding UTF8 $StatusFile
Write-Host "Wrote $StatusFile"
Get-Content $StatusFile
