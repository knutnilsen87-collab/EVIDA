import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Download, FolderOpen, Moon, RotateCcw, Sun, Trash2 } from "lucide-react";
import {
  chooseDocumentPaths,
  createCase,
  exportDiagnostics,
  getAppStatus,
  hasDesktopRuntime,
  listAuditEvents,
  listCases,
  listDocuments,
  listSourceObjects,
  openLocalDataFolder,
  reindexCaseDocuments,
  registerDocument,
  resetTestData,
  softDeleteCase
} from "./lib/api";
import type {
  AuditEvent,
  CaseSummary,
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

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  });
  const [status, setStatus] = useState("Starter ...");
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [sources, setSources] = useState<SourceObjectSummary[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [caseName, setCaseName] = useState("Ny prosessak");
  const [documentPath, setDocumentPath] = useState("");
  const [lastImport, setLastImport] = useState("");
  const [importError, setImportError] = useState("");
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh(preferredCaseId = selectedCaseId) {
    setStatus(await getAppStatus());
    const nextCases = await listCases();
    setCases(nextCases);
    const activeCaseId =
      nextCases.find((item) => item.id === preferredCaseId)?.id || nextCases[0]?.id || "";
    setSelectedCaseId(activeCaseId);

    if (activeCaseId) {
      const [nextDocuments, nextSources, nextAudit] = await Promise.all([
        listDocuments(activeCaseId),
        listSourceObjects(activeCaseId),
        listAuditEvents(activeCaseId)
      ]);
      setDocuments(nextDocuments);
      setSources(nextSources);
      setAudit(nextAudit);
    } else {
      setDocuments([]);
      setSources([]);
      setAudit([]);
    }
  }

  useEffect(() => {
    refresh().catch((error) => setStatus(`Feil: ${String(error)}`));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    setTimelineItems([]);
    setEvidenceRows([]);
    setArgumentRows([]);
    setConflictRows([]);
    setRiskRows([]);
  }, [selectedCaseId]);

  const selectedCase = cases.find((item) => item.id === selectedCaseId);
  const hasDocuments = documents.length > 0;
  const hasSources = sources.length > 0;
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const needsOcr = documents.some((document) =>
    ["needs_ocr", "partial_needs_ocr", "failed"].includes(document.ocr_status)
  );
  const analyzedPages = useMemo(
    () => new Set(sources.map((source) => `${source.document_id}:${source.page_start}`)).size,
    [sources]
  );
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

  const deviations = useMemo(() => {
    const items: string[] = [];
    if (hasDocuments && !hasSources) {
      items.push("Dokument finnes, men ingen kildeobjekter er bygget.");
    }
    if (needsOcr) {
      items.push("Minst ett dokument trenger OCR eller tekstkontroll.");
    }
    if (hasDocuments && analyzedPages < totalPages) {
      items.push(`${countLabel(totalPages - analyzedPages, "side", "sider")} mangler kildeobjekter.`);
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

  const buildChronology = useCallback(() => {
    if (!hasSources) {
      setReindexStatus("Kronologi trenger kildeobjekter. Importer tekstgrunnlag eller bygg kilder først.");
      setActiveView("control");
      return;
    }
    setTimelineItems(
      sources.slice(0, 8).map((source, index) => ({
        id: `TL-${source.id}`,
        date: extractDate(source.text_excerpt),
        event: firstSentence(source.text_excerpt),
        sourceId: source.id,
        status: index === 0 ? "Til kontroll" : "Utkast",
        uncertainty: extractDate(source.text_excerpt) === "Udatert" ? "Høy" : "Middels"
      }))
    );
    setActiveView("chronology");
  }, [hasSources, sources]);

  const buildEvidence = useCallback(() => {
    if (!hasSources) {
      setReindexStatus("Bevismatrise trenger kildeobjekter. Importer tekstgrunnlag eller bygg kilder først.");
      setActiveView("control");
      return;
    }
    const support = sources.slice(0, 3).map((source) => source.id);
    const weakening = sources.slice(3, 5).map((source) => source.id);
    setEvidenceRows([
      {
        id: "EV-1",
        claim: "Foreløpig hovedpåstand basert på importerte kilder",
        supporting: support,
        weakening,
        strength: support.length >= 2 ? "Middels" : "Svak",
        status: "Utkast"
      }
    ]);
    setActiveView("evidence");
  }, [hasSources, sources]);

  function buildArguments() {
    if (!hasSources) {
      setReindexStatus("Anførsler trenger et kontrollert kildegrunnlag først.");
      setActiveView("control");
      return;
    }
    setArgumentRows([
      {
        id: "ARG-1",
        argument: "Foreløpig anførsel",
        factualBasis: firstSentence(sources[0].text_excerpt),
        legalBasis: "Ikke vurdert",
        evidenceIds: sources.slice(0, 2).map((source) => source.id),
        status: "Må kvalitetssikres"
      }
    ]);
    setActiveView("arguments");
  }

  function buildContradictions() {
    if (sources.length < 2) {
      setReindexStatus("Motstridsanalyse trenger minst to kildeobjekter.");
      setActiveView("control");
      return;
    }
    setConflictRows([
      {
        id: "CON-1",
        topic: "Mulig avvik i faktum",
        sourceA: sources[0].id,
        sourceB: sources[1].id,
        conflict: "Kildene bør sammenlignes manuelt før konklusjon.",
        significance: "Middels",
        status: "Til kontroll"
      }
    ]);
    setActiveView("contradictions");
  }

  function buildRisk() {
    if (!hasSources) {
      setReindexStatus("Risikovurdering trenger kildeobjekter.");
      setActiveView("control");
      return;
    }
    setRiskRows([
      {
        id: "RSK-1",
        risk: needsOcr ? "Ufullstendig tekstgrunnlag" : "Kildegrunnlag ikke juridisk kvalitetssikret",
        severity: needsOcr ? "Høy" : "Middels",
        affectedArguments: argumentRows.length ? argumentRows.map((row) => row.id).join(", ") : "Ikke koblet",
        sourceBasis: `${sources.length} kildeobjekter`,
        recommendedAction: needsOcr ? "Kjør OCR/tekstkontroll før saksarbeid." : "Kontroller kilder og knytt dem til påstander."
      }
    ]);
    setActiveView("risk");
  }

  const nextAction = useMemo(() => {
    if (!selectedCase) {
      return {
        title: "Opprett første sak",
        description: "Start med en lokal evalueringssak før dokumenter importeres.",
        actionLabel: "Opprett sak",
        onAction: handleCreateCase
      };
    }
    if (!hasDocuments) {
      return {
        title: "Importer dokument",
        description: "Legg inn PDF, tekstfil eller bilde i valgt sak.",
        actionLabel: "Gå til import",
        onAction: () => setActiveView("documents")
      };
    }
    if (!hasSources || needsOcr) {
      return {
        title: "Kontroller dokumentgrunnlag",
        description: "Se PDF-sider, analyserte sider, OCR-status og kildeobjekter før analyse.",
        actionLabel: "Åpne kontroll",
        onAction: () => setActiveView("control")
      };
    }
    if (timelineItems.length === 0) {
      return {
        title: "Bygg kronologi",
        description: "Lag tidslinjeobjekter fra kildegrunnlaget.",
        actionLabel: "Bygg kronologi",
        onAction: buildChronology
      };
    }
    if (evidenceRows.length === 0) {
      return {
        title: "Bygg bevismatrise",
        description: "Koble påstander til støttende og svekkende kilder.",
        actionLabel: "Bygg bevismatrise",
        onAction: buildEvidence
      };
    }
    return {
      title: "Start saksarbeid",
      description: "Grunnflyten er klar for utkast, anførsler og kontroll.",
      actionLabel: "Åpne utkast",
      onAction: () => setActiveView("draft")
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
          )}, ${countLabel(sourceCount, "kildeobjekt", "kildeobjekter")}`
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
    setImportError("Nettlesermodus gir ikke tilgang til lokal filsti. Bruk desktop-appen og knappen Velg fil.");
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
      )}, ${countLabel(report.sources_created, "kildeobjekt", "kildeobjekter")}, ${countLabel(
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
      setDraftText("Utkast er blokkert til saken har kildeobjekter. Last opp en tekst-PDF/TXT eller kjør OCR før juridisk tekst genereres.");
      return;
    }
    setDraftText(
      [
        `Utkast for ${selectedCase?.name || "valgt sak"}`,
        "",
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
      { label: "Kontroller dokumentgrunnlag", done: hasSources && !needsOcr, active: hasDocuments && (!hasSources || needsOcr), action: () => setActiveView("control") },
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
          </button>
        ))}
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
            <p>Velg fil eller dra dokumenter inn. Importstatus viser sider, analyserte sider, kildeobjekter og OCR.</p>
          </div>
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
          <button disabled={!selectedCaseId || isImporting} onClick={handleChooseFiles}>
            Velg fil
          </button>
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            multiple
            accept=".pdf,.txt,.md,.markdown,.png,.jpg,.jpeg,.tif,.tiff"
            onChange={(event) => handleBrowserFileSelection(event.target.files)}
          />
          <input
            value={documentPath}
            onChange={(event) => setDocumentPath(event.target.value)}
            placeholder="Eller lim inn lokal filsti"
          />
          <button
            disabled={!selectedCaseId || !documentPath.trim() || isImporting}
            onClick={() => void importDocuments([documentPath])}
          >
            Registrer dokument
          </button>
        </div>
        <div className="drop-zone">
          <strong>{isDragActive ? "Slipp dokumentene her" : "Dra dokumenter hit"}</strong>
          <span>PDF, TXT, MD og bilder støttes. Du kan slippe flere filer samtidig.</span>
        </div>
        {hasDocuments ? (
          <div className="import-status-grid">
            <span>PDF-sider <strong>{totalPages}</strong></span>
            <span>Analyserte sider <strong>{analyzedPages}</strong></span>
            <span>Kildeobjekter <strong>{sources.length}</strong></span>
            <span>OCR <strong>{ocrStatus}</strong></span>
          </div>
        ) : null}
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
          <button onClick={handleCreateCase}>Opprett sak</button>
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
            <p>{hasDocuments ? "Kontroller kildegrunnlaget før du går videre." : "Importer dokumenter for valgt sak."}</p>
          </div>
          {hasDocuments ? (
            <div className="panel-actions">
              <button onClick={handleReindex}>Bygg kilder på nytt</button>
              <button onClick={() => setActiveView("control")}>Gå til kontroll</button>
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
                  <strong>{document.original_name}</strong>
                  <div className="muted">{document.id} · {document.mime_type || "ukjent type"}</div>
                  <code>{document.sha256.slice(0, 24)}</code>
                </div>
                <div className="case-row__meta">
                  <span>{countLabel(document.page_count, "side", "sider")}</span>
                  <span>{countLabel(document.source_count, "kildeobjekt", "kildeobjekter")}</span>
                  <span>{document.ocr_status}</span>
                  <span>{document.source_coverage_percent}% dekning</span>
                </div>
              </article>
            ))}
          </div>
        )}
        {hasDocuments && !hasSources ? (
          <div className="warning-notice">
            Dokumentet er registrert, men saken har ingen kildeobjekter. Det betyr normalt skannet PDF eller PDF uten tekstlag.
          </div>
        ) : null}
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
      { label: "Kildeobjekter", ok: hasSources, detail: countLabel(sources.length, "kildeobjekt", "kildeobjekter") },
      { label: "OCR-status", ok: !needsOcr && hasDocuments, detail: ocrStatus },
      { label: "Audit trail", ok: audit.length > 0, detail: countLabel(audit.length, "event", "events") }
    ];

    return (
      <>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Kontroll</h2>
              <p>Kontrollgrunnlag for lokal evalueringssak uten lange kildeutdrag.</p>
            </div>
            <div className="panel-actions">
              <button onClick={handleReindex} disabled={!hasDocuments}>Bygg kilder på nytt</button>
              <button onClick={() => void refresh(selectedCaseId)}>Oppdater</button>
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
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Utkast</h2>
            <p>Lokalt arbeidsutkast fra kontrollerte kildeobjekter.</p>
          </div>
          <button onClick={generateDraft}>Lag utkast</button>
        </div>
        <textarea readOnly value={draftText} placeholder="Utkast vises her etter at du trykker Lag utkast." />
      </section>
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
            <button onClick={generateExport}>Lag eksport</button>
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
            <button onClick={handleOpenDataFolder}>
              <FolderOpen size={16} /> Åpne lokal datamappe
            </button>
            <button onClick={handleExportDiagnostics}>
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
            <GuidedFlow />
            <CasePanel />
            <ImportPanel />
            <CaseList />
            <DocumentList />
            <AuditPanel />
          </>
        );
      case "documents":
        return (
          <>
            <ImportPanel />
            <DocumentList />
            <CaseList />
          </>
        );
      case "chronology":
        return (
          <ChronologyView
            items={timelineItems}
            sourcesById={sourceById}
            onBuild={buildChronology}
            onOpenSource={openSource}
          />
        );
      case "evidence":
        return (
          <EvidenceView
            rows={evidenceRows}
            sourcesById={sourceById}
            onBuild={buildEvidence}
            onOpenSource={openSource}
          />
        );
      case "arguments":
        return (
          <ArgumentsView
            rows={argumentRows}
            sourcesById={sourceById}
            onCreate={buildArguments}
            onOpenSource={openSource}
          />
        );
      case "contradictions":
        return (
          <ContradictionsView
            rows={conflictRows}
            sourcesById={sourceById}
            onFind={buildContradictions}
            onOpenSource={openSource}
          />
        );
      case "risk":
        return <RiskView rows={riskRows} onAssess={buildRisk} />;
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
            <button className="command-button" onClick={() => setActiveView("control")}>
              Ctrl + K · Sakspilot
            </button>
          </div>
        </header>

        <section className="status-grid">
          <StatusCard label="Saker" value={totals.cases} detail="lokal database" />
          <StatusCard label="Dokumenter" value={totals.documents} detail="registrert" />
          <StatusCard label="Sider" value={totals.pages} detail="registrert" />
          <StatusCard label="Kilder" value={totals.sources} detail="kildeobjekter" tone="warn" />
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
              <button onClick={() => setDeleteTarget(null)}>Avbryt</button>
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
              <button onClick={() => setResetConfirmOpen(false)}>Avbryt</button>
              <button className="danger-button" onClick={confirmResetTestData}>Slett testdata</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
