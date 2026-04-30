import { useEffect, useMemo, useState } from "react";
import {
  createCase,
  getAppStatus,
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

  async function handleRegisterDocument() {
    if (!selectedCaseId || !documentPath.trim()) {
      return;
    }
    const report = await registerDocument(selectedCaseId, documentPath.trim());
    setDocumentPath("");
    setLastImport(
      `${report.document.original_name}: ${report.pages_created} sider, ${report.sources_created} kilder`
    );
    await refresh(selectedCaseId);
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

        <section className="panel">
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
            <input
              value={documentPath}
              onChange={(event) => setDocumentPath(event.target.value)}
              placeholder="Lokal filsti til PDF, TXT eller MD"
            />
            <button disabled={!selectedCaseId || !documentPath.trim()} onClick={handleRegisterDocument}>
              Registrer dokument
            </button>
          </div>
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
