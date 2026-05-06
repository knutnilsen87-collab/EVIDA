from __future__ import annotations

from saksrom_ai.models import ControlReport, Contradiction, RiskItem


def risks_from_contradictions(contradictions: list[Contradiction]) -> list[RiskItem]:
    risks: list[RiskItem] = []
    for contradiction in contradictions:
        risks.append(
            RiskItem(
                title=f"Uavklart motstrid: {contradiction.topic}",
                severity="medium",
                likelihood="medium",
                description=contradiction.description,
                recommended_action="Avklar motstriden, knytt den til anførsel eller marker som løst.",
                citations=contradiction.citations,
            )
        )
    return risks


def build_control_report(
    *,
    case_id: str,
    document_coverage_percent: float,
    source_coverage_percent: float,
    unsupported_claims: list[str],
    weak_sources: list[str],
    contradictions: list[str],
) -> ControlReport:
    blocking = bool(unsupported_claims) or document_coverage_percent < 95
    return ControlReport(
        case_id=case_id,
        document_coverage_percent=document_coverage_percent,
        source_coverage_percent=source_coverage_percent,
        unsupported_claims=unsupported_claims,
        weak_sources=weak_sources,
        contradictions=contradictions,
        blocking=blocking,
        details={
            "rule": "Blocks if unsupported claims exist or document coverage is below 95 percent."
        },
    )
