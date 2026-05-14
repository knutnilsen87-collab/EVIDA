import type { DocumentBasisRow, DocumentBasisSummary } from "./documentBasis";

export type FirstUserPrimaryActionLabel =
  | "Se dokumenter som trenger kontroll"
  | "Åpne foreløpig Saksrom"
  | "Åpne Saksrom"
  | "Se dokumenter som ikke ble brukt";

export type FirstUserPrimaryActionTarget = "review" | "preliminary_case_room" | "case_room" | "unused";

export interface ImportUxQueueItem {
  status: string;
  startedAt?: number;
  pagesProcessed?: number;
  pagesTotal?: number;
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

const TERMINAL_IMPORT_STATUSES = new Set([
  "completed",
  "ready",
  "partial",
  "duplicate",
  "unsupported",
  "ocr_required",
  "cancelled",
  "failed",
  "indexed"
]);

export function isImportTerminalStatus(status: string) {
  return TERMINAL_IMPORT_STATUSES.has(status);
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
  if (items.length === 0) {
    return "ETA beregnes";
  }
  if (items.every((item) => isImportTerminalStatus(item.status))) {
    return "Ferdig";
  }

  const active = items.find((item) => !isImportTerminalStatus(item.status));
  if (!active?.startedAt) {
    return "ETA beregnes";
  }

  if (
    typeof active.pagesProcessed === "number" &&
    typeof active.pagesTotal === "number" &&
    active.pagesProcessed > 0 &&
    active.pagesTotal > active.pagesProcessed
  ) {
    const elapsedSeconds = Math.max(1, (nowMs - active.startedAt) / 1000);
    const pagesPerSecond = active.pagesProcessed / elapsedSeconds;
    const remainingSeconds = Math.round((active.pagesTotal - active.pagesProcessed) / pagesPerSecond);
    return etaBucket(remainingSeconds);
  }

  const elapsedSeconds = Math.max(1, Math.round((nowMs - active.startedAt) / 1000));
  if (elapsedSeconds < 20) {
    return "ETA beregnes";
  }
  return "Omtrent under 1 minutt igjen";
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
      primaryAction: { label: "Se dokumenter som trenger kontroll", target: "review" },
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
  const controlStep = deriveControlNextStep({
    hasDocuments: args.hasDocuments,
    needsReviewCount: args.documentBasis.needsReviewDocuments.length,
    notUsedCount: args.documentBasis.unreadableDocuments.length,
    readyCount: args.documentBasis.readyCount,
    totalCount: args.documentBasis.totalCount,
    hasActiveProcessing: args.hasActiveProcessing,
    canOpenPreliminary: args.canOpenPreliminary,
    canOpenFinal: args.canOpenFinal
  });

  return {
    progressLabel: deriveImportProgressLabel(args.queue, args.totalDocuments),
    etaLabel: deriveImportEtaLabel(args.queue, args.nowMs),
    gapMessages: deriveImportGapMessages({
      needsReviewCount: args.documentBasis.needsReviewDocuments.length,
      notUsedCount: args.documentBasis.unreadableDocuments.length,
      hasActiveProcessing: args.hasActiveProcessing
    }),
    nextStep: controlStep
  };
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

function etaBucket(seconds: number) {
  if (seconds < 60) {
    return "Under 1 minutt igjen";
  }
  if (seconds < 180) {
    return "Omtrent 1-3 minutter igjen";
  }
  if (seconds < 300) {
    return "Omtrent 3-5 minutter igjen";
  }
  if (seconds < 900) {
    return "Omtrent 5-15 minutter igjen";
  }
  return "Over 15 minutter igjen";
}
