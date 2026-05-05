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
  CaseSummary,
  DatabaseSecurityStatus,
  DocumentSummary,
  SourceObjectSummary,
  ViewKey
} from "./types";
import { NextAction } from "./components/NextAction";
import { Sidebar } from "./components/Sidebar";
import { SourcePanel } from "./components/SourcePanel";
import { SourcePreviewDrawer } from "./components/SourcePreviewDrawer";
import { StatusCard } from "./components/StatusCard";
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
  chronology: "Kronologi",
  evidence: "Bevis",
  arguments: "Anførsler",
  contradictions: "Motstrid",
  risk: "Risiko",
  draft: "Utkast",
  control: "Kontroll",
  export: "Eksport"
};

const THEME_STORAGE_KEY = "saksrom-pro-theme";
const AI_TRUST_STORAGE_KEY = "saksrom-pro-ai-trust-seen";

type ThemeMode = "light" | "dark";

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

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
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

  async function handleCreateCase() {
    const name = caseName.trim() || "Ny sak";
    const created = await createCase(name, "NO");
    setCaseName("");
    await refresh(created.id);
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
      try {
        const reports = [];
        for (const path of cleanPaths) {
          reports.push(await registerDocument(selectedCaseId, path));
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
        await refresh(selectedCaseId);
        setActiveView(sourceCount > 0 ? "control" : "documents");
      } catch (error) {
        setImportError(`Import feilet: ${String(error)}`);
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

  function handleBrowserFileSelection(files: FileList | null) {
    const paths = Array.from(files || [])
      .map((file) => (file as File & { path?: string }).path || "")
      .filter(Boolean);
    if (paths.length > 0) {
      void importDocuments(paths);
      return;
    }
    setImportError("Nettlesermodus kan ikke lese lokal filsti. \u00c5pne desktop-appen for lokal filimport, eller bruk den bygde Saksrom Pro-appen.");
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
    if (!hasSources) {
      setDraftText("Utkast kan lages n\u00e5r saken har sporbare kildeutdrag. Last opp en tekst-PDF/TXT eller kj\u00f8r OCR f\u00f8r juridisk tekst genereres.");
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
          <strong>St\u00f8ttede filtyper:</strong> PDF, TXT, MD, PNG, JPG og TIFF.
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
            accept=".pdf,.txt,.md,.markdown,.png,.jpg,.jpeg,.tif,.tiff"
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
          </div>
        ) : null}
        <div className="drop-zone">
          <strong>{isDragActive ? "Slipp dokumentene her" : "Dra dokumenter hit"}</strong>
          <span>Du kan slippe flere filer samtidig. Bruk Velg filer hvis drag/drop ikke passer.</span>
        </div>
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
                  <span>{countLabel(item.page_count, "side", "sider")}</span>
                  <span>Dekning {item.source_coverage_percent}%</span>
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
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Kontroll</h2>
              <p>{userCoverageExplanation}</p>
            </div>
            <div className="panel-actions">
              <button className="button-primary" onClick={handleReindex} disabled={!hasDocuments}>Oppdater kildeutdrag</button>
              <button className="button-secondary" onClick={() => void refresh(selectedCaseId)}>Oppdater</button>
            </div>
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
          {!hasDocuments ? <div className="blocked-hint">Kildekontroll er låst til saken har minst ett dokument.</div> : null}
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
            <button className="button-primary" onClick={generateDraft}>Lag utkast</button>
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
    switch (activeView) {
      case "overview":
        return (
          <>
            <NextAction {...nextAction} />
            <FirstValueOnboarding />
            {evidenceRows.length > 0 ? (
              <>
                <GuidedFlow />
                <CaseList />
                <DocumentList />
                <AuditPanel />
              </>
            ) : null}
          </>
        );
      case "documents":
        return (
          <>
            {cases.length === 0 ? <CasePanel /> : null}
            <ImportPanel />
            <DocumentList />
            <CaseList />
          </>
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
      case "control":
        return <ControlView />;
      case "draft":
        return <DraftView />;
      case "export":
        return <ExportView />;
    }
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="topbar-labels">
              <span className="evaluation-pill">Evaluation build</span>
              <span className="local-pill">Lokal behandling</span>
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

        <section className="status-grid">
          <StatusCard label="Saker" value={totals.cases} detail="lokal database" />
          <StatusCard label="Dokumenter" value={totals.documents} detail="registrert" />
          <StatusCard label="Sider" value={totals.pages} detail="registrert" />
          <StatusCard label="Kildeutdrag" value={totals.sources} detail="sporbare utdrag" tone="warn" />
        </section>

        {renderView()}
      </main>
      <SourcePanel
        selectedCase={selectedCase}
        coverage={selectedCase?.source_coverage_percent || 0}
        ocrStatus={ocrStatus}
        sourceCount={sources.length}
        deviations={deviations}
        nextAction={nextAction}
      />
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
