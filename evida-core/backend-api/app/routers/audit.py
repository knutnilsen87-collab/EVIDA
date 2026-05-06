from fastapi import APIRouter

from app.database import STORE
from app.models import AuditEvent

router = APIRouter(prefix="/v1/audit", tags=["audit"])


@router.get("", response_model=list[AuditEvent])
def list_audit_events(tenant_id: str | None = None) -> list[AuditEvent]:
    events = STORE.audit_events
    if tenant_id:
        events = [event for event in events if event.tenant_id == tenant_id]
    return list(reversed(events[-500:]))
