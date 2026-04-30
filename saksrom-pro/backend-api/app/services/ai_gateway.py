from __future__ import annotations

from app.database import STORE
from app.models import AiGatewayRequest, AiGatewayResponse, AiMode


def get_active_policy(tenant_id: str):
    policies = [
        policy for policy in STORE.policies.values()
        if policy.tenant_id == tenant_id and policy.active
    ]
    if not policies:
        return None
    return sorted(policies, key=lambda item: item.version, reverse=True)[0]


def run_ai_gateway(request: AiGatewayRequest) -> AiGatewayResponse:
    policy = get_active_policy(request.tenant_id)
    if policy is None:
        return AiGatewayResponse(
            allowed=False,
            mode=AiMode.disabled,
            message="No active tenant policy. AI call blocked.",
        )

    if policy.ai.mode in {AiMode.disabled, AiMode.local_only}:
        return AiGatewayResponse(
            allowed=False,
            mode=policy.ai.mode,
            message=f"Tenant policy blocks hosted AI mode: {policy.ai.mode}",
            metadata={"policy_id": policy.id, "policy_version": policy.version},
        )

    # This scaffold intentionally does not call a provider by default.
    # Add provider code only after privacy and policy review.
    return AiGatewayResponse(
        allowed=True,
        mode=policy.ai.mode,
        message="Provider call would be allowed by policy. Stub response returned.",
        output=None,
        metadata={"policy_id": policy.id, "policy_version": policy.version},
    )
