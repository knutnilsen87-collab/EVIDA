from app.database import STORE
from app.models import AiGatewayRequest, PolicyCreate, TenantCreate
from app.routers.policies import create_policy
from app.routers.tenants import create_tenant
from app.services.ai_gateway import run_ai_gateway


def test_ai_gateway_blocks_default_disabled_policy():
    STORE.tenants.clear()
    STORE.policies.clear()
    STORE.policy_versions.clear()

    tenant = create_tenant(TenantCreate(name="Test Tenant"))
    create_policy(tenant.id, PolicyCreate())

    result = run_ai_gateway(
        AiGatewayRequest(
            tenant_id=tenant.id,
            purpose="test",
            source_object_ids=[],
            prompt="Hei",
        )
    )

    assert result.allowed is False
