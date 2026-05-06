from __future__ import annotations

from dataclasses import dataclass


@dataclass
class EvalResult:
    name: str
    passed: bool
    details: str


def assert_no_unsupported_claims(unsupported_claims: list[str]) -> EvalResult:
    return EvalResult(
        name="unsupported_claims",
        passed=len(unsupported_claims) == 0,
        details=f"{len(unsupported_claims)} unsupported claims found",
    )
