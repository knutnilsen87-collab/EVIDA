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

Assert-FileContains "evida-core\desktop-tauri\src-tauri\src\crypto.rs" "Aes256Gcm" "Rust crypto module must use AES-256-GCM."
Assert-FileContains "evida-core\desktop-tauri\src-tauri\src\db.rs" "encrypt_existing_sensitive_fields" "Database layer must encrypt sensitive fields."
Assert-FileContains "evida-core\desktop-tauri\src-tauri\src\audit.rs" "verify_audit_chain" "Audit chain verification must exist."
Assert-FileContains "evida-core\desktop-tauri\src-tauri\src\commands.rs" "EXTERNAL_AI_DISABLED_BY_SETTINGS" "Provider policy must block external AI by default."
Assert-FileContains "evida-core\desktop-tauri\src-tauri\src\commands.rs" "source_excerpt_cleaning_removes_metadata" "Rust command hardening tests must include source cleaning."
Assert-FileContains "evida-core\desktop-tauri\src-tauri\src\commands.rs" "blocked_answer_metadata_forces_safe_fallback_text" "Rust command hardening tests must include fallback blocking."
Assert-FileContains "docs\RUST_TEST_EXECUTION_STATUS.md" "does not replace" "Rust execution status must state static gate is not cargo test."

Write-Host "Evida Rust static hardening checks passed."
