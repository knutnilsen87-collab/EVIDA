import type { DocumentSummary, ImportHealthSummary, ImportItem } from "../../types";
import type { DocumentBasisRow, DocumentBasisSummary } from "./documentBasis";

export type FirstUserPrimaryActionLabel =
  | "Se dokumenter som trenger kontroll"
  | "Start kontroll"
  | "Åpne foreløpig Saksrom"
  | "Åpne Saksrom"
  | "Se dokumenter som ikke ble brukt";

export type FirstUserPrimaryActionTarget = "review" | "preliminary_case_room" | "case_room" | "unused";

export type NextActionId =
  | "wait_for_import"
  | "review_import_failure"
  | "control_documents"
  | "run_ocr"
  | "open_saksrom_limited"
  | "open_saksrom_ready"
  | "review_risk"
  | "none";

export interface NextActionDecision {
  id: NextActionId;
  severity: "info" | "success" | "warning" | "danger";
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel?: string;
  targetView: "documents" | "documentControl" | "caseRoom" | "control" | "none";
  blocksSaksrom: boolean;
  saksromScope: "none" | "controlled_sources_only" | "full_case_sources";
}

export interface ImportOutcome {
  totalSelected: number;
  processed: number;
  readyForSaksrom: number;
  manualReviewRequired: number;
  ocrRequired: number;
  failed: number;
  notUsedAsSource: number;
  sourceObjectsCreated: number;
  pagesTotal: number;
  pagesAnalyzed: number;
  pagesWaitingForText: number;
  isRunning: boolean;
  sourceCoveragePercent: number;
  saksromScope: "none" | "controlled_sources_only" | "full_case_sources";
}

export interface ImportOutcomeViewModel {
  title: string;
  severity: "success" | "warning" | "danger" | "info";
  primaryLine: string;
  secondaryLine: string;
  detailLines: string[];
  primaryCta: string;
  secondaryCta: string;
  showProgressPercent: boolean;
  showEta: boolean;
}

export interface ImportUxQueueItem {
  status: string;
  startedAt?: number;
  pagesProcessed?: number;
  pagesTotal?: number;
  pages?: number;
  sources?: number;
}

export interface ControlNextStepInput {
  hasDocuments: boolean;
  needsReviewCount: number;
  notUsedCount: number;
  readyCount: number;
  totalCount: number;
  hasActiveProcessing: boolean;
  canOpenPreliminary: boolean;
  canOpenFinal: boolean;
}

export interface FirstUserPrimaryAction {
  label: FirstUserPrimaryActionLabel;
  target: FirstUserPrimaryActionTarget;
}

export interface ControlNextStep {
  title: string;
  message: string;
  primaryAction: FirstUserPrimaryAction;
  isPreliminary: boolean;
}

function countImportItems(items: ImportItem[], statuses: string[]) {
  return items.filter((item) => statuses.includes(item.status)).length;
}

export function deriveImportOutcome(args: {
  documents: DocumentSummary[];
  importItems: ImportItem[];
  documentBasis: Pick<DocumentBasisSummary, "readyCount" | "totalCount" | "sourceCoveragePercent" | "needsReviewDocuments" | "unreadableDocuments">;
  importHealth?: ImportHealthSummary | null;
  importQueue?: ImportUxQueueItem[];
  hasActiveProcessing: boolean;
  visibleReviewCount?: number;
  sourcesCreated: number;
  totalPages: number;
  analyzedPages: number;
  pendingOcrPages: number;
}): ImportOutcome {
  const session = args.importHealth?.latest_session;
  const queueTotal = args.importQueue?.length ?? 0;
  const totalSelected = Math.max(
    session?.total_files_seen ?? 0,
    args.importItems.length,
    queueTotal,
    args.documentBasis.totalCount,
    args.documents.length
  );
  const queueProcessed = args.importQueue?.filter((item) => isImportTerminalStatus(item.status)).length ?? 0;
  const processed = Math.max(
    session
      ? session.files_ready +
          session.files_partial +
          session.files_requires_ocr +
          session.files_duplicate +
          session.files_unsupported +
          session.files_failed
      : 0,
    args.importItems.filter((item) => isImportTerminalStatus(item.status)).length,
    queueProcessed,
    args.documentBasis.readyCount + args.documentBasis.needsReviewDocuments.length + args.documentBasis.unreadableDocuments.length
  );
  const ocrRequired = Math.max(session?.files_requires_ocr ?? 0, countImportItems(args.importItems, ["ocr_required", "ocr_running"]));
  const failed = Math.max(session?.files_failed ?? 0, countImportItems(args.importItems, ["failed", "unsupported"]));
  const notUsedAsSource = Math.max(
    session ? session.files_duplicate + session.files_unsupported + session.files_failed : 0,
    args.documentBasis.unreadableDocuments.length
  );
  const manualReviewRequired = args.visibleReviewCount ?? args.documentBasis.needsReviewDocuments.length;
  const readyForSaksrom = args.documentBasis.readyCount;
  const pagesTotal = Math.max(session?.pages_total ?? 0, args.totalPages, args.documents.reduce((sum, document) => sum + document.page_count, 0));
  const pagesAnalyzed = Math.max(session?.pages_with_text ?? 0, args.analyzedPages);
  const pagesWaitingForText = Math.max(session?.pages_requires_ocr ?? 0, args.pendingOcrPages);
  const sourceObjectsCreated = Math.max(session?.source_objects_created ?? 0, args.sourcesCreated);
  const hasNonTerminalQueueItems = Boolean(args.importQueue?.some((item) => !isImportTerminalStatus(item.status)));
  const allSelectedDocumentsTerminal = totalSelected > 0 && processed >= totalSelected && !hasNonTerminalQueueItems;
  const isRunning =
    !allSelectedDocumentsTerminal &&
    (args.hasActiveProcessing ||
      hasNonTerminalQueueItems ||
      Boolean(args.importHealth?.overall_status === "processing"));
  const sourceCoveragePercent =
    args.documentBasis.sourceCoveragePercent ||
    args.importHealth?.source_coverage_percent ||
    session?.source_coverage_percent ||
    0;
  const saksromScope =
    sourceObjectsCreated <= 0
      ? "none"
      : manualReviewRequired > 0 || failed > 0 || notUsedAsSource > 0
        ? "controlled_sources_only"
        : "full_case_sources";

  return {
    totalSelected,
    processed: Math.min(Math.max(processed, readyForSaksrom), totalSelected || processed),
    readyForSaksrom,
    manualReviewRequired,
    ocrRequired,
    failed,
    notUsedAsSource,
    sourceObjectsCreated,
    pagesTotal,
    pagesAnalyzed,
    pagesWaitingForText,
    isRunning,
    sourceCoveragePercent,
    saksromScope
  };
}

export function deriveNextAction(outcome: ImportOutcome): NextActionDecision {
  const totalControlCount = Math.max(
    outcome.manualReviewRequired + outcome.notUsedAsSource,
    outcome.ocrRequired + outcome.failed,
    outcome.manualReviewRequired
  );
  if (outcome.isRunning) {
    return {
      id: "wait_for_import",
      severity: "info",
      title: "Import pågår",
      description: "Evida behandler fortsatt dokumentene. Vent til importen er ferdig før du kontrollerer kildegrunnlaget.",
      primaryLabel: "Vis importstatus",
      targetView: "documents",
      blocksSaksrom: true,
      saksromScope: "none"
    };
  }
  if (outcome.failed > 0 && outcome.sourceObjectsCreated === 0) {
    return {
      id: "review_import_failure",
      severity: "danger",
      title: "Import krever handling",
      description: `${outcome.failed} dokument${outcome.failed === 1 ? "" : "er"} ble ikke brukt som kildegrunnlag. Se importdetaljer og erstatt filene som trengs.`,
      primaryLabel: "Vis importdetaljer",
      targetView: "control",
      blocksSaksrom: true,
      saksromScope: "none"
    };
  }
  if (outcome.manualReviewRequired > 0) {
    return {
      id: "control_documents",
      severity: "warning",
      title: "Kontroller dokumenter",
      description: `${totalControlCount} dokument${totalControlCount === 1 ? "" : "er"} trenger kontroll eller importavklaring før hele saken kan brukes i Saksrom.`,
      primaryLabel: `Kontroller ${totalControlCount} dokument${totalControlCount === 1 ? "" : "er"}`,
      secondaryLabel: "Vis importdetaljer",
      targetView: "documentControl",
      blocksSaksrom: false,
      saksromScope: "controlled_sources_only"
    };
  }
  if (outcome.ocrRequired > 0) {
    return {
      id: "open_saksrom_limited",
      severity: "warning",
      title: "Saksrom er klart foreløpig",
      description: `Dokumentkontrollen er fullført, men ${outcome.pagesWaitingForText} ${outcome.pagesWaitingForText === 1 ? "side mangler" : "sider mangler"} tekst/OCR. Saksrom kan brukes med ${Math.round(outcome.sourceCoveragePercent)} % kildedekning.`,
      primaryLabel: "Gå til Saksrom foreløpig",
      secondaryLabel: "Kjør OCR for full dekning",
      targetView: "caseRoom",
      blocksSaksrom: false,
      saksromScope: "controlled_sources_only"
    };
  }
  if (outcome.saksromScope === "controlled_sources_only") {
    return {
      id: "open_saksrom_limited",
      severity: "warning",
      title: "Saksrom kan brukes med begrenset grunnlag",
      description: "Saksrom svarer kun fra dokumentene som allerede er kontrollert.",
      primaryLabel: "Åpne Saksrom",
      secondaryLabel: "Kontroller resten først",
      targetView: "caseRoom",
      blocksSaksrom: false,
      saksromScope: "controlled_sources_only"
    };
  }
  if (outcome.readyForSaksrom > 0) {
    return {
      id: "open_saksrom_ready",
      severity: "success",
      title: "Saken er klar for Saksrom",
      description: "Alle dokumenter som skal brukes er kontrollert som kildegrunnlag.",
      primaryLabel: "Åpne Saksrom",
      targetView: "caseRoom",
      blocksSaksrom: false,
      saksromScope: "full_case_sources"
    };
  }
  return {
    id: "none",
    severity: "info",
    title: "Importer dokumenter",
    description: "Start med å importere dokumentene som skal danne kildegrunnlag.",
    primaryLabel: "Importer dokumenter",
    targetView: "documents",
    blocksSaksrom: true,
    saksromScope: "none"
  };
}

export function deriveImportOutcomeViewModel(outcome: ImportOutcome, nextAction: NextActionDecision): ImportOutcomeViewModel {
  const title =
    outcome.isRunning
      ? "Import pågår"
      : nextAction.id === "open_saksrom_ready"
        ? "Import fullført"
        : "Import fullført — kontroll kreves";
  const primaryLine =
    outcome.isRunning
      ? `${outcome.processed} av ${outcome.totalSelected} dokumenter behandlet`
      : `${outcome.processed} av ${outcome.totalSelected} dokumenter behandlet`;
  const secondaryLine =
    outcome.manualReviewRequired > 0
      ? `${outcome.manualReviewRequired} dokument${outcome.manualReviewRequired === 1 ? "" : "er"} trenger manuell kontroll før hele saken kan brukes.`
      : outcome.notUsedAsSource > 0
        ? `${outcome.notUsedAsSource} dokument${outcome.notUsedAsSource === 1 ? "" : "er"} ble ikke brukt som kildegrunnlag.`
        : "Kildegrunnlaget er klart.";
  return {
    title,
    severity: nextAction.severity,
    primaryLine,
    secondaryLine,
    detailLines: [
      `${outcome.readyForSaksrom} dokumenter klare for Saksrom`,
      `${outcome.sourceObjectsCreated} kildeutdrag opprettet`,
      `${outcome.pagesAnalyzed} av ${outcome.pagesTotal} sider analysert`,
      `${Math.round(outcome.sourceCoveragePercent)} % kildedekning`
    ],
    primaryCta: nextAction.primaryLabel,
    secondaryCta: nextAction.secondaryLabel || "Vis importdetaljer",
    showProgressPercent: outcome.isRunning,
    showEta: outcome.isRunning
  };
}

const TERMINAL_IMPORT_STATUSES = new Set([
  "completed",
  "ready",
  "needs_attention",
  "partial",
  "duplicate",
  "skipped",
  "unsupported",
  "unsupported_file_type",
  "ocr_required",
  "cancelled",
  "failed",
  "security_blocked",
  "manual_review_required",
  "manually_approved",
  "rejected"
]);

export function isImportTerminalStatus(status: string) {
  return TERMINAL_IMPORT_STATUSES.has(status);
}

export type ImportProgressPhase =
  | "selected"
  | "validating"
  | "hashing"
  | "importing"
  | "extracting"
  | "ocr"
  | "chunking"
  | "indexing"
  | "finalizing"
  | "complete"
  | "needs_attention"
  | "failed";

export type ImportProgressState = "processing" | "complete" | "complete_with_attention" | "complete_with_errors";

export interface ImportProgressSummaryData {
  title: string;
  state: ImportProgressState;
  totalDocuments: number;
  terminalDocuments: number;
  processingDocuments: number;
  remainingDocuments: number;
  failedDocuments: number;
  attentionDocuments: number;
  skippedDocuments: number;
  importedDocuments: number;
  processedDocuments: number;
  currentPhase: ImportProgressPhase;
  currentPhaseLabel: string;
  progressPercent: number;
  etaSeconds: number | null;
  etaLabel: string;
  primaryLine: string;
  secondaryLine: string;
  totalPagesEstimate: number;
  processedPages: number;
  sourcesCreated: number;
}

const PHASE_WEIGHTS: Record<ImportProgressPhase, number> = {
  selected: 0.02,
  validating: 0.08,
  hashing: 0.15,
  importing: 0.25,
  extracting: 0.45,
  ocr: 0.65,
  chunking: 0.8,
  indexing: 0.92,
  finalizing: 0.98,
  complete: 1,
  needs_attention: 1,
  failed: 1
};

export const IMPORT_PHASE_LABELS: Record<ImportProgressPhase, string> = {
  selected: "Dokumenter valgt",
  validating: "Validerer filtype og størrelse",
  hashing: "Sikrer hash og sjekker duplikater",
  importing: "Importerer dokumenter",
  extracting: "Leser tekst og bygger kildegrunnlag",
  ocr: "OCR og bygging av kildegrunnlag",
  chunking: "Deler tekst i kildeutdrag",
  indexing: "Indekserer kildeutdrag",
  finalizing: "Fullfører kildekontroll",
  complete: "Ferdig",
  needs_attention: "Ferdig - kontroll kreves",
  failed: "Feil under import"
};

const ATTENTION_STATUSES = new Set([
  "needs_attention",
  "partial",
  "ocr_required",
  "unsupported",
  "unsupported_file_type",
  "duplicate",
  "manual_review_required",
  "security_blocked"
]);

const FAILED_STATUSES = new Set(["failed", "security_blocked"]);
const SKIPPED_STATUSES = new Set(["skipped", "duplicate", "cancelled", "unsupported", "unsupported_file_type"]);

export function normalizeImportPhase(status: string | undefined): ImportProgressPhase {
  switch (status) {
    case "selected":
    case "queued":
      return "selected";
    case "validating":
    case "reading_file":
    case "type_detecting":
    case "safety_pending":
      return "validating";
    case "hashing":
    case "counting_pages":
      return "hashing";
    case "importing":
    case "stored":
      return "importing";
    case "extracting":
    case "extracting_text":
      return "extracting";
    case "ocr":
    case "ocr_running":
      return "ocr";
    case "chunking":
    case "finding_source_points":
      return "chunking";
    case "indexing":
    case "indexed":
      return "indexing";
    case "finalizing":
    case "building_case_basis":
    case "checking_coverage":
      return "finalizing";
    case "ready":
    case "completed":
    case "manually_approved":
      return "complete";
    case "failed":
    case "security_blocked":
      return "failed";
    case "needs_attention":
    case "partial":
    case "ocr_required":
    case "unsupported":
    case "unsupported_file_type":
    case "duplicate":
    case "manual_review_required":
      return "needs_attention";
    default:
      return "selected";
  }
}

export function getReviewDocuments(documentBasis: Pick<DocumentBasisSummary, "needsReviewDocuments">) {
  return documentBasis.needsReviewDocuments;
}

export function canApproveSourceAfterPreview(hasConfirmedPreview: boolean) {
  return hasConfirmedPreview;
}

export function getAiReadyDocumentIds(rows: Pick<DocumentBasisRow, "id" | "canUseInAnswer">[]) {
  return new Set(rows.filter((row) => row.canUseInAnswer).map((row) => row.id));
}

export function deriveImportProgressLabel(items: ImportUxQueueItem[], totalFallback = items.length) {
  const total = Math.max(totalFallback, items.length);
  const processed = items.filter((item) => isImportTerminalStatus(item.status)).length;
  return `${processed} av ${total} dokumenter behandlet`;
}

export function deriveImportEtaLabel(items: ImportUxQueueItem[], nowMs: number) {
  return summarizeImportProgress({ items, nowMs }).etaLabel;
}

export function deriveControlNextStep(input: ControlNextStepInput): ControlNextStep {
  if (!input.hasDocuments) {
    return {
      title: "Neste steg",
      message: "Importer dokumentene i saken før kontrollgrunnlaget kan vurderes.",
      primaryAction: { label: "Se dokumenter som trenger kontroll", target: "review" },
      isPreliminary: false
    };
  }

  if (input.needsReviewCount > 0) {
    return {
      title: "Neste steg",
      message: "Kontroller dokumentene som trenger manuell vurdering før de kan brukes som kildegrunnlag.",
      primaryAction: { label: "Start kontroll", target: "review" },
      isPreliminary: true
    };
  }

  if (input.canOpenFinal && input.readyCount === input.totalCount && input.totalCount > 0) {
    return {
      title: "Neste steg",
      message: "Dokumentgrunnlaget er klart. Du kan åpne Saksrom og starte saksarbeidet.",
      primaryAction: { label: "Åpne Saksrom", target: "case_room" },
      isPreliminary: false
    };
  }

  if (input.readyCount > 0 || input.canOpenPreliminary || input.hasActiveProcessing) {
    return {
      title: "Neste steg",
      message: "Noe av saksgrunnlaget kan brukes, men saken er ikke komplett ennå.",
      primaryAction: { label: "Åpne foreløpig Saksrom", target: "preliminary_case_room" },
      isPreliminary: true
    };
  }

  return {
    title: "Neste steg",
    message: "Ingen dokumenter er klare som kildegrunnlag. Se dokumentene som ikke ble brukt.",
    primaryAction: { label: "Se dokumenter som ikke ble brukt", target: "unused" },
    isPreliminary: false
  };
}

export function deriveImportUxSummary(args: {
  queue: ImportUxQueueItem[];
  nowMs: number;
  documentBasis: Pick<DocumentBasisSummary, "needsReviewDocuments" | "unreadableDocuments" | "readyCount" | "totalCount">;
  hasDocuments: boolean;
  hasActiveProcessing: boolean;
  canOpenPreliminary: boolean;
  canOpenFinal: boolean;
  totalDocuments?: number;
}) {
  const progress = summarizeImportProgress({
    items: args.queue,
    nowMs: args.nowMs,
    totalDocuments: args.totalDocuments,
    attentionDocumentsFallback: args.documentBasis.needsReviewDocuments.length,
    failedDocumentsFallback: args.documentBasis.unreadableDocuments.length
  });
  const hasActiveProcessing = progress.state === "processing" && (progress.remainingDocuments > 0 || progress.processingDocuments > 0);
  const controlStep = deriveControlNextStep({
    hasDocuments: args.hasDocuments,
    needsReviewCount: args.documentBasis.needsReviewDocuments.length,
    notUsedCount: args.documentBasis.unreadableDocuments.length,
    readyCount: args.documentBasis.readyCount,
    totalCount: args.documentBasis.totalCount,
    hasActiveProcessing,
    canOpenPreliminary: args.canOpenPreliminary,
    canOpenFinal: args.canOpenFinal
  });

  return {
    progressLabel: progress.primaryLine,
    etaLabel: progress.etaLabel,
    progress,
    gapMessages: deriveImportGapMessages({
      needsReviewCount: args.documentBasis.needsReviewDocuments.length,
      notUsedCount: args.documentBasis.unreadableDocuments.length,
      hasActiveProcessing
    }),
    nextStep: controlStep
  };
}

export function summarizeImportProgress(args: {
  items: ImportUxQueueItem[];
  nowMs: number;
  totalDocuments?: number;
  importStartedAt?: number | null;
  totalPagesEstimate?: number;
  processedPages?: number;
  sourcesCreated?: number;
  attentionDocumentsFallback?: number;
  failedDocumentsFallback?: number;
}) {
  const totalDocuments = Math.max(args.totalDocuments ?? 0, args.items.length);
  const terminalDocuments = args.items.filter((item) => isImportTerminalStatus(item.status)).length;
  const processingDocuments = Math.max(0, args.items.filter((item) => !isImportTerminalStatus(item.status)).length);
  const remainingDocuments = Math.max(0, totalDocuments - terminalDocuments);
  const hasItemStatusCounts = args.items.length > 0;
  const failedDocuments = hasItemStatusCounts
    ? args.items.filter((item) => FAILED_STATUSES.has(item.status)).length
    : (args.failedDocumentsFallback ?? 0);
  const attentionDocuments = hasItemStatusCounts
    ? args.items.filter((item) => ATTENTION_STATUSES.has(item.status)).length
    : (args.attentionDocumentsFallback ?? 0);
  const skippedDocuments = args.items.filter((item) => SKIPPED_STATUSES.has(item.status)).length;
  const hasNonTerminal = processingDocuments > 0 || remainingDocuments > 0;
  const allTerminal = totalDocuments > 0 && !hasNonTerminal;
  const state: ImportProgressState = hasNonTerminal
    ? "processing"
    : failedDocuments > 0
      ? "complete_with_errors"
      : attentionDocuments > 0
        ? "complete_with_attention"
        : "complete";
  const title =
    state === "processing"
      ? "Behandler dokumenter"
      : state === "complete_with_errors"
        ? "Import fullført — kontroll kreves"
        : state === "complete_with_attention"
          ? "Import fullført — kontroll kreves"
          : "Import fullført";
  const activeItem = args.items.find((item) => !isImportTerminalStatus(item.status));
  const currentPhase = hasNonTerminal
    ? normalizeImportPhase(activeItem?.status)
    : state === "complete_with_errors"
      ? "needs_attention"
      : state === "complete_with_attention"
        ? "needs_attention"
        : "complete";
  const progressPercent = calculateWeightedProgress(args.items, totalDocuments, allTerminal);
  const startedAt = args.importStartedAt ?? earliestStart(args.items);
  const etaSeconds =
    state === "processing" && startedAt
      ? calculateWeightedEtaSeconds({
          items: args.items,
          nowMs: args.nowMs,
          startedAt,
          progressPercent,
          terminalDocuments,
          totalDocuments
        })
      : null;
  return {
    title,
    state,
    totalDocuments,
    terminalDocuments,
    processingDocuments,
    remainingDocuments,
    failedDocuments,
    attentionDocuments,
    skippedDocuments,
    importedDocuments: terminalDocuments,
    processedDocuments: terminalDocuments,
    currentPhase,
    currentPhaseLabel: IMPORT_PHASE_LABELS[currentPhase],
    progressPercent,
    etaSeconds,
    etaLabel: state === "processing" ? formatEtaLabel(etaSeconds) : "Ferdig",
    primaryLine: `${terminalDocuments} av ${totalDocuments} dokumenter behandlet`,
    secondaryLine: `${remainingDocuments} ${remainingDocuments === 1 ? "dokument gjenstår" : "dokumenter gjenstår"}`,
    totalPagesEstimate:
      args.totalPagesEstimate ?? args.items.reduce((sum, item) => sum + (item.pagesTotal || item.pages || 0), 0),
    processedPages:
      args.processedPages ??
      args.items.reduce((sum, item) => sum + (item.pagesProcessed || (isImportTerminalStatus(item.status) ? item.pages || 0 : 0)), 0),
    sourcesCreated: args.sourcesCreated ?? args.items.reduce((sum, item) => sum + (item.sources || 0), 0)
  } satisfies ImportProgressSummaryData;
}

export function formatEtaLabel(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return "ETA beregnes ...";
  }
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 10) {
    return "ETA: under 10 sek";
  }
  if (rounded < 60) {
    return `ETA: ca. ${rounded} sek`;
  }
  if (rounded < 3600) {
    const minutes = Math.floor(rounded / 60);
    const rest = rounded % 60;
    return rest > 0 ? `ETA: ca. ${minutes} min ${rest} sek` : `ETA: ca. ${minutes} min`;
  }
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.round((rounded % 3600) / 60);
  return minutes > 0 ? `ETA: ca. ${hours} t ${minutes} min` : `ETA: ca. ${hours} t`;
}

function calculateWeightedProgress(items: ImportUxQueueItem[], totalDocuments: number, allTerminal: boolean) {
  if (allTerminal) {
    return 100;
  }
  if (totalDocuments <= 0) {
    return 0;
  }
  const knownWeight = items.reduce((sum, item) => sum + PHASE_WEIGHTS[normalizeImportPhase(item.status)], 0);
  const missingItems = Math.max(0, totalDocuments - items.length);
  const progress = (knownWeight + missingItems * PHASE_WEIGHTS.selected) / totalDocuments;
  return Math.max(0, Math.min(99, Math.round(progress * 100)));
}

function earliestStart(items: ImportUxQueueItem[]) {
  const starts = items.map((item) => item.startedAt).filter((value): value is number => typeof value === "number");
  return starts.length ? Math.min(...starts) : null;
}

function calculateWeightedEtaSeconds(args: {
  items: ImportUxQueueItem[];
  nowMs: number;
  startedAt: number;
  progressPercent: number;
  terminalDocuments: number;
  totalDocuments: number;
}) {
  const elapsedSeconds = Math.max(1, (args.nowMs - args.startedAt) / 1000);
  const overallProgress = args.progressPercent / 100;
  if (overallProgress > 0.05) {
    const estimatedTotalSeconds = elapsedSeconds / overallProgress;
    return Math.max(0, estimatedTotalSeconds - elapsedSeconds);
  }
  if (args.terminalDocuments > 0 && args.totalDocuments > args.terminalDocuments) {
    const avgSecondsPerItem = elapsedSeconds / args.terminalDocuments;
    return avgSecondsPerItem * (args.totalDocuments - args.terminalDocuments);
  }
  return null;
}

export function deriveImportGapMessages(input: {
  needsReviewCount: number;
  notUsedCount: number;
  hasActiveProcessing: boolean;
}) {
  const messages: string[] = [];
  if (input.hasActiveProcessing) {
    messages.push("Importen behandler fortsatt dokumenter. Vent til behandlingen er ferdig før du konkluderer.");
  }
  if (input.needsReviewCount > 0) {
    messages.push(
      `${input.needsReviewCount} ${input.needsReviewCount === 1 ? "dokument trenger" : "dokumenter trenger"} manuell kontroll før de kan brukes som kildegrunnlag.`
    );
  }
  if (input.notUsedCount > 0) {
    messages.push(
      `${input.notUsedCount} ${input.notUsedCount === 1 ? "dokument ble" : "dokumenter ble"} ikke brukt som kildegrunnlag. Erstatt fil eller hold dem utenfor saken.`
    );
  }
  return messages;
}
