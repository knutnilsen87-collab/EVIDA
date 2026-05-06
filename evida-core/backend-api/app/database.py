from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any


@dataclass
class InMemoryStore:
    """MVP/dev store. Replace with PostgreSQL + migrations before production."""

    tenants: dict[str, Any] = field(default_factory=dict)
    users: dict[str, Any] = field(default_factory=dict)
    licenses: dict[str, Any] = field(default_factory=dict)
    devices: dict[str, Any] = field(default_factory=dict)
    policies: dict[str, Any] = field(default_factory=dict)
    diagnostics: dict[str, Any] = field(default_factory=dict)
    audit_events: list[Any] = field(default_factory=list)
    policy_versions: dict[str, int] = field(default_factory=lambda: defaultdict(int))


STORE = InMemoryStore()
