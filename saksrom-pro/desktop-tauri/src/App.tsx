import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  registerDocument
} from "./lib/api";
import type { AuditEvent, CaseSummary, DocumentSummary, SourceObjectSummary } from "./types";
import { Sidebar } from "./components/Sidebar";
import { SourcePanel } from "./components/SourcePanel";
import { StatusCard } from "./components/StatusCard";

export default function App() {
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

  const totals = useMemo(() => {
    return {
      cases: cases.length,
      documents: cases.reduce((sum, c) => sum + c.document_count, 0),
      pages: cases.reduce((sum, c) => sum + c.page_count, 0),
      sources: sources.length
    };
  }, [cases, sources.length]);

  async function handleCreateCase() {
    const name = caseName.trim() || "Ny sak";
    const created = await createCase(name, "NO");
    setCaseName("");
    await refresh(created.id);
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

  async function handleRegisterDocument() {
    await importDocuments([documentPath]);
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

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path || "")
      .filter(Boolean);
    if (paths.length > 0) {
      void importDocuments(paths);
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  async function handleSelectCase(caseId: string) {
    await refresh(caseId);
  }

  const ocrStatus = documents.length
    ? Array.from(new Set(documents.map((document) => document.ocr_status))).join(", ")
    : "ikke startet";

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>Saksoversikt</h1>
            <p>{status}</p>
          </div>
          <button className="command-button">Ctrl + K · Sakspilot</button>
        </header>

        <section className="status-grid">
          <StatusCard label="Saker" value={totals.cases} detail="lokal database" />
          <StatusCard label="Dokumenter" value={totals.documents} detail="registrert" />
          <StatusCard label="Sider" value={totals.pages} detail="registrert" />
          <StatusCard label="Kilder" value={totals.sources} detail="source objects" tone="warn" />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Opprett sak</h2>
              <p>Fase 1: lokal sak, database, SHA-256 og audit trail.</p>
            </div>
          </div>
          <div className="form-row">
            <input
              value={caseName}
              onChange={(event) => setCaseName(event.target.value)}
              placeholder="Saksnavn"
            />
            <button onClick={handleCreateCase}>Opprett sak</button>
          </div>
        </section>

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
              <p>Fase 2: PDF-sideantall, tekstuttrekk, chunks, kildekart og OCR-status.</p>
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
            <button disabled={!selectedCaseId || !documentPath.trim() || isImporting} onClick={handleRegisterDocument}>
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

        <section className="panel">
          <div className="panel-header">
            <h2>{selectedCase ? `Dokumenter i ${selectedCase.name}` : "Dokumenter"}</h2>
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
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Audit trail</h2>
          </div>
          {audit.length === 0 ? (
            <div className="empty-state">Ingen audit events for valgt sak.</div>
          ) : (
            <div className="audit-list">
              {audit.slice(0, 8).map((event) => (
                <article key={event.id} className="audit-row">
                  <strong>{event.action}</strong>
                  <span>{event.target_type}</span>
                  <span>{event.created_at}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <SourcePanel
        sources={sources}
        coverage={selectedCase?.source_coverage_percent || 0}
        ocrStatus={ocrStatus}
      />
    </div>
  );
}
