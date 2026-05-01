import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  chooseDocumentPaths,
  createCase,
  getAppStatus,
  hasDesktopRuntime,
  listAuditEvents,
  listCases,
  listDocuments,
  listSourceObjects,
  reindexCaseDocuments,
  registerDocument
} from "./lib/api";
import type {
  AuditEvent,
  CaseSummary,
  DocumentSummary,
  SourceObjectSummary,
  ViewKey
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { SourcePanel } from "./components/SourcePanel";
import { StatusCard } from "./components/StatusCard";

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

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
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
  const [reindexStatus, setReindexStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh(preferredCaseId = selectedCaseId) {
    setStatus(await getAppStatus());
    const nextCases = await listCases();
    setCases(nextCases);
    const activeCaseId = preferredCaseId || nextCases[0]?.id || "";
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

  const selectedCase = cases.find((item) => item.id === selectedCaseId);
  const hasDocuments = documents.length > 0;
  const hasSources = sources.length > 0;
  const needsOcr = documents.some((document) =>
    ["needs_ocr", "partial_needs_ocr", "failed"].includes(document.ocr_status)
  );

  const totals = useMemo(() => {
    return {
      cases: cases.length,
      documents: cases.reduce((sum, c) => sum + c.document_count, 0),
      pages: cases.reduce((sum, c) => sum + c.page_count, 0),
      sources: sources.length
    };
  }, [cases, sources.length]);

  const ocrStatus = documents.length
    ? Array.from(new Set(documents.map((document) => document.ocr_status))).join(", ")
    : "ikke startet";

  async function handleCreateCase() {
    const name = caseName.trim() || "Ny sak";
    const created = await createCase(name, "NO");
    setCaseName("");
    await refresh(created.id);
    setActiveView("documents");
  }

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
          `${reports.length} dokument${reports.length === 1 ? "" : "er"} importert: ${pageCount} sider, ${sourceCount} kilder`
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
      `Reindeksert ${report.documents_processed} dokumenter: ${report.pages_created} sider, ${report.sources_created} kilder, ${report.warnings.length} varsler`
    );
    await refresh(selectedCaseId);
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
        "Foreløpig bevisgrunnlag:",
        ...sources.slice(0, 6).map((source) => `- [${source.id}] side ${source.page_start}: ${source.text_excerpt}`)
      ].join("\n")
    );
  }

  function generateExport() {
    setExportText(
      JSON.stringify(
        {
          case: selectedCase,
          documents,
          source_count: sources.length,
          audit_count: audit.length,
          exported_at: new Date().toISOString()
        },
        null,
        2
      )
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
            <p>Velg fil eller dra dokumenter inn. Tekstlag i PDF/TXT blir kildeobjekter; skannede PDF-er flagges for OCR.</p>
          </div>
        </div>
        <div className="form-row">
          <select value={selectedCaseId} onChange={(event) => handleSelectCase(event.target.value)}>
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
            onClick={() => importDocuments([documentPath])}
          >
            Registrer dokument
          </button>
        </div>
        <div className="drop-zone">
          <strong>{isDragActive ? "Slipp dokumentene her" : "Dra dokumenter hit"}</strong>
          <span>PDF, TXT, MD og bilder støttes. Du kan slippe flere filer samtidig.</span>
        </div>
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
            <p>Lokal sak, database, SHA-256 og audit trail.</p>
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
                onClick={() => handleSelectCase(item.id)}
              >
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted">{item.id} · {item.jurisdiction}</div>
                </div>
                <div className="case-row__meta">
                  <span>{item.document_count} dokumenter</span>
                  <span>{item.page_count} sider</span>
                  <span>Dekning {item.source_coverage_percent}%</span>
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
                  <span>{document.page_count} sider</span>
                  <span>{document.source_count} kilder</span>
                  <span>{document.ocr_status}</span>
                  <span>{document.source_coverage_percent}% dekning</span>
                </div>
              </article>
            ))}
          </div>
        )}
        {hasDocuments && !hasSources ? (
          <div className="warning-notice">
            Dokumentet er registrert, men saken har ingen kildeobjekter. Det betyr normalt skannet PDF eller PDF uten tekstlag. Juridiske arbeidsflater er åpne, men kildedrevet analyse er blokkert til OCR/tekstgrunnlag finnes.
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

  function WorkflowNotice() {
    if (!selectedCase) {
      return <div className="empty-state">Opprett eller velg sak for å starte workflowen.</div>;
    }
    if (!hasDocuments) {
      return <div className="workflow-notice">Neste steg: importer dokumenter i saken.</div>;
    }
    if (!hasSources) {
      return <div className="warning-notice">Neste steg: skaff tekstgrunnlag/OCR. Du kan fortsatt gå til Dokumenter, Kontroll og Eksport.</div>;
    }
    return <div className="notice">Saken har kildeobjekter. Gå videre til Kronologi, Bevis, Kontroll eller Utkast.</div>;
  }

  function GenericAnalysisView({ kind }: { kind: ViewKey }) {
    return (
      <>
        <WorkflowNotice />
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>{viewTitles[kind]}</h2>
              <p>Kildedrevet arbeidsflate for valgt sak.</p>
            </div>
            <button onClick={() => setActiveView("control")}>Kontroller grunnlag</button>
          </div>
          {!hasSources ? (
            <div className="empty-state">Ingen kildeobjekter ennå. Denne siden er tilgjengelig, men analyseinnhold kommer først når dokumentene har tekst/kilder.</div>
          ) : (
            <div className="source-list">
              {sources.slice(0, 10).map((source) => (
                <article key={source.id} className="source-item">
                  <div className="source-item__meta">{source.document_id} · side {source.page_start}</div>
                  <p>{source.text_excerpt}</p>
                  <code>{source.id}</code>
                </article>
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  function ControlView() {
    const checks = [
      { label: "Sak valgt", ok: Boolean(selectedCase), detail: selectedCase?.name || "Ingen sak" },
      { label: "Dokument registrert", ok: hasDocuments, detail: `${documents.length} dokumenter` },
      { label: "Kildeobjekter", ok: hasSources, detail: `${sources.length} kilder` },
      { label: "OCR-status", ok: !needsOcr && hasDocuments, detail: ocrStatus },
      { label: "Audit trail", ok: audit.length > 0, detail: `${audit.length} events` }
    ];

    return (
      <>
        <WorkflowNotice />
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Kontroll</h2>
              <p>Smoke-kontroll av sak, dokumenter, kilder og audit trail.</p>
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
            <p>Genererer bare tekst fra kildeobjekter som finnes i saken.</p>
          </div>
          <button onClick={generateDraft}>Lag utkast</button>
        </div>
        <textarea readOnly value={draftText} placeholder="Utkast vises her etter at du trykker Lag utkast." />
      </section>
    );
  }

  function ExportView() {
    return (
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Eksport</h2>
            <p>Lager en lokal saksoppsummering som kan brukes til kontroll eller videre arbeid.</p>
          </div>
          <button onClick={generateExport}>Lag eksport</button>
        </div>
        <textarea readOnly value={exportText} placeholder="Eksport vises her etter at du trykker Lag eksport." />
      </section>
    );
  }

  function renderView() {
    switch (activeView) {
      case "overview":
        return (
          <>
            <WorkflowNotice />
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
      case "control":
        return <ControlView />;
      case "draft":
        return <DraftView />;
      case "export":
        return <ExportView />;
      default:
        return <GenericAnalysisView kind={activeView} />;
    }
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{viewTitles[activeView]}</h1>
            <p>{status}</p>
          </div>
          <button className="command-button" onClick={() => setActiveView("control")}>
            Ctrl + K · Sakspilot
          </button>
        </header>

        <section className="status-grid">
          <StatusCard label="Saker" value={totals.cases} detail="lokal database" />
          <StatusCard label="Dokumenter" value={totals.documents} detail="registrert" />
          <StatusCard label="Sider" value={totals.pages} detail="registrert" />
          <StatusCard label="Kilder" value={totals.sources} detail="source objects" tone="warn" />
        </section>

        {renderView()}
      </main>
      <SourcePanel
        sources={sources}
        coverage={selectedCase?.source_coverage_percent || 0}
        ocrStatus={ocrStatus}
      />
    </div>
  );
}
