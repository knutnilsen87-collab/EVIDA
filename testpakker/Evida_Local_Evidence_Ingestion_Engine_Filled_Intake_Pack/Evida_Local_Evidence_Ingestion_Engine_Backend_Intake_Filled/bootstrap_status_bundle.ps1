$ErrorActionPreference = "Stop"

$ProjectRoot = "F:\prosjekter\NEW_PROJECT"
$ProjectName = "NEW_PROJECT"
$ProjectType = "backend_api_project"
$StatusFile  = Join-Path $ProjectRoot "status_bundle.txt"
$ReadmeFile  = Join-Path $ProjectRoot "README_MASTER.md"

if (!(Test-Path $ProjectRoot)) {
    New-Item -ItemType Directory -Path $ProjectRoot -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$status = @"
PROJECT_NAME=$ProjectName
PROJECT_ROOT=$ProjectRoot
PROJECT_TYPE=$ProjectType
SOURCE_OF_TRUTH=README_MASTER.md
WORKFLOW_MODE=PASTE_DIRECTLY_IN_POWERSHELL
STATUS_BUNDLE_IS_PRIMARY_DOCUMENT=true
LAST_UPDATED=$timestamp
CURRENT_PHASE=Bootstrap
LAST_ACTION=Initialized project intake workflow
LAST_RESULT=PASS
NEXT_ACTION=Fill out intake documents in project folder, then return status_bundle.txt
BUILD_STATUS=UNKNOWN
COMPILE_STATUS=UNKNOWN
RUNTIME_STATUS=UNKNOWN
DB_STATUS=UNKNOWN
AUTH_STATUS=UNKNOWN
TEST_STATUS=UNKNOWN
CI_STATUS=UNKNOWN
RISKS=
NOTES=All future PowerShell blocks must update this file.

MACHINE_READABLE_JSON_BEGIN
{
  "project_name": "$ProjectName",
  "project_root": "$($ProjectRoot -replace '\\','\\\\')",
  "project_type": "$ProjectType",
  "source_of_truth": "README_MASTER.md",
  "workflow_mode": "paste_directly_in_powershell",
  "status_bundle_is_primary_document": true,
  "last_updated": "$timestamp",
  "current_phase": "Bootstrap",
  "last_action": "Initialized project intake workflow",
  "last_result": "PASS",
  "next_action": "Fill out intake documents in project folder, then return status_bundle.txt",
  "build_status": "UNKNOWN",
  "compile_status": "UNKNOWN",
  "runtime_status": "UNKNOWN",
  "db_status": "UNKNOWN",
  "auth_status": "UNKNOWN",
  "test_status": "UNKNOWN",
  "ci_status": "UNKNOWN",
  "risks": [],
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
Fill out all intake files in this project folder before asking GPT or developers to proceed.

## Source of truth
- status_bundle.txt for live execution status
- README_MASTER.md for overview and reading order

## Reading order
1. status_bundle.txt
2. README_MASTER.md
3. PROJECT_BRIEF.md
4. MVP_SCOPE.md
5. TECH_DIRECTION.md
6. UX_UI_DIRECTION.md
7. DATA_API_REQUIREMENTS.md (if relevant)
8. DELIVERY_HANDOFF.md
"@

Set-Content -Path $StatusFile -Value $status -Encoding UTF8
Set-Content -Path $ReadmeFile -Value $readme -Encoding UTF8

Write-Host ""
Write-Host "PASS: Intake project bootstrap initialized" -ForegroundColor Green
Write-Host "PROJECT ROOT: $ProjectRoot" -ForegroundColor Cyan
Write-Host "STATUS FILE:  $StatusFile" -ForegroundColor Cyan
Write-Host ""
Get-Content $StatusFile
