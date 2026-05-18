import type {
  CasePreparationPhase,
  CasePreparationProgress,
  CasePreparationProgressInput,
  SaksromPreparationScope
} from "./casePreparation.types";

export function getChatPlaceholder(scope: SaksromPreparationScope, hasDocuments = true) {
  if (!hasDocuments || scope === "locked") {
    return "Saksrom åpnes når dokumentgrunnlaget er klart nok";
  }
  if (scope === "controlled_sources_only") {
    return "Spør Saksrom — svar bygger bare på kontrollerte kilder";
  }
  return "Spør Saksrom om saken, kildene eller neste steg";
}

export function deriveCasePreparationProgress(input: CasePreparationProgressInput): CasePreparationProgress {
  const totalDocuments = Math.max(0, input.totalDocuments);
  const hasDocuments = totalDocuments > 0;
  const isRunning =
    input.hasActiveProcessing ||
    input.importProgress?.state === "processing" ||
    Boolean(input.importProgress && input.importProgress.remainingDocuments > 0);
  const processedDocuments = Math.min(
    Math.max(input.processedDocuments, input.readyDocuments + input.reviewDocuments + input.unreadableDocuments),
    totalDocuments || input.processedDocuments
  );
  const sourceCoveragePercent = Math.max(0, Math.min(100, Math.round(input.sourceCoveragePercent || 0)));
  const progressPercent = isRunning
    ? Math.max(1, Math.min(99, input.importProgress?.progressPercent ?? percent(processedDocuments, totalDocuments)))
    : hasDocuments
      ? Math.max(percent(processedDocuments, totalDocuments), input.readyDocuments + input.reviewDocuments + input.unreadableDocuments > 0 ? 100 : 0)
      : 0;
  const saksromScope = deriveSaksromScope({
    hasDocuments,
    sourceObjects: input.sourceObjects,
    readyDocuments: input.readyDocuments,
    reviewDocuments: input.reviewDocuments,
    unreadableDocuments: input.unreadableDocuments,
    isRunning
  });
  const phase = derivePhase({
    hasDocuments,
    saksromScope,
    isRunning,
    reviewDocuments: input.reviewDocuments,
    unreadableDocuments: input.unreadableDocuments
  });

  return {
    phase,
    saksromScope,
    totalDocuments,
    processedDocuments,
    readyDocuments: input.readyDocuments,
    reviewDocuments: input.reviewDocuments,
    unreadableDocuments: input.unreadableDocuments,
    totalPages: input.totalPages,
    processedPages: Math.min(input.processedPages, input.totalPages || input.processedPages),
    pendingOcrPages: input.pendingOcrPages,
    sourceObjects: input.sourceObjects,
    sourceCoveragePercent,
    progressPercent,
    currentPhaseLabel: resolvePhaseLabel(phase, input.importProgress?.currentPhaseLabel),
    etaLabel: isRunning ? input.importProgress?.etaLabel || "ETA beregnes ..." : "Ferdig",
    nextBestAction: resolveNextBestAction(phase, input),
    chatPlaceholder: getChatPlaceholder(saksromScope, hasDocuments),
    isRunning
  };
}

function deriveSaksromScope(input: {
  hasDocuments: boolean;
  sourceObjects: number;
  readyDocuments: number;
  reviewDocuments: number;
  unreadableDocuments: number;
  isRunning: boolean;
}): SaksromPreparationScope {
  if (!input.hasDocuments || input.sourceObjects <= 0 || input.readyDocuments <= 0) {
    return "locked";
  }
  if (input.isRunning || input.reviewDocuments > 0 || input.unreadableDocuments > 0) {
    return "controlled_sources_only";
  }
  return "full_case_sources";
}

function derivePhase(input: {
  hasDocuments: boolean;
  saksromScope: SaksromPreparationScope;
  isRunning: boolean;
  reviewDocuments: number;
  unreadableDocuments: number;
}): CasePreparationPhase {
  if (!input.hasDocuments) {
    return "empty";
  }
  if (input.isRunning) {
    return "processing";
  }
  if (input.reviewDocuments > 0 || input.unreadableDocuments > 0) {
    return input.saksromScope === "locked" ? "needs_control" : "limited_ready";
  }
  return input.saksromScope === "full_case_sources" ? "ready" : "needs_control";
}

function resolvePhaseLabel(phase: CasePreparationPhase, runningLabel?: string) {
  if (phase === "processing" && runningLabel) {
    return runningLabel;
  }
  const labels: Record<CasePreparationPhase, string> = {
    empty: "Venter på dokumenter",
    processing: "Behandler dokumentgrunnlag",
    needs_control: "Kontroll kreves",
    limited_ready: "Klar med kontrollert delgrunnlag",
    ready: "Kildegrunnlag klart"
  };
  return labels[phase];
}

function resolveNextBestAction(phase: CasePreparationPhase, input: CasePreparationProgressInput) {
  if (input.nextActionTitle) {
    return input.nextActionTitle;
  }
  if (phase === "empty") {
    return "Importer dokumenter";
  }
  if (phase === "processing") {
    return "Vent til behandlingen er ferdig";
  }
  if (input.reviewDocuments > 0) {
    return "Kontroller dokumenter som trenger vurdering";
  }
  if (input.unreadableDocuments > 0) {
    return "Erstatt eller hold dokumenter utenfor";
  }
  if (input.pendingOcrPages > 0) {
    return "Gå til Saksrom foreløpig";
  }
  return "Spør Saksrom";
}

function percent(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}
