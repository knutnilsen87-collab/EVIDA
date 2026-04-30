from __future__ import annotations

from typing import Any

from app.database import STORE
from app.models import AuditEvent, new_id, now_utc


def audit(
    *,
    actor: str,
    action: str,
    target_type: str,
    target_id: str,
    tenant_id: str | None = None,
    result: str = "PASS",
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        id=new_id("AUD"),
        tenant_id=tenant_id,
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        result=result,
        details=details or {},
        created_at=now_utc(),
    )
    STORE.audit_events.append(event)
    return event
