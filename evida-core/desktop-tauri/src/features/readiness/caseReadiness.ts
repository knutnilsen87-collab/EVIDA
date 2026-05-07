export type CaseReadinessVerdict =
  | "not_ready"
  | "requires_control"
  | "ready_for_preliminary_analysis"
  | "ready_for_draft_control";

export type CaseReadinessSeverity = "critical" | "warning" | "success";

export type DocumentProcessingState =
  | "queued"
  | "running"
  | "waiting_for_background_worker"
  | "extracting_text"
  | "recognizing_text"
  | "creating_sources"
  | "checking_coverage"
  | "completed"
  | "completed_partial"
  | "failed";

export const DOCUMENT_PROCESSING_LABELS: Record<DocumentProcessingState, string> = {
  queued: "Venter på automatisk behandling",
  running: "Behandler automatisk",
  waiting_for_background_worker: "Venter på dokumentmotor",
  extracting_text: "Leser dokumentet",
  recognizing_text: "Henter tekst fra skannede sider",
  creating_sources: "Lager sporbare kilder",
  checking_coverage: "Kontrollerer dekning",
  completed: "Klar",
  completed_partial: "Delvis klar",
  failed: "Kunne ikke behandles automatisk"
};

export interface ReadinessInput {
  hasDocuments: boolean;
  totalDocuments: number;
  processedDocuments: number;
  totalPages: number;
  processedPages: number;
  pagesWithText: number;
  pagesWithSources: number;
  pagesMissingSources: number;
  sourceCount: number;
  failedDocuments: number;
  documentsRequiringAttention: number;
  importFailures: number;
  pendingTextRecognitionPages: number;
  hasActiveProcessing: boolean;
  criticalDocumentsFailed?: boolean;
  automaticTextRecognitionAvailable?: boolean;
  dbEncryptionVerified?: boolean;
}

export interface ReadinessResult {
  verdict: CaseReadinessVerdict;
  label: string;
  title: string;
  reason: string;
  allowedUse: string;
  blockedUse: string;
  primaryAction: string;
  severity: CaseReadinessSeverity;
  sourceCoveragePercent: number;
  testDataWarning?: string;
}

export interface CaseCoverageSummary {
  totalDocuments: number;
  processedDocuments: number;
  totalPages: number;
  processedPages: number;
  pagesWithText: number;
  pagesWithSources: number;
  pagesMissingSources: number;
  failedDocuments: number;
  documentsRequiringAttention: number;
  sourceCoveragePercent: number;
  estimatedRemainingSeconds?: number;
  currentlyProcessingLabel?: string;
  hasActiveProcessing: boolean;
}

export function calculateSourceCoveragePercent(input: {
  totalPages: number;
  pagesWithSources: number;
}): number {
  if (!input.totalPages || input.totalPages <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((input.pagesWithSources / input.totalPages) * 100))
  );
}

export function getCaseReadiness(input: ReadinessInput): ReadinessResult {
  const sourceCoveragePercent = calculateSourceCoveragePercent({
    totalPages: input.totalPages,
    pagesWithSources: input.pagesWithSources
  });

  const testDataWarning =
    input.dbEncryptionVerified === false
      ? "Kun testdata. Ikke godkjent for ekte klientdata."
      : undefined;

  if (!input.hasDocuments || input.totalDocuments <= 0) {
    return {
      verdict: "not_ready",
      label: "Ikke klar",
      title: "Importer dokumenter først",
      reason: "Ingen dokumenter er importert.",
      allowedUse: "Importer dokumenter før Saksrom brukes.",
      blockedUse: "Saksrom, analyse, utkast og rettssimulering.",
      primaryAction: "Importer dokumenter",
      severity: "critical",
      sourceCoveragePercent,
      testDataWarning
    };
  }

  if (
    input.sourceCount === 0 ||
    input.pagesWithSources === 0 ||
    sourceCoveragePercent < 50 ||
    input.failedDocuments >= input.totalDocuments
  ) {
    if (input.failedDocuments >= input.totalDocuments || input.importFailures >= input.totalDocuments) {
      return {
        verdict: "not_ready",
        label: "Dokumentene kunne ikke behandles automatisk",
        title: "Dokumentene kunne ikke behandles automatisk",
        reason: "Evida klarte ikke å gjøre dokumentene om til sporbare kilder.",
        allowedUse: "Se hvilke dokumenter som feilet automatisk behandling.",
        blockedUse: "Saksrom-oppsummering, utkast, rettssimulering og juridisk analyse.",
        primaryAction: "Se dokumenter som ikke kunne behandles",
        severity: "critical",
        sourceCoveragePercent,
        testDataWarning
      };
    }

    if (
      input.automaticTextRecognitionAvailable === false &&
      input.pendingTextRecognitionPages > 0 &&
      !input.hasActiveProcessing
    ) {
      return {
        verdict: "not_ready",
        label: "Saken klargjøres",
        title: "Automatisk teksthenting er ikke ferdig implementert",
        reason:
          "Denne versjonen kan registrere dokumentet, men kan ikke hente tekst automatisk fra skannede sider ennå. Saksrom-oppsummering blir tilgjengelig når automatisk teksthenting er på plass eller når dokumentet allerede inneholder lesbar tekst.",
        allowedUse: "Vis behandlingsstatus mens dokumentgrunnlaget klargjøres.",
        blockedUse: "Saksrom-oppsummering, utkast, rettssimulering og juridisk analyse.",
        primaryAction: "Vis behandlingsstatus",
        severity: "critical",
        sourceCoveragePercent,
        testDataWarning
      };
    }

    return {
      verdict: "not_ready",
      label: "Saken klargjøres",
      title: "Saken klargjøres",
      reason:
        "Evida leser dokumentene og lager sporbare kilder automatisk. Du trenger ikke gjøre noe nå. Saksrom-oppsummeringen vises når nok av dokumentgrunnlaget er klart.",
      allowedUse: "Vis behandlingsstatus mens dokumentgrunnlaget klargjøres.",
      blockedUse: "Saksrom-oppsummering, utkast, rettssimulering og juridisk analyse.",
      primaryAction: "Vis behandlingsstatus",
      severity: "critical",
      sourceCoveragePercent,
      testDataWarning
    };
  }

  if (
    sourceCoveragePercent < 80 ||
    input.pendingTextRecognitionPages > 0 ||
    input.documentsRequiringAttention > 0 ||
    input.importFailures > 0 ||
    input.failedDocuments > 0 ||
    input.hasActiveProcessing ||
    input.criticalDocumentsFailed === true
  ) {
    return {
      verdict: "requires_control",
      label: "Krever kontroll",
      title: "Grunnlaget krever kontroll",
      reason: "Deler av dokumentgrunnlaget er ikke ferdig behandlet.",
      allowedUse: "Kan brukes til foreløpig orientering med tydelig forbehold.",
      blockedUse:
        "Ikke bruk til utkast, konklusjon, simulert dom eller endelig vurdering.",
      primaryAction: "Se hva som mangler",
      severity: "warning",
      sourceCoveragePercent,
      testDataWarning
    };
  }

  if (sourceCoveragePercent >= 80 && sourceCoveragePercent < 95) {
    return {
      verdict: "ready_for_preliminary_analysis",
      label: "Klar for foreløpig analyse",
      title: "Klar for foreløpig analyse",
      reason: "De fleste sidene er gjort om til sporbare kilder.",
      allowedUse:
        "Kan brukes til Saksrom, kronologi, bevisoversikt og foreløpig analyse.",
      blockedUse: "Ikke bruk til endelig innsending uten kvalitetssikring.",
      primaryAction: "Åpne Saksrom",
      severity: "success",
      sourceCoveragePercent,
      testDataWarning
    };
  }

  return {
    verdict: "ready_for_draft_control",
    label: "Klar for utkastkontroll",
    title: "Klar for utkastkontroll",
    reason:
      "Dokumentgrunnlaget har høy dekning og ingen kjente behandlingsblokkere.",
    allowedUse: "Kan brukes til kontrollert utkastarbeid og kvalitetssjekk.",
    blockedUse: "Ingen AI-output kan brukes uten menneskelig juridisk kontroll.",
    primaryAction: "Start saksarbeid",
    severity: "success",
    sourceCoveragePercent,
    testDataWarning
  };
}
