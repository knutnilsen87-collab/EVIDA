import type { ImportProgressSummaryData } from "../documents/importUx";

export type SaksromPreparationScope = "locked" | "controlled_sources_only" | "full_case_sources";

export type CasePreparationPhase =
  | "empty"
  | "processing"
  | "needs_control"
  | "limited_ready"
  | "ready";

export interface CasePreparationProgress {
  phase: CasePreparationPhase;
  saksromScope: SaksromPreparationScope;
  totalDocuments: number;
  processedDocuments: number;
  readyDocuments: number;
  reviewDocuments: number;
  unreadableDocuments: number;
  totalPages: number;
  processedPages: number;
  pendingOcrPages: number;
  sourceObjects: number;
  sourceCoveragePercent: number;
  progressPercent: number;
  currentPhaseLabel: string;
  etaLabel: string;
  nextBestAction: string;
  chatPlaceholder: string;
  isRunning: boolean;
}

export interface CasePreparationProgressInput {
  totalDocuments: number;
  processedDocuments: number;
  readyDocuments: number;
  reviewDocuments: number;
  unreadableDocuments: number;
  totalPages: number;
  processedPages: number;
  pendingOcrPages: number;
  sourceObjects: number;
  sourceCoveragePercent: number;
  hasActiveProcessing: boolean;
  importProgress?: Pick<
    ImportProgressSummaryData,
    "state" | "progressPercent" | "currentPhaseLabel" | "etaLabel" | "remainingDocuments"
  >;
  nextActionTitle?: string;
}
