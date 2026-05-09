import type { ReadinessInput, ReadinessResult } from "../types/readiness";

export function getCaseReadiness(input: ReadinessInput): ReadinessResult {
  if (!input.hasDocuments) {
    return {
      verdict: "not_ready",
      label: "Ikke klar",
      reason: "Ingen dokumenter er importert.",
      allowedUse: "Legg til dokumenter for å starte.",
      blockedUse: "Saksoppsummering, juridisk analyse, utkast og rettssimulering.",
      primaryAction: "Legg til dokumenter",
      severity: "critical"
    };
  }

  if (!input.hasSources || input.sourceCount === 0 || input.sourceCoveragePercent < 50) {
    const stillWorking = input.hasActiveProcessing;

    return {
      verdict: "not_ready",
      label: stillWorking ? "Saken klargjøres" : "Ikke klar for analyse",
      reason: stillWorking
        ? "Evida leser dokumentene og lager sporbare kilder automatisk."
        : "Dokumentene er ikke gjort om til nok sporbare kilder ennå.",
      allowedUse: stillWorking
        ? "Følg behandlingsstatus mens Evida jobber."
        : "Følg behandlingsstatus og vent til flere sider er klare.",
      blockedUse: "Saksoppsummering, juridisk analyse, utkast og rettssimulering.",
      primaryAction: "Vis behandlingsstatus",
      severity: "critical"
    };
  }

  if (
    input.sourceCoveragePercent < 80 ||
    input.pendingOcrPages > 0 ||
    input.documentsRequiringAttention > 0 ||
    input.importFailures > 0 ||
    input.hasActiveProcessing
  ) {
    return {
      verdict: "requires_control",
      label: "Krever kontroll",
      reason: "Deler av dokumentgrunnlaget er ikke ferdig behandlet.",
      allowedUse: "Kan brukes til foreløpig orientering med tydelig forbehold.",
      blockedUse: "Ikke bruk til utkast, konklusjon, simulert dom eller endelig vurdering.",
      primaryAction: "Se hva som mangler",
      severity: "warning"
    };
  }

  if (input.sourceCoveragePercent >= 80 && input.sourceCoveragePercent < 95) {
    return {
      verdict: "ready_for_preliminary_analysis",
      label: "Klar for foreløpig analyse",
      reason: "De fleste sidene er gjort om til sporbare kilder.",
      allowedUse: "Kan brukes til Saksrom, kronologi, bevisoversikt og foreløpig analyse.",
      blockedUse: "Ikke bruk til endelig innsending uten kvalitetssikring.",
      primaryAction: "Åpne Saksrom",
      severity: "success"
    };
  }

  return {
    verdict: "ready_for_draft_control",
    label: "Klar for utkastkontroll",
    reason: "Dokumentgrunnlaget har høy dekning og ingen kjente behandlingsblokkere.",
    allowedUse: "Kan brukes til kontrollert utkastarbeid og kvalitetssjekk.",
    blockedUse: "Ingen AI-output kan brukes uten menneskelig juridisk kontroll.",
    primaryAction: "Start saksarbeid",
    severity: "success"
  };
}

