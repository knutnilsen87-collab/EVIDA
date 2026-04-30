from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ProviderPolicy:
    allow_cloud: bool
    model: str = "gpt-4.1-mini"


def generate_with_openai(*, prompt: str, policy: ProviderPolicy) -> str:
    """Optional provider adapter. Requires `pip install -e .[openai]` and OPENAI_API_KEY."""
    if not policy.allow_cloud:
        raise PermissionError("Tenant/user policy disallows cloud AI provider call.")

    try:
        from openai import OpenAI
    except ImportError as exc:
        raise RuntimeError("OpenAI package is not installed. Install with .[openai].") from exc

    client = OpenAI()
    response = client.responses.create(
        model=policy.model,
        input=prompt,
    )
    return response.output_text
