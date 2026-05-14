#!/usr/bin/env bash
set -euo pipefail

# First User Readiness Gauntlet
# Safe to run locally. CI can call this script once project-specific commands are mapped.
#
# This script intentionally fails closed for missing critical docs/config.
# Replace TODO command blocks with repo-specific test commands as they become available.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "❌ $1" >&2
  exit 1
}

warn() {
  echo "⚠️  $1" >&2
}

pass() {
  echo "✅ $1"
}

require_file() {
  local f="$1"
  [[ -f "$f" ]] || fail "Missing required file: $f"
  pass "Found $f"
}

echo "== First User Readiness Gauntlet =="

require_file "AGENTS.md"
require_file "docs/first-user/FIRST_USER_SCOPE.md"
require_file "docs/first-user/FIRST_USER_DOD.md"
require_file "docs/first-user/FIRST_USER_READINESS_MATRIX.md"
require_file "docs/first-user/DOCUMENT_UPLOAD_READINESS.md"
require_file "docs/first-user/PRODUCT_INVARIANTS.md"
require_file "configs/first-user/status_bundle.first_user.template.json"
require_file "configs/first-user/first_user_status_bundle.schema.json"

echo
echo "== Golden test docs =="
for f in tests/golden/first_user/*.md; do
  [[ -f "$f" ]] || fail "No golden tests found under tests/golden/first_user"
  echo " - $f"
done

echo
echo "== Project checks =="

if [[ -f "package.json" ]]; then
  if command -v npm >/dev/null 2>&1; then
    echo "Running npm checks..."
    npm ci
    npm run lint --if-present
    npm test --if-present
    npm run build --if-present
  else
    warn "npm not found; skipping JS checks"
  fi
fi

if [[ -f "Cargo.toml" ]] || find . -name Cargo.toml -maxdepth 4 | grep -q .; then
  if command -v cargo >/dev/null 2>&1; then
    echo "Running cargo checks..."
    # Run from each Cargo.toml directory to support nested Tauri projects.
    while IFS= read -r cargo_file; do
      cargo_dir="$(dirname "$cargo_file")"
      echo "Cargo project: $cargo_dir"
      (cd "$cargo_dir" && cargo fmt --check && cargo clippy -- -D warnings && cargo test)
    done < <(find . -name Cargo.toml -not -path "./target/*")
  else
    warn "cargo not found; skipping Rust checks"
  fi
fi

if find . -name pom.xml -maxdepth 5 | grep -q .; then
  if command -v mvn >/dev/null 2>&1; then
    echo "Running Maven checks..."
    while IFS= read -r pom; do
      pom_dir="$(dirname "$pom")"
      echo "Maven project: $pom_dir"
      (cd "$pom_dir" && mvn test)
    done < <(find . -name pom.xml -not -path "./target/*")
  else
    warn "mvn not found; skipping Java checks"
  fi
fi

if find . -name "pytest.ini" -o -name "pyproject.toml" -o -name "requirements.txt" | grep -q .; then
  if command -v pytest >/dev/null 2>&1; then
    echo "Running pytest..."
    pytest
  else
    warn "pytest not found; skipping Python checks"
  fi
fi

echo
echo "== Security checks =="
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --source . --no-git
else
  warn "gitleaks not found; install or run in CI"
fi

echo
echo "== Status bundle validation =="
if command -v python3 >/dev/null 2>&1; then
  python3 scripts/check-first-user-status-bundle.py configs/first-user/status_bundle.first_user.template.json || fail "Status bundle template failed validation"
else
  warn "python3 not found; skipping bundle validation"
fi

echo
echo "== Manual gates still required =="
echo "Review docs/first-user/MANUAL_SMOKE_TEST.md and docs/first-user/APPROVAL_CHECKLIST.md"
echo "Do not approve first-user release until P0 matrix rows are PASS with evidence."

pass "Gauntlet completed. This does not by itself approve release; it only runs available checks."
