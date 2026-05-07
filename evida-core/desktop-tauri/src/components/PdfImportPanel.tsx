import { useEffect, useMemo, useState } from "react";
import { FileSearch, Lock, Search, ShieldCheck } from "lucide-react";
import {
  importSinglePdf,
  listenToPdfImportProgress,
  PdfImportProgressEvent,
  searchImportedPdf,
  SearchResult,
} from "../lib/pdfImportApi";

type Props = {
  caseId: string;
};

const userStatus: Record<string, string> = {
  received: "PDF mottatt",
  probed: "Dokument sjekket",
  extracting_text: "Leser tekst",
  text_extracted: "Tekst funnet",
  ocr_pending: "Noen sider må leses som bilde",
  ocr_completed: "Bildebaserte sider er lest",
  chunked: "Kildegrunnlag laget",
  search_indexed: "Dokumentet er søkbart",
  embedding_completed: "Spørsmål og svar er klart",
  ai_ready: "Dokumentet er klart",
  partial: "Dokumentet er delvis klart",
  needs_review: "Krever gjennomgang",
  failed: "Kunne ikke lese dokumentet",
};

function isTerminalEvent(event: PdfImportProgressEvent | undefined) {
  return event?.type === "document_ready" || event?.type === "failed";
}

function labelFor(event: PdfImportProgressEvent | undefined) {
  if (!event) {
    return "Ingen PDF-import startet.";
  }
  if (event.type === "page_progress") {
    return "Leser tekst";
  }
  if (event.type === "quality_report") {
    return "Lager kvalitetsrapport";
  }
  if ("status" in event && typeof event.status === "string") {
    return userStatus[event.status] || event.status;
  }
  return userStatus[event.type] || event.type;
}

export function PdfImportPanel({ caseId }: Props) {
  const [pdfPath, setPdfPath] = useState("");
  const [events, setEvents] = useState<PdfImportProgressEvent[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listenToPdfImportProgress((event) => {
      setEvents((prev) => [...prev, event]);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const latest = events[events.length - 1];

  useEffect(() => {
    if (isTerminalEvent(latest)) {
      setIsImporting(false);
    }
  }, [latest]);

  const progress = useMemo(() => {
    const pageEvent = [...events]
      .reverse()
      .find((event) => event.type === "page_progress");

    if (!pageEvent || pageEvent.type !== "page_progress") {
      return null;
    }

    return {
      current: pageEvent.page_number,
      total: pageEvent.page_count,
      percent: Math.round((pageEvent.page_number / pageEvent.page_count) * 100),
      words: pageEvent.word_count_estimate,
    };
  }, [events]);

  const quality = useMemo(
    () => [...events].reverse().find((event) => event.type === "quality_report"),
    [events],
  );

  const readiness = useMemo(
    () => [...events].reverse().find((event) => event.type === "document_ready"),
    [events],
  );

  const checklist = [
    { label: "PDF mottatt", done: events.some((event) => event.type === "received") },
    { label: "Dokument sjekket", done: events.some((event) => event.type === "probed") },
    { label: "Tekst lest sidevis", done: events.some((event) => event.type === "text_extracted") },
    { label: "Dokumentet er søkbart", done: Boolean(readiness?.type === "document_ready" && readiness.readiness.search_ready) },
    { label: "Kilder kan vises", done: Boolean(readiness?.type === "document_ready" && readiness.readiness.citation_ready) },
  ];

  async function startImport() {
    if (!pdfPath.trim()) {
      setEvents((prev) => [
        ...prev,
        {
          type: "failed",
          error_code: "missing_pdf_path",
          message: "Lim inn filsti til PDF først.",
        },
      ]);
      return;
    }

    setEvents([]);
    setResults([]);
    setSearchError(null);
    setIsImporting(true);

    try {
      await importSinglePdf({
        pdfPath: pdfPath.trim(),
        caseId,
      });
    } catch (error) {
      setIsImporting(false);
      setEvents((prev) => [
        ...prev,
        {
          type: "failed",
          error_code: "import_start_failed",
          message: String(error),
        },
      ]);
    }
  }

  async function runSearch() {
    setSearchError(null);

    try {
      const response = await searchImportedPdf({
        caseId,
        query,
        limit: 20,
      });

      setResults(response.results);
    } catch (error) {
      setSearchError(String(error));
    }
  }

  return (
    <section className="large-pdf-panel">
      <div className="panel-header">
        <div>
          <h3>Lokal dokumentmotor</h3>
          <p>
            Gjør én stor PDF om til et sikkert, søkbart og AI-brukbart dokumentgrunnlag med
            sidehenvisninger.
          </p>
        </div>
        <div className="large-pdf-trust">
          <span><ShieldCheck size={15} /> Lokal behandling</span>
          <span><Lock size={15} /> Ingen sky uten valg</span>
        </div>
      </div>

      <div className="form-row">
        <input
          id="large-pdf-path"
          value={pdfPath}
          onChange={(event) => setPdfPath(event.target.value)}
          placeholder="C:\\saker\\bevis.pdf"
        />
        <button className="button-primary" onClick={startImport} disabled={isImporting || !pdfPath.trim()}>
          <FileSearch size={16} />
          {isImporting ? "Leser dokument" : "Start PDF-import"}
        </button>
      </div>

      <div className="large-pdf-status" aria-live="polite">
        <strong>{labelFor(latest)}</strong>
        {latest && "message" in latest && latest.message ? <p>{latest.message}</p> : null}
        {progress ? (
          <div className="large-pdf-progress">
            <progress value={progress.current} max={progress.total} />
            <span>
              Side {progress.current} av {progress.total} · ca. {progress.words} ord
            </span>
          </div>
        ) : null}
        <div className="large-pdf-checklist">
          {checklist.map((item) => (
            <span key={item.label} className={item.done ? "is-done" : ""}>
              {item.done ? "✓" : "○"} {item.label}
            </span>
          ))}
        </div>
      </div>

      {quality?.type === "quality_report" ? (
        <div className="large-pdf-quality">
          <span>{quality.page_count} sider</span>
          <span>{quality.pages_text_extracted} sider lest</span>
          <span>{quality.pages_ocr_required} sider trenger OCR</span>
          <span>Kvalitet: {quality.overall_quality}</span>
        </div>
      ) : null}

      <div className="form-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Søk i importert PDF"
        />
        <button className="button-secondary" onClick={runSearch} disabled={!query.trim()}>
          <Search size={16} />
          Søk
        </button>
      </div>

      {searchError ? <div className="error-notice">{searchError}</div> : null}

      {results.length > 0 ? (
        <div className="large-pdf-results">
          {results.map((result) => (
            <article key={result.chunk_id}>
              <strong>{result.filename}</strong>
              <span>Side {result.page_number}</span>
              <p>{result.snippet}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
