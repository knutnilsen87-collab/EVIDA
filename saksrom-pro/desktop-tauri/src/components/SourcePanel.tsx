import type { SourceObjectSummary } from "../types";

interface SourcePanelProps {
  sources: SourceObjectSummary[];
  coverage: number;
  ocrStatus: string;
}

export function SourcePanel({ sources, coverage, ocrStatus }: SourcePanelProps) {
  return (
    <aside className="source-panel">
      <div className="panel-title">Kilde / Kontroll</div>
      {sources.length === 0 ? (
        <div className="source-empty">
          Ingen kildeobjekter ennå. Importerte PDF-er uten tekstlag må OCR-behandles før analyse og utkast kan bruke dem som kilder.
        </div>
      ) : (
        <div className="source-list">
          {sources.slice(0, 8).map((source) => (
            <article key={source.id} className="source-item">
              <div className="source-item__meta">
                {source.document_id} · side {source.page_start}
                {source.page_end !== source.page_start ? `-${source.page_end}` : ""}
              </div>
              <p>{source.text_excerpt}</p>
              <code>{source.sha256.slice(0, 16)}</code>
            </article>
          ))}
        </div>
      )}
      <div className="source-checklist">
        <div>Dokumentdekning: <strong>{coverage}%</strong></div>
        <div>OCR-status: <strong>{ocrStatus}</strong></div>
        <div>Kildeobjekter: <strong>{sources.length}</strong></div>
      </div>
    </aside>
  );
}
