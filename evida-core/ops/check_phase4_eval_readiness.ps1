$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
$Desktop = Join-Path $Root "desktop-tauri"
$Tauri = Join-Path $Desktop "src-tauri"

$env:Path = "$env:USERPROFILE\.cargo\bin;C:\Program Files\Tesseract-OCR;$Root\.tools\bin;$env:Path"

function Assert-File {
    param([string]$Path)
    if (!(Test-Path $Path)) {
        throw "Missing required file: $Path"
    }
}

function Assert-Contains {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Message
    )
    if (!(Select-String -Path $Path -Pattern $Pattern -Quiet)) {
        throw $Message
    }
}

function Assert-NotContains {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Message
    )
    if (Select-String -Path $Path -Pattern $Pattern -Quiet) {
        throw $Message
    }
}

Write-Host "Checking phase 4 evaluation readiness..."

$App = Join-Path $Desktop "src\App.tsx"
$Api = Join-Path $Desktop "src\lib\api.ts"
$Db = Join-Path $Tauri "src\db.rs"
$Ingestion = Join-Path $Tauri "src\ingestion.rs"
$CargoToml = Join-Path $Tauri "Cargo.toml"

Assert-File $App
Assert-File $Api
Assert-File $Db
Assert-File $Ingestion
Assert-File (Join-Path $Tauri "src\crypto.rs")
Assert-File (Join-Path $Tauri "src\db_key.rs")
Assert-File (Join-Path $Desktop "src\components\EmptyStateAction.tsx")
Assert-File (Join-Path $Desktop "src\components\SourcePreviewDrawer.tsx")

foreach ($view in @(
    "ChronologyView.tsx",
    "EvidenceView.tsx",
    "ArgumentsView.tsx",
    "ContradictionsView.tsx",
    "RiskView.tsx"
)) {
    Assert-File (Join-Path $Desktop "src\components\workrooms\$view")
}

Assert-NotContains $App "GenericAnalysisView" "Generic source-feed workroom view must not be used for evaluation build."
Assert-Contains $App "Evaluation build" "Evaluation build label is missing."
Assert-Contains $App "SourcePreviewDrawer" "Source preview drawer is not wired into the app."

foreach ($command in @(
    "getDatabaseSecurityStatus",
    "listWorkItems",
    "buildChronology",
    "buildEvidenceMatrix",
    "createArgumentItem",
    "findContradictions",
    "assessRisk"
)) {
    Assert-Contains $Api $command "Missing frontend API command: $command"
}

foreach ($table in @(
    "chronology_events",
    "evidence_items",
    "argument_items",
    "contradiction_items",
    "risk_items"
)) {
    Assert-Contains $Db $table "Missing persistent work-item table: $table"
}

Assert-Contains $Db "encrypt_text" "Sensitive database writes are not routed through field encryption."
Assert-Contains $Db "decrypt_text" "Sensitive database reads are not routed through field decryption."
Assert-Contains $CargoToml "aes-gcm" "AES-GCM dependency is missing."
Assert-Contains $CargoToml "keyring" "Credential/keyring dependency is missing."
Assert-Contains $Ingestion "tesseract" "OCR command integration is missing."

Write-Host "Running desktop frontend build..."
Push-Location $Desktop
try {
    npm.cmd run build
} finally {
    Pop-Location
}

Write-Host "Running Tauri/Rust tests..."
Push-Location $Tauri
try {
    cargo test
} finally {
    Pop-Location
}

Write-Host "PHASE4_EVAL_READINESS=PASS"
