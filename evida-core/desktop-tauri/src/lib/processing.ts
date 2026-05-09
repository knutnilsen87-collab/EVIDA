import type { DocumentProcessingStage, ProcessingEta } from "../types/processing";

export const PROCESSING_STEPS = [
  { stage: "queued", label: "Venter på behandling", percent: 0 },
  { stage: "reading_file", label: "Leser fil", percent: 10 },
  { stage: "counting_pages", label: "Teller sider", percent: 20 },
  { stage: "extracting_text", label: "Henter tekst", percent: 40 },
  { stage: "finding_source_points", label: "Finner kildepunkter", percent: 60 },
  { stage: "building_case_basis", label: "Bygger saksgrunnlag", percent: 75 },
  { stage: "checking_coverage", label: "Kontrollerer dekning", percent: 90 },
  { stage: "completed", label: "Klar", percent: 100 }
] as const;

export function getStepState(
  stepStage: DocumentProcessingStage,
  currentStage: DocumentProcessingStage
): "done" | "active" | "pending" | "failed" {
  if (currentStage === "failed") {
    return stepStage === "failed" ? "failed" : "pending";
  }

  const currentIndex = PROCESSING_STEPS.findIndex((step) => step.stage === currentStage);
  const stepIndex = PROCESSING_STEPS.findIndex((step) => step.stage === stepStage);

  if (currentIndex === -1 || stepIndex === -1) {
    return "pending";
  }
  if (stepIndex < currentIndex) {
    return "done";
  }
  if (stepIndex === currentIndex) {
    return "active";
  }
  return "pending";
}

export function stageProgressPercent(stage: DocumentProcessingStage | undefined) {
  if (!stage || stage === "failed") {
    return stage === "failed" ? 100 : 0;
  }
  return PROCESSING_STEPS.find((step) => step.stage === stage)?.percent ?? 0;
}

export function formatEta(seconds?: number, status?: ProcessingEta["status"]): string {
  if (status === "complete") return "Ferdig";
  if (status === "failed") return "Kunne ikke fullføres";
  if (status === "paused") return "Satt på pause";
  if (status === "unavailable") return "Ikke tilgjengelig i denne versjonen";
  if (!seconds || seconds <= 0) return "Beregnes";

  if (seconds < 60) return "Under 1 minutt igjen";
  if (seconds < 180) return "Omtrent 1–3 minutter igjen";
  if (seconds < 300) return "Omtrent 3–5 minutter igjen";
  if (seconds < 900) return "Omtrent 5–15 minutter igjen";
  return "Over 15 minutter igjen";
}

export function estimateRemainingSeconds(args: {
  processedPages: number;
  totalPages: number;
  startedAt: number;
  now: number;
}) {
  const elapsedSeconds = Math.max((args.now - args.startedAt) / 1000, 1);
  const pagesPerSecond = args.processedPages / elapsedSeconds;

  if (pagesPerSecond <= 0 || args.processedPages <= 0) {
    return undefined;
  }

  const remainingPages = Math.max(args.totalPages - args.processedPages, 0);
  return remainingPages / pagesPerSecond;
}

export function calculatePageProgress(args: {
  totalPages: number;
  processedPages: number;
  pagesWithSources: number;
}) {
  const normalizedTotalPages = Math.max(0, args.totalPages);
  const processedPages = Math.min(Math.max(0, args.processedPages), normalizedTotalPages);
  const pagesWithSources = Math.min(Math.max(0, args.pagesWithSources), normalizedTotalPages);
  const pagesRemaining = Math.max(normalizedTotalPages - processedPages, 0);
  const pagesMissingSources = Math.max(normalizedTotalPages - pagesWithSources, 0);
  const sourceCoveragePercent =
    normalizedTotalPages > 0 ? Math.round((pagesWithSources / normalizedTotalPages) * 100) : 0;

  return {
    totalPages: normalizedTotalPages,
    processedPages,
    pagesWithSources,
    pagesMissingSources,
    pagesRemaining,
    sourceCoveragePercent
  };
}
