import { getCaseReadiness } from "./readiness";
import type { ReadinessInput } from "../types/readiness";

const baseInput: ReadinessInput = {
  hasDocuments: true,
  hasSources: true,
  sourceCount: 10,
  sourceCoveragePercent: 96,
  totalPages: 100,
  processedPages: 100,
  pagesWithSources: 96,
  pagesMissingSources: 4,
  pendingOcrPages: 0,
  documentsRequiringAttention: 0,
  importFailures: 0,
  hasActiveProcessing: false,
  dbEncryptionVerified: true
};

export const readinessTestCases = [
  ["no documents", { hasDocuments: false, hasSources: false, sourceCount: 0, sourceCoveragePercent: 0 }, "not_ready"],
  ["documents but no sources", { hasSources: false, sourceCount: 0, sourceCoveragePercent: 0 }, "not_ready"],
  ["coverage 0", { sourceCoveragePercent: 0 }, "not_ready"],
  ["coverage 49", { sourceCoveragePercent: 49 }, "not_ready"],
  ["coverage 50 active processing", { sourceCoveragePercent: 50, hasActiveProcessing: true }, "requires_control"],
  ["coverage 75", { sourceCoveragePercent: 75 }, "requires_control"],
  ["coverage 85", { sourceCoveragePercent: 85 }, "ready_for_preliminary_analysis"],
  ["coverage 96", { sourceCoveragePercent: 96 }, "ready_for_draft_control"]
] as const;

export function runReadinessTestCase(patch: Partial<ReadinessInput>) {
  return getCaseReadiness({ ...baseInput, ...patch });
}

