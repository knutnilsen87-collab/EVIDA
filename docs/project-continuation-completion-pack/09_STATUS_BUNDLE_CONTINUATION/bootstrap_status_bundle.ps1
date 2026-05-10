$ErrorActionPreference = "Stop"

$ProjectRoot = "F:\prosjekter\EXISTING_PROJECT"
$ProjectName = "EXISTING_PROJECT"
$ProjectType = "in_progress_project"
$StatusFile  = Join-Path $ProjectRoot "status_bundle.txt"
$ReadmeFile  = Join-Path $ProjectRoot "README_MASTER.md"

if (!(Test-Path $ProjectRoot)) {
    throw "Project root not found: $ProjectRoot"
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$status = @"
PROJECT_NAME=$ProjectName
PROJECT_ROOT=$ProjectRoot
PROJECT_TYPE=$ProjectType
SOURCE_OF_TRUTH=README_MASTER.md
WORKFLOW_MODE=PASTE_DIRECTLY_IN_POWERSHELL
STATUS_BUNDLE_IS_PRIMARY_DOCUMENT=true
PROJECT_STATE_CONFIDENCE=LOW
LAST_UPDATED=$timestamp
CURRENT_PHASE=Continuation bootstrap
LAST_ACTION=Initialized continuation/completion workflow
LAST_RESULT=PASS
NEXT_ACTION=Fill out continuation/completion documents, then return status_bundle.txt
BUILD_STATUS=UNKNOWN
COMPILE_STATUS=UNKNOWN
RUNTIME_STATUS=UNKNOWN
DB_STATUS=UNKNOWN
AUTH_STATUS=UNKNOWN
TEST_STATUS=UNKNOWN
CI_STATUS=UNKNOWN
VERIFICATION_LEVEL=UNKNOWN
TOP_BLOCKER=Unknown until continuation audit is filled out
RISKS=Project reality may be less complete than expected
NOTES=All future PowerShell blocks must update this file.

MACHINE_READABLE_JSON_BEGIN
{
  "project_name": "$ProjectName",
  "project_root": "$($ProjectRoot -replace '\\','\\\\')",
  "project_type": "$ProjectType",
  "source_of_truth": "README_MASTER.md",
  "workflow_mode": "paste_directly_in_powershell",
  "status_bundle_is_primary_document": true,
  "project_state_confidence": "LOW",
  "last_updated": "$timestamp",
  "current_phase": "Continuation bootstrap",
  "last_action": "Initialized continuation/completion workflow",
  "last_result": "PASS",
  "next_action": "Fill out continuation/completion documents, then return status_bundle.txt",
  "build_status": "UNKNOWN",
  "compile_status": "UNKNOWN",
  "runtime_status": "UNKNOWN",
  "db_status": "UNKNOWN",
  "auth_status": "UNKNOWN",
  "test_status": "UNKNOWN",
  "ci_status": "UNKNOWN",
  "verification_level": "UNKNOWN",
  "top_blocker": "Unknown until continuation audit is filled out",
  "risks": [
    "Project reality may be less complete than expected"
  ],
  "notes": [
    "All future PowerShell blocks must update this file."
  ]
}
MACHINE_READABLE_JSON_END
"@

$readme = @"
# README_MASTER

## Project
Name: $ProjectName
Type: $ProjectType

## Purpose
Use this continuation/completion pack to get a truthful view of the current project state and define the smartest path to completion.

## Source of truth
- status_bundle.txt for live execution status
- README_MASTER.md for overview and reading order

## Reading order
1. status_bundle.txt
2. README_MASTER.md
3. 01_PROJECT_IDENTITY/PROJECT_IDENTITY.md
4. 02_REALITY_CHECK/CURRENT_STATE_AUDIT.md
5. 03_SOURCE_OF_TRUTH/SOURCE_OF_TRUTH_MAP.md
6. 04_PRODUCT_SCOPE_STATUS/MVP_COMPLETION_PLAN.md
7. 05_TECHNICAL_BASELINE/TECHNICAL_BASELINE.md
8. 06_GAPS_BLOCKERS_TECH_DEBT/BLOCKERS_AND_RISKS.md
9. 07_COMPLETION_PLAN/NEXT_30_ACTIONS.md
10. 08_HANDOFF_ONBOARDING/DEVELOPER_HANDOFF_NOW.md
"@

Set-Content -Path $StatusFile -Value $status -Encoding UTF8
if (!(Test-Path $ReadmeFile)) {
    Set-Content -Path $ReadmeFile -Value $readme -Encoding UTF8
}

Write-Host ""
Write-Host "PASS: Continuation/completion bootstrap initialized" -ForegroundColor Green
Write-Host "PROJECT ROOT: $ProjectRoot" -ForegroundColor Cyan
Write-Host "STATUS FILE:  $StatusFile" -ForegroundColor Cyan
Write-Host ""
Get-Content $StatusFile
