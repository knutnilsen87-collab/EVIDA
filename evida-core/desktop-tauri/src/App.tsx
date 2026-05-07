import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Download, FolderOpen, Moon, RotateCcw, Sun, Trash2 } from "lucide-react";
import {
  chooseDocumentPaths,
  createCase,
  assessRisk as assessRiskApi,
  buildChronology as buildChronologyApi,
  buildEvidenceMatrix,
  createArgumentItem,
  exportDiagnostics,
  findContradictions as findContradictionsApi,
  getAppStatus,
  getDatabaseSecurityStatus,
  hasDesktopRuntime,
  listAuditEvents,
  listCases,
  listDocuments,
  listSourceObjects,
  listWorkItems,
  openLocalDataFolder,
  reindexCaseDocuments,
  registerDocument,
  resetTestData,
  softDeleteCase
} from "./lib/api";
import type {
  AuditEvent,
  CaseReadinessVerdict,
  CaseSummary,
  DatabaseSecurityStatus,
  DocumentSummary,
  SourceObjectSummary,
  ViewKey
} from "./types";
import { NextAction } from "./components/NextAction";
import { PdfImportPanel } from "./components/PdfImportPanel";
import { Sidebar } from "./components/Sidebar";
import { SourcePanel } from "./components/SourcePanel";
import { SourcePreviewDrawer } from "./components/SourcePreviewDrawer";
import { StatusCard } from "./components/StatusCard";
import { CaseRoomView } from "./components/CaseRoomView";
import { LitigationSimulationView } from "./components/LitigationSimulationView";
import { ArgumentsView } from "./components/workrooms/ArgumentsView";
import { ChronologyView } from "./components/workrooms/ChronologyView";
import { ContradictionsView } from "./components/workrooms/ContradictionsView";
import { EvidenceView } from "./components/workrooms/EvidenceView";
import { RiskView } from "./components/workrooms/RiskView";
import { sourceTitle } from "./components/workrooms/SourceButtonList";
import type {
  ArgumentRow,
  ConflictRow,
  EvidenceRow,
  RiskRow,
  TimelineItem
} from "./components/workrooms/types";

const viewTitles: Record<ViewKey, string> = {
  overview: "Saksoversikt",
  documents: "Dokumenter",
  caseRoom: "Saksrom",
  chronology: "Kronologi",
  evidence: "Bevismatrise",
  arguments: "Anførsler",
  contradictions: "Motstrid",
  risk: "Risiko",
  litigation: "Rettssimulering",
  draft: "Utkast",
  control: "Kontrollgrunnlag",
  export: "Eksport"
};

const THEME_STORAGE_KEY = "evida-theme";
const AI_TRUST_STORAGE_KEY = "evida-ai-trust-seen";
const EVAL_SESSION_STORAGE_KEY = "evida-eval-session";
const EVAL_LOGIN_EMAIL = "eval@evida.local";
const EVAL_LOGIN_PASSWORD = "eval-2026";

type ThemeMode = "light" | "dark";
type OnboardingStage = "intro" | "login" | "start" | "import" | "caseRoom";
type ImportQueueStatus =
  | "selected"
  | "validating"
  | "hashing"
  | "extracting"
  | "chunking"
  | "ready"
  | "needs_attention"
  | "failed";

interface ImportQueueItem {
  path: string;
  name: string;
  status: ImportQueueStatus;
  detail: string;
  pages?: number;
  sources?: number;
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
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

function importStatusLabel(status: ImportQueueStatus) {
  switch (status) {
    case "selected":
      return "Valgt";
    case "validating":
      return "Sjekker fil";
    case "hashing":
      return "Beregner hash";
    case "extracting":
      return "Leser tekst";
    case "chunking":
      return "Lager kildegrunnlag";
    case "ready":
      return "Klar";
    case "needs_attention":
      return "Krever oppmerksomhet";
    case "failed":
      return "Feilet";
  }
}

function documentReadiness(document: DocumentSummary) {
  if (document.source_count > 0) {
    return {
      status: "ready" as const,
      label: "Klar for Saksrom",
      detail: `${countLabel(document.page_count, "side", "sider")} · ${countLabel(document.source_count, "kildeutdrag", "kildeutdrag")}`
    };
  }
  if (["needs_ocr", "partial_needs_ocr", "failed", "empty", "unsupported_file_type"].includes(document.ocr_status)) {
    return {
      status: "needs_attention" as const,
      label: "Krever oppmerksomhet",
      detail:
        document.pending_ocr_page_count > 0
          ? `${countLabel(document.pending_ocr_page_count, "side", "sider")} trenger OCR eller tekstkontroll`
          : "Ingen lesbare kildeutdrag funnet"
    };
  }
  return {
    status: "processing" as const,
    label: "Behandles",
    detail: document.analyzed_page_count > 0 ? `${document.analyzed_page_count} sider analysert` : "Venter på behandling"
  };
}

function buildReadinessVerdict(params: {
  selectedCase?: CaseSummary;
  hasDocuments: boolean;
  hasSources: boolean;
  coveragePercent: number;
  pendingOcrPages: number;
  deviations: string[];
  analyzedPages: number;
  totalPages: number;
  hasAnalysis: boolean;
  sourceCount: number;
}): CaseReadinessVerdict {
  const {
    selectedCase,
    hasDocuments,
    hasSources,
    coveragePercent,
    pendingOcrPages,
    deviations,
    analyzedPages,
    totalPages,
    hasAnalysis,
    sourceCount
  } = params;

  if (!selectedCase || !hasDocuments) {
    return {
      status: "not_ready",
      label: "Ikke klar",
      description: "Saken trenger dokumenter før Evida kan lage kildebasert analyse.",
      detail: selectedCase ? "Importer minst ett dokument." : "Opprett eller velg en sak.",
      nextStep: selectedCase ? "Importer dokument" : "Opprett sak"
    };
  }

  if (!hasSources) {
    return {
      status: "needs_control",
      label: "Krever kontroll",
      description: "Dokumenter finnes, men mangler sporbare kildeutdrag.",
      detail: "Kjør import/reindeksering eller OCR/tekstkontroll.",
      nextStep: "Åpne kontrollgrunnlag"
    };
  }

  if (pendingOcrPages > 0 || deviations.length > 0 || analyzedPages < totalPages || coveragePercent < 50) {
    return {
      status: "needs_control",
      label: "Krever kontroll",
      description: "Saken kan brukes foreløpig, men dokumentgrunnlaget har åpne kontrollpunkter.",
      detail: deviations.length ? deviations.join(" ") : `${pendingOcrPages} sider trenger OCR eller tekstkontroll.`,
      nextStep: "Løs avvik før utkast eller endelig kontroll"
    };
  }

  if (coveragePercent >= 95 && hasAnalysis) {
    return {
      status: "draft_ready",
      label: "Klar for utkastkontroll",
      description: "Kilder og første analyse er klare nok for kontrollert utkastarbeid.",
      detail: `${coveragePercent}% kildeklar dekning, ${countLabel(sourceCount, "kildeutdrag", "kildeutdrag")}.`,
      nextStep: "Kjør kvalitet/endelig kontroll før bruk"
    };
  }

  return {
    status: "preliminary_ready",
    label: "Klar for foreløpig analyse",
    description: "Saksrom kan lage kildebaserte foreløpige svar, kronologi og bevisliste.",
    detail: `${coveragePercent}% kildeklar dekning.`,
    nextStep: "Bygg kronologi og bevismatrise"
  };
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(EVAL_SESSION_STORAGE_KEY) === "true";
  });
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>(() => {
    if (typeof window === "undefined") {
      return "intro";
    }
    return "intro";
  });
  const [casePickerOpen, setCasePickerOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState(EVAL_LOGIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState(EVAL_LOGIN_PASSWORD);
  const [loginError, setLoginError] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  });
  const [status, setStatus] = useState("Starter ...");
  const [dbSecurity, setDbSecurity] = useState<DatabaseSecurityStatus | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [sources, setSources] = useState<SourceObjectSummary[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [caseName, setCaseName] = useState("Ny prosessak");
  const [documentPath, setDocumentPath] = useState("");
  const [lastImport, setLastImport] = useState("");
  const [importQueue, setImportQueue] = useState<ImportQueueItem[]>([]);
  const [processingLog, setProcessingLog] = useState<string[]>([]);
  const [importError, setImportError] = useState("");
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);
  const [expandedDocumentId, setExpandedDocumentId] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [exportText, setExportText] = useState("");
  const [maintenanceStatus, setMaintenanceStatus] = useState("");
  const [reindexStatus, setReindexStatus] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CaseSummary | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<SourceObjectSummary | undefined>();
  const [litigationContext, setLitigationContext] = useState("");
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

  async function refresh(preferredCaseId = selectedCaseId) {
    setStatus(await getAppStatus());
    getDatabaseSecurityStatus().then(setDbSecurity).catch(() => setDbSecurity(null));
    const nextCases = await listCases();
    setCases(nextCases);
    const activeCaseId =
      nextCases.find((item) => item.id === preferredCaseId)?.id || nextCases[0]?.id || "";
    setSelectedCaseId(activeCaseId);

    if (activeCaseId) {
      const [nextDocuments, nextSources, nextAudit, nextWorkItems] = await Promise.all([
        listDocuments(activeCaseId),
        listSourceObjects(activeCaseId),
        listAuditEvents(activeCaseId),
        listWorkItems(activeCaseId)
      ]);
      setDocuments(nextDocuments);
      setSources(nextSources);
      setAudit(nextAudit);
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
    if (isAuthenticated) {
      window.localStorage.setItem(EVAL_SESSION_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(EVAL_SESSION_STORAGE_KEY);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    window.localStorage.setItem(AI_TRUST_STORAGE_KEY, trustContractHidden ? "true" : "false");
  }, [trustContractHidden]);

  const selectedCase = cases.find((item) => item.id === selectedCaseId);
  const hasDocuments = documents.length > 0;
  const hasSources = sources.length > 0;
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const needsOcr = documents.some((document) =>
    ["needs_ocr", "partial_needs_ocr", "failed"].includes(document.ocr_status)
  );
  const analyzedPages = documents.reduce((sum, document) => sum + (document.analyzed_page_count || 0), 0);
  const pendingOcrPages = documents.reduce((sum, document) => sum + (document.pending_ocr_page_count || 0), 0);
  const totalPages = documents.reduce((sum, document) => sum + document.page_count, 0);
  const processedDocuments = documents.filter(
    (document) => document.source_count > 0 || document.analyzed_page_count > 0
  );
  const documentsRequiringAttention = documents.filter((document) =>
    ["needs_ocr", "partial_needs_ocr", "failed", "empty", "unsupported_file_type"].includes(document.ocr_status)
  );
  const isWorkspaceUnlocked = isAuthenticated && onboardingStage === "caseRoom";
  const hasAnalysis = timelineItems.length > 0 || evidenceRows.length > 0 || riskRows.length > 0;

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

  const coveragePercent = selectedCase?.source_coverage_percent || 0;
  const userCoverageExplanation = hasDocuments
    ? `${coveragePercent}% av sidene kan brukes som sporbare kildeutdrag. ${
        coveragePercent < 100
          ? `${100 - coveragePercent}% m\u00e5 OCR-behandles eller kontrolleres f\u00f8r AI-analyse.`
          : "Dokumentgrunnlaget er klart for kontrollert analyse."
      }`
    : "Importer et dokument for \u00e5 se hva AI trygt kan bruke.";

  const deviations = useMemo(() => {
    const items: string[] = [];
    if (hasDocuments && !hasSources) {
      items.push("Dokument finnes, men ingen sporbare kildeutdrag er bygget.");
    }
    if (needsOcr) {
      items.push("Minst ett dokument trenger OCR eller tekstkontroll.");
    }
    if (hasDocuments && analyzedPages < totalPages) {
      items.push(`${countLabel(totalPages - analyzedPages, "side", "sider")} mangler sporbare kildeutdrag.`);
    }
    return items;
  }, [analyzedPages, hasDocuments, hasSources, needsOcr, totalPages]);

  const readinessVerdict = useMemo(
    () =>
      buildReadinessVerdict({
        selectedCase,
        hasDocuments,
        hasSources,
        coveragePercent,
        pendingOcrPages,
        deviations,
        analyzedPages,
        totalPages,
        hasAnalysis,
        sourceCount: sources.length
      }),
    [
      selectedCase,
      hasDocuments,
      hasSources,
      coveragePercent,
      pendingOcrPages,
      deviations,
      analyzedPages,
      totalPages,
      hasAnalysis,
      sources.length
    ]
  );

  async function handleCreateCase() {
    const name = caseName.trim() || "Ny sak";
    const created = await createCase(name, "NO");
    setCaseName("");
    await refresh(created.id);
    setOnboardingStage("import");
    setActiveView("documents");
  }

  const buildChronology = useCallback(async () => {
    if (!hasSources) {
      setReindexStatus("Kronologi trenger sporbare kildeutdrag. Importer tekstgrunnlag eller oppdater kildeutdrag f\u00f8rst.");
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
  }, [hasSources, selectedCaseId]);

  const buildEvidence = useCallback(async () => {
    if (!hasSources) {
      setReindexStatus("Bevismatrise trenger sporbare kildeutdrag. Importer tekstgrunnlag eller oppdater kildeutdrag f\u00f8rst.");
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
  }, [hasSources, selectedCaseId]);

  async function buildArguments() {
    if (!hasSources) {
      setReindexStatus("Anf\u00f8rsler trenger et kontrollert grunnlag med sporbare kildeutdrag f\u00f8rst.");
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
    if (sources.length < 2) {
      setReindexStatus("Motstridsanalyse trenger minst to sporbare kildeutdrag.");
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
    if (!hasSources) {
      setReindexStatus("Risikovurdering trenger sporbare kildeutdrag.");
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
    if (!hasSources || needsOcr) {
      return {
        step: 3,
        stepTotal: 6,
        title: "Sjekk hva AI trygt kan bruke",
        description: "Se sider, OCR-status og sporbare kildeutdrag f\u00f8r analyse.",
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
    hasSources,
    needsOcr,
    activeView,
    timelineItems.length,
    evidenceRows.length,
    buildChronology,
    buildEvidence
  ]);

  const importDocuments = useCallback(
    async (paths: string[]) => {
      const cleanPaths = paths.map((path) => path.trim()).filter(Boolean);
      if (!selectedCaseId) {
        setImportError("Velg eller opprett en sak før du importerer dokumenter.");
        return;
      }
      if (cleanPaths.length === 0) {
        return;
      }

      setImportError("");
      setIsImporting(true);
      setImportQueue(
        cleanPaths.map((path) => ({
          path,
          name: fileNameFromPath(path),
          status: "selected",
          detail: "Klar til import"
        }))
      );
      const updateQueueItem = (path: string, patch: Partial<ImportQueueItem>) => {
        setImportQueue((current) =>
          current.map((item) => (item.path === path ? { ...item, ...patch } : item))
        );
      };
      setProcessingLog([
        "Validerer filer",
        "Beregner SHA-256",
        "Registrerer dokumenter i lokal database"
      ]);
      try {
        const reports = [];
        for (const path of cleanPaths) {
          const name = fileNameFromPath(path);
          updateQueueItem(path, { status: "validating", detail: "Sjekker filtype og størrelse" });
          setProcessingLog((current) => [...current, `Sjekker ${name}`]);
          updateQueueItem(path, { status: "hashing", detail: "Beregner SHA-256" });
          setProcessingLog((current) => [...current, `Beregner hash for ${name}`]);
          updateQueueItem(path, { status: "extracting", detail: "Leser tekst, sider og eventuell OCR-status" });
          const report = await registerDocument(selectedCaseId, path);
          updateQueueItem(path, {
            status: "chunking",
            detail: "Lager sporbare kildeutdrag",
            pages: report.pages_created,
            sources: report.sources_created
          });
          reports.push(report);
          updateQueueItem(path, {
            status: report.sources_created > 0 ? "ready" : "needs_attention",
            detail:
              report.sources_created > 0
                ? `${countLabel(report.pages_created, "side", "sider")} og ${countLabel(report.sources_created, "kildeutdrag", "kildeutdrag")} klare`
                : "Dokumentet er importert, men trenger OCR eller manuell tekstkontroll",
            pages: report.pages_created,
            sources: report.sources_created
          });
        }
        setDocumentPath("");
        const pageCount = reports.reduce((sum, report) => sum + report.pages_created, 0);
        const sourceCount = reports.reduce((sum, report) => sum + report.sources_created, 0);
        setLastImport(
          `${countLabel(reports.length, "dokument", "dokumenter")} importert: ${countLabel(
            pageCount,
            "side",
            "sider"
          )}, ${countLabel(sourceCount, "kildeutdrag", "kildeutdrag")}`
        );
        await runAutomaticAnalysis(selectedCaseId, sourceCount);
        await refresh(selectedCaseId);
        setProcessingLog((current) => [...current, "Saksrom er klart"]);
        setOnboardingStage("caseRoom");
        setActiveView("caseRoom");
      } catch (error) {
        setImportError(`Import feilet: ${String(error)}`);
        setImportQueue((current) =>
          current.map((item) =>
            ["ready", "needs_attention"].includes(item.status)
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

  async function handleChooseFiles() {
    const paths = await chooseDocumentPaths();
    if (paths.length === 0 && !hasDesktopRuntime()) {
      fileInputRef.current?.click();
      return;
    }
    await importDocuments(paths);
  }

  function handleEvalLogin() {
    const email = loginEmail.trim().toLowerCase();
    if (email !== EVAL_LOGIN_EMAIL || loginPassword !== EVAL_LOGIN_PASSWORD) {
      setLoginError("Feil evalueringsinnlogging. Bruk eval@evida.local / eval-2026.");
      return;
    }
    setLoginError("");
    setIsAuthenticated(true);
    setOnboardingStage("start");
  }

  function handleIntroComplete() {
    setOnboardingStage(isAuthenticated ? "start" : "login");
  }

  function handleLogout() {
    setIsAuthenticated(false);
    setOnboardingStage("login");
    setActiveView("overview");
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

  async function handleSelectCase(caseId: string) {
    await refresh(caseId);
    if (onboardingStage !== "caseRoom") {
      const selectedDocuments = await listDocuments(caseId);
      setOnboardingStage(selectedDocuments.length > 0 ? "caseRoom" : "import");
      setActiveView(selectedDocuments.length > 0 ? "caseRoom" : "documents");
    }
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

  async function runAutomaticAnalysis(caseId: string, importedSourceCount: number) {
    if (importedSourceCount <= 0) {
      setProcessingLog((current) => [
        ...current,
        "OCR eller manuell tekstkontroll kreves før automatisk analyse"
      ]);
      setReindexStatus("Dokumentet er importert. Kildegrunnlaget trenger OCR eller manuell kontroll før automatisk analyse.");
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

  function openLitigation(context?: string) {
    setLitigationContext(context || "");
    setActiveView("litigation");
  }

  function generateDraft() {
    if (readinessVerdict.status !== "draft_ready") {
      setDraftText(
        [
          `Utkast er blokkert: ${readinessVerdict.label}.`,
          readinessVerdict.description,
          "",
          `Neste steg: ${readinessVerdict.nextStep}`,
          "",
          "Kjør kontrollgrunnlag, kronologi og bevismatrise før juridisk tekst genereres."
        ].join("\n")
      );
      return;
    }
    setDraftText(
      [
        `Utkast for ${selectedCase?.name || "valgt sak"}`,
        "",
        "Status: Draft",
        "Evaluation build: lokalt arbeidsutkast, ikke produksjonsleveranse.",
        "",
        "Foreløpig bevisgrunnlag:",
        ...sources.slice(0, 6).map((source) => `- [${source.id}] side ${source.page_start}: ${firstSentence(source.text_excerpt)}`)
      ].join("\n")
    );
  }

  function generateExport() {
    setExportText(
      JSON.stringify(
        {
          evaluation_build: true,
          local_processing: true,
          case: selectedCase,
          import_status: {
            pdf_pages: totalPages,
            analyzed_pages: analyzedPages,
            source_objects: sources.length,
            ocr_status: ocrStatus,
            readiness_verdict: readinessVerdict
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
      { label: "Sjekk hva AI trygt kan bruke", done: hasSources && !needsOcr, active: hasDocuments && (!hasSources || needsOcr), action: () => setActiveView("control") },
      { label: "Bygg kronologi", done: timelineItems.length > 0, active: hasSources && timelineItems.length === 0 && !needsOcr, action: buildChronology },
      { label: "Bygg bevismatrise", done: evidenceRows.length > 0, active: timelineItems.length > 0 && evidenceRows.length === 0, action: buildEvidence },
      { label: "Start saksarbeid", done: evidenceRows.length > 0, active: evidenceRows.length > 0, action: () => setActiveView("draft") }
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
        label: "Sjekk hva AI trygt kan bruke",
        done: hasSources && !needsOcr,
        active: hasDocuments && (!hasSources || needsOcr),
        reason: "Vi viser hvilke sider som kan spores tilbake til originaldokumentet.",
        actionLabel: "Sjekk grunnlag",
        action: () => setActiveView("control")
      },
      {
        label: "Bygg kronologi",
        done: timelineItems.length > 0,
        active: hasSources && timelineItems.length === 0 && !needsOcr,
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
        done: evidenceRows.length > 0,
        active: evidenceRows.length > 0,
        reason: "Grunnlaget er klart for utkast, risiko og videre kontroll.",
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
          {documents.length > 0 ? (
            <button className="button-primary" onClick={() => {
              setOnboardingStage("caseRoom");
              setActiveView("caseRoom");
            }}>
              Gå til Saksrom
            </button>
          ) : null}
        </div>
        <div className="processing-stats">
          <span><strong>{documents.length}</strong> lastet opp</span>
          <span><strong>{readyCount}</strong> ferdig behandlet</span>
          <span><strong>{activeCount}</strong> analyseres nå</span>
          <span><strong>{documentsRequiringAttention.length}</strong> krever oppmerksomhet</span>
        </div>
        {documents.length > 0 ? (
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
                    ? `Kjører OCR/tekstkontroll · ${countLabel(document.pending_ocr_page_count, "side", "sider")} venter`
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
    const steps = [
      { label: "Intro", done: onboardingStage !== "intro" },
      { label: "Innlogging", done: isAuthenticated },
      { label: "Sak", done: Boolean(selectedCase) },
      { label: "Dokumenter", done: hasDocuments },
      { label: "Saksrom", done: onboardingStage === "caseRoom" }
    ];

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
            {isAuthenticated ? (
              <button className="button-ghost" onClick={handleLogout}>
                Logg ut
              </button>
            ) : null}
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

        <div className="guided-stepper" aria-label="Oppstartsflyt">
          {steps.map((step, index) => (
            <div key={step.label} className={`guided-step ${step.done ? "guided-step--done" : ""}`}>
              <span>{step.done ? "✓" : index + 1}</span>
              <strong>{step.label}</strong>
            </div>
          ))}
        </div>
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

        {onboardingStage === "login" ? (
          <section className="guided-card guided-card--narrow">
            <div>
              <div className="eyebrow">Innlogging</div>
              <h1>Logg inn i Evida</h1>
              <p>Få tilgang til dine saker, dokumenter og saksrom. All aktivitet knyttes til bruker for sikkerhet og revisjon.</p>
            </div>
            <div className="guided-login-form">
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                placeholder="E-post"
                aria-label="E-post"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Passord"
                aria-label="Passord"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleEvalLogin();
                  }
                }}
              />
              <button className="button-primary" onClick={handleEvalLogin}>Logg inn</button>
            </div>
            <div className="eval-login-hint">
              Evalueringsbruker: <strong>{EVAL_LOGIN_EMAIL}</strong> / <strong>{EVAL_LOGIN_PASSWORD}</strong>
            </div>
            {loginError ? <div className="error-notice">{loginError}</div> : null}
            <p className="security-note">Evaluation build: lokal behandling. Ikke bruk reelle klientdata uten avtale.</p>
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
                  <input value={caseName} onChange={(event) => setCaseName(event.target.value)} placeholder="Saksnavn" />
                  <button className="button-primary" onClick={handleCreateCase}>Ny sak</button>
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
                <h1>{selectedCase ? selectedCase.name : "Velg eller opprett sak"}</h1>
                <p>Last opp dokumenter. Evida behandler materialet og sender deg videre til Saksrom.</p>
              </div>
              {hasDocuments ? (
                <button className="button-secondary" onClick={() => {
                  setOnboardingStage("caseRoom");
                  setActiveView("caseRoom");
                }}>
                  Gå til Saksrom mens resten behandles
                </button>
              ) : null}
            </div>
            {!selectedCase ? <CasePanel /> : null}
            <ImportPanel />
            <ProcessingStatus />
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
            <p>Velg filer eller dra dokumenter inn. Sporbare kildeutdrag er tekst vi kan vise tilbake til originaldokumentet.</p>
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
          <button className="button-primary" disabled={!selectedCaseId || isImporting} onClick={handleChooseFiles}>
            Velg filer
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
              disabled={!selectedCaseId || !documentPath.trim() || isImporting}
              onClick={() => void importDocuments([documentPath])}
            >
              Registrer dokument
            </button>
            {selectedCaseId ? <PdfImportPanel caseId={selectedCaseId} /> : null}
          </div>
        ) : null}
        <button
          type="button"
          className="drop-zone"
          disabled={!selectedCaseId || isImporting}
          onClick={() => void handleChooseFiles()}
        >
          <strong>{isDragActive ? "Slipp dokumentene her" : "Dra dokumenter hit"}</strong>
          <span>Du kan slippe flere filer samtidig. Bruk Velg filer hvis drag/drop ikke passer.</span>
        </button>
        {importQueue.length > 0 ? (
          <div className="import-queue" aria-live="polite">
            <div className="import-queue__header">
              <strong>Importkø</strong>
              <span>{importQueue.filter((item) => item.status === "ready").length} av {importQueue.length} klare</span>
            </div>
            {importQueue.map((item) => (
              <article key={item.path} className={`import-queue-row import-queue-row--${item.status}`}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.detail}</span>
                </div>
                <div className="import-queue-row__meta">
                  {typeof item.pages === "number" ? <span>{countLabel(item.pages, "side", "sider")}</span> : null}
                  {typeof item.sources === "number" ? <span>{countLabel(item.sources, "kildeutdrag", "kildeutdrag")}</span> : null}
                  <span className={item.status === "ready" ? "status-chip status-chip--ok" : item.status === "failed" || item.status === "needs_attention" ? "status-chip status-chip--warn" : "status-chip"}>
                    {importStatusLabel(item.status)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {hasDocuments ? (
          <div className="import-status-grid">
            <span>PDF-sider <strong>{totalPages}</strong></span>
            <span>Analyserte sider <strong>{analyzedPages}</strong></span>
            <span>Kildeutdrag <strong>{sources.length}</strong></span>
            <span>OCR <strong>{pendingOcrPages > 0 ? `${pendingOcrPages} sider venter` : ocrStatus}</strong></span>
          </div>
        ) : null}
        {hasDocuments ? <div className="workflow-notice">{userCoverageExplanation}</div> : null}
        {!selectedCaseId ? <div className="blocked-hint">Import er låst til du har valgt eller opprettet en sak.</div> : null}
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
          <input value={caseName} onChange={(event) => setCaseName(event.target.value)} placeholder="Saksnavn" />
          <button className="button-primary" onClick={handleCreateCase}>Opprett sak</button>
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
        ? "Åpne Saksrom"
        : "Last opp dokumenter";
    const primaryAction = !selectedCase
      ? undefined
      : () => setActiveView(hasDocuments ? "caseRoom" : "documents");

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
                    ? "Dokumenter er importert. Neste steg er å åpne Saksrom for oppsummering og spørsmål."
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
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>{selectedCase ? `Dokumenter i ${selectedCase.name}` : "Dokumenter"}</h2>
            <p>{hasDocuments ? "Sjekk hva AI trygt kan bruke før du går videre." : "Importer dokumenter for valgt sak."}</p>
          </div>
          {hasDocuments ? (
            <div className="panel-actions">
              <button className="button-secondary" onClick={handleReindex}>Oppdater kildeutdrag fra dokumentene</button>
              <button className="button-primary" onClick={() => setActiveView("control")}>Gå til kontroll</button>
            </div>
          ) : null}
        </div>
        {documents.length === 0 ? (
          <div className="empty-state">Ingen dokumenter registrert i valgt sak.</div>
        ) : (
          <div className="document-list">
            {documents.map((document) => (
              <article key={document.id} className="document-row">
                <div>
                  <div className="document-primary">
                    <strong>{document.original_name}</strong>
                    {document.pending_ocr_page_count > 0 ? <span className="status-chip status-chip--warn">OCR må kjøres</span> : null}
                    {document.source_count > 0 ? <span className="status-chip status-chip--ok">Kildeutdrag OK</span> : null}
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
                  <span>{document.pending_ocr_page_count || 0} OCR-venter</span>
                  <span>{countLabel(document.source_count, "kildeutdrag", "kildeutdrag")}</span>
                  <span>{document.ocr_status}</span>
                  <span>{document.source_coverage_percent}% lesbart</span>
                </div>
              </article>
            ))}
          </div>
        )}
        {hasDocuments && !hasSources ? (
          <div className="warning-notice">
            Dokumentet er registrert, men saken har ingen sporbare kildeutdrag. Det betyr normalt skannet PDF eller PDF uten tekstlag.
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

  function ControlView() {
    const checks = [
      { label: "Sak valgt", ok: Boolean(selectedCase), detail: selectedCase?.name || "Ingen sak" },
      { label: "PDF-sider", ok: totalPages > 0, detail: countLabel(totalPages, "side", "sider") },
      { label: "Analyserte sider", ok: analyzedPages > 0, detail: `${analyzedPages} av ${totalPages}` },
      { label: "Kildeutdrag", ok: hasSources, detail: countLabel(sources.length, "kildeutdrag", "kildeutdrag") },
      { label: "OCR-status", ok: pendingOcrPages === 0 && hasDocuments, detail: pendingOcrPages > 0 ? `${pendingOcrPages} sider venter` : ocrStatus },
      { label: "DB-kryptering", ok: Boolean(dbSecurity?.encrypted_at_rest), detail: dbSecurity?.cipher || "ukjent" },
      { label: "Audit trail", ok: audit.length > 0, detail: countLabel(audit.length, "event", "events") }
    ];

    return (
      <>
        <section className="status-grid control-status-grid">
          <StatusCard label="Saker" value={totals.cases} detail="lokal database" />
          <StatusCard label="Dokumenter" value={totals.documents} detail="registrert" />
          <StatusCard label="Sider" value={totals.pages} detail="registrert" />
          <StatusCard label="Kildeutdrag" value={totals.sources} detail="sporbare utdrag" tone="warn" />
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Kontrollgrunnlag</h2>
              <p>{hasDocuments ? userCoverageExplanation : "Kontrollgrunnlag vises etter import."}</p>
            </div>
            <div className="panel-actions">
              <button className="button-primary" onClick={handleReindex} disabled={!hasDocuments}>Oppdater kildeutdrag</button>
              <button className="button-secondary" onClick={() => void refresh(selectedCaseId)}>Oppdater</button>
            </div>
          </div>
          <div className={`readiness-verdict readiness-verdict--${readinessVerdict.status}`}>
            <strong>{readinessVerdict.label}</strong>
            <span>{readinessVerdict.description}</span>
            <small>{readinessVerdict.detail}</small>
            <button type="button" className="button-secondary" onClick={() => setActiveView("caseRoom")}>
              Åpne Saksrom
            </button>
          </div>
          <div className="check-grid">
            {checks.map((check) => (
              <article key={check.label} className={`check-card ${check.ok ? "check-card--ok" : "check-card--warn"}`}>
                <strong>{check.label}</strong>
                <span>{check.ok ? "OK" : "Mangler"}</span>
                <p>{check.detail}</p>
              </article>
            ))}
          </div>
          {deviations.length > 0 ? (
            <div className="warning-notice">{deviations.join(" ")}</div>
          ) : null}
          {dbSecurity?.warnings.length ? (
            <div className="warning-notice">{dbSecurity.warnings.join(" ")}</div>
          ) : null}
          {!hasDocuments ? <div className="blocked-hint">Kontrollgrunnlag vises etter import.</div> : null}
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
            <button className="button-primary" onClick={generateDraft} disabled={readinessVerdict.status !== "draft_ready"}>Lag utkast</button>
          </div>
          <div className={`readiness-verdict readiness-verdict--${readinessVerdict.status}`}>
            <strong>{readinessVerdict.label}</strong>
            <span>{readinessVerdict.status === "draft_ready" ? "Utkastkontroll kan kjøres, men må fortsatt godkjennes manuelt." : "Utkast er låst til saken er klar for utkastkontroll."}</span>
            <small>{readinessVerdict.nextStep}</small>
          </div>
          <textarea readOnly value={draftText} placeholder="Utkast vises her etter at du trykker Lag utkast." />
        </section>
      </>
    );
  }

  function ExportView() {
    return (
      <>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Eksport</h2>
              <p>Lokal evalueringsoppsummering og testverktøy.</p>
            </div>
            <button className="button-primary" onClick={generateExport}>Lag eksport</button>
          </div>
          <div className={`readiness-verdict readiness-verdict--${readinessVerdict.status}`}>
            <strong>{readinessVerdict.label}</strong>
            <span>Eksport inkluderer readiness-dom og kontrollstatus.</span>
            <small>{readinessVerdict.detail}</small>
          </div>
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

    switch (activeView) {
      case "overview":
        return <OverviewView />;
      case "documents":
        return (
          <>
            {cases.length === 0 ? <CasePanel /> : null}
            <ImportPanel />
            <DocumentList />
            <CaseList />
          </>
        );
      case "caseRoom":
        return (
          <CaseRoomView
            selectedCase={selectedCase}
            documents={documents}
            sources={sources}
            sourcesById={sourceById}
            pendingOcrPages={pendingOcrPages}
            coverage={coveragePercent}
            deviations={deviations}
            readinessVerdict={readinessVerdict}
            nextActionTitle={nextAction.title}
            onOpenSource={openSource}
            onOpenControl={() => setActiveView("control")}
            onOpenLitigation={openLitigation}
          />
        );
      case "chronology":
        return (
          <>
            <AiTrustContract />
            <ChronologyView
              items={timelineItems}
              sourcesById={sourceById}
              onBuild={buildChronology}
              onOpenSource={openSource}
            />
          </>
        );
      case "evidence":
        return (
          <>
            <AiTrustContract />
            <EvidenceView
              rows={evidenceRows}
              sourcesById={sourceById}
              onBuild={buildEvidence}
              onOpenSource={openSource}
            />
          </>
        );
      case "arguments":
        return (
          <>
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
        return (
          <>
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
        return (
          <>
            <AiTrustContract />
            <RiskView rows={riskRows} onAssess={buildRisk} />
          </>
        );
      case "litigation":
        return (
          <LitigationSimulationView
            selectedCase={selectedCase}
            documents={documents}
            sources={sources}
            readinessVerdict={readinessVerdict}
            coverage={coveragePercent}
            pendingOcrPages={pendingOcrPages}
            deviations={deviations}
            initialContext={litigationContext}
            onOpenSource={openSource}
            onOpenControl={() => setActiveView("control")}
          />
        );
      case "control":
        return <ControlView />;
      case "draft":
        return <DraftView />;
      case "export":
        return <ExportView />;
    }
  }

  const isCaseRoomView = activeView === "caseRoom";
  const showNavigation = isWorkspaceUnlocked;
  const shellClassName = [
    "app-shell",
    !showNavigation ? "app-shell--guided" : "",
    showNavigation && activeView === "control" ? "app-shell--with-panel" : "",
    showNavigation && isCaseRoomView ? "app-shell--case-room" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className={shellClassName} data-theme={theme}>
      {showNavigation ? (
        <Sidebar
          activeView={activeView}
          onNavigate={setActiveView}
          hasDocuments={hasDocuments}
          hasSources={hasSources}
          hasAnalysis={hasAnalysis}
          readinessVerdict={readinessVerdict}
        />
      ) : null}
      <main className={`workspace ${!showNavigation ? "workspace--guided" : ""} ${showNavigation && isCaseRoomView ? "workspace--chat" : ""}`}>
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
              <button className="command-button button-secondary" onClick={() => setActiveView("control")}>
                Ctrl + K · Sakspilot
              </button>
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

        {renderView()}
      </main>
      {showNavigation && activeView === "control" ? (
        <SourcePanel
          selectedCase={selectedCase}
          coverage={selectedCase?.source_coverage_percent || 0}
          ocrStatus={ocrStatus}
          sourceCount={sources.length}
          deviations={deviations}
          nextAction={nextAction}
        />
      ) : null}
      <SourcePreviewDrawer source={activeSource} onClose={() => setActiveSource(undefined)} />
      {deleteTarget ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2>Slett sak?</h2>
            <p>Saken fjernes fra aktiv liste. Data soft-deletes og audit event CASE_SOFT_DELETED registreres.</p>
            <div className="modal-actions">
              <button className="button-secondary" onClick={() => setDeleteTarget(null)}>Avbryt</button>
              <button className="danger-button" onClick={confirmDeleteCase}>Slett sak</button>
            </div>
          </div>
        </div>
      ) : null}
      {resetConfirmOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setResetConfirmOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2>Slett alle testdata?</h2>
            <p>Dette fjerner lokale evalueringssaker, dokumenter, kilder og audit-events fra testdatabasen.</p>
            <div className="modal-actions">
              <button className="button-secondary" onClick={() => setResetConfirmOpen(false)}>Avbryt</button>
              <button className="danger-button" onClick={confirmResetTestData}>Slett testdata</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
