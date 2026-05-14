#!/usr/bin/env python3
import json
import sys
from pathlib import Path

REQUIRED_TOP = [
    "bundle_id",
    "bundle_version",
    "release_candidate_id",
    "commit_sha",
    "current_state",
    "scope_lock",
    "invariant_layer",
    "verification_layer",
    "closure_layer",
]

def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)

def main() -> None:
    if len(sys.argv) != 2:
        fail("Usage: check-first-user-status-bundle.py <bundle.json>")

    path = Path(sys.argv[1])
    if not path.exists():
        fail(f"Bundle not found: {path}")

    data = json.loads(path.read_text(encoding="utf-8"))

    for key in REQUIRED_TOP:
        if key not in data:
            fail(f"Missing required key: {key}")

    current = data["current_state"]
    verification = data["verification_layer"]
    invariants = data["invariant_layer"]
    closure = data["closure_layer"]

    if current.get("first_user_allowed") is True:
        if current.get("status") != "pass":
            fail("first_user_allowed=true requires current_state.status=pass")
        if verification.get("p0_status") != "pass":
            fail("first_user_allowed=true requires verification_layer.p0_status=pass")
        if verification.get("document_upload_status") != "pass":
            fail("first_user_allowed=true requires document_upload_status=pass")
        if verification.get("ai_source_control_status") != "pass":
            fail("first_user_allowed=true requires ai_source_control_status=pass")
        if verification.get("audit_status") != "pass":
            fail("first_user_allowed=true requires audit_status=pass")
        if invariants.get("broken_invariants"):
            fail("first_user_allowed=true requires zero broken invariants")
        if invariants.get("untested_invariants"):
            fail("first_user_allowed=true requires zero untested invariants")
        if closure.get("closure_decision") != "approved_for_controlled_first_user":
            fail("first_user_allowed=true requires approved_for_controlled_first_user")
        if closure.get("approved_by_review") is not True:
            fail("first_user_allowed=true requires approved_by_review=true")

    print("OK: first-user status bundle structure is valid")

if __name__ == "__main__":
    main()
