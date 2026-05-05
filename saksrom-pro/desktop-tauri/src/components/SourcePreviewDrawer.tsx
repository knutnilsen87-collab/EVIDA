import type { SourceObjectSummary } from "../types";

interface SourcePreviewDrawerProps {
  source?: SourceObjectSummary;
  title?: string;
  onClose: () => void;
}

export function SourcePreviewDrawer({ source, title, onClose }: SourcePreviewDrawerProps) {
  if (!source) {
    return null;
  }

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="source-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Kildevisning"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <h2>{title || "Kildeutdrag"}</h2>
            <p>
              {source.document_id} · side {source.page_start}
              {source.page_end !== source.page_start ? `-${source.page_end}` : ""}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Lukk kildevisning">
            ×
          </button>
        </div>
        <div className="drawer-meta">
          <span>Kilde-ID</span>
          <code>{source.id}</code>
          <span>SHA-256</span>
          <code>{source.sha256}</code>
        </div>
        <div className="drawer-text">{source.text_excerpt}</div>
      </aside>
    </div>
  );
}
