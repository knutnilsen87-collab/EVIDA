from fastapi import APIRouter, HTTPException

from app.database import STORE
from app.models import DiagnosticPayload, DiagnosticRecord, new_id, now_utc
from app.services.audit import audit
from app.services.redaction import redact_text

router = APIRouter(prefix="/v1/diagnostics", tags=["diagnostics"])


@router.post("", response_model=DiagnosticRecord)
def submit_diagnostic(payload: DiagnosticPayload) -> DiagnosticRecord:
    if payload.tenant_id not in STORE.tenants:
        raise HTTPException(status_code=404, detail="Tenant not found")

    record = DiagnosticRecord(
        **payload.model_dump(exclude={"redacted_log"}),
        redacted_log=redact_text(payload.redacted_log),
        id=new_id("DIA"),
        created_at=now_utc(),
    )
    STORE.diagnostics[record.id] = record
    audit(
        actor="desktop-app",
        tenant_id=payload.tenant_id,
        action="diagnostic.submit",
        target_type="diagnostic",
        target_id=record.id,
        details={"app_version": record.app_version, "os_name": record.os_name},
    )
    return record
