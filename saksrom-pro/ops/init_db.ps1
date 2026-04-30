$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$env:Path = "$Root\.tools\bin;$env:Path"
$DbDir = Join-Path $Root "local_data"
$Schema = Join-Path $Root "db\schema.sql"
$DbPath = Join-Path $DbDir "saksrom.local.sqlite3"

New-Item -ItemType Directory -Force -Path $DbDir | Out-Null

if (!(Get-Command sqlite3 -ErrorAction SilentlyContinue)) {
    throw "sqlite3 was not found. Install SQLite CLI or initialize through the app."
}

sqlite3 $DbPath ".read $Schema"

Write-Host "Initialized DB:" $DbPath
