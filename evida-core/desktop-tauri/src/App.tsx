import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Download, FolderOpen, Moon, RotateCcw, Sun, Trash2 } from "lucide-react";
import {
  chooseDocumentFolderPaths,
  chooseDocumentPaths,
  applyManualReviewAction,
  createCase,
  assessRisk as assessRiskApi,
  buildChronology as buildChronologyApi,
  buildEvidenceMatrix,
  createArgumentItem,
  exportDiagnostics,
  exportEvidenceQualityPackage,
  exportImportDiagnostics,
  expandImportPaths,
  findContradictions as findContradictionsApi,
  getAppStatus,
  getCaseCoverageAudit,
  getDatabaseSecurityStatus,
  getDocumentEngineStatus,
  getImportHealth,
  hasDesktopRuntime,
  listManualReviewItems,
  listOcrResults,
  listAuditEvents,
  listCases,
  listDocuments,
  listImportItems,
  listSourceObjects,
  listWorkItems,
  markCaseOpened,
  openCaseWindow,
  openLocalDataFolder,
  openOriginalFolder,
  openNewCaseWindow,
  recordDocumentControlAction,
  reindexCaseDocuments,
  registerDocumentInSession,
  refreshEvidenceQuality,
  removeImportItemFromCase,
  renameCase,
  resetTestData,
  softDeleteCase,
  startImportSession,
  completeImportSession
} from "./lib/api";
import type {
  AuditEvent,
  CaseCoverageAudit,
  CaseSummary,
  DatabaseSecurityStatus,
  DocumentEngineStatus,
  DocumentSummary,
  EvidenceQualityReport,
  ImportHealthSummary,
  ImportItem,
  ManualReviewItem,
  OcrResult,
  SourceObjectSummary,
  ViewKey
} from "./types";
import { NextAction } from "./components/NextAction";
import { Sidebar } from "./components/Sidebar";
import { CaseHeader } from "./components/CaseHeader";
import { CaseSwitcher } from "./components/CaseSwitcher";
import { DesktopMenuBar } from "./components/DesktopMenuBar";
import { SourcePanel } from "./components/SourcePanel";
import { SourcePreviewDrawer } from "./components/SourcePreviewDrawer";
import { DocumentPreviewDrawer } from "./components/DocumentPreviewDrawer";
import { ImportProgressSummary, type ImportAttentionItem } from "./components/ImportProgressSummary";
import { StatusCard } from "./components/StatusCard";
import { CaseRoomView } from "./components/CaseRoomView";
import { CaseVitalityBar } from "./components/CaseVitalityBar";
import { WorkroomHeader } from "./components/WorkroomHeader";
import { SettingsView } from "./components/settings/SettingsView";
import { ArgumentsView } from "./components/workrooms/ArgumentsView";
import { ChronologyView } from "./components/workrooms/ChronologyView";
import { ContradictionsView } from "./components/workrooms/ContradictionsView";
import { EvidenceView } from "./components/workrooms/EvidenceView";
import { LitigationSimulationView } from "./components/workrooms/LitigationSimulationView";
import { RiskView } from "./components/workrooms/RiskView";
import { sourceTitle } from "./components/workrooms/SourceButtonList";
import type {
  ArgumentRow,
  ConflictRow,
  EvidenceRow,
  RiskRow,
  TimelineItem
} from "./components/workrooms/types";
import {
  DOCUMENT_PROCESSING_LABELS,
  calculateSourceCoveragePercent,
  getCaseReadiness,
  getDocumentProcessingState
} from "./features/readiness/caseReadiness";
import type { CaseCoverageSummary } from "./features/readiness/caseReadiness";
import {
  processingStageLabel,
  processingStageProgress
} from "./types/processing";
import type { DocumentProcessingStage } from "./types/processing";
import {
  LEGAL_COMMANDS,
  gateLegalCommand,
  resolveLegalCommand
} from "./features/legalCommands/legalCommands";
import type { LegalCommand } from "./features/legalCommands/legalCommands";
import { useWindowCaseContext } from "./lib/windowCaseContext";
import { useEvidaShortcuts } from "./lib/shortcuts";
import { workroomKeyForView } from "./lib/workroomTheme";
import {
  deriveDocumentBasisSummary,
  type DocumentBasisRow
} from "./features/documents/documentBasis";
import {
  canApproveSourceAfterPreview,
  deriveImportOutcome,
  deriveImportOutcomeViewModel,
  deriveImportUxSummary,
  deriveNextAction,
  getAiReadyDocumentIds,
  getReviewDocuments,
  summarizeImportProgress
} from "./features/documents/importUx";
import { deriveCasePreparationProgress } from "./features/casePreparation/casePreparation.logic";
import { deriveDocumentControlBulkPlan } from "./features/documentControl/documentControl.logic";
import type { DocumentControlBulkActionId } from "./features/documentControl/documentControl.types";
import {
  EXPORT_PRELIMINARY_ACKNOWLEDGEMENT,
  getRoomAvailability,
  roomKeyForView
} from "./features/rooms/roomAvailability";
import type { RoomAvailability } from "./features/rooms/roomAvailability";

const viewTitles: Record<ViewKey, string> = {
  overview: "Saksoversikt",
  documents: "Dokumenter",
  documentControl: "Dokumentkontroll",
  caseRoom: "Saksrom",
  chronology: "Kronologi",
  evidence: "Bevismatrise",
  arguments: "Anførsler",
  contradictions: "Motstrid",
  risk: "Risiko",
  litigationSimulation: "Rettssimulering",
  draft: "Utkast",
  control: "Kontrollgrunnlag",
  export: "Eksport"
};

const THEME_STORAGE_KEY = "evida-theme";
const VISUAL_MODE_STORAGE_KEY = "evida-visual-mode";
const AI_TRUST_STORAGE_KEY = "evida-ai-trust-seen";

type ThemeMode = "light" | "dark";
type VisualMode = "calm" | "standard" | "focusPlus";
type OnboardingStage = "intro" | "start" | "import" | "caseRoom";
type ImportQueueStatus =
  | DocumentProcessingStage
  | ImportItem["status"]
  | "selected"
  | "validating"
  | "hashing"
  | "extracting"
  | "chunking"
  | "ready"
  | "needs_attention";

const ROOM_BLOCKING_IMPORT_STATUSES = new Set<ImportQueueStatus>([
  "queued",
  "selected",
  "validating",
  "hashing",
  "reading_file",
  "counting_pages",
  "extracting",
  "extracting_text",
  "finding_source_points",
  "building_case_basis",
  "checking_coverage",
  "chunking",
  "indexed"
]);

interface ImportQueueItem {
  path: string;
  name: string;
  status: ImportQueueStatus;
  detail: string;
  issueCode?: string;
  userMessage?: string;
  recommendedAction?: string;
  technicalMessage?: string;
  canRetry?: boolean;
  canContinue?: boolean;
  pages?: number;
  pagesProcessed?: number;
  pagesTotal?: number;
  sources?: number;
  startedAt?: number;
  statusUpdatedAt?: number;
}

interface DocumentProcessingProgressEvent {
  caseId: string;
  path: string;
  fileName: string;
  stage: DocumentProcessingStage;
  progressPercent: number;
  pagesProcessed?: number;
  pagesTotal?: number;
  sourcesCreated?: number;
  message: string;
  updatedAt: string;
}

function initialSearchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  const params = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.replace(/^#\/?/, "");
  const hashParams = new URLSearchParams(hashQuery);
  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });
  return params;
}

function initialWorkspaceView(): ViewKey {
  const requestedView = initialSearchParams().get("view");
  if (requestedView && Object.prototype.hasOwnProperty.call(viewTitles, requestedView)) {
    return requestedView as ViewKey;
  }
  return "documents";
}

function shouldOpenWorkspaceImmediately() {
  const params = initialSearchParams();
  return Boolean(params.get("caseId"));
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function coverageLabel(percent: number, pagesWithSources: number) {
  if (percent === 0 && pagesWithSources > 0) {
    return "<1 %";
  }
  return `${percent} %`;
}

function firstSentence(value: string) {
  const sentence = value.split(/[.!?]\s/)[0] || value;
  return sentence.length > 150 ? `${sentence.slice(0, 147)}...` : sentence;
}

function extractDate(value: string) {
  return value.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/)?.[0] || "Udatert";
}

function emptyWorkState() {
  return {
    chronology: [] as TimelineItem[],
    evidence: [] as EvidenceRow[],
    arguments: [] as ArgumentRow[],
    contradictions: [] as ConflictRow[],
    risks: [] as RiskRow[]
  };
}

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

function nextUiTick() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function closeDialogOnEscape(event: KeyboardEvent<HTMLElement>, onClose: () => void) {
  if (event.key === "Escape") {
    event.stopPropagation();
    onClose();
  }
}

function importProgressPercent(status: ImportQueueStatus) {
  const healthProgress: Partial<Record<ImportQueueStatus, number>> = {
    validating: 12,
    hashing: 22,
    extracting: 42,
    chunking: 72,
    indexed: 88,
    ready: 100,
    partial: 100,
    duplicate: 100,
    unsupported: 100,
    ocr_required: 100,
    cancelled: 100
  };
  return healthProgress[status] ?? processingStageProgress(status as DocumentProcessingStage);
}

function formatDuration(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) {
    return `${seconds} sek`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes} min ${rest} sek` : `${minutes} min`;
}

function importEta(item: ImportQueueItem, nowMs: number) {
  if (["completed", "failed"].includes(item.status)) {
    return item.startedAt ? `Brukte ${formatDuration(nowMs - item.startedAt)}` : "";
  }

  const elapsed = item.startedAt ? nowMs - item.startedAt : 0;
  if (item.status === "queued" || item.status === "reading_file" || item.status === "counting_pages") {
    return elapsed > 2000 ? "Omtrent under 1 min igjen" : "Starter straks";
  }
  if (item.status === "extracting_text") {
    if (elapsed < 30_000) {
      return "Omtrent 1-3 min igjen";
    }
    if (elapsed < 120_000) {
      return "Omtrent 1-2 min igjen";
    }
    return "Tar litt tid med stort dokument";
  }
  if (item.status === "finding_source_points" || item.status === "building_case_basis" || item.status === "checking_coverage") {
    return "Omtrent under 1 min igjen";
  }
  return "";
}

function importStatusLabel(status: ImportQueueStatus) {
  if (
    status === "queued" ||
    status === "reading_file" ||
    status === "counting_pages" ||
    status === "extracting_text" ||
    status === "finding_source_points" ||
    status === "building_case_basis" ||
    status === "checking_coverage" ||
    status === "completed"
  ) {
    return processingStageLabel(status);
  }

  const healthLabels: Partial<Record<ImportQueueStatus, string>> = {
    ocr_required: "Krever OCR",
    ocr_running: "OCR kjører",
    partial: "Delvis behandlet",
    duplicate: "Duplikat",
    unsupported: "Filtype støttes ikke",
    cancelled: "Avbrutt",
    indexed: "Indeksert",
    failed: "Feilet - se årsak og neste handling"
  };
  if (healthLabels[status]) {
    return healthLabels[status];
  }

  switch (status) {
    case "selected":
      return "Venter på automatisk behandling";
    case "validating":
      return "Sjekker dokumentet";
    case "hashing":
      return "Sikrer dokumentreferanse";
    case "extracting":
      return "Leser tekst";
    case "chunking":
      return "Lager sporbare kilder";
    case "ready":
      return "Klar";
    case "needs_attention":
      return "Venter på dokumentmotor";
    case "failed":
      return "Feilet - se årsak og neste handling";
  }
}

function temporaryCaseTitle(date = new Date()) {
  return `Ny sak – ${date.toISOString().slice(0, 10)}`;
}

function importProcessingLabel(status: ImportQueueStatus) {
  if (
    status === "queued" ||
    status === "reading_file" ||
    status === "counting_pages" ||
    status === "extracting_text" ||
    status === "finding_source_points" ||
    status === "building_case_basis" ||
    status === "checking_coverage" ||
    status === "completed"
  ) {
    return processingStageLabel(status);
  }

  const healthLabels: Partial<Record<ImportQueueStatus, string>> = {
    ocr_required: "Krever OCR",
    ocr_running: "OCR kjører",
    partial: "Delvis behandlet",
    duplicate: "Duplikat",
    unsupported: "Filtype støttes ikke",
    cancelled: "Avbrutt",
    indexed: "Indeksert",
    failed: "Feilet - se importdetaljer"
  };
  if (healthLabels[status]) {
    return healthLabels[status];
  }

  switch (status) {
    case "selected":
      return DOCUMENT_PROCESSING_LABELS.queued;
    case "validating":
      return DOCUMENT_PROCESSING_LABELS.running;
    case "hashing":
      return DOCUMENT_PROCESSING_LABELS.running;
    case "extracting":
      return DOCUMENT_PROCESSING_LABELS.extracting_text;
    case "chunking":
      return DOCUMENT_PROCESSING_LABELS.creating_sources;
    case "ready":
      return DOCUMENT_PROCESSING_LABELS.completed;
    case "needs_attention":
      return DOCUMENT_PROCESSING_LABELS.waiting_for_background_worker;
    case "failed":
      return DOCUMENT_PROCESSING_LABELS.failed;
  }
}

function documentReadiness(document: DocumentSummary) {
  const processingState = getDocumentProcessingState({
    pageCount: document.page_count,
    analyzedPageCount: document.analyzed_page_count || 0,
    sourceCount: document.source_count,
    pendingTextRecognitionPages: document.pending_ocr_page_count || 0,
    ocrStatus: document.ocr_status,
    hasActiveProcessing: document.ocr_status === "running"
  });

  if (processingState === "completed" || processingState === "completed_partial") {
    return {
      status: "ready" as const,
      label: processingState === "completed" ? "Klar for Saksrom" : "Delvis klar",
      detail: `${countLabel(document.page_count, "side", "sider")} · ${countLabel(document.source_count, "kildeutdrag", "kildeutdrag")}`
    };
  }
  if (processingState === "failed") {
    return {
      status: "failed" as const,
      label: DOCUMENT_PROCESSING_LABELS.failed,
      detail: "Dokumentet kunne ikke gjøres klart for Saksrom"
    };
  }

  return {
    status: "processing" as const,
    label: DOCUMENT_PROCESSING_LABELS[processingState],
    detail: document.analyzed_page_count > 0 ? `${document.analyzed_page_count} sider analysert` : "Venter på automatisk behandling"
  };
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>(() => initialWorkspaceView());
  const windowCase = useWindowCaseContext(activeView);
  const [isAuthenticated, setIsAuthenticated] = useState(() => shouldOpenWorkspaceImmediately());
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>(() => {
    if (typeof window === "undefined") {
      return "intro";
    }
    return shouldOpenWorkspaceImmediately() ? "caseRoom" : "intro";
  });
  const [casePickerOpen, setCasePickerOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  });
  const [visualMode, setVisualMode] = useState<VisualMode>(() => {
    if (typeof window === "undefined") {
      return "standard";
    }
    const stored = window.localStorage.getItem(VISUAL_MODE_STORAGE_KEY);
    return stored === "calm" || stored === "standard" || stored === "focusPlus" ? stored : "standard";
  });
  const [status, setStatus] = useState("Starter ...");
  const [dbSecurity, setDbSecurity] = useState<DatabaseSecurityStatus | null>(null);
  const [documentEngineStatus, setDocumentEngineStatus] = useState<DocumentEngineStatus | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [sources, setSources] = useState<SourceObjectSummary[]>([]);
  const [coverageAudit, setCoverageAudit] = useState<CaseCoverageAudit | null>(null);
  const [importHealth, setImportHealth] = useState<ImportHealthSummary | null>(null);
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([]);
  const [manualReviewItems, setManualReviewItems] = useState<ManualReviewItem[]>([]);
  const [evidenceQuality, setEvidenceQuality] = useState<EvidenceQualityReport | null>(null);
  const [showImportCompletion, setShowImportCompletion] = useState(false);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(windowCase.context.caseId || "");
  const [caseName, setCaseName] = useState("Ny prosessak");
  const [documentPath, setDocumentPath] = useState("");
  const [lastImport, setLastImport] = useState("");
  const [importQueue, setImportQueue] = useState<ImportQueueItem[]>([]);
  const [importNow, setImportNow] = useState(() => Date.now());
  const [processingLog, setProcessingLog] = useState<string[]>([]);
  const [importError, setImportError] = useState("");
  const [caseCreationError, setCaseCreationError] = useState("");
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);
  const [showImportQueueDetails, setShowImportQueueDetails] = useState(false);
  const [showImportCompletionDetails, setShowImportCompletionDetails] = useState(false);
  const [showControlTechnicalDetails, setShowControlTechnicalDetails] = useState(false);
  const [controlAttentionExpanded, setControlAttentionExpanded] = useState(false);
  const [controlAttentionHighlighted, setControlAttentionHighlighted] = useState(false);
  const [reviewApprovalChecks, setReviewApprovalChecks] = useState<Record<string, boolean>>({});
  const [localControlDecisions, setLocalControlDecisions] = useState<Record<string, "approved" | "excluded">>({});
  const [approvalSavingId, setApprovalSavingId] = useState("");
  const [approvalSuccessId, setApprovalSuccessId] = useState("");
  const [approvalToast, setApprovalToast] = useState("");
  const [expandedDocumentId, setExpandedDocumentId] = useState("");
  const [previewDocument, setPreviewDocument] = useState<DocumentSummary | null>(null);
  const [selectedControlDocumentId, setSelectedControlDocumentId] = useState("");
  const [controlSelectionIds, setControlSelectionIds] = useState<string[]>([]);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<DocumentControlBulkActionId | "">("");
  const [bulkConfirmChecked, setBulkConfirmChecked] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentFilter, setDocumentFilter] = useState<"all" | "ready" | "control" | "unused">("all");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [exportText, setExportText] = useState("");
  const [exportPreliminaryAcknowledged, setExportPreliminaryAcknowledged] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState("");
  const [reindexStatus, setReindexStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CaseSummary | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<SourceObjectSummary | undefined>();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [commandStatus, setCommandStatus] = useState("");
  const [attentionDetailsOpen, setAttentionDetailsOpen] = useState(false);
  const [technicalDetailsOpen, setTechnicalDetailsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [evidenceRows, setEvidenceRows] = useState<EvidenceRow[]>([]);
  const [argumentRows, setArgumentRows] = useState<ArgumentRow[]>([]);
  const [conflictRows, setConflictRows] = useState<ConflictRow[]>([]);
  const [riskRows, setRiskRows] = useState<RiskRow[]>([]);
  const [trustContractHidden, setTrustContractHidden] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(AI_TRUST_STORAGE_KEY) === "true";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startCaseNameInputRef = useRef<HTMLInputElement>(null);
  const panelCaseNameInputRef = useRef<HTMLInputElement>(null);
  const autoRepairAttemptedRef = useRef<Set<string>>(new Set());

  async function refresh(preferredCaseId = selectedCaseId) {
    setStatus(await getAppStatus());
    getDatabaseSecurityStatus().then(setDbSecurity).catch(() => setDbSecurity(null));
    getDocumentEngineStatus().then(setDocumentEngineStatus).catch(() => setDocumentEngineStatus(null));
    const nextCases = await listCases();
    setCases(nextCases);
    const activeCaseId = preferredCaseId
      ? nextCases.find((item) => item.id === preferredCaseId)?.id || ""
      : "";
    setSelectedCaseId(activeCaseId);
    const activeCase = nextCases.find((item) => item.id === activeCaseId);
    if (activeCase) {
      void windowCase.bindCase(activeCase, activeView);
    } else {
      windowCase.clearCase();
    }

    if (activeCaseId) {
      const [
        nextDocuments,
        nextSources,
        nextAudit,
        nextWorkItems,
        nextCoverageAudit,
        nextImportHealth,
        nextImportItems,
        nextOcrResults,
        nextManualReviewItems,
        nextEvidenceQuality
      ] = await Promise.all([
        listDocuments(activeCaseId),
        listSourceObjects(activeCaseId),
        listAuditEvents(activeCaseId),
        listWorkItems(activeCaseId),
        getCaseCoverageAudit(activeCaseId),
        getImportHealth(activeCaseId),
        listImportItems(activeCaseId),
        listOcrResults(activeCaseId),
        listManualReviewItems(activeCaseId),
        refreshEvidenceQuality(activeCaseId)
      ]);
      setDocuments(nextDocuments);
      setSources(nextSources);
      setAudit(nextAudit);
      setCoverageAudit(nextCoverageAudit);
      setImportHealth(nextImportHealth);
      setImportItems(nextImportItems);
      setOcrResults(nextOcrResults);
      setManualReviewItems(nextManualReviewItems);
      setEvidenceQuality(nextEvidenceQuality);
      setTimelineItems(nextWorkItems.chronology.map((item) => ({
        id: item.id,
        date: item.date_text,
        event: item.event,
        sourceId: item.source_id,
        status: item.status,
        uncertainty: item.uncertainty
      })));
      setEvidenceRows(nextWorkItems.evidence.map((item) => ({
        id: item.id,
        claim: item.claim,
        supporting: item.supporting_source_ids,
        weakening: item.weakening_source_ids,
        strength: item.strength,
        status: item.status
      })));
      setArgumentRows(nextWorkItems.arguments.map((item) => ({
        id: item.id,
        argument: item.argument,
        factualBasis: item.factual_basis,
        legalBasis: item.legal_basis,
        evidenceIds: item.evidence_source_ids,
        status: item.status
      })));
      setConflictRows(nextWorkItems.contradictions.map((item) => ({
        id: item.id,
        topic: item.topic,
        sourceA: item.source_a_id,
        sourceB: item.source_b_id,
        conflict: item.conflict,
        significance: item.significance,
        status: item.status
      })));
      setRiskRows(nextWorkItems.risks.map((item) => ({
        id: item.id,
        risk: item.risk,
        severity: item.severity,
        affectedArguments: item.affected_arguments,
        sourceBasis: item.source_basis,
        recommendedAction: item.recommended_action
      })));
    } else {
      setDocuments([]);
      setSources([]);
      setAudit([]);
      setCoverageAudit(null);
      setImportHealth(null);
      setImportItems([]);
      setOcrResults([]);
      setManualReviewItems([]);
      setEvidenceQuality(null);
      const empty = emptyWorkState();
      setTimelineItems(empty.chronology);
      setEvidenceRows(empty.evidence);
      setArgumentRows(empty.arguments);
      setConflictRows(empty.contradictions);
      setRiskRows(empty.risks);
    }
  }

  useEffect(() => {
    refresh().catch((error) => setStatus(`Feil: ${String(error)}`));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(VISUAL_MODE_STORAGE_KEY, visualMode);
  }, [visualMode]);

  useEffect(() => {
    window.localStorage.setItem(AI_TRUST_STORAGE_KEY, trustContractHidden ? "true" : "false");
  }, [trustContractHidden]);

  useEvidaShortcuts({
    onNewCase: () => void handleCreateCase(),
    onNewCaseWindow: () => void handleNewCaseInNewWindow(),
    onOpenCaseSwitcher: () => setCasePickerOpen(true),
    onImportDocuments: () => void handleChooseFiles(),
    onFindInCase: () => setCommandPaletteOpen(true),
    onCommandPalette: () => setCommandPaletteOpen((current) => !current),
    onSettings: () => setSettingsOpen(true),
    onCloseWindow: () => {
      if (hasDesktopRuntime()) {
        void getCurrentWindow().close();
      } else {
        handleCloseCase();
      }
    },
    onQuit: () => {
      if (hasDesktopRuntime()) {
        void getCurrentWindow().close();
      }
    }
  });

  const selectedCase = cases.find((item) => item.id === selectedCaseId);
  const hasDocuments = documents.length > 0;
  const hasSources = sources.length > 0;
  const automaticTextRecognitionAvailable =
    documentEngineStatus?.automatic_text_recognition_available ?? false;
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const needsOcr = documents.some((document) =>
    ["needs_ocr", "partial_needs_ocr", "failed"].includes(document.ocr_status)
  );
  const auditedTotalPages = coverageAudit?.total_pages;
  const auditedProcessedPages = coverageAudit?.processed_pages;
  const auditedPendingTextRecognitionPages = coverageAudit?.pending_text_recognition_pages;
  const analyzedPages = auditedProcessedPages ?? documents.reduce((sum, document) => sum + (document.analyzed_page_count || 0), 0);
  const pendingOcrPages =
    auditedPendingTextRecognitionPages ?? documents.reduce((sum, document) => sum + (document.pending_ocr_page_count || 0), 0);
  const totalPages = auditedTotalPages ?? documents.reduce((sum, document) => sum + document.page_count, 0);
  const visiblePagesWithSources = useMemo(() => {
    const coveredPages = new Set<string>();
    for (const source of sources) {
      const pageStart = Math.max(1, source.page_start || 1);
      const pageEnd = Math.max(pageStart, source.page_end || pageStart);
      for (let page = pageStart; page <= pageEnd; page += 1) {
        coveredPages.add(`${source.document_id}:${page}`);
      }
    }
    return coveredPages.size;
  }, [sources]);
  const pagesWithSources = coverageAudit?.pages_with_sources ?? visiblePagesWithSources;
  const sourceCoveragePercent = calculateSourceCoveragePercent({
    totalPages,
    pagesWithSources
  });
  const caseScopedSourceCoveragePercent = Math.min(
    sourceCoveragePercent,
    importHealth?.source_coverage_percent ?? sourceCoveragePercent
  );
  const pagesMissingSources =
    coverageAudit?.pages_missing_sources ?? (totalPages > 0 ? Math.max(0, totalPages - pagesWithSources) : 0);
  const processedDocuments = documents.filter(
    (document) => document.source_count > 0 || document.analyzed_page_count > 0
  );
  const documentsRequiringAttention = documents.filter((document) =>
    ["failed", "empty", "unsupported_file_type"].includes(document.ocr_status)
  );
  const failedDocuments = documents.filter((document) =>
    ["failed", "empty", "unsupported_file_type"].includes(document.ocr_status)
  );
  const importFailures =
    importHealth?.missing_files_count ??
    importQueue.filter((item) => ["failed", "partial", "ocr_required", "unsupported"].includes(item.status)).length;
  const hasActiveProcessing =
    isImporting ||
    Boolean(coverageAudit?.has_active_processing) ||
    importQueue.some((item) =>
      ["queued", "validating", "hashing", "reading_file", "counting_pages", "extracting_text", "finding_source_points", "building_case_basis", "checking_coverage", "ocr_running", "chunking", "indexed"].includes(item.status)
    ) ||
    documents.some((document) => document.ocr_status === "running");
  const activeImportItem = importQueue.find((item) =>
    ["queued", "validating", "hashing", "reading_file", "counting_pages", "extracting_text", "finding_source_points", "building_case_basis", "checking_coverage", "ocr_running", "chunking", "indexed"].includes(item.status)
  );
  const caseCoverage: CaseCoverageSummary = {
    totalDocuments: documents.length,
    processedDocuments: coverageAudit?.processed_documents ?? processedDocuments.length,
    totalPages,
    processedPages: analyzedPages,
    pagesWithText: analyzedPages,
    pagesWithSources,
    pagesMissingSources,
    failedDocuments: coverageAudit?.failed_documents ?? failedDocuments.length,
    documentsRequiringAttention: coverageAudit?.documents_requiring_attention ?? documentsRequiringAttention.length,
    sourceCoveragePercent: caseScopedSourceCoveragePercent,
    currentlyProcessingLabel: hasActiveProcessing
      ? activeImportItem
        ? importProcessingLabel(activeImportItem.status)
        : DOCUMENT_PROCESSING_LABELS.recognizing_text
      : undefined,
    hasActiveProcessing
  };
  const caseReadiness = getCaseReadiness({
    hasDocuments,
    totalDocuments: documents.length,
    processedDocuments: processedDocuments.length,
    totalPages,
    processedPages: analyzedPages,
    pagesWithText: analyzedPages,
    pagesWithSources,
    pagesMissingSources,
    sourceCount: coverageAudit?.source_count ?? sources.length,
    failedDocuments: coverageAudit?.failed_documents ?? failedDocuments.length,
    documentsRequiringAttention: coverageAudit?.documents_requiring_attention ?? documentsRequiringAttention.length,
    importFailures,
    pendingTextRecognitionPages: pendingOcrPages,
    hasActiveProcessing,
    criticalDocumentsFailed: (coverageAudit?.failed_documents ?? failedDocuments.length) > 0,
    automaticTextRecognitionAvailable,
    dbEncryptionVerified: dbSecurity?.encrypted_at_rest ?? false
  });
  const documentBasis = useMemo(
    () =>
      deriveDocumentBasisSummary({
        documents,
        importItems,
        manualReviewItems,
        audit,
        hasActiveProcessing
      }),
    [documents, importItems, manualReviewItems, audit, hasActiveProcessing]
  );
  const reviewDocuments = useMemo(() => getReviewDocuments(documentBasis), [documentBasis]);
  const visibleReviewDocuments = useMemo(
    () => reviewDocuments.filter((row) => !localControlDecisions[row.id]),
    [reviewDocuments, localControlDecisions]
  );
  const aiReadyDocumentIds = useMemo(
    () => getAiReadyDocumentIds(documentBasis.rows),
    [documentBasis.rows]
  );
  const aiReadySources = useMemo(
    () => sources.filter((source) => aiReadyDocumentIds.has(source.document_id)),
    [sources, aiReadyDocumentIds]
  );
  const aiReadySourceById = useMemo(() => new Map(aiReadySources.map((source) => [source.id, source])), [aiReadySources]);
  const workflowImportInProgress =
    isImporting || importQueue.some((item) => ROOM_BLOCKING_IMPORT_STATUSES.has(item.status));
  const documentControlComplete = visibleReviewDocuments.length === 0;
  const hasUsableSources = aiReadySources.length > 0;
  const hasCoverageLimit = caseScopedSourceCoveragePercent < 100 || pendingOcrPages > 0;
  const roomAvailabilitySummary = {
    importInProgress: workflowImportInProgress,
    documentControlComplete,
    sourceCount: aiReadySources.length,
    sourceCoveragePercent: caseScopedSourceCoveragePercent,
    pagesRequiringOcr: pendingOcrPages,
    failedFiles: documentBasis.unreadableDocuments.length,
    unsupportedFiles: importItems.filter((item) => item.status === "unsupported").length
  };
  const roomAvailabilityByView: Partial<Record<ViewKey, RoomAvailability>> = {
    caseRoom: getRoomAvailability("saksrom", roomAvailabilitySummary),
    chronology: getRoomAvailability("chronology", roomAvailabilitySummary),
    evidence: getRoomAvailability("evidence", roomAvailabilitySummary),
    arguments: getRoomAvailability("arguments", roomAvailabilitySummary),
    contradictions: getRoomAvailability("contradictions", roomAvailabilitySummary),
    risk: getRoomAvailability("risk", roomAvailabilitySummary),
    litigationSimulation: getRoomAvailability("simulation", roomAvailabilitySummary),
    draft: getRoomAvailability("draft", roomAvailabilitySummary),
    export: getRoomAvailability("export", roomAvailabilitySummary)
  };
  const canUsePreliminaryAnalysis = Boolean(roomAvailabilityByView.chronology?.enabled);
  const canUseDraftControl = Boolean(roomAvailabilityByView.draft?.enabled);
  const userFacingReadinessVerdict = canUseDraftControl
    ? "ready_for_draft_control"
    : caseReadiness.verdict === "ready_for_draft_control" && !canUseDraftControl
      ? "requires_control"
      : caseReadiness.verdict;
  const ocrCoveragePercent = totalPages > 0 ? Math.round(((totalPages - pendingOcrPages) / totalPages) * 100) : undefined;
  const preliminarySaksromBanner =
    hasDocuments && (caseScopedSourceCoveragePercent < 100 || pendingOcrPages > 0 || importFailures > 0)
      ? `Saksgrunnlaget er ikke komplett ennå. Saksrom kan brukes foreløpig basert på kontrollerte kildeutdrag. ${pendingOcrPages} sider er ikke lesbare ennå.`
      : undefined;
  const importUx = useMemo(
    () =>
      deriveImportUxSummary({
        queue: importQueue,
        nowMs: importNow,
        documentBasis: {
          ...documentBasis,
          needsReviewDocuments: visibleReviewDocuments
        },
        hasDocuments,
        hasActiveProcessing,
        canOpenPreliminary: canUsePreliminaryAnalysis || aiReadySources.length > 0,
        canOpenFinal: canUseDraftControl,
        totalDocuments: importQueue.length || documentBasis.totalCount
      }),
    [
      importQueue,
      importNow,
      documentBasis,
      visibleReviewDocuments,
      hasDocuments,
      hasActiveProcessing,
      canUsePreliminaryAnalysis,
      aiReadySources.length,
      canUseDraftControl
    ]
  );
  const importProgress = useMemo(
    () =>
      summarizeImportProgress({
        items: importQueue,
        nowMs: importNow,
        totalDocuments: importQueue.length || documentBasis.totalCount,
        totalPagesEstimate: totalPages || importQueue.reduce((sum, item) => sum + (item.pagesTotal || item.pages || 0), 0),
        processedPages: analyzedPages || importQueue.reduce((sum, item) => sum + (item.pagesProcessed || 0), 0),
        sourcesCreated: sources.length || importQueue.reduce((sum, item) => sum + (item.sources || 0), 0),
        attentionDocumentsFallback: visibleReviewDocuments.length,
        failedDocumentsFallback: documentBasis.unreadableDocuments.length
      }),
    [importQueue, importNow, documentBasis.totalCount, documentBasis.unreadableDocuments.length, visibleReviewDocuments.length, totalPages, analyzedPages, sources.length]
  );
  const importOutcome = useMemo(
    () =>
      deriveImportOutcome({
        documents,
        importItems,
        documentBasis: {
          ...documentBasis,
          needsReviewDocuments: visibleReviewDocuments
        },
        importHealth,
        importQueue,
        hasActiveProcessing,
        visibleReviewCount: visibleReviewDocuments.length,
        sourcesCreated: sources.length,
        totalPages,
        analyzedPages,
        pendingOcrPages
      }),
    [
      documents,
      importItems,
      documentBasis,
      visibleReviewDocuments,
      importHealth,
      importQueue,
      hasActiveProcessing,
      sources.length,
      totalPages,
      analyzedPages,
      pendingOcrPages
    ]
  );
  const importNextAction = useMemo(() => deriveNextAction(importOutcome), [importOutcome]);
  const importOutcomeGapMessages = useMemo(() => {
    const messages: string[] = [];
    const controlCount = Math.max(importOutcome.manualReviewRequired, importOutcome.ocrRequired);
    if (controlCount > 0) {
      messages.push(
        `${controlCount} ${controlCount === 1 ? "dokument trenger" : "dokumenter trenger"} manuell kontroll før de kan brukes som kildegrunnlag.`
      );
    }
    if (importOutcome.notUsedAsSource > 0) {
      messages.push(
        `${importOutcome.notUsedAsSource} ${importOutcome.notUsedAsSource === 1 ? "dokument ble" : "dokumenter ble"} ikke brukt som kildegrunnlag. Erstatt fil eller hold dem utenfor saken.`
      );
    }
    return messages;
  }, [importOutcome.manualReviewRequired, importOutcome.ocrRequired, importOutcome.notUsedAsSource]);
  const casePreparationProgress = useMemo(
    () =>
      deriveCasePreparationProgress({
        totalDocuments: importProgress.totalDocuments || documentBasis.totalCount,
        processedDocuments: importOutcome.processed || importProgress.processedDocuments,
        readyDocuments: documentBasis.readyCount,
        reviewDocuments: visibleReviewDocuments.length,
        unreadableDocuments: documentBasis.unreadableDocuments.length,
        totalPages,
        processedPages: analyzedPages,
        pendingOcrPages,
        sourceObjects: aiReadySources.length,
        sourceCoveragePercent: documentBasis.sourceCoveragePercent || caseScopedSourceCoveragePercent,
        hasActiveProcessing,
        importProgress,
        nextActionTitle: visibleReviewDocuments.length > 0 ? "Start kontroll" : undefined
      }),
    [
      importProgress,
      importOutcome.processed,
      documentBasis.totalCount,
      documentBasis.readyCount,
      documentBasis.unreadableDocuments.length,
      documentBasis.sourceCoveragePercent,
      visibleReviewDocuments.length,
      totalPages,
      analyzedPages,
      pendingOcrPages,
      aiReadySources.length,
      caseScopedSourceCoveragePercent,
      hasActiveProcessing
    ]
  );
  const importOutcomeView = useMemo(
    () => deriveImportOutcomeViewModel(importOutcome, importNextAction),
    [importOutcome, importNextAction]
  );
  const previewDocumentSources = useMemo(
    () => (previewDocument ? sources.filter((source) => source.document_id === previewDocument.id) : []),
    [previewDocument, sources]
  );
  const isWorkspaceUnlocked = isAuthenticated && onboardingStage === "caseRoom";

  const legacyCoverageRepairNeeded =
    Boolean(selectedCaseId) &&
    totalPages > 1 &&
    (coverageAudit?.source_count ?? sources.length) > 0 &&
    pagesWithSources <= 1 &&
    pagesMissingSources > 0 &&
    !hasActiveProcessing;

  useEffect(() => {
    if (!selectedCaseId || !legacyCoverageRepairNeeded) {
      return;
    }
    if (autoRepairAttemptedRef.current.has(selectedCaseId)) {
      return;
    }

    autoRepairAttemptedRef.current.add(selectedCaseId);
    setReindexStatus("Evida oppdaterer kildegrunnlaget automatisk for denne saken ...");
    reindexCaseDocuments(selectedCaseId)
      .then((report) => {
        setReindexStatus(
          `Kildegrunnlaget er oppdatert: ${report.sources_created} kildeutdrag fordelt p\u00e5 ${report.pages_created} sider.`
        );
        return refresh(selectedCaseId);
      })
      .catch((error) => {
        setReindexStatus(`Automatisk oppdatering stoppet: ${String(error)}`);
      });
  }, [legacyCoverageRepairNeeded, selectedCaseId]);

  useEffect(() => {
    if (!selectedCaseId || !hasActiveProcessing) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh(selectedCaseId);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [hasActiveProcessing, selectedCaseId]);

  const totals = useMemo(() => {
    return {
      cases: cases.length,
      documents: cases.reduce((sum, item) => sum + item.document_count, 0),
      pages: cases.reduce((sum, item) => sum + item.page_count, 0),
      sources: sources.length
    };
  }, [cases, sources.length]);

  const ocrStatus = documents.length
    ? Array.from(new Set(documents.map((document) => document.ocr_status))).join(", ")
    : "ikke startet";

  const coveragePercent = caseScopedSourceCoveragePercent;
  const userCoverageExplanation = hasDocuments
    ? `${coveragePercent} % av sidene kan brukes som kilde ennå. ${
        coveragePercent < 80
          ? "Evida klargjør dokumentgrunnlaget og lager sporbare kilder automatisk."
          : "Dokumentgrunnlaget kan brukes til kildebasert arbeid med kontroll mot originalkildene."
      }`
    : "Importer dokumenter for å se hva Evida trygt kan bruke.";

  const deviations = useMemo(() => {
    const items: string[] = [];
    if (hasDocuments && !hasSources) {
      items.push("Dokument finnes, men ingen sporbare kildeutdrag er bygget.");
    }
    if (needsOcr) {
      items.push("Noen sider venter på automatisk teksthenting.");
    }
    if (hasDocuments && analyzedPages < totalPages) {
      items.push(
        hasActiveProcessing
          ? "Evida jobber fortsatt med å hente ut tekst og lage sporbare kilder fra sidene."
          : "Automatisk teksthenting fra skannede sider er ikke ferdig implementert i denne versjonen."
      );
    }
    return items;
  }, [analyzedPages, hasActiveProcessing, hasDocuments, hasSources, needsOcr, totalPages]);

  async function handleCreateCase() {
    if (isCreatingCase) {
      return;
    }

    setIsCreatingCase(true);
    setCaseCreationError("");
    try {
      const name =
        startCaseNameInputRef.current?.value.trim() ||
        panelCaseNameInputRef.current?.value.trim() ||
        caseName.trim() ||
        temporaryCaseTitle();
      const created = await createCase(name, "NO");
      setCaseName("");
      if (startCaseNameInputRef.current) {
        startCaseNameInputRef.current.value = "";
      }
      if (panelCaseNameInputRef.current) {
        panelCaseNameInputRef.current.value = "";
      }
      await refresh(created.id);
      setOnboardingStage("caseRoom");
      setActiveView("documents");
    } catch (error) {
      setCaseCreationError(`Kunne ikke opprette ny sak. ${String(error)}`);
    } finally {
      setIsCreatingCase(false);
    }
  }

  async function handleNewCaseInNewWindow() {
    if (isCreatingCase) {
      return;
    }

    setIsCreatingCase(true);
    setCaseCreationError("");
    try {
      if (!hasDesktopRuntime()) {
        const created = await createCase(temporaryCaseTitle(), "NO");
        await refresh(created.id);
        setOnboardingStage("caseRoom");
        setActiveView("documents");
        return;
      }
      await openNewCaseWindow();
      await refresh(selectedCaseId);
    } catch (error) {
      setCaseCreationError(`Kunne ikke åpne ny sak i nytt vindu. ${String(error)}`);
    } finally {
      setIsCreatingCase(false);
    }
  }

  async function handleOpenCaseInCurrentWindow(caseId: string) {
    await markCaseOpened(caseId);
    await refresh(caseId);
    setCasePickerOpen(false);
    setOnboardingStage("caseRoom");
    setActiveView("caseRoom");
  }

  async function handleOpenCaseInNewWindow(caseId: string) {
    if (!hasDesktopRuntime()) {
      await handleOpenCaseInCurrentWindow(caseId);
      return;
    }
    await openCaseWindow(caseId);
    setCasePickerOpen(false);
    await refresh(selectedCaseId);
  }

  async function handleRenameCaseFromSwitcher(caseId: string, nextName: string) {
    await renameCase(caseId, nextName);
    await refresh(selectedCaseId || caseId);
  }

  function handleCloseCase() {
    setSelectedCaseId("");
    windowCase.clearCase();
    setActiveView("caseRoom");
  }

  const buildChronology = useCallback(async () => {
    if (!canUsePreliminaryAnalysis || aiReadySources.length === 0 || visibleReviewDocuments.length > 0) {
      setReindexStatus(
        visibleReviewDocuments.length > 0
          ? "Manuell kontroll mangler. Kontroller dokumentene før AI bygger kronologi."
          : `${caseReadiness.title}. ${caseReadiness.reason}`
      );
      setActiveView("control");
      return;
    }
    const items = await buildChronologyApi(selectedCaseId);
    setTimelineItems(items.map((item) => ({
      id: item.id,
      date: item.date_text,
      event: item.event,
      sourceId: item.source_id,
      status: item.status,
      uncertainty: item.uncertainty
    })));
    setActiveView("chronology");
  }, [aiReadySources.length, canUsePreliminaryAnalysis, caseReadiness.reason, caseReadiness.title, visibleReviewDocuments.length, selectedCaseId]);

  const buildEvidence = useCallback(async () => {
    if (!canUsePreliminaryAnalysis || aiReadySources.length === 0 || visibleReviewDocuments.length > 0) {
      setReindexStatus(
        visibleReviewDocuments.length > 0
          ? "Manuell kontroll mangler. Kontroller dokumentene før AI bygger bevismatrise."
          : `${caseReadiness.title}. ${caseReadiness.reason}`
      );
      setActiveView("control");
      return;
    }
    const items = await buildEvidenceMatrix(selectedCaseId);
    setEvidenceRows(items.map((item) => ({
      id: item.id,
      claim: item.claim,
      supporting: item.supporting_source_ids,
      weakening: item.weakening_source_ids,
      strength: item.strength,
      status: item.status
    })));
    setActiveView("evidence");
  }, [aiReadySources.length, canUsePreliminaryAnalysis, caseReadiness.reason, caseReadiness.title, visibleReviewDocuments.length, selectedCaseId]);

  async function buildArguments() {
    if (!canUsePreliminaryAnalysis || aiReadySources.length === 0 || visibleReviewDocuments.length > 0) {
      setReindexStatus(
        visibleReviewDocuments.length > 0
          ? "Manuell kontroll mangler. Kontroller dokumentene før AI bygger anførsler."
          : `${caseReadiness.title}. ${caseReadiness.reason}`
      );
      setActiveView("control");
      return;
    }
    const items = await createArgumentItem(selectedCaseId);
    setArgumentRows(items.map((item) => ({
      id: item.id,
      argument: item.argument,
      factualBasis: item.factual_basis,
      legalBasis: item.legal_basis,
      evidenceIds: item.evidence_source_ids,
      status: item.status
    })));
    setActiveView("arguments");
  }

  async function buildContradictions() {
    if (!canUsePreliminaryAnalysis || aiReadySources.length < 2 || visibleReviewDocuments.length > 0) {
      setReindexStatus(
        visibleReviewDocuments.length > 0
          ? "Manuell kontroll mangler. Kontroller dokumentene før AI bygger motstridsanalyse."
          : !canUsePreliminaryAnalysis
          ? `${caseReadiness.title}. ${caseReadiness.reason}`
          : "Motstridsanalyse trenger minst to godkjente, sporbare kilder."
      );
      setActiveView("control");
      return;
    }
    const items = await findContradictionsApi(selectedCaseId);
    setConflictRows(items.map((item) => ({
      id: item.id,
      topic: item.topic,
      sourceA: item.source_a_id,
      sourceB: item.source_b_id,
      conflict: item.conflict,
      significance: item.significance,
      status: item.status
    })));
    setActiveView("contradictions");
  }

  async function buildRisk() {
    if (!canUsePreliminaryAnalysis || aiReadySources.length === 0 || visibleReviewDocuments.length > 0) {
      setReindexStatus(
        visibleReviewDocuments.length > 0
          ? "Manuell kontroll mangler. Kontroller dokumentene før AI bygger risikovurdering."
          : `${caseReadiness.title}. ${caseReadiness.reason}`
      );
      setActiveView("control");
      return;
    }
    const items = await assessRiskApi(selectedCaseId);
    setRiskRows(items.map((item) => ({
      id: item.id,
      risk: item.risk,
      severity: item.severity,
      affectedArguments: item.affected_arguments,
      sourceBasis: item.source_basis,
      recommendedAction: item.recommended_action
    })));
    setActiveView("risk");
  }

  async function executeLegalCommandInput(input: string): Promise<string> {
    const resolution = resolveLegalCommand(input);
    if (!resolution.isCommand) {
      return "Skriv en kommando som starter med apostrof, for eksempel 'kronologi eller 'bevis.";
    }
    if (!resolution.command) {
      return "Jeg kjenner ikke den kommandoen ennå. V1 støtter 'kronologi, 'bevis, 'risiko og 'kvalitet.";
    }

    return executeLegalCommand(resolution.command);
  }

  async function executeLegalCommand(command: LegalCommand): Promise<string> {
    const gate = gateLegalCommand(command, caseReadiness.verdict, caseReadiness.sourceCoveragePercent, aiReadySources.length);
    if (!gate.allowed) {
      setActiveView("control");
      return `${command.label} er låst. ${gate.reason} ${caseReadiness.reason}`;
    }

    switch (command.id) {
      case "chronology":
        await buildChronology();
        return "Kronologi er bygget fra sporbare kilder.";
      case "evidence":
        await buildEvidence();
        return "Bevismatrisen er bygget fra sporbare kilder.";
      case "risk":
        await buildRisk();
        return "Risikovurderingen er kjørt fra kildegrunnlaget.";
      case "quality":
        setActiveView("control");
        return "Kontrollgrunnlag er åpnet med readiness, kildecoverage og avvik.";
    }
  }

  async function runCommandPalette() {
    const response = await executeLegalCommandInput(commandInput);
    setCommandStatus(response);
    setCommandInput("");
  }
  const nextAction = useMemo(() => {
    if (!selectedCase) {
      return {
        step: 1,
        stepTotal: 6,
        title: "Opprett første sak",
        description: "Start med en lokal evalueringssak før dokumenter importeres.",
        why: "Saken samler dokumenter, audit trail og senere AI-forslag i ett lokalt arbeidsrom.",
        actionLabel: "Opprett sak",
        onAction: handleCreateCase,
        secondaryLabel: "Avansert arbeidsrom",
        onSecondaryAction: () => setActiveView("documents")
      };
    }
    if (!hasDocuments) {
      return {
        step: 2,
        stepTotal: 6,
        title: "Importer dokument",
        description: "Legg inn PDF, tekstfil eller bilde i valgt sak.",
        why: "Første verdi kommer når appen kan lese dokumentet og lage sporbare kildeutdrag.",
        actionLabel: "Gå til import",
        onAction: () => setActiveView("documents"),
        secondaryLabel: "Vis kontroll",
        onSecondaryAction: () => setActiveView("control")
      };
    }
    if (
      importNextAction.id === "wait_for_import" ||
      importNextAction.id === "control_documents" ||
      importNextAction.id === "review_import_failure" ||
      importNextAction.id === "open_saksrom_limited"
    ) {
      return {
        step: 3,
        stepTotal: 6,
        title: importNextAction.title,
        description: importNextAction.description,
        why:
          importNextAction.id === "wait_for_import"
            ? "Import som fortsatt kjører kan ikke brukes som endelig konklusjon."
            : "Evida må vite hva som kan brukes som kildegrunnlag før saken behandles videre.",
        actionLabel: importNextAction.primaryLabel,
        onAction: handleImportNextAction,
        secondaryLabel: importNextAction.secondaryLabel,
        onSecondaryAction: importNextAction.secondaryLabel
          ? importNextAction.secondaryLabel.includes("OCR")
            ? () => void handleReindex()
            : () => setActiveView("control")
          : undefined
      };
    }
    if (documentControlComplete && hasUsableSources && hasCoverageLimit && activeView !== "caseRoom") {
      return {
        step: 3,
        stepTotal: 6,
        title: "Analyse-rom: Foreløpig åpnet",
        description: `Dokumentkontroll er fullført. Saksrom kan brukes med ${Math.round(caseScopedSourceCoveragePercent)} % kildedekning.`,
        why: pendingOcrPages > 0
          ? `${pendingOcrPages} sider mangler tekst/OCR. Det gir forbehold, men låser ikke arbeidsflyten.`
          : "Kildedekningen er ikke 100 %, så videre arbeid merkes foreløpig.",
        actionLabel: "Gå til Saksrom foreløpig",
        onAction: () => setActiveView("caseRoom"),
        secondaryLabel: pendingOcrPages > 0 ? "Kjør OCR for full dekning" : "Se kontrollgrunnlag",
        onSecondaryAction: pendingOcrPages > 0 ? () => void handleReindex() : () => setActiveView("control")
      };
    }
    if (caseReadiness.verdict === "not_ready") {
      return {
        step: 3,
        stepTotal: 6,
        title: caseReadiness.title,
        description: caseReadiness.reason,
        why: "Saksrom og juridiske arbeidsflater låses til nok sider kan spores tilbake til kilder.",
        actionLabel: caseReadiness.primaryAction,
        onAction: () => setActiveView("control")
      };
    }
    if (caseReadiness.verdict === "requires_control" && activeView !== "caseRoom") {
      return {
        step: 3,
        stepTotal: 6,
        title: "Grunnlaget krever kontroll",
        description: "Foreløpig Saksrom kan åpnes, men juridiske arbeidsflater og utkast er låst.",
        why: "Dekningen er lav eller ufullstendig. Bruk dette bare til orientering.",
        actionLabel: "Se hva som mangler",
        onAction: () => setActiveView("control"),
        secondaryLabel: coveragePercent >= 50 ? "Åpne foreløpig Saksrom" : undefined,
        onSecondaryAction: coveragePercent >= 50 ? () => setActiveView("caseRoom") : undefined
      };
    }
    if (activeView !== "caseRoom") {
      return {
        step: 3,
        stepTotal: 6,
        title: "Åpne Saksrom",
        description: "Se sammendrag, dokumentstatus, mulige temaer og spør saken før du går videre.",
        why: "Saksrom gir første samlede verdi etter import uten at du må lese råkildene selv.",
        actionLabel: "Åpne Saksrom",
        onAction: () => setActiveView("caseRoom"),
        secondaryLabel: "Gå til kontroll",
        onSecondaryAction: () => setActiveView("control")
      };
    }
    if (!canUsePreliminaryAnalysis) {
      return {
        step: 3,
        stepTotal: 6,
        title: "Sjekk hva AI trygt kan bruke",
        description: "Se hvilke sider som kan brukes som kilde før analyse.",
        why: "Vi må vite hvilke sider som kan spores tilbake til originaldokumentet før kronologi eller utkast bygges.",
        actionLabel: "Åpne kontroll",
        onAction: () => setActiveView("control"),
        secondaryLabel: "Importer mer",
        onSecondaryAction: () => setActiveView("documents")
      };
    }
    if (timelineItems.length === 0) {
      return {
        step: 4,
        stepTotal: 6,
        title: "Bygg kronologi",
        description: "Lag tidslinjeobjekter fra kildegrunnlaget.",
        why: "Kronologi gir første skannbare oversikt over hva som faktisk skjer i saken.",
        actionLabel: "Bygg kronologi",
        onAction: buildChronology,
        secondaryLabel: "Se kontroll",
        onSecondaryAction: () => setActiveView("control")
      };
    }
    if (evidenceRows.length === 0) {
      return {
        step: 5,
        stepTotal: 6,
        title: "Bygg bevismatrise",
        description: "Koble påstander til støttende og svekkende kilder.",
        why: "Bevismatrisen gjør kildegrunnlaget vurderbart før videre saksarbeid.",
        actionLabel: "Bygg bevismatrise",
        onAction: buildEvidence,
        secondaryLabel: "Se kronologi",
        onSecondaryAction: () => setActiveView("chronology")
      };
    }
    if (!canUseDraftControl) {
      return {
        step: 6,
        stepTotal: 6,
        title: "Kontroller før utkast",
        description: "Utkast låses til dokumentgrunnlaget har høy dekning.",
        why: "Foreløpig analyse kan brukes, men utkast krever strengere kildekontroll.",
        actionLabel: "Se kontrollgrunnlag",
        onAction: () => setActiveView("control"),
        secondaryLabel: "Se bevis",
        onSecondaryAction: () => setActiveView("evidence")
      };
    }
    return {
      step: 6,
      stepTotal: 6,
      title: "Start saksarbeid",
      description: "Grunnflyten er klar for utkast, anførsler og kontroll.",
      why: "AI-forslag er fortsatt draft og skal godkjennes av deg før bruk.",
      actionLabel: "Åpne utkast",
      onAction: () => setActiveView("draft"),
      secondaryLabel: "Se bevis",
      onSecondaryAction: () => setActiveView("evidence")
    };
  }, [
    selectedCase,
    hasDocuments,
    importNextAction,
    caseReadiness,
    documentControlComplete,
    hasUsableSources,
    hasCoverageLimit,
    pendingOcrPages,
    caseScopedSourceCoveragePercent,
    canUseDraftControl,
    canUsePreliminaryAnalysis,
    coveragePercent,
    activeView,
    timelineItems.length,
    evidenceRows.length,
    buildChronology,
    buildEvidence
  ]);

  const caseVitality = {
    sourceCoveragePct: hasDocuments ? caseScopedSourceCoveragePercent : undefined,
    ocrCoveragePct: ocrCoveragePercent,
    indexedDocumentCount: hasDocuments ? caseCoverage.processedDocuments : undefined,
    totalDocumentCount: hasDocuments ? caseCoverage.totalDocuments : undefined,
    controlStatus: !hasDocuments ? "Venter" : visibleReviewDocuments.length === 0 ? "Fullført" : `${visibleReviewDocuments.length} igjen`,
    ocrStatus: !hasDocuments ? "Venter" : pendingOcrPages > 0 ? `${pendingOcrPages} sider gjenstår` : "Fullført",
    analysisRoomStatus: !hasDocuments
      ? "Venter"
      : roomAvailabilityByView.caseRoom?.enabled
        ? roomAvailabilityByView.caseRoom.mode === "preliminary"
          ? "Foreløpig åpnet"
          : "Klar"
        : roomAvailabilityByView.caseRoom?.label || "Venter",
    unresolvedConflictCount: conflictRows.length,
    riskLevel: selectedCase?.risk_level || "unknown",
    nextBestAction: nextAction.title
  };

  const importDocuments = useCallback(
    async (paths: string[]) => {
      const rawPaths = paths.map((path) => path.trim()).filter(Boolean);
      const cleanPaths = await expandImportPaths(rawPaths);
      if (cleanPaths.length === 0) {
        if (rawPaths.length > 0) {
          setImportError("Fant ingen støttede dokumenter i valget. Støttede filtyper er PDF, DOCX, TXT, MD, PNG, JPG og TIFF.");
        }
        return;
      }

      setImportError("");
      setIsImporting(true);
      setOnboardingStage("caseRoom");
      setActiveView("caseRoom");
      const importStartedAt = Date.now();
      setImportNow(importStartedAt);
      setImportQueue(
        cleanPaths.map((path) => ({
          path,
          name: fileNameFromPath(path),
          status: "queued",
          detail: processingStageLabel("queued"),
          startedAt: importStartedAt,
          statusUpdatedAt: importStartedAt
        }))
      );
      const updateQueueItem = (path: string, patch: Partial<ImportQueueItem>) => {
        const timestamp = Date.now();
        setImportQueue((current) =>
          current.map((item) => (item.path === path ? { ...item, ...patch, statusUpdatedAt: timestamp } : item))
        );
      };
      setProcessingLog([
        "Validerer filer",
        "Sikrer dokumentreferanse",
        "Registrerer dokumenter i lokal database"
      ]);
      try {
        let activeCaseId = selectedCaseId;
        if (!activeCaseId) {
          const created = await createCase(temporaryCaseTitle(), "NO");
          activeCaseId = created.id;
          setSelectedCaseId(created.id);
          setCases((current) => [created, ...current.filter((item) => item.id !== created.id)]);
          setProcessingLog((current) => [...current, "Opprettet midlertidig saksprosjekt automatisk"]);
        }

        const session = await startImportSession(activeCaseId, cleanPaths.length);
        const reports = [];
        for (const path of cleanPaths) {
          const name = fileNameFromPath(path);
          updateQueueItem(path, { status: "reading_file", detail: processingStageLabel("reading_file") });
          setProcessingLog((current) => [...current, `Sjekker ${name}`]);
          await nextUiTick();
          updateQueueItem(path, { status: "counting_pages", detail: processingStageLabel("counting_pages") });
          setProcessingLog((current) => [...current, `Sikrer dokumentreferanse for ${name}`]);
          updateQueueItem(path, { status: "extracting_text", detail: processingStageLabel("extracting_text") });
          await nextUiTick();
          const item = await registerDocumentInSession(session.id, activeCaseId, path);
          const report = {
            pages_created: item.page_count,
            sources_created: item.source_count,
            pages_with_text: item.pages_with_text,
            status: item.status,
            user_message: item.user_message,
            issue_code: item.issue_code,
            recommended_action: item.recommended_action,
            technical_message: item.technical_message,
            can_retry: item.can_retry,
            can_continue: item.can_continue
          };
          updateQueueItem(path, {
            status: report.sources_created > 0 ? "finding_source_points" : report.status,
            detail: report.sources_created > 0 ? processingStageLabel("finding_source_points") : report.user_message,
            pages: report.pages_created,
            sources: report.sources_created,
            issueCode: report.issue_code || undefined,
            userMessage: report.user_message,
            recommendedAction: report.recommended_action,
            technicalMessage: report.technical_message || undefined,
            canRetry: report.can_retry,
            canContinue: report.can_continue
          });
          await nextUiTick();
          updateQueueItem(path, { status: "building_case_basis", detail: processingStageLabel("building_case_basis") });
          await nextUiTick();
          updateQueueItem(path, { status: "checking_coverage", detail: processingStageLabel("checking_coverage") });
          await nextUiTick();
          reports.push(report);
          updateQueueItem(path, {
            status: report.status === "ready" ? "completed" : report.status,
            detail: report.user_message,
            pages: report.pages_created,
            sources: report.sources_created,
            issueCode: report.issue_code || undefined,
            userMessage: report.user_message,
            recommendedAction: report.recommended_action,
            technicalMessage: report.technical_message || undefined,
            canRetry: report.can_retry,
            canContinue: report.can_continue
          });
        }
        const completedSession = await completeImportSession(session.id);
        setDocumentPath("");
        const pageCount = reports.reduce((sum, report) => sum + report.pages_created, 0);
        const sourceCount = reports.reduce((sum, report) => sum + report.sources_created, 0);
        const estimatedCoverage = calculateSourceCoveragePercent({
          totalPages: pageCount,
          pagesWithSources: reports.reduce((sum, report) => sum + report.pages_with_text, 0)
        });
        setLastImport(
          `${countLabel(reports.length, "dokument", "dokumenter")} importert: ${countLabel(
            pageCount,
            "side",
            "sider"
          )}, ${countLabel(sourceCount, "kildeutdrag", "kildeutdrag")}`
        );
        await refresh(activeCaseId);
        const nextHealth = await getImportHealth(activeCaseId);
        setImportHealth(nextHealth);
        setImportItems(nextHealth.items);
        setShowImportCompletion(true);
        setProcessingLog((current) => [
          ...current,
          completedSession.source_coverage_percent >= 100 && nextHealth.overall_status === "ready"
            ? "Saksrom kan åpnes. Foreløpig analyse fortsetter i bakgrunnen."
            : "Dokumentene må kontrolleres før analyse"
        ]);
        setOnboardingStage("caseRoom");
        setActiveView("caseRoom");
        if (estimatedCoverage >= 80 && sourceCount > 0) {
          void runAutomaticAnalysis(activeCaseId, sourceCount, Math.min(estimatedCoverage, nextHealth.source_coverage_percent))
            .then(() => refresh(activeCaseId))
            .catch((error) => {
              setReindexStatus(`Automatisk analyse stoppet: ${String(error)}`);
            });
        }
      } catch (error) {
        setImportError(`Import feilet: ${String(error)}`);
        setImportQueue((current) =>
          current.map((item) =>
            ["completed", "failed", "partial", "ocr_required", "unsupported", "duplicate"].includes(item.status)
              ? item
              : { ...item, status: "failed", detail: String(error) }
          )
        );
        setProcessingLog((current) => [...current, "Import feilet"]);
      } finally {
        setIsImporting(false);
      }
    },
    [selectedCaseId]
  );

  useEffect(() => {
    if (!hasDesktopRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listen<{ paths?: string[] } | string[]>("tauri://drag-drop", (event) => {
      const payload = event.payload;
      const paths = Array.isArray(payload) ? payload : payload.paths || [];
      if (paths.length > 0) {
        void importDocuments(paths);
      }
    })
      .then((nextUnlisten) => {
        if (cancelled) {
          nextUnlisten();
        } else {
          unlisten = nextUnlisten;
        }
      })
      .catch((error) => setImportError(`Drag/drop kunne ikke startes: ${String(error)}`));

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [importDocuments]);

  useEffect(() => {
    if (!hasDesktopRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    getCurrentWindow()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setIsDragActive(true);
        }
        if (payload.type === "leave") {
          setIsDragActive(false);
        }
        if (payload.type === "drop") {
          setIsDragActive(false);
          void importDocuments(payload.paths);
        }
      })
      .then((nextUnlisten) => {
        if (cancelled) {
          nextUnlisten();
        } else {
          unlisten = nextUnlisten;
        }
      })
      .catch((error) => setImportError(`Drag-and-drop kunne ikke startes: ${String(error)}`));

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [importDocuments]);

  useEffect(() => {
    if (!isImporting) {
      return;
    }

    const timer = window.setInterval(() => setImportNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isImporting]);

  useEffect(() => {
    setLocalControlDecisions({});
    setApprovalSavingId("");
    setApprovalSuccessId("");
    setApprovalToast("");
    setSelectedControlDocumentId("");
    setControlSelectionIds([]);
    setBulkConfirmAction("");
    setBulkConfirmChecked(false);
  }, [selectedCaseId]);

  useEffect(() => {
    if (visibleReviewDocuments.length === 0) {
      setSelectedControlDocumentId("");
      return;
    }
    if (!selectedControlDocumentId || !visibleReviewDocuments.some((row) => row.id === selectedControlDocumentId)) {
      setSelectedControlDocumentId(visibleReviewDocuments[0].id);
    }
    setControlSelectionIds((current) => {
      const next = current.filter((id) => visibleReviewDocuments.some((row) => row.id === id));
      return next.length === current.length ? current : next;
    });
  }, [selectedControlDocumentId, visibleReviewDocuments]);

  useEffect(() => {
    if (activeView !== "control" || !controlAttentionExpanded) {
      return;
    }

    const focusTarget = () => {
      document.getElementById("documents-needing-control")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      document.getElementById("documents-needing-control-title")?.focus();
      setControlAttentionHighlighted(true);
      window.setTimeout(() => setControlAttentionHighlighted(false), 1400);
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(focusTarget);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, controlAttentionExpanded, visibleReviewDocuments.length]);

  useEffect(() => {
    if (!approvalToast) {
      return;
    }
    const timer = window.setTimeout(() => setApprovalToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [approvalToast]);

  useEffect(() => {
    if (!hasDesktopRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    listen<DocumentProcessingProgressEvent>("document-processing-progress", (event) => {
      const payload = event.payload;
      if (selectedCaseId && payload.caseId !== selectedCaseId) {
        return;
      }

      setImportNow(Date.now());
      setImportQueue((current) =>
        current.map((item) => {
          if (item.path !== payload.path) {
            return item;
          }

          return {
            ...item,
            name: payload.fileName || item.name,
            status: payload.stage,
            detail: payload.message || processingStageLabel(payload.stage),
            pages: payload.pagesTotal ?? item.pages,
            pagesProcessed: payload.pagesProcessed ?? item.pagesProcessed,
            pagesTotal: payload.pagesTotal ?? item.pagesTotal,
            sources: payload.sourcesCreated ?? item.sources,
            statusUpdatedAt: Date.now()
          };
        })
      );
    })
      .then((nextUnlisten) => {
        if (cancelled) {
          nextUnlisten();
        } else {
          unlisten = nextUnlisten;
        }
      })
      .catch((error) => setImportError(`Dokumentstatus kunne ikke startes: ${String(error)}`));

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [selectedCaseId]);

  async function handleChooseFiles() {
    const paths = await chooseDocumentPaths();
    if (paths.length === 0 && !hasDesktopRuntime()) {
      fileInputRef.current?.click();
      return;
    }
    await importDocuments(paths);
  }

  async function handleChooseFolder() {
    const paths = await chooseDocumentFolderPaths();
    if (paths.length === 0) {
      if (!hasDesktopRuntime()) {
        setImportError("Mappeimport krever desktop-appen. Bruk Velg filer i nettlesermodus.");
      }
      return;
    }
    await importDocuments(paths);
  }

  function handleIntroComplete() {
    setIsAuthenticated(true);
    setOnboardingStage("import");
    setActiveView(initialWorkspaceView());
  }

  function handleBrowserFileSelection(files: FileList | null) {
    const paths = Array.from(files || [])
      .map((file) => (file as File & { path?: string }).path || "")
      .filter(Boolean);
    if (paths.length > 0) {
      void importDocuments(paths);
      return;
    }
    setImportError("Nettlesermodus kan ikke lese lokal filsti. \u00c5pne desktop-appen for lokal filimport, eller bruk den bygde Evida-appen.");
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path || "")
      .filter(Boolean);
    if (paths.length > 0) {
      void importDocuments(paths);
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDropZoneClick() {
    if (isImporting) {
      return;
    }
    void handleChooseFiles();
  }

  function handleDropZoneKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    handleDropZoneClick();
  }

  async function handleSelectCase(caseId: string) {
    await refresh(caseId);
    if (onboardingStage !== "caseRoom") {
      setOnboardingStage("import");
      setActiveView("documents");
    }
  }

  async function handleRenameCase(nextName: string) {
    if (!selectedCaseId) {
      return;
    }
    await renameCase(selectedCaseId, nextName);
    await refresh(selectedCaseId);
  }

  async function handleReindex() {
    if (!selectedCaseId) {
      setReindexStatus("Velg sak før du bygger kilder på nytt.");
      return;
    }
    setReindexStatus("Bygger kilder på nytt ...");
    const report = await reindexCaseDocuments(selectedCaseId);
    setReindexStatus(
      `Reindeksert ${countLabel(report.documents_processed, "dokument", "dokumenter")}: ${countLabel(
        report.pages_created,
        "side",
        "sider"
      )}, ${countLabel(report.sources_created, "kildeutdrag", "kildeutdrag")}, ${countLabel(
        report.warnings.length,
        "varsel",
        "varsler"
      )}`
    );
    await refresh(selectedCaseId);
  }

  async function runAutomaticAnalysis(caseId: string, importedSourceCount: number, importedCoveragePercent: number) {
    if (importedSourceCount <= 0 || importedCoveragePercent < 80) {
      setProcessingLog((current) => [
        ...current,
        importedSourceCount <= 0
          ? "Dokumentet er ikke ferdig lest ennå"
          : "Dekningen er for lav for automatisk analyse"
      ]);
      setReindexStatus(
        importedSourceCount <= 0
          ? "Dokumentet er importert, men Evida fant ikke nok lesbar tekst til sporbare kilder."
          : "Dokumentet er importert, men kildegrunnlaget krever kontroll før automatisk analyse."
      );
      return;
    }
    setProcessingLog((current) => [
      ...current,
      "Bygger foreløpig saksoversikt",
      "Bygger foreløpig kronologi",
      "Bygger foreløpig bevismatrise",
      "Kjører foreløpig risikovurdering"
    ]);
    setReindexStatus("Automatisk analyse kjører: kronologi, bevismatrise og risiko ...");
    await Promise.allSettled([
      buildChronologyApi(caseId),
      buildEvidenceMatrix(caseId),
      assessRiskApi(caseId)
    ]);
    setReindexStatus("Foreløpig analyse er klar i Saksrom.");
  }

  async function confirmDeleteCase() {
    if (!deleteTarget) {
      return;
    }
    await softDeleteCase(deleteTarget.id);
    setDeleteTarget(null);
    await refresh(deleteTarget.id === selectedCaseId ? "" : selectedCaseId);
  }

  async function confirmResetTestData() {
    const report = await resetTestData();
    setResetConfirmOpen(false);
    setMaintenanceStatus(report.message);
    await refresh("");
  }

  async function handleOpenDataFolder() {
    const report = await openLocalDataFolder();
    setMaintenanceStatus(report.path ? `${report.message} ${report.path}` : report.message);
  }

  async function handleExportDiagnostics() {
    const report = await exportDiagnostics();
    setMaintenanceStatus(report.path ? `${report.message} ${report.path}` : report.message);
  }

  function openSource(sourceId: string) {
    setActiveSource(sourceById.get(sourceId));
  }

  function generateDraft() {
    if (!canUseDraftControl) {
      setDraftText(`${caseReadiness.title}. ${caseReadiness.blockedUse}`);
      setActiveView("control");
      return;
    }
    const draftAvailability = roomAvailabilityByView.draft;
    const draftStatus = draftAvailability?.mode === "preliminary" ? "Foreløpig draft" : "Draft";
    setDraftText(
      [
        `Utkast for ${selectedCase?.name || "valgt sak"}`,
        "",
        `Status: ${draftStatus}`,
        "Evaluation build: lokalt arbeidsutkast, ikke produksjonsleveranse.",
        draftAvailability?.warning ? `Forbehold: ${draftAvailability.warning}` : "",
        "",
        "Foreløpig bevisgrunnlag:",
        ...sources.slice(0, 6).map((source) => `- [${source.id}] side ${source.page_start}: ${firstSentence(source.text_excerpt)}`)
      ].filter(Boolean).join("\n")
    );
  }

  function generateExport() {
    const exportAvailability = roomAvailabilityByView.export;
    if (!exportAvailability?.enabled) {
      setExportText(`${exportAvailability?.reason || caseReadiness.blockedUse}`);
      setActiveView("control");
      return;
    }
    if (exportAvailability.requiresAcknowledgement && !exportPreliminaryAcknowledged) {
      setExportText(EXPORT_PRELIMINARY_ACKNOWLEDGEMENT);
      return;
    }
    setExportText(
      JSON.stringify(
        {
          evaluation_build: true,
          export_mode: exportAvailability.mode === "preliminary" ? "preliminary" : "final_ready",
          preliminary_warning: exportAvailability.warning,
          local_processing: true,
          case: selectedCase,
          import_status: {
            pdf_pages: totalPages,
            analyzed_pages: analyzedPages,
            source_objects: sources.length,
            ocr_status: ocrStatus
          },
          workflow: {
            chronology_items: timelineItems.length,
            evidence_rows: evidenceRows.length,
            arguments: argumentRows.length,
            conflicts: conflictRows.length,
            risks: riskRows.length
          },
          audit_count: audit.length,
          exported_at: new Date().toISOString()
        },
        null,
        2
      )
    );
  }

  function GuidedFlow() {
    const steps = [
      { label: "Opprett sak", done: Boolean(selectedCase), active: !selectedCase, action: () => setActiveView("overview") },
      { label: "Importer dokument", done: hasDocuments, active: Boolean(selectedCase) && !hasDocuments, action: () => setActiveView("documents") },
      { label: "Sjekk hva Evida trygt kan bruke", done: canUsePreliminaryAnalysis, active: hasDocuments && !canUsePreliminaryAnalysis, action: () => setActiveView("control") },
      { label: "Bygg kronologi", done: timelineItems.length > 0, active: canUsePreliminaryAnalysis && timelineItems.length === 0, action: buildChronology },
      { label: "Bygg bevismatrise", done: evidenceRows.length > 0, active: timelineItems.length > 0 && evidenceRows.length === 0, action: buildEvidence },
      { label: "Start saksarbeid", done: canUseDraftControl, active: canUseDraftControl, action: () => setActiveView("draft") }
    ];

    return (
      <section className="guided-flow">
        {steps.map((step, index) => (
          <button
            key={step.label}
            className={`flow-step ${step.done ? "flow-step--done" : ""} ${step.active ? "flow-step--active" : ""}`}
            onClick={step.action}
          >
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
            <small>{step.done ? "Fullf\u00f8rt" : step.active ? "Neste steg" : "Venter"}</small>
          </button>
        ))}
      </section>
    );
  }

  function FirstValueOnboarding() {
    const steps = [
      {
        label: "Opprett sak",
        done: Boolean(selectedCase),
        active: !selectedCase,
        reason: "Dette lager et lokalt arbeidsrom med audit trail.",
        actionLabel: "Opprett sak",
        action: handleCreateCase
      },
      {
        label: "Importer dokument",
        done: hasDocuments,
        active: Boolean(selectedCase) && !hasDocuments,
        reason: "Dokumentet er grunnlaget for alle sporbare forslag.",
        actionLabel: "Importer dokument",
        action: () => setActiveView("documents")
      },
      {
        label: "Sjekk hva Evida trygt kan bruke",
        done: canUsePreliminaryAnalysis,
        active: hasDocuments && !canUsePreliminaryAnalysis,
        reason: "Vi viser hvilke sider som kan spores tilbake til originaldokumentet.",
        actionLabel: "Sjekk grunnlag",
        action: () => setActiveView("control")
      },
      {
        label: "Bygg kronologi",
        done: timelineItems.length > 0,
        active: canUsePreliminaryAnalysis && timelineItems.length === 0,
        reason: "F\u00f8rste nytte er en tidslinje med kildehenvisning.",
        actionLabel: "Bygg kronologi",
        action: buildChronology
      },
      {
        label: "Bygg bevismatrise",
        done: evidenceRows.length > 0,
        active: timelineItems.length > 0 && evidenceRows.length === 0,
        reason: "P\u00e5stander kobles til st\u00f8ttende og svekkende kildeutdrag.",
        actionLabel: "Bygg bevismatrise",
        action: buildEvidence
      },
      {
        label: "Start saksarbeid",
        done: canUseDraftControl,
        active: canUseDraftControl,
        reason: "Utkast åpnes først når dokumentgrunnlaget har høy dekning.",
        actionLabel: "\u00c5pne utkast",
        action: () => setActiveView("draft")
      }
    ];
    const currentStep = steps.find((step) => step.active) || steps[steps.length - 1];

    return (
      <section className="panel onboarding-panel">
        <div className="onboarding-hero">
          <div>
            <div className="eyebrow">F\u00f8rste verdi</div>
            <h2>{currentStep.label}</h2>
            <p>{currentStep.reason}</p>
            <p className="trust-copy">AI foresl\u00e5r. Du godkjenner. Alt skal kunne spores til et kildeutdrag.</p>
          </div>
          <button className="button-primary primary-action" onClick={currentStep.action}>
            {currentStep.actionLabel}
          </button>
        </div>
        <div className="onboarding-steps">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className={`onboarding-step ${step.done ? "onboarding-step--done" : ""} ${step.active ? "onboarding-step--active" : ""}`}
            >
              <span>{step.done ? "\u2713" : index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.done ? "Fullf\u00f8rt" : step.active ? "Neste handling" : "Kommer senere"}</small>
              </div>
            </div>
          ))}
        </div>
        <button className="button-ghost secondary-link" onClick={() => setActiveView("documents")}>
          \u00c5pne fullt arbeidsrom
        </button>
      </section>
    );
  }

  function DocumentReadinessPanel({ compact = false }: { compact?: boolean }) {
    if (!hasDocuments) {
      return null;
    }

    const coverageText =
      caseCoverage.totalPages > 0
        ? `${coverageLabel(caseReadiness.sourceCoveragePercent, caseCoverage.pagesWithSources)} av sidene kan brukes som kilde ennå`
        : "Dekning beregnes";
    const pageText =
      caseCoverage.totalPages > 0
        ? `${caseCoverage.processedPages} av ${caseCoverage.totalPages} sider kontrollert`
        : "Beregner antall sider";
    const recoveryCount = caseCoverage.failedDocuments + importFailures;
    const showTechnicalDetailsAction =
      !automaticTextRecognitionAvailable &&
      pendingOcrPages > 0 &&
      caseReadiness.sourceCoveragePercent < 50 &&
      recoveryCount === 0;
    const readinessActionTitle =
      caseCoverage.hasActiveProcessing
        ? "Vent til automatisk behandling er ferdig"
        : recoveryCount > 0
          ? "Kontroller dokumentene som stoppet"
          : caseReadiness.primaryAction;
    const readinessActionDescription =
      caseCoverage.hasActiveProcessing
        ? "Du kan fortsette å lese saken, men ikke konkluder før importstatusen er ferdig."
        : recoveryCount > 0
          ? "Se nøyaktig hvilke filer som feilet, og velg om de skal erstattes, fjernes eller holdes utenfor."
          : caseReadiness.allowedUse;
    const primaryLabel =
      !caseCoverage.hasActiveProcessing && recoveryCount > 0
        ? attentionDetailsOpen
          ? "Skjul dokumenter som ikke kunne behandles"
          : "Se hva som mangler"
        : caseReadiness.primaryAction;
    const handlePrimaryAction = () => {
      if (!caseCoverage.hasActiveProcessing && recoveryCount > 0) {
        setActiveView("control");
        return;
      }
      setActiveView("control");
    };

    return (
      <section
        className={`panel document-readiness-panel document-readiness-panel--${caseReadiness.severity} ${compact ? "document-readiness-panel--compact" : ""}`}
        aria-live="polite"
      >
        <div className="panel-header">
          <div>
            <div className="eyebrow">Dokumentene gjøres klare</div>
            <h2>{caseReadiness.title}</h2>
            <p>{caseReadiness.reason}</p>
          </div>
          <div className="panel-actions">
            {showTechnicalDetailsAction ? (
              <button className="button-secondary" type="button" onClick={() => setTechnicalDetailsOpen((current) => !current)}>
                {technicalDetailsOpen ? "Skjul tekniske detaljer" : "Se tekniske detaljer"}
              </button>
            ) : null}
          </div>
        </div>
        <div className={`next-action-strip next-action-strip--${caseReadiness.severity}`} role="status">
          <div>
            <span>Neste beste handling</span>
            <strong>{readinessActionTitle}</strong>
            <small>{readinessActionDescription}</small>
          </div>
          <button className="button-primary" type="button" onClick={handlePrimaryAction}>
            {primaryLabel}
          </button>
        </div>
        <div className="processing-stats">
          <span><strong>{caseCoverage.processedDocuments}</strong> av {caseCoverage.totalDocuments} dokumenter behandlet</span>
          <span><strong>{pageText}</strong></span>
          <span><strong>{coverageText}</strong></span>
          <span><strong>{caseCoverage.currentlyProcessingLabel || "Status beregnes"}</strong></span>
        </div>
        {caseCoverage.hasActiveProcessing ? (
          <p className="muted">Dette kan ta litt tid ved store eller skannede dokumenter.</p>
        ) : caseReadiness.sourceCoveragePercent < 50 ? (
          <p className="muted">
            Saksrom-oppsummering blir tilgjengelig når dokumentgrunnlaget er klart.
          </p>
        ) : hasActiveProcessing ? (
          <ImportProgressSummary
            {...importProgress}
            isImporting={true}
            attentionItems={progressAttentionItems}
            failedItems={progressFailedItems}
            detailsOpen={showImportQueueDetails}
            statusMessage="Evida behandler dokumentene automatisk."
            onShowAttentionItems={() => handleFirstUserPrimaryAction("review")}
            onShowDetails={() => setShowImportQueueDetails((current) => !current)}
            onOpenAttentionItem={(item) => void handlePreviewDocumentById(item.documentId || item.id)}
          />
        ) : (
          <p className="muted">Foreløpig — lav eller ufullstendig dekning. Kontroller alle svar mot kildene.</p>
        )}
        {recoveryCount > 0 ? (
          <div className="warning-notice" role="alert">
            {countLabel(recoveryCount, "dokument", "dokumenter")} kunne ikke behandles automatisk.
          </div>
        ) : null}
        {attentionDetailsOpen && recoveryCount > 0 ? (
          <div className="attention-documents" role="region" aria-label="Dokumenter som ikke kunne behandles">
            {documentsRequiringAttention.map((document) => {
              const readiness = documentReadiness(document);
              return (
                <article key={document.id} className="attention-document">
                  <strong>{document.original_name}</strong>
                  <span>{readiness.detail}</span>
                  <span>
                    {document.analyzed_page_count || 0} av {document.page_count || 0} sider kontrollert
                  </span>
                </article>
              );
            })}
            {importFailures > 0 ? (
              <article className="attention-document">
                <strong>Importko</strong>
                <span>{countLabel(importFailures, "import feilet", "importer feilet")}</span>
                <span>Automatisk behandling feilet. Se tekniske detaljer før du prøver på nytt.</span>
              </article>
            ) : null}
          </div>
        ) : null}
        {technicalDetailsOpen ? (
          <div className="technical-details technical-details--panel">
            <span>
              {automaticTextRecognitionAvailable
                ? "Automatisk teksthenting er tilgjengelig lokalt når dokumentmotoren kan lese filtypen."
                : "Automatisk teksthenting fra skannede PDF-sider krever lokal tekstgjenkjenning og PDF-siderenderer."}
            </span>
            {documentEngineStatus?.warnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
            <span>Hvis du tester nå, fungerer tekstbaserte PDF-er best.</span>
          </div>
        ) : null}
        {caseReadiness.testDataWarning ? <div className="warning-notice">{caseReadiness.testDataWarning}</div> : null}
      </section>
    );
  }

  const missingImportGroups = useMemo(() => {
    const groups = [
      { key: "ocr_required", title: "Krever OCR", items: importItems.filter((item) => item.status === "ocr_required") },
      { key: "failed", title: "Feilet", items: importItems.filter((item) => item.status === "failed") },
      { key: "unsupported", title: "Unsupported", items: importItems.filter((item) => item.status === "unsupported") },
      { key: "duplicate", title: "Duplikat", items: importItems.filter((item) => item.status === "duplicate") },
      { key: "partial", title: "Delvis behandlet", items: importItems.filter((item) => item.status === "partial") }
    ];
    return groups;
  }, [importItems]);

  async function handleExportImportDiagnostics() {
    if (!selectedCaseId) {
      return;
    }
    const report = await exportImportDiagnostics(selectedCaseId);
    setMaintenanceStatus(report.path ? `${report.message} ${report.path}` : report.message);
  }

  async function handleExportEvidenceQuality() {
    if (!selectedCaseId) {
      return;
    }
    const report = await exportEvidenceQualityPackage(selectedCaseId);
    setMaintenanceStatus(report.path ? `${report.message} ${report.path}` : report.message);
  }

  async function handleOpenOriginalFolder(item: ImportItem) {
    const report = await openOriginalFolder(item.original_path);
    setMaintenanceStatus(report.message);
  }

  async function handleOpenDocumentPreviewFolder(path: string) {
    try {
      const report = await openOriginalFolder(path);
      setMaintenanceStatus(report.message);
    } catch (error) {
      setMaintenanceStatus(`Kunne ikke åpne originalmappe: ${String(error)}`);
    }
  }

  async function handleReplaceImportItem(item: ImportItem) {
    const paths = await chooseDocumentPaths();
    if (paths.length > 0) {
      await importDocuments(paths.slice(0, 1));
      setMaintenanceStatus(`Erstatningsfil valgt for ${item.original_name}.`);
    }
  }

  async function handleRemoveImportItem(item: ImportItem) {
    const updated = await removeImportItemFromCase(item.id);
    setImportItems((current) => current.map((candidate) => (candidate.id === updated.id ? updated : candidate)));
    if (selectedCaseId) {
      await refresh(selectedCaseId);
    }
    setMaintenanceStatus(`${item.original_name} er fjernet fra saken.`);
  }

  async function handleManualReviewAction(item: ManualReviewItem, action: string) {
    await applyManualReviewAction(item.id, action);
    if (selectedCaseId) {
      await refresh(selectedCaseId);
    }
    setMaintenanceStatus(`Manuell kontroll oppdatert: ${item.review_type}.`);
  }

  function documentPreviewFallback(row: DocumentBasisRow): DocumentSummary {
    return {
      id: row.id,
      case_id: row.caseId,
      original_name: row.name,
      local_path: "",
      mime_type: "",
      sha256: row.hash,
      page_count: row.pageCount,
      ocr_status: "needs_ocr",
      source_count: row.sourceCount,
      source_coverage_percent: row.sourceCoveragePercent,
      analyzed_page_count: row.analyzedPages,
      pending_ocr_page_count: row.pendingOcrPages,
      imported_at: row.importedAt
    };
  }

  function resolvePreviewDocument(row: DocumentBasisRow) {
    return (
      documents.find((item) => item.id === row.id) ||
      documents.find((item) => item.sha256 === row.hash) ||
      documents.find((item) => item.original_name === row.name) ||
      null
    );
  }

  function handlePreviewDocument(row: DocumentBasisRow) {
    const document = resolvePreviewDocument(row);
    if (!document) {
      setPreviewDocument(documentPreviewFallback(row));
      setReviewApprovalChecks((current) => ({ ...current, [row.id]: true }));
      setMaintenanceStatus(`${row.name}: previewdata mangler lokal originalfil.`);
      return;
    }
    setPreviewDocument(document);
    setReviewApprovalChecks((current) => ({ ...current, [row.id]: true }));
    void recordDocumentControlAction({ caseId: row.caseId, documentId: row.id, action: "preview" })
      .then(async () => {
        if (selectedCaseId) {
          await refresh(selectedCaseId);
        }
      })
      .catch((error) => {
        setMaintenanceStatus(`${row.name}: preview åpnet, men audit-logg kunne ikke lagres: ${String(error)}`);
      });
    setMaintenanceStatus(`${row.name}: preview åpnet i Evida.`);
  }

  function approvalActionLabel(row: Pick<DocumentBasisRow, "sourceCount">) {
    return row.sourceCount > 0 ? "Bruk som kildegrunnlag" : "Marker som kontrollert";
  }

  async function handleDocumentApproval(
    row: DocumentBasisRow,
    action: "approve_for_ai" | "reject_for_ai",
    options?: { quietToast?: boolean; keepPreviewOpen?: boolean; skipRefresh?: boolean }
  ) {
    setApprovalSavingId(row.id);
    setApprovalSuccessId("");
    const note =
      action === "approve_for_ai"
        ? row.sourceCount > 0
          ? "Bruker har forhåndsvist dokumentet og godkjent dokumentgrunnlaget for AI-svar."
          : "Bruker har forhåndsvist dokumentet og markert dokumentet som manuelt kontrollert uten å gjøre det til tekstkilde."
        : "Bruker har forhåndsvist dokumentet og avvist dokumentet fra AI-grunnlaget.";
    try {
      const report = await recordDocumentControlAction({
        caseId: row.caseId,
        documentId: row.id,
        action,
        note
      });
      setApprovalSuccessId(row.id);
      setLocalControlDecisions((current) => ({
        ...current,
        [row.id]: action === "approve_for_ai" ? "approved" : "excluded"
      }));
      if (selectedCaseId && !options?.skipRefresh) {
        await refresh(selectedCaseId);
      }
      setReviewApprovalChecks((current) => ({ ...current, [row.id]: false }));
      const message =
        action === "approve_for_ai"
          ? "Kontrollert. Dokumentet er fjernet fra kontrollisten."
          : "Dokumentet er holdt utenfor kildegrunnlaget.";
      if (!options?.quietToast) {
        setApprovalToast(message);
      }
      setMaintenanceStatus(`${row.name}: ${report.message}`);
      if (!options?.keepPreviewOpen && action !== "approve_for_ai") {
        setPreviewDocument(null);
      }
      return true;
    } catch (error) {
      setApprovalToast(`Kunne ikke lagre kontroll: ${String(error)}`);
      setMaintenanceStatus(`Kontroll kunne ikke lagres for ${row.name}: ${String(error)}`);
      return false;
    } finally {
      setApprovalSavingId((current) => (current === row.id ? "" : current));
    }
  }

  async function handlePreviewDocumentById(documentId: string) {
    const row = documentBasis.rows.find((item) => item.id === documentId);
    if (row) {
      await handlePreviewDocument(row);
    }
  }

  async function handleApprovePreviewDocument(documentId: string) {
    const row = documentBasis.rows.find((item) => item.id === documentId);
    if (!row) {
      return;
    }
    const nextRow = visibleReviewDocuments.find((item) => item.id !== row.id);
    const saved = await handleDocumentApproval(row, "approve_for_ai", {
      quietToast: true,
      keepPreviewOpen: true
    });
    if (!saved) {
      return;
    }
      setApprovalToast(nextRow ? "Kontrollert. Neste dokument åpnet." : "Alle dokumenter er kontrollert.");
    if (nextRow) {
      const nextDocument = documents.find((item) => item.id === nextRow.id);
      setPreviewDocument(nextDocument || null);
      if (nextDocument) {
        setReviewApprovalChecks((current) => ({ ...current, [nextRow.id]: true }));
      }
      return;
    }
    setPreviewDocument(null);
  }

  async function handleExcludePreviewDocument(documentId: string) {
    const row = documentBasis.rows.find((item) => item.id === documentId);
    if (!row) {
      return;
    }
    await handleDocumentApproval(row, "reject_for_ai");
  }

  async function handleControlDecision(row: DocumentBasisRow, action: "approve_for_ai" | "reject_for_ai") {
    const nextRow = visibleReviewDocuments.find((item) => item.id !== row.id);
    const saved = await handleDocumentApproval(row, action, { quietToast: true });
    if (!saved) {
      return;
    }
    if (nextRow) {
      setSelectedControlDocumentId(nextRow.id);
      setApprovalToast("Beslutning lagret. Neste dokument er valgt.");
      return;
    }
    setSelectedControlDocumentId("");
    setApprovalToast("Alle dokumenter er kontrollert.");
  }

  function toggleControlSelection(rowId: string) {
    setControlSelectionIds((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]
    );
  }

  function selectVisibleControlRows() {
    setControlSelectionIds(visibleReviewDocuments.map((row) => row.id));
  }

  function clearControlSelection() {
    setControlSelectionIds([]);
    setBulkConfirmAction("");
    setBulkConfirmChecked(false);
  }

  function requestBulkAction(action: DocumentControlBulkActionId) {
    const selectedRows = visibleReviewDocuments.filter((row) => controlSelectionIds.includes(row.id));
    const plan = deriveDocumentControlBulkPlan(selectedRows);
    const actionMeta = plan.actions.find((item) => item.id === action);
    if (!actionMeta?.enabled) {
      setApprovalToast("Ingen valgte dokumenter kan bruke denne handlingen.");
      return;
    }
    if (actionMeta.requiresConfirmation) {
      setBulkConfirmAction(action);
      setBulkConfirmChecked(false);
      return;
    }
    void runBulkAction(action);
  }

  async function runBulkAction(action: DocumentControlBulkActionId) {
    const selectedRows = visibleReviewDocuments.filter((row) => controlSelectionIds.includes(row.id));
    const plan = deriveDocumentControlBulkPlan(selectedRows);
    const rows =
      action === "mark_controlled"
        ? plan.eligibleForControlled
        : action === "exclude"
          ? plan.excludeRows
          : action === "replace"
            ? plan.replaceRows.slice(0, 1)
            : plan.ocrRows;

    if (rows.length === 0) {
      setApprovalToast("Ingen valgte dokumenter kan bruke denne handlingen.");
      return;
    }

    if (action === "replace") {
      await handleReplaceDocumentRow(rows[0]);
      return;
    }

    if (action === "run_ocr") {
      setApprovalToast(`${rows.length} dokumenter er identifisert for OCR. Velg Erstatt fil hvis originalen ikke kan leses.`);
      setMaintenanceStatus(`${rows.length} valgte dokumenter trenger OCR eller tekstkontroll.`);
      return;
    }

    const savedRowIds = new Set<string>();
    for (const row of rows) {
      const saved = await handleDocumentApproval(row, action === "mark_controlled" ? "approve_for_ai" : "reject_for_ai", {
        quietToast: true,
        skipRefresh: true
      });
      if (!saved) {
        break;
      }
      savedRowIds.add(row.id);
    }
    if (savedRowIds.size === 0) {
      return;
    }
    setLocalControlDecisions((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (savedRowIds.has(row.id)) {
          next[row.id] = action === "mark_controlled" ? "approved" : "excluded";
        }
      }
      return next;
    });
    setReviewApprovalChecks((current) => {
      const next = { ...current };
      for (const rowId of savedRowIds) {
        next[rowId] = false;
      }
      return next;
    });
    const remaining = visibleReviewDocuments.find((row) => !savedRowIds.has(row.id));
    setSelectedControlDocumentId(remaining?.id || "");
    clearControlSelection();
    if (selectedCaseId) {
      await refresh(selectedCaseId);
    }
    setApprovalToast(
      action === "mark_controlled"
        ? `${savedRowIds.size} dokumenter er markert som kontrollert.`
        : `${savedRowIds.size} dokumenter er holdt utenfor kildegrunnlaget.`
    );
  }

  async function handleReplacePreviewDocument(documentId: string) {
    const row = documentBasis.rows.find((item) => item.id === documentId);
    if (row) {
      await handleReplaceDocumentRow(row);
    }
  }

  async function handleReplaceDocumentRow(row: DocumentBasisRow) {
    const paths = await chooseDocumentPaths();
    if (paths.length > 0) {
      await importDocuments(paths.slice(0, 1));
      setMaintenanceStatus(`Erstatningsfil valgt for ${row.name}.`);
    }
  }

  function handleFirstUserPrimaryAction(target: "review" | "preliminary_case_room" | "case_room" | "unused") {
    if (target === "preliminary_case_room" || target === "case_room") {
      setActiveView("caseRoom");
      return;
    }
    if (target === "review") {
      setControlAttentionExpanded(true);
      setActiveView("documentControl");
      return;
    }
    setActiveView("control");
  }

  function handleImportNextAction() {
    if (importNextAction.targetView === "documentControl") {
      setControlAttentionExpanded(true);
      setActiveView("documentControl");
      return;
    }
    if (importNextAction.targetView === "caseRoom") {
      setActiveView("caseRoom");
      return;
    }
    if (importNextAction.targetView === "control") {
      setActiveView("control");
      return;
    }
    if (importNextAction.targetView === "documents") {
      setActiveView("documents");
    }
  }

  function makeAttentionItems(rows: DocumentBasisRow[]): ImportAttentionItem[] {
    return rows.map((row) => ({
      id: row.id,
      documentId: row.id,
      name: row.name,
      problem: row.reason || row.label,
      suggestedAction: row.recommendedAction,
      status: row.label,
      canApprove: row.canApprove,
      approvalChecked: Boolean(reviewApprovalChecks[row.id]),
      sourceCount: row.sourceCount,
      approvalState:
        approvalSavingId === row.id ? "saving" : approvalSuccessId === row.id ? "approved" : "idle"
    }));
  }

  const progressAttentionItems = makeAttentionItems(visibleReviewDocuments);
  const progressFailedItems = makeAttentionItems(documentBasis.unreadableDocuments);

  function importItemRecoveryCopy(item: ImportItem) {
    if (item.status === "ocr_required") {
      return {
        impact: "Dokumentet mangler maskinlesbar tekst på én eller flere sider.",
        nextStep: "Åpne dokumentkontroll, forhåndsvis originalen og erstatt filen hvis OCR/tekstgrunnlag mangler.",
        safety: "Saksrom bruker bare eksisterende kildeutdrag og markerer resten som manglende grunnlag."
      };
    }
    if (item.status === "failed" || item.status === "unsupported") {
      return {
        impact: "Filen ble ikke gjort om til sporbare kilder.",
        nextStep: item.can_retry ? "Prøv import på nytt, eller erstatt filen med en lesbar kopi." : "Erstatt filen, fjern den fra saken, eller hold den utenfor AI-grunnlaget.",
        safety: "Dokumentet brukes ikke som kildegrunnlag før du gjør en ny kontrollhandling."
      };
    }
    if (item.status === "duplicate") {
      return {
        impact: "Filen ser ut til å være en duplikat av noe som allerede finnes i saken.",
        nextStep: "Kontroller at duplikatet ikke trengs som egen versjon. Hvis ikke, la den stå utenfor.",
        safety: "Evida importerer ikke samme innhold på nytt og unngår dobbel kildebruk."
      };
    }
    if (item.status === "partial") {
      return {
        impact: "Noe av dokumentet er klart, men ikke hele grunnlaget.",
        nextStep: "Bruk saken foreløpig med forbehold, og kontroller sidene som mangler tekst eller kilder.",
        safety: "Saksrom avgrenser svar til tekst og kildeutdrag som faktisk finnes."
      };
    }
    return {
      impact: item.user_message || "Dokumentet er registrert i importstatusen.",
      nextStep: item.recommended_action || "Ingen ekstra handling er nødvendig akkurat nå.",
      safety: item.can_continue ? "Du kan fortsette med tilgjengelige kilder." : "Dokumentet brukes ikke som kildegrunnlag før det er klart."
    };
  }

  function ImportItemCard({ item, technical = false }: { item: ImportItem; technical?: boolean }) {
    const recovery = importItemRecoveryCopy(item);
    return (
      <article className={`import-health-item import-health-item--${item.status}`}>
        <div>
          <strong>{item.original_name}</strong>
          <span>{importStatusLabel(item.status)}</span>
        </div>
        <p>{item.user_message || recovery.impact}</p>
        <div className="recovery-callout" role={item.can_continue ? "note" : "alert"}>
          <strong>Trygg håndtering</strong>
          <span>{recovery.safety}</span>
          <span><b>Neste steg:</b> {recovery.nextStep}</span>
        </div>
        <div className="import-health-item__meta">
          <span>{item.page_count} sider</span>
          <span>{item.pages_with_text} med tekst</span>
          <span>{item.pages_requires_ocr} krever OCR</span>
          {item.issue_code ? <span>{item.issue_code}</span> : null}
        </div>
        <div className="panel-actions">
          {item.can_retry ? (
            <button className="button-secondary" type="button" onClick={() => void importDocuments([item.original_path])}>Prøv igjen</button>
          ) : null}
          <button className="button-secondary" type="button" onClick={() => void handleRemoveImportItem(item)}>Fjern fra saken</button>
          <button className="button-secondary" type="button" onClick={() => void handleReplaceImportItem(item)}>Erstatt fil</button>
          <button className="button-secondary" type="button" onClick={() => void handleOpenOriginalFolder(item)}>Åpne originalmappe</button>
          <button className="button-secondary" type="button" onClick={() => setExpandedDocumentId(expandedDocumentId === item.id ? "" : item.id)}>
            Vis tekniske detaljer
          </button>
        </div>
        {technical || expandedDocumentId === item.id ? (
          <pre className="technical-details">{JSON.stringify(item, null, 2)}</pre>
        ) : null}
      </article>
    );
  }

  function ImportHealthCenter() {
    const readyItems = importItems.filter((item) => item.status === "ready");
    const partialItems = importItems.filter((item) => item.status === "partial");
    const ocrItems = importItems.filter((item) => item.status === "ocr_required");
    const failedItems = importItems.filter((item) => item.status === "failed");
    const unsupportedItems = importItems.filter((item) => item.status === "unsupported");
    const duplicateItems = importItems.filter((item) => item.status === "duplicate");
    const openManualReviewItems = manualReviewItems.filter((item) => item.status === "open" || item.status === "needs_follow_up");
    const failedOcrResults = ocrResults.filter((item) => item.status === "failed");

    return (
      <section className="panel import-health-center">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Importstatus</div>
            <h2>{importUx.progressLabel}</h2>
            <p>{importUx.nextStep.message}</p>
          </div>
        </div>
        <div className={`next-action-strip next-action-strip--${importNextAction.severity}`} role="status">
          <div>
            <span>Neste beste handling</span>
            <strong>{importNextAction.title}</strong>
            <small>{importNextAction.description}</small>
          </div>
          <div className="next-action-strip__actions">
            <button
              className="button-primary"
              type="button"
              aria-controls="documents-needing-control"
              onClick={handleImportNextAction}
            >
              {importNextAction.primaryLabel}
            </button>
            {importNextAction.secondaryLabel ? (
              <button className="button-secondary" type="button" onClick={() => setShowImportQueueDetails((current) => !current)}>
                {showImportQueueDetails ? "Skjul detaljer" : importNextAction.secondaryLabel}
              </button>
            ) : null}
          </div>
        </div>
        <p className="muted">
          {importUx.progress.state === "processing" && importUx.progress.remainingDocuments > 0
            ? importUx.etaLabel
            : importNextAction.description}
        </p>
        {importUx.gapMessages.length > 0 ? (
          <div className="warning-notice">
            <strong>Mangler nå:</strong>
            <ul className="compact-gap-list">
              {importUx.gapMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <details className="technical-disclosure">
          <summary>Vis detaljer</summary>
          <div className="import-health-overview">
            <StatusCard label="Klare dokumenter" value={readyItems.length} detail="klare filer" />
            <StatusCard label="Krever OCR" value={ocrItems.length} detail={`${pendingOcrPages} sider`} tone={ocrItems.length ? "warn" : "ok"} />
            <StatusCard label="Feilede filer" value={failedItems.length} detail="må vurderes" tone={failedItems.length ? "warn" : "ok"} />
            <StatusCard label="Kildedekning" value={`${Math.round(importHealth?.source_coverage_percent ?? caseScopedSourceCoveragePercent)} %`} detail="sakens importstatus" tone={(importHealth?.source_coverage_percent ?? 0) < 100 ? "warn" : "ok"} />
            <StatusCard label="Manuell kontroll" value={openManualReviewItems.length} detail="åpne punkter" tone={openManualReviewItems.length ? "warn" : "ok"} />
            <StatusCard label="Kildekvalitet" value={evidenceQuality?.citation_failures ?? 0} detail="siteringsfeil" tone={evidenceQuality?.citation_failures ? "warn" : "ok"} />
          </div>
        <section className="import-health-section">
          <h3>Se hva som mangler</h3>
          <div className="import-health-groups">
            {missingImportGroups.map((group) => (
              <article key={group.key} className="import-health-group">
                <strong>{group.title}</strong>
                <span>{group.items.length} filer</span>
              </article>
            ))}
          </div>
        </section>
        {[
          ["Klare dokumenter", readyItems],
          ["Krever OCR", ocrItems],
          ["Feilede filer", failedItems],
          ["Filtype støttes ikke", unsupportedItems],
          ["Duplikater", duplicateItems],
          ["Delvis behandlede dokumenter", partialItems]
        ].map(([title, items]) => (
          <section key={title as string} className="import-health-section">
            <h3>{title as string}</h3>
            {(items as ImportItem[]).length > 0 ? (
              <div className="import-health-list">
                {(items as ImportItem[]).map((item) => <ImportItemCard key={item.id} item={item} />)}
              </div>
            ) : (
              <p className="muted">Ingen filer i denne gruppen.</p>
            )}
          </section>
        ))}
        <section className="import-health-section">
          <h3>OCR-flyt</h3>
          <div className="import-health-groups">
            <article className="import-health-group">
              <strong>OCR-kø</strong>
              <span>{ocrResults.filter((item) => item.status === "queued").length} sider</span>
            </article>
            <article className="import-health-group">
              <strong>OCR-feil</strong>
              <span>{failedOcrResults.length} sider</span>
            </article>
            <article className="import-health-group">
              <strong>OCR-resultater</strong>
              <span>{ocrResults.length} registrert</span>
            </article>
          </div>
          {failedOcrResults.length ? (
            <div className="import-health-list">
              {failedOcrResults.slice(0, 6).map((item) => (
                <article key={item.id} className="import-item-card">
                  <strong>{item.user_message}</strong>
                  <p>{item.recommended_action}</p>
                  <span className="muted">{item.issue_code || item.status}</span>
                </article>
              ))}
            </div>
          ) : null}
        </section>
        <section className="import-health-section">
          <h3>Manuell kontroll</h3>
          {manualReviewItems.length > 0 ? (
            <div className="import-health-list">
              {manualReviewItems.slice(0, 10).map((item) => (
                <article key={item.id} className="import-item-card">
                  <div className="import-item-card__header">
                    <strong>{item.review_type}</strong>
                    <span>{item.severity}</span>
                  </div>
                  <p>{item.reason}</p>
                  <p><strong>Neste handling:</strong> {item.recommended_action}</p>
                  <div className="import-item-card__meta">
                    <span>Status {item.status}</span>
                    <span>{item.ai_usable ? "Kan brukes etter kontroll" : "Skal ikke brukes av AI"}</span>
                  </div>
                  <div className="panel-actions">
                    <button className="button-secondary" type="button" onClick={() => void handleManualReviewAction(item, "mark_reviewed")}>Marker kontrollert</button>
                    <button className="button-secondary" type="button" onClick={() => void handleManualReviewAction(item, "requires_follow_up")}>Følg opp</button>
                    <button className="button-secondary" type="button" onClick={() => void handleManualReviewAction(item, "exclude_from_ai")}>Ikke bruk av AI</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">Ingen manuelle review-punkter.</p>
          )}
        </section>
        <section className="import-health-section">
          <h3>Juridisk kildekvalitet</h3>
          <div className="import-health-groups">
            <article className="import-health-group">
              <strong>Duplikatgrupper</strong>
              <span>{evidenceQuality?.duplicate_groups ?? 0}</span>
            </article>
            <article className="import-health-group">
              <strong>Vedlegg/bilag</strong>
              <span>{evidenceQuality?.attachment_like_documents ?? 0}</span>
            </article>
            <article className="import-health-group">
              <strong>Kildekart</strong>
              <span>{evidenceQuality?.source_map_rows ?? 0} rader</span>
            </article>
            <article className="import-health-group">
              <strong>Sporbarhet</strong>
              <span>{evidenceQuality?.chain_of_custody_rows ?? 0} dokumenter</span>
            </article>
          </div>
          {evidenceQuality?.warnings.length ? (
            <div className="warning-notice">{evidenceQuality.recommended_action}</div>
          ) : null}
          <div className="panel-actions">
            <button className="button-secondary" type="button" onClick={() => void handleExportEvidenceQuality()}>Eksporter kildekart</button>
          </div>
        </section>
        <section className="import-health-section">
          <h3>Tekniske detaljer</h3>
          <pre className="technical-details">{JSON.stringify(importHealth, null, 2)}</pre>
        </section>
        </details>
      </section>
    );
  }

  function ImportCompletionModal() {
    if (!showImportCompletion || !importHealth?.latest_session) {
      return null;
    }
    const session = importHealth.latest_session;
    return (
      <div className="modal-backdrop" role="presentation">
        <section
          className="modal-panel import-completion-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-outcome-title"
          tabIndex={-1}
          onKeyDown={(event) => closeDialogOnEscape(event, () => setShowImportCompletion(false))}
        >
          <div className="panel-header">
            <div>
              <div className="eyebrow">Importstatus</div>
              <h2 id="import-outcome-title">{importOutcomeView.title}</h2>
              <p>{importOutcomeView.primaryLine}</p>
              <p>{importOutcomeView.secondaryLine}</p>
              <p className="muted">
                {importOutcomeView.showEta && importProgress.state === "processing" && importProgress.remainingDocuments > 0
                  ? importProgress.etaLabel
                  : "Fase: Ferdig"}
              </p>
            </div>
            <button className="button-ghost" type="button" onClick={() => setShowImportCompletion(false)}>Lukk</button>
          </div>
          <ImportProgressSummary
            {...importProgress}
            title={importOutcomeView.title}
            isImporting={importProgress.state === "processing"}
            attentionItems={progressAttentionItems}
            failedItems={progressFailedItems}
            detailsOpen={showImportCompletionDetails}
            statusMessage={importNextAction.description}
            onOpenAttentionItem={(item) => void handlePreviewDocumentById(item.documentId || item.id)}
            onApproveAttentionItem={(item) => {
              const row = documentBasis.rows.find((candidate) => candidate.id === (item.documentId || item.id));
              if (row) {
                void handleDocumentApproval(row, "approve_for_ai");
              }
            }}
          />
        {importOutcomeGapMessages.length > 0 ? (
          <div className="warning-notice" role="alert">
            <strong>Mangler nå:</strong>
            <ul className="compact-gap-list">
                {importOutcomeGapMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="notice">Importen er ferdig, og ingen importmangler er registrert.</p>
          )}
          <div className="panel-actions">
            <button
              className="button-primary"
              type="button"
              autoFocus
              onClick={() => {
                setShowImportCompletion(false);
                handleImportNextAction();
              }}
            >
              {importOutcomeView.primaryCta}
            </button>
            <button className="button-secondary" type="button" onClick={() => setShowImportCompletionDetails((current) => !current)}>
              {showImportCompletionDetails ? "Skjul detaljer" : importOutcomeView.secondaryCta}
            </button>
          </div>
          {showImportCompletionDetails ? (
            <div className="technical-disclosure__content">
              <div className="import-health-overview">
                <StatusCard label="Importert" value={session.files_ready + session.files_partial} detail="klar eller delvis" />
                <StatusCard label="Krever OCR" value={session.files_requires_ocr} detail={`${session.pages_requires_ocr} sider`} tone={session.files_requires_ocr ? "warn" : "ok"} />
                <StatusCard label="Feilet" value={session.files_failed} detail="ikke brukt som kilde" tone={session.files_failed ? "warn" : "ok"} />
                <StatusCard label="Duplikater" value={session.files_duplicate} detail="ikke importert på nytt" />
                <StatusCard label="Kildedekning" value={`${Math.round(importHealth.source_coverage_percent)} %`} detail="sakens importstatus" tone={importHealth.source_coverage_percent < 100 ? "warn" : "ok"} />
              </div>
              <div className="panel-actions">
                <button className="button-secondary" type="button" onClick={() => { setShowImportCompletion(false); void handleReindex(); }}>Kjør OCR</button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  function ReadinessGate({ title, reason }: { title: string; reason?: string }) {
    return (
      <>
        <DocumentReadinessPanel />
        <section className="panel readiness-gate" role={caseReadiness.severity === "critical" ? "alert" : "status"}>
          <div className="panel-header">
            <div>
              <div className="eyebrow">{caseReadiness.label}</div>
              <h2>{title}</h2>
              <p>{reason || caseReadiness.blockedUse}</p>
            </div>
            <button className="button-primary" onClick={() => setActiveView("control")}>
              Se kontrollgrunnlag
            </button>
          </div>
        </section>
      </>
    );
  }

  function RoomModeNotice({ view }: { view: ViewKey }) {
    const availability = roomAvailabilityByView[view];
    if (!availability || availability.mode !== "preliminary") {
      return null;
    }
    return (
      <div className="warning-notice room-mode-notice" role="status" aria-live="polite">
        <strong>{availability.label}</strong>
        <span>{availability.warning}</span>
      </div>
    );
  }

  function ProcessingStatus() {
    const readyCount = processedDocuments.length;
    const activeCount = isImporting ? 1 : Math.max(0, documents.length - readyCount - documentsRequiringAttention.length);
    const statusText = documents.length
      ? `${countLabel(documents.length, "dokument", "dokumenter")} lastet opp. ${countLabel(
          readyCount,
          "dokument",
          "dokumenter"
        )} ferdig behandlet.`
      : "Ingen dokumenter er lastet opp ennå.";

    return (
      <section className="processing-panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Behandlingsstatus</div>
            <h2>{statusText}</h2>
            <p>
              Evida viser hva som er lastet opp, hva som behandles, og når saken kan åpnes i
              Saksrom.
            </p>
          </div>
          {documents.length > 0 && caseReadiness.verdict !== "not_ready" ? (
            <button className="button-primary" onClick={() => {
              setOnboardingStage("caseRoom");
              setActiveView("caseRoom");
            }}>
              {caseReadiness.verdict === "requires_control" ? "Åpne foreløpig Saksrom" : "Gå til Saksrom"}
            </button>
          ) : null}
        </div>
        <div className="processing-stats">
          <span><strong>{documents.length}</strong> lastet opp</span>
          <span><strong>{readyCount}</strong> ferdig behandlet</span>
          <span><strong>{hasActiveProcessing ? activeCount : 0}</strong> behandles nå</span>
          <span><strong>{documentsRequiringAttention.length}</strong> kunne ikke behandles automatisk</span>
        </div>
        {documents.length > 0 && !hasActiveProcessing ? (
          <div className="processing-list">
            {documents.map((document) => {
              const statusLabel =
                document.source_count > 0
                  ? `Ferdig · ${countLabel(document.page_count, "side", "sider")} · ${countLabel(
                      document.source_count,
                      "kilde",
                      "kilder"
                    )}`
                  : document.pending_ocr_page_count > 0
                    ? `Henter tekst fra skannede sider · ${countLabel(document.pending_ocr_page_count, "side", "sider")} venter`
                    : document.analyzed_page_count > 0
                      ? `Leser tekst · ${document.analyzed_page_count} sider analysert`
                      : "Lastet opp · venter på behandling";

              return (
                <article key={document.id} className="processing-row">
                  <div>
                    <strong>{document.original_name}</strong>
                    <span>{statusLabel}</span>
                  </div>
                  <span className={document.source_count > 0 ? "status-chip status-chip--ok" : "status-chip status-chip--warn"}>
                    {document.source_count > 0 ? "Klar" : "Pågår"}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">Last opp minst ett dokument for å bygge første saksoversikt.</div>
        )}
        {isImporting ? (
          <div className="assistant-work-steps" aria-live="polite">
            <span>Leser dokumenter ...</span>
            <span>Finner relevante kilder ...</span>
            <span>Bygger foreløpig saksoversikt ...</span>
          </div>
        ) : null}
        {processingLog.length > 0 ? (
          <ol className="processing-log" aria-label="Behandlingslogg">
            {processingLog.slice(-8).map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ol>
        ) : null}
      </section>
    );
  }

  function GuidedExperience() {
    return (
      <section className={`guided-shell ${onboardingStage === "intro" ? "guided-shell--intro" : ""}`}>
        {onboardingStage !== "intro" ? (
          <>
        <header className="guided-header">
          <div className="brand">
            <img className="brand-logo" src="/logo.png" alt="" />
            <div>
              <div className="brand-name">Evida</div>
              <div className="brand-subtitle">Evaluation build</div>
            </div>
          </div>
          <div className="guided-header-actions">
            <span className="local-pill">Lokal behandling</span>
            <button
              className="theme-toggle"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              aria-label={theme === "dark" ? "Bytt til lys modus" : "Bytt til mørk modus"}
              title={theme === "dark" ? "Lys modus" : "Mørk modus"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === "dark" ? "Lys" : "Mørk"}</span>
            </button>
          </div>
        </header>

          </>
        ) : null}

        {onboardingStage === "intro" ? (
          <section className="intro-vignette" aria-label="Evida introduksjon">
            <button className="intro-vignette__button" onClick={handleIntroComplete}>
              <video
                src="/introvideo.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-hidden="true"
              />
            </button>
          </section>
        ) : null}

        {onboardingStage === "start" ? (
          <section className="guided-card">
            <div className="guided-section-header">
              <div>
                <div className="eyebrow">Startpunkt</div>
                <h1>Hva vil du jobbe med?</h1>
                <p>Start en ny sak, eller åpne et eksisterende saksrom og fortsett der du slapp.</p>
              </div>
            </div>
            <div className="choice-grid">
              <article className="choice-card">
                <h2>Opprett ny sak</h2>
                <p>Start et nytt saksrom og importer dokumenter som kildegrunnlag.</p>
                <div className="form-row">
                  <input
                    ref={startCaseNameInputRef}
                    defaultValue={caseName}
                    placeholder="Saksnavn"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleCreateCase();
                      }
                    }}
                  />
                  <button className="button-primary" onClick={handleCreateCase} disabled={isCreatingCase}>
                    {isCreatingCase ? "Oppretter ..." : "Ny sak"}
                  </button>
                </div>
              </article>
              <article className="choice-card">
                <h2>Tidligere saker</h2>
                <p>Åpne en eksisterende sak. Hvis den mangler dokumenter, går du rett til import.</p>
                <button className="button-secondary" onClick={() => setCasePickerOpen((current) => !current)}>
                  Se saker
                </button>
              </article>
            </div>
            {casePickerOpen ? <CaseList /> : null}
          </section>
        ) : null}

        {onboardingStage === "import" ? (
          <section className="guided-card">
            <div className="guided-section-header">
              <div>
                <div className="eyebrow">Dokumentimport</div>
                <h1>Last opp dokumenter</h1>
                <p>
                  {selectedCase
                    ? `${selectedCase.name}: velg filer eller en saksmappe.`
                    : "Velg filer eller en saksmappe. Evida oppretter saken automatisk når importen starter."}
                </p>
              </div>
              {hasDocuments && caseReadiness.verdict !== "not_ready" ? (
                <button className="button-secondary" onClick={() => {
                  setOnboardingStage("caseRoom");
                  setActiveView("caseRoom");
                }}>
                  {caseReadiness.verdict === "requires_control" ? "Åpne foreløpig Saksrom" : "Gå til Saksrom"}
                </button>
              ) : null}
            </div>
            <ImportPanel />
            {hasDocuments && caseReadiness.sourceCoveragePercent < 80 ? <DocumentReadinessPanel /> : null}
            {hasDocuments || isImporting || importQueue.length > 0 ? <ProcessingStatus /> : null}
          </section>
        ) : null}
      </section>
    );
  }

  function AiTrustContract() {
    if (trustContractHidden) {
      return null;
    }

    return (
      <section className="trust-panel">
        <div>
          <div className="eyebrow">AI trust contract</div>
          <h3>AI lager forslag. Du godkjenner.</h3>
          <p>Alle forslag skal kunne spores til kildeutdrag. Bruk dette som arbeidsutkast, ikke som juridisk fasit uten faglig vurdering.</p>
        </div>
        <button className="button-secondary" onClick={() => setTrustContractHidden(true)}>Skj\u00f8nner</button>
      </section>
    );
  }

  function ImportPanel() {
    return (
      <section
        className={`panel import-panel ${isDragActive ? "import-panel--active" : ""}`}
        onDrop={handleDrop}
        onDragEnter={() => setIsDragActive(true)}
        onDragLeave={() => setIsDragActive(false)}
        onDragOver={handleDragOver}
      >
        <div className="panel-header">
          <div>
            <h2>Dokumentimport</h2>
            <p>Velg flere filer, velg en hel saksmappe, eller dra dokumenter inn. Sporbare kildeutdrag er tekst vi kan vise tilbake til originaldokumentet.</p>
          </div>
        </div>
        <div className="import-helper">
          <strong>St\u00f8ttede filtyper:</strong> PDF, DOCX, TXT, MD, PNG, JPG og TIFF.
          {!hasDesktopRuntime() ? " Lokal filimport krever desktop-appen." : ""}
        </div>
        <div className="form-row">
          <select value={selectedCaseId} onChange={(event) => void handleSelectCase(event.target.value)}>
            <option value="">Velg sak</option>
            {cases.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button className="button-primary" disabled={isImporting} onClick={handleChooseFiles}>
            Velg filer
          </button>
          <button className="button-secondary" disabled={isImporting || !hasDesktopRuntime()} onClick={() => void handleChooseFolder()}>
            Velg mappe
          </button>
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.markdown,.png,.jpg,.jpeg,.tif,.tiff"
            onChange={(event) => handleBrowserFileSelection(event.target.files)}
          />
          <button className="button-ghost secondary-link" onClick={() => setShowAdvancedImport((current) => !current)}>
            {showAdvancedImport ? "Skjul avansert" : "Avansert import"}
          </button>
        </div>
        {showAdvancedImport ? (
          <div className="advanced-import">
            <input
              value={documentPath}
              onChange={(event) => setDocumentPath(event.target.value)}
              placeholder="Lim inn lokal filsti"
            />
            <button
              className="button-primary"
              disabled={!documentPath.trim() || isImporting}
              onClick={() => void importDocuments([documentPath])}
            >
              Registrer dokument
            </button>
          </div>
        ) : null}
        <div
          className={`drop-zone ${isImporting ? "drop-zone--disabled" : ""}`}
          role="button"
          tabIndex={isImporting ? -1 : 0}
          aria-disabled={isImporting}
          onClick={handleDropZoneClick}
          onKeyDown={handleDropZoneKeyDown}
        >
          <strong>{isDragActive ? "Slipp dokumentene her" : "Dra dokumenter hit"}</strong>
          <span>Du kan slippe flere filer samtidig. Bruk Velg mappe for å hente en hel saksmappe rekursivt.</span>
        </div>
        {importQueue.length > 0 ? (
          <ImportProgressSummary
            {...importProgress}
            isImporting={isImporting || importProgress.state === "processing"}
            attentionItems={progressAttentionItems}
            failedItems={progressFailedItems}
            detailsOpen={showImportQueueDetails}
            statusMessage={importProgress.state === "processing" ? "Evida behandler dokumentene automatisk." : importUx.nextStep.message}
            onShowAttentionItems={() => handleFirstUserPrimaryAction("review")}
            onShowDetails={() => setShowImportQueueDetails((current) => !current)}
            onOpenAttentionItem={(item) => void handlePreviewDocumentById(item.documentId || item.id)}
            onApproveAttentionItem={(item) => {
              const row = documentBasis.rows.find((candidate) => candidate.id === (item.documentId || item.id));
              if (row) {
                void handleDocumentApproval(row, "approve_for_ai");
              }
            }}
          />
        ) : null}
        {false && importQueue.length > 0 ? (
          <div className="import-queue" aria-live="polite">
            <div className="import-queue__header">
              <div>
                <strong>{importUx.progressLabel}</strong>
                <span>
                  {importUx.progress.state === "processing" && importUx.progress.remainingDocuments > 0
                    ? importUx.etaLabel
                    : "Fase: Ferdig"}
                </span>
              </div>
              <div className="panel-actions">
                <button
                  className="button-primary"
                  type="button"
                  onClick={() => handleFirstUserPrimaryAction(importUx.nextStep.primaryAction.target)}
                >
                  {importUx.nextStep.primaryAction.label}
                </button>
                <button className="button-secondary" type="button" onClick={() => setShowImportQueueDetails((current) => !current)}>
                  {showImportQueueDetails ? "Skjul detaljer" : "Vis detaljer"}
                </button>
              </div>
            </div>
            {showImportQueueDetails ? (
              <div className="technical-disclosure__content">
                {importQueue.map((item) => {
                  const progress = importProgressPercent(item.status);
                  const eta = importEta(item, importNow);
                  return (
                    <article key={item.path} className={`import-queue-row import-queue-row--${item.status}`}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.detail}</span>
                        <div className="import-progress" aria-label={`Importstatus ${progress} prosent`}>
                          <span style={{ width: `${progress}%` }} />
                        </div>
                        <span className="import-eta">
                          {eta}
                          {item.startedAt && !["completed", "failed"].includes(item.status)
                            ? ` · gått ${formatDuration(importNow - item.startedAt)}`
                            : ""}
                        </span>
                      </div>
                      <div className="import-queue-row__meta">
                        {typeof item.pages === "number" ? <span>{countLabel(item.pages, "side", "sider")}</span> : null}
                        {typeof item.sources === "number" ? <span>{countLabel(item.sources, "kildeutdrag", "kildeutdrag")}</span> : null}
                        <span className={item.status === "completed" ? "status-chip status-chip--ok" : item.status === "failed" ? "status-chip status-chip--warn" : "status-chip"}>
                          {importStatusLabel(item.status)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        {hasDocuments ? (
          <div className="import-status-grid">
            <span>PDF-sider <strong>{totalPages}</strong></span>
            <span>Analyserte sider <strong>{analyzedPages}</strong></span>
            <span>Sporbare kilder <strong>{sources.length}</strong></span>
            <span>Tekststatus <strong>{pendingOcrPages > 0 ? `${pendingOcrPages} sider venter på tekst` : "Ingen ventende sider"}</strong></span>
          </div>
        ) : null}
        {hasDocuments ? <div className="workflow-notice">{userCoverageExplanation}</div> : null}
        {isImporting ? <div className="notice">Importerer dokumenter ...</div> : null}
        {importError ? <div className="error-notice">{importError}</div> : null}
        {lastImport ? <div className="notice">{lastImport}</div> : null}
      </section>
    );
  }

  function CasePanel() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Opprett sak</h2>
            <p>Steg 1: lokal evalueringssak, database, SHA-256 og audit trail.</p>
          </div>
        </div>
        <div className="form-row">
          <input
            ref={panelCaseNameInputRef}
            defaultValue={caseName}
            placeholder="Saksnavn"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleCreateCase();
              }
            }}
          />
          <button className="button-primary" onClick={handleCreateCase} disabled={isCreatingCase}>
            {isCreatingCase ? "Oppretter ..." : "Opprett sak"}
          </button>
        </div>
      </section>
    );
  }

  function CaseList() {
    return (
      <section className="panel">
        <div className="panel-header">
          <h2>Saker</h2>
        </div>
        {cases.length === 0 ? (
          <div className="empty-state">Ingen saker ennå. Opprett en sak for å starte dokumentarbeidet.</div>
        ) : (
          <div className="case-list">
            {cases.map((item) => (
              <button
                key={item.id}
                className={`case-row ${item.id === selectedCaseId ? "case-row--active" : ""}`}
                onClick={() => void handleSelectCase(item.id)}
              >
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted">{item.id} · {item.jurisdiction}</div>
                </div>
                <div className="case-row__meta">
                  <span>{countLabel(item.document_count, "dokument", "dokumenter")}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="icon-button danger"
                    aria-label={`Slett ${item.name}`}
                    onClick={(event: MouseEvent) => {
                      event.stopPropagation();
                      setDeleteTarget(item);
                    }}
                  >
                    <Trash2 size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  function OverviewView() {
    const primaryLabel = !selectedCase
      ? "Opprett sak"
      : hasDocuments
        ? caseReadiness.verdict === "not_ready"
          ? "Vis behandlingsstatus"
          : caseReadiness.verdict === "requires_control"
            ? "Åpne foreløpig Saksrom"
            : "Åpne Saksrom"
        : "Last opp dokumenter";
    const primaryAction = !selectedCase
      ? undefined
      : () => setActiveView(hasDocuments ? (caseReadiness.verdict !== "not_ready" ? "caseRoom" : "control") : "documents");

    return (
      <>
        <section className="panel overview-entry">
          <div className="panel-header">
            <div>
              <h2>{selectedCase ? selectedCase.name : "Start en ny evalueringssak"}</h2>
              <p>
                {!selectedCase
                  ? "Opprett en sak først. Deretter laster du opp dokumenter og går videre til Saksrom."
                  : hasDocuments
                    ? caseReadiness.verdict === "not_ready"
                      ? "Dokumenter er importert, og saken klargjøres automatisk."
                      : "Dokumenter er importert. Neste steg er kildebasert arbeid med tydelig kontroll."
                    : "Saken er klar. Last opp dokumenter for å starte analyse og saksarbeid."}
              </p>
            </div>
            {selectedCase ? (
              <button className="button-primary" onClick={primaryAction}>
                {primaryLabel}
              </button>
            ) : null}
          </div>
          {selectedCase && hasDocuments ? (
            <div className="overview-actions">
              <button className="button-secondary" onClick={() => setActiveView("documents")}>
                Importer flere dokumenter
              </button>
            </div>
          ) : null}
        </section>
        {!selectedCase ? <CasePanel /> : null}
        <CaseList />
      </>
    );
  }

  function DocumentList() {
    const rowsById = new Map(documentBasis.rows.map((row) => [row.id, row]));
    const normalizedSearch = documentSearch.trim().toLowerCase();
    const filteredDocuments = documents.filter((document) => {
      const row = rowsById.get(document.id);
      const matchesSearch =
        !normalizedSearch ||
        document.original_name.toLowerCase().includes(normalizedSearch) ||
        document.sha256.toLowerCase().includes(normalizedSearch);
      const matchesFilter =
        documentFilter === "all" ||
        (documentFilter === "ready" && Boolean(row?.canUseInAnswer)) ||
        (documentFilter === "control" && visibleReviewDocuments.some((candidate) => candidate.id === document.id)) ||
        (documentFilter === "unused" && documentBasis.unreadableDocuments.some((candidate) => candidate.id === document.id));
      return matchesSearch && matchesFilter;
    });

    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{selectedCase ? `Dokumenter i ${selectedCase.name}` : "Dokumenter"}</h2>
            <p>{hasDocuments ? "Filtrer dokumentene etter kildeklarhet, kontrollbehov og importstatus." : "Importer dokumenter for valgt sak."}</p>
          </div>
          {hasDocuments ? (
            <div className="panel-actions">
              <button className="button-secondary" onClick={handleReindex}>Oppdater kildeutdrag fra dokumentene</button>
              <button className="button-secondary" onClick={() => setActiveView("documentControl")}>Dokumentkontroll</button>
            </div>
          ) : null}
        </div>
        {documents.length > 0 ? (
          <div className="document-filter-bar">
            <input
              value={documentSearch}
              onChange={(event) => setDocumentSearch(event.target.value)}
              placeholder="Søk i dokumentnavn eller hash"
              aria-label="Søk i dokumenter"
            />
            <div className="segmented-control" role="group" aria-label="Dokumentfilter">
              {[
                ["all", "Alle"],
                ["ready", "Kildeklare"],
                ["control", "Krever kontroll"],
                ["unused", "Ikke brukt"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={documentFilter === value ? "is-active" : ""}
                  onClick={() => setDocumentFilter(value as typeof documentFilter)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {documents.length === 0 ? (
          <div className="empty-state">Ingen dokumenter registrert i valgt sak.</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state">Ingen dokumenter matcher filteret.</div>
        ) : (
          <div className="document-list">
            {filteredDocuments.map((document) => (
              <article key={document.id} className="document-row">
                <div>
                  <div className="document-primary">
                    <strong>{document.original_name}</strong>
                    {rowsById.get(document.id)?.label ? (
                      <span className={rowsById.get(document.id)?.canUseInAnswer ? "status-chip status-chip--ok" : "status-chip status-chip--warn"}>
                        {rowsById.get(document.id)?.label}
                      </span>
                    ) : null}
                  </div>
                  <button
                    className="button-ghost technical-toggle"
                    onClick={() => setExpandedDocumentId((current) => (current === document.id ? "" : document.id))}
                  >
                    {expandedDocumentId === document.id ? "Skjul tekniske detaljer" : "Vis tekniske detaljer"}
                  </button>
                  {expandedDocumentId === document.id ? (
                    <div className="technical-details">
                      <span>{document.id}</span>
                      <span>{document.mime_type || "ukjent type"}</span>
                      <code>{document.sha256}</code>
                    </div>
                  ) : null}
                </div>
                <div className="case-row__meta">
                  <span>{countLabel(document.page_count, "side", "sider")}</span>
                  <span>{document.analyzed_page_count || 0} analysert</span>
                  <span>{document.pending_ocr_page_count || 0} sider venter på tekst</span>
                  <span>{countLabel(document.source_count, "kilde", "kilder")}</span>
                  <span>{documentReadiness(document).label}</span>
                  <span>{Math.round(document.source_coverage_percent)} % av sidene kan brukes som kilde</span>
                </div>
              </article>
            ))}
          </div>
        )}
        {hasDocuments && !hasSources ? (
          <div className="warning-notice">
            Dokumentet er registrert, men saken har ingen sporbare kilder ennå. Evida venter på automatisk teksthenting.
          </div>
        ) : null}
        {hasDocuments ? <div className="workflow-notice">{userCoverageExplanation}</div> : null}
        {reindexStatus ? <div className="notice">{reindexStatus}</div> : null}
      </section>
    );
  }

  function AuditPanel() {
    return (
      <section className="panel">
        <div className="panel-header">
          <h2>Audit trail</h2>
        </div>
        {audit.length === 0 ? (
          <div className="empty-state">Ingen audit events for valgt sak.</div>
        ) : (
          <div className="audit-list">
            {audit.slice(0, 12).map((event) => (
              <article key={event.id} className="audit-row">
                <strong>{event.action}</strong>
                <span>{event.target_type}</span>
                <span>{event.created_at}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function DocumentBasisGroup({
    title,
    rows,
    emptyText,
    mode = "status",
    sectionId,
    titleId,
    highlighted = false
  }: {
    title: string;
    rows: DocumentBasisRow[];
    emptyText: string;
    mode?: "status" | "review" | "unused";
    sectionId?: string;
    titleId?: string;
    highlighted?: boolean;
  }) {
    return (
      <section id={sectionId} className={`document-basis-group ${highlighted ? "document-basis-group--highlighted" : ""}`}>
        <div className="document-basis-group__header">
          <h3 id={titleId} tabIndex={titleId ? -1 : undefined}>{title}</h3>
          <span>{countLabel(rows.length, "dokument", "dokumenter")}</span>
        </div>
        {rows.length === 0 ? (
          <p className="muted">{emptyText}</p>
        ) : hasActiveProcessing ? (
          <ImportProgressSummary
            {...importProgress}
            isImporting={true}
            attentionItems={progressAttentionItems}
            failedItems={progressFailedItems}
            detailsOpen={showImportQueueDetails}
            statusMessage="Evida behandler dokumentene automatisk."
            onShowAttentionItems={() => handleFirstUserPrimaryAction("review")}
            onShowDetails={() => setShowImportQueueDetails((current) => !current)}
            onOpenAttentionItem={(item) => void handlePreviewDocumentById(item.documentId || item.id)}
          />
        ) : (
          <div className="document-basis-list">
            {rows.map((row) => (
              <article
                key={row.id}
                className={`${mode === "review" ? "control-document-card" : "document-basis-row"} document-basis-row--${row.state}`}
              >
                <div className={mode === "review" ? "control-document-main" : "document-basis-row__main"}>
                  <div className="document-primary">
                    <strong>{row.name}</strong>
                    <span className={row.canUseInAnswer ? "status-chip status-chip--ok" : "status-chip status-chip--warn"}>
                      {row.label}
                    </span>
                  </div>
                  <p>{row.reason}</p>
                  <details className="technical-disclosure document-basis-row__details">
                    <summary>Vis tekniske detaljer</summary>
                    <div className="case-row__meta">
                      <span>{countLabel(row.pageCount, "side", "sider")}</span>
                      <span>{row.analyzedPages} analysert</span>
                      <span>{row.pendingOcrPages} venter på tekst</span>
                      <span>{row.sourceCount} kildeutdrag</span>
                      <span>{row.sourceCoveragePercent} % kildeklar</span>
                      <span>Hash {row.hash.slice(0, 12)}</span>
                    </div>
                  </details>
                  {row.approvedAt ? <small>Kontrollert av {row.approvedBy || "local-user"} {row.approvedAt}</small> : null}
                  {row.rejectedAt ? <small>Avvist av {row.rejectedBy || "local-user"} {row.rejectedAt}</small> : null}
                  {approvalSuccessId === row.id ? <small className="document-approval-inline">✓ Kontrollert</small> : null}
                </div>
                <aside className={mode === "review" ? "control-document-actions" : "document-basis-row__actions"}>
                  <button className="button-secondary" type="button" onClick={() => void handlePreviewDocument(row)} disabled={!row.canPreview}>
                    Åpne preview
                  </button>
                  {mode === "review" ? (
                    <label className="review-confirmation">
                      <input
                        type="checkbox"
                        checked={Boolean(reviewApprovalChecks[row.id])}
                        onChange={(event) =>
                          setReviewApprovalChecks((current) => ({ ...current, [row.id]: event.target.checked }))
                        }
                      />
                      <span>Jeg har sett dokumentet og bekrefter at det kan brukes i saken.</span>
                    </label>
                  ) : null}
                  {row.canApprove ? (
                    <button
                      className="button-primary"
                      type="button"
                      onClick={() => void handleDocumentApproval(row, "approve_for_ai")}
                      disabled={
                        approvalSavingId === row.id ||
                        approvalSuccessId === row.id ||
                        (mode === "review" && !canApproveSourceAfterPreview(Boolean(reviewApprovalChecks[row.id])))
                      }
                    >
                      {approvalSavingId === row.id
                        ? "Lagrer ..."
                        : approvalSuccessId === row.id
                          ? "Kontrollert"
                          : approvalActionLabel(row)}
                    </button>
                  ) : null}
                  {row.canReject ? (
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={approvalSavingId === row.id}
                      onClick={() => void handleDocumentApproval(row, "reject_for_ai")}
                    >
                      Hold utenfor kildegrunnlaget
                    </button>
                  ) : null}
                  {mode === "review" || mode === "unused" ? (
                    <button className="button-secondary" type="button" onClick={() => void handleReplaceDocumentRow(row)}>
                      Erstatt fil
                    </button>
                  ) : null}
                </aside>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  function DocumentControlView() {
    const selectedRow = visibleReviewDocuments.find((row) => row.id === selectedControlDocumentId) || visibleReviewDocuments[0];
    const selectedRows = visibleReviewDocuments.filter((row) => controlSelectionIds.includes(row.id));
    const bulkPlan = deriveDocumentControlBulkPlan(selectedRows);
    const pendingBulkAction = bulkPlan.actions.find((action) => action.id === bulkConfirmAction);
    const previewSources = selectedRow ? sources.filter((source) => source.document_id === selectedRow.id).slice(0, 4) : [];
    const groupedRows = [
      { title: "OCR trengs", rows: visibleReviewDocuments.filter((row) => row.pendingOcrPages > 0 || /ocr/i.test(row.reason)) },
      { title: "Mangler tekst", rows: visibleReviewDocuments.filter((row) => row.sourceCount === 0 && row.pendingOcrPages === 0) },
      { title: "Feilet import", rows: visibleReviewDocuments.filter((row) => row.state === "needs_user_action") },
      { title: "Annen kontroll", rows: visibleReviewDocuments.filter((row) => row.sourceCount > 0 && row.pendingOcrPages === 0 && row.state !== "needs_user_action") }
    ].filter((group) => group.rows.length > 0);

    return (
      <section className="document-control-workspace" aria-labelledby="document-control-title">
        <div className="document-control-hero">
          <div>
            <div className="eyebrow">Dokumentkontroll</div>
            <h2 id="document-control-title">Kontroller kildegrunnlaget</h2>
            <p>
              Du godkjenner ikke at innholdet er juridisk sant. Du bestemmer bare om dokumentet kan inngå i sakens
              kildegrunnlag, eller om det skal holdes utenfor.
            </p>
          </div>
          <div className="document-control-status" aria-live="polite">
            <strong>{countLabel(visibleReviewDocuments.length, "dokument", "dokumenter")} igjen</strong>
            <span>{importOutcome.readyForSaksrom} dokumenter er klare for Saksrom</span>
          </div>
        </div>
        <ol className="control-flow-strip" aria-label="Kontrollflyt">
          <li className={selectedRow ? "is-active" : ""}>
            <span>1</span>
            <strong>Velg dokument</strong>
            <small>{selectedRow?.name || "Ingen dokument valgt"}</small>
          </li>
          <li>
            <span>2</span>
            <strong>Forhåndsvis</strong>
            <small>Sjekk original og kildeutdrag</small>
          </li>
          <li>
            <span>3</span>
            <strong>Beslutt</strong>
            <small>Bruk, erstatt eller hold utenfor</small>
          </li>
        </ol>

        {selectedRows.length > 0 ? (
          <div className="bulk-selection-bar" data-testid="bulk-selection-bar" role="region" aria-label="Bulkhandlinger for dokumentkontroll">
            <strong>{selectedRows.length} valgt</strong>
            <span>{bulkPlan.eligibleForControlled.length} kan markeres kontrollert</span>
            <div className="bulk-selection-bar__actions">
              {bulkPlan.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={action.id === "mark_controlled" ? "button-primary" : "button-secondary"}
                  disabled={!action.enabled || Boolean(approvalSavingId)}
                  title={action.description}
                  onClick={() => requestBulkAction(action.id)}
                >
                  {action.label}
                </button>
              ))}
              <button type="button" className="button-ghost" onClick={clearControlSelection}>
                Fjern valg
              </button>
            </div>
          </div>
        ) : null}

        {visibleReviewDocuments.length === 0 ? (
          <div className="panel document-control-complete">
            <h3>Dokumentkontroll er fullført</h3>
            <p>
              {documentBasis.readyCount} dokumenter er klare for Saksrom. {pendingOcrPages > 0
                ? `${pendingOcrPages} sider mangler tekst/OCR og er derfor ikke brukt som AI-kilder. Saksrom kan brukes foreløpig med ${Math.round(caseScopedSourceCoveragePercent)} % kildedekning.`
                : "Kildedekningen er fullført for dokumentene som kan brukes som AI-kilder."}
            </p>
            <div className="panel-actions">
              <button className="button-primary" type="button" onClick={() => setActiveView("caseRoom")}>
                {pendingOcrPages > 0 ? "Gå til Saksrom foreløpig" : "Gå til Saksrom"}
              </button>
              {pendingOcrPages > 0 ? (
                <>
                  <button className="button-secondary" type="button" onClick={() => void handleReindex()}>
                    Kjør OCR for full dekning
                  </button>
                  <button className="button-secondary" type="button" onClick={() => setActiveView("control")}>
                    Se sider som mangler tekst
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="document-control-layout">
            <aside className="document-control-queue" aria-label="Kontrollkø">
              <div className="document-control-queue__toolbar">
                <button type="button" className="button-secondary" onClick={selectVisibleControlRows}>
                  Velg alle synlige
                </button>
                <button type="button" className="button-ghost" onClick={clearControlSelection}>
                  Nullstill
                </button>
              </div>
              {groupedRows.map((group) => (
                <section key={group.title}>
                  <h3>{group.title}</h3>
                  {group.rows.map((row) => (
                    <div
                      key={row.id}
                      className={`document-control-queue__item ${selectedRow?.id === row.id ? "is-selected" : ""}`}
                      aria-current={selectedRow?.id === row.id ? "true" : undefined}
                    >
                      <label className="document-control-queue__select">
                        <input
                          type="checkbox"
                          checked={controlSelectionIds.includes(row.id)}
                          onChange={() => toggleControlSelection(row.id)}
                          aria-label={`Velg ${row.name}`}
                        />
                        <span>
                          <strong>{row.name}</strong>
                          <em>{row.label}</em>
                        </span>
                      </label>
                      <small>{row.reason}</small>
                      <button
                        type="button"
                        className="button-ghost"
                        onClick={() => {
                          setSelectedControlDocumentId(row.id);
                          handlePreviewDocument(row);
                        }}
                      >
                        Preview
                      </button>
                    </div>
                  ))}
                </section>
              ))}
            </aside>

            <main className="document-control-preview" data-testid="document-control-preview-pane">
              {selectedRow ? (
                <>
                  <div className="document-primary">
                    <h3>{selectedRow.name}</h3>
                    <span className="status-chip status-chip--warn">{selectedRow.label}</span>
                  </div>
                  <p>{selectedRow.reason}</p>
                  <div className="case-row__meta">
                    <span>{countLabel(selectedRow.pageCount, "side", "sider")}</span>
                    <span>{selectedRow.pendingOcrPages} sider venter på tekst</span>
                    <span>{selectedRow.sourceCount} kildeutdrag</span>
                    <span>{selectedRow.sourceCoveragePercent} % kildedekning</span>
                  </div>
                  <div className="document-control-preview__body">
                    <strong>{selectedRow.sourceCount > 0 ? "Tekstgrunnlag finnes" : "Ingen sikker tekst"}</strong>
                    <p>
                      {selectedRow.sourceCount > 0
                        ? "Dokumentet har kildeutdrag. Kontroller at previewen samsvarer med det som skal brukes som kildegrunnlag."
                        : "Dokumentet kan ikke siteres automatisk før OCR eller lesbar tekst finnes. Manuell kontroll gjør det bare tillatt i saken."}
                    </p>
                  </div>
                  <div className="document-control-preview__tabs" aria-label="Previewdetaljer">
                    <section>
                      <h4>Original</h4>
                      <p>{selectedRow.canPreview ? "Originalfil kan åpnes for visuell kontroll." : "Originalfil mangler lokal preview."}</p>
                    </section>
                    <section>
                      <h4>Kildeutdrag</h4>
                      {previewSources.length > 0 ? (
                        <ul>
                          {previewSources.map((source) => (
                            <li key={source.id}>
                              <strong>Side {source.page_start || "?"}</strong>
                              <span>{source.text_excerpt.slice(0, 180)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>Ingen kildeutdrag er klare for dette dokumentet.</p>
                      )}
                    </section>
                    <section>
                      <h4>Teknisk</h4>
                      <p>Hash {selectedRow.hash.slice(0, 16)} · Importert {selectedRow.importedAt}</p>
                    </section>
                  </div>
                  <button className="button-secondary" type="button" onClick={() => void handlePreviewDocument(selectedRow)}>
                    Åpne større preview
                  </button>
                </>
              ) : null}
            </main>

            <aside className="document-control-decision" aria-label="Beslutningspanel">
              {selectedRow ? (
                <>
                  <h3>Beslutning</h3>
                  <p>
                    Velg hva som skal skje med dokumentet. Alle valg audit-logges, og neste dokument åpnes automatisk.
                  </p>
                  <label className="review-confirmation">
                    <input
                      type="checkbox"
                      checked={Boolean(reviewApprovalChecks[selectedRow.id])}
                      onChange={(event) =>
                        setReviewApprovalChecks((current) => ({ ...current, [selectedRow.id]: event.target.checked }))
                      }
                    />
                    <span>Jeg har sett dokumentet og forstår at dette ikke er en juridisk sannhetsgodkjenning.</span>
                  </label>
                  <button
                    className="button-primary"
                    type="button"
                    disabled={
                      !canApproveSourceAfterPreview(Boolean(reviewApprovalChecks[selectedRow.id])) ||
                      approvalSavingId === selectedRow.id ||
                      selectedRow.state === "needs_user_action"
                    }
                    onClick={() => void handleControlDecision(selectedRow, "approve_for_ai")}
                  >
                    {approvalSavingId === selectedRow.id ? "Lagrer ..." : selectedRow.sourceCount > 0 ? "Bruk som kildegrunnlag" : "Marker som kontrollert"}
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={approvalSavingId === selectedRow.id}
                    onClick={() => void handleControlDecision(selectedRow, "reject_for_ai")}
                  >
                    Hold utenfor kildegrunnlaget
                  </button>
                  <button className="button-secondary" type="button" onClick={() => void handleReplaceDocumentRow(selectedRow)}>
                    Erstatt fil
                  </button>
                </>
              ) : null}
            </aside>
          </div>
        )}
        {pendingBulkAction ? (
          <div className="modal-backdrop" role="presentation">
            <div className="bulk-confirm-dialog" data-testid="bulk-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-confirm-title">
              <h3 id="bulk-confirm-title">Bekreft bulkhandling</h3>
              <p>
                {pendingBulkAction.id === "mark_controlled"
                  ? `${bulkPlan.eligibleForControlled.length} dokumenter markeres som kontrollert. Dette betyr ikke at innholdet er juridisk sant.`
                  : `${bulkPlan.excludeRows.length} dokumenter holdes utenfor kildegrunnlaget.`}
              </p>
              <label className="review-confirmation">
                <input
                  type="checkbox"
                  checked={bulkConfirmChecked}
                  onChange={(event) => setBulkConfirmChecked(event.target.checked)}
                />
                <span>Jeg forstår at dette bare gjelder kildegrunnlag og audit-logg.</span>
              </label>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button-primary"
                  disabled={!bulkConfirmChecked || Boolean(approvalSavingId)}
                  onClick={() => void runBulkAction(pendingBulkAction.id)}
                >
                  Bekreft
                </button>
                <button type="button" className="button-secondary" onClick={() => setBulkConfirmAction("")}>
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  function ControlView() {
    const checks = [
      { label: "Sak valgt", ok: Boolean(selectedCase), detail: selectedCase?.name || "Ingen sak" },
      { label: "PDF-sider", ok: totalPages > 0, detail: countLabel(totalPages, "side", "sider") },
      { label: "Analyserte sider", ok: analyzedPages > 0, detail: `${analyzedPages} av ${totalPages}` },
      { label: "Sporbare kilder", ok: hasSources, detail: countLabel(sources.length, "kilde", "kilder") },
      { label: "Tekststatus", ok: pendingOcrPages === 0 && hasDocuments, detail: pendingOcrPages > 0 ? `${pendingOcrPages} sider venter på tekst` : "Ingen ventende sider" },
      { label: "DB-kryptering", ok: Boolean(dbSecurity?.encrypted_at_rest), detail: dbSecurity?.cipher || "ukjent" },
      { label: "Audit trail", ok: audit.length > 0, detail: countLabel(audit.length, "event", "events") }
    ];

    return (
      <>
        <section className="panel next-step-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Neste steg</div>
              <h2>{importNextAction.title}</h2>
              <p>{importNextAction.description}</p>
              {importNextAction.saksromScope === "controlled_sources_only" ? (
                <p className="warning-notice">Saksgrunnlaget er ikke komplett ennå.</p>
              ) : null}
            </div>
            <button
              className="button-primary"
              type="button"
              aria-controls="documents-needing-control"
              onClick={handleImportNextAction}
            >
              {importNextAction.primaryLabel}
            </button>
          </div>
        </section>
        <ImportHealthCenter />
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Kontrollgrunnlag</h2>
              <p>{hasDocuments ? "Kontroller dokumentene som krever handling før de brukes i saken." : "Kontrollgrunnlag vises etter import."}</p>
            </div>
            <div className="panel-actions">
              <button className="button-secondary" onClick={() => void refresh(selectedCaseId)}>Oppdater</button>
            </div>
          </div>
          <div className="document-basis-board">
            <DocumentBasisGroup
                title="Dokumenter som trenger kontroll"
                rows={visibleReviewDocuments}
                emptyText="Ingen dokumenter venter på manuell kontroll."
                mode="review"
                sectionId="documents-needing-control"
                titleId="documents-needing-control-title"
                highlighted={controlAttentionHighlighted}
              />
            {visibleReviewDocuments.length === 0 ? (
              <>
                <DocumentBasisGroup
                  title="Klare dokumenter"
                  rows={documentBasis.readyDocuments}
                  emptyText="Ingen dokumenter er klare for Saksrom ennå."
                />
                <DocumentBasisGroup
                  title="Dokumenter som ikke ble brukt"
                  rows={documentBasis.unreadableDocuments}
                  emptyText="Ingen dokumenter er holdt utenfor kildegrunnlaget."
                  mode="unused"
                />
              </>
            ) : null}
          </div>
          <button
            className="button-secondary"
            type="button"
            onClick={() => setShowControlTechnicalDetails((current) => !current)}
          >
            {showControlTechnicalDetails ? "Skjul tekniske detaljer" : "Vis tekniske detaljer"}
          </button>
          {showControlTechnicalDetails ? (
            <div className="technical-disclosure__content">
              <section className="status-grid control-status-grid">
                <StatusCard label="Saker" value={totals.cases} detail="lokal database" />
                <StatusCard label="Dokumenter" value={caseCoverage.totalDocuments} detail="denne saken" />
                <StatusCard label="Sider" value={caseCoverage.totalPages} detail="denne saken" />
                <StatusCard label="Sporbare kilder" value={coverageAudit?.source_count ?? sources.length} detail="denne saken" tone="warn" />
              </section>
              <div className="check-grid">
                {checks.map((check) => (
                  <article key={check.label} className={`check-card ${check.ok ? "check-card--ok" : "check-card--warn"}`}>
                    <strong>{check.label}</strong>
                    <span>{check.ok ? "OK" : "Mangler"}</span>
                    <p>{check.detail}</p>
                  </article>
                ))}
              </div>
              <div className="document-basis-overview">
                <StatusCard label="Dokumentstatus" value={documentBasis.primaryStatusLabel} detail={documentBasis.etaLabel} tone={documentBasis.readyCount === documentBasis.totalCount && documentBasis.totalCount > 0 ? "ok" : "warn"} />
                <StatusCard label="Klare dokumenter" value={documentBasis.readyCount} detail={`av ${documentBasis.totalCount}`} tone={documentBasis.readyCount > 0 ? "ok" : "warn"} />
                <StatusCard label="Trenger kontroll" value={visibleReviewDocuments.length} detail="OCR eller tekst" tone={visibleReviewDocuments.length ? "warn" : "ok"} />
                <StatusCard label="Ikke lesbare" value={documentBasis.unreadableDocuments.length} detail="brukerhandling" tone={documentBasis.unreadableDocuments.length ? "warn" : "ok"} />
              </div>
              {coverageAudit ? (
                <section className="coverage-audit">
                  <div className="coverage-audit__header">
                    <div>
                      <h3>Dokumentdekning</h3>
                      <p>Side- og kildekontroll beregnes fra lokal database, ikke fra begrenset kildevisning i UI.</p>
                    </div>
                    <span className="status-chip">
                      {coverageAudit.pages_with_sources} av {coverageAudit.total_pages} sider med kilde
                    </span>
                  </div>
                  <div className="coverage-audit__list">
                    {coverageAudit.documents.map((document) => (
                      <article key={document.document_id} className="coverage-audit-row">
                        <div>
                          <strong>{document.original_name}</strong>
                          <span>
                            {document.pages_with_sources} av {document.page_count} sider kan brukes som kilde · {Math.round(document.source_coverage_percent)} %
                          </span>
                        </div>
                        <div>
                          <span className={document.status === "ready" ? "status-chip status-chip--ok" : "status-chip status-chip--warn"}>
                            {document.status === "ready" ? "Klar" : document.status === "partially_ready" ? "Delvis klar" : "Klargjøres"}
                          </span>
                          {document.missing_page_ranges.length > 0 ? (
                            <small>Mangler sider: {document.missing_page_ranges.join(", ")}</small>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
              {sources.length > 0 ? (
                <div className="source-preview-grid">
                  {sources.slice(0, 8).map((source) => (
                    <button key={source.id} className="source-preview-card" onClick={() => openSource(source.id)}>
                      <strong>{sourceTitle(source)}</strong>
                      <span className="line-clamp">{source.text_excerpt}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="panel-actions">
                <button className="button-secondary" onClick={handleReindex} disabled={!hasDocuments}>Oppdater kildeutdrag</button>
                <button className="button-secondary" onClick={() => void handleExportImportDiagnostics()}>Export JSON/CSV</button>
              </div>
            </div>
          ) : null}
          {deviations.length > 0 ? (
            <div className="warning-notice">{deviations.join(" ")}</div>
          ) : null}
          {dbSecurity?.warnings.length ? (
            <div className="warning-notice">{dbSecurity.warnings.join(" ")}</div>
          ) : null}
          {!hasDocuments ? <div className="blocked-hint">Kontrollgrunnlag vises etter import.</div> : null}
          {reindexStatus ? <div className="notice">{reindexStatus}</div> : null}
        </section>
      </>
    );
  }
  function DraftView() {
    return (
      <>
        <AiTrustContract />
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Utkast</h2>
              <p>Lokalt arbeidsutkast fra kontrollerte, sporbare kildeutdrag.</p>
            </div>
            <button className="button-primary" onClick={generateDraft}>Lag utkast</button>
          </div>
          <textarea readOnly value={draftText} placeholder="Utkast vises her etter at du trykker Lag utkast." />
        </section>
      </>
    );
  }

  function ExportView() {
    const exportAvailability = roomAvailabilityByView.export;
    return (
      <>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Eksport</h2>
              <p>Lokal evalueringsoppsummering og testverktøy.</p>
            </div>
            <button
              className="button-primary"
              onClick={generateExport}
              disabled={Boolean(exportAvailability?.requiresAcknowledgement && !exportPreliminaryAcknowledged)}
            >
              {exportAvailability?.primaryActionLabel || "Lag eksport"}
            </button>
          </div>
          {exportAvailability?.requiresAcknowledgement ? (
            <label className="review-confirmation export-acknowledgement">
              <input
                type="checkbox"
                checked={exportPreliminaryAcknowledged}
                onChange={(event) => setExportPreliminaryAcknowledged(event.target.checked)}
              />
              <span>{EXPORT_PRELIMINARY_ACKNOWLEDGEMENT}</span>
            </label>
          ) : null}
          <textarea readOnly value={exportText} placeholder="Eksport vises her etter at du trykker Lag eksport." />
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Test og cleanup</h2>
              <p>Slett testdata, åpne lokal datamappe eller eksporter diagnosepakke.</p>
            </div>
          </div>
          <div className="maintenance-actions">
            <button className="danger-button" onClick={() => setResetConfirmOpen(true)}>
              <RotateCcw size={16} /> Slett alle testdata
            </button>
            <button className="button-secondary" onClick={handleOpenDataFolder}>
              <FolderOpen size={16} /> Åpne lokal datamappe
            </button>
            <button className="button-secondary" onClick={handleExportDiagnostics}>
              <Download size={16} /> Eksporter diagnosepakke
            </button>
          </div>
          {maintenanceStatus ? <div className="notice">{maintenanceStatus}</div> : null}
        </section>
      </>
    );
  }

  function renderView() {
    if (!isWorkspaceUnlocked) {
      return <GuidedExperience />;
    }

    const activeRoomKey = roomKeyForView(activeView);
    const activeRoomAvailability = activeRoomKey ? roomAvailabilityByView[activeView] : undefined;
    if (activeRoomAvailability && !activeRoomAvailability.enabled) {
      return (
        <ReadinessGate
          title={`${viewTitles[activeView]} er ikke klart ennå.`}
          reason={activeRoomAvailability.reason}
        />
      );
    }

    switch (activeView) {
      case "overview":
        return <OverviewView />;
      case "documents":
        return (
          <>
            {cases.length === 0 ? <CasePanel /> : null}
            <ImportPanel />
            {hasDocuments && caseReadiness.sourceCoveragePercent < 80 ? <DocumentReadinessPanel /> : null}
            <DocumentList />
            <CaseList />
          </>
        );
      case "documentControl":
        return <DocumentControlView />;
      case "caseRoom":
        return (
          <>
            <CaseRoomView
              selectedCase={selectedCase}
              documents={documents}
              sources={aiReadySources}
              sourcesById={aiReadySourceById}
              importQueue={importQueue}
              isImporting={isImporting}
              importNow={importNow}
              totalPageCount={totalPages}
              processedPageCount={analyzedPages}
              sourcePageCount={pagesWithSources}
              missingSourcePageCount={pagesMissingSources}
              hasActiveProcessing={hasActiveProcessing}
              automaticTextRecognitionAvailable={automaticTextRecognitionAvailable}
              pendingOcrPages={pendingOcrPages}
              coverage={coveragePercent}
              deviations={deviations}
              readiness={caseReadiness}
              preliminaryBanner={preliminarySaksromBanner}
              nextActionTitle={nextAction.title}
              suppressProgressActions={showImportCompletion}
              systemStatus={{
                totalDocuments: importProgress.totalDocuments || documentBasis.totalCount,
                readyDocuments: documentBasis.readyCount,
                attentionDocuments: visibleReviewDocuments.length,
                failedDocuments: documentBasis.unreadableDocuments.length,
                processingDocuments: importProgress.processingDocuments,
                remainingDocuments: importProgress.remainingDocuments,
                sourceCoveragePercent: documentBasis.sourceCoveragePercent || caseScopedSourceCoveragePercent,
                ocrCoveragePercent,
                pendingOcrPages,
                isImporting: importProgress.state === "processing",
                currentPhaseLabel: importProgress.currentPhaseLabel,
                etaLabel: importProgress.state === "processing" && importProgress.remainingDocuments > 0 ? importProgress.etaLabel : "Ferdig",
                nextActionTitle: visibleReviewDocuments.length > 0 ? "Start kontroll" : nextAction.title,
                saksromScope: importOutcome.saksromScope,
                excludedDocuments: importOutcome.manualReviewRequired + importOutcome.notUsedAsSource
              }}
              preparationProgress={casePreparationProgress}
              onOpenSource={openSource}
              onOpenControl={() => handleFirstUserPrimaryAction("review")}
              onOpenSimulation={() => setActiveView("litigationSimulation")}
              onRunCommand={executeLegalCommandInput}
              onChooseDocuments={handleChooseFiles}
              onChooseFolder={handleChooseFolder}
              onImportPaths={(paths) => void importDocuments(paths)}
              onSaveCaseName={handleRenameCase}
            />
          </>
        );
      case "chronology":
        if (!canUsePreliminaryAnalysis) {
          return <ReadinessGate title="Kronologi er låst til dokumentgrunnlaget er klart." />;
        }
        return (
          <>
            <RoomModeNotice view="chronology" />
            <AiTrustContract />
            <ChronologyView
              items={timelineItems}
              sourcesById={sourceById}
              onBuild={buildChronology}
              onOpenSource={openSource}
              buildLabel={roomAvailabilityByView.chronology?.primaryActionLabel}
            />
          </>
        );
      case "evidence":
        if (!canUsePreliminaryAnalysis) {
          return <ReadinessGate title="Bevismatrise er låst til dokumentgrunnlaget er klart." />;
        }
        return (
          <>
            <RoomModeNotice view="evidence" />
            <AiTrustContract />
            <EvidenceView
              rows={evidenceRows}
              sourcesById={sourceById}
              onBuild={buildEvidence}
              onOpenSource={openSource}
              buildLabel={roomAvailabilityByView.evidence?.primaryActionLabel}
            />
          </>
        );
      case "arguments":
        if (!canUsePreliminaryAnalysis) {
          return <ReadinessGate title="Anførsler er låst til dokumentgrunnlaget er klart." />;
        }
        return (
          <>
            <RoomModeNotice view="arguments" />
            <AiTrustContract />
            <ArgumentsView
              rows={argumentRows}
              sourcesById={sourceById}
              onCreate={buildArguments}
              onOpenSource={openSource}
            />
          </>
        );
      case "contradictions":
        if (!canUsePreliminaryAnalysis) {
          return <ReadinessGate title="Motstrid er låst til dokumentgrunnlaget er klart." />;
        }
        return (
          <>
            <RoomModeNotice view="contradictions" />
            <AiTrustContract />
            <ContradictionsView
              rows={conflictRows}
              sourcesById={sourceById}
              onFind={buildContradictions}
              onOpenSource={openSource}
            />
          </>
        );
      case "risk":
        if (!canUsePreliminaryAnalysis) {
          return <ReadinessGate title="Risiko er låst til dokumentgrunnlaget er klart." />;
        }
        return (
          <>
            <RoomModeNotice view="risk" />
            <AiTrustContract />
            <RiskView rows={riskRows} onAssess={buildRisk} />
          </>
        );
      case "litigationSimulation":
        if (caseReadiness.verdict === "not_ready") {
          return <ReadinessGate title="Rettssimulering er låst til dokumentgrunnlaget er klart." />;
        }
        return (
          <>
            <RoomModeNotice view="litigationSimulation" />
            <LitigationSimulationView
              readinessVerdict={userFacingReadinessVerdict}
              sources={aiReadySources}
              onOpenSource={openSource}
            />
          </>
        );
      case "control":
        return <ControlView />;
      case "draft":
        if (!canUseDraftControl) {
          return <ReadinessGate title="Utkast er låst til dokumentgrunnlaget er klart for utkastkontroll." />;
        }
        return (
          <>
            <RoomModeNotice view="draft" />
            <DraftView />
          </>
        );
      case "export":
        if (!canUseDraftControl) {
          return <ReadinessGate title="Eksport er låst til dokumentgrunnlaget er klart for utkastkontroll." />;
        }
        return (
          <>
            <RoomModeNotice view="export" />
            <ExportView />
          </>
        );
    }
  }

  const isCaseRoomView = activeView === "caseRoom";
  const activeWorkroom = workroomKeyForView(activeView);
  const showNavigation = isWorkspaceUnlocked;
  const hasOpenModal =
    showImportCompletion ||
    casePickerOpen ||
    settingsOpen ||
    commandPaletteOpen ||
    Boolean(deleteTarget) ||
    resetConfirmOpen ||
    Boolean(activeSource) ||
    Boolean(previewDocument);
  const shellClassName = [
    "app-shell",
    !showNavigation ? "app-shell--guided" : "",
    showNavigation && activeView === "control" && showControlTechnicalDetails ? "app-shell--with-panel" : "",
    showNavigation && isCaseRoomView ? "app-shell--case-room" : "",
    hasOpenModal ? "app-shell--modal-active" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className={shellClassName} data-theme={theme} data-visual-mode={visualMode}>
      {showNavigation ? (
        <Sidebar
          activeView={activeView}
          onNavigate={setActiveView}
          hasDocuments={hasDocuments}
          readinessVerdict={userFacingReadinessVerdict}
          roomAvailabilityByView={roomAvailabilityByView}
          onNewCase={() => void handleCreateCase()}
          onNewCaseInNewWindow={() => void handleNewCaseInNewWindow()}
          onOpenCaseSwitcher={() => setCasePickerOpen(true)}
          isCreatingCase={isCreatingCase}
        />
      ) : null}
      <main className={`workspace ${!showNavigation ? "workspace--guided" : ""} ${showNavigation && isCaseRoomView ? "workspace--chat" : ""}`}>
        {showNavigation ? (
          <DesktopMenuBar
            onNewCase={() => void handleCreateCase()}
            onNewCaseWindow={() => void handleNewCaseInNewWindow()}
            onOpenCaseSwitcher={() => setCasePickerOpen(true)}
            onImportDocuments={() => void handleChooseFiles()}
            onImportFolder={() => void handleChooseFolder()}
            onExport={() => setActiveView("export")}
            onCloseCase={handleCloseCase}
            onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenDataFolder={() => void openLocalDataFolder()}
          />
        ) : null}
        {showNavigation && !isCaseRoomView ? (
          <CaseHeader
            selectedCase={selectedCase}
            coveragePercent={caseReadiness.sourceCoveragePercent}
            hasDocuments={hasDocuments}
            hasSources={hasSources}
            pendingOcrPages={pendingOcrPages}
            deviations={deviations}
            onOpenCaseSwitcher={() => setCasePickerOpen(true)}
            onNewCase={() => void handleCreateCase()}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : null}
        {showNavigation && !isCaseRoomView ? (
          <header className="topbar">
            <div>
              <div className="topbar-labels">
                <span className="evaluation-pill">PRE-ALPHA · testdata only</span>
                <span className="local-pill">Sikker lokalmodus</span>
              </div>
              <h1>{viewTitles[activeView]}</h1>
              <p>{status}</p>
            </div>
            <div className="topbar-actions">
              <button
                className="theme-toggle"
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                aria-label={theme === "dark" ? "Bytt til lys modus" : "Bytt til mørk modus"}
                title={theme === "dark" ? "Lys modus" : "Mørk modus"}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                <span>{theme === "dark" ? "Lys" : "Mørk"}</span>
              </button>
              <button className="command-button button-secondary" onClick={() => setCommandPaletteOpen(true)}>
                Ctrl + K · Sakspilot
              </button>
              <label className="visual-mode-switcher">
                <span>Visuell modus</span>
                <select value={visualMode} onChange={(event) => setVisualMode(event.target.value as VisualMode)}>
                  <option value="calm">Calm</option>
                  <option value="standard">Standard</option>
                  <option value="focusPlus">Focus+</option>
                </select>
              </label>
            </div>
          </header>
        ) : null}

        {showNavigation && !isCaseRoomView ? (
          <div className="data-safety-banner" role="status">
            <strong>PRE-ALPHA</strong>
            <span>Bruk testdata. Lokal behandling er aktiv. Ekstern AI brukes bare når provider er eksplisitt konfigurert.</span>
            {dbSecurity?.encrypted_at_rest ? (
              <span>Kryptert lagring: {dbSecurity.cipher}</span>
            ) : (
              <span>Kryptering ikke verifisert for ekte klientdata.</span>
            )}
          </div>
        ) : null}

        {caseCreationError ? <div className="error-notice" role="alert">{caseCreationError}</div> : null}

        {showNavigation && !isCaseRoomView && activeView !== "control" ? (
          <div className="command-center-stack">
            <WorkroomHeader
              workroom={activeWorkroom}
              stats={[
                { label: "Dokumentkontroll", value: !hasDocuments ? "Venter" : documentControlComplete ? "Fullført" : `${visibleReviewDocuments.length} igjen`, tone: documentControlComplete ? "ok" : "warn" },
                { label: "Kildedekning", value: hasDocuments ? `${Math.round(caseScopedSourceCoveragePercent)} %` : "Venter på dokumenter", tone: caseScopedSourceCoveragePercent >= 100 ? "ok" : "warn" },
                { label: "OCR", value: !hasDocuments ? "Venter" : pendingOcrPages > 0 ? `${pendingOcrPages} sider gjenstår` : "Fullført", tone: pendingOcrPages > 0 ? "warn" : "ok" },
                { label: "Analyse-rom", value: roomAvailabilityByView.caseRoom?.enabled ? roomAvailabilityByView.caseRoom.mode === "preliminary" ? "Foreløpig åpnet" : "Klar" : roomAvailabilityByView.caseRoom?.label || "Venter", tone: roomAvailabilityByView.caseRoom?.enabled ? "ok" : "warn" }
              ]}
            />
            <CaseVitalityBar vitality={caseVitality} />
          </div>
        ) : null}
        {showNavigation && isCaseRoomView ? (
          <CaseVitalityBar vitality={caseVitality} compact />
        ) : null}

        {renderView()}
      </main>
      {showNavigation && activeView === "control" && showControlTechnicalDetails ? (
        <SourcePanel
          selectedCase={selectedCase}
          coverage={caseReadiness.sourceCoveragePercent}
          totalPages={totalPages}
          processedPages={analyzedPages}
          pagesWithSources={pagesWithSources}
          pagesMissingSources={pagesMissingSources}
          ocrStatus={pendingOcrPages > 0 ? `${pendingOcrPages} sider venter på tekst` : "Ingen ventende sider"}
          sourceCount={sources.length}
          deviations={deviations}
          nextAction={nextAction}
        />
      ) : null}
      <SourcePreviewDrawer source={activeSource} onClose={() => setActiveSource(undefined)} />
      <DocumentPreviewDrawer
        document={previewDocument}
        sources={previewDocumentSources}
        isOpen={Boolean(previewDocument)}
        approvalState={
          previewDocument && approvalSavingId === previewDocument.id
            ? "saving"
            : previewDocument && approvalSuccessId === previewDocument.id
              ? "approved"
              : "idle"
        }
        attentionRemaining={visibleReviewDocuments.filter((row) => row.id !== previewDocument?.id).length}
        onClose={() => setPreviewDocument(null)}
        onApproveAsSource={(documentId) => void handleApprovePreviewDocument(documentId)}
        onExcludeFromCase={(documentId) => void handleExcludePreviewDocument(documentId)}
        onReplaceFile={(documentId) => void handleReplacePreviewDocument(documentId)}
        onOpenOriginalFolder={(path) => void handleOpenDocumentPreviewFolder(path)}
      />
      {approvalToast ? (
        <div className="snackbar" role="status" aria-live="polite">
          {approvalToast}
        </div>
      ) : null}
      <ImportCompletionModal />
      <CaseSwitcher
        open={casePickerOpen && showNavigation}
        cases={cases}
        activeCaseId={selectedCaseId || null}
        onClose={() => setCasePickerOpen(false)}
        onOpenInCurrentWindow={(caseId) => void handleOpenCaseInCurrentWindow(caseId)}
        onOpenInNewWindow={(caseId) => void handleOpenCaseInNewWindow(caseId)}
        onRenameCase={(caseId, name) => void handleRenameCaseFromSwitcher(caseId, name)}
      />
      <SettingsView
        open={settingsOpen}
        dbSecurity={dbSecurity}
        onClose={() => setSettingsOpen(false)}
        onOpenDataFolder={() => void openLocalDataFolder()}
      />
      {commandPaletteOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setCommandPaletteOpen(false)}>
          <div
            className="modal command-palette"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-palette-title"
            tabIndex={-1}
            onKeyDown={(event) => closeDialogOnEscape(event, () => setCommandPaletteOpen(false))}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="command-palette-title">Sakspilot</h2>
            <p>Bruk juridiske kommandoer eller hopp til riktig arbeidsflate. Kommandoer følger readiness-gating.</p>
            <form
              className="command-palette__form"
              onSubmit={(event) => {
                event.preventDefault();
                void runCommandPalette();
              }}
            >
              <input
                value={commandInput}
                onChange={(event) => setCommandInput(event.target.value)}
                placeholder="'kronologi, 'bevis, 'risiko, 'kvalitet ..."
                autoFocus
              />
              <button className="button-primary" disabled={!commandInput.trim()}>Kjør</button>
            </form>
            <div className="command-palette__grid">
              {LEGAL_COMMANDS.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  className="button-ghost"
                  onClick={() => {
                    setCommandInput(command.trigger);
                    void executeLegalCommand(command).then(setCommandStatus);
                  }}
                >
                  <strong>{command.trigger}</strong>
                  <span>{command.label}</span>
                </button>
              ))}
            </div>
            {commandStatus ? <div className="notice">{commandStatus}</div> : null}
            <div className="modal-actions">
              <button className="button-secondary" onClick={() => setCommandPaletteOpen(false)}>Lukk</button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteTarget ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setDeleteTarget(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-case-title"
            tabIndex={-1}
            onKeyDown={(event) => closeDialogOnEscape(event, () => setDeleteTarget(null))}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-case-title">Slett sak?</h2>
            <p>Saken fjernes fra aktiv liste. Data soft-deletes og audit event CASE_SOFT_DELETED registreres.</p>
            <div className="modal-actions">
              <button className="button-secondary" onClick={() => setDeleteTarget(null)} autoFocus>Avbryt</button>
              <button className="danger-button" onClick={confirmDeleteCase}>Slett sak</button>
            </div>
          </div>
        </div>
      ) : null}
      {resetConfirmOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setResetConfirmOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-testdata-title"
            tabIndex={-1}
            onKeyDown={(event) => closeDialogOnEscape(event, () => setResetConfirmOpen(false))}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reset-testdata-title">Slett alle testdata?</h2>
            <p>Dette fjerner lokale evalueringssaker, dokumenter, kilder og audit-events fra testdatabasen.</p>
            <div className="modal-actions">
              <button className="button-secondary" onClick={() => setResetConfirmOpen(false)} autoFocus>Avbryt</button>
              <button className="danger-button" onClick={confirmResetTestData}>Slett testdata</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

