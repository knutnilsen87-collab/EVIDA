from fastapi import APIRouter

from app.models import AiGatewayRequest, AiGatewayResponse
from app.services.ai_gateway import run_ai_gateway
from app.services.audit import audit

router = APIRouter(prefix="/v1/ai", tags=["ai-gateway"])


@router.post("/gateway", response_model=AiGatewayResponse)
def ai_gateway(payload: AiGatewayRequest) -> AiGatewayResponse:
    result = run_ai_gateway(payload)
    audit(
        actor="ai-gateway",
        tenant_id=payload.tenant_id,
        action="ai.gateway.request",
        target_type="tenant",
        target_id=payload.tenant_id,
        result="PASS" if result.allowed else "WARN",
        details={
            "purpose": payload.purpose,
            "source_count": len(payload.source_object_ids),
            "mode": result.mode,
            "allowed": result.allowed,
        },
    )
    return result
