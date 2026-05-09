export type ReadinessVerdict =
  | "not_ready"
  | "requires_control"
  | "ready_for_preliminary_analysis"
  | "ready_for_draft_control";

export type ReadinessInput = {
  hasDocuments: boolean;
  hasSources: boolean;
  sourceCount: number;
  sourceCoveragePercent: number;
  totalPages: number;
  processedPages: number;
  pagesWithSources: number;
  pagesMissingSources: number;
  pendingOcrPages: number;
  documentsRequiringAttention: number;
  importFailures: number;
  hasActiveProcessing: boolean;
  dbEncryptionVerified: boolean;
};

export type ReadinessResult = {
  verdict: ReadinessVerdict;
  label: string;
  reason: string;
  allowedUse: string;
  blockedUse: string;
  primaryAction: string;
  severity: "neutral" | "warning" | "success" | "critical";
};

