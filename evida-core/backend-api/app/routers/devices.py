from fastapi import APIRouter, HTTPException

from app.database import STORE
from app.models import DeviceActivation, DeviceActivationRequest, new_id, now_utc
from app.services.audit import audit

router = APIRouter(prefix="/v1/devices", tags=["devices"])


@router.post("/activate", response_model=DeviceActivation)
def activate_device(payload: DeviceActivationRequest) -> DeviceActivation:
    if payload.tenant_id not in STORE.tenants:
        raise HTTPException(status_code=404, detail="Tenant not found")

    device = DeviceActivation(
        id=new_id("DEV"),
        tenant_id=payload.tenant_id,
        user_id=payload.user_id,
        device_fingerprint_hash=payload.device_fingerprint_hash,
        app_version=payload.app_version,
        os_name=payload.os_name,
        created_at=now_utc(),
    )
    STORE.devices[device.id] = device
    audit(
        actor=payload.user_id or "unknown-user",
        tenant_id=payload.tenant_id,
        action="device.activate",
        target_type="device",
        target_id=device.id,
        details={"app_version": device.app_version, "os_name": device.os_name},
    )
    return device
