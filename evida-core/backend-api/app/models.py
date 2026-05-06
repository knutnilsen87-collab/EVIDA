from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4()}"


class AiMode(str, Enum):
    disabled = "disabled"
    local_only = "local_only"
    openai_gateway = "openai_gateway"
    custom_gateway = "custom_gateway"


class TenantCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class Tenant(BaseModel):
    id: str
    name: str
    status: str = "active"
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: str
    display_name: str | None = None
    roles: list[str] = Field(default_factory=list)


class User(BaseModel):
    id: str
    tenant_id: str
    email: str
    display_name: str | None = None
    roles: list[str] = Field(default_factory=list)
    status: str = "active"
    created_at: datetime


class LicenseSeat(BaseModel):
    id: str
    tenant_id: str
    assigned_user_id: str | None = None
    status: str = "available"
    created_at: datetime


class DeviceActivationRequest(BaseModel):
    tenant_id: str
    user_id: str | None = None
    device_fingerprint_hash: str
    app_version: str
    os_name: str


class DeviceActivation(BaseModel):
    id: str
    tenant_id: str
    user_id: str | None = None
    device_fingerprint_hash: str
    app_version: str
    os_name: str
    status: str = "active"
    created_at: datetime


class AiProviderPolicy(BaseModel):
    mode: AiMode = AiMode.disabled
    provider_name: str | None = None
    allow_prompt_logging: bool = False
    require_user_confirmation: bool = True


class OrganizationPolicy(BaseModel):
    id: str
    tenant_id: str
    version: int
    name: str
    ai: AiProviderPolicy
    release_channel: str = "stable"
    diagnostics_upload_allowed: bool = False
    active: bool = True
    created_at: datetime


class PolicyCreate(BaseModel):
    name: str = "Default policy"
    ai: AiProviderPolicy = Field(default_factory=AiProviderPolicy)
    release_channel: str = "stable"
    diagnostics_upload_allowed: bool = False


class AuditEvent(BaseModel):
    id: str
    tenant_id: str | None = None
    actor: str
    action: str
    target_type: str
    target_id: str
    result: str = "PASS"
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class DiagnosticPayload(BaseModel):
    tenant_id: str
    device_id: str | None = None
    app_version: str
    os_name: str
    error_code: str | None = None
    redacted_log: str


class DiagnosticRecord(DiagnosticPayload):
    id: str
    created_at: datetime


class AiGatewayRequest(BaseModel):
    tenant_id: str
    purpose: str
    source_object_ids: list[str] = Field(default_factory=list)
    prompt: str


class AiGatewayResponse(BaseModel):
    allowed: bool
    mode: AiMode
    message: str
    output: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
