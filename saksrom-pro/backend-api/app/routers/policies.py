from fastapi import APIRouter, HTTPException

from app.database import STORE
from app.models import OrganizationPolicy, PolicyCreate, new_id, now_utc
from app.services.audit import audit

router = APIRouter(prefix="/v1/tenants/{tenant_id}/policies", tags=["policies"])


@router.post("", response_model=OrganizationPolicy)
def create_policy(tenant_id: str, payload: PolicyCreate) -> OrganizationPolicy:
    if tenant_id not in STORE.tenants:
        raise HTTPException(status_code=404, detail="Tenant not found")

    STORE.policy_versions[tenant_id] += 1

    for existing in STORE.policies.values():
        if existing.tenant_id == tenant_id:
            existing.active = False

    policy = OrganizationPolicy(
        id=new_id("POL"),
        tenant_id=tenant_id,
        version=STORE.policy_versions[tenant_id],
        name=payload.name,
        ai=payload.ai,
        release_channel=payload.release_channel,
        diagnostics_upload_allowed=payload.diagnostics_upload_allowed,
        active=True,
        created_at=now_utc(),
    )
    STORE.policies[policy.id] = policy
    audit(
        actor="tenant-admin",
        tenant_id=tenant_id,
        action="policy.create",
        target_type="policy",
        target_id=policy.id,
        details={"version": policy.version, "ai_mode": policy.ai.mode},
    )
    return policy


@router.get("/active", response_model=OrganizationPolicy)
def get_active_policy(tenant_id: str) -> OrganizationPolicy:
    policies = [
        policy for policy in STORE.policies.values()
        if policy.tenant_id == tenant_id and policy.active
    ]
    if not policies:
        raise HTTPException(status_code=404, detail="No active policy")
    return sorted(policies, key=lambda item: item.version, reverse=True)[0]


@router.get("", response_model=list[OrganizationPolicy])
def list_policies(tenant_id: str) -> list[OrganizationPolicy]:
    return [
        policy for policy in STORE.policies.values()
        if policy.tenant_id == tenant_id
    ]
