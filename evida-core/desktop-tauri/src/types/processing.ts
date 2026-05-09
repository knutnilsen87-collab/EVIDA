export type DocumentProcessingStage =
  | "queued"
  | "reading_file"
  | "counting_pages"
  | "extracting_text"
  | "finding_source_points"
  | "building_case_basis"
  | "checking_coverage"
  | "completed"
  | "failed";

export type DocumentProcessingStatus = {
  documentId: string;
  fileName: string;
  stage: DocumentProcessingStage;
  progressPercent: number;
  pagesProcessed?: number;
  pagesTotal?: number;
  sourceCoveragePercent?: number;
  startedAt?: string;
  updatedAt?: string;
  estimatedRemainingLabel?: string;
  errorMessage?: string;
};

export type ProcessingEta = {
  status: "calculating" | "available" | "unavailable" | "paused" | "failed" | "complete";
  label: string;
  estimatedRemainingSeconds?: number;
  confidence: "low" | "medium" | "high";
  basis: "page_throughput" | "document_throughput" | "step_based" | "unavailable_feature" | "unknown";
};

export type PageProcessingProgress = {
  totalPages: number;
  processedPages: number;
  pagesWithSources: number;
  pagesMissingSources: number;
  pagesRemaining: number;
  sourceCoveragePercent: number;
  currentStepLabel: string;
  etaLabel: string;
  activeProcessing: boolean;
  lastUpdatedAt: string;
};

export type ProcessingStepVisualState = "done" | "active" | "pending" | "failed";

export type ProcessingStepView = {
  stage: DocumentProcessingStage;
  label: string;
  state: ProcessingStepVisualState;
};

export const DOCUMENT_PROCESSING_STAGES: DocumentProcessingStage[] = [
  "queued",
  "reading_file",
  "counting_pages",
  "extracting_text",
  "finding_source_points",
  "building_case_basis",
  "checking_coverage",
  "completed"
];

export const DOCUMENT_PROCESSING_STAGE_LABELS: Record<DocumentProcessingStage, string> = {
  queued: "Venter på behandling",
  reading_file: "Leser fil",
  counting_pages: "Teller sider",
  extracting_text: "Henter tekst",
  finding_source_points: "Finner kildepunkter",
  building_case_basis: "Bygger saksgrunnlag",
  checking_coverage: "Kontrollerer dekning",
  completed: "Klar",
  failed: "Kunne ikke behandles"
};

export const DOCUMENT_PROCESSING_STAGE_PROGRESS: Record<DocumentProcessingStage, number> = {
  queued: 0,
  reading_file: 10,
  counting_pages: 20,
  extracting_text: 40,
  finding_source_points: 60,
  building_case_basis: 75,
  checking_coverage: 90,
  completed: 100,
  failed: 100
};

export function processingStageLabel(stage: DocumentProcessingStage | undefined) {
  return stage ? DOCUMENT_PROCESSING_STAGE_LABELS[stage] : "Venter på behandling";
}

export function processingStageProgress(stage: DocumentProcessingStage | undefined) {
  return stage ? DOCUMENT_PROCESSING_STAGE_PROGRESS[stage] : 0;
}

export function processingStepViews(currentStage: DocumentProcessingStage | undefined): ProcessingStepView[] {
  const stage = currentStage || "queued";
  if (stage === "failed") {
    return [
      ...DOCUMENT_PROCESSING_STAGES.filter((item) => item !== "completed").map((item) => ({
        stage: item,
        label: DOCUMENT_PROCESSING_STAGE_LABELS[item],
        state: "pending" as ProcessingStepVisualState
      })),
      {
        stage: "failed",
        label: DOCUMENT_PROCESSING_STAGE_LABELS.failed,
        state: "failed" as ProcessingStepVisualState
      }
    ];
  }
  const activeIndex = DOCUMENT_PROCESSING_STAGES.indexOf(stage);

  return DOCUMENT_PROCESSING_STAGES.map((item, index) => {
    let state: ProcessingStepVisualState = "pending";
    if (index < activeIndex) {
      state = "done";
    } else if (index === activeIndex) {
      state = "active";
    }

    return {
      stage: item,
      label: DOCUMENT_PROCESSING_STAGE_LABELS[item],
      state
    };
  });
}
