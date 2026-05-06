from fastapi import APIRouter, HTTPException

from app.database import STORE
from app.models import Tenant, TenantCreate, new_id, now_utc
from app.services.audit import audit

router = APIRouter(prefix="/v1/tenants", tags=["tenants"])


@router.post("", response_model=Tenant)
def create_tenant(payload: TenantCreate) -> Tenant:
    tenant = Tenant(
        id=new_id("TEN"),
        name=payload.name,
        created_at=now_utc(),
        updated_at=now_utc(),
    )
    STORE.tenants[tenant.id] = tenant
    audit(actor="system", action="tenant.create", target_type="tenant", target_id=tenant.id)
    return tenant


@router.get("", response_model=list[Tenant])
def list_tenants() -> list[Tenant]:
    return list(STORE.tenants.values())


@router.get("/{tenant_id}", response_model=Tenant)
def get_tenant(tenant_id: str) -> Tenant:
    tenant = STORE.tenants.get(tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant
